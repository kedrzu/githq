import type { PullRequestState, StatusState } from '@githq/github/generated.gen.js';

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
    /** The first line of its message. */
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
