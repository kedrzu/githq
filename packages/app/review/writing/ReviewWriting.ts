import type { GitHubSdk } from '@githq/github/createGitHubRequester.js';
import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import type {
    AddPullRequestReviewThreadMutationVariables,
    AddPullRequestReviewThreadReplyMutationVariables,
    DiffSide,
    PullRequestReviewEvent,
} from '@githq/github/generated.gen.js';
import type { Logger } from '@nzyme/logging/Logger.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { computed, shallowRef, watch } from 'vue';

import type { ItemDetailStore } from '@/store/ItemDetailStore.js';
import type { ItemStore } from '@/store/ItemStore.js';
import type { PullRequestPendingReview } from '@/store/ItemTypes.js';

import type { DiffLineSide } from '../diff/buildDiffRows.js';
import { getFailureText } from '../utils/getFailureText.js';
import type { ReviewBlobStore, ReviewKeptCommentBox } from '../ReviewBlobStore.js';
import type { ReviewThread } from '../threads/ReviewThread.js';

/** Where a comment goes in the code. Stays the same while it is written, so that its row does not move on a key press. */
export interface ReviewCommentTarget {
    readonly id: string;
    readonly path: string;
    readonly side: DiffLineSide;
    /** Its last line, 1-based, which it sits under. */
    readonly line: number;
    /** Where a range starts, on the same side; `null` for one line. */
    readonly startLine: number | null;
    /** The thread it replies in, whose lines these are; `null` for a comment of its own. */
    readonly threadId: string | null;
}

/**
 * What a key of the comment box does (D17, D22). `single`: out at once. `startDraft`: a draft review begins with it. With a
 * draft open only these two: `joinDraft` adds it, `joinAndSubmit` adds it and submits the whole draft as a comment review.
 */
export type ReviewCommentWay = 'single' | 'startDraft' | 'joinDraft' | 'joinAndSubmit';

/** Why GitHub didn't take a write. */
export type ReviewWriteFailure =
    /** GitHub's own words. */
    | { readonly kind: 'refused'; readonly message: string }
    /** No answer: it may or may not have got there. */
    | { readonly kind: 'notReached' }
    /** A comment meant for a draft that turned out not to be open. */
    | { readonly kind: 'noDraft' }
    /** A reply meant to go out at once, and a draft turned out to be open, which it would have joined: it wasn't sent. */
    | { readonly kind: 'draftFound' };

/** How far a comment box is. */
export type ReviewCommentStatus =
    | { readonly kind: 'editing' }
    | { readonly kind: 'failed'; readonly failure: ReviewWriteFailure }
    /** Shows as a comment at once (`AGENTS.md`), its text still kept until GitHub answers. */
    | { readonly kind: 'sending'; readonly way: ReviewCommentWay; readonly body: string }
    /** GitHub took it: it shows like this until the threads read again have it. */
    | { readonly kind: 'sent'; readonly way: ReviewCommentWay; readonly body: string };

/** What the submit dialog holds (D33). */
export interface ReviewSubmissionChoice {
    readonly event: PullRequestReviewEvent;
    /** The review's own text, on the pull request itself. */
    readonly body: string;
}

/** What finishes a draft. */
export type ReviewFinish =
    | { readonly kind: 'submit'; readonly choice: ReviewSubmissionChoice }
    | { readonly kind: 'discard' };

/** How finishing the draft is going; `failed` keeps everything, and `retry` sends the same again (D33, CR76). */
export type ReviewFinishState =
    | { readonly kind: 'idle' }
    | { readonly kind: 'sending'; readonly finish: ReviewFinish }
    | { readonly kind: 'failed'; readonly finish: ReviewFinish; readonly failure: ReviewWriteFailure };

/**
 * What is being written in a pull request's review: its comment boxes and its draft on the way to GitHub. Reactive, except
 * for its methods. {@link targets} changes only when a box comes, goes or moves, for rows are built of it, and a key press
 * changes only {@link getText}.
 */
export interface ReviewWriting {
    /** The boxes open, oldest first. */
    readonly targets: readonly ReviewCommentTarget[];
    /** Whether any box holds text not sent: the tab doesn't reload under it. */
    readonly hasText: boolean;
    /** Whether a comment can only join a draft: one is open, or one on its way starts it. */
    readonly draftOpen: boolean;
    /** How many comments the draft has, those on their way to it too. */
    readonly draftCount: number;
    readonly finish: ReviewFinishState;
    readonly submission: ReviewSubmissionChoice;
    setSubmission(choice: ReviewSubmissionChoice): void;
    /** A box on the line: the one being written there, or a new one. */
    open(target: Omit<ReviewCommentTarget, 'id'>): ReviewCommentTarget;
    /** The box now covers those lines, keeping its text. */
    setRange(id: string, startLine: number | null, line: number): void;
    /** Closes a box, its text gone with it. */
    close(id: string): void;
    getText(id: string): string;
    /** Kept on disk at once: what is typed survives a reload. */
    setText(id: string, text: string): void;
    getStatus(id: string): ReviewCommentStatus;
    /** Sends what the box holds, once: nothing for an empty box or one already on its way. */
    send(id: string, way: ReviewCommentWay): void;
    /** Submits the draft as chosen. */
    submit(choice: ReviewSubmissionChoice): void;
    /** Deletes the draft on GitHub. */
    discard(): void;
    /** Sends again what failed. */
    retry(): void;
    /** Resolves a thread, or opens it again: shows at once, at once on GitHub whatever draft is open (D17). */
    setResolved(threadId: string, resolved: boolean): void;
    /** Why the last change of the thread's state didn't go through; it shows as it was again. */
    getResolveFailure(threadId: string): ReviewWriteFailure | null;
}

/** The parameters of {@link createReviewWriting}. */
export interface CreateReviewWritingParams {
    readonly sdk: GitHubSdk;
    readonly login: string;
    /** The pull request's key in {@link ReviewBlobStore}. */
    readonly listKey: string;
    readonly blobs: ReviewBlobStore;
    readonly items: ItemStore;
    readonly details: ItemDetailStore;
    readonly logger: Logger;
    readonly getPullRequestId: () => string | null;
    readonly getHeadRefOid: () => string | null;
    /** Reads the threads anew; whether that worked. */
    readonly readThreadsAgain: () => Promise<boolean>;
    /** The threads, reactive: when they next change they hold whatever was written before. */
    readonly getThreads: () => readonly ReviewThread[];
    /** Keeps the dialog's choice with what the user did in the pull request. */
    readonly keepSubmission: (submission: ReviewSubmissionChoice) => void;
}

/** What {@link createReviewWriting} gives the model it belongs to. */
export interface ReviewWritingHandle {
    readonly writing: ReviewWriting;
    /** Brings back the boxes left with text in them. */
    restoreBoxes(): Promise<void>;
    restoreSubmission(submission: ReviewSubmissionChoice): void;
    /** The threads as read, with what is on its way to GitHub drawn over them; reactive. */
    readonly threads: readonly ReviewThread[];
    /** Whether a write is on its way, which dropping the model would forget. */
    isSending(): boolean;
    /** They signed out: nothing more goes to GitHub or the disk, and no text stays in memory. */
    drop(): void;
}

const IDLE: ReviewFinishState = { kind: 'idle' };
const EDITING: ReviewCommentStatus = { kind: 'editing' };
const NO_SUBMISSION: ReviewSubmissionChoice = { event: 'COMMENT', body: '' };
/** The second key's review (D22): a comment, with no text of its own. */
const COMMENT_REVIEW: ReviewFinish = { kind: 'submit', choice: NO_SUBMISSION };
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
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createReviewWriting(params: CreateReviewWritingParams): ReviewWritingHandle {
    const { sdk, login, listKey, blobs, items, details, logger } = params;

    const targetsRef = shallowRef<readonly ReviewCommentTarget[]>([]);
    const textsRef = shallowRef<ReadonlyMap<string, string>>(new Map());
    const statusesRef = shallowRef<ReadonlyMap<string, ReviewCommentStatus>>(new Map());
    const finishRef = shallowRef<ReviewFinishState>(IDLE);
    const submissionRef = shallowRef(NO_SUBMISSION);
    /** By thread: the state it shows until the threads read again say so themselves. */
    const resolvedRef = shallowRef<ReadonlyMap<string, boolean>>(new Map());
    const resolveFailuresRef = shallowRef<ReadonlyMap<string, ReviewWriteFailure>>(new Map());
    const threads = computed(() => {
        const read = params.getThreads();
        return resolvedRef.value.size === 0
            ? read
            : read.map(thread => {
                  const isResolved = resolvedRef.value.get(thread.id);
                  return isResolved === undefined ? thread : { ...thread, isResolved };
              });
    });

    let dropped = false;
    let writes: Promise<void> = Promise.resolve();

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
            get submission() {
                return submissionRef.value;
            },
            setSubmission,
            open,
            setRange,
            close,
            getText: id => textsRef.value.get(id) ?? '',
            setText,
            getStatus: id => statusesRef.value.get(id) ?? EDITING,
            send,
            submit: choice => finishDraft({ kind: 'submit', choice }),
            discard: () => finishDraft({ kind: 'discard' }),
            retry,
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
        isSending: () =>
            finishRef.value.kind === 'sending' ||
            resolvedRef.value.size > 0 ||
            [...statusesRef.value.values()].some(({ kind }) => kind === 'sending'),
        drop,
    };

    function readDraft(): PullRequestPendingReview | null {
        const id = params.getPullRequestId();
        const item = id === null ? undefined : details.getItem(id);
        return item?.kind === 'pullRequest' ? item.pendingReview : null;
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

        const target = { ...wanted, id: crypto.randomUUID() };
        targetsRef.value = [...targetsRef.value, target];
        return target;
    }

    function isOnItsWay(id: string) {
        const kind = statusesRef.value.get(id)?.kind;
        return kind === 'sending' || kind === 'sent';
    }

    function setRange(id: string, startLine: number | null, line: number) {
        targetsRef.value = targetsRef.value.map(target => (target.id === id ? { ...target, startLine, line } : target));
        keepBox(id);
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
        const failure = await tryWrite(async () => {
            if (target.threadId === null) {
                await postComment(target, way, body);
            } else {
                done = await postReply(target.threadId, way, body);
            }
        });
        if (dropped) {
            return;
        }

        const { id } = target;
        if (failure) {
            setInMap(statusesRef, id, { kind: 'failed', failure });
            await readDraftAgain();
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

        const stop = watch(
            () => params.getThreads(),
            () => {
                stop();
                done();
            },
            { flush: 'sync' },
        );
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
                const { addPullRequestReview } = await sdk.AddPullRequestReview({ pullRequestId, commitOID, thread });
                const review = addPullRequestReview?.pullRequestReview;
                if (review) {
                    setDraft({ id: review.id, createdAt: review.createdAt, commentCount: review.comments.totalCount });
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

                if (readDraft()) {
                    throw new DraftFoundError();
                }

                return await sendReply(reply, way);
            }
            case 'startDraft': {
                const commitOID = params.getHeadRefOid();
                if (pullRequestId === null || commitOID === null) {
                    throw new Error('The pull request has not been read');
                }

                const started = await sdk.StartPullRequestReview({ pullRequestId, commitOID });
                const review = started.addPullRequestReview?.pullRequestReview;
                if (!review) {
                    throw new Error('GitHub answered with no review');
                }

                try {
                    await sdk.AddPullRequestReviewThreadReply({ ...reply, pullRequestReviewId: review.id });
                } catch (error) {
                    // Empty it would only block whatever is written next (D17). If it stays, every failure reads the draft again.
                    await tryWrite(async () => {
                        await sdk.DeletePullRequestReview({ pullRequestReviewId: review.id });
                    });
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
        if (dropped || resolvedRef.value.has(threadId)) {
            return;
        }

        setInMap(resolvedRef, threadId, resolved);
        setInMap(resolveFailuresRef, threadId, null);
        enqueue(async () => {
            const failure = await tryWrite(async () => {
                await (resolved ? sdk.ResolveReviewThread({ threadId }) : sdk.UnresolveReviewThread({ threadId }));
            });
            if (dropped) {
                return;
            }

            if (failure) {
                setInMap(resolvedRef, threadId, null);
                setInMap(resolveFailuresRef, threadId, failure);
                // No answer may still have got there: the thread shows what GitHub holds.
                await params.readThreadsAgain();
                return;
            }

            afterRead(await params.readThreadsAgain(), () => setInMap(resolvedRef, threadId, null));
        });
    }

    function finishDraft(finish: ReviewFinish) {
        if (finishRef.value.kind !== 'sending') {
            finishRef.value = { kind: 'sending', finish };
            enqueue(async () => {
                await sendFinish(finish);
            });
        }
    }

    function retry() {
        const state = finishRef.value;
        if (state.kind === 'failed') {
            finishDraft(state.finish);
        }
    }

    /** Whether the threads could be read again after it. */
    async function sendFinish(finish: ReviewFinish): Promise<boolean> {
        finishRef.value = { kind: 'sending', finish };
        const failure = await tryWrite(async () => {
            const draft = readDraft();
            if (!draft) {
                throw new NoDraftError();
            }

            if (finish.kind === 'discard') {
                await sdk.DeletePullRequestReview({ pullRequestReviewId: draft.id });
            } else {
                const { event, body } = finish.choice;
                await sdk.SubmitPullRequestReview({
                    pullRequestReviewId: draft.id,
                    event,
                    body: body.trim() === '' ? undefined : body,
                });
            }
        });
        if (dropped) {
            return false;
        }

        if (failure) {
            finishRef.value = { kind: 'failed', finish, failure };
        } else {
            setDraft(null);
            finishRef.value = IDLE;
            // Sent with the review or gone with the draft. The second key's review sends none of it.
            if (finish !== COMMENT_REVIEW) {
                setSubmission(NO_SUBMISSION);
            }
        }

        return await readAgain();
    }

    /** What the write's refusal said, `null` when it went through. */
    async function tryWrite(write: () => Promise<void>): Promise<ReviewWriteFailure | null> {
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

        // Finished elsewhere: there is nothing left for a failure to be about, and the next draft doesn't inherit it.
        if (finishRef.value.kind === 'failed' && readDraft() === null) {
            finishRef.value = IDLE;
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
        finishRef.value = IDLE;
        submissionRef.value = NO_SUBMISSION;
        resolvedRef.value = new Map();
        resolveFailuresRef.value = new Map();
    }
}

class NoDraftError extends Error {}

class DraftFoundError extends Error {}

function toFailure(error: unknown): ReviewWriteFailure {
    if (error instanceof NoDraftError) {
        return { kind: 'noDraft' };
    }

    if (error instanceof DraftFoundError) {
        return { kind: 'draftFound' };
    }

    return error instanceof GitHubApiError
        ? { kind: 'refused', message: getFailureText(error) }
        : { kind: 'notReached' };
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
