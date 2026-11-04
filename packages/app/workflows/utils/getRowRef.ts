import type { RepositoryWorkflows, WorkflowRowRef } from '../WorkflowTypes.js';
import { getRefKind } from './getRefKind.js';

/**
 * The ref a run named, with its kind, as a row shows it; `null` when the run names none.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getRowRef(stored: RepositoryWorkflows, name: string | null): WorkflowRowRef | null {
    return name === null ? null : { name, kind: getRefKind(stored, name) };
}
