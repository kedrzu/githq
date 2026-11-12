import { isGitHubNotFound } from '@githq/github/isGitHubNotFound.js';
import { readCommitPullRequests } from '@githq/github/readCommitPullRequests.js';
import type { CommitPullRequest } from '@githq/github/readCommitPullRequests.js';
import { readCommitSubmodules } from '@githq/github/readCommitSubmodules.js';
import type { CommitSubmodule } from '@githq/github/readCommitSubmodules.js';
import { compareCommits } from '@githq/github/rest/compareCommits.js';
import type {
    CommitComparison,
    CompareCommitsParams,
    ComparedCommit,
    ComparedFile,
} from '@githq/github/rest/compareCommits.js';
import { isGitHubGone } from '@githq/github/utils/isGitHubGone.js';
import type { SubmodulePointers } from '@githq/github/utils/parseSubmodulePatch.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { getAllowancePause } from '@/sync/getAllowancePause.js';
import { getRefusalPause } from '@/sync/getRefusalPause.js';
import { SyncPausedError } from '@/sync/SyncPausedError.js';
import type { SyncPause } from '@/sync/SyncPausedError.js';

import { toError } from '../utils/toError.js';
import { parseSubmoduleRepository } from './parseSubmoduleRepository.js';
import { selectSubmodulePullRequests } from './selectSubmodulePullRequests.js';

/** A submodule pointer change of a review, and the commit whose `.gitmodules` says where the submodule's repository is. */
export interface ReviewSubmoduleChange extends SubmodulePointers {
    /** The pull request's repository, `owner/name`. */
    readonly nameWithOwner: string;
    /** The pull request's head commit. */
    readonly headOid: string;
    /** Where the submodule sits in the pull request's repository. */
    readonly path: string;
}

/** How the new pointer stands to the old one. */
export type ReviewSubmoduleRelation =
    /** It brings `count` commits in. */
    | { readonly kind: 'ahead'; readonly count: number }
    /** It is rolled back: `count` commits dropped. */
    | { readonly kind: 'behind'; readonly count: number }
    | { readonly kind: 'diverged'; readonly ahead: number; readonly behind: number }
    | { readonly kind: 'added' }
    | { readonly kind: 'removed' };

/** What lies between a submodule's two pointers. */
export interface ReviewSubmoduleHistory {
    /** `owner/name` of the submodule's repository; `null` only for a removed submodule, which nothing is read of. */
    readonly repository: string | null;
    readonly relation: ReviewSubmoduleRelation;
    /** Those the change brings in, or for a rollback those it drops; oldest first, at most 250. */
    readonly commits: readonly ComparedCommit[];
    /** How many more there are than {@link commits} holds. */
    readonly moreCommits: number;
    /** The files that differ between the two pointers, at most 300, as the change moves them. */
    readonly files: readonly ComparedFile[];
    /** GitHub stopped at 300 files: there may be more. */
    readonly moreFiles: boolean;
    /** Those in the submodule's repository carrying the new pointer ({@link selectSubmodulePullRequests}). */
    readonly pullRequests: readonly CommitPullRequest[];
}

/** How far the history between a submodule's two pointers is. Only `failed` can be retried. */
export type ReviewSubmoduleState =
    | { readonly kind: 'waiting' }
    | { readonly kind: 'loading' }
    | ({ readonly kind: 'ready' } & ReviewSubmoduleHistory)
    /**
     * Its history cannot be read: the repository is not on github.com, isn't visible to the user, or doesn't have a
     * pointer. `repository` is `null` when not even where it is could be told.
     */
    | { readonly kind: 'unreadable'; readonly repository: string | null }
    | { readonly kind: 'failed'; readonly error: Error }
    /** GitHub's allowance ran out: it carries on by itself at `until`, epoch ms (D35). */
    | { readonly kind: 'paused'; readonly until: number };

/** The most files a comparison holds. */
const MAX_COMPARED_FILES = 300;

const WAITING: ReviewSubmoduleState = { kind: 'waiting' };
const LOADING: ReviewSubmoduleState = { kind: 'loading' };
/** What a comparison settles of a history. */
type SubmoduleComparison = Omit<ReviewSubmoduleHistory, 'repository' | 'pullRequests'>;

/** An added submodule has nothing to compare with. */
const ADDED: SubmoduleComparison = {
    relation: { kind: 'added' },
    commits: [],
    moreCommits: 0,
    files: [],
    moreFiles: false,
};
const REMOVED: ReviewSubmoduleState = {
    kind: 'ready',
    repository: null,
    relation: { kind: 'removed' },
    commits: [],
    moreCommits: 0,
    files: [],
    moreFiles: false,
    pullRequests: [],
};

/** The signed-in user the histories are read for, and what was read for them. */
interface SubmodulesSession {
    readonly account: Account;
    /** The submodules each head commit declares, by `nameWithOwner@oid`: one query for all of a review's submodules. */
    readonly declared: Map<string, Promise<CommitSubmodule[]>>;
    /** The resumes waiting for a pause to end. */
    readonly resumes: Set<() => void>;
    /** Until when GitHub asked not to be asked again, epoch ms. */
    refusedUntil: number;
}

/**
 * The history between a review's submodule pointers: the commits and files between them and the pull requests in the
 * submodule's repository carrying the new one. Read only when asked ({@link load}), so a collapsed entry costs nothing:
 * the URLs the head commit declares, shared by all its submodules, then one comparison (two for a rollback, which GitHub
 * compares only the other way round) and one query for the pull requests. Held in memory for the signed-in user only.
 */
export type ReviewSubmodules = Resolved<typeof ReviewSubmodules>;
export const ReviewSubmodules = defineService({
    name: 'ReviewSubmodules',
    deps: {
        accounts: AccountSession,
        rateLimits: GitHubRateLimitStore,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, rateLimits, clock, logger }) {
        const statesRef = shallowRef<ReadonlyMap<string, ReviewSubmoduleState>>(new Map());
        let session: SubmodulesSession | null = null;

        accounts.onChange(follow);

        return { load, peek, retry };

        /** Reads the change's history, unless it is read or on its way already. Nothing while signed out. */
        function load(change: ReviewSubmoduleChange) {
            if (!statesRef.value.has(getKey(change))) {
                start(change);
            }
        }

        /** What is known of the change's history, without asking GitHub for it: `waiting` before {@link load}. Reactive. */
        function peek(change: ReviewSubmoduleChange): ReviewSubmoduleState {
            return statesRef.value.get(getKey(change)) ?? WAITING;
        }

        /** Reads a `failed` history again. */
        function retry(change: ReviewSubmoduleChange) {
            if (peek(change).kind === 'failed') {
                start(change);
            }
        }

        function follow(account: Account | null) {
            for (const cancel of session?.resumes ?? []) {
                cancel();
            }

            statesRef.value = new Map();
            session = account && { account, declared: new Map(), resumes: new Set(), refusedUntil: 0 };
        }

        function start(change: ReviewSubmoduleChange) {
            const current = session;
            if (current) {
                put(change, LOADING);
                void read(current, change);
            }
        }

        async function read(current: SubmodulesSession, change: ReviewSubmoduleChange) {
            try {
                const state = await readHistory(current, change);
                if (isCurrent(current)) {
                    put(change, state);
                }
            } catch (error) {
                if (!isCurrent(current)) {
                    return;
                }

                const pause = readPauseOf(current, error);
                if (pause) {
                    put(change, { kind: 'paused', until: pause.until });
                    resumeAt(current, change, pause.until);
                } else {
                    logger.warn('Could not read a submodule history', { path: change.path, error });
                    put(change, { kind: 'failed', error: toError(error) });
                }
            }
        }

        async function readHistory(
            current: SubmodulesSession,
            change: ReviewSubmoduleChange,
        ): Promise<ReviewSubmoduleState> {
            const { after } = change;
            if (after === null) {
                return REMOVED;
            }

            const repository = await readRepository(current, change);
            if (repository === null) {
                return { kind: 'unreadable', repository: null };
            }

            try {
                const [comparison, pullRequests] = await Promise.all([
                    change.before === null
                        ? null
                        : readComparison(current, { nameWithOwner: repository, base: change.before, head: after }),
                    ask(current, () =>
                        readCommitPullRequests(current.account.sdk, { nameWithOwner: repository, oid: after }),
                    ),
                ]);
                return {
                    kind: 'ready',
                    repository,
                    pullRequests: selectSubmodulePullRequests(pullRequests),
                    ...(comparison ?? ADDED),
                };
            } catch (error) {
                if (isNotFound(error)) {
                    return { kind: 'unreadable', repository };
                }

                throw error;
            }
        }

        /** `null` when the head declares no such submodule, or one on another host, or isn't readable itself. */
        async function readRepository(current: SubmodulesSession, change: ReviewSubmoduleChange) {
            const key = `${change.nameWithOwner}@${change.headOid}`;
            let declared = current.declared.get(key);
            if (!declared) {
                declared = ask(current, () =>
                    readCommitSubmodules(current.account.sdk, {
                        nameWithOwner: change.nameWithOwner,
                        oid: change.headOid,
                    }),
                );
                current.declared.set(key, declared);
                // A failure is not kept: the next to ask asks again.
                declared.catch(() => current.declared.delete(key));
            }

            try {
                const submodule = (await declared).find(entry => entry.path === change.path);
                return submodule ? parseSubmoduleRepository(submodule.gitUrl, change.nameWithOwner) : null;
            } catch (error) {
                if (isNotFound(error)) {
                    return null;
                }

                throw error;
            }
        }

        async function readComparison(
            current: SubmodulesSession,
            compared: CompareCommitsParams,
        ): Promise<SubmoduleComparison> {
            const forward = await ask(current, () => compareCommits(current.account.rest, compared));
            switch (forward.status) {
                case 'ahead':
                case 'identical':
                    return { relation: { kind: 'ahead', count: forward.aheadBy }, ...readListed(forward) };
                case 'diverged':
                    return {
                        relation: { kind: 'diverged', ahead: forward.aheadBy, behind: forward.behindBy },
                        ...readListed(forward),
                    };
                case 'behind': {
                    // GitHub lists nothing of a rollback: the commits it drops are those the old pointer has over the new.
                    const backward = await ask(current, () =>
                        compareCommits(current.account.rest, { ...compared, base: compared.head, head: compared.base }),
                    );
                    const listed = readListed(backward);
                    return {
                        relation: { kind: 'behind', count: forward.behindBy },
                        ...listed,
                        files: listed.files.map(reverseFile),
                    };
                }
                default:
                    return assertNever(forward.status);
            }
        }

        /** Every request goes through here, and none while GitHub's allowance is paused (D35). */
        async function ask<T>(current: SubmodulesSession, request: () => Promise<T>) {
            const pause = findPause(current);
            if (pause) {
                throw new SyncPausedError(pause);
            }

            return await request();
        }

        /** GraphQL down to what is kept for edits, REST used up, or a refusal to wait out. */
        function findPause(current: SubmodulesSession): SyncPause | null {
            const now = clock.now();
            const pauses = [
                getAllowancePause(rateLimits.get('graphql'), now),
                getAllowancePause(rateLimits.get('core'), now),
                current.refusedUntil > now ? { until: current.refusedUntil, bucket: null } : null,
            ].filter(pause => pause !== null);
            return pauses.toSorted((a, b) => b.until - a.until)[0] ?? null;
        }

        /** The pause a failure means; `null` for any other failure. */
        function readPauseOf(current: SubmodulesSession, error: unknown) {
            if (error instanceof SyncPausedError) {
                return error.pause;
            }

            const limits = [rateLimits.get('graphql'), rateLimits.get('core')];
            const refusal = getRefusalPause({ error, limits, now: clock.now() });
            if (refusal) {
                current.refusedUntil = Math.max(current.refusedUntil, refusal.until);
            }

            return refusal;
        }

        function resumeAt(current: SubmodulesSession, change: ReviewSubmoduleChange, until: number) {
            const cancel = clock.schedule(() => {
                current.resumes.delete(cancel);
                if (isCurrent(current) && peek(change).kind === 'paused') {
                    start(change);
                }
            }, until - clock.now());
            current.resumes.add(cancel);
        }

        function put(change: ReviewSubmoduleChange, state: ReviewSubmoduleState) {
            statesRef.value = new Map(statesRef.value).set(getKey(change), state);
        }

        function isCurrent(current: SubmodulesSession) {
            return session === current && accounts.isCurrent(current.account);
        }
    },
});

function readListed({ commits, totalCommits, files }: CommitComparison) {
    return {
        commits,
        moreCommits: Math.max(0, totalCommits - commits.length),
        files,
        moreFiles: files.length >= MAX_COMPARED_FILES,
    };
}

/** A file of the comparison the other way round, as the rollback moves it. */
function reverseFile(file: ComparedFile): ComparedFile {
    const reversed = { ...file, additions: file.deletions, deletions: file.additions };
    switch (file.status) {
        case 'added':
            return { ...reversed, status: 'removed' };
        case 'removed':
            return { ...reversed, status: 'added' };
        case 'renamed':
            return file.previousPath === null
                ? reversed
                : { ...reversed, path: file.previousPath, previousPath: file.path };
        default:
            return reversed;
    }
}

function isNotFound(error: unknown) {
    return isGitHubGone(error) || isGitHubNotFound(error);
}

function getKey({ nameWithOwner, path, before, after }: ReviewSubmoduleChange) {
    return JSON.stringify([nameWithOwner, path, before, after]);
}
