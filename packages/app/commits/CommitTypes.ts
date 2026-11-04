import type { PullRequestState, StatusState } from '@githq/github/generated.gen.js';

import type { ItemCheck } from '@/store/ItemDetailTypes.js';

/** The id of the element in a repository's column that the list of branches and tags renders in (git-client D14, CH6). */
export const COMMIT_REF_LIST_TARGET_ID = 'commit-ref-list-target';

/**
 * A commit as githq keeps it: only what never changes (git-client D8), kept for good per repository. Its pull
 * request and CI state change, so they are read apart and not kept here.
 */
export interface KeptCommit {
    /** `owner/name` of the repository it was read from. */
    readonly repository: string;
    readonly oid: string;
    /** Its GraphQL node id, to read its history or state through `nodes(ids:)`. */
    readonly id: string;
    /** The first line of its message, as GitHub's `messageHeadline`: cut when it is long. */
    readonly headline: string;
    readonly committedDate: string;
    readonly author: CommitAuthor;
    /** At most three (`parents(first: 3)`), in git's order: the first is the branch it was made on. */
    readonly parents: readonly CommitParent[];
}

/** Who wrote a commit: the name git recorded, and the GitHub user it maps to when GitHub knows one. */
export interface CommitAuthor {
    readonly name: string | null;
    readonly login: string | null;
    readonly avatarUrl: string | null;
}

/** A commit's parent, by both of its ids — it may not be kept (yet). */
export interface CommitParent {
    readonly id: string;
    readonly oid: string;
}

/** The commit whose details are open. */
export interface OpenedCommit extends CommitParent {
    /** The ref it was opened from, its commit not loaded (D12). */
    readonly chosenRef: CommitRef | null;
}

/** Where a repository's Commits section was left for a run's page, to come back to. */
export interface CommitGraphPlace {
    /** `null`: the cursor was on no row. */
    readonly cursorOid: string | null;
    readonly opened: OpenedCommit;
}

/** A repository's branches and tags as last read (git-client D9), compared with a fresh read to tell which moved. */
export interface KeptCommitRefs {
    /** `owner/name`. */
    readonly repository: string;
    /** `null` for an empty repository. */
    readonly defaultBranch: string | null;
    readonly branches: readonly CommitRef[];
    readonly tags: readonly CommitRef[];
    /** When they were read (epoch ms). */
    readonly fetchedAt: number;
}

/** A branch or tag and the commit it points at (an annotated tag's commit, not the tag object). */
export interface CommitRef {
    readonly name: string;
    readonly oid: string;
    readonly commitId: string;
    readonly committedDate: string;
}

/**
 * What changes about a commit (git-client D8): the pull request it came from and its CI state, read apart for the
 * rows on screen and held in memory only.
 */
export interface CommitState {
    /** `null` when it came from none. */
    readonly pullRequest: CommitPullRequest | null;
    /** `null` when it has no checks. */
    readonly ci: StatusState | null;
}

/** The pull request a commit came from. */
export interface CommitPullRequest {
    readonly number: number;
    readonly state: PullRequestState;
    readonly title: string;
    readonly url: string;
    readonly isDraft: boolean;
}

/**
 * What is known of a commit's details once they were opened (git-client D13). `read` holds the commit and its full
 * message, which never change. Not `read` yet, the panel draws what the graph knows; `failed` says so quietly, and
 * opening the commit again asks again.
 */
export type CommitDetailRead =
    | { readonly kind: 'reading' | 'failed' }
    | {
          readonly kind: 'read';
          readonly commit: KeptCommit;
          /** The first line of its message, whole however long; plain text, written by whoever pushed it. */
          readonly headline: string;
          /** Its message below the first line; plain text too. */
          readonly body: string;
      };

/**
 * What is known of a commit's checks once its details opened, held in memory only. A read under way changes nothing
 * here, so a re-read leaves the last list on screen. `failed` means no list was ever read.
 */
export type CommitChecksRead =
    | {
          readonly kind: 'read';
          /** At most the first 100. */
          readonly checks: readonly ItemCheck[];
          /** How many it has in all. */
          readonly checkCount: number;
          /** When they were last asked for (epoch ms), a re-read that failed and left them included. */
          readonly readAt: number;
      }
    | { readonly kind: 'failed'; readonly readAt: number };

/**
 * Where a commit stands with the graph: `shown` is one of its rows, `gone` is loaded and no ref reaches it any more (a
 * branch force-pushed), `notLoaded` was never read into it (D12: an old tag, a parent below the loaded history).
 */
export type CommitPlace = 'gone' | 'notLoaded' | 'shown';
