import type { PullRequestBranchUpdateMethod, PullRequestStatusFieldsFragment } from '@githq/github/generated.gen.js';
import { rerunFailedJobs } from '@githq/github/rest/rerunFailedJobs.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { toMergeOptions } from '@/merge/toMergeOptions.js';
import { describeProjectFieldValue } from '@/projects/describeProjectFieldValue.js';
import type { ProjectItem } from '@/projects/ProjectTypes.js';
import type { RepositoryMetadata, ViewerProject } from '@/repos/RepositoryTypes.js';
import type {
    ItemComment,
    ItemDetail,
    ItemDetailProject,
    ItemDetailReviewRequest,
    ProjectFieldValue,
} from '@/store/ItemDetailTypes.js';
import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { ItemOverlayLayer } from '@/store/ItemOverlay.js';
import type {
    Item,
    ItemLabel,
    ItemProject,
    ItemUser,
    PullRequestAutoMerge,
    PullRequestItem,
} from '@/store/ItemTypes.js';
import { toItemLabels, toItemProject, toItemReviewRequests, toItemUsers, toPullRequestStatus } from '@/store/toItem.js';
import { toDetailProject, toDetailReviewRequests, toItemComment } from '@/store/toItemDetail.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import type { CloseReason, Edit, EditRequest, EditSubject, EditVerdict, ItemEditRequest } from './EditTypes.js';
import { toEditFailureReason } from './toEditFailureReason.js';
import { getEditIdentity } from './getEditIdentity.js';
import { toDroppedVerdict } from './toDroppedVerdict.js';
import { getProjectItemValueLayer, sendProjectFieldValue, toFieldValue, withValue } from './projectFieldValues.js';

/** What {@link createItemEdits} turns a request into edits of. */
export interface CreateItemEditsParams {
    readonly request: ItemEditRequest;
    /** The item as shown, the user's changes on their way included. */
    readonly item: Item;
    /**
     * Its places in projects with their fields — from its detail when read, else from the tracked projects: a
     * project field is set through its definition there.
     */
    readonly projects: readonly ItemDetailProject[];
    /** Its repository's labels, users, milestones and types, which give the ids GitHub wants. */
    readonly metadata: RepositoryMetadata | null;
    /** The signed-in user: a comment shows as theirs at once. */
    readonly viewer: ItemUser;
    /** ISO time: when a comment is shown to have been written. */
    readonly now: string;
}

/**
 * Leaves the item as it is: an edit that will not be sent shows nothing, or one whose result is what a read writes
 * into the stores.
 */
export const UNCHANGED: ItemOverlayLayer = { item: item => item };

/**
 * The edits a request makes of one item — one per label, user or field, each sent as one mutation and confirmed
 * by GitHub's answer (D14): a value missing from it is a rejection, never trusted as done. A change the item
 * already has makes no edit; one naming what the repository does not offer fails without being sent.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createItemEdits(params: CreateItemEditsParams): Edit[] {
    const { request, item } = params;
    switch (request.kind) {
        case 'labels':
            return [
                ...request.add
                    .filter(name => !item.labels.some(label => label.name === name))
                    .map(name => createLabelEdit(params, name, true)),
                ...request.remove
                    .filter(name => item.labels.some(label => label.name === name))
                    .map(name => createLabelEdit(params, name, false)),
            ];
        case 'assignees':
            return [
                ...request.add
                    .filter(login => !item.assignees.some(user => user.login === login))
                    .map(login => createAssigneeEdit(params, login, true)),
                ...request.remove
                    .filter(login => item.assignees.some(user => user.login === login))
                    .map(login => createAssigneeEdit(params, login, false)),
            ];
        case 'milestone':
            return (item.milestone?.title ?? null) === request.title
                ? []
                : [createMilestoneEdit(params, request.title)];
        case 'issueType':
            return item.kind !== 'issue' || (item.issueType?.name ?? null) === request.name
                ? []
                : [createIssueTypeEdit(params, request.name)];
        case 'close':
            return item.state === 'OPEN' ? [createStateEdit(params, request.reason)] : [];
        case 'reopen':
            return item.state === 'CLOSED' && !(item.kind === 'pullRequest' && item.merged)
                ? [createStateEdit(params, null)]
                : [];
        case 'comment':
            return request.body.trim() ? [createCommentEdit(params, request.body)] : [];
        case 'projectField':
            return [createProjectFieldEdit(params, request)];
        case 'addToProject':
            return item.projects.some(project => project.projectId === request.project.id)
                ? []
                : [createAddToProjectEdit(params, request.project)];
        case 'requestReviewers':
            return item.kind === 'pullRequest'
                ? request.logins
                      .filter(
                          login => !item.reviewRequests.some(asked => asked.kind === 'user' && asked.login === login),
                      )
                      .map(login => createReviewerEdit(params, login))
                : [];
        case 'draft':
            return item.kind === 'pullRequest' && item.isDraft !== request.draft
                ? [createDraftEdit(params, request.draft)]
                : [];
        case 'updateBranch':
            return item.kind === 'pullRequest' && isOpenPullRequest(item)
                ? [createUpdateBranchEdit(item, request.method)]
                : [];
        case 'enableAutoMerge':
            // Never for a stacked pull request: GitHub refuses it (live, 2026-11-02).
            return item.kind === 'pullRequest' && isOpenPullRequest(item) && !item.autoMerge && !item.stack
                ? [createEnableAutoMergeEdit({ item, request, viewer: params.viewer, now: params.now })]
                : [];
        case 'disableAutoMerge':
            return item.kind === 'pullRequest' && item.autoMerge ? [createDisableAutoMergeEdit(item)] : [];
        case 'jumpQueue':
            return item.kind === 'pullRequest' && isOpenPullRequest(item) && !item.mergeQueueEntry
                ? [createJumpQueueEdit(item)]
                : [];
        case 'dequeue':
            return item.kind === 'pullRequest' && item.mergeQueueEntry ? [createDequeueEdit(item)] : [];
        case 'deleteBranch':
            return item.kind === 'pullRequest' && item.headRefId !== null
                ? [createDeleteBranchEdit(item, item.headRefId)]
                : [];
        case 'restoreBranch':
            if (item.kind !== 'pullRequest' || item.headRefId !== null) {
                return [];
            }

            return [
                params.metadata
                    ? createRestoreBranchEdit(item, params.metadata.id)
                    : failed(item, { kind: 'branchRestored' }),
            ];
        case 'rerunFailedChecks':
            return item.kind === 'pullRequest' ? [createRerunChecksEdit(item)] : [];
        default:
            return assertNever(request);
    }
}

function createLabelEdit(params: CreateItemEditsParams, name: string, add: boolean): Edit {
    const { item, metadata } = params;
    const subject: EditSubject = { kind: add ? 'labelAdded' : 'labelRemoved', label: name };
    const label = metadata?.labels.find(candidate => candidate.name === name);
    if (!label) {
        return failed(item, subject);
    }

    return {
        ...getEditIdentity(item, subject),
        optimistic: {
            item: current =>
                add
                    ? withLabels(current, [
                          ...current.labels.filter(other => other.name !== name),
                          { name, color: label.color },
                      ])
                    : withLabels(
                          current,
                          current.labels.filter(other => other.name !== name),
                      ),
        },
        send: async ({ sdk }) => {
            const variables = { labelableId: item.id, labelIds: [label.id] };
            const answer = add
                ? (await sdk.AddLabels(variables)).addLabelsToLabelable
                : (await sdk.RemoveLabels(variables)).removeLabelsFromLabelable;
            const labelable = answer?.labelable;
            if (!labelable || !('updatedAt' in labelable)) {
                return toDroppedVerdict();
            }

            const labels = toItemLabels(labelable.labels);

            if (labels.some(other => other.name === name) !== add) {
                return toDroppedVerdict();
            }

            return confirmed(labelable.updatedAt, current => withLabels(current, labels));
        },
    };
}

function createAssigneeEdit(params: CreateItemEditsParams, login: string, add: boolean): Edit {
    const { item, metadata } = params;
    const subject: EditSubject = { kind: add ? 'assigneeAdded' : 'assigneeRemoved', login };
    const known = item.assignees.find(user => user.login === login);
    const user = metadata?.assignableUsers.find(candidate => candidate.login === login);
    if (!user) {
        return failed(item, subject);
    }

    return {
        ...getEditIdentity(item, subject),
        optimistic: {
            item: current => ({
                ...current,
                assignees: add
                    ? [
                          ...current.assignees.filter(other => other.login !== login),
                          known ?? { login, avatarUrl: user.avatarUrl },
                      ]
                    : current.assignees.filter(other => other.login !== login),
            }),
        },
        send: async ({ sdk }) => {
            const variables = { assignableId: item.id, assigneeIds: [user.id] };
            const answer = add
                ? (await sdk.AddAssignees(variables)).addAssigneesToAssignable
                : (await sdk.RemoveAssignees(variables)).removeAssigneesFromAssignable;
            const assignable = answer?.assignable;
            if (!assignable) {
                return toDroppedVerdict();
            }

            const assignees = toItemUsers(assignable.assignees);

            if (assignees.some(other => other.login === login) !== add) {
                return toDroppedVerdict();
            }

            return confirmed(assignable.updatedAt, current => ({ ...current, assignees }));
        },
    };
}

function createMilestoneEdit(params: CreateItemEditsParams, title: string | null): Edit {
    const { item, metadata } = params;
    const subject: EditSubject = { kind: 'milestone', title };
    const milestone = title === null ? null : metadata?.milestones.find(candidate => candidate.title === title);
    if (milestone === undefined) {
        return failed(item, subject);
    }

    const value = milestone && { title: milestone.title, dueOn: milestone.dueOn };
    return {
        ...getEditIdentity(item, subject),
        optimistic: { item: current => ({ ...current, milestone: value }) },
        send: async ({ sdk }) => {
            const milestoneId = milestone?.id ?? null;
            const answer =
                item.kind === 'issue'
                    ? (await sdk.UpdateIssueMilestone({ id: item.id, milestoneId })).updateIssue?.issue
                    : (await sdk.UpdatePullRequestMilestone({ pullRequestId: item.id, milestoneId })).updatePullRequest
                          ?.pullRequest;
            if (!answer || (answer.milestone?.title ?? null) !== title) {
                return toDroppedVerdict();
            }

            const kept = answer.milestone && { title: answer.milestone.title, dueOn: answer.milestone.dueOn };
            return confirmed(answer.updatedAt, current => ({ ...current, milestone: kept }));
        },
    };
}

function createIssueTypeEdit(params: CreateItemEditsParams, name: string | null): Edit {
    const { item, metadata } = params;
    const subject: EditSubject = { kind: 'issueType', name };
    const issueType = name === null ? null : metadata?.issueTypes.find(candidate => candidate.name === name);
    if (issueType === undefined) {
        return failed(item, subject);
    }

    const value = issueType && { name: issueType.name, color: issueType.color };
    return {
        ...getEditIdentity(item, subject),
        optimistic: { item: current => (current.kind === 'issue' ? { ...current, issueType: value } : current) },
        send: async ({ sdk }) => {
            const answer = (await sdk.UpdateIssueType({ issueId: item.id, issueTypeId: issueType?.id ?? null }))
                .updateIssueIssueType?.issue;
            if (!answer || (answer.issueType?.name ?? null) !== name) {
                return toDroppedVerdict();
            }

            const kept = answer.issueType && { name: answer.issueType.name, color: answer.issueType.color };
            return confirmed(answer.updatedAt, current =>
                current.kind === 'issue' ? { ...current, issueType: kept } : current,
            );
        },
    };
}

/** Closes the item (`reason` for an issue; `COMPLETED` stands for a pull request), or reopens it (`null`). */
function createStateEdit(params: CreateItemEditsParams, reason: CloseReason | null): Edit {
    const { item, now } = params;
    const closing = reason !== null;
    const subject: EditSubject = closing
        ? { kind: 'closed', reason: item.kind === 'issue' ? reason : null }
        : { kind: 'reopened' };

    return {
        ...getEditIdentity(item, subject),
        optimistic: {
            item: current =>
                current.kind === 'issue'
                    ? {
                          ...current,
                          state: closing ? 'CLOSED' : 'OPEN',
                          stateReason: closing ? reason : 'REOPENED',
                          closedAt: closing ? now : null,
                      }
                    : { ...current, state: closing ? 'CLOSED' : 'OPEN', closedAt: closing ? now : null },
        },
        send: async ({ sdk }) => {
            if (item.kind === 'issue') {
                const answer = closing
                    ? (await sdk.CloseIssue({ issueId: item.id, stateReason: reason })).closeIssue?.issue
                    : (await sdk.ReopenIssue({ issueId: item.id })).reopenIssue?.issue;
                if (!answer || answer.state !== (closing ? 'CLOSED' : 'OPEN')) {
                    return toDroppedVerdict();
                }

                const { state, stateReason, closedAt } = answer;
                return confirmed(answer.updatedAt, current =>
                    current.kind === 'issue' ? { ...current, state, stateReason, closedAt } : current,
                );
            }

            const answer = closing
                ? (await sdk.ClosePullRequest({ pullRequestId: item.id })).closePullRequest?.pullRequest
                : (await sdk.ReopenPullRequest({ pullRequestId: item.id })).reopenPullRequest?.pullRequest;
            if (!answer || answer.state !== (closing ? 'CLOSED' : 'OPEN')) {
                return toDroppedVerdict();
            }

            const { state, isDraft, closedAt } = answer;
            return confirmed(answer.updatedAt, current =>
                current.kind === 'pullRequest' ? { ...current, state, isDraft, closedAt } : current,
            );
        },
    };
}

function createCommentEdit(params: CreateItemEditsParams, body: string): Edit {
    const { item, viewer, now } = params;
    const pending: ItemComment = {
        id: `pending:${now}`,
        url: item.url,
        author: viewer,
        bodyHtml: '',
        createdAt: now,
        lastEditedAt: null,
        pendingBody: body,
    };

    return {
        ...getEditIdentity(item, { kind: 'comment', body }),
        optimistic: {
            item: current => ({ ...current, commentCount: current.commentCount + 1 }),
            detail: detail => withComment(detail, pending),
        },
        send: async ({ sdk }) => {
            const node = (await sdk.AddComment({ subjectId: item.id, body })).addComment?.commentEdge?.node;
            if (!node) {
                return toDroppedVerdict();
            }

            const comment = toItemComment(node);
            return {
                kind: 'confirmed',
                layer: {
                    item: current => current,
                    detail: detail => withComment(detail, comment),
                    // Read again since it was written: the comment is in what was read.
                    supersededBy: stored => stored.updatedAt >= comment.createdAt,
                    confirmedAt: comment.createdAt,
                },
            };
        },
    };
}

function createProjectFieldEdit(
    params: CreateItemEditsParams,
    request: Extract<EditRequest, { kind: 'projectField' }>,
): Edit {
    const { item } = params;
    const project = params.projects.find(candidate => candidate.itemId === request.projectItemId);
    const field = project?.fields.find(candidate => candidate.id === request.fieldId);
    const value = field && request.value ? toFieldValue(field, request.value) : null;
    const subject: EditSubject = {
        kind: 'projectField',
        project: project?.title ?? '',
        field: field?.name ?? '',
        value: value ? describeProjectFieldValue(value) : null,
    };
    if (!project || !field || (request.value && !value)) {
        return failed(item, subject);
    }

    const status = field.name === 'Status';
    return {
        ...getEditIdentity(item, subject),
        optimistic: {
            item: current =>
                status
                    ? withProjectStatus(current, project.itemId, value?.kind === 'singleSelect' ? value : null)
                    : current,
            detail: current =>
                withDetailProject(current, project.itemId, place => ({
                    ...place,
                    values: withValue(place.values, field.id, value),
                })),
            ...getProjectItemValueLayer({ itemId: project.itemId, fieldId: field.id, value }),
        },
        send: async ({ sdk }) => {
            const answer = await sendProjectFieldValue(sdk, {
                projectId: project.projectId,
                itemId: project.itemId,
                field,
                value: request.value,
            });
            if (!answer) {
                return toDroppedVerdict();
            }

            const { kept } = answer;
            const { updatedAt } = answer;
            return {
                kind: 'confirmed',
                layer: {
                    item: current =>
                        status
                            ? withProjectStatus(
                                  current,
                                  project.itemId,
                                  kept?.kind === 'singleSelect' ? kept : null,
                                  updatedAt,
                              )
                            : current,
                    detail: current =>
                        withDetailProject(current, project.itemId, place => ({
                            ...place,
                            values: withValue(place.values, field.id, kept),
                            updatedAt,
                        })),
                    supersededBy: stored =>
                        stored.projects.some(place => place.itemId === project.itemId && place.updatedAt > updatedAt),
                    confirmedAt: updatedAt,
                    ...getProjectItemValueLayer({ itemId: project.itemId, fieldId: field.id, value: kept, updatedAt }),
                },
            };
        },
    };
}

function createAddToProjectEdit(params: CreateItemEditsParams, project: ViewerProject): Edit {
    const { item, now } = params;
    const placeholder: ItemProject = {
        itemId: `pending:${project.id}`,
        projectId: project.id,
        title: project.title,
        number: project.number,
        url: project.url,
        status: null,
        updatedAt: now,
    };
    const placeholderDetail: ItemDetailProject = {
        ...placeholder,
        viewerCanUpdate: false,
        fields: [],
        values: {},
    };

    // The project's own list shows it at once too, and keeps it once GitHub made its place there.
    const placeholderItem: ProjectItem = {
        itemId: `${placeholder.itemId}:${item.id}`,
        projectId: project.id,
        contentId: item.id,
        draft: null,
        values: {},
        updatedAt: now,
        isArchived: false,
    };

    return {
        ...getEditIdentity(item, { kind: 'addedToProject', project: project.title }),
        optimistic: {
            item: current => withProject(current, placeholder),
            detail: current => withDetailProjectAdded(current, placeholderDetail),
            addedProjectItems: [placeholderItem],
        },
        send: async ({ sdk }) => {
            const answer = (await sdk.AddToProject({ projectId: project.id, contentId: item.id })).addProjectV2ItemById
                ?.item;
            if (!answer || answer.project.id !== project.id) {
                return toDroppedVerdict();
            }

            const place = toItemProject(answer);
            const placeDetail = toDetailProject(answer);
            return {
                kind: 'confirmed',
                layer: {
                    item: current => withProject(current, place),
                    detail: current => withDetailProjectAdded(current, placeDetail),
                    supersededBy: stored => stored.projects.some(other => other.itemId === place.itemId),
                    confirmedAt: place.updatedAt,
                    addedProjectItems: [
                        {
                            ...placeholderItem,
                            itemId: place.itemId,
                            values: placeDetail.values,
                            updatedAt: place.updatedAt,
                        },
                    ],
                },
            };
        },
    };
}

function createReviewerEdit(params: CreateItemEditsParams, login: string): Edit {
    const { item, metadata } = params;
    const subject: EditSubject = { kind: 'reviewRequested', login };
    const user = metadata?.assignableUsers.find(candidate => candidate.login === login);
    if (!user) {
        return failed(item, subject);
    }

    const asked: ItemDetailReviewRequest = { kind: 'user', user: { login, avatarUrl: user.avatarUrl } };
    return {
        ...getEditIdentity(item, subject),
        optimistic: {
            item: current =>
                current.kind === 'pullRequest'
                    ? { ...current, reviewRequests: [...current.reviewRequests, { kind: 'user', login }] }
                    : current,
            detail: current =>
                current.kind === 'pullRequest'
                    ? { ...current, reviewRequests: [...current.reviewRequests, asked] }
                    : current,
        },
        send: async ({ sdk }) => {
            const answer = (await sdk.RequestReviews({ pullRequestId: item.id, userIds: [user.id] })).requestReviews
                ?.pullRequest;
            if (!answer) {
                return toDroppedVerdict();
            }

            const rows = toItemReviewRequests(answer.reviewRequests);
            const details = toDetailReviewRequests(answer.reviewRequests);
            if (!rows.some(other => other.kind === 'user' && other.login === login)) {
                return toDroppedVerdict();
            }

            return confirmed(
                answer.updatedAt,
                current => (current.kind === 'pullRequest' ? { ...current, reviewRequests: rows } : current),
                current => (current.kind === 'pullRequest' ? { ...current, reviewRequests: details } : current),
            );
        },
    };
}

function createDraftEdit(params: CreateItemEditsParams, draft: boolean): Edit {
    const { item } = params;
    return {
        ...getEditIdentity(item, { kind: 'draft', draft }),
        optimistic: { item: current => (current.kind === 'pullRequest' ? { ...current, isDraft: draft } : current) },
        send: async ({ sdk }) => {
            const answer = draft
                ? (await sdk.ConvertToDraft({ pullRequestId: item.id })).convertPullRequestToDraft?.pullRequest
                : (await sdk.MarkReadyForReview({ pullRequestId: item.id })).markPullRequestReadyForReview?.pullRequest;
            if (!answer || answer.isDraft !== draft) {
                return toDroppedVerdict();
            }

            return confirmed(answer.updatedAt, current =>
                current.kind === 'pullRequest' ? { ...current, isDraft: answer.isDraft } : current,
            );
        },
    };
}

/**
 * Brings the base branch into the head the user saw (`expectedHeadOid`): GitHub refuses it once the branch moved
 * since. Nothing is drawn meanwhile, and GitHub's answer says nothing of the branch it can be trusted with — it works
 * out the new status in its own time — so whoever asked reads the pull request again once it is confirmed.
 */
function createUpdateBranchEdit(item: PullRequestItem, method: PullRequestBranchUpdateMethod): Edit {
    return {
        ...getEditIdentity(item, { kind: 'branchUpdated' }),
        optimistic: UNCHANGED,
        send: async ({ sdk }) => {
            const { updatePullRequestBranch } = await sdk.UpdatePullRequestBranch({
                pullRequestId: item.id,
                expectedHeadOid: item.headRefOid,
                updateMethod: method,
            });
            return updatePullRequestBranch?.pullRequest ? { kind: 'confirmed', layer: UNCHANGED } : toDroppedVerdict();
        },
    };
}

/** What {@link createEnableAutoMergeEdit} makes the edit of. */
interface CreateEnableAutoMergeEditParams {
    readonly item: PullRequestItem;
    readonly request: Extract<ItemEditRequest, { kind: 'enableAutoMerge' }>;
    /** The signed-in user: it shows at once as turned on by them. */
    readonly viewer: ItemUser;
    /** ISO time: when it shows to have been turned on. */
    readonly now: string;
}

/**
 * Turns auto-merge on for the head the user saw (`expectedHeadOid`): GitHub refuses it once the branch moved since. It
 * shows at once, as the viewer's, with the method chosen, and the text goes only when edited: GitHub writes its own
 * otherwise (merging D6).
 */
function createEnableAutoMergeEdit(params: CreateEnableAutoMergeEditParams): Edit {
    const { item, viewer, now } = params;
    const { method, title, body } = params.request;
    const autoMerge: PullRequestAutoMerge = {
        mergeMethod: method,
        enabledAt: now,
        enabledBy: viewer.login,
        commitHeadline: title ?? null,
    };
    return {
        ...getEditIdentity(item, { kind: 'autoMerge', enabled: true }),
        optimistic: { item: current => (current.kind === 'pullRequest' ? { ...current, autoMerge } : current) },
        send: async ({ sdk }) => {
            const { enablePullRequestAutoMerge } = await sdk.EnablePullRequestAutoMerge({
                pullRequestId: item.id,
                mergeMethod: method,
                expectedHeadOid: item.headRefOid,
                ...(title === undefined ? {} : { commitHeadline: title }),
                ...(body === undefined ? {} : { commitBody: body }),
            });
            const answer = enablePullRequestAutoMerge?.pullRequest;
            return answer?.autoMergeRequest ? confirmedAutoMerge(answer) : toDroppedVerdict();
        },
    };
}

function createDisableAutoMergeEdit(item: PullRequestItem): Edit {
    return {
        ...getEditIdentity(item, { kind: 'autoMerge', enabled: false }),
        optimistic: { item: current => (current.kind === 'pullRequest' ? { ...current, autoMerge: null } : current) },
        send: async ({ sdk }) => {
            const { disablePullRequestAutoMerge } = await sdk.DisablePullRequestAutoMerge({ pullRequestId: item.id });
            const answer = disablePullRequestAutoMerge?.pullRequest;
            return answer && !answer.autoMergeRequest ? confirmedAutoMerge(answer) : toDroppedVerdict();
        },
    };
}

/**
 * Puts it at the front of the merge queue, for the head the user saw. Its place is GitHub's to give, so nothing is
 * drawn (merging D3): whoever asked reads the pull request again, and each next read says where it is now.
 */
function createJumpQueueEdit(item: PullRequestItem): Edit {
    return {
        ...getEditIdentity(item, { kind: 'queueJumped' }),
        optimistic: UNCHANGED,
        send: async ({ sdk }) => {
            const { enqueuePullRequest } = await sdk.EnqueuePullRequest({
                pullRequestId: item.id,
                expectedHeadOid: item.headRefOid,
            });
            return enqueuePullRequest?.mergeQueueEntry ? { kind: 'confirmed', layer: UNCHANGED } : { kind: 'unknown' };
        },
    };
}

/**
 * Takes it out of the merge queue; on a stack's first one, the whole stack: GitHub refuses this on a later one (live,
 * 2026-11-03), so whoever asks names the first, and reads the others again. GitHub accepting it is all it says, and a
 * read just after can still hold the entry (same check), so no read can refuse it: it is drawn out only of the queue and
 * for as long as a confirmed edit is drawn, the reads then saying what GitHub holds; another entry, added since, shows
 * through.
 */
function createDequeueEdit(item: PullRequestItem): Edit {
    return {
        ...getEditIdentity(item, { kind: 'dequeued' }),
        optimistic: { item: withoutQueueEntry },
        send: async ({ sdk }) => {
            await sdk.DequeuePullRequest({ id: item.id });
            return {
                kind: 'confirmed',
                layer: {
                    item: withoutQueueEntry,
                    supersededBy: stored =>
                        stored.kind === 'pullRequest' &&
                        stored.mergeQueueEntry !== null &&
                        stored.mergeQueueEntry.enqueuedAt !== item.mergeQueueEntry?.enqueuedAt,
                },
            };
        },
    };
}

/**
 * Deletes its branch, showing gone at once. GitHub answers nothing of the pull request, so whoever asked reads it again;
 * until then the branch stays drawn gone, unless the read holds another. A branch restored keeps its id (live,
 * 2026-11-03), so a read can't tell it from one older than the delete: restored on github.com while the layer lives, it
 * may draw as gone until the layer ends (merging D16). Restored from here, the restore's own layer draws over this one.
 */
function createDeleteBranchEdit(item: PullRequestItem, refId: string): Edit {
    return {
        ...getEditIdentity(item, { kind: 'branchDeleted' }),
        optimistic: { item: withoutHeadRef },
        send: async ({ sdk }) => {
            await sdk.DeleteRef({ refId });
            return {
                kind: 'confirmed',
                layer: {
                    item: withoutHeadRef,
                    supersededBy: stored =>
                        stored.kind === 'pullRequest' && stored.headRefId !== null && stored.headRefId !== refId,
                },
            };
        },
    };
}

function withoutHeadRef(item: Item): Item {
    return item.kind === 'pullRequest' ? { ...item, headRefId: null, viewerCanDeleteHeadRef: false } : item;
}

/**
 * Creates its branch again at its last head commit. It shows once GitHub made it, with the id it had before (live,
 * 2026-11-03), and it deletes again.
 */
function createRestoreBranchEdit(item: PullRequestItem, repositoryId: string): Edit {
    return {
        ...getEditIdentity(item, { kind: 'branchRestored' }),
        optimistic: UNCHANGED,
        send: async ({ sdk }) => {
            const ref = (
                await sdk.CreateRef({
                    repositoryId,
                    name: `refs/heads/${item.headRefName}`,
                    oid: item.headRefOid,
                })
            ).createRef?.ref;
            if (!ref) {
                return toDroppedVerdict();
            }

            return {
                kind: 'confirmed',
                layer: {
                    item: current =>
                        current.kind === 'pullRequest'
                            ? { ...current, headRefId: ref.id, viewerCanDeleteHeadRef: true }
                            : current,
                },
            };
        },
    };
}

/**
 * Re-runs the workflow runs of its checks that failed, as read now: rows don't hold them, and a run re-run since must not
 * be asked for again. Nothing is drawn: whoever asked reads it again. With nothing failing any more, or no such run —
 * checks from outside Actions — nothing is sent, and the failure says which. Every run is asked: GitHub refuses one still
 * going, which says nothing of the others, so only all refused fails the edit.
 */
function createRerunChecksEdit(item: PullRequestItem): Edit {
    const subject: EditSubject = { kind: 'checksRerun' };
    const { itemId, reference } = getEditIdentity(item, subject);
    return {
        ...getEditIdentity(item, subject),
        optimistic: UNCHANGED,
        send: async ({ sdk, rest }) => {
            // The protection of the base branch is not readable without admin rights: the checks are.
            const { node } = await sdk.PullRequestMergeOptions({ id: item.id }, { onPartialErrors: () => undefined });
            const options = toMergeOptions(node);
            if (!options) {
                return toDroppedVerdict();
            }

            const failing = options.checks.filter(check => check.state === 'failing');
            if (failing.length === 0) {
                return { kind: 'rejected', reason: { kind: 'nothingFailed' } };
            }

            const runs = new Set(failing.flatMap(check => (check.workflowRunId === null ? [] : [check.workflowRunId])));
            if (runs.size === 0) {
                return { kind: 'rejected', reason: { kind: 'notActions' } };
            }

            const repository = parseRepositoryName(item.repository.nameWithOwner);
            const refusals: unknown[] = [];
            for (const runId of runs) {
                try {
                    await rerunFailedJobs(rest, { ...repository, runId });
                } catch (error) {
                    refusals.push(error);
                }
            }

            if (refusals.length === runs.size) {
                throw refusals[0];
            }

            return {
                kind: 'confirmed',
                layer: UNCHANGED,
                partial:
                    refusals.length > 0
                        ? {
                              itemId,
                              reference,
                              failed: refusals.map(error => ({ subject, reason: toEditFailureReason(error) })),
                          }
                        : undefined,
            };
        },
    };
}

function withoutQueueEntry(item: Item): Item {
    return item.kind === 'pullRequest' ? { ...item, mergeQueueEntry: null } : item;
}

/**
 * Auto-merge turned on or off as GitHub answered. Only that is drawn: checks completing and the like don't move
 * `updatedAt` (live, 2026-11-03), so all the status answered would hide them for as long as the layer lasts.
 */
function confirmedAutoMerge(answer: PullRequestStatusFieldsFragment) {
    const { autoMerge } = toPullRequestStatus(answer);
    return confirmed(answer.updatedAt, current =>
        current.kind === 'pullRequest' ? { ...current, autoMerge } : current,
    );
}

/** An edit naming what the repository does not offer: it fails at once, nothing is sent. */
function failed(item: Item, subject: EditSubject): Edit {
    return { ...getEditIdentity(item, subject), optimistic: UNCHANGED, failure: { kind: 'missing' } };
}

/**
 * A change of the item GitHub confirmed at `updatedAt`: drawn over a row older than that, which a sync read
 * before the change may still bring in, and remembered by the rows it is written into, so that no tab takes such
 * a row over them. It leaves `updatedAt` alone: the sync reads the item again because its `updatedAt` moved, and
 * brings whatever else changed with it.
 */
function confirmed(
    updatedAt: string,
    item: (item: Item) => Item,
    detail?: (detail: ItemDetail) => ItemDetail,
): EditVerdict {
    return {
        kind: 'confirmed',
        layer: { item, detail, supersededBy: stored => stored.updatedAt > updatedAt, confirmedAt: updatedAt },
    };
}

function withLabels(item: Item, labels: readonly ItemLabel[]): Item {
    return { ...item, labels };
}

function withComment(detail: ItemDetail, comment: ItemComment): ItemDetail {
    if (detail.comments.nodes.some(other => other.id === comment.id)) {
        return detail;
    }

    return {
        ...detail,
        comments: {
            ...detail.comments,
            totalCount: detail.comments.totalCount + 1,
            nodes: [...detail.comments.nodes, comment],
        },
    };
}

function withProject(item: Item, place: ItemProject): Item {
    return { ...item, projects: [...item.projects.filter(other => other.projectId !== place.projectId), place] };
}

function withDetailProjectAdded(detail: ItemDetail, place: ItemDetailProject): ItemDetail {
    return {
        ...detail,
        projects: [...detail.projects.filter(other => other.projectId !== place.projectId), place],
    };
}

function withDetailProject(
    detail: ItemDetail,
    projectItemId: string,
    change: (place: ItemDetailProject) => ItemDetailProject,
): ItemDetail {
    return {
        ...detail,
        projects: detail.projects.map(place => (place.itemId === projectItemId ? change(place) : place)),
    };
}

function withProjectStatus(
    item: Item,
    projectItemId: string,
    value: Extract<ProjectFieldValue, { kind: 'singleSelect' }> | null,
    updatedAt?: string,
): Item {
    return {
        ...item,
        projects: item.projects.map(place =>
            place.itemId === projectItemId
                ? {
                      ...place,
                      status:
                          value?.name == null
                              ? null
                              : { name: value.name, color: value.color, optionId: value.optionId },
                      updatedAt: updatedAt ?? place.updatedAt,
                  }
                : place,
        ),
    };
}
