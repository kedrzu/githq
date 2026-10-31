import { describeProjectFieldValue } from '@/projects/describeProjectFieldValue.js';
import type { Project, ProjectItem } from '@/projects/ProjectTypes.js';
import type { ProjectField } from '@/store/ItemDetailTypes.js';

import type { Edit, EditVerdict, ProjectFieldInput } from './EditTypes.js';
import { getProjectItemValueLayer, sendProjectFieldValue, toFieldValue } from './projectFieldValues.js';

/** What {@link createDraftFieldEdit} sets. */
export interface CreateDraftFieldEditParams {
    readonly project: Project;
    /** The draft issue's project item, as shown. */
    readonly item: ProjectItem;
    readonly field: ProjectField;
    /** `null` clears it. */
    readonly value: ProjectFieldInput | null;
}

/**
 * The edit setting a field of a draft issue in a tracked project — moving its card to another column. A draft
 * has no issue to draw the change over, so it is drawn over the project item itself (its id is the overlay's
 * key) and confirmed by the value GitHub answers with, as an issue's field is (D8, D14).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createDraftFieldEdit(params: CreateDraftFieldEditParams): Edit {
    const { project, item, field, value: input } = params;
    const value = input ? toFieldValue(field, input) : null;
    const subject = {
        kind: 'projectField',
        project: project.title,
        field: field.name,
        value: value ? describeProjectFieldValue(value) : null,
    } as const;
    const base = { itemId: item.itemId, reference: project.title, subject };
    if (input && !value) {
        return { ...base, optimistic: { item: current => current }, failure: { kind: 'missing' } };
    }

    return {
        ...base,
        optimistic: {
            item: current => current,
            ...getProjectItemValueLayer({ itemId: item.itemId, fieldId: field.id, value }),
        },
        send: async sdk => {
            const answer = await sendProjectFieldValue(sdk, {
                projectId: project.id,
                itemId: item.itemId,
                field,
                value: input,
            });
            if (!answer) {
                return { kind: 'rejected', reason: { kind: 'dropped' } };
            }

            const { kept, updatedAt } = answer;
            return {
                kind: 'confirmed',
                layer: {
                    item: current => current,
                    ...getProjectItemValueLayer({ itemId: item.itemId, fieldId: field.id, value: kept, updatedAt }),
                },
            } satisfies EditVerdict;
        },
    };
}
