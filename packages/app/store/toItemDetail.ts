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
    ReviewPageFieldsFragment,
    ThreadEventFieldsFragment,
    ThreadRefFieldsFragment,
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
    ItemEvents,
    ItemReviewSummary,
    ItemReaction,
    LinkedIssue,
    LinkedIssues,
    ProjectField,
    ProjectFieldValue,
    PullRequestDetail,
    ThreadEvent,
    ThreadRef,
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
 * A page of comments (`CommentPageFields`), oldest first, with where the older ones start, and the item's first
 * comments (`firstComments`) the page does not hold.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toItemComments(
    page: CommentPageFieldsFragment,
    firstNodes: readonly (IssueCommentFieldsFragment | null)[] = [],
): ItemComments {
    const nodes = mapNotNull(page.nodes ?? [], comment => comment && toItemComment(comment));
    const held = new Set(nodes.map(comment => comment.id));
    return {
        totalCount: page.totalCount,
        first: mapNotNull(firstNodes, comment => (comment && !held.has(comment.id) ? toItemComment(comment) : null)),
        nodes,
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
        body: comment.body,
        bodyHtml: comment.bodyHTML,
        createdAt: comment.createdAt,
        lastEditedAt: comment.lastEditedAt,
        viewerCanUpdate: comment.viewerCanUpdate,
        viewerCanDelete: comment.viewerCanDelete,
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
        ...toItemReviewPage(node.reviews),
        reviewRequests: toDetailReviewRequests(node.reviewRequests),
    };
}

/** The thread's events the detail reads (`firstEvents`, `lastEvents`), of an issue or a pull request. */
interface DetailEvents {
    readonly id: string;
    readonly firstEvents: CursoredEventPage;
    readonly lastEvents: CursoredEventPage & { readonly filteredCount: number };
}

/** A page of a thread's events as GitHub answers it: the events, and each one's cursor at its index (`edges`). */
export interface CursoredEventPage {
    readonly edges: readonly ({ readonly cursor: string } | null)[] | null;
    readonly nodes: readonly (ThreadEventFieldsFragment | null)[] | null;
}

/**
 * The first and the newest events of an item's thread (`firstEvents`, `lastEvents`): each once, and where the ones
 * not read lie between them.
 *
 * @__NO_SIDE_EFFECTS__
 */
function toItemEvents(node: DetailEvents, commitCount: number): ItemEvents {
    const newest = toThreadEvents(node.lastEvents.nodes, node.id);
    const newestIds = new Set(newest.map(event => event.id));
    const oldest = toThreadEvents(node.firstEvents.nodes, node.id).filter(event => !newestIds.has(event.id));
    const unread = oldest.length + newest.length < node.lastEvents.filteredCount;

    return {
        totalCount: node.lastEvents.filteredCount,
        commitCount,
        oldest,
        newest,
        middle: unread ? { after: getCursorAfter(node.firstEvents), before: getCursorBefore(node.lastEvents) } : null,
    };
}

/**
 * The cursor to read on after the page from so that no event is skipped: GitHub's `after` leaves out every event at
 * the same time as its cursor's (checked 2026-11-10 on kedrzu/githq#219: after the 2nd commit, the 3rd, made the same
 * second, did not come). So it is the cursor of the newest event older than the page's last; the events read again
 * are told apart by id. `null` when none is older: the page holds one time only.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getCursorAfter(page: CursoredEventPage): string | null {
    const events = toTimedCursors(page);
    const last = events.at(-1);
    return (last && events.findLast(event => event.at < last.at)?.cursor) ?? null;
}

/**
 * The cursor to read up to before the page so that no event is skipped: GitHub's `before` leaves out the events at the
 * same time as its cursor's, as `after` does ({@link getCursorAfter}). So it is the cursor of the oldest event newer
 * than the page's first; `null` when none is newer.
 *
 * @__NO_SIDE_EFFECTS__
 */
function getCursorBefore(page: CursoredEventPage): string | null {
    const events = toTimedCursors(page);
    const first = events[0];
    return (first && events.find(event => event.at > first.at)?.cursor) ?? null;
}

/** Each event's cursor and the time GitHub orders it by: a commit's is when it was made. */
function toTimedCursors({ edges, nodes }: CursoredEventPage) {
    return mapNotNull(nodes ?? [], (node, index) => {
        const cursor = edges?.[index]?.cursor;
        if (!node || cursor === undefined) {
            return null;
        }

        if (node.__typename === 'PullRequestCommit') {
            return { cursor, at: Date.parse(node.pushedCommit.committedDate) };
        }

        // A kind githq does not read has no time told: it orders nothing.
        return 'createdAt' in node ? { cursor, at: Date.parse(node.createdAt) } : null;
    });
}

/**
 * A page of the events of the item `itemId`'s thread, oldest first; the kinds githq does not read left out.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toThreadEvents(
    nodes: readonly (ThreadEventFieldsFragment | null)[] | null,
    itemId: string,
): ThreadEvent[] {
    return mapNotNull(nodes ?? [], node => node && toThreadEvent(node, itemId));
}

/**
 * An event of the item `itemId`'s thread (`ThreadEventFields`); `null` for a kind githq does not read.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toThreadEvent(node: ThreadEventFieldsFragment, itemId: string): ThreadEvent | null {
    switch (node.__typename) {
        case 'PullRequestCommit': {
            const commit = node.pushedCommit;
            return {
                kind: 'commit',
                id: node.id,
                createdAt: commit.committedDate,
                actor: toDetailAuthor(commit.author?.user),
                authorName: commit.author?.name ?? null,
                abbreviatedOid: commit.abbreviatedOid,
                messageHeadline: commit.messageHeadline,
                url: node.url,
                ci: commit.statusCheckRollup?.state ?? null,
            };
        }
        case 'HeadRefForcePushedEvent':
            return {
                ...toEventBase(node),
                kind: 'forcePushed',
                beforeOid: node.beforeCommit?.abbreviatedOid ?? null,
                afterOid: node.afterCommit?.abbreviatedOid ?? null,
            };
        case 'AssignedEvent':
            return { ...toEventBase(node), kind: 'assigned', assignee: toDetailAuthor(node.assignee) };
        case 'UnassignedEvent':
            return { ...toEventBase(node), kind: 'unassigned', assignee: toDetailAuthor(node.assignee) };
        case 'RenamedTitleEvent':
            return { ...toEventBase(node), kind: 'renamed', from: node.previousTitle, to: node.currentTitle };
        case 'LabeledEvent':
            return { ...toEventBase(node), kind: 'labeled', label: node.label };
        case 'UnlabeledEvent':
            return { ...toEventBase(node), kind: 'unlabeled', label: node.label };
        case 'MilestonedEvent':
            return { ...toEventBase(node), kind: 'milestoned', milestone: node.milestoneTitle };
        case 'DemilestonedEvent':
            return { ...toEventBase(node), kind: 'demilestoned', milestone: node.milestoneTitle };
        case 'ReviewRequestedEvent':
            return {
                ...toEventBase(node),
                kind: 'reviewRequested',
                reviewer: toReviewer(node.requestedReviewer),
            };
        case 'ReviewRequestRemovedEvent':
            return {
                ...toEventBase(node),
                kind: 'reviewRequestRemoved',
                reviewer: toReviewer(node.requestedReviewer),
            };
        case 'ReviewDismissedEvent':
            return {
                ...toEventBase(node),
                kind: 'reviewDismissed',
                reviewer: toDetailAuthor(node.review?.author),
                message: node.dismissalMessage,
            };
        case 'ReadyForReviewEvent':
            return { ...toEventBase(node), kind: 'readyForReview' };
        case 'ConvertToDraftEvent':
            return { ...toEventBase(node), kind: 'convertedToDraft' };
        case 'BaseRefChangedEvent':
            return { ...toEventBase(node), kind: 'baseChanged', from: node.previousRefName, to: node.currentRefName };
        case 'CrossReferencedEvent':
            return {
                ...toEventBase(node),
                kind: 'crossReferenced',
                source: toThreadRef(node.source),
            };
        case 'ClosedEvent': {
            const { closer } = node;
            return {
                ...toEventBase(node),
                kind: 'closed',
                stateReason: node.stateReason,
                closer:
                    closer?.__typename === 'PullRequest'
                        ? { kind: 'pullRequest', pullRequest: toThreadRef(closer) }
                        : closer?.__typename === 'Commit'
                          ? { kind: 'commit', abbreviatedOid: closer.abbreviatedOid, url: closer.url }
                          : null,
                duplicateOf: node.duplicateOf && toThreadRef(node.duplicateOf),
            };
        }
        case 'ReopenedEvent':
            return { ...toEventBase(node), kind: 'reopened' };
        case 'MergedEvent':
            return {
                ...toEventBase(node),
                kind: 'merged',
                commit: node.commit,
                into: node.mergeRefName,
            };
        case 'HeadRefDeletedEvent':
            return { ...toEventBase(node), kind: 'headRefDeleted', branch: node.headRefName };
        case 'ConnectedEvent':
        case 'DisconnectedEvent':
            // Seen from either side: the other one is what was linked.
            return {
                ...toEventBase(node),
                kind: node.__typename === 'ConnectedEvent' ? 'connected' : 'disconnected',
                ref: toThreadRef(node.source.id === itemId ? node.subject : node.source),
            };
        case 'ReferencedEvent':
            return {
                ...toEventBase(node),
                kind: 'referenced',
                commit: node.commit,
                repository: node.commitRepository.nameWithOwner,
            };
        case 'SubIssueAddedEvent':
            return { ...toEventBase(node), kind: 'subIssueAdded', issue: node.subIssue && toThreadRef(node.subIssue) };
        case 'SubIssueRemovedEvent':
            return {
                ...toEventBase(node),
                kind: 'subIssueRemoved',
                issue: node.subIssue && toThreadRef(node.subIssue),
            };
        case 'ParentIssueAddedEvent':
            return { ...toEventBase(node), kind: 'parentAdded', issue: node.parent && toThreadRef(node.parent) };
        case 'ParentIssueRemovedEvent':
            return { ...toEventBase(node), kind: 'parentRemoved', issue: node.parent && toThreadRef(node.parent) };
        case 'IssueTypeAddedEvent':
            return { ...toEventBase(node), kind: 'issueTypeChanged', from: null, to: node.issueType };
        case 'IssueTypeChangedEvent':
            return {
                ...toEventBase(node),
                kind: 'issueTypeChanged',
                from: node.prevIssueType,
                to: node.issueType,
            };
        case 'IssueTypeRemovedEvent':
            return { ...toEventBase(node), kind: 'issueTypeChanged', from: node.issueType, to: null };
        case 'AddedToProjectV2Event':
        case 'RemovedFromProjectV2Event':
            return {
                ...toEventBase(node, node.wasAutomated),
                kind: node.__typename === 'AddedToProjectV2Event' ? 'addedToProject' : 'removedFromProject',
                project: node.project,
            };
        case 'ProjectV2ItemStatusChangedEvent':
            return {
                ...toEventBase(node, node.wasAutomated),
                kind: 'projectStatusChanged',
                project: node.project,
                to: node.status,
                wasAutomated: node.wasAutomated,
            };
        case 'TransferredEvent':
            return { ...toEventBase(node), kind: 'transferred', from: node.fromRepository?.nameWithOwner ?? null };
        case 'LockedEvent':
            return { ...toEventBase(node), kind: 'locked', reason: node.lockReason };
        case 'UnlockedEvent':
            return { ...toEventBase(node), kind: 'unlocked' };
        case 'PinnedEvent':
            return { ...toEventBase(node), kind: 'pinned' };
        case 'UnpinnedEvent':
            return { ...toEventBase(node), kind: 'unpinned' };
        case 'MarkedAsDuplicateEvent':
        case 'UnmarkedAsDuplicateEvent':
            return {
                ...toEventBase(node),
                kind: node.__typename === 'MarkedAsDuplicateEvent' ? 'markedAsDuplicate' : 'unmarkedAsDuplicate',
                canonical: node.canonical && toThreadRef(node.canonical),
                duplicate: node.duplicate && toThreadRef(node.duplicate),
            };
        // Not read (`THREAD_EVENT_TYPES`): comments, reviews and code threads come apart, the rest githq never shows.
        case 'AddedToMergeQueueEvent':
        case 'AddedToProjectEvent':
        case 'AddedToStackEvent':
        case 'AutoMergeDisabledEvent':
        case 'AutoMergeEnabledEvent':
        case 'AutoRebaseEnabledEvent':
        case 'AutoSquashEnabledEvent':
        case 'AutomaticBaseChangeFailedEvent':
        case 'AutomaticBaseChangeSucceededEvent':
        case 'BaseRefDeletedEvent':
        case 'BaseRefForcePushedEvent':
        case 'BlockedByAddedEvent':
        case 'BlockedByRemovedEvent':
        case 'BlockingAddedEvent':
        case 'BlockingRemovedEvent':
        case 'CommentDeletedEvent':
        case 'ConvertedFromDraftEvent':
        case 'ConvertedNoteToIssueEvent':
        case 'ConvertedToDiscussionEvent':
        case 'DeployedEvent':
        case 'DeploymentEnvironmentChangedEvent':
        case 'HeadRefRestoredEvent':
        case 'IssueComment':
        case 'IssueCommentPinnedEvent':
        case 'IssueCommentUnpinnedEvent':
        case 'IssueFieldAddedEvent':
        case 'IssueFieldChangedEvent':
        case 'IssueFieldRemovedEvent':
        case 'MentionedEvent':
        case 'MovedColumnsInProjectEvent':
        case 'PullRequestCommitCommentThread':
        case 'PullRequestReview':
        case 'PullRequestReviewThread':
        case 'PullRequestRevisionMarker':
        case 'RemovedFromMergeQueueEvent':
        case 'RemovedFromProjectEvent':
        case 'RemovedFromStackEvent':
        case 'SubscribedEvent':
        case 'UnsubscribedEvent':
        case 'UserBlockedEvent':
            return null;
        default:
            return assertNever(node);
    }
}

interface EventNode {
    readonly id: string;
    readonly createdAt: string;
    readonly actor: ItemUser | null;
}

/** What every event but a commit has; no one for a change a project workflow made. */
function toEventBase(node: EventNode, automated = false) {
    return { id: node.id, createdAt: node.createdAt, actor: automated ? null : toDetailAuthor(node.actor) };
}

function toReviewer(reviewer: DetailReviewer | null): ItemDetailReviewRequest | null {
    if (reviewer === null) {
        return null;
    }

    if ('login' in reviewer) {
        return { kind: 'user', user: { login: reviewer.login, avatarUrl: reviewer.avatarUrl } };
    }

    return 'slug' in reviewer ? { kind: 'team', slug: reviewer.slug, name: reviewer.name } : null;
}

function toThreadRef(ref: ThreadRefFieldsFragment): ThreadRef {
    return {
        kind: ref.__typename === 'Issue' ? 'issue' : 'pullRequest',
        id: ref.id,
        url: ref.url,
        number: ref.number,
        title: ref.title,
        repository: ref.repository.nameWithOwner,
    };
}

/**
 * A page of a pull request's submitted reviews (`ReviewPageFields`) as its detail keeps them.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toItemReviewPage(
    page: ReviewPageFieldsFragment | null | undefined,
): Pick<PullRequestDetail, 'reviewSummaries' | 'olderReviewCursor'> {
    return {
        reviewSummaries: mapNotNull(page?.nodes ?? [], (review): ItemReviewSummary | null =>
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
        olderReviewCursor: page?.pageInfo.hasPreviousPage ? page.pageInfo.startCursor : null,
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
    return mapNotNull(connection?.nodes ?? [], node => toReviewer(node?.requestedReviewer ?? null));
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
        lastEditedAt: node.lastEditedAt,
        viewerCanUpdate: node.viewerCanUpdate,
        locked: node.locked,
        reactions,
        comments: toItemComments(node.commentPage, node.firstComments.nodes ?? []),
        events: toItemEvents(node, node.__typename === 'PullRequest' ? node.commitEvents.filteredCount : 0),
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
