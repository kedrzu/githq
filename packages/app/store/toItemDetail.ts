import type {
    CommentPageFieldsFragment,
    IssueCommentFieldsFragment,
    IssueDetailFieldsFragment,
    LinkedIssueFieldsFragment,
    ProjectFieldFieldsFragment,
    ProjectItemDetailFieldsFragment,
    ProjectItemFieldValueFieldsFragment,
    PullRequestDetailFieldsFragment,
    ReactionGroupFieldsFragment,
} from '@githq/github/generated.gen.js';
import { mapNotNull } from '@nzyme/utils/array/mapNotNull.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import type {
    IssueDetail,
    ItemComment,
    ItemComments,
    ItemDetail,
    ItemDetailBase,
    ItemDetailProject,
    ItemDetailReview,
    ItemDetailReviewRequest,
    ItemReviewSummary,
    ItemReaction,
    LinkedIssue,
    LinkedIssues,
    ProjectField,
    ProjectFieldValue,
    PullRequestDetail,
} from './ItemDetailTypes.js';
import type { ItemUser } from './ItemTypes.js';
import { toItem } from './toItem.js';
import type { GitHubNodes, ReviewRequestNode } from './toItem.js';
import { toItemCheck } from './toItemCheck.js';

/** A node of `ItemDetail` or `ItemDetails`: an issue, a pull request, `{}` for another type, `null` when gone. */
export type ItemDetailNode =
    | IssueDetailFieldsFragment
    | PullRequestDetailFieldsFragment
    | Record<PropertyKey, never>
    | null;

/**
 * A node of `ItemDetail` or `ItemDetails` as the local copy keeps it, read at `fetchedAt` (epoch ms). `null` for
 * a node GitHub returned empty or `null` — deleted, or no longer visible to the user.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toItemDetail(node: ItemDetailNode, fetchedAt: number): ItemDetail | null {
    if (node === null || !('__typename' in node)) {
        return null;
    }

    switch (node.__typename) {
        case 'Issue':
            return toIssueDetail(node, fetchedAt);
        case 'PullRequest':
            return toPullRequestDetail(node, fetchedAt);
        default:
            return assertNever(node);
    }
}

/**
 * A page of comments (`CommentPageFields`), oldest first, with where the older ones start.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toItemComments(page: CommentPageFieldsFragment): ItemComments {
    return {
        totalCount: page.totalCount,
        nodes: mapNotNull(page.nodes ?? [], comment => comment && toItemComment(comment)),
        olderCursor: page.pageInfo.hasPreviousPage ? page.pageInfo.startCursor : null,
    };
}

/**
 * A comment (`IssueCommentFields`) as the item view shows it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toItemComment(comment: IssueCommentFieldsFragment): ItemComment {
    return {
        id: comment.id,
        url: comment.url,
        author: toDetailAuthor(comment.author),
        bodyHtml: comment.bodyHTML,
        createdAt: comment.createdAt,
        lastEditedAt: comment.lastEditedAt,
    };
}

function toDetailAuthor(author: ItemUser | null | undefined): ItemUser | null {
    return author ? { login: author.login, avatarUrl: author.avatarUrl } : null;
}

function toIssueDetail(node: IssueDetailFieldsFragment, fetchedAt: number): IssueDetail | null {
    const base = toDetailBase(node, fetchedAt);
    if (!base) {
        return null;
    }

    return {
        ...base,
        kind: 'issue',
        parent: node.parent ? toLinkedIssue(node.parent) : null,
        subIssues: toLinkedIssues(node.subIssues),
        blockedBy: toLinkedIssues(node.blockedBy),
        blocking: toLinkedIssues(node.blocking),
    };
}

function toPullRequestDetail(node: PullRequestDetailFieldsFragment, fetchedAt: number): PullRequestDetail | null {
    const base = toDetailBase(node, fetchedAt);
    if (!base) {
        return null;
    }

    const reviews = mapNotNull(
        node.latestReviews?.nodes ?? [],
        (review): ItemDetailReview | null =>
            review && {
                author: toDetailAuthor(review.author),
                state: review.state,
                submittedAt: review.submittedAt,
            },
    );

    return {
        ...base,
        kind: 'pullRequest',
        commitCount: node.commits.totalCount,
        headRepository: node.headRepository?.nameWithOwner ?? null,
        checks: mapNotNull(node.statusCheckRollup?.contextPage.nodes ?? [], context => context && toItemCheck(context)),
        checkCount: node.statusCheckRollup?.contextPage.totalCount ?? 0,
        reviews,
        reviewSummaries: mapNotNull(node.reviews?.nodes ?? [], (review): ItemReviewSummary | null =>
            review?.submittedAt && review.state !== 'PENDING'
                ? {
                      id: review.id,
                      url: review.url,
                      author: toDetailAuthor(review.author),
                      state: review.state,
                      bodyHtml: review.bodyHTML,
                      submittedAt: review.submittedAt,
                  }
                : null,
        ),
        olderReviewCount: (node.reviews?.totalCount ?? 0) - (node.reviews?.nodes?.length ?? 0),
        reviewRequests: toDetailReviewRequests(node.reviewRequests),
    };
}

/** A requested reviewer as the detail reads it: a user with their avatar, a team, or empty for a bot or a mannequin. */
type DetailReviewer =
    | { readonly login: string; readonly avatarUrl: string }
    | { readonly slug: string; readonly name: string }
    | Record<PropertyKey, never>;

/**
 * The reviewers a pull request waits for (`reviewRequests`), with the users' avatars, as its detail keeps them.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toDetailReviewRequests(
    connection: GitHubNodes<ReviewRequestNode<DetailReviewer>> | null,
): ItemDetailReviewRequest[] {
    return mapNotNull(connection?.nodes ?? [], (node): ItemDetailReviewRequest | null => {
        const reviewer = node?.requestedReviewer;
        if (reviewer == null) {
            return null;
        }

        if ('login' in reviewer) {
            return { kind: 'user', user: { login: reviewer.login, avatarUrl: reviewer.avatarUrl } };
        }

        return 'slug' in reviewer ? { kind: 'team', slug: reviewer.slug, name: reviewer.name } : null;
    });
}

function toDetailBase(
    node: IssueDetailFieldsFragment | PullRequestDetailFieldsFragment,
    fetchedAt: number,
): ItemDetailBase | null {
    const item = toItem(node);
    if (!item) {
        return null;
    }

    const reactions: ItemReaction[] = [];
    for (const group of node.reactionGroups ?? []) {
        if (group.reactors.totalCount > 0) {
            reactions.push(toReaction(group));
        }
    }

    return {
        id: node.id,
        item,
        fetchedAt,
        body: node.body,
        bodyHtml: node.bodyHTML,
        reactions,
        comments: toItemComments(node.commentPage),
        projects: mapNotNull(node.projectItems?.nodes ?? [], projectItem =>
            projectItem && !projectItem.isArchived ? toDetailProject(projectItem) : null,
        ),
    };
}

function toReaction(group: ReactionGroupFieldsFragment): ItemReaction {
    return { content: group.content, count: group.reactors.totalCount, viewerHasReacted: group.viewerHasReacted };
}

function toLinkedIssues(connection: IssueDetailFieldsFragment['subIssues']): LinkedIssues {
    return {
        totalCount: connection.totalCount,
        nodes: mapNotNull(connection.nodes ?? [], issue => issue && toLinkedIssue(issue)),
    };
}

function toLinkedIssue(issue: LinkedIssueFieldsFragment): LinkedIssue {
    return {
        id: issue.id,
        url: issue.url,
        number: issue.number,
        title: issue.title,
        repository: issue.repository.nameWithOwner,
        state: issue.state,
        stateReason: issue.stateReason,
    };
}

/**
 * An item's place in a project with every field (`ProjectItemDetailFields`), as the item view shows it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toDetailProject(projectItem: ProjectItemDetailFieldsFragment): ItemDetailProject {
    return {
        itemId: projectItem.id,
        projectId: projectItem.project.id,
        title: projectItem.project.title,
        number: projectItem.project.number,
        url: projectItem.project.url,
        updatedAt: projectItem.updatedAt,
        viewerCanUpdate: projectItem.project.viewerCanUpdate,
        fields: mapNotNull(projectItem.project.fields.nodes ?? [], field => field && toProjectField(field)),
        values: toProjectFieldValues(projectItem.fieldValues.nodes ?? []),
    };
}

/**
 * Every value of a project item that has one (`ProjectItemValuesFields`), by field id.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toProjectFieldValues(
    nodes: readonly (ProjectItemFieldValueFieldsFragment | null)[],
): Record<string, ProjectFieldValue> {
    const values = mapNotNull(nodes, value => value && toProjectFieldValue(value));
    return Object.fromEntries(values.map(({ fieldId, value }) => [fieldId, value]));
}

/**
 * The project's own field; `null` for one mirroring the issue (title, labels, …) or one githq cannot edit.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toProjectField(field: ProjectFieldFieldsFragment): ProjectField | null {
    const { id, name } = field;
    switch (field.dataType) {
        case 'TEXT':
            return { kind: 'text', id, name };
        case 'NUMBER':
            return { kind: 'number', id, name };
        case 'DATE':
            return { kind: 'date', id, name };
        case 'SINGLE_SELECT':
            return 'options' in field ? { kind: 'singleSelect', id, name, options: field.options } : null;
        case 'MULTI_SELECT':
            return 'multiSelectOptions' in field
                ? { kind: 'multiSelect', id, name, options: field.multiSelectOptions }
                : null;
        case 'ITERATION':
            return 'configuration' in field
                ? {
                      kind: 'iteration',
                      id,
                      name,
                      iterations: field.configuration.iterations,
                      completedIterations: field.configuration.completedIterations,
                  }
                : null;
        case 'ASSIGNEES':
        case 'CLOSED':
        case 'CREATED':
        case 'ISSUE_TYPE':
        case 'LABELS':
        case 'LINKED_PULL_REQUESTS':
        case 'MILESTONE':
        case 'PARENT_ISSUE':
        case 'REPOSITORY':
        case 'REVIEWERS':
        case 'SUB_ISSUES_PROGRESS':
        case 'TITLE':
        case 'TRACKED_BY':
        case 'TRACKS':
        case 'UPDATED':
            return null;
        default:
            return assertNever(field.dataType);
    }
}

interface FieldValueOf {
    readonly fieldId: string;
    readonly value: ProjectFieldValue;
}

/** A value of one of the project's own fields; `null` for a value mirroring the issue, or an empty one. */
function toProjectFieldValue(value: ProjectItemFieldValueFieldsFragment): FieldValueOf | null {
    switch (value.__typename) {
        case 'ProjectV2ItemFieldTextValue':
            return value.text === null ? null : { fieldId: value.field.id, value: { kind: 'text', text: value.text } };
        case 'ProjectV2ItemFieldNumberValue':
            return value.number === null
                ? null
                : { fieldId: value.field.id, value: { kind: 'number', number: value.number } };
        case 'ProjectV2ItemFieldDateValue':
            return value.date === null ? null : { fieldId: value.field.id, value: { kind: 'date', date: value.date } };
        case 'ProjectV2ItemFieldSingleSelectValue':
            return {
                fieldId: value.field.id,
                value: { kind: 'singleSelect', optionId: value.optionId, name: value.name, color: value.color },
            };
        case 'ProjectV2ItemFieldMultiSelectValue':
            return { fieldId: value.field.id, value: { kind: 'multiSelect', options: value.options ?? [] } };
        case 'ProjectV2ItemFieldIterationValue':
            return {
                fieldId: value.field.id,
                value: {
                    kind: 'iteration',
                    iterationId: value.iterationId,
                    title: value.title,
                    startDate: value.startDate,
                    duration: value.duration,
                },
            };
        case 'ProjectV2ItemFieldLabelValue':
        case 'ProjectV2ItemFieldMilestoneValue':
        case 'ProjectV2ItemFieldPullRequestValue':
        case 'ProjectV2ItemFieldRepositoryValue':
        case 'ProjectV2ItemFieldReviewerValue':
        case 'ProjectV2ItemFieldUserValue':
        case 'ProjectV2ItemIssueFieldValue':
            return null;
        default:
            return assertNever(value);
    }
}
