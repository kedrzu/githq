import type { GitHubGraphQLCallOptions } from '@githq/github/createGitHubRequester.js';
import type {
    FileViewedState,
    PatchStatus,
    PullRequestReviewFilesQuery,
    Requester,
} from '@githq/github/generated.gen.js';
import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import { readReviewBlobOids, readReviewBlobTexts } from '@githq/github/readReviewBlobs.js';
import type { ReviewBlobOidAnswer } from '@githq/github/readReviewBlobs.js';
import { getGitBlobText } from '@githq/github/rest/getGitBlobText.js';
import type { GitHubRestRequester } from '@githq/github/rest/createGitHubRestRequester.js';
import { getMergeBase } from '@githq/github/rest/getMergeBase.js';
import { listPullRequestRenames } from '@githq/github/rest/listPullRequestRenames.js';
import { markFilesViewed } from '@githq/github/markFilesViewed.js';
import type { FileViewedMark } from '@githq/github/markFilesViewed.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { createSingleRunner } from '@nzyme/utils/createSingleRunner.js';
import type { SingleRunnerState } from '@nzyme/utils/createSingleRunner.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { formatItemReference } from '@/item/itemRoutes.js';
import type { ItemReference } from '@/item/itemRoutes.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRequesterFactory } from '@/services/GitHubRequesterFactory.js';
import { GitHubRestFactory } from '@/services/GitHubRestFactory.js';
import { isRateLimitRefusal } from '@/sync/isRateLimitRefusal.js';

import { ReviewBlobStore } from './ReviewBlobStore.js';
import type { ReviewBlob, ReviewKeptFileList, ReviewKeptResolution } from './ReviewBlobStore.js';
import { ReviewViewedFailures } from './ReviewViewedFailures.js';
import { getFileName } from './utils/getFileName.js';
import { parseLinguistGenerated } from './utils/parseLinguistGenerated.js';

/** A file of a pull request, as its list shows it. */
export interface ReviewFile {
    readonly path: string;
    /** Where a renamed or copied file came from; `null` for any other. */
    readonly previousPath: string | null;
    readonly changeType: PatchStatus;
    readonly additions: number;
    readonly deletions: number;
    /** `DISMISSED`: viewed once, changed since. */
    readonly viewed: FileViewedState;
}

/** How far a file's content is. Only `failed` is an error, and only it can be retried. */
export type ReviewFileState =
    | { readonly kind: 'waiting' }
    | { readonly kind: 'loading' }
    /** The merge base's text and the head's; `null` for the side the file doesn't exist on. */
    | { readonly kind: 'ready'; readonly before: string | null; readonly after: string | null }
    | { readonly kind: 'binary' }
    /** Above {@link MAX_FILE_BYTES} on either side: not fetched. */
    | { readonly kind: 'tooLarge' }
    | { readonly kind: 'failed'; readonly error: Error };

/** Why a file starts collapsed (D8). */
export type ReviewFileCollapseReason = 'lockFile' | 'generated' | 'large';

/**
 * Why a file shows only its header: its {@link ReviewFileCollapseReason}, or `byHand` when it has none. `undecided`: it may
 * be generated, which isn't known until `.gitattributes` is read, and it must not flip from open to collapsed (D35).
 */
export type ReviewFileCollapse = ReviewFileCollapseReason | 'byHand' | 'undecided';

/** How far the list of files is. */
export type ReviewFileListState =
    | { readonly kind: 'loading' }
    | { readonly kind: 'ready' }
    /** Opening the pull request again ({@link ReviewFiles.open}) tries it again. */
    | { readonly kind: 'failed'; readonly error: Error }
    /** GitHub says it doesn't exist, to this user at least: what was kept of it is not shown. Opening it again asks anew. */
    | { readonly kind: 'gone' };

/** A pull request's files for its review, and their contents as they arrive. Reactive, except for its methods. */
export interface PullRequestFiles {
    readonly list: ReviewFileListState;
    /**
     * In GitHub's order; grows page by page after `list` is `ready`, until {@link listComplete}. Kept from the last read
     * until GitHub answers, then what it says. A failed reload leaves the list it had.
     */
    readonly files: readonly ReviewFile[];
    /** Whether {@link files} is all GitHub lists. A failed read of a later page leaves it `false` and what came. */
    readonly listComplete: boolean;
    /** The pull request's node id, once the list is read. */
    readonly id: string | null;
    /** The commit the files are read at, once the list is read. */
    readonly headRefOid: string | null;
    /** How many files the pull request really has: GitHub lists at most 3000. */
    readonly changedFiles: number | null;
    /**
     * Moves on at most once per {@link UPDATE_EVERY_MS} while file states change, so that 225 files arriving at once
     * redraw once. {@link getState} depends on it.
     */
    readonly version: number;
    /** The state of the file at `path`; `waiting` for one not (yet) on the list. */
    getState(path: string): ReviewFileState;
    /** Fetches the file next: a jump to it. Also before the list is read; a file already on its way stays as it is. */
    prioritize(path: string): void;
    /** Fetches a `failed` file again, next. */
    retry(path: string): void;
    /** Why the file shows only its header (D8); `null` for an open one. Nothing of a collapsed file is fetched. */
    getCollapse(path: string): ReviewFileCollapse | null;
    /** Why the file starts collapsed, which it still says once opened (CR13). */
    getCollapseReason(path: string): ReviewFileCollapseReason | null;
    /** Collapses the file, or opens it, which fetches it next. Kept for as long as the model, whatever the head. */
    setCollapsed(path: string, collapsed: boolean): void;
    /**
     * Sets GitHub's viewed marks, shown at once in {@link files} and sent together with whatever else is waiting. GitHub
     * refusing puts them back and tells {@link ReviewViewedFailures}.
     */
    setViewed(paths: readonly string[], viewed: boolean): void;
    /** Whether viewed files leave the list and the diff (D9). */
    readonly hideViewed: boolean;
    setHideViewed(hide: boolean): void;
}

/** Above this on either side a file is not fetched (D35); the size is a placeholder. */
const MAX_FILE_BYTES = 1_000_000;
/** From here on a file starts collapsed (D8), near where GitHub's own patches give up. */
const LARGE_FILE_CHANGES = 3000;
/** Nobody reads these (D8). */
const LOCK_FILE_NAMES: ReadonlySet<string> = new Set([
    'Cargo.lock',
    'Gemfile.lock',
    'Pipfile.lock',
    'bun.lock',
    'bun.lockb',
    'composer.lock',
    'flake.lock',
    'go.sum',
    'mix.lock',
    'package-lock.json',
    'packages.lock.json',
    'pnpm-lock.yaml',
    'poetry.lock',
    'pubspec.lock',
    'uv.lock',
    'yarn.lock',
]);
/**
 * About 20 files. A query with many aliased objects costs one point, but GitHub takes about 3 s to answer 100 of these,
 * and the first files are what the user is waiting for.
 */
const MAX_EXPRESSIONS_PER_QUERY = 40;
const MAX_BLOBS_PER_QUERY = 50;
const MAX_BYTES_PER_QUERY = 2_000_000;
const MAX_QUERIES_AT_ONCE = 3;
/** About a frame. */
const UPDATE_EVERY_MS = 16;

const LOADING = { kind: 'loading' } as const;
const WAITING = { kind: 'waiting' } as const;

/** Each side's blob: `null` for the side the file doesn't exist on. */
interface FileSides {
    readonly before: BlobSide | null;
    readonly after: BlobSide | null;
}

/** What to ask GitHub of each side: `null` for the side the file doesn't exist on. */
interface FileExpressions {
    readonly before: string | null;
    readonly after: string | null;
}

interface BlobSide {
    readonly oid: string;
    readonly byteSize: number;
}

interface FileEntry {
    file: ReviewFile;
    /** Known once its oids are read, kept for a retry. */
    sides: FileSides | null;
    /** Its oids are being read. */
    resolving: boolean;
    /** Decided once and kept: the rows ask of every file every frame while files arrive. */
    collapseReason: ReviewFileCollapseReason | null;
}

/** What one list of files at one head is being read into. Replaced whole when the pull request moves. */
interface FileRun {
    readonly id: string;
    readonly headRefOid: string;
    /** Follows the base's tip for as long as that leaves the merge base where it was. */
    baseRefOid: string;
    readonly changedFiles: number;
    /** The files read so far, in GitHub's order. */
    readonly entries: Map<string, FileEntry>;
    /** The files with something left to fetch, next first. */
    queue: FileEntry[];
    readonly states: Map<string, ReviewFileState>;
    /** Every text read so far by oid: the same strings the `ready` states hold. */
    readonly texts: Map<string, string>;
    /** The oids asked for in a query on its way. */
    readonly fetching: Set<string>;
    /** Queries on their way. */
    running: number;
    /** Where renamed and copied files came from, once read: until then those wait, in the queue. */
    renames: ReadonlyMap<string, string> | null;
    readonly renamesReader: SingleRunnerState<void>;
    /** Whether the merge base was asked for ahead of the first query needing it. */
    mergeBaseAsked: boolean;
    /** GitHub refused for the rate: files listed from now on fail with it, until a retry. */
    refusal: Error | null;
    /** What the head's `.gitattributes` says; `null` until it is read, when no file can be fetched yet. */
    isGenerated: ((path: string) => boolean) | null;
}

/** A file's viewed mark as the user set it, which a list read before they did must not undo. */
interface ViewedMark {
    /** What is shown. */
    viewed: FileViewedState;
    /** What GitHub last said, for going back to. */
    confirmed: FileViewedState;
    /** On its way to GitHub. */
    pending: boolean;
    /** When it last changed, on {@link createModel}'s own count: a list asked for before that may not know of it. */
    changedAt: number;
}

/** What the files are read with for one signed-in user. Dropped whole when they sign out. */
interface Session {
    readonly account: Account;
    readonly requester: Requester<GitHubGraphQLCallOptions>;
    readonly rest: GitHubRestRequester;
    readonly models: Map<string, Model>;
    /** By {@link ReviewBlobStore}'s key, `<repository>:<base>...<head>`, which never changes its answer. */
    readonly mergeBases: Map<string, Promise<string>>;
}

interface Model {
    readonly files: PullRequestFiles;
    reopen(): void;
    drop(): void;
}

type FileListPage = NonNullable<NonNullable<PullRequestReviewFilesQuery['repository']>['pullRequest']>;
type FileListNode = NonNullable<NonNullable<NonNullable<FileListPage['files']>['nodes']>[number]>;

/**
 * Loads what a pull request's review shows (D6, D19): its files, and for each the text at the merge base — not the
 * base branch's tip, which moves on — and at the head. A pull request read before starts from the
 * {@link ReviewBlobStore} at once, its list read again behind it; one that wasn't shows its files page by page as they
 * come. Whatever the disk doesn't hold comes from GraphQL, in batches, in the list's order or as a jump asks; what
 * GraphQL truncates comes whole over REST.
 *
 * Follows the signed-in user: when they sign out what was read leaves memory, and an answer arriving later is
 * neither shown nor written to disk.
 */
export type ReviewFiles = Resolved<typeof ReviewFiles>;
export const ReviewFiles = defineService({
    name: 'ReviewFiles',
    deps: {
        accounts: AccountSession,
        blobs: ReviewBlobStore,
        viewedFailures: ReviewViewedFailures,
        createRequester: GitHubRequesterFactory,
        createRest: GitHubRestFactory,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, blobs, viewedFailures, createRequester, createRest, clock, logger }) {
        let session: Session | null = null;

        accounts.onChange(follow);

        return { open };

        /**
         * The files of the pull request, reading them when first opened. Opened again in the session it is the same
         * model, its list read anew behind what it shows. `null` while signed out.
         */
        function open(reference: ItemReference): PullRequestFiles | null {
            const current = session;
            if (!current) {
                return null;
            }

            const key = formatItemReference(reference);
            const held = current.models.get(key);
            if (held) {
                held.reopen();
                return held.files;
            }

            const model = createModel(current, reference);
            current.models.set(key, model);
            return model.files;
        }

        function follow(account: Account | null) {
            for (const model of session?.models.values() ?? []) {
                model.drop();
            }

            session = account && {
                account,
                requester: createRequester(() => account.token),
                rest: createRest(() => account.token),
                models: new Map(),
                mergeBases: new Map(),
            };
        }

        function createModel(current: Session, reference: ItemReference): Model {
            const repository = { owner: reference.owner, name: reference.name };
            const nameWithOwner = `${reference.owner}/${reference.name}`;
            const listKey = formatItemReference(reference);
            const { login } = current.account;

            const listRef = shallowRef<ReviewFileListState>(LOADING);
            const runRef = shallowRef<FileRun | null>(null);
            const filesRef = shallowRef<readonly ReviewFile[]>([]);
            const listCompleteRef = shallowRef(false);
            const versionRef = shallowRef(0);
            const hideViewedRef = shallowRef(false);
            /** The files the user opened (`true`) or collapsed (`false`) themselves. */
            const collapseChoices = new Map<string, boolean>();
            const viewedMarks = new Map<string, ViewedMark>();

            let unsentMarks = new Map<string, boolean>();
            let markCount = 0;
            let dropped = false;
            let cancelUpdate: (() => void) | null = null;
            let jumpedTo: string | null = null;

            const listReader = createSingleRunner({ handler: readList });
            const marksSender = createSingleRunner({ handler: sendViewedMarks });

            void load();

            return {
                files: {
                    get list() {
                        return listRef.value;
                    },
                    get files() {
                        return filesRef.value;
                    },
                    get listComplete() {
                        return listCompleteRef.value;
                    },
                    get id() {
                        return runRef.value?.id ?? null;
                    },
                    get headRefOid() {
                        return runRef.value?.headRefOid ?? null;
                    },
                    get changedFiles() {
                        return runRef.value?.changedFiles ?? null;
                    },
                    get version() {
                        return versionRef.value;
                    },
                    getState,
                    prioritize,
                    retry,
                    getCollapse,
                    getCollapseReason(path) {
                        void versionRef.value;
                        return runRef.value?.entries.get(path)?.collapseReason ?? null;
                    },
                    setCollapsed,
                    setViewed,
                    get hideViewed() {
                        return hideViewedRef.value;
                    },
                    setHideViewed(hide) {
                        hideViewedRef.value = hide;
                    },
                },
                reopen,
                drop,
            };

            function getState(path: string): ReviewFileState {
                // The states change without a reactive write: this is what tells of them.
                void versionRef.value;
                return runRef.value?.states.get(path) ?? WAITING;
            }

            function prioritize(path: string) {
                // Also for a file not listed yet, or that a new head lists later.
                jumpedTo = path;
                const run = runRef.value;
                if (run && moveToFront(run, path)) {
                    pump(run);
                }
            }

            function moveToFront(run: FileRun, path: string) {
                const entry = run.entries.get(path);
                const index = entry ? run.queue.indexOf(entry) : -1;
                if (!entry || index < 0) {
                    return false;
                }

                run.queue.splice(index, 1);
                run.queue.unshift(entry);
                return true;
            }

            function retry(path: string) {
                const run = runRef.value;
                const entry = run?.entries.get(path);
                if (run && entry && run.states.get(path)?.kind === 'failed') {
                    setState(run, path, WAITING);
                    run.queue.unshift(entry);
                    run.refusal = null;
                    if (isHeldForRenames(run, entry)) {
                        void run.renamesReader.execute();
                    }

                    // Its texts may have arrived since it failed.
                    takeReady(run);
                    pump(run);
                }
            }

            function getCollapse(path: string) {
                void versionRef.value;
                const run = runRef.value;
                const entry = run?.entries.get(path);
                return run && entry ? readCollapse(run, entry) : null;
            }

            function readCollapse(run: FileRun, { file, collapseReason }: FileEntry): ReviewFileCollapse | null {
                const choice = collapseChoices.get(file.path);
                if (choice === true) {
                    return null;
                }

                return collapseReason ?? (choice === false ? 'byHand' : run.isGenerated === null ? 'undecided' : null);
            }

            function setCollapsed(path: string, collapsed: boolean) {
                collapseChoices.set(path, !collapsed);
                // Not through `setState`'s frame: this is a key pressed.
                versionRef.value++;

                const run = runRef.value;
                const entry = run?.entries.get(path);
                if (run && entry) {
                    if (!collapsed) {
                        letGo(run, entry);
                        return;
                    }

                    // Out of the queue: whatever is on its way for it is kept, for when it is opened.
                    run.queue = run.queue.filter(other => other !== entry);
                    if (run.states.get(path)?.kind === 'loading') {
                        setState(run, path, WAITING);
                    }
                }
            }

            /** Into the queue, at its front, unless it has already got as far as it can. */
            function letGo(run: FileRun, entry: FileEntry) {
                const { path } = entry.file;
                const kind = run.states.get(path)?.kind ?? 'waiting';
                if (kind !== 'waiting' && kind !== 'loading') {
                    return;
                }

                if (run.refusal) {
                    endEntry(run, entry, { kind: 'failed', error: run.refusal });
                    return;
                }

                if (!run.queue.includes(entry)) {
                    run.queue.unshift(entry);
                }

                if (isHeldForRenames(run, entry)) {
                    void run.renamesReader.execute();
                }

                takeReady(run);
                prioritize(path);
            }

            function setViewed(paths: readonly string[], viewed: boolean) {
                const run = runRef.value;
                if (!run) {
                    return;
                }

                const wanted = viewed ? 'VIEWED' : 'UNVIEWED';
                for (const path of paths) {
                    const entry = run.entries.get(path);
                    if (!entry || entry.file.viewed === wanted) {
                        continue;
                    }

                    const held = viewedMarks.get(path);
                    viewedMarks.set(path, {
                        viewed: wanted,
                        confirmed: held?.pending ? held.confirmed : entry.file.viewed,
                        pending: true,
                        changedAt: ++markCount,
                    });
                    entry.file = { ...entry.file, viewed: wanted };
                    unsentMarks.set(path, viewed);
                }

                publishFiles(run);
                void marksSender.execute();
            }

            /** One request at a time, so that marks reach GitHub in the order they were set; what waited meanwhile goes in the next. */
            async function sendViewedMarks() {
                while (unsentMarks.size > 0) {
                    const sending = unsentMarks;
                    unsentMarks = new Map();
                    const pullRequestId = runRef.value?.id;
                    if (pullRequestId === undefined) {
                        return;
                    }

                    const marks = [...sending].map(([path, viewed]) => ({ path, viewed }));
                    let failure: Error | null = null;
                    try {
                        await markFilesViewed({ requester: current.requester, pullRequestId, marks });
                    } catch (error) {
                        failure = toError(error);
                    }

                    if (dropped) {
                        return;
                    }

                    settleViewedMarks(marks, failure);
                }
            }

            function settleViewedMarks(sent: readonly FileViewedMark[], failure: Error | null) {
                const run = runRef.value;
                for (const { path, viewed } of sent) {
                    const mark = viewedMarks.get(path);
                    if (!mark) {
                        continue;
                    }

                    if (!failure) {
                        mark.confirmed = viewed ? 'VIEWED' : 'UNVIEWED';
                    }

                    // A newer one for this file is waiting: that one decides.
                    if (unsentMarks.has(path)) {
                        continue;
                    }

                    mark.pending = false;
                    mark.changedAt = ++markCount;
                    if (failure) {
                        mark.viewed = mark.confirmed;
                        const entry = run?.entries.get(path);
                        if (entry) {
                            entry.file = { ...entry.file, viewed: mark.confirmed };
                        }
                    }
                }

                if (run) {
                    publishFiles(run);
                    keepList(run);
                }

                if (failure) {
                    viewedFailures.report(
                        sent.map(mark => mark.path),
                        failure.message,
                    );
                    // Others of the request may have gone through: GitHub says which.
                    void listReader.execute();
                }
            }

            /** What a page of the list says of a file, unless the user set its mark since it was asked for or is still setting it. */
            function withFresherMark(file: ReviewFile, askedAt: number): ReviewFile {
                const mark = viewedMarks.get(file.path);
                return mark && (mark.pending || mark.changedAt > askedAt) ? { ...file, viewed: mark.viewed } : file;
            }

            function reopen() {
                const list = listRef.value;
                switch (list.kind) {
                    case 'failed':
                    case 'gone':
                        void load();
                        break;
                    case 'ready':
                        void listReader.execute();
                        break;
                    case 'loading':
                        break;
                    default:
                        assertNever(list);
                }
            }

            /** They signed out: nothing of the private files stays reachable from a model a screen may still hold. */
            function drop() {
                dropped = true;
                unsentMarks.clear();
                viewedMarks.clear();
                collapseChoices.clear();
                cancelUpdate?.();
                cancelUpdate = null;
                runRef.value = null;
                filesRef.value = [];
                listCompleteRef.value = false;
                listRef.value = LOADING;
                versionRef.value++;
            }

            function isLive(run: FileRun) {
                return runRef.value === run;
            }

            async function load() {
                listRef.value = LOADING;
                const kept = await readFromDisk(() => blobs.readFileList(login, listKey));
                if (dropped) {
                    return;
                }

                if (kept) {
                    const run = startRun(kept);
                    addFiles(run, kept.files);
                    listCompleteRef.value = true;
                }

                await listReader.execute();
            }

            /** Reads the list from GitHub into what is shown; with something to show, failing only leaves that as it is. */
            async function readList() {
                try {
                    await readPages();
                } catch (error) {
                    if (dropped) {
                        return;
                    }

                    if (isPullRequestGone(error)) {
                        forget();
                    } else if (runRef.value) {
                        logger.warn("Could not read a pull request's list of files", { error });
                    } else {
                        listRef.value = { kind: 'failed', error: toError(error) };
                    }
                }
            }

            /**
             * GitHub says the pull request isn't there, which is also how it answers someone who lost access to a private
             * repository: its kept code stops showing, as an item's kept copy goes. The contents stay on disk until sign-out,
             * for a blob may belong to other pull requests (D19).
             */
            function forget() {
                runRef.value = null;
                filesRef.value = [];
                listCompleteRef.value = false;
                listRef.value = { kind: 'gone' };
                versionRef.value++;
                keepOnDisk(() => blobs.deleteFileList(login, listKey));
            }

            async function readPages(): Promise<void> {
                let run = runRef.value;
                const listed = new Set<string>();
                let after: string | null = null;
                do {
                    const askedAt = markCount;
                    const page: FileListPage = await readListPage(after);
                    if (dropped) {
                        return;
                    }

                    const moved: boolean = run !== null && (await hasMoved(run, page));
                    if (dropped) {
                        return;
                    }

                    if (moved && after !== null) {
                        // Pushed to in the middle of the read: the rest of the pages are another list's.
                        await readPages();
                        return;
                    }

                    if (!run || moved) {
                        run = startRun(page);
                    }

                    const files = (page.files?.nodes ?? [])
                        .filter(node => node !== null)
                        .map(node => withFresherMark(toReviewFile(node), askedAt));
                    for (const file of files) {
                        listed.add(file.path);
                    }

                    addFiles(run, files);
                    after = page.files?.pageInfo.hasNextPage ? (page.files.pageInfo.endCursor ?? null) : null;
                } while (after !== null);

                endList(run, listed);
            }

            async function readListPage(after: string | null) {
                const { repository: answered } = await current.account.sdk.PullRequestReviewFiles({
                    ...repository,
                    number: reference.number,
                    after,
                });
                const page = answered?.pullRequest;
                if (!page) {
                    const message = `GitHub has no pull request ${nameWithOwner}#${reference.number}`;
                    throw new GitHubApiError({ status: 200, message, errors: [{ type: 'NOT_FOUND', message }] });
                }

                return page;
            }

            /**
             * Whether what the run holds is out of date. The tip of a base moves on all the time: as long as the merge
             * base stays, the diff is the same and nothing needs to start over.
             */
            async function hasMoved(run: FileRun, page: FileListPage) {
                if (page.headRefOid !== run.headRefOid) {
                    return true;
                }

                if (page.baseRefOid === run.baseRefOid) {
                    return false;
                }

                const [held, answered] = await Promise.all([
                    readMergeBase(run.baseRefOid, run.headRefOid),
                    readMergeBase(page.baseRefOid, run.headRefOid),
                ]);
                if (held !== answered) {
                    return true;
                }

                run.baseRefOid = page.baseRefOid;
                return false;
            }

            function startRun(pullRequest: Omit<ReviewKeptFileList, 'files'>) {
                const run: FileRun = {
                    id: pullRequest.id,
                    headRefOid: pullRequest.headRefOid,
                    baseRefOid: pullRequest.baseRefOid,
                    changedFiles: pullRequest.changedFiles,
                    entries: new Map(),
                    queue: [],
                    states: new Map(),
                    texts: new Map(),
                    fetching: new Set(),
                    running: 0,
                    renames: null,
                    renamesReader: createSingleRunner({ handler: () => readRenames(run) }),
                    mergeBaseAsked: false,
                    refusal: null,
                    isGenerated: null,
                };

                runRef.value = run;
                filesRef.value = [];
                listCompleteRef.value = false;
                listRef.value = { kind: 'ready' };
                void readGitAttributes(run);
                return run;
            }

            /**
             * Takes a page of the list, or the list kept on disk: a file not known yet joins the queue, the only place
             * deciding which files get fetched, unless it starts collapsed, and one known just takes what GitHub says of it
             * now, its state left alone.
             */
            function addFiles(run: FileRun, files: readonly ReviewFile[]) {
                let changed = false;
                for (const file of files) {
                    const entry = run.entries.get(file.path);
                    if (entry) {
                        changed = updateFile(entry, file) || changed;
                        continue;
                    }

                    changed = true;
                    const previousPath = file.previousPath ?? run.renames?.get(file.path) ?? null;
                    const added: FileEntry = {
                        file: { ...file, previousPath },
                        sides: null,
                        resolving: false,
                        collapseReason: getCollapseReason(file, run.isGenerated),
                    };
                    run.entries.set(file.path, added);
                    if (isFetchable(run, added)) {
                        run.queue.push(added);
                        if (run.refusal) {
                            endEntry(run, added, { kind: 'failed', error: run.refusal });
                        }
                    }
                }

                if (changed) {
                    publishFiles(run);
                }

                if (jumpedTo !== null) {
                    moveToFront(run, jumpedTo);
                }

                // Of every file, collapsed ones too: their headers say where they came from.
                if ([...run.entries.values()].some(entry => isHeldForRenames(run, entry))) {
                    void run.renamesReader.execute();
                }

                if (!run.mergeBaseAsked && files.some(file => getExistingSides(file.changeType).before)) {
                    // On its own, ahead of the first query needing it; that query shares it, and tells of a failure.
                    run.mergeBaseAsked = true;
                    void readMergeBase(run.baseRefOid, run.headRefOid);
                }

                // Not until the screen, told of the files, has said which one it shows: the first queries are the ones
                // the user waits for.
                void Promise.resolve().then(() => pump(run));
            }

            function updateFile(entry: FileEntry, file: ReviewFile) {
                const { viewed, additions, deletions, previousPath } = entry.file;
                if (viewed === file.viewed && additions === file.additions && deletions === file.deletions) {
                    return false;
                }

                entry.file = { ...file, previousPath };
                return true;
            }

            /** Undecided files are in the queue, as most turn out open; nothing leaves it until `.gitattributes` is read. */
            function isFetchable(run: FileRun, entry: FileEntry) {
                const collapse = readCollapse(run, entry);
                return collapse === null || collapse === 'undecided';
            }

            /**
             * Reads what collapses generated files once per head, as it would any blob: its answer and text are kept. A
             * failure leaves nothing marked generated: the files must not wait on it, and GitHub's own rate says why.
             */
            async function readGitAttributes(run: FileRun) {
                let isGenerated = (_: string) => false;
                try {
                    const text = await readGitAttributesText(run);
                    if (text !== null) {
                        isGenerated = parseLinguistGenerated(text);
                    }
                } catch (error) {
                    logger.warn('Could not read .gitattributes', { error });
                    if (isLive(run)) {
                        stopOnRateLimit(run, toError(error));
                    }
                }

                if (!isLive(run)) {
                    return;
                }

                run.isGenerated = isGenerated;
                for (const entry of run.entries.values()) {
                    entry.collapseReason = getCollapseReason(entry.file, isGenerated);
                }

                run.queue = run.queue.filter(entry => isFetchable(run, entry));
                versionRef.value++;
                pump(run);
            }

            async function readGitAttributesText(run: FileRun) {
                const expression = `${run.headRefOid}:.gitattributes`;
                const answers = await readKeptAnswers([expression]);
                if (!answers.has(expression)) {
                    const answered = await readReviewBlobOids({
                        requester: current.requester,
                        repository,
                        expressions: [expression],
                    });
                    keepAnswers(answered);
                    for (const [asked, answer] of answered) {
                        answers.set(asked, answer);
                    }
                }

                const answer = answers.get(expression);
                if (answer?.kind === 'failed') {
                    throw answer.error;
                }

                if (answer?.kind !== 'blob' || answer.isBinary || answer.byteSize > MAX_FILE_BYTES) {
                    return null;
                }

                await readKept(run, [answer.oid]);
                const kept = run.texts.get(answer.oid);
                return kept ?? (await fetchGitAttributesText(run, answer.oid));
            }

            async function fetchGitAttributesText(run: FileRun, oid: string) {
                const answers = await readReviewBlobTexts({ requester: current.requester, repository, oids: [oid] });
                const answer = answers.get(oid);
                if (answer?.kind === 'failed') {
                    throw answer.error;
                }

                const text =
                    answer?.kind === 'truncated'
                        ? await getGitBlobText(current.rest, { nameWithOwner, oid })
                        : answer?.kind === 'text'
                          ? answer.text
                          : null;
                if (text !== null && isLive(run)) {
                    keep(new Map([[oid, text]]));
                    run.texts.set(oid, text);
                }

                return text;
            }

            function publishFiles(run: FileRun) {
                if (isLive(run)) {
                    filesRef.value = [...run.entries.values()].map(entry => entry.file);
                }
            }

            /** The whole list is read. Under the same head and base it can't really have lost files, but GitHub decides. */
            function endList(run: FileRun, listed: ReadonlySet<string>) {
                let changed = false;
                for (const [path, entry] of run.entries) {
                    if (!listed.has(path)) {
                        run.entries.delete(path);
                        run.queue = run.queue.filter(other => other !== entry);
                        changed = true;
                    }
                }

                if (changed) {
                    publishFiles(run);
                }

                listCompleteRef.value = true;
                keepList(run);
            }

            /** What a later open starts from, once it is whole: a list missing where renames came from would not be. */
            function keepList(run: FileRun) {
                const entries = [...run.entries.values()];
                if (!isLive(run) || !listCompleteRef.value || entries.some(entry => isHeldForRenames(run, entry))) {
                    return;
                }

                keepOnDisk(() =>
                    blobs.writeFileList(login, listKey, {
                        id: run.id,
                        headRefOid: run.headRefOid,
                        baseRefOid: run.baseRefOid,
                        changedFiles: run.changedFiles,
                        files: filesRef.value,
                    }),
                );
            }

            /**
             * Where renamed and copied files came from. Read when the first of them is listed, as the answer says it of
             * all; failing fails only those, and retrying one of them reads it again.
             */
            async function readRenames(run: FileRun) {
                try {
                    const renames = await listPullRequestRenames(current.rest, {
                        nameWithOwner,
                        number: reference.number,
                    });
                    if (!isLive(run)) {
                        return;
                    }

                    run.renames = renames;
                    for (const entry of run.entries.values()) {
                        const previousPath = renames.get(entry.file.path);
                        if (previousPath !== undefined) {
                            entry.file = { ...entry.file, previousPath };
                        }
                    }

                    publishFiles(run);
                    keepList(run);
                    pump(run);
                } catch (error) {
                    if (isLive(run)) {
                        failEntries(
                            run,
                            run.queue.filter(entry => isHeldForRenames(run, entry)),
                            toError(error),
                        );
                    }
                }
            }

            /** Starts as many queries as may run, each for what is next in the queue. */
            function pump(run: FileRun) {
                while (isLive(run) && run.running < MAX_QUERIES_AT_ONCE) {
                    const work = takeWork(run);
                    if (!work) {
                        return;
                    }

                    run.running++;
                    void work().finally(() => {
                        run.running--;
                        pump(run);
                    });
                }
            }

            /** The next query: whichever the first file with something to fetch needs. */
            function takeWork(run: FileRun) {
                if (run.isGenerated === null) {
                    return null;
                }

                for (const entry of run.queue) {
                    if (entry.resolving || isHeldForRenames(run, entry)) {
                        continue;
                    }

                    if (entry.sides === null) {
                        const entries = takeForOids(run);
                        return () => resolveOids(run, entries);
                    }

                    if (getBlobsToFetch(run, entry.sides).length > 0) {
                        const wanted = takeForTexts(run);
                        return () => fetchTexts(run, wanted);
                    }
                }

                return null;
            }

            function takeForOids(run: FileRun) {
                const entries: FileEntry[] = [];
                let expressions = 0;
                for (const entry of run.queue) {
                    if (entry.sides !== null || entry.resolving || isHeldForRenames(run, entry)) {
                        continue;
                    }

                    const { before, after } = getExistingSides(entry.file.changeType);
                    expressions += Number(before) + Number(after);
                    if (expressions > MAX_EXPRESSIONS_PER_QUERY) {
                        break;
                    }

                    entry.resolving = true;
                    setState(run, entry.file.path, LOADING);
                    entries.push(entry);
                }

                return entries;
            }

            function takeForTexts(run: FileRun) {
                const wanted: BlobSide[] = [];
                let bytes = 0;
                for (const entry of run.queue) {
                    if (entry.sides === null || entry.resolving) {
                        continue;
                    }

                    for (const blob of getBlobsToFetch(run, entry.sides)) {
                        bytes += blob.byteSize;
                        if (wanted.length === MAX_BLOBS_PER_QUERY || bytes > MAX_BYTES_PER_QUERY) {
                            return wanted;
                        }

                        run.fetching.add(blob.oid);
                        wanted.push(blob);
                        setState(run, entry.file.path, LOADING);
                    }
                }

                return wanted;
            }

            /** Step one: which blobs the files are, then whichever of them are on disk. */
            async function resolveOids(run: FileRun, entries: readonly FileEntry[]) {
                let ended: ReadonlyMap<FileEntry, ReviewFileState> = new Map();
                let failure: Error | null = null;
                try {
                    const needsBase = entries.some(entry => getExistingSides(entry.file.changeType).before);
                    // A failure is an answer: only the files with a before side end with it.
                    const mergeBase = needsBase
                        ? await readMergeBase(run.baseRefOid, run.headRefOid).catch(toError)
                        : null;
                    ended = await readSides(run, entries, mergeBase);
                    if (isLive(run)) {
                        const known = entries.flatMap(entry => getBlobs(entry.sides));
                        await readKept(
                            run,
                            known.map(blob => blob.oid),
                        );
                    }
                } catch (error) {
                    failure = toError(error);
                }

                if (!isLive(run)) {
                    return;
                }

                for (const entry of entries) {
                    entry.resolving = false;
                }

                if (failure) {
                    failEntries(run, entries, failure);
                }

                for (const [entry, state] of ended) {
                    endEntry(run, entry, state);
                    if (state.kind === 'failed') {
                        stopOnRateLimit(run, state.error);
                    }
                }

                takeReady(run);
            }

            function readMergeBase(baseOid: string, headOid: string) {
                const key = `${nameWithOwner}:${baseOid}...${headOid}`;
                const held = current.mergeBases.get(key);
                if (held) {
                    return held;
                }

                const reading = findMergeBase(key, baseOid, headOid);
                current.mergeBases.set(key, reading);
                reading.catch(() => current.mergeBases.delete(key));
                return reading;
            }

            async function findMergeBase(key: string, baseOid: string, headOid: string) {
                const kept = await readFromDisk(() => blobs.readMergeBase(login, key));
                if (kept !== undefined) {
                    return kept;
                }

                if (dropped) {
                    throw new Error('Signed out');
                }

                const mergeBase = await getMergeBase(current.rest, { nameWithOwner, baseOid, headOid });
                keepOnDisk(() => blobs.writeMergeBase(login, key, mergeBase));
                return mergeBase;
            }

            /**
             * Reads each file's blobs, what the disk doesn't know from GitHub, and sets {@link FileEntry.sides} of those
             * that go on to their text; returns what ended the others.
             */
            async function readSides(run: FileRun, entries: readonly FileEntry[], mergeBase: string | Error | null) {
                const expressions = new Map<FileEntry, FileExpressions>();
                const ended = new Map<FileEntry, ReviewFileState>();
                for (const entry of entries) {
                    const { file } = entry;
                    const { before, after } = getExistingSides(file.changeType);
                    const previous =
                        file.changeType === 'RENAMED' || file.changeType === 'COPIED' ? file.previousPath : file.path;
                    if (before && mergeBase instanceof Error) {
                        ended.set(entry, { kind: 'failed', error: mergeBase });
                        continue;
                    }

                    if (before && previous === null) {
                        ended.set(entry, {
                            kind: 'failed',
                            error: new Error(`GitHub did not say where ${file.path} came from`),
                        });
                        continue;
                    }

                    expressions.set(entry, {
                        before: before && typeof mergeBase === 'string' ? `${mergeBase}:${previous}` : null,
                        after: after ? `${run.headRefOid}:${file.path}` : null,
                    });
                }

                // Signed out by now, the disk is not to be opened again.
                if (!isLive(run)) {
                    return ended;
                }

                const asked = [...expressions.values()]
                    .flatMap(({ before, after }) => [before, after])
                    .filter(expression => expression !== null);
                const answers = await readKeptAnswers(asked);
                if (!isLive(run)) {
                    return ended;
                }

                const unknown = asked.filter(expression => !answers.has(expression));
                if (unknown.length > 0) {
                    const answered = await readReviewBlobOids({
                        requester: current.requester,
                        repository,
                        expressions: unknown,
                    });
                    keepAnswers(answered);
                    for (const [expression, answer] of answered) {
                        answers.set(expression, answer);
                    }
                }

                for (const [entry, sides] of expressions) {
                    const outcome = readOutcome(sides, answers);
                    if ('kind' in outcome) {
                        ended.set(entry, outcome);
                    } else {
                        entry.sides = outcome;
                    }
                }

                return ended;
            }

            async function readKeptAnswers(expressions: readonly string[]) {
                const answers = new Map<string, ReviewBlobOidAnswer>();
                if (expressions.length === 0) {
                    return answers;
                }

                const kept = await readFromDisk(() => blobs.readResolutions(login, expressions.map(getResolutionKey)));
                for (const expression of expressions) {
                    const answer = kept?.get(getResolutionKey(expression));
                    if (answer) {
                        answers.set(expression, answer);
                    }
                }

                return answers;
            }

            /** Everything but a failure to answer: the commit in the expression fixes the rest for good. */
            function keepAnswers(answers: ReadonlyMap<string, ReviewBlobOidAnswer>) {
                const resolutions = new Map<string, ReviewKeptResolution>();
                for (const [expression, answer] of answers) {
                    if (answer.kind !== 'failed') {
                        resolutions.set(getResolutionKey(expression), answer);
                    }
                }

                if (resolutions.size > 0) {
                    keepOnDisk(() => blobs.writeResolutions(login, resolutions));
                }
            }

            function getResolutionKey(expression: string) {
                return `${nameWithOwner}:${expression}`;
            }

            async function readKept(run: FileRun, oids: readonly string[]) {
                if (oids.length === 0) {
                    return;
                }

                const kept = await readFromDisk(() => blobs.read(login, oids));
                for (const [oid, text] of kept ?? []) {
                    run.texts.set(oid, text);
                }
            }

            /** A cache: GitHub still has it. */
            async function readFromDisk<T>(read: () => Promise<T>) {
                try {
                    return await read();
                } catch (error) {
                    logger.warn('Could not read what a review keeps on disk', { error });
                    return undefined;
                }
            }

            /** Written behind: the reader has it from memory, and a cache can lose it. */
            function keepOnDisk(write: () => Promise<void>) {
                if (dropped) {
                    return;
                }

                write().catch((error: unknown) => {
                    logger.warn('Could not keep what a review read on disk', { error });
                });
            }

            /** Step two: the texts of blobs, those GraphQL truncates whole from REST. */
            async function fetchTexts(run: FileRun, wanted: readonly BlobSide[]) {
                const oids = wanted.map(blob => blob.oid);
                const texts = new Map<string, string>();
                const binary = new Set<string>();
                const failed = new Map<string, Error>();
                try {
                    const answers = await readReviewBlobTexts({ requester: current.requester, repository, oids });
                    await Promise.all(
                        [...answers].map(async ([oid, answer]) => {
                            switch (answer.kind) {
                                case 'text':
                                    texts.set(oid, answer.text);
                                    break;
                                case 'truncated':
                                    try {
                                        texts.set(oid, await getGitBlobText(current.rest, { nameWithOwner, oid }));
                                    } catch (error) {
                                        failed.set(oid, toError(error));
                                    }
                                    break;
                                case 'binary':
                                    binary.add(oid);
                                    break;
                                case 'failed':
                                    failed.set(oid, answer.error);
                                    break;
                                default:
                                    assertNever(answer);
                            }
                        }),
                    );
                } catch (error) {
                    for (const oid of oids) {
                        failed.set(oid, toError(error));
                    }
                }

                if (!isLive(run)) {
                    return;
                }

                for (const oid of oids) {
                    run.fetching.delete(oid);
                }

                keep(texts);
                for (const [oid, text] of texts) {
                    run.texts.set(oid, text);
                }

                for (const entry of run.queue) {
                    const entryBlobs = getBlobs(entry.sides);
                    const failure = entryBlobs.map(blob => failed.get(blob.oid)).find(error => error !== undefined);
                    if (entryBlobs.some(blob => binary.has(blob.oid))) {
                        endEntry(run, entry, { kind: 'binary' });
                    } else if (failure) {
                        endEntry(run, entry, { kind: 'failed', error: failure });
                    }
                }

                for (const error of failed.values()) {
                    stopOnRateLimit(run, error);
                }

                takeReady(run);
            }

            function keep(texts: ReadonlyMap<string, string>) {
                if (texts.size > 0) {
                    const kept = [...texts].map(([oid, text]): ReviewBlob => ({ oid, text }));
                    keepOnDisk(() => blobs.write(login, kept));
                }
            }

            function failEntries(run: FileRun, entries: readonly FileEntry[], error: Error) {
                for (const entry of entries) {
                    endEntry(run, entry, { kind: 'failed', error });
                }

                stopOnRateLimit(run, error);
            }

            /** GitHub refused for the rate: asking on for the rest only makes it worse, so they fail with it. */
            function stopOnRateLimit(run: FileRun, error: Error) {
                if (error instanceof GitHubApiError && isRateLimitRefusal(error)) {
                    run.refusal = error;
                    for (const entry of run.queue) {
                        if (!entry.resolving) {
                            endEntry(run, entry, { kind: 'failed', error });
                        }
                    }
                }
            }

            function endEntry(run: FileRun, entry: FileEntry, state: ReviewFileState) {
                run.queue = run.queue.filter(other => other !== entry);
                setState(run, entry.file.path, state);
            }

            /** Every file whose texts are all here is ready. */
            function takeReady(run: FileRun) {
                run.queue = run.queue.filter(entry => {
                    const state = entry.sides && readReadyState(run, entry.sides);
                    if (state) {
                        setState(run, entry.file.path, state);
                    }

                    return !state;
                });
            }

            function setState(run: FileRun, path: string, state: ReviewFileState) {
                run.states.set(path, state);
                cancelUpdate ??= clock.schedule(() => {
                    cancelUpdate = null;
                    versionRef.value++;
                }, UPDATE_EVERY_MS);
            }
        }
    },
});

function toReviewFile(node: FileListNode): ReviewFile {
    return {
        path: node.path,
        previousPath: null,
        changeType: node.changeType,
        additions: node.additions,
        deletions: node.deletions,
        viewed: node.viewerViewedState,
    };
}

/** Why the file starts collapsed, whoever asks: the lock files by name and the large by size are known at once. */
function getCollapseReason(
    file: ReviewFile,
    isGenerated: ((path: string) => boolean) | null,
): ReviewFileCollapseReason | null {
    if (LOCK_FILE_NAMES.has(getFileName(file.path))) {
        return 'lockFile';
    }

    if (isGenerated?.(file.path)) {
        return 'generated';
    }

    return file.additions + file.deletions >= LARGE_FILE_CHANGES ? 'large' : null;
}

/** A renamed or copied file whose source isn't known yet: `waiting`, without holding up the others. */
function isHeldForRenames(run: FileRun, { file }: FileEntry) {
    return (
        run.renames === null &&
        file.previousPath === null &&
        (file.changeType === 'RENAMED' || file.changeType === 'COPIED')
    );
}

function getExistingSides(changeType: PatchStatus) {
    switch (changeType) {
        case 'ADDED':
            return { before: false, after: true };
        case 'DELETED':
            return { before: true, after: false };
        case 'CHANGED':
        case 'COPIED':
        case 'MODIFIED':
        case 'RENAMED':
            return { before: true, after: true };
        default:
            return assertNever(changeType);
    }
}

function getBlobs(sides: FileSides | null) {
    return [sides?.before, sides?.after].filter(blob => blob != null);
}

function getBlobsToFetch(run: FileRun, sides: FileSides) {
    return getBlobs(sides).filter(blob => !run.texts.has(blob.oid) && !run.fetching.has(blob.oid));
}

function readReadyState(run: FileRun, sides: FileSides): ReviewFileState | null {
    const before = sides.before && run.texts.get(sides.before.oid);
    const after = sides.after && run.texts.get(sides.after.oid);
    return before === undefined || after === undefined ? null : { kind: 'ready', before, after };
}

/** What the answers about a file's two sides mean: its blobs to read, or the state it ends in. */
function readOutcome(
    { before, after }: FileExpressions,
    answers: ReadonlyMap<string, ReviewBlobOidAnswer>,
): FileSides | ReviewFileState {
    const found = [before, after].filter(expression => expression !== null).map(expression => answers.get(expression));

    // A side that can't be shown settles it, whatever the other says. GitHub listed the file at these commits, so a side
    // answering nothing is a submodule, which is how GitHub answers a gitlink: a pointer with no text, like a directory.
    if (
        found.some(
            answer =>
                answer?.kind === 'missing' ||
                answer?.kind === 'notBlob' ||
                (answer?.kind === 'blob' && answer.isBinary),
        )
    ) {
        return { kind: 'binary' };
    }

    if (found.some(answer => answer?.kind === 'blob' && answer.byteSize > MAX_FILE_BYTES)) {
        return { kind: 'tooLarge' };
    }

    for (const answer of found) {
        if (answer?.kind === 'failed') {
            return { kind: 'failed', error: answer.error };
        }
    }

    return { before: readBlobSide(before, answers), after: readBlobSide(after, answers) };
}

function readBlobSide(expression: string | null, answers: ReadonlyMap<string, ReviewBlobOidAnswer>): BlobSide | null {
    const answer = expression === null ? null : answers.get(expression);
    return answer?.kind === 'blob' ? { oid: answer.oid, byteSize: answer.byteSize } : null;
}

function toError(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
}

function isPullRequestGone(error: unknown) {
    return error instanceof GitHubApiError && error.errors.some(entry => entry.type === 'NOT_FOUND');
}
