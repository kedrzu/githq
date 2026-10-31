import type {
    IssueState,
    IssueStateReason,
    IssueTypeColor,
    MergeableState,
    MergeStateStatus,
    ProjectV2SingleSelectFieldOptionColor,
    PullRequestReviewDecision,
    PullRequestReviewState,
    PullRequestState,
    RepositoryPermission,
    StatusState,
} from '@githq/github/generated.gen.js';

/** An issue or a pull request with what its row needs (D18), as kept in the local copy. */
export type Item = IssueItem | PullRequestItem;

/** What issues and pull requests share. */
export interface ItemBase {
    /** GitHub's global node id. */
    readonly id: string;
    readonly url: string;
    readonly number: number;
    readonly title: string;
    readonly repository: ItemRepository;
    /** `null` for a deleted account ("ghost"). */
    readonly author: ItemUser | null;
    readonly assignees: readonly ItemUser[];
    readonly labels: readonly ItemLabel[];
    readonly milestone: ItemMilestone | null;
    readonly commentCount: number;
    /** The projects it is in, archived items left out. */
    readonly projects: readonly ItemProject[];
    readonly createdAt: string;
    /** Compared with a search hit's `updated_at` to tell whether the item needs reading again. */
    readonly updatedAt: string;
    readonly closedAt: string | null;
    /**
     * The user's last edit GitHub confirmed, while a copy read before it may still arrive (the app's own mark,
     * not GitHub's): such a copy does not replace the row in any tab ({@link isOlderCopy}).
     */
    readonly confirmation?: ItemConfirmation;
}

/** An edit of the item GitHub confirmed, as its row remembers it ({@link ItemBase.confirmation}). */
export interface ItemConfirmation {
    /** GitHub's time of the edit: a copy whose times are all older was read before it. */
    readonly at: string;
    /** Until when (epoch ms) a copy read before the edit can still arrive; the mark means nothing after. */
    readonly until: number;
}

/** An issue. */
export interface IssueItem extends ItemBase {
    readonly kind: 'issue';
    readonly state: IssueState;
    readonly stateReason: IssueStateReason | null;
    readonly issueType: ItemIssueType | null;
    readonly subIssues: ItemSubIssues;
}

/** A pull request: its list fields and its status summary. */
export interface PullRequestItem extends ItemBase, PullRequestStatus {
    readonly kind: 'pullRequest';
    readonly additions: number;
    readonly deletions: number;
    readonly changedFiles: number;
    readonly headRefName: string;
    readonly baseRefName: string;
    /** The issues it closes when merged (node ids). */
    readonly closingIssueIds: readonly string[];
}

/**
 * The part of a pull request that changes without its row being edited — CI, reviews, mergeability — and is
 * re-read on its own (`PullRequestStatuses`).
 */
export interface PullRequestStatus {
    readonly state: PullRequestState;
    readonly isDraft: boolean;
    readonly merged: boolean;
    readonly reviewDecision: PullRequestReviewDecision | null;
    readonly mergeable: MergeableState;
    readonly mergeStateStatus: MergeStateStatus;
    /** `null` when nothing runs on the head commit. */
    readonly checks: ItemChecks | null;
    readonly reviewRequests: readonly ItemReviewRequest[];
    /** Each reviewer's latest approval or change request. */
    readonly latestReviews: readonly ItemReview[];
}

/** The check rollup of a pull request's head commit: check runs and commit statuses counted together. */
export interface ItemChecks {
    readonly state: StatusState;
    readonly passing: number;
    readonly failing: number;
    readonly pending: number;
}

/** A review asked of a user or of a team. */
export type ItemReviewRequest =
    | { readonly kind: 'user'; readonly login: string }
    | { readonly kind: 'team'; readonly slug: string; readonly name: string };

/** A review given. */
export interface ItemReview {
    /** `null` for a deleted account. */
    readonly author: string | null;
    readonly state: PullRequestReviewState;
}

/** The repository of an item. */
export interface ItemRepository {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly owner: string;
    readonly isPrivate: boolean;
    /** What the user may do there — edits are offered only where it allows them (D14). */
    readonly viewerPermission: RepositoryPermission | null;
}

/** A GitHub user as a row shows them. */
export interface ItemUser {
    readonly login: string;
    readonly avatarUrl: string;
}

/** A label. */
export interface ItemLabel {
    readonly name: string;
    /** Hex, without `#`. */
    readonly color: string;
}

/** A milestone. */
export interface ItemMilestone {
    readonly title: string;
    readonly dueOn: string | null;
}

/** An issue's type (Bug, Feature, …). */
export interface ItemIssueType {
    readonly name: string;
    readonly color: IssueTypeColor;
}

/** How far an issue's sub-issues are. */
export interface ItemSubIssues {
    readonly total: number;
    readonly completed: number;
}

/** An item's place in a project (Projects v2). */
export interface ItemProject {
    /** The project item's node id — what a field edit addresses. */
    readonly itemId: string;
    readonly projectId: string;
    readonly title: string;
    readonly number: number;
    readonly url: string;
    /**
     * The value of the project's row field (D12): its "Status" as GitHub reads it with the item; for a tracked
     * project, the row field it has (`ProjectStore.withRowFields`). `null` when unset.
     */
    readonly status: ItemProjectStatus | null;
    readonly updatedAt: string;
}

/** A value of a project's single-select row field ("Status" by default). */
export interface ItemProjectStatus {
    readonly name: string;
    readonly color: ProjectV2SingleSelectFieldOptionColor;
    readonly optionId: string | null;
}
