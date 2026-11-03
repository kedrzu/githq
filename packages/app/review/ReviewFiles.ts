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
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import type { ItemReference } from '@/item/itemRoutes.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRequesterFactory } from '@/services/GitHubRequesterFactory.js';
import { GitHubRestFactory } from '@/services/GitHubRestFactory.js';
import { isRateLimitRefusal } from '@/sync/isRateLimitRefusal.js';

import { ReviewBlobStore } from './ReviewBlobStore.js';
import type { ReviewBlob } from './ReviewBlobStore.js';

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

/** How far the list of files is. */
export type ReviewFileListState =
    | { readonly kind: 'loading' }
    | { readonly kind: 'ready' }
    /** Opening the pull request again ({@link ReviewFiles.open}) tries it again. */
    | { readonly kind: 'failed'; readonly error: Error };

/** A pull request's files for its review, and their contents as they arrive. Reactive, except for its methods. */
export interface PullRequestFiles {
    readonly list: ReviewFileListState;
    /** In GitHub's order; empty until the whole list is read. A failed reload leaves the list it had. */
    readonly files: readonly ReviewFile[];
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
}

/** Above this on either side a file is not fetched (D35); the size is a placeholder. */
const MAX_FILE_BYTES = 1_000_000;
/** A query with many aliased objects costs one point, so size is about the answer. */
const MAX_EXPRESSIONS_PER_QUERY = 100;
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

interface BlobSide {
    readonly oid: string;
    readonly byteSize: number;
}

interface FileEntry {
    readonly file: ReviewFile;
    /** Known once its oids are read, kept for a retry. */
    sides: FileSides | null;
    /** Its oids are being read. */
    resolving: boolean;
}

/** What one list of files at one head is being read into. Replaced whole when the head moves. */
interface FileRun {
    readonly id: string;
    readonly headRefOid: string;
    readonly baseRefOid: string;
    readonly changedFiles: number;
    readonly files: readonly ReviewFile[];
    readonly entries: ReadonlyMap<string, FileEntry>;
    /** The files with something left to fetch, next first. */
    queue: FileEntry[];
    readonly states: Map<string, ReviewFileState>;
    /** Every text read so far by oid: the same strings the `ready` states hold. */
    readonly texts: Map<string, string>;
    /** The oids asked for in a query on its way. */
    readonly fetching: Set<string>;
    /** Queries on their way. */
    running: number;
}

/** What the files are read with for one signed-in user. Dropped whole when they sign out. */
interface Session {
    readonly account: Account;
    readonly requester: Requester<GitHubGraphQLCallOptions>;
    readonly rest: GitHubRestRequester;
    readonly models: Map<string, Model>;
    /** By `<repository>:<base>...<head>`, which never changes its answer. */
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
 * base branch's tip, which moves on — and at the head. Contents come from the user's {@link ReviewBlobStore} or GraphQL,
 * in batches, in the list's order or as a jump asks; what GraphQL truncates comes whole over REST.
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
        createRequester: GitHubRequesterFactory,
        createRest: GitHubRestFactory,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, blobs, createRequester, createRest, clock, logger }) {
        let session: Session | null = null;

        accounts.onChange(follow);

        return { open };

        /**
         * The files of the pull request, reading them when first opened. Opened again in the session it is the same
         * model, its list read anew only if that failed or the head has moved since. `null` while signed out.
         */
        function open(reference: ItemReference): PullRequestFiles | null {
            const current = session;
            if (!current) {
                return null;
            }

            const key = `${reference.owner}/${reference.name}#${reference.number}`;
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

            const listRef = shallowRef<ReviewFileListState>(LOADING);
            const runRef = shallowRef<FileRun | null>(null);
            const versionRef = shallowRef(0);

            let dropped = false;
            let rechecking = false;
            let cancelUpdate: (() => void) | null = null;
            let jumpedTo: string | null = null;

            void load();

            return {
                files: {
                    get list() {
                        return listRef.value;
                    },
                    get files() {
                        return runRef.value?.files ?? [];
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
                const run = runRef.value;
                if (!run) {
                    jumpedTo = path;
                    return;
                }

                const entry = run.entries.get(path);
                const index = entry ? run.queue.indexOf(entry) : -1;
                if (entry && index >= 0) {
                    run.queue.splice(index, 1);
                    run.queue.unshift(entry);
                    pump(run);
                }
            }

            function retry(path: string) {
                const run = runRef.value;
                const entry = run?.entries.get(path);
                if (run && entry && run.states.get(path)?.kind === 'failed') {
                    setState(run, path, WAITING);
                    run.queue.unshift(entry);
                    // Its texts may have arrived since it failed.
                    takeReady(run);
                    pump(run);
                }
            }

            function reopen() {
                const list = listRef.value;
                switch (list.kind) {
                    case 'failed':
                        void load();
                        break;
                    case 'ready':
                        void recheckHead();
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
                cancelUpdate?.();
                cancelUpdate = null;
                runRef.value = null;
                listRef.value = LOADING;
                versionRef.value++;
            }

            function isLive(run: FileRun) {
                return runRef.value === run;
            }

            async function load() {
                listRef.value = LOADING;
                try {
                    const { pullRequest, files } = await readList();
                    if (dropped) {
                        return;
                    }

                    const hasRenames = files.some(
                        file => file.changeType === 'RENAMED' || file.changeType === 'COPIED',
                    );
                    const renames = hasRenames
                        ? await listPullRequestRenames(current.rest, { nameWithOwner, number: reference.number })
                        : new Map<string, string>();
                    if (dropped) {
                        return;
                    }

                    start(pullRequest, files, renames);
                } catch (error) {
                    if (!dropped) {
                        listRef.value = { kind: 'failed', error: toError(error) };
                    }
                }
            }

            async function readList() {
                const files: (FileListNode | null)[] = [];
                let pullRequest: FileListPage | null = null;
                let after: string | null = null;
                do {
                    const page: FileListPage = await readListPage(after);
                    pullRequest ??= page;
                    files.push(...(page.files?.nodes ?? []));
                    after = page.files?.pageInfo.hasNextPage ? (page.files.pageInfo.endCursor ?? null) : null;
                } while (after !== null);

                return { pullRequest, files: files.filter(file => file !== null) };
            }

            async function readListPage(after: string | null) {
                const { repository: answered } = await current.account.sdk.PullRequestReviewFiles({
                    ...repository,
                    number: reference.number,
                    after,
                });
                const page = answered?.pullRequest;
                if (!page) {
                    throw new Error(`GitHub has no pull request ${nameWithOwner}#${reference.number}`);
                }

                return page;
            }

            /** Opened again: only a head that moved makes what is held out of date. */
            async function recheckHead() {
                const run = runRef.value;
                if (rechecking || !run) {
                    return;
                }

                rechecking = true;
                try {
                    const page = await readListPage(null);
                    if (isLive(run) && page.headRefOid !== run.headRefOid) {
                        await load();
                    }
                } catch (error) {
                    logger.warn('Could not check whether a pull request moved on', { error });
                } finally {
                    rechecking = false;
                }
            }

            function start(
                pullRequest: FileListPage,
                nodes: readonly FileListNode[],
                renames: ReadonlyMap<string, string>,
            ) {
                const files = nodes.map((node): ReviewFile => ({
                    path: node.path,
                    previousPath: renames.get(node.path) ?? null,
                    changeType: node.changeType,
                    additions: node.additions,
                    deletions: node.deletions,
                    viewed: node.viewerViewedState,
                }));
                const entries = new Map(
                    files.map((file): [string, FileEntry] => [file.path, { file, sides: null, resolving: false }]),
                );
                const run: FileRun = {
                    id: pullRequest.id,
                    headRefOid: pullRequest.headRefOid,
                    baseRefOid: pullRequest.baseRefOid,
                    changedFiles: pullRequest.changedFiles,
                    files,
                    entries,
                    // The one place deciding which files get fetched: all of them.
                    queue: [...entries.values()],
                    states: new Map(),
                    texts: new Map(),
                    fetching: new Set(),
                    running: 0,
                };

                runRef.value = run;
                listRef.value = { kind: 'ready' };
                if (jumpedTo !== null) {
                    prioritize(jumpedTo);
                    jumpedTo = null;
                }

                pump(run);
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
                for (const entry of run.queue) {
                    if (entry.resolving) {
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
                    if (entry.sides !== null || entry.resolving) {
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
                    ended = await readSides(run, entries, needsBase ? await readMergeBase(run) : null);
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

            function readMergeBase(run: FileRun) {
                const key = `${nameWithOwner}:${run.baseRefOid}...${run.headRefOid}`;
                const held = current.mergeBases.get(key);
                if (held) {
                    return held;
                }

                const reading = getMergeBase(current.rest, {
                    nameWithOwner,
                    baseOid: run.baseRefOid,
                    headOid: run.headRefOid,
                });
                current.mergeBases.set(key, reading);
                reading.catch(() => current.mergeBases.delete(key));
                return reading;
            }

            /**
             * Reads each file's blobs and sets {@link FileEntry.sides} of those that go on to their text; returns what
             * ended the others.
             */
            async function readSides(run: FileRun, entries: readonly FileEntry[], mergeBase: string | null) {
                const expressions = new Map<FileEntry, { before: string | null; after: string | null }>();
                const ended = new Map<FileEntry, ReviewFileState>();
                for (const entry of entries) {
                    const { file } = entry;
                    const { before, after } = getExistingSides(file.changeType);
                    const previous =
                        file.changeType === 'RENAMED' || file.changeType === 'COPIED' ? file.previousPath : file.path;
                    if (before && previous === null) {
                        ended.set(entry, {
                            kind: 'failed',
                            error: new Error(`GitHub did not say where ${file.path} came from`),
                        });
                        continue;
                    }

                    expressions.set(entry, {
                        before: before && mergeBase !== null ? `${mergeBase}:${previous}` : null,
                        after: after ? `${run.headRefOid}:${file.path}` : null,
                    });
                }

                const wanted = [...expressions.values()].flatMap(({ before, after }) =>
                    [before, after].filter(expression => expression !== null),
                );
                const answers =
                    wanted.length > 0
                        ? await readReviewBlobOids(current.requester, repository, wanted)
                        : new Map<string, ReviewBlobOidAnswer>();

                for (const [entry, { before, after }] of expressions) {
                    const outcome = readOutcome(before, after, answers);
                    if ('kind' in outcome) {
                        ended.set(entry, outcome);
                    } else {
                        entry.sides = outcome;
                    }
                }

                return ended;
            }

            async function readKept(run: FileRun, oids: readonly string[]) {
                if (oids.length === 0) {
                    return;
                }

                try {
                    const kept = await blobs.read(current.account.login, oids);
                    for (const [oid, text] of kept) {
                        run.texts.set(oid, text);
                    }
                } catch (error) {
                    // A cache: GitHub still has them.
                    logger.warn('Could not read kept file contents', { error });
                }
            }

            /** Step two: the texts of blobs, those GraphQL truncates whole from REST. */
            async function fetchTexts(run: FileRun, wanted: readonly BlobSide[]) {
                const oids = wanted.map(blob => blob.oid);
                const texts = new Map<string, string>();
                const binary = new Set<string>();
                const failed = new Map<string, Error>();
                try {
                    const answers = await readReviewBlobTexts(current.requester, repository, oids);
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

            /** Written behind: the reader has it from memory, and a cache can lose it. */
            function keep(texts: ReadonlyMap<string, string>) {
                if (texts.size === 0) {
                    return;
                }

                const kept = [...texts].map(([oid, text]): ReviewBlob => ({ oid, text }));
                blobs.write(current.account.login, kept).catch((error: unknown) => {
                    logger.warn('Could not keep file contents', { error });
                });
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
    before: string | null,
    after: string | null,
    answers: ReadonlyMap<string, ReviewBlobOidAnswer>,
): FileSides | ReviewFileState {
    const asked = [before, after].filter(expression => expression !== null);
    const found = asked.map(expression => answers.get(expression));

    // A side that can't be shown settles it, whatever the other says. `notBlob`: a submodule, whose pointer has no text.
    if (found.some(answer => answer?.kind === 'notBlob' || (answer?.kind === 'blob' && answer.isBinary))) {
        return { kind: 'binary' };
    }

    if (found.some(answer => answer?.kind === 'blob' && answer.byteSize > MAX_FILE_BYTES)) {
        return { kind: 'tooLarge' };
    }

    for (const [index, answer] of found.entries()) {
        if (answer?.kind === 'failed') {
            return { kind: 'failed', error: answer.error };
        }

        if (answer?.kind !== 'blob') {
            return { kind: 'failed', error: new Error(`GitHub has nothing at ${asked[index]}`) };
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
