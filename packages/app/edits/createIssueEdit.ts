import type { GitHubSdk } from '@githq/github/createGitHubRequester.js';
import { describeProjectFieldValue } from '@/projects/describeProjectFieldValue.js';
import type { ProjectItem } from '@/projects/ProjectTypes.js';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';
import type { ProjectField, ProjectFieldValue } from '@/store/ItemDetailTypes.js';
import type { AddedItem } from '@/store/ItemOverlay.js';
import type { IssueItem, ItemProject, ItemUser } from '@/store/ItemTypes.js';
import { toItem } from '@/store/toItem.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import type { Edit, EditPartFailure, ProjectFieldInput } from './EditTypes.js';
import { sendProjectFieldValue, toFieldValue, withValue } from './projectFieldValues.js';

/** An issue as the user wrote it (H1, H3): everything by name, as the pickers show it. */
export interface NewIssueInput {
    readonly title: string;
    /** Markdown; may be empty. */
    readonly body: string;
    /** Logins. */
    readonly assignees: readonly string[];
    readonly labels: readonly string[];
    readonly milestone: string | null;
    readonly issueType: string | null;
    /** The issue it is a sub-issue of (H6). */
    readonly parent: NewIssueParent | null;
}

/** The issue a new one is made a sub-issue of. */
export interface NewIssueParent {
    /** Its node id. */
    readonly id: string;
    /** `portal#1187`, for the chip and the messages. */
    readonly reference: string;
}

/** A project a new issue is added to (H3, H5), with the fields set on it there. */
export interface NewIssueProject {
    readonly id: string;
    readonly title: string;
    readonly number: number;
    readonly url: string;
    /** Whether githq tracks it: only then is the issue shown in it at once. */
    readonly tracked: boolean;
    readonly values: readonly NewIssueFieldValue[];
}

/** A field of a project set on a new issue (the column it was started in). */
export interface NewIssueFieldValue {
    readonly field: ProjectField;
    readonly value: ProjectFieldInput;
}

/** What {@link createIssueEdit} creates. */
export interface CreateIssueEditParams {
    readonly repository: RepositoryMetadata;
    /** Whether the repository is private, as the row's lock shows it until GitHub answers. */
    readonly isPrivate: boolean;
    readonly issue: NewIssueInput;
    readonly projects: readonly NewIssueProject[];
    /** The signed-in user: the author, and "my work" when they assign themselves. */
    readonly viewer: ItemUser;
    /** ISO time: when the issue is shown to have been made. */
    readonly now: string;
    /** Names the issue until GitHub does: unique among the issues on their way. */
    readonly temporaryId: string;
}

/**
 * The edit creating an issue (`CreateIssue`, D8, D14): the issue shows at once wherever it belongs — the
 * repository's list, "my work" when assigned to the user, the projects it is added to with their fields — as `#…`,
 * and GitHub's issue takes its place. What GitHub did not keep of it (labels, assignees, milestone, type for a
 * user without push access — silently dropped; the parent; a project or its field) is reported, never shown as
 * set, and so is a value its repository does not have, which is never sent. A creation GitHub refuses takes the
 * issue away; the text stays with the caller.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createIssueEdit(params: CreateIssueEditParams): Edit {
    const { repository, issue, projects, viewer, now, temporaryId } = params;
    const owner = parseRepositoryName(repository.nameWithOwner).owner;

    const labels = repository.labels.filter(label => issue.labels.includes(label.name));
    const assignees = repository.assignableUsers.filter(user => issue.assignees.includes(user.login));
    const milestone = repository.milestones.find(candidate => candidate.title === issue.milestone) ?? null;
    const issueType = repository.issueTypes.find(candidate => candidate.name === issue.issueType) ?? null;
    // What the repository does not have (kept from another one, or a form's own) is never sent: reported instead.
    const notInRepository = findMissingValues(params);

    const pending: IssueItem = {
        kind: 'issue',
        id: temporaryId,
        url: '',
        number: 0,
        title: issue.title,
        repository: {
            nameWithOwner: repository.nameWithOwner,
            owner,
            isPrivate: params.isPrivate,
            viewerPermission: repository.viewerPermission,
        },
        author: viewer,
        assignees: assignees.map(user => ({ login: user.login, avatarUrl: user.avatarUrl })),
        labels: labels.map(label => ({ name: label.name, color: label.color })),
        milestone: milestone && { title: milestone.title, dueOn: milestone.dueOn },
        commentCount: 0,
        projects: projects.map((project): ItemProject => ({
            itemId: `${temporaryId}:${project.id}`,
            projectId: project.id,
            title: project.title,
            number: project.number,
            url: project.url,
            status: null,
            updatedAt: now,
        })),
        createdAt: now,
        updatedAt: now,
        closedAt: null,
        state: 'OPEN',
        stateReason: null,
        issueType: issueType && { name: issueType.name, color: issueType.color },
        subIssues: { total: 0, completed: 0 },
    };
    const myWorkGroup = assignees.some(user => user.login === viewer.login) ? 'assigned' : null;
    const tracked = projects.filter(project => project.tracked);

    return {
        itemId: temporaryId,
        reference: repository.nameWithOwner,
        subject: { kind: 'issueCreated', repository: repository.nameWithOwner, title: issue.title },
        optimistic: {
            item: item => item,
            addedItem: { item: pending, myWorkGroup },
            addedProjectItems: tracked.map(project => ({
                itemId: `${temporaryId}:${project.id}`,
                projectId: project.id,
                contentId: temporaryId,
                draft: null,
                values: toShownValues(project.values),
                updatedAt: now,
                isArchived: false,
            })),
        },
        send: async sdk => {
            const answer = (
                await sdk.CreateIssue({
                    repositoryId: repository.id,
                    title: issue.title,
                    body: issue.body,
                    assigneeIds: assignees.map(user => user.id),
                    labelIds: labels.map(label => label.id),
                    milestoneId: milestone?.id,
                    issueTypeId: issueType?.id,
                    parentIssueId: issue.parent?.id,
                    projectV2Ids: projects.map(project => project.id),
                })
            ).createIssue?.issue;
            const created = answer ? toItem(answer) : null;
            if (!answer || created?.kind !== 'issue') {
                return { kind: 'rejected', reason: { kind: 'dropped' } };
            }

            const failed: EditPartFailure[] = [...notInRepository];
            const dropped = { kind: 'dropped' } as const;
            for (const label of labels) {
                if (!created.labels.some(kept => kept.name === label.name)) {
                    failed.push({ subject: { kind: 'labelAdded', label: label.name }, reason: dropped });
                }
            }

            for (const user of assignees) {
                if (!created.assignees.some(kept => kept.login === user.login)) {
                    failed.push({ subject: { kind: 'assigneeAdded', login: user.login }, reason: dropped });
                }
            }

            if (milestone && created.milestone?.title !== milestone.title) {
                failed.push({ subject: { kind: 'milestone', title: milestone.title }, reason: dropped });
            }

            if (issueType && created.issueType?.name !== issueType.name) {
                failed.push({ subject: { kind: 'issueType', name: issueType.name }, reason: dropped });
            }

            if (issue.parent && answer.parent?.id !== issue.parent.id) {
                failed.push({ subject: { kind: 'subIssueOf', parent: issue.parent.reference }, reason: dropped });
            }

            const places: ProjectItem[] = [];
            for (const project of projects) {
                const place = await placeInProject(sdk, project, created);
                if (!place) {
                    failed.push({ subject: { kind: 'addedToProject', project: project.title }, reason: dropped });
                    continue;
                }

                let { values, updatedAt } = place;
                for (const { field, value } of project.values) {
                    const kept = await sendProjectFieldValue(sdk, {
                        projectId: project.id,
                        itemId: place.itemId,
                        field,
                        value,
                    }).catch(() => null);
                    if (kept) {
                        values = withValue(values, field.id, kept.kept);
                        updatedAt = kept.updatedAt;
                    } else {
                        failed.push({
                            subject: {
                                kind: 'projectField',
                                project: project.title,
                                field: field.name,
                                value: describeShown(field, value),
                            },
                            reason: dropped,
                        });
                    }
                }

                if (project.tracked) {
                    places.push({ ...place, values, updatedAt });
                }
            }

            const confirmed: AddedItem = {
                item: created,
                myWorkGroup: created.assignees.some(user => user.login === viewer.login) ? 'assigned' : null,
            };
            return {
                kind: 'confirmed',
                layer: { item: current => current, addedItem: confirmed, addedProjectItems: places },
                partial:
                    failed.length > 0
                        ? { itemId: created.id, reference: `${repository.nameWithOwner}#${created.number}`, failed }
                        : undefined,
            };
        },
    };
}

/**
 * The values of the issue its repository does not have — even looked up by name past the pages the pickers read —
 * as the parts of the creation that fail.
 */
function findMissingValues({ repository, issue }: CreateIssueEditParams): EditPartFailure[] {
    const missing = { kind: 'missing' } as const;
    const failed: EditPartFailure[] = [];
    for (const label of issue.labels) {
        if (!repository.labels.some(candidate => candidate.name === label)) {
            failed.push({ subject: { kind: 'labelAdded', label }, reason: missing });
        }
    }

    for (const login of issue.assignees) {
        if (!repository.assignableUsers.some(candidate => candidate.login === login)) {
            failed.push({ subject: { kind: 'assigneeAdded', login }, reason: missing });
        }
    }

    const { milestone, issueType } = issue;
    if (milestone !== null && !repository.milestones.some(candidate => candidate.title === milestone)) {
        failed.push({ subject: { kind: 'milestone', title: milestone }, reason: missing });
    }

    if (issueType !== null && !repository.issueTypes.some(candidate => candidate.name === issueType)) {
        failed.push({ subject: { kind: 'issueType', name: issueType }, reason: missing });
    }

    return failed;
}

/**
 * The new issue's place in the project: as GitHub answered the creation, or — when the answer does not hold it —
 * added now. `null` when GitHub did not add it.
 */
async function placeInProject(sdk: GitHubSdk, project: NewIssueProject, created: IssueItem) {
    const listed = created.projects.find(place => place.projectId === project.id);
    let itemId = listed?.itemId ?? null;
    let updatedAt = listed?.updatedAt ?? created.updatedAt;
    if (itemId === null) {
        const added = (await sdk.AddToProject({ projectId: project.id, contentId: created.id }).catch(() => null))
            ?.addProjectV2ItemById?.item;
        itemId = added?.id ?? null;
        updatedAt = added?.updatedAt ?? updatedAt;
    }

    if (itemId === null) {
        return null;
    }

    const place: ProjectItem = {
        itemId,
        projectId: project.id,
        contentId: created.id,
        draft: null,
        values: {},
        updatedAt,
        isArchived: false,
    };
    return place;
}

function toShownValues(values: readonly NewIssueFieldValue[]) {
    const shown: Record<string, ProjectFieldValue> = {};
    for (const { field, value } of values) {
        const fieldValue = toFieldValue(field, value);
        if (fieldValue) {
            shown[field.id] = fieldValue;
        }
    }

    return shown;
}

/** The value as a message names it ("In progress"). */
function describeShown(field: ProjectField, input: ProjectFieldInput) {
    const shown = toFieldValue(field, input);
    return shown && describeProjectFieldValue(shown);
}
