import type { ProjectField } from '@/store/ItemDetailTypes.js';

/** The project fields that have keys of their own (`S`, `P`, `I`): a project's status, priority and iteration. */
export type ProjectFieldRole = 'status' | 'priority' | 'iteration';

/**
 * Which of the keyed fields a project field is, by the names GitHub's templates give them — "Status", "Priority"
 * as single-select fields — or by its kind (an iteration); `null` for any other field.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getProjectFieldRole(field: ProjectField): ProjectFieldRole | null {
    if (field.kind === 'iteration') {
        return 'iteration';
    }

    if (field.kind !== 'singleSelect') {
        return null;
    }

    switch (field.name.toLowerCase()) {
        case 'status':
            return 'status';
        case 'priority':
            return 'priority';
        default:
            return null;
    }
}
