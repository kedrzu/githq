import type {
    DiffSide,
    PullRequestReviewThreadSubjectType,
    ReviewThreadCommentFieldsFragment,
} from '@githq/github/generated.gen.js';

/** A comment of a {@link ReviewThread}, with `bodyHTML` as GitHub rendered and sanitized it: shown through `GitHubHtml`. */
export type ReviewThreadComment = ReviewThreadCommentFieldsFragment;

/** A review thread of a pull request, as GitHub says it is now. */
export interface ReviewThread {
    readonly id: string;
    /** The file's path at the head, which may no longer be in the diff. */
    readonly path: string;
    /** The line it sits under, its range's last. On `diffSide`. Of no use on an outdated thread, and `1` on a `FILE` one. */
    readonly line: number | null;
    /** Where its range starts. Often the same as `line` without a range, and past it on an outdated thread. */
    readonly startLine: number | null;
    readonly originalLine: number | null;
    readonly originalStartLine: number | null;
    readonly diffSide: DiffSide;
    readonly startDiffSide: DiffSide | null;
    readonly isOutdated: boolean;
    readonly isResolved: boolean;
    readonly subjectType: PullRequestReviewThreadSubjectType;
    /** All of them, oldest first. They share the code they were written on: the first's `diffHunk` and `originalCommit`. */
    readonly comments: readonly ReviewThreadComment[];
}
