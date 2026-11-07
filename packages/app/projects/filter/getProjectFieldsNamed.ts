import type { ProjectField } from '@/store/ItemDetailTypes.js';

/**
 * The project's fields a filter qualifier names, as GitHub reads it: by name, case-insensitive, spaces written as `-`.
 * `qualifier` is lowercase.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getProjectFieldsNamed(fields: readonly ProjectField[], qualifier: string): ProjectField[] {
    return fields.filter(field => {
        const name = field.name.toLowerCase();
        return name === qualifier || name.replaceAll(/\s+/g, '-') === qualifier;
    });
}
