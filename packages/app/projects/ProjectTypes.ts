import type { OrderDirection, ProjectV2ViewLayout } from '@githq/github/generated.gen.js';

import type { ProjectField, ProjectFieldValue } from '@/store/ItemDetailTypes.js';
import type { Item, ItemUser } from '@/store/ItemTypes.js';

/** Whose a project is: it picks the REST path its changes are polled through (D7). */
export type ProjectOwnerKind = 'user' | 'org';

/** A tracked project as the local copy keeps it: what its views and boards are built from (D2, D13). */
export interface Project {
    /** The project's node id. */
    readonly id: string;
    readonly title: string;
    readonly number: number;
    readonly url: string;
    /** The login of the user or organisation owning it. */
    readonly owner: string;
    readonly ownerKind: ProjectOwnerKind;
    readonly closed: boolean;
    /** Whether the viewer may set its items' fields and add to it (D14). */
    readonly viewerCanUpdate: boolean;
    /** Its own fields in its order; those mirroring the issue (title, labels, …) are left out. */
    readonly fields: readonly ProjectField[];
    /** Its saved views in its order (D13). */
    readonly views: readonly ProjectView[];
}

/** A saved view of a project as GitHub defines it (D13); githq evaluates its filter locally. */
export interface ProjectView {
    readonly id: string;
    readonly number: number;
    readonly name: string;
    readonly layout: ProjectV2ViewLayout;
    /** GitHub's project filter syntax; `null` or empty for every item. */
    readonly filter: string | null;
    readonly groupBy: readonly ProjectFieldRef[];
    readonly verticalGroupBy: readonly ProjectFieldRef[];
    readonly sortBy: readonly ProjectViewSort[];
    /** The fields it shows, in its order. */
    readonly fields: readonly ProjectFieldRef[];
}

/** A field a view names, the built-in ones (Title, Assignees, …) included. */
export interface ProjectFieldRef {
    readonly id: string;
    readonly name: string;
}

/** One sort key of a view. */
export interface ProjectViewSort {
    readonly field: ProjectFieldRef;
    readonly direction: OrderDirection;
}

/** An item of a tracked project: an issue or pull request (its row is in the item store), or a draft issue. */
export interface ProjectItem {
    /** The project item's node id — what a field edit addresses. */
    readonly itemId: string;
    readonly projectId: string;
    /** The issue's or pull request's node id; `null` for a draft issue (or content GitHub does not show). */
    readonly contentId: string | null;
    /** The draft issue, for an item that is one. */
    readonly draft: ProjectDraftIssue | null;
    /** The item's value of each of the project's own fields that has one, by field id. */
    readonly values: Readonly<Record<string, ProjectFieldValue>>;
    readonly updatedAt: string;
    /** Archived items are kept but hidden (D13). */
    readonly isArchived: boolean;
}

/** A draft issue: lives only in its project, without a repository. */
export interface ProjectDraftIssue {
    /** The draft's own node id, not its project item's. */
    readonly id: string;
    readonly title: string;
    readonly body: string;
    readonly assignees: readonly ItemUser[];
    readonly createdAt: string;
}

/** A project item as a view lists it: the item with its issue's or pull request's row (`null` for a draft). */
export interface ProjectEntry {
    readonly item: ProjectItem;
    readonly content: Item | null;
}
