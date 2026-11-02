import { defineInterface } from '@nzyme/ioc/Interface.js';

import type { RepositoryWorkflows } from './WorkflowTypes.js';

/**
 * Where the tracked repositories' workflows and runs are kept between sessions: in the copy of the login that
 * `ItemPersistence.load` opened (D17), deleted with it. Every method rejects when that copy is not open (anymore).
 */
export interface WorkflowPersistenceShape {
    loadWorkflows(login: string): Promise<readonly RepositoryWorkflows[]>;
    /** Adds the repository's workflows or replaces them (by `nameWithOwner`). */
    saveWorkflows(login: string, workflows: RepositoryWorkflows): Promise<void>;
    deleteWorkflows(login: string, nameWithOwner: string): Promise<void>;
}

/** Where the workflows are kept; the app sets IndexedDB (`createIndexedDbPersistence`). */
export const WorkflowPersistence = defineInterface<WorkflowPersistenceShape>({
    name: 'WorkflowPersistence',
});
