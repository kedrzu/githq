import type {
    IssueFieldsFragment,
    ItemProjectItemFieldsFragment,
    PullRequestFieldsFragment,
    PullRequestStatusFieldsFragment,
} from '@githq/github/generated.gen.js';
import { mapNotNull } from '@nzyme/utils/array/mapNotNull.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { classifyCheckRun, classifyStatus } from './classifyChecks.js';
import type { ItemCheckState } from './ItemDetailTypes.js';
import type {
    IssueItem,
    Item,
    ItemBase,
    ItemChecks,
    ItemLabel,
    ItemProject,
    ItemReview,
    ItemReviewRequest,
    ItemUser,
    PullRequestItem,
    PullRequestStatus,
} from './ItemTypes.js';

/** A connection's nodes as GitHub answers them, any of them `null` — gone, or hidden from the user. */
export interface GitHubNodes<T> {
    readonly nodes: readonly (T | null)[] | null;
}

/** A review request as GitHub answers it; `TReviewer` is what the query reads of the reviewer. */
export interface ReviewRequestNode<TReviewer> {
    readonly requestedReviewer: TReviewer | null;
}

/** A requested reviewer as a row reads it: a user, a team, or empty for a bot or a mannequin — nobody to show. */
type RowReviewer =
    | { readonly login: string }
    | { readonly slug: string; readonly name: string }
    | Record<PropertyKey, never>;

/**
 * A node of `ItemsByIds` as the local copy keeps it. `null` for a node GitHub returned empty or `null` — deleted,
 * or no longer visible to the user.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toItem(
    node: IssueFieldsFragment | PullRequestFieldsFragment | Record<PropertyKey, never> | null,
): Item | null {
    if (node === null || !('__typename' in node)) {
        return null;
    }

    switch (node.__typename) {
        case 'Issue':
            return toIssueItem(node);
        case 'PullRequest':
            return toPullRequestItem(node);
        default:
            return assertNever(node);
    }
}

/**
 * The status summary of a pull request, from `PullRequestFields` or from `PullRequestStatuses` re-reading it on
 * its own.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toPullRequestStatus(node: PullRequestStatusFieldsFragment): PullRequestStatus {
    return {
        state: node.state,
        isDraft: node.isDraft,
        merged: node.merged,
        reviewDecision: node.reviewDecision,
        mergeable: node.mergeable,
        mergeStateStatus: node.mergeStateStatus,
        checks: node.statusCheckRollup ? toChecks(node.statusCheckRollup) : null,
        reviewRequests: toItemReviewRequests(node.reviewRequests),
        latestReviews: mapNotNull(
            node.latestOpinionatedReviews?.nodes ?? [],
            (review): ItemReview | null => review && { author: review.author?.login ?? null, state: review.state },
        ),
        stack:
            node.stack && node.stackEntry
                ? {
                      id: node.stack.id,
                      number: node.stack.number,
                      size: node.stack.size,
                      position: node.stackEntry.position,
                  }
                : null,
        behindBase: node.baseRef?.target != null && node.baseRef.target.oid !== node.baseRefOid,
    };
}

function toIssueItem(node: IssueFieldsFragment): IssueItem {
    return {
        ...toItemBase(node),
        kind: 'issue',
        state: node.issueState,
        stateReason: node.stateReason,
        issueType: node.issueType ? { name: node.issueType.name, color: node.issueType.color } : null,
        subIssues: { total: node.subIssuesSummary.total, completed: node.subIssuesSummary.completed },
    };
}

function toPullRequestItem(node: PullRequestFieldsFragment): PullRequestItem {
    return {
        ...toItemBase(node),
        ...toPullRequestStatus(node),
        kind: 'pullRequest',
        additions: node.additions,
        deletions: node.deletions,
        changedFiles: node.changedFiles,
        headRefName: node.headRefName,
        baseRefName: node.baseRefName,
        closingIssueIds: mapNotNull(node.closingIssuesReferences?.nodes ?? [], issue => issue?.id),
    };
}

function toItemBase(node: IssueFieldsFragment | PullRequestFieldsFragment): ItemBase {
    const { repository } = node;
    return {
        id: node.id,
        url: node.url,
        number: node.number,
        title: node.title,
        repository: {
            nameWithOwner: repository.nameWithOwner,
            owner: repository.owner.login,
            isPrivate: repository.isPrivate,
            viewerPermission: repository.viewerPermission,
        },
        author: node.author ? { login: node.author.login, avatarUrl: node.author.avatarUrl } : null,
        assignees: toItemUsers(node.assignees),
        labels: toItemLabels(node.labels),
        milestone: node.milestone ? { title: node.milestone.title, dueOn: node.milestone.dueOn } : null,
        commentCount: node.comments.totalCount,
        projects: mapNotNull(node.projectItems?.nodes ?? [], projectItem =>
            projectItem && !projectItem.isArchived ? toItemProject(projectItem) : null,
        ),
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        closedAt: node.closedAt,
    };
}

/**
 * An item's place in a project as its row shows it (`ItemProjectItemFields`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toItemProject(projectItem: ItemProjectItemFieldsFragment): ItemProject {
    const value = projectItem.fieldValueByName;
    // Another field type under the name "Status" comes back empty; an option deleted since has no name.
    const status =
        value != null && 'name' in value && value.name !== null
            ? { name: value.name, color: value.color, optionId: value.optionId }
            : null;

    return {
        itemId: projectItem.id,
        projectId: projectItem.project.id,
        title: projectItem.project.title,
        number: projectItem.project.number,
        url: projectItem.project.url,
        status,
        updatedAt: projectItem.updatedAt,
    };
}

/**
 * The labels of a `labels` connection, as a row keeps them.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toItemLabels(connection: GitHubNodes<ItemLabel> | null): ItemLabel[] {
    return mapNotNull(connection?.nodes ?? [], label => label && { name: label.name, color: label.color });
}

/**
 * The users of a connection of them (`assignees`), as a row keeps them.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toItemUsers(connection: GitHubNodes<ItemUser>): ItemUser[] {
    return mapNotNull(connection.nodes ?? [], user => user && { login: user.login, avatarUrl: user.avatarUrl });
}

/**
 * The reviewers a pull request waits for (`reviewRequests`), as its row keeps them.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toItemReviewRequests(
    connection: GitHubNodes<ReviewRequestNode<RowReviewer>> | null,
): ItemReviewRequest[] {
    return mapNotNull(connection?.nodes ?? [], (node): ItemReviewRequest | null => {
        const reviewer = node?.requestedReviewer;
        if (reviewer == null) {
            return null;
        }

        if ('login' in reviewer) {
            return { kind: 'user', login: reviewer.login };
        }

        return 'slug' in reviewer ? { kind: 'team', slug: reviewer.slug, name: reviewer.name } : null;
    });
}

function toChecks(rollup: NonNullable<PullRequestStatusFieldsFragment['statusCheckRollup']>): ItemChecks {
    const counts: Record<Exclude<ItemCheckState, 'skipped'>, number> = { passing: 0, failing: 0, pending: 0 };

    for (const { state, count } of rollup.contexts.checkRunCountsByState ?? []) {
        add(classifyCheckRun(state), count);
    }

    for (const { state, count } of rollup.contexts.statusContextCountsByState ?? []) {
        add(classifyStatus(state), count);
    }

    return { state: rollup.state, ...counts };

    // Skipped runs hold nothing back: they count as passing.
    function add(state: ItemCheckState, count: number) {
        counts[state === 'skipped' ? 'passing' : state] += count;
    }
}
