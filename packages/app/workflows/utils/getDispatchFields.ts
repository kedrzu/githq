import type { WorkflowInput } from '@githq/github/workflows/parseWorkflowFile.js';
import type { Language } from '@nzyme/i18n/Language.js';
import { translateToString } from '@nzyme/i18n/translateToString.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import type { CommandFormField } from '@/commands/CommandTypes.js';

import * as l from './getDispatchFields.loc.js';

/** What a dispatch field's key starts with, before its input's name. */
export const DISPATCH_INPUT_PREFIX = 'input:';

/**
 * The fields of a workflow's `workflow_dispatch` inputs (W37), each keyed `input:<name>` and labelled with its name — so
 * a value entered stays with an input another ref's file declares too, and no input (one named `ref`) clashes with the
 * form's other fields: a string or an environment is a text field, a number a number field, a
 * choice a select, a boolean a switch. Under the name its type; after the control its default, or "optional".
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getDispatchFields(inputs: readonly WorkflowInput[], lang: Language): CommandFormField[] {
    return inputs.map(input => {
        const base = {
            name: `${DISPATCH_INPUT_PREFIX}${input.name}`,
            label: input.name,
            detail: input.type,
            hint: getHint(input, lang),
            required: input.required,
        };
        const value = input.default;
        switch (input.type) {
            case 'string':
            case 'environment':
                return { ...base, kind: 'text', default: value === undefined ? undefined : String(value) };
            case 'number': {
                const number = Number(value);
                return {
                    ...base,
                    kind: 'number',
                    default: value === undefined || !Number.isFinite(number) ? undefined : number,
                };
            }
            case 'choice':
                return {
                    ...base,
                    kind: 'choice',
                    options: input.options ?? [],
                    default: value === undefined ? undefined : String(value),
                };
            case 'boolean':
                return { ...base, kind: 'boolean', default: value === true || value === 'true' };
            default:
                return assertNever(input.type);
        }
    });
}

function getHint(input: WorkflowInput, lang: Language) {
    const value = input.default;
    if (value === undefined || value === '') {
        return input.required ? undefined : translateToString(l.optional, lang);
    }

    const shown = typeof value === 'boolean' ? translateToString(value ? l.on : l.off, lang) : String(value);
    return translateToString(l.defaultValue, lang, { value: shown });
}
