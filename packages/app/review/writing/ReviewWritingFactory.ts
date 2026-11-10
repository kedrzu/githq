import type { GitHubSdk } from '@githq/github/createGitHubRequester.js';
import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import type {
    AddPullRequestReviewThreadMutationVariables,
    AddPullRequestReviewThreadReplyMutationVariables,
    DiffSide,
} from '@githq/github/generated.gen.js';
import { defineFactory } from '@nzyme/ioc/Factory.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { computed, shallowRef, watch } from 'vue';

import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { PullRequestPendingReview } from '@/store/ItemTypes.js';

import type { DiffLineSide } from '../diff/buildDiffRows.js';
import { getFailureText } from '../utils/getFailureText.js';
import { ReviewBlobStore } from '../ReviewBlobStore.js';
import type { ReviewKeptCommentBox } from '../ReviewBlobStore.js';
import type { ReviewThread } from '../threads/ReviewThread.js';
import { NO_REVIEW_SUBMISSION, REVIEW_FINISH_IDLE } from './ReviewWriting.js';
import type {
    ReviewCommentFailure,
    ReviewCommentStatus,
    ReviewCommentTarget,
    ReviewCommentWay,
    ReviewFinish,
    ReviewFinishState,
    ReviewSubmissionChoice,
    ReviewWriteFailure,
    ReviewWriting,
} from './ReviewWriting.js';

/** What a pull request's model gives {@link ReviewWritingFactory}: its account's way to GitHub and its way to what it read. */
export interface ReviewWritingFactoryParams {
    readonly sdk: GitHubSdk;
    readonly login: string;
    /** The pull request's key in {@link ReviewBlobStore}. */
    readonly listKey: string;
    readonly getPullRequestId: () => string | null;
    readonly getHeadRefOid: () => string | null;
    /** Reads the threads anew; whether that worked. */
    readonly readThreadsAgain: () => Promise<boolean>;
    /** The threads, reactive: when they next change they hold whatever was written before. */
    readonly getThreads: () => readonly ReviewThread[];
    /** Keeps the dialog's choice with what the user did in the pull request. */
    readonly keepSubmission: (submission: ReviewSubmissionChoice) => void;
}

/** What {@link ReviewWritingFactory} gives the model it belongs to. */
export interface ReviewWritingHandle {
    readonly writing: ReviewWriting;
    /** Brings back the boxes left with text in them. */
    restoreBoxes(): Promise<void>;
    restoreSubmission(submission: ReviewSubmissionChoice): void;
    /** The threads as read, with what is on its way to GitHub drawn over them; reactive. */
    readonly threads: readonly ReviewThread[];
    /** Threads as read without what a discarded draft still lists: what is kept on disk, for no reload to bring it back. */
    withoutDiscarded(threads: readonly ReviewThread[]): readonly ReviewThread[];
    /** Whether a write is on its way, which dropping the model would forget. */
    isSending(): boolean;
    /** They signed out: no text stays in memory, nothing more goes to the disk, and to GitHub only the deletion of a draft a write under way leaves empty. */
    drop(): void;
}

const EDITING: ReviewCommentStatus = { kind: 'editing' };
/** The second key's review (D22): a comment, with no text of its own. */
const COMMENT_REVIEW: ReviewFinish = { kind: 'submit', choice: NO_REVIEW_SUBMISSION };
const SIDES: Readonly<Record<DiffLineSide, DiffSide>> = { before: 'LEFT', after: 'RIGHT' };

/**
 * Writing in a pull request's review (D1, D17, D22, D28, D33): comments, replies and resolving. A comment shows at once and its text stays, in memory and on
 * disk, until GitHub has taken it: a failure puts the box back with GitHub's words and a reload brings it back. Writes go
 * one at a time, in order, for a comment may need the draft the one before it starts.
 *
 * GitHub knows best whether a draft is open: the model may be late (D21), and a single comment that meets a draft is
 * refused rather than joining it. Every failure reads the draft again, so that the buttons say what can be done now.
 *
 * Not through `EditQueue`: that one undoes a layer over an item's row, and here nothing of the kind is drawn; what comes back
 * on a failure is text in a box, or the red toolbar, each with its own way on, and what shows comes from `ReviewFiles`.
 */
export const ReviewWritingFactory = defineFactory({
    name: 'ReviewWritingFactory',
    deps: {
        blobs: ReviewBlobStore,
        items: ItemStore,
        details: ItemDetailStore,
        logger: Logger,
    },
    setup({ blobs, items, details, logger }, params: ReviewWritingFactoryParams): ReviewWritingHandle {
        const { sdk, login, listKey } = params;

        const targetsRef = shallowRef<readonly ReviewCommentTarget[]>([]);
        const textsRef = shallowRef<ReadonlyMap<string, string>>(new Map());
        const statusesRef = shallowRef<ReadonlyMap<string, ReviewCommentStatus>>(new Map());
        const finishRef = shallowRef<ReviewFinishState>(REVIEW_FINISH_IDLE);
        const submissionRef = shallowRef(NO_REVIEW_SUBMISSION);
        /** By thread: the state it shows until the threads read again say so themselves. */
        const resolvedRef = shallowRef<ReadonlyMap<string, boolean>>(new Map());
        const resolveFailuresRef = shallowRef<ReadonlyMap<string, ReviewWriteFailure>>(new Map());
        /** A draft was discarded here and none is open since: a read right after can still list its comments. */
        const draftDiscardedRef = shallowRef(false);
        const threads = computed(() => {
            const read = withoutDiscarded(params.getThreads());
            return resolvedRef.value.size === 0
                ? read
                : read.map(thread => {
                      const isResolved = resolvedRef.value.get(thread.id);
                      return isResolved === undefined ? thread : { ...thread, isResolved };
                  });
        });

        let dropped = false;
        let writes: Promise<void> = Promise.resolve();
        /** The threads whose state is on its way to GitHub. What shows of them may stay longer: until the threads read say so. */
        const resolvesInFlight = new Set<string>();

        return {
            writing: {
                get targets() {
                    return targetsRef.value;
                },
                get hasText() {
                    return [...textsRef.value.values()].some(text => text.trim() !== '');
                },
                get draftOpen() {
                    return readDraft() !== null || countSending(way => way === 'startDraft') > 0;
                },
                get draftCount() {
                    return (readDraft()?.commentCount ?? 0) + countSending(way => way !== 'single');
                },
                get finish() {
                    return finishRef.value;
                },
                get canRetry() {
                    return canRetry();
                },
                get canDismiss() {
                    return canDismiss();
                },
                get submission() {
                    return submissionRef.value;
                },
                setSubmission,
                open,
                setRange,
                hasCodeChanged,
                close,
                getText: id => textsRef.value.get(id) ?? '',
                setText,
                getStatus: id => statusesRef.value.get(id) ?? EDITING,
                send,
                submit: choice => finishDraft({ kind: 'submit', choice }),
                discard: () => finishDraft({ kind: 'discard' }),
                retry,
                dismiss,
                setResolved,
                getResolveFailure: id => resolveFailuresRef.value.get(id) ?? null,
            },
            restoreBoxes,
            restoreSubmission(submission) {
                submissionRef.value = submission;
            },
            get threads() {
                return threads.value;
            },
            withoutDiscarded,
            isSending: () =>
                finishRef.value.kind === 'sending' ||
                resolvesInFlight.size > 0 ||
                [...statusesRef.value.values()].some(({ kind }) => kind === 'sending'),
            drop,
        };

        function readDraft(): PullRequestPendingReview | null {
            const id = params.getPullRequestId();
            const item = id === null ? undefined : details.getItem(id);
            return item?.kind === 'pullRequest' ? item.pendingReview : null;
        }

        function withoutDiscarded(read: readonly ReviewThread[]) {
            if (!draftDiscardedRef.value || readDraft() !== null) {
                return read;
            }

            return read.flatMap(thread => {
                const comments = thread.comments.filter(comment => comment.state !== 'PENDING');
                if (comments.length === thread.comments.length) {
                    return [thread];
                }

                return comments.length > 0 ? [{ ...thread, comments }] : [];
            });
        }

        function countSending(isCounted: (way: ReviewCommentWay) => boolean) {
            let count = 0;
            for (const status of statusesRef.value.values()) {
                if (status.kind === 'sending' && isCounted(status.way)) {
                    count++;
                }
            }

            return count;
        }

        function setSubmission(choice: ReviewSubmissionChoice) {
            submissionRef.value = choice;
            params.keepSubmission(choice);
        }

        function open(wanted: Omit<ReviewCommentTarget, 'id'>) {
            const held = targetsRef.value.find(
                ({ id, path, side, line, threadId }) =>
                    threadId === wanted.threadId &&
                    (threadId !== null || (path === wanted.path && side === wanted.side && line === wanted.line)) &&
                    !isOnItsWay(id),
            );
            if (held) {
                return held;
            }

            const headRefOid = wanted.threadId === null ? (params.getHeadRefOid() ?? undefined) : undefined;
            const target = { ...wanted, id: crypto.randomUUID(), headRefOid };
            targetsRef.value = [...targetsRef.value, target];
            return target;
        }

        function isOnItsWay(id: string) {
            const kind = statusesRef.value.get(id)?.kind;
            return kind === 'sending' || kind === 'sent';
        }

        function setRange(id: string, startLine: number | null, line: number) {
            targetsRef.value = targetsRef.value.map(target =>
                target.id === id && (target.startLine !== startLine || target.line !== line)
                    ? { ...target, startLine, line, headRefOid: params.getHeadRefOid() ?? target.headRefOid }
                    : target,
            );
            keepBox(id);
        }

        function hasCodeChanged(id: string) {
            const written = targetsRef.value.find(target => target.id === id)?.headRefOid;
            const head = params.getHeadRefOid();
            return written !== undefined && head !== null && written !== head;
        }

        function close(id: string) {
            targetsRef.value = targetsRef.value.filter(target => target.id !== id);
            setInMap(textsRef, id, null);
            setInMap(statusesRef, id, null);
            forgetBox(id);
        }

        function setText(id: string, text: string) {
            if (!dropped) {
                setInMap(textsRef, id, text);
                keepBox(id);
            }
        }

        function setInMap<T>(ref: { value: ReadonlyMap<string, T> }, id: string, value: T | null) {
            const next = new Map(ref.value);
            if (value === null) {
                next.delete(id);
            } else {
                next.set(id, value);
            }

            ref.value = next;
        }

        /** With no text there is nothing to bring back. */
        function keepBox(id: string) {
            const target = targetsRef.value.find(other => other.id === id);
            const text = textsRef.value.get(id) ?? '';
            if (!target || dropped) {
                return;
            }

            if (text === '') {
                forgetBox(id);
            } else {
                keepOnDisk(() => blobs.writeCommentBox(login, listKey, { ...target, text }));
            }
        }

        function forgetBox(id: string) {
            keepOnDisk(() => blobs.deleteCommentBox(login, listKey, id));
        }

        function keepOnDisk(write: () => Promise<void>) {
            if (!dropped) {
                write().catch((error: unknown) => {
                    logger.warn('Could not keep a comment being written on disk', { error });
                });
            }
        }

        async function restoreBoxes() {
            let kept: readonly ReviewKeptCommentBox[] = [];
            try {
                kept = await blobs.readCommentBoxes(login, listKey);
            } catch (error) {
                logger.warn('Could not read the comments being written from disk', { error });
            }

            if (dropped) {
                return;
            }

            const known = new Set(targetsRef.value.map(({ id }) => id));
            const restored = kept.filter(({ id }) => !known.has(id));
            targetsRef.value = [...targetsRef.value, ...restored.map(({ text: _text, ...target }) => target)];
            const texts = new Map(textsRef.value);
            for (const { id, text } of restored) {
                texts.set(id, text);
            }

            textsRef.value = texts;
        }

        function send(id: string, way: ReviewCommentWay) {
            const target = targetsRef.value.find(other => other.id === id);
            const body = (textsRef.value.get(id) ?? '').trim();
            if (!target || body === '' || isOnItsWay(id)) {
                return;
            }

            setInMap(statusesRef, id, { kind: 'sending', way, body });
            enqueue(() => sendComment(target, way, body));
        }

        function enqueue(write: () => Promise<void>) {
            writes = writes.then(() => (dropped ? undefined : write()));
        }

        async function sendComment(target: ReviewCommentTarget, way: ReviewCommentWay, body: string) {
            // What it turned out to be: a reply says only afterwards whether it joined a draft.
            let done = way;
            const failure = await catchWrite(async () => {
                if (target.threadId === null) {
                    await postComment(target, way, body);
                } else {
                    done = await postReply(target.threadId, way, body);
                }
            }, toCommentFailure);
            if (dropped) {
                return;
            }

            const { id } = target;
            if (failure) {
                setInMap(statusesRef, id, { kind: 'failed', failure });
                // No answer may still have got there: the comment shows beside the box keeping its text.
                await (failure.kind === 'notReached' ? readAgain() : readDraftAgain());
                return;
            }

            // It is GitHub's now: from here on nothing may send it again, a reload included.
            forgetBox(id);
            setInMap(textsRef, id, null);
            setInMap(statusesRef, id, { kind: 'sent', way: done, body });
            const threadsRead = done === 'joinAndSubmit' ? await sendFinish(COMMENT_REVIEW) : await readAgain();
            if (!dropped) {
                afterRead(threadsRead, () => close(id));
            }
        }

        /** Not before the threads have it, or what was written would be gone from the screen for as long as that takes. */
        function afterRead(threadsRead: boolean, done: () => void) {
            if (threadsRead) {
                done();
                return;
            }

            watch(() => params.getThreads(), done, { flush: 'sync', once: true });
        }

        /** Rejects when GitHub doesn't take it. */
        async function postComment(target: ReviewCommentTarget, way: ReviewCommentWay, body: string) {
            const pullRequestId = params.getPullRequestId();
            const commitOID = params.getHeadRefOid();
            if (pullRequestId === null || commitOID === null) {
                throw new Error('The pull request has not been read');
            }

            const thread = toThread(target, body);
            switch (way) {
                case 'single':
                    await sdk.AddPullRequestReview({ pullRequestId, commitOID, event: 'COMMENT', thread });
                    break;
                case 'startDraft': {
                    const { addPullRequestReview } = await sdk.AddPullRequestReview({
                        pullRequestId,
                        commitOID,
                        thread,
                    });
                    const review = addPullRequestReview?.pullRequestReview;
                    if (review) {
                        setDraft({
                            id: review.id,
                            createdAt: review.createdAt,
                            commentCount: review.comments.totalCount,
                        });
                    }

                    break;
                }
                case 'joinDraft':
                case 'joinAndSubmit': {
                    const draft = readDraft();
                    if (!draft) {
                        throw new NoDraftError();
                    }

                    await sdk.AddPullRequestReviewThread({ ...thread, pullRequestReviewId: draft.id });
                    setDraft({ ...draft, commentCount: draft.commentCount + 1 });
                    break;
                }
                default:
                    assertNever(way);
            }
        }

        /**
         * GitHub doesn't refuse a reply that meets a draft but takes it in silently (D17), so a reply meant to go out at once asks
         * first; what it says of the reply afterwards covers the moment in between. Rejects when GitHub doesn't take it, and resolves
         * to what it did with it.
         */
        async function postReply(threadId: string, way: ReviewCommentWay, body: string): Promise<ReviewCommentWay> {
            const pullRequestId = params.getPullRequestId();
            const reply = { pullRequestReviewThreadId: threadId, body };
            switch (way) {
                case 'single': {
                    if (pullRequestId !== null) {
                        await details.readAgain(pullRequestId);
                    }

                    if (dropped) {
                        return way;
                    }

                    if (readDraft()) {
                        throw new DraftFoundError();
                    }

                    return await sendReply(reply, way);
                }
                case 'startDraft': {
                    const commitOID = pullRequestId === null ? null : await readHeadRefOid(pullRequestId);
                    if (pullRequestId === null || commitOID === null) {
                        throw new Error('The pull request has not been read');
                    }

                    const started = await sdk.StartPullRequestReview({ pullRequestId, commitOID });
                    const review = started.addPullRequestReview?.pullRequestReview;
                    if (!review) {
                        throw new Error('GitHub answered with no review');
                    }

                    // Signed out meanwhile, and nothing else goes out now but this: left empty, the draft would block the pull request.
                    if (dropped) {
                        await deleteEmptyDraft(review.id);
                        return way;
                    }

                    try {
                        await sdk.AddPullRequestReviewThreadReply({ ...reply, pullRequestReviewId: review.id });
                    } catch (error) {
                        // Empty it would only block whatever is written next (D17). If it stays, every failure reads the draft again.
                        await deleteEmptyDraft(review.id);
                        throw error;
                    }

                    setDraft({ id: review.id, createdAt: review.createdAt, commentCount: 1 });
                    return way;
                }
                case 'joinDraft':
                case 'joinAndSubmit': {
                    const draft = readDraft();
                    if (!draft) {
                        throw new NoDraftError();
                    }

                    return await sendReply({ ...reply, pullRequestReviewId: draft.id }, way);
                }
                default:
                    return assertNever(way);
            }
        }

        async function deleteEmptyDraft(pullRequestReviewId: string) {
            await catchWrite(async () => {
                await sdk.DeletePullRequestReview({ pullRequestReviewId });
            }, toWriteFailure);
        }

        async function sendReply(
            reply: AddPullRequestReviewThreadReplyMutationVariables,
            way: ReviewCommentWay,
        ): Promise<ReviewCommentWay> {
            const { addPullRequestReviewThreadReply } = await sdk.AddPullRequestReviewThreadReply(reply);
            const review = addPullRequestReviewThreadReply?.comment?.pullRequestReview;
            if (review?.state !== 'PENDING') {
                return 'single';
            }

            const draft = readDraft();
            setDraft({
                id: review.id,
                createdAt: draft?.createdAt ?? new Date().toISOString(),
                commentCount: (draft?.commentCount ?? 0) + 1,
            });
            return way === 'single' ? 'joinDraft' : way;
        }

        function setResolved(threadId: string, resolved: boolean) {
            if (dropped || resolvesInFlight.has(threadId)) {
                return;
            }

            resolvesInFlight.add(threadId);
            setInMap(resolvedRef, threadId, resolved);
            setInMap(resolveFailuresRef, threadId, null);
            enqueue(async () => {
                const failure = await catchWrite(async () => {
                    await (resolved ? sdk.ResolveReviewThread({ threadId }) : sdk.UnresolveReviewThread({ threadId }));
                }, toWriteFailure);
                resolvesInFlight.delete(threadId);
                if (dropped) {
                    return;
                }

                if (failure) {
                    setInMap(resolvedRef, threadId, null);
                    setInMap(resolveFailuresRef, threadId, failure);
                    // No answer may still have got there: the thread shows what GitHub holds, and then nothing failed.
                    await params.readThreadsAgain();
                    if (!dropped && params.getThreads().find(({ id }) => id === threadId)?.isResolved === resolved) {
                        setInMap(resolveFailuresRef, threadId, null);
                    }

                    return;
                }

                afterRead(await params.readThreadsAgain(), () => {
                    // A toggle since draws over the threads until its own read.
                    if (!resolvesInFlight.has(threadId)) {
                        setInMap(resolvedRef, threadId, null);
                    }
                });
            });
        }

        function finishDraft(finish: ReviewFinish) {
            if (finishRef.value.kind === 'sending') {
                return;
            }

            finishRef.value = { kind: 'sending', finish };
            const ahead =
                finish.kind === 'submit'
                    ? [...statusesRef.value].filter(([, { kind }]) => kind === 'sending').map(([id]) => id)
                    : [];
            enqueue(async () => {
                // The reader counted those in. Without one of them it goes only once they know: Try again takes a new list.
                if (ahead.some(id => statusesRef.value.get(id)?.kind === 'failed')) {
                    finishRef.value = {
                        kind: 'failed',
                        finish,
                        failure: { kind: 'commentRefused' },
                        draftId: readDraft()?.id ?? null,
                    };
                    return;
                }

                await sendFinish(finish);
            });
        }

        function retry() {
            const state = finishRef.value;
            if (state.kind === 'failed' && canRetry()) {
                finishDraft(state.finish);
            }
        }

        function dismiss() {
            if (canDismiss()) {
                finishRef.value = REVIEW_FINISH_IDLE;
            }
        }

        function canRetry() {
            const state = finishRef.value;
            if (state.kind !== 'failed') {
                return false;
            }

            const now = readDraft()?.id ?? null;
            return now === null || now === state.draftId;
        }

        function canDismiss() {
            const state = finishRef.value;
            if (state.kind !== 'failed') {
                return false;
            }

            const now = readDraft()?.id ?? null;
            return now === null || now !== state.draftId;
        }

        /** Whether the threads could be read again after it. */
        async function sendFinish(finish: ReviewFinish): Promise<boolean> {
            finishRef.value = { kind: 'sending', finish };
            const draft = readDraft();
            // Gone by now: only the dialog's review goes without one.
            if (!draft && (finish.kind === 'discard' || finish === COMMENT_REVIEW)) {
                finishRef.value = REVIEW_FINISH_IDLE;
                return await readAgain();
            }

            const failure = await catchWrite(() => writeFinish(finish, draft), toWriteFailure);
            if (dropped) {
                return false;
            }

            if (failure) {
                finishRef.value = { kind: 'failed', finish, failure, draftId: draft?.id ?? null };
            } else {
                setDraft(null);
                draftDiscardedRef.value = finish.kind === 'discard';
                finishRef.value = REVIEW_FINISH_IDLE;
                // Sent with the review or gone with the draft. The second key's review sends none of it.
                if (finish !== COMMENT_REVIEW) {
                    setSubmission(NO_REVIEW_SUBMISSION);
                }
            }

            return await readAgain();
        }

        async function writeFinish(finish: ReviewFinish, draft: PullRequestPendingReview | null) {
            if (finish.kind === 'discard') {
                if (draft) {
                    await sdk.DeletePullRequestReview({ pullRequestReviewId: draft.id });
                }

                return;
            }

            const { event, body } = finish.choice;
            const text = body.trim() === '' ? undefined : body;
            if (draft) {
                await sdk.SubmitPullRequestReview({ pullRequestReviewId: draft.id, event, body: text });
                return;
            }

            const pullRequestId = params.getPullRequestId();
            const commitOID = pullRequestId === null ? null : await readHeadRefOid(pullRequestId);
            if (pullRequestId === null || commitOID === null) {
                throw new Error('The pull request has not been read');
            }

            await sdk.SendPullRequestReview({ pullRequestId, commitOID, event, body: text });
        }

        /**
         * The commit a review starts on or names: the head the files were read at, so that an approval names what was read.
         * Opened for its threads alone (the item's thread), the model has read none, and the item's row can be a poll behind
         * a push: the pull request is read again, for the review not to land on a commit that is no longer its head.
         */
        async function readHeadRefOid(pullRequestId: string) {
            const read = params.getHeadRefOid();
            if (read !== null) {
                return read;
            }

            await details.readAgain(pullRequestId);
            const item = details.getItem(pullRequestId);
            return item?.kind === 'pullRequest' ? item.headRefOid : null;
        }

        /** What the write's refusal said, `null` when it went through. */
        async function catchWrite<F>(write: () => Promise<void>, toFailure: (error: unknown) => F): Promise<F | null> {
            try {
                await write();
                return null;
            } catch (error) {
                if (!dropped) {
                    logger.warn('GitHub did not take a write in a review', { error });
                }

                return toFailure(error);
            }
        }

        function setDraft(draft: PullRequestPendingReview | null) {
            if (draft) {
                draftDiscardedRef.value = false;
                // The reader's own comment, so they know of this draft. One arriving by a read keeps the refusal showing.
                if (finishRef.value.kind === 'failed' && finishRef.value.draftId !== draft.id) {
                    finishRef.value = REVIEW_FINISH_IDLE;
                }
            }

            const id = params.getPullRequestId();
            if (id === null) {
                return;
            }

            const stored = items.getStored(id);
            if (stored?.kind === 'pullRequest') {
                items.upsertMany([{ ...stored, pendingReview: draft }]);
            }

            details.update(id, detail =>
                detail.kind === 'pullRequest' ? { ...detail, item: { ...detail.item, pendingReview: draft } } : detail,
            );
        }

        async function readDraftAgain() {
            const id = params.getPullRequestId();
            if (id !== null) {
                await details.readAgain(id);
            }

            const state = finishRef.value;
            if (state.kind !== 'failed' || readDraft() !== null) {
                return;
            }

            // No answer, and the draft it was about is gone: it almost certainly got there.
            const gotThere = state.failure.kind === 'notReached' && state.draftId !== null;
            // A discard has nothing left to do, and a comment review's comment went with the draft. A review from the dialog
            // stays: refused, it is the reader's still, and Try again sends it with no draft, carrying no comment unseen.
            if (state.finish.kind === 'discard' || state.finish === COMMENT_REVIEW || gotThere) {
                finishRef.value = REVIEW_FINISH_IDLE;
                if (gotThere && state.finish !== COMMENT_REVIEW) {
                    setSubmission(NO_REVIEW_SUBMISSION);
                }
            }
        }

        /** Whether the threads could be read. */
        async function readAgain() {
            const [threadsRead] = await Promise.all([params.readThreadsAgain(), readDraftAgain()]);
            return threadsRead;
        }

        function drop() {
            dropped = true;
            targetsRef.value = [];
            textsRef.value = new Map();
            statusesRef.value = new Map();
            finishRef.value = REVIEW_FINISH_IDLE;
            submissionRef.value = NO_REVIEW_SUBMISSION;
            resolvedRef.value = new Map();
            resolveFailuresRef.value = new Map();
            resolvesInFlight.clear();
        }
    },
});

class NoDraftError extends Error {}

class DraftFoundError extends Error {}

function toCommentFailure(error: unknown): ReviewCommentFailure {
    if (error instanceof NoDraftError) {
        return { kind: 'noDraft' };
    }

    if (error instanceof DraftFoundError) {
        return { kind: 'draftFound' };
    }

    return toWriteFailure(error);
}

function toWriteFailure(error: unknown): ReviewWriteFailure {
    if (!(error instanceof GitHubApiError)) {
        return { kind: 'notReached' };
    }

    // Live: an answer of errors whose messages are all empty.
    const wordless = error.errors.length > 0 && error.errors.every(({ message }) => message.trim() === '');
    return { kind: 'refused', message: wordless ? null : getFailureText(error) };
}

function toThread(target: ReviewCommentTarget, body: string) {
    const { path, line, side, startLine } = target;
    const thread: Omit<AddPullRequestReviewThreadMutationVariables, 'pullRequestReviewId'> = {
        path,
        line,
        side: SIDES[side],
        body,
    };
    return startLine === null ? thread : { ...thread, startLine, startSide: SIDES[side] };
}
