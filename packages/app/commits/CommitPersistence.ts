import { defineInterface } from '@nzyme/ioc/Interface.js';

import type { KeptCommit, KeptCommitRefs } from './CommitTypes.js';

/** A repository's commit graph as kept on disk. */
export interface PersistedCommits {
    readonly commits: readonly KeptCommit[];
    /** `null` until its refs were first read. */
    readonly refs: KeptCommitRefs | null;
}

/**
 * Where the repositories' commits and refs are kept between sessions: in the copy of the login that
 * `ItemPersistence.load` opened (D17), deleted with it. Every method rejects when that copy is not open (anymore) —
 * a late answer of a signed-out user must not bring their copy back.
 */
export interface CommitPersistenceShape {
    /** The kept commits and refs of `repository` (`owner/name`) only. */
    loadCommits(login: string, repository: string): Promise<PersistedCommits>;
    /** Adds the commits or replaces them (by repository and oid) — the same commit reads the same every time. */
    saveCommits(login: string, commits: readonly KeptCommit[]): Promise<void>;
    /** Replaces the repository's refs. */
    saveCommitRefs(login: string, refs: KeptCommitRefs): Promise<void>;
}

/** Where the commits are kept; the app sets IndexedDB (`createIndexedDbPersistence`). */
export const CommitPersistence = defineInterface<CommitPersistenceShape>({
    name: 'CommitPersistence',
});
