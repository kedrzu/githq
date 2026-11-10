import type {
    IssueState,
    IssueStateReason,
    IssueTypeColor,
    LockReason,
    ProjectV2SingleSelectFieldOptionColor,
    PullRequestReviewState,
    ReactionContent,
    StatusState,
} from '@githq/github/generated.gen.js';

import type { Item, ItemLabel, ItemUser } from './ItemTypes.js';

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
    /**
     * The body as the user saved it and GitHub has not answered yet: shown as typed until GitHub's rendering replaces
     * it. Never kept.
     */
    readonly pendingBody?: string;
    /** When the body was last edited; `null` when never. */
    readonly lastEditedAt: string | null;
    /** GitHub lets the viewer edit the body (K1b). */
    readonly viewerCanUpdate: boolean;
    /** Its conversation is locked to collaborators: only they may comment (`getEditPermissions`). */
    readonly locked: boolean;
    /** Only the reactions given, in GitHub's order. */
    readonly reactions: readonly ItemReaction[];
    readonly comments: ItemComments;
    readonly events: ItemEvents;
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
    /** The submitted reviews read so far, every one of each reviewer, oldest first: the newest, and older ones as asked for. */
    readonly reviewSummaries: readonly ItemReviewSummary[];
    /** Where the older ones not read yet start (`MoreReviews`); `null` when all are read. */
    readonly olderReviewCursor: string | null;
    readonly reviewRequests: readonly ItemDetailReviewRequest[];
}

/** A reaction and how many gave it. */
export interface ItemReaction {
    readonly content: ReactionContent;
    readonly count: number;
    readonly viewerHasReacted: boolean;
}

/** The comments read so far: the first two, the newest ones, and more older ones each time they are asked for. */
export interface ItemComments {
    readonly totalCount: number;
    /**
     * The first two of the item's comments, which a thread keeps above its fold (F5), those not among {@link nodes}
     * when read. Older comments read later may hold them too: each shows once (`buildThread`).
     */
    readonly first: readonly ItemComment[];
    /** The newest comments, oldest first. */
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
    /** Markdown, as written — what an edit starts from. */
    readonly body: string;
    /** GitHub's own rendering, sanitized by GitHub; empty for a comment on its way. */
    readonly bodyHtml: string;
    readonly createdAt: string;
    readonly lastEditedAt: string | null;
    /** GitHub lets the viewer edit it (K1b). */
    readonly viewerCanUpdate: boolean;
    /** GitHub lets the viewer delete it (K1b). */
    readonly viewerCanDelete: boolean;
    /**
     * Posted or edited by the user and on its way to GitHub: what they typed, shown at once as text — GitHub renders
     * the markdown once it has it. Never kept (M3 editing).
     */
    readonly pendingBody?: string;
}

/**
 * The events of the item's thread read so far (item-activity F13), comments and reviews apart: the first ones and the
 * newest ones, and the middle once it is asked for (`ThreadMiddle`).
 */
export interface ItemEvents {
    /** How many events the thread has, of the kinds githq reads (`THREAD_EVENT_TYPES`), commits included. */
    readonly totalCount: number;
    /** How many of them are a pull request's commits; `0` for an issue. The rest are the fold's "other events" (F5). */
    readonly commitCount: number;
    /** The oldest events, oldest first, with the events not read yet after them; empty when every event is read. */
    readonly oldest: readonly ThreadEvent[];
    /** The newest events, oldest first. */
    readonly newest: readonly ThreadEvent[];
    /** Where the events not read yet lie, between {@link oldest} and {@link newest}; `null` when every one is read. */
    readonly middle: ItemEventsMiddle | null;
}

/** The cursors around the events of a thread not read yet (`ThreadMiddle`'s `eventsAfter` and `eventsBefore`). */
export interface ItemEventsMiddle {
    /** The last of the oldest events read. */
    readonly after: string;
    /** The first of the newest events read. */
    readonly before: string;
}

/**
 * An event of an item's thread, as GitHub reports it (item-activity F13). `actor` is who did it: `null` for a deleted
 * account, and for a change a project workflow made (`wasAutomated`), which GitHub attributes to the project's owner.
 */
export type ThreadEvent =
    | ThreadCommit
    | ThreadEventOf<'forcePushed', { readonly beforeOid: string | null; readonly afterOid: string | null }>
    | ThreadEventOf<'assigned' | 'unassigned', { readonly assignee: ItemUser | null }>
    | ThreadEventOf<'renamed', { readonly from: string; readonly to: string }>
    | ThreadEventOf<'labeled' | 'unlabeled', { readonly label: ItemLabel }>
    | ThreadEventOf<'milestoned' | 'demilestoned', { readonly milestone: string }>
    | ThreadEventOf<'reviewRequested' | 'reviewRequestRemoved', { readonly reviewer: ItemDetailReviewRequest | null }>
    | ThreadEventOf<
          'reviewDismissed',
          {
              /** Whose review it was; `null` for a deleted account. */
              readonly reviewer: ItemUser | null;
              readonly previousState: PullRequestReviewState;
              readonly message: string | null;
          }
      >
    | ThreadEventOf<'readyForReview' | 'convertedToDraft' | 'reopened' | 'unlocked' | 'pinned' | 'unpinned', object>
    | ThreadEventOf<'baseChanged', { readonly from: string; readonly to: string }>
    | ThreadEventOf<
          'crossReferenced',
          {
              /** The issue or pull request that mentioned this one. */
              readonly source: ThreadRef;
              /** It closes this one once it is merged or closed. */
              readonly willClose: boolean;
          }
      >
    | ThreadEventOf<
          'closed',
          {
              readonly stateReason: IssueStateReason | null;
              /** What closed it: a pull request merged or a commit pushed; `null` when closed by hand. */
              readonly closer: ThreadCloser | null;
              /** The issue it was closed as a duplicate of. */
              readonly duplicateOf: ThreadRef | null;
          }
      >
    | ThreadEventOf<'merged', { readonly commit: ThreadCommitRef | null; readonly into: string }>
    | ThreadEventOf<'headRefDeleted', { readonly branch: string }>
    | ThreadEventOf<'connected' | 'disconnected', { readonly ref: ThreadRef }>
    | ThreadEventOf<
          'referenced',
          {
              /** `null` where the viewer cannot see the commit. */
              readonly commit: (ThreadCommitRef & { readonly messageHeadline: string }) | null;
              /** `owner/name` of the commit's repository. */
              readonly repository: string;
          }
      >
    | ThreadEventOf<
          'subIssueAdded' | 'subIssueRemoved' | 'parentAdded' | 'parentRemoved',
          { readonly issue: ThreadRef | null }
      >
    | ThreadEventOf<'issueTypeChanged', { readonly from: ThreadIssueType | null; readonly to: ThreadIssueType | null }>
    | ThreadEventOf<
          'addedToProject' | 'removedFromProject',
          { readonly project: ThreadProject | null; readonly wasAutomated: boolean }
      >
    | ThreadEventOf<
          'projectStatusChanged',
          {
              readonly project: ThreadProject | null;
              /** The Status option's name before; empty when it had none. */
              readonly from: string;
              /** The Status option's name now; empty when cleared. */
              readonly to: string;
              readonly wasAutomated: boolean;
          }
      >
    | ThreadEventOf<'transferred', { /** `owner/name`; `null` when it is gone. */ readonly from: string | null }>
    | ThreadEventOf<'locked', { readonly reason: LockReason | null }>
    | ThreadEventOf<
          'markedAsDuplicate' | 'unmarkedAsDuplicate',
          { readonly canonical: ThreadRef | null; readonly duplicate: ThreadRef | null }
      >;

/** What every event but a commit has. */
type ThreadEventOf<TKind extends string, TFields extends object> = {
    readonly kind: TKind;
    readonly id: string;
    readonly createdAt: string;
    readonly actor: ItemUser | null;
} & TFields;

/** A commit of a pull request: GitHub reports each, not the push that brought it — the thread model groups them. */
export interface ThreadCommit {
    readonly kind: 'commit';
    readonly id: string;
    /** When it was committed: GitHub keeps no time of the push. */
    readonly createdAt: string;
    /** Its author's GitHub account; `null` when the author's email belongs to none. */
    readonly actor: ItemUser | null;
    /** The author's name as git records it. */
    readonly authorName: string | null;
    readonly abbreviatedOid: string;
    readonly messageHeadline: string;
    /** The commit within the pull request on GitHub. */
    readonly url: string;
    /** Its checks together; `null` when none ran. */
    readonly ci: StatusState | null;
}

/** An issue or a pull request an event points at; may live in another repository. */
export interface ThreadRef {
    readonly kind: 'issue' | 'pullRequest';
    readonly id: string;
    readonly url: string;
    readonly number: number;
    readonly title: string;
    /** `owner/name`. */
    readonly repository: string;
}

/** A commit an event points at. */
export interface ThreadCommitRef {
    readonly abbreviatedOid: string;
    readonly url: string;
}

/** What closed an item. */
export type ThreadCloser =
    | { readonly kind: 'pullRequest'; readonly pullRequest: ThreadRef }
    | ({ readonly kind: 'commit' } & ThreadCommitRef);

/** An issue type. */
export interface ThreadIssueType {
    readonly name: string;
    readonly color: IssueTypeColor;
}

/** A project an event happened in. */
export interface ThreadProject {
    readonly title: string;
    readonly url: string;
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

/** A submitted review as a pull request's conversation shows it. */
export interface ItemReviewSummary {
    readonly id: string;
    readonly url: string;
    /** `null` for a deleted account. */
    readonly author: ItemUser | null;
    readonly state: Exclude<PullRequestReviewState, 'PENDING'>;
    /** GitHub's own rendering, sanitized by GitHub; empty for a review with no text. */
    readonly bodyHtml: string;
    readonly submittedAt: string;
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
