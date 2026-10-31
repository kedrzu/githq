import type { ProjectOwnerKind } from '@/projects/ProjectTypes.js';

/** A repository the user tracks: all its issues and pull requests are kept (D4). */
export interface TrackedRepository {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    /** The repository's node id. */
    readonly id: string;
}

/** A project the user tracks: all its items, fields and saved views are kept (D4). */
export interface TrackedProject {
    /** The project's node id. */
    readonly id: string;
    /** The login of the user or organisation owning it. */
    readonly owner: string;
    readonly ownerKind: ProjectOwnerKind;
    readonly number: number;
    readonly title: string;
}

/**
 * What one account tracks, in the user's order — the sidebar's order, and D12's precedence for the row field.
 * Kept in the account's local copy.
 */
export interface Tracking {
    /** The user went through the choice (G2) at least once; until then the app offers it. */
    readonly chosen: boolean;
    readonly repositories: readonly TrackedRepository[];
    readonly projects: readonly TrackedProject[];
}

/** A repository or project the user tracks, by what names it. */
export type TrackedTarget =
    | { readonly kind: 'repository'; readonly nameWithOwner: string }
    | { readonly kind: 'project'; readonly id: string };

/**
 * The parts of a tracked repository's first download, in the order they run: open items first — then the
 * tracked projects — and closed items last (G6).
 */
export type RepositoryDownloadPhase = 'openIssues' | 'openPullRequests' | 'closedIssues' | 'closedPullRequests';

/** The phases of {@link RepositoryDownloadPhase} in order. */
export const REPOSITORY_DOWNLOAD_PHASES: readonly RepositoryDownloadPhase[] = [
    'openIssues',
    'openPullRequests',
    'closedIssues',
    'closedPullRequests',
];

/** How many items of a phase are read, of how many GitHub counts; `total` is `null` before its first page. */
export interface DownloadCount {
    readonly done: number;
    readonly total: number | null;
}

/**
 * GitHub refusing a tracked copy's change check for a reason that lasts — not a 404 (hidden) nor the allowance:
 * a 403 for an organisation the user is not in or one restricting OAuth Apps. Asked again after a while.
 */
export interface SyncRefusal {
    /** The HTTP status GitHub refused with. */
    readonly status: number;
    /** When GitHub last refused (epoch ms). */
    readonly at: number;
}

/**
 * How far a tracked repository's copy is: its first download, page by page — resumed from `cursor` in a later
 * session — and its change polling (D7). Kept in the account's local copy.
 */
export interface RepositorySyncState {
    readonly kind: 'repository';
    readonly nameWithOwner: string;
    /** The phase under way; `done` once every item was read. */
    readonly phase: RepositoryDownloadPhase | 'done';
    /** Where the phase under way goes on from; `null` at its start. */
    readonly cursor: string | null;
    readonly counts: Readonly<Partial<Record<RepositoryDownloadPhase, DownloadCount>>>;
    /** ISO: the change list is asked for what changed since then; set when the download starts. */
    readonly since: string | null;
    /** The ETag of the change list's last 200. */
    readonly etag: string | null;
    /** GitHub does not show the repository to the user (gone, or hidden by its organisation). */
    readonly hidden: boolean;
    /** GitHub refuses the change list: its changes are not followed until it answers again. */
    readonly refused: SyncRefusal | null;
    /** The last change poll that succeeded (epoch ms). */
    readonly lastSuccessAt: number | null;
}

/** How far a tracked project's copy is: its first download, resumable, and its change polling (D7). */
export interface ProjectSyncState {
    readonly kind: 'project';
    readonly id: string;
    /** Every item was read once. */
    readonly downloaded: boolean;
    /** Where the download goes on from; `null` at its start (it starts with `ProjectFull`). */
    readonly cursor: string | null;
    readonly count: DownloadCount;
    /** The ETag of the project's last REST 200. */
    readonly etag: string | null;
    /**
     * When the last read of its items started (epoch ms): the next re-read asks for the items updated since the
     * day before it — the filter has date granularity, so the window overlaps by a day (D7).
     */
    readonly readAt: number | null;
    readonly hidden: boolean;
    /** GitHub refuses the REST project: whether it changed is asked through GraphQL instead, less often. */
    readonly refused: SyncRefusal | null;
    /** The project's `updatedAt` when it was last read through GraphQL's change check; `null` before. */
    readonly updatedAt: string | null;
    readonly lastSuccessAt: number | null;
}

/** A change of a tracked repository's sync state: the fields its writer owns. */
export type RepositorySyncPatch = Partial<Omit<RepositorySyncState, 'kind' | 'nameWithOwner'>>;

/** A change of a tracked project's sync state: the fields its writer owns. */
export type ProjectSyncPatch = Partial<Omit<ProjectSyncState, 'kind' | 'id'>>;

/** The sync state of a tracked repository or project. */
export type TrackedSyncState = RepositorySyncState | ProjectSyncState;

/** How far a tracked repository's or project's first download is, for G6 and the sidebar. */
export interface TrackingProgress {
    /** `hidden`: GitHub does not show it to the user, so nothing of it can be read. */
    readonly state: 'downloading' | 'done' | 'hidden';
    /** Items read so far. */
    readonly done: number;
    /** Items GitHub counts in the parts it started reading; `null` before the first page. */
    readonly total: number | null;
}

/** A repository the tracking screens offer (G2, G4, G8). */
export interface CandidateRepository {
    readonly id: string;
    readonly nameWithOwner: string;
    readonly owner: string;
    readonly isPrivate: boolean;
    readonly isArchived: boolean;
    /** ISO; the best hint whether the user cares. `null` for an empty repository. */
    readonly pushedAt: string | null;
    readonly openIssues: number;
    readonly openPullRequests: number;
}

/** A page-by-page list of an owner's repositories. */
export interface CandidateRepositories {
    readonly repositories: readonly CandidateRepository[];
    readonly totalCount: number;
    /** Where the next page starts; `null` when every one was read. */
    readonly nextCursor: string | null;
}

/** A project the tracking screens offer. */
export interface CandidateProject extends TrackedProject {
    readonly url: string;
    readonly closed: boolean;
    readonly updatedAt: string;
    readonly itemCount: number;
}

/** An organisation the user belongs to, with what it offers to track. */
export interface CandidateOrganization {
    readonly login: string;
    readonly avatarUrl: string;
    /** Its repositories, read page by page on demand; `null` when GitHub refused to list them. */
    readonly repositories: CandidateRepositories | null;
    readonly projects: readonly CandidateProject[];
    /**
     * It has OAuth App access restrictions and has not approved githq: its private repositories and projects
     * are missing until an owner approves it (G5).
     */
    readonly hiddenPrivate: boolean;
}

/** What the tracking screens offer: the user's own repositories and projects, and each organisation's. */
export interface TrackingCandidates {
    readonly login: string;
    readonly repositories: CandidateRepositories;
    readonly projects: readonly CandidateProject[];
    readonly organizations: readonly CandidateOrganization[];
}
