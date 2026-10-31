import type { GitHubSdk } from '@githq/github/createGitHubRequester.js';
import type { ProjectV2FieldValue } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import type { ProjectItem } from '@/projects/ProjectTypes.js';
import type { ProjectField, ProjectFieldValue } from '@/store/ItemDetailTypes.js';
import type { ItemOverlayLayer } from '@/store/ItemOverlay.js';
import { toProjectFieldValues } from '@/store/toItemDetail.js';

import type { ProjectFieldInput } from './EditTypes.js';

// How a value set on a project field is shown, sent and checked: shared by the edits of issues and pull requests
// in projects (`createItemEdits`) and of draft issues (`createDraftFieldEdit`, `createDraftIssueEdit`).

/**
 * The item's values with one field's set (`null`: cleared).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function withValue(
    values: Readonly<Record<string, ProjectFieldValue>>,
    fieldId: string,
    value: ProjectFieldValue | null,
): Record<string, ProjectFieldValue> {
    const next = { ...values };
    if (value) {
        next[fieldId] = value;
    } else {
        delete next[fieldId];
    }

    return next;
}

/** What {@link getProjectItemValueLayer} draws over a project item. */
export interface GetProjectItemValueLayerParams {
    /** The project item's id. */
    readonly itemId: string;
    readonly fieldId: string;
    /** `null`: cleared. */
    readonly value: ProjectFieldValue | null;
    /** When GitHub kept the value; left out while it is on its way. */
    readonly updatedAt?: string;
}

/**
 * The part of an edit's layer drawn over the project item: its field's value — and once GitHub answered, when it
 * kept it, so a project item read later than that is no longer drawn over.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getProjectItemValueLayer(
    params: GetProjectItemValueLayerParams,
): Pick<ItemOverlayLayer, 'projectItem' | 'projectItemSupersededBy'> {
    const { itemId, fieldId, value, updatedAt } = params;
    if (updatedAt === undefined) {
        return { projectItem };
    }

    return { projectItem, projectItemSupersededBy: stored => stored.itemId === itemId && stored.updatedAt > updatedAt };

    function projectItem(current: ProjectItem): ProjectItem {
        return current.itemId === itemId
            ? {
                  ...current,
                  values: withValue(current.values, fieldId, value),
                  updatedAt: updatedAt ?? current.updatedAt,
              }
            : current;
    }
}

/**
 * The value as the item view shows it; `null` when the field does not take it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toFieldValue(field: ProjectField, input: ProjectFieldInput): ProjectFieldValue | null {
    switch (input.kind) {
        case 'singleSelect': {
            const option =
                field.kind === 'singleSelect' ? field.options.find(candidate => candidate.id === input.optionId) : null;
            return option
                ? { kind: 'singleSelect', optionId: option.id, name: option.name, color: option.color }
                : null;
        }
        case 'iteration': {
            const iteration =
                field.kind === 'iteration'
                    ? [...field.iterations, ...field.completedIterations].find(
                          candidate => candidate.id === input.iterationId,
                      )
                    : null;
            return iteration
                ? {
                      kind: 'iteration',
                      iterationId: iteration.id,
                      title: iteration.title,
                      startDate: iteration.startDate,
                      duration: iteration.duration,
                  }
                : null;
        }
        case 'text':
            return field.kind === 'text' ? { kind: 'text', text: input.text } : null;
        case 'number':
            return field.kind === 'number' ? { kind: 'number', number: input.number } : null;
        case 'date':
            return field.kind === 'date' ? { kind: 'date', date: input.date } : null;
        default:
            return assertNever(input);
    }
}

/**
 * The id of a single-select's option or an iteration a value is — what a picker of the field marks as chosen —
 * else `null`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getPickedValueId(value: ProjectFieldValue | undefined): string | null {
    switch (value?.kind) {
        case 'singleSelect':
            return value.optionId;
        case 'iteration':
            return value.iterationId;
        default:
            return null;
    }
}

/**
 * The value an option picked of a single-select or an iteration field sets, by the option's or iteration's id.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toPickedInput(kind: 'iteration' | 'singleSelect', id: string): ProjectFieldInput {
    return kind === 'iteration' ? { kind: 'iteration', iterationId: id } : { kind: 'singleSelect', optionId: id };
}

/**
 * The value as GitHub's mutation takes it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toFieldInput(input: ProjectFieldInput): ProjectV2FieldValue {
    switch (input.kind) {
        case 'singleSelect':
            return { singleSelectOptionId: input.optionId };
        case 'iteration':
            return { iterationId: input.iterationId };
        case 'text':
            return { text: input.text };
        case 'number':
            return { number: input.number };
        case 'date':
            return { date: input.date };
        default:
            return assertNever(input);
    }
}

/**
 * Whether GitHub kept the value asked for (`null`: cleared).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isSameValue(kept: ProjectFieldValue | undefined, asked: ProjectFieldInput | null) {
    if (!asked) {
        return kept === undefined;
    }

    switch (asked.kind) {
        case 'singleSelect':
            return kept?.kind === 'singleSelect' && kept.optionId === asked.optionId;
        case 'iteration':
            return kept?.kind === 'iteration' && kept.iterationId === asked.iterationId;
        case 'text':
            return kept?.kind === 'text' && kept.text === asked.text;
        case 'number':
            return kept?.kind === 'number' && kept.number === asked.number;
        case 'date':
            return kept?.kind === 'date' && kept.date.slice(0, 10) === asked.date.slice(0, 10);
        default:
            return assertNever(asked);
    }
}

/** What {@link sendProjectFieldValue} sets, and where. */
export interface SendProjectFieldValueParams {
    readonly projectId: string;
    /** The project item's id. */
    readonly itemId: string;
    readonly field: ProjectField;
    /** `null` clears it. */
    readonly value: ProjectFieldInput | null;
}

/**
 * Sets or clears one field of a project item; resolves with the value GitHub kept (`null`: none) and when, or
 * `null` when GitHub's answer does not hold the value asked for — a rejection (D14). GitHub answers with this
 * field's value read by its name: an item's values may be more than a page.
 */
export async function sendProjectFieldValue(sdk: GitHubSdk, params: SendProjectFieldValueParams) {
    const { projectId, itemId, field, value } = params;
    const target = { projectId, itemId, fieldId: field.id, fieldName: field.name };
    const answer = value
        ? (await sdk.SetProjectFieldValue({ ...target, value: toFieldInput(value) })).updateProjectV2ItemFieldValue
              ?.projectV2Item
        : (await sdk.ClearProjectFieldValue(target)).clearProjectV2ItemFieldValue?.projectV2Item;
    if (!answer) {
        return null;
    }

    const kept = toProjectFieldValues([answer.fieldValueByName])[field.id];
    return isSameValue(kept, value) ? { kept: kept ?? null, updatedAt: answer.updatedAt } : null;
}
