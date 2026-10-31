import type {
    IssueState,
    IssueStateReason,
    ProjectV2SingleSelectFieldOptionColor,
    PullRequestReviewState,
    ReactionContent,
} from '@githq/github/generated.gen.js';

import type { Item, ItemUser } from './ItemTypes.js';

/**
 * What an opened issue or pull request shows beyond its row (D18): fetched when it is opened, prefetched for
 * "my work", then kept in the local copy.
 */
export type ItemDetail = IssueDetail | PullRequestDetail;

/** What the details of issues and pull requests share. */
export interface ItemDetailBase {
    /** The item's node id. */
    readonly id: string;
    /**
     * The item's row as read with this detail. Its `updatedAt` tells whether the detail is behind the row the
     * store holds; it is also the row of an item opened outside the store (`ItemDetailStore.getItem`).
     */
    readonly item: Item;
    /** When it was read (epoch ms). */
    readonly fetchedAt: number;
    /** Markdown, as written — what an edit starts from. */
    readonly body: string;
    /** GitHub's own rendering of the body, sanitized by GitHub. */
    readonly bodyHtml: string;
    /** Only the reactions given, in GitHub's order. */
    readonly reactions: readonly ItemReaction[];
    readonly comments: ItemComments;
    /** Its places in projects with every field value, archived ones left out (D13). */
    readonly projects: readonly ItemDetailProject[];
}

/** The details of an issue. */
export interface IssueDetail extends ItemDetailBase {
    readonly kind: 'issue';
    readonly parent: LinkedIssue | null;
    readonly subIssues: LinkedIssues;
    readonly blockedBy: LinkedIssues;
    readonly blocking: LinkedIssues;
}

/** The details of a pull request. */
export interface PullRequestDetail extends ItemDetailBase {
    readonly kind: 'pullRequest';
    readonly commitCount: number;
    /** `owner/name` of the repository its branch lives in; `null` when that repository was deleted. */
    readonly headRepository: string | null;
    /** The checks of its head commit, check runs and commit statuses together; empty when nothing runs. */
    readonly checks: readonly ItemCheck[];
    /** How many checks there are; more than {@link checks} holds when GitHub cut the list (100). */
    readonly checkCount: number;
    /** Each reviewer's latest review. */
    readonly reviews: readonly ItemDetailReview[];
    readonly reviewRequests: readonly ItemDetailReviewRequest[];
}

/** A reaction and how many gave it. */
export interface ItemReaction {
    readonly content: ReactionContent;
    readonly count: number;
    readonly viewerHasReacted: boolean;
}

/** The comments read so far: the newest ones, and more older ones each time they are asked for. */
export interface ItemComments {
    readonly totalCount: number;
    /** Oldest first. */
    readonly nodes: readonly ItemComment[];
    /** Where the older ones not read yet start (`MoreComments`); `null` when all are read. */
    readonly olderCursor: string | null;
}

/** A comment. */
export interface ItemComment {
    readonly id: string;
    readonly url: string;
    /** `null` for a deleted account. */
    readonly author: ItemUser | null;
    /** GitHub's own rendering, sanitized by GitHub; empty for a comment on its way. */
    readonly bodyHtml: string;
    readonly createdAt: string;
    readonly lastEditedAt: string | null;
    /**
     * Posted by the user and on its way to GitHub: what they typed, shown at once as text — GitHub renders the
     * markdown once it has it. Never kept (M3 editing).
     */
    readonly pendingBody?: string;
}

/** An issue linked to another — its parent, a sub-issue, one it is blocked by or blocking. */
export interface LinkedIssue {
    readonly id: string;
    readonly url: string;
    readonly number: number;
    readonly title: string;
    /** `owner/name`; may be another repository than the item's. */
    readonly repository: string;
    readonly state: IssueState;
    readonly stateReason: IssueStateReason | null;
}

/** Linked issues: the first ones GitHub lists, and how many there are. */
export interface LinkedIssues {
    readonly totalCount: number;
    readonly nodes: readonly LinkedIssue[];
}

/** How a check ended, or that it has not yet. Neutral and skipped checks hold nothing back. */
export type ItemCheckState = 'passing' | 'failing' | 'pending' | 'skipped';

/** A check run or a commit status of a pull request's head commit. */
export interface ItemCheck {
    readonly id: string;
    readonly kind: 'checkRun' | 'status';
    /** The check run's name, or the status's context. */
    readonly name: string;
    /** The Actions workflow a check run belongs to (GitHub shows "workflow / name"); `null` otherwise. */
    readonly workflow: string | null;
    readonly state: ItemCheckState;
    readonly url: string | null;
    readonly startedAt: string | null;
    /** `null` while it runs, and for a commit status (GitHub keeps only when it was set). */
    readonly completedAt: string | null;
}

/** A reviewer's latest review. */
export interface ItemDetailReview {
    /** `null` for a deleted account. */
    readonly author: ItemUser | null;
    readonly state: PullRequestReviewState;
    readonly submittedAt: string | null;
}

/** A review asked of a user (with their avatar) or of a team. */
export type ItemDetailReviewRequest =
    | { readonly kind: 'user'; readonly user: ItemUser }
    | { readonly kind: 'team'; readonly slug: string; readonly name: string };

/** An item's place in a project, with the project's fields and the item's value of each. */
export interface ItemDetailProject {
    /** The project item's node id — what a field edit addresses. */
    readonly itemId: string;
    readonly projectId: string;
    readonly title: string;
    readonly number: number;
    readonly url: string;
    readonly updatedAt: string;
    /** Whether the viewer may set the item's fields there; a field is edited only where it is (D14). */
    readonly viewerCanUpdate: boolean;
    /**
     * The project's own fields in the project's order. The fields mirroring the issue itself (title, labels,
     * assignees, milestone, …) are left out: their values are the issue's.
     */
    readonly fields: readonly ProjectField[];
    /** The item's value of each field that has one, by field id. */
    readonly values: Readonly<Record<string, ProjectFieldValue>>;
}

/** A project field's definition: its type, and what a value is picked from. */
export type ProjectField =
    | { readonly kind: 'text' | 'number' | 'date'; readonly id: string; readonly name: string }
    | {
          readonly kind: 'singleSelect' | 'multiSelect';
          readonly id: string;
          readonly name: string;
          readonly options: readonly ProjectFieldOption[];
      }
    | {
          readonly kind: 'iteration';
          readonly id: string;
          readonly name: string;
          /** The current and coming iterations. */
          readonly iterations: readonly ProjectIteration[];
          readonly completedIterations: readonly ProjectIteration[];
      };

/** An option of a select field. */
export interface ProjectFieldOption {
    readonly id: string;
    readonly name: string;
    readonly color: ProjectV2SingleSelectFieldOptionColor;
}

/** An iteration of an iteration field. */
export interface ProjectIteration {
    readonly id: string;
    readonly title: string;
    /** ISO date. */
    readonly startDate: string;
    /** In days. */
    readonly duration: number;
}

/** An item's value of a project field. */
export type ProjectFieldValue =
    | { readonly kind: 'text'; readonly text: string }
    | { readonly kind: 'number'; readonly number: number }
    | { readonly kind: 'date'; readonly date: string }
    | {
          readonly kind: 'singleSelect';
          /** `null` for an option deleted since. */
          readonly optionId: string | null;
          readonly name: string | null;
          readonly color: ProjectV2SingleSelectFieldOptionColor;
      }
    | { readonly kind: 'multiSelect'; readonly options: readonly ProjectFieldOption[] }
    | {
          readonly kind: 'iteration';
          readonly iterationId: string;
          readonly title: string;
          readonly startDate: string;
          readonly duration: number;
      };
