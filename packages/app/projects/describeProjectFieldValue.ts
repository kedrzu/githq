import { assertNever } from '@nzyme/utils/assertNever.js';

import type { ProjectFieldValue } from '@/store/ItemDetailTypes.js';

/**
 * A project field's value as text: a group's name, a row's value, what a toast says was set; `null` for none.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function describeProjectFieldValue(value: ProjectFieldValue): string | null {
    switch (value.kind) {
        case 'text':
            return value.text || null;
        case 'number':
            return String(value.number);
        case 'date':
            return value.date.slice(0, 10);
        case 'singleSelect':
            return value.name;
        case 'multiSelect':
            return value.options.map(option => option.name).join(', ') || null;
        case 'iteration':
            return value.title;
        default:
            return assertNever(value);
    }
}
