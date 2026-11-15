import { assertNever } from '@nzyme/utils/assertNever.js';

import type { CommandFormField, CommandFormValue, CommandFormValues } from '@/commands/CommandTypes.js';

import { DISPATCH_INPUT_PREFIX } from './getDispatchFields.js';

/**
 * The inputs to send with a dispatch, by their names in the file (the fields of `getDispatchFields`, keyed
 * `input:<name>`; any other field is not an input): those whose value the user entered or changed — what differs from what the field
 * showed untouched. The rest are left to GitHub, which applies the file's defaults itself; an empty number field is
 * never sent.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getDispatchInputs(
    fields: readonly CommandFormField[],
    values: CommandFormValues,
): Record<string, string | number | boolean> {
    const inputs: Record<string, string | number | boolean> = {};
    for (const field of fields) {
        const value = values[field.name];
        if (
            field.name.startsWith(DISPATCH_INPUT_PREFIX) &&
            value !== undefined &&
            value !== null &&
            value !== getUntouchedValue(field)
        ) {
            inputs[field.name.slice(DISPATCH_INPUT_PREFIX.length)] = value;
        }
    }

    return inputs;
}

/** What the form shows in a field nobody touched (`CommandForm`). */
function getUntouchedValue(field: CommandFormField): CommandFormValue {
    switch (field.kind) {
        case 'text':
            return field.default ?? '';
        case 'number':
            return field.default ?? null;
        case 'choice':
            return field.default ?? field.options[0] ?? '';
        case 'boolean':
            return field.default ?? false;
        default:
            return assertNever(field);
    }
}
