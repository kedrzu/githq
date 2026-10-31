import type { IssueTypeColor, RepositoryPermission } from '@githq/github/generated.gen.js';

/**
 * What the pickers of a repository offer and what the viewer may do there (D14), as last read from GitHub:
 * up to 1000 labels and assignable users, the first 50 open milestones.
 */
export interface RepositoryMetadata {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    /** The repository's node id. */
    readonly id: string;
    /** `null` when GitHub does not say (an anonymous read). */
    readonly viewerPermission: RepositoryPermission | null;
    readonly hasIssuesEnabled: boolean;
    readonly isArchived: boolean;
    /** By name. */
    readonly labels: readonly RepositoryLabel[];
    /** The open ones, by due date. */
    readonly milestones: readonly RepositoryMilestone[];
    readonly assignableUsers: readonly RepositoryUser[];
    /** The enabled ones; empty where the owner has none (a user, or an organisation without them). */
    readonly issueTypes: readonly RepositoryIssueType[];
    /** When it was read (epoch ms). */
    readonly fetchedAt: number;
}

/** A label a repository offers. */
export interface RepositoryLabel {
    readonly id: string;
    readonly name: string;
    /** Hex, without `#`. */
    readonly color: string;
    readonly description: string | null;
}

/** An open milestone. */
export interface RepositoryMilestone {
    readonly id: string;
    readonly title: string;
    readonly dueOn: string | null;
}

/** A user who can be assigned. */
export interface RepositoryUser {
    readonly id: string;
    readonly login: string;
    readonly name: string | null;
    readonly avatarUrl: string;
}

/** An issue type (Bug, Feature, …). */
export interface RepositoryIssueType {
    readonly id: string;
    readonly name: string;
    readonly color: IssueTypeColor;
    readonly description: string | null;
}

/** The projects the viewer can add items to (write access or more): their own and their organisations'. */
export interface ViewerProjects {
    readonly projects: readonly ViewerProject[];
    /** When they were read (epoch ms). */
    readonly fetchedAt: number;
}

/** A project the viewer can write to. */
export interface ViewerProject {
    readonly id: string;
    readonly title: string;
    readonly number: number;
    readonly url: string;
    /** The login of the user or organisation owning it. */
    readonly owner: string;
    readonly closed: boolean;
}
