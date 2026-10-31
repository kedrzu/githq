import type { Project, ProjectItem } from '@/projects/ProjectTypes.js';
import { toProjectItem } from '@/projects/toProject.js';
import type { ProjectField, ProjectFieldValue } from '@/store/ItemDetailTypes.js';

import type { Edit, ProjectFieldInput } from './EditTypes.js';
import { sendProjectFieldValue, toFieldValue, withValue } from './projectFieldValues.js';

/** What {@link createDraftIssueEdit} adds. */
export interface CreateDraftIssueEditParams {
    readonly project: Project;
    readonly title: string;
    readonly body: string;
    /** ISO time: when the draft is shown to have been made. */
    readonly now: string;
    /** Names the draft until GitHub does: unique among the drafts on their way. */
    readonly temporaryId: string;
    /** Fields set on it once added — the value of the column or group it was written in. */
    readonly values?: readonly DraftFieldValue[];
}

/** A field set on a draft issue as it is added. */
export interface DraftFieldValue {
    readonly field: ProjectField;
    readonly value: ProjectFieldInput;
}

/**
 * The edit adding a draft issue to a tracked project (`AddDraftIssue`): the draft shows in the project at once,
 * as a row of its own, and GitHub's answer — the new project item — takes its place.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createDraftIssueEdit(params: CreateDraftIssueEditParams): Edit {
    const { project, title, body, now, temporaryId, values: fieldValues = [] } = params;
    const shownValues: Record<string, ProjectFieldValue> = {};
    for (const { field, value } of fieldValues) {
        const shown = toFieldValue(field, value);
        if (shown) {
            shownValues[field.id] = shown;
        }
    }

    const pending: ProjectItem = {
        itemId: temporaryId,
        projectId: project.id,
        contentId: null,
        draft: { id: temporaryId, title, body, assignees: [], createdAt: now },
        values: shownValues,
        updatedAt: now,
        isArchived: false,
    };

    return {
        itemId: temporaryId,
        reference: project.title,
        subject: { kind: 'draftAdded', project: project.title, title },
        optimistic: { item: item => item, addedProjectItems: [pending] },
        send: async sdk => {
            const answer = (await sdk.AddDraftIssue({ projectId: project.id, title, body })).addProjectV2DraftIssue
                ?.projectItem;
            if (!answer || answer.content?.__typename !== 'DraftIssue') {
                return { kind: 'rejected', reason: { kind: 'dropped' } };
            }

            const { item } = toProjectItem(answer, project.id);
            let { values: keptValues, updatedAt } = item;
            // The draft is in the project now: a field GitHub did not set leaves it where GitHub put it, in the
            // group without a value, rather than taking the draft back.
            for (const { field, value } of fieldValues) {
                const kept = await sendProjectFieldValue(sdk, {
                    projectId: project.id,
                    itemId: item.itemId,
                    field,
                    value,
                }).catch(() => null);
                if (kept) {
                    keptValues = withValue(keptValues, field.id, kept.kept);
                    updatedAt = kept.updatedAt;
                }
            }

            return {
                kind: 'confirmed',
                layer: { item: current => current, addedProjectItems: [{ ...item, values: keptValues, updatedAt }] },
            };
        },
    };
}
