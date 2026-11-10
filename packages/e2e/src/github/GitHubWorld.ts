import type {
    CommitChecksQuery,
    CommitDetailQuery,
    CommitFieldsFragment,
    CommitHistoriesQuery,
    CommitStatesQuery,
    DraftIssueFieldsFragment,
    IssueCommentFieldsFragment,
    IssueDetailFieldsFragment,
    IssueFieldsFragment,
    IssueStateReason,
    IssueTypeColor,
    ItemProjectItemFieldsFragment,
    MergeableState,
    MergeStateStatus,
    ProjectFieldFieldsFragment,
    ProjectItemDetailFieldsFragment,
    ProjectItemFieldResultFieldsFragment,
    ProjectItemPageFieldsFragment,
    ProjectItemRowFieldsFragment,
    PullRequestMergeOptionsQuery,
    ProjectItemValuesFieldsFragment,
    ProjectV2FieldType,
    ProjectV2SingleSelectFieldOptionColor,
    ProjectV2ViewLayout,
    ProjectViewFieldsFragment,
    PullRequestDetailFieldsFragment,
    PullRequestFieldsFragment,
    PullRequestMergeMethod,
    PullRequestReviewDecision,
    PullRequestState,
    RepositoryPermission,
    StatusState,
    TrackingProjectFieldsFragment,
    TrackingRepositoryFieldsFragment,
    TrackingRepositoryPageFieldsFragment,
} from '@githq/github/generated.gen.js';
import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { escapeHtml } from '../utils/escapeHtml.js';
import { etagOf } from '../utils/etagOf.js';

import { answerRepositoryActions } from './answerRepositoryActions.js';
import type {
    GitHubActionsJob,
    GitHubActionsLog,
    GitHubActionsRun,
    GitHubActionsWorkflow,
} from './answerRepositoryActions.js';
import { GitHubPartialAnswer } from './GitHubMock.js';
import type {
    GitHubGraphQLAnswer,
    GitHubMock,
    GitHubOperationData,
    GitHubRestAnswer,
    GitHubSearchHit,
} from './GitHubMock.js';

/** One of the four "my work" searches (D11), named as the app names its groups. */
export type MyWorkSearch = 'reviewRequested' | 'authored' | 'assigned' | 'mentioned';

/** A mutation the world applies to its state, answering with the state it then has. */
export type GitHubWorldMutation =
    | 'AddLabels'
    | 'RemoveLabels'
    | 'AddAssignees'
    | 'RemoveAssignees'
    | 'UpdateIssueMilestone'
    | 'UpdatePullRequestMilestone'
    | 'CloseIssue'
    | 'ReopenIssue'
    | 'ClosePullRequest'
    | 'ReopenPullRequest'
    | 'AddComment'
    | 'AddToProject'
    | 'AddDraftIssue'
    | 'SetProjectFieldValue'
    | 'ClearProjectFieldValue'
    | 'RequestReviews'
    | 'MarkReadyForReview'
    | 'ConvertToDraft'
    | 'UpdatePullRequestBranch'
    | 'EnablePullRequestAutoMerge'
    | 'DisablePullRequestAutoMerge'
    | 'EnqueuePullRequest'
    | 'DequeuePullRequest'
    | 'MergePullRequest'
    | 'DeleteRef'
    | 'CreateRef'
    | 'RevertPullRequest'
    | 'CreateIssue';

const MY_WORK_SEARCHES: readonly MyWorkSearch[] = ['reviewRequested', 'authored', 'assigned', 'mentioned'];

/** The searches' queries as the app sends them (`MY_WORK_SEARCHES` in `packages/app/sync/SyncEngine.ts`). */
const MY_WORK_QUERIES: Readonly<Record<MyWorkSearch, string>> = {
    reviewRequested: 'is:open is:pr review-requested:@me archived:false',
    authored: 'is:open is:pr author:@me archived:false',
    assigned: 'is:open is:issue assignee:@me archived:false',
    mentioned: 'is:open mentions:@me archived:false',
};

/** What an issue and a pull request of the world have in common. */
export interface GitHubWorldItemParams {
    /** `owner/name`. */
    readonly repository: string;
    readonly number: number;
    readonly title: string;
    /** Who opened it; the viewer by default. */
    readonly author?: string;
    /**
     * The "my work" searches that find it; none by default — an item only a tracked repository or project brings.
     */
    readonly foundBy?: readonly MyWorkSearch[];
    /** How long ago it last changed — what "my work" sorts by, newest first. */
    readonly minutesAgo: number;
    /** The names of its labels, of its repository's ({@link GitHubWorldRepositoryParams.labels}). */
    readonly labels?: readonly string[];
    /** Its milestone's title, of its repository's ({@link GitHubWorldRepositoryParams.milestones}); none by default. */
    readonly milestone?: string;
    /** Closed (completed) rather than open. */
    readonly closed?: boolean;
    /** The projects it is in ({@link GitHubWorld.project}), and its "Status" in each. */
    readonly projects?: readonly GitHubWorldPlacement[];
    /** Its description as GitHub renders it (`bodyHTML`); none by default. */
    readonly bodyHtml?: string;
}

/** An item's place in a project of the world. */
export interface GitHubWorldPlacement {
    /** The project's id, as {@link GitHubWorld.project} returned it. */
    readonly project: string;
    /** Its "Status" option by name (`Todo`, `In Progress`, `Done`); none by default. */
    readonly status?: GitHubWorldStatus;
    /** Archived in the project: GitHub still lists it there, marked archived. */
    readonly archived?: boolean;
}

/** A comment on an item of the world ({@link GitHubWorld.comment}). */
export interface GitHubWorldCommentParams {
    readonly author: string;
    readonly body: string;
    readonly minutesAgo: number;
}

/** A submitted review of a pull request of the world ({@link GitHubWorld.review}). */
export interface GitHubWorldReviewParams {
    /** Its node id, which a thread's first comment names to be the review's. */
    readonly id: string;
    readonly author: string;
    readonly state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED';
    /** Its text as GitHub renders it (`bodyHTML`); none by default. */
    readonly bodyHtml?: string;
    readonly minutesAgo: number;
}

/** An issue of the world; assigned to the viewer when "assigned" finds it. */
export interface GitHubWorldIssueParams extends GitHubWorldItemParams {
    /** Its issue type; none by default. */
    readonly issueType?: GitHubWorldIssueType;
}

/** The issue types of every repository of the world. */
export type GitHubWorldIssueType = 'Bug' | 'Feature' | 'Task';

/** A review the viewer started and hasn't submitted. */
export interface GitHubWorldPendingReview {
    readonly comments: number;
    readonly minutesAgo: number;
}

/** An open pull request of the world, and where it stands. */
export interface GitHubWorldPullRequestParams extends GitHubWorldItemParams {
    /** Node ids of the issues it closes. */
    readonly closes?: readonly string[];
    readonly isDraft?: boolean;
    /** `REVIEW_REQUIRED` — waiting for a review — by default. */
    readonly reviewDecision?: PullRequestReviewDecision | null;
    /** How many of its 5 checks fail; none by default. */
    readonly failingChecks?: number;
    /** It conflicts with its base branch. */
    readonly conflicts?: boolean;
    /**
     * Its failing checks that GitHub Actions ran, by their workflow runs' ids; listed by the merge options, none by
     * default — the failing ones then only count on the row, as a count gone stale does.
     */
    readonly failedRuns?: readonly number[];
    /** Its failing checks from outside GitHub Actions, by name; listed by the merge options, none by default. */
    readonly failedOutsideActions?: readonly string[];
    /** Whose review it asks for (logins). */
    readonly reviewRequests?: readonly string[];
    /**
     * Its base branch moved on since it was last rebased (`baseRefOid` is not the base's tip): `BEHIND` when its
     * repository requires branches to be up to date ({@link GitHubWorldRepositoryParams.requiresUpToDate}).
     */
    readonly behindBase?: boolean;
    /**
     * The commit texts GitHub proposes to the viewer for a merge commit and a squash (`viewerMergeHeadlineText`,
     * `viewerMergeBodyText`); GitHub's usual ones by default — for a merge commit "Merge pull request #N from
     * owner/branch" over its title, for a squash its title with "(#N)" over no message.
     */
    readonly proposedTexts?: Partial<Record<GitHubWorldCommitMethod, GitHubWorldCommitText>>;
}

/** The merge methods that make a commit of their own, with a text GitHub proposes for it. */
export type GitHubWorldCommitMethod = Exclude<PullRequestMergeMethod, 'REBASE'>;

/** A commit's title and message. */
export interface GitHubWorldCommitText {
    readonly title: string;
    readonly body: string;
}

/** A stack of open pull requests of the world, as GitHub links them: in one repository, each on the one below. */
export interface GitHubWorldStackParams {
    /** `owner/name`. */
    readonly repository: string;
    /** Its number in the repository. */
    readonly number: number;
    /** Its pull requests, bottom first: the first is based on `main`, each other on the head of the one before. */
    readonly pullRequests: readonly Omit<GitHubWorldPullRequestParams, 'repository'>[];
}

/** A repository of the world: what the viewer may do there, and what its pickers offer. */
export interface GitHubWorldRepositoryParams {
    /** `WRITE` by default. */
    readonly viewerPermission?: RepositoryPermission;
    /** `bug`, `enhancement` and `documentation` by default. */
    readonly labels?: readonly GitHubWorldLabel[];
    /** Open milestones by title; `v1.0` by default. */
    readonly milestones?: readonly string[];
    /** Who may be assigned or asked for a review besides the viewer; `monalisa` and `hubot` by default. */
    readonly users?: readonly string[];
    /** What its page says it is about, which the repository search finds too; none by default. */
    readonly description?: string;
    /** Public by default. */
    readonly isPrivate?: boolean;
    /** Archived: read-only, it takes no issue. */
    readonly isArchived?: boolean;
    /** Issues turned off in its settings. */
    readonly issuesDisabled?: boolean;
    /** Its issue templates and forms; none (blank issues allowed) by default. */
    readonly templates?: GitHubWorldTemplates;
    /** The merge methods its settings allow; all three by default. */
    readonly mergeMethods?: readonly PullRequestMergeMethod[];
    /** The method its merges start on for the viewer (`viewerDefaultMergeMethod`); `MERGE` by default. */
    readonly defaultMergeMethod?: PullRequestMergeMethod;
    /**
     * The merge methods a ruleset on its base branch allows (a pull request rule's `allowedMergeMethods`); no
     * ruleset by default. Only the merge panel's read (`PullRequestMergeOptions`) sees it, as on GitHub.
     */
    readonly rulesetMergeMethods?: readonly PullRequestMergeMethod[];
    /** Its base branch requires branches to be up to date before merging: one behind it reads `BEHIND`. */
    readonly requiresUpToDate?: boolean;
    /** What GitHub calls its default branch; `main` by default. */
    readonly defaultBranch?: string;
    /**
     * Its default branch has a merge queue, merging with this method (`isMergeQueueEnabled`, a ruleset's
     * `mergeMethod`); none by default.
     */
    readonly mergeQueueMethod?: PullRequestMergeMethod;
    /** Auto-merge allowed in its settings (`autoMergeAllowed`), and the viewer may turn it on: as on GitHub, in a stack too. */
    readonly autoMergeAllowed?: boolean;
    /** The viewer may merge past the rules (`viewerCanMergeAsAdmin`). */
    readonly viewerCanMergeAsAdmin?: boolean;
    /** GitHub deletes a pull request's branch once merged (`deleteBranchOnMerge`). */
    readonly deleteBranchOnMerge?: boolean;
    /** The addresses the viewer may commit a merge with, their default first; none by default. */
    readonly commitEmails?: readonly string[];
}

/** A commit of a repository's history (git-client D8), and what GitHub tells of it apart: its pull request and CI. */
export interface GitHubWorldCommitParams {
    /** Its id, any unique string; its node id is `C_<oid>`. */
    readonly oid: string;
    readonly headline: string;
    /** Its message below the headline; none by default. */
    readonly body?: string;
    /** Its author's login. */
    readonly author: string;
    readonly minutesAgo: number;
    /** Oids of its parents, the first the branch it was made on; none for a root commit. */
    readonly parents?: readonly string[];
    /** The pull request it came from; none by default. */
    readonly pullRequest?: { readonly number: number; readonly state: PullRequestState; readonly title: string };
    /** Its checks' rollup; none by default. */
    readonly ci?: StatusState;
    /** The GitHub Actions runs that failed among its checks, listed once it has a rollup; none by default. */
    readonly failedRuns?: readonly number[];
}

/** A repository's history: its commits, and the branches and tags pointing at them, by name. */
export interface GitHubWorldHistoryParams {
    readonly commits: readonly GitHubWorldCommitParams[];
    /** Branch name → the oid it points at; the repository's default branch among them. */
    readonly branches: Readonly<Record<string, string>>;
    /** Tag name → the oid it points at. */
    readonly tags?: Readonly<Record<string, string>>;
}

/** What a repository of the world asks a new issue to start from. */
export interface GitHubWorldTemplates {
    /** `true` by default. */
    readonly blankIssuesEnabled?: boolean;
    /** Markdown templates, as `issueTemplates` lists them. */
    readonly markdown?: readonly GitHubWorldMarkdownTemplate[];
    /** Issue forms: the YAML files of `.github/ISSUE_TEMPLATE`, by file name. */
    readonly forms?: Readonly<Record<string, string>>;
}

/** A markdown issue template. */
export interface GitHubWorldMarkdownTemplate {
    readonly filename: string;
    readonly name: string;
    readonly title?: string;
    readonly body: string;
    readonly labels?: readonly string[];
}

/** A GitHub Actions workflow of a repository ({@link GitHubWorld.workflow}). */
export interface GitHubWorldWorkflowParams {
    /** `owner/name`. */
    readonly repository: string;
    /** `Deploy`. */
    readonly name: string;
    /** `active` by default; `disabled_manually` for one turned off. */
    readonly state?: string;
    readonly runs?: readonly GitHubWorldRunParams[];
}

/** A run of a workflow ({@link GitHubWorld.workflow}, {@link GitHubWorld.workflowRun}). */
export interface GitHubWorldRunParams {
    /** `success`, `failure`, `cancelled`, …; `null` while it runs. */
    readonly conclusion: string | null;
    /** How long ago it was created. */
    readonly minutesAgo: number;
    /** The branch or tag it ran on; the repository's default branch by default. */
    readonly branch?: string;
    /** What started it: `push` by default, `pull_request`, `schedule`, … */
    readonly event?: string;
}

/** A job of a run ({@link GitHubWorld.runJobs}). */
export interface GitHubWorldJobParams {
    readonly name: string;
    /** `success`, `failure`, …; `null` while it runs. */
    readonly conclusion: string | null;
    /** With no conclusion: `queued`, `waiting`, …; `in_progress` by default. */
    readonly status?: string;
    /** Its steps, numbered in order and a second apart; a job without any by default. */
    readonly steps?: readonly GitHubWorldStepParams[];
}

/** A step of a job ({@link GitHubWorldJobParams}). */
export interface GitHubWorldStepParams {
    readonly name: string;
    /** `success`, `failure`, `skipped`, …; `null` while it runs. */
    readonly conclusion: string | null;
}

/** A label of a repository: its name and colour (hex without `#`). */
export interface GitHubWorldLabel {
    readonly name: string;
    readonly color: string;
}

/**
 * A project of the world; every one has a single-select "Status" of {@link GitHubWorldStatus}, besides GitHub's own
 * fields ({@link GitHubWorldProjectFieldName}).
 */
export interface GitHubWorldProjectParams {
    readonly title: string;
    readonly number: number;
    /**
     * Its owner's login: the viewer by default. An organisation's — declared first ({@link GitHubWorld.organization})
     * — is polled at `/orgs/…`, a user's at `/users/…`.
     */
    readonly owner?: string;
    /** Its saved views, in GitHub's order; one table, "View 1", by default. */
    readonly views?: readonly GitHubWorldViewParams[];
}

/** A field of every project of the world, by name: GitHub's own ones and "Status". */
export type GitHubWorldProjectFieldName = 'Assignees' | 'Labels' | 'Milestone' | 'Repository' | 'Status' | 'Title';

/** A saved view of a project of the world. */
export interface GitHubWorldViewParams {
    readonly name: string;
    /** `TABLE_LAYOUT` by default; a board's columns are its "Status". */
    readonly layout?: ProjectV2ViewLayout;
    /** Its filter in GitHub's syntax; none by default. */
    readonly filter?: string;
    /** The field a table groups by; none by default. */
    readonly groupBy?: GitHubWorldProjectFieldName;
}

/** A draft issue of a project of the world ({@link GitHubWorld.draft}). */
export interface GitHubWorldDraftParams {
    /** The project's id, as {@link GitHubWorld.project} returned it. */
    readonly project: string;
    readonly title: string;
    readonly status?: GitHubWorldStatus;
    readonly minutesAgo: number;
}

/** A draft issue as it is on GitHub now ({@link GitHubWorld.draftsOf}). */
export interface GitHubWorldDraftState {
    readonly title: string;
    readonly status: GitHubWorldStatus | null;
}

/** The options of a project's "Status". */
export type GitHubWorldStatus = 'Todo' | 'In Progress' | 'Done';

/** How GitHub fails a mutation of one item ({@link GitHubWorld.failEdit}). */
export type GitHubWorldFailure =
    /** It answers with a GraphQL error naming `message`, changing nothing. */
    | { readonly kind: 'refuse'; readonly message: string }
    /** It answers as if done, without the change — as it does for a user without push access (D14). */
    | { readonly kind: 'drop' };

/** A mutation as the world received it. */
export interface GitHubWorldEdit {
    readonly mutation: GitHubWorldMutation;
    /** The node id of the issue, pull request or draft issue it changes; the project's for `AddDraftIssue`. */
    readonly itemId: string;
}

/** What an item of the world is now, for a test to check what the app's edits did on GitHub. */
export interface GitHubWorldItemState {
    readonly state: 'CLOSED' | 'OPEN';
    readonly stateReason: IssueStateReason | null;
    readonly isDraft: boolean;
    readonly labels: readonly string[];
    readonly assignees: readonly string[];
    readonly milestone: string | null;
    /** The bodies of its comments, oldest first. */
    readonly comments: readonly string[];
    /** Whose review a pull request asks for (logins). */
    readonly reviewRequests: readonly string[];
    /** A pull request was merged. */
    readonly merged: boolean;
    /** Its "Status" in each project it is in, by the project's title; `null` when empty. */
    readonly projects: Readonly<Record<string, GitHubWorldStatus | null>>;
}

interface WorldRepository {
    readonly nameWithOwner: string;
    viewerPermission: RepositoryPermission;
    labels: readonly GitHubWorldLabel[];
    milestones: readonly string[];
    users: readonly string[];
    description: string | null;
    isPrivate: boolean;
    isArchived: boolean;
    issuesDisabled: boolean;
    templates: GitHubWorldTemplates;
    mergeMethods: readonly PullRequestMergeMethod[];
    defaultMergeMethod: PullRequestMergeMethod;
    rulesetMergeMethods: readonly PullRequestMergeMethod[] | null;
    requiresUpToDate: boolean;
    defaultBranch: string;
    mergeQueueMethod: PullRequestMergeMethod | null;
    /** Its merge queue, the next to merge first; a pull request's position is its place here. */
    readonly queue: WorldStackEntry[];
    autoMergeAllowed: boolean;
    viewerCanMergeAsAdmin: boolean;
    deleteBranchOnMerge: boolean;
    commitEmails: readonly string[];
    workflows: GitHubActionsWorkflow[];
    runs: GitHubActionsRun[];
    /** The names of the tags a run may be on, as its REST answers them. */
    tagNames: string[];
    jobs: Map<number, readonly GitHubActionsJob[]>;
    logs: Map<number, GitHubActionsLog>;
    /** What re-running a run's failed jobs answers instead of starting them ({@link GitHubWorld.refuseRerun}). */
    rerunRefusal: GitHubRestAnswer | null;
    /** Its commits by oid; none for an empty repository. */
    commits: ReadonlyMap<string, WorldCommit>;
    branches: Readonly<Record<string, string>>;
    tags: Readonly<Record<string, string>>;
}

interface WorldCommit extends GitHubWorldCommitParams {
    readonly committedDate: string;
}

interface WorldProject {
    readonly id: string;
    readonly title: string;
    readonly number: number;
    readonly owner: string;
    readonly ownerKind: 'org' | 'user';
    readonly views: readonly GitHubWorldViewParams[];
    /** Its items in GitHub's order, archived ones included. */
    readonly places: WorldProjectItem[];
}

interface WorldProjectItem {
    readonly id: string;
    readonly project: WorldProject;
    /** The issue or pull request it holds, or its draft issue. */
    readonly content: WorldItem | WorldDraft;
    status: GitHubWorldStatus | null;
    updatedAt: string;
    archived: boolean;
}

interface WorldDraft {
    readonly kind: 'draft';
    readonly id: string;
    readonly title: string;
    readonly createdAt: string;
    updatedAt: string;
}

interface WorldComment {
    readonly id: string;
    readonly author: string;
    readonly body: string;
    readonly createdAt: string;
}

interface WorldPullRequest {
    /** Its branch was deleted (`headRef` reads `null`). */
    branchDeleted: boolean;
    readonly failedRuns: readonly number[];
    readonly failedOutsideActions: readonly string[];
    isDraft: boolean;
    reviewDecision: PullRequestReviewDecision | null;
    readonly failingChecks: number;
    readonly conflicts: boolean;
    reviewRequests: string[];
    readonly reviews: GitHubWorldReviewParams[];
    pendingReview: GitHubWorldPendingReview | null;
    readonly closes: readonly string[];
    behindBase: boolean;
    /**
     * An update of its branch GitHub accepted but has not made yet: as on GitHub, the pull request still reads the old
     * head, its mergeability `UNKNOWN`, until the update lands — after the next read of the merge panel.
     */
    updatingBranch: boolean;
    /** The last commit pushed to its branch since the test began ({@link GitHubWorld.push}); `null` for none. */
    pushed: WorldPushedCommit | null;
    /** Its place in a stack; `null` for a pull request in none. */
    readonly stack: WorldStackPlace | null;
    /**
     * In a stack, above its first: the head of the pull request below it — its base — as it was when this one was
     * last rebased on it; `null` for one based on the default branch. A push to the one below leaves it behind, as on
     * GitHub, until the stack is rebased.
     */
    rebasedOn: string | null;
    readonly proposedTexts: Partial<Record<GitHubWorldCommitMethod, GitHubWorldCommitText>>;
    /** Merged: its item is closed too, as GitHub's `state` then reads `MERGED`. */
    merged: boolean;
    /** Who put it in its repository's merge queue, and how; `null` outside it. */
    queued: WorldQueueEntry | null;
    /** The auto-merge turned on for it; `null` for none. */
    autoMerge: WorldAutoMerge | null;
}

/** What a pull request's entry in a merge queue holds besides its place. */
interface WorldQueueEntry {
    readonly enqueuedAt: string;
}

/** Auto-merge turned on, with what it will merge with. */
interface WorldAutoMerge {
    readonly mergeMethod: PullRequestMergeMethod;
    readonly commitHeadline: string | null;
    readonly commitBody: string | null;
    readonly enabledAt: string;
}

/** A commit pushed to a pull request's branch. */
interface WorldPushedCommit {
    readonly oid: string;
    readonly headline: string;
    readonly author: string;
}

/** A merge GitHub accepted ({@link GitHubWorld.holdMerges}), by the `uuid` it is followed by. */
interface WorldMerge {
    /**
     * The pull requests it lands, in order — the one it was sent to last: one alone, or in a stack every open one
     * from the lowest up to it (stacked PRs D11).
     */
    readonly landing: readonly WorldStackEntry[];
    readonly uuid: string;
    /** GitHub puts it in the merge queue rather than merging it: it lands nothing here. */
    readonly enqueues: boolean;
    /** What GitHub said refusing it while it ran ({@link GitHubWorld.refuseHeldMerges}); `null` while it may merge. */
    refusal: string | null;
}

/** A stack of pull requests, bottom first. */
interface WorldStack {
    readonly id: string;
    readonly number: number;
    readonly entries: WorldStackEntry[];
}

interface WorldStackEntry {
    readonly item: WorldItem;
    readonly pullRequest: WorldPullRequest;
}

/** A pull request's place in its stack. */
interface WorldStackPlace {
    readonly stack: WorldStack;
    /** 1 for the bottom one. */
    readonly position: number;
}

interface WorldItem {
    readonly kind: 'item';
    readonly id: string;
    readonly repository: string;
    readonly number: number;
    title: string;
    readonly author: string;
    readonly createdAt: string;
    updatedAt: string;
    state: 'CLOSED' | 'OPEN';
    stateReason: IssueStateReason | null;
    closedAt: string | null;
    labels: string[];
    assignees: string[];
    milestone: string | null;
    comments: WorldComment[];
    projectItems: WorldProjectItem[];
    /** Its pull request's own state; `null` for an issue. */
    readonly pullRequest: WorldPullRequest | null;
    readonly issueType: GitHubWorldIssueType | null;
    readonly bodyHtml: string;
    readonly foundBy: Set<MyWorkSearch>;
    /** Deleted on GitHub, while the search index still lists it. */
    deleted: boolean;
}

/** What one mutation does to an item, and what GitHub answers it with. */
interface WorldMutationHandler<TName extends GitHubWorldMutation> {
    /** The item it changes, from its variables; `undefined` when they name none of the world's. */
    readonly findItem: (variables: Readonly<Record<string, unknown>>) => WorldItem | undefined;
    /** Changes the item as GitHub would; not called for a change GitHub drops. */
    readonly apply: (item: WorldItem, variables: Readonly<Record<string, unknown>>) => void;
    /** GitHub's answer: the item as it is now. */
    readonly answer: (item: WorldItem, variables: Readonly<Record<string, unknown>>) => GitHubOperationData<TName>;
    /** What GitHub says refusing the mutation for what the item is (`UNPROCESSABLE`); `null` when it takes it. */
    readonly refuse?: (item: WorldItem, variables: Readonly<Record<string, unknown>>) => string | null;
    /** The answer's data when it fails with an error: its field `null`. */
    readonly refused: GitHubOperationData<TName>;
    /** The change doesn't move the item's `updatedAt` on GitHub. */
    readonly keepsUpdatedAt?: boolean;
}

/** How many checks a pull request of the world runs. */
const CHECK_COUNT = 5;
/** The tip of every base branch of the world; each pull request is up to date with it but those behind it. */
const BASE_OID = '0000000000000000000000000000000000000001';
/** Where a pull request behind its base branch was last rebased on. */
const STALE_BASE_OID = '0000000000000000000000000000000000000002';
/** The commit a merge of the world makes on the base branch. */
const MERGE_COMMIT_OID = '0000000000000000000000000000000000000003';
/** What GitHub says refusing a mutation that names a head the branch has moved on from. */
const HEAD_MOVED = 'Head branch was modified. Review and try the merge again.';
/** A connection the world answers whole: no page after it. */
const LAST_PAGE = { hasNextPage: false, endCursor: null };
/** The comments an opened item reads at once (`commentPage: comments(last: 50)`), and per older page. */
const COMMENT_PAGE = 50;
const OLDER_COMMENT_PAGE = 100;
const REVIEW_PAGE = 100;

const DEFAULT_LABELS: readonly GitHubWorldLabel[] = [
    { name: 'bug', color: 'd73a4a' },
    { name: 'documentation', color: '0075ca' },
    { name: 'enhancement', color: 'a2eeef' },
];

const STATUS_OPTIONS: readonly { name: GitHubWorldStatus; color: ProjectV2SingleSelectFieldOptionColor }[] = [
    { name: 'Todo', color: 'GRAY' },
    { name: 'In Progress', color: 'YELLOW' },
    { name: 'Done', color: 'GREEN' },
];

const ISSUE_TYPE_COLORS: Readonly<Record<GitHubWorldIssueType, IssueTypeColor>> = {
    Bug: 'RED',
    Feature: 'BLUE',
    Task: 'YELLOW',
};

/** The fields of every project, in GitHub's order, with their types. */
const PROJECT_FIELDS: readonly { name: GitHubWorldProjectFieldName; dataType: ProjectV2FieldType }[] = [
    { name: 'Title', dataType: 'TITLE' },
    { name: 'Assignees', dataType: 'ASSIGNEES' },
    { name: 'Status', dataType: 'SINGLE_SELECT' },
    { name: 'Labels', dataType: 'LABELS' },
    { name: 'Repository', dataType: 'REPOSITORY' },
    { name: 'Milestone', dataType: 'MILESTONE' },
];

/** The fields a saved view of the world shows. */
const VIEW_FIELDS: readonly GitHubWorldProjectFieldName[] = ['Title', 'Assignees', 'Status'];

/** How many issues a page of `RepositoryIssues` holds (`issues(first: 100)`); a pull request's page says its own. */
const ISSUE_PAGE = 100;

/** How many items `ProjectFull` reads with the project. */
const PROJECT_FIRST_PAGE = 100;

/**
 * A small GitHub for the e2e tests: repositories with issues and pull requests, some found by the four "my work"
 * searches, the viewer's organisations, and projects with a "Status", saved views and draft issues.
 * {@link install} makes a {@link GitHubMock} answer from it, with the shapes of the generated SDK: the searches by
 * their query; `ItemsByIds`, `PullRequestStatuses`, `PullRequestPendingReviews`, `PullRequestStacks` (its {@link stack}s), `ItemDetails`,
 * `ItemDetail`, `MoreComments` and `PullRequestMergeOptions` by node id (the check list and the reviews left
 * out, no rules on a base branch); `ItemByNumber`;
 * `RepositoryMetadata`; `RepositoryBrowseSearch`; `ViewerProjects` (every project of the world is the viewer's).
 *
 * It answers tracking as GitHub does: what the tracking screens offer (the viewer's repositories and projects,
 * their organisations' — one hiding its private data left out with an error), a lookup by name, a tracked
 * repository's download or a browsed one's pages (`RepositoryIssues`, `RepositoryPullRequests`, by `first` and `after`,
 * a repository found by its name in any case) and its change list
 * (`GET /repos/{o}/{r}/issues?since=`), a tracked project's download and re-reads (`ProjectFull`,
 * `ProjectSchema`, `ProjectItems` — `updated:>=` by day, any other query matched against the titles, as GitHub
 * answers a saved view's free text) and its change signal (`GET /users|orgs/{o}/projectsV2/{n}`). Both REST
 * answers carry an ETag that is a hash of what they say, answered `304` while it is the one the app sent back. A
 * repository's GitHub Actions are answered the same way: none until a test gives it workflows ({@link workflow}).
 *
 * It answers the app's edits as GitHub does: each mutation changes the world and answers with the state it
 * then has — unless the test said GitHub fails it ({@link failEdit}). {@link holdEdits} keeps their answers
 * back, to see an edit before GitHub confirms it; {@link edits} lists what the app sent, {@link stateOf} what an
 * item is now. It merges pull requests as GitHub's asynchronous merge does (`PUT …/pulls/{n}/merge-async`, then
 * `GET …/merge-async/{uuid}`): refused at once when the head commit named is not the pull request's
 * ({@link headOf}) or the test said so ({@link refuseMerge}), else accepted — and kept pending while
 * {@link holdMerges} holds. A merge of a stacked pull request lands every open one below it too, each its own
 * commit, and is refused while one of them sits on an old head of the one below it (a {@link push} to it). And it can change while the app runs ({@link retitle}, {@link setStatus}, {@link leave},
 * {@link delete}, {@link push}), as GitHub does between two polls.
 */
export class GitHubWorld {
    private readonly items = new Map<string, WorldItem>();
    private readonly repositories = new Map<string, WorldRepository>();
    private readonly projects = new Map<string, WorldProject>();
    private readonly stacks = new Map<string, WorldStack>();
    private readonly organizations = new Set<string>();
    private readonly heldSearches = new Map<MyWorkSearch, Promise<void>>();
    private readonly failures = new Map<string, GitHubWorldFailure>();
    private readonly received: GitHubWorldEdit[] = [];
    private heldEdits: Promise<void> | null = null;
    private readonly mergeRefusals = new Map<string, string>();
    /** The merges GitHub accepted, by their `uuid`. */
    private readonly merges = new Map<string, WorldMerge>();
    /** Whether merges GitHub accepts stay pending ({@link holdMerges}). */
    private mergesHeld = false;
    private nextWorkflowId = 1;
    private nextJobId = 1;
    private nextRunId = 1;
    /** The mock it answers for, once installed: a repository or project added later is answered too. */
    private github: GitHubMock | null = null;

    /** @param viewer The signed-in user's login: the author of their own items, the assignee of theirs. */
    constructor(readonly viewer: string) {}

    /** The mutations the app sent, oldest first — those held back and those failed included. */
    get edits(): readonly GitHubWorldEdit[] {
        return this.received;
    }

    /** Sets up the repository `nameWithOwner` (`owner/name`), or changes it; items create theirs as needed. */
    repository(nameWithOwner: string, params: GitHubWorldRepositoryParams = {}): void {
        const repository = this.getRepository(nameWithOwner);
        repository.viewerPermission = params.viewerPermission ?? repository.viewerPermission;
        repository.labels = params.labels ?? repository.labels;
        repository.milestones = params.milestones ?? repository.milestones;
        repository.users = params.users ?? repository.users;
        repository.description = params.description ?? repository.description;
        repository.isPrivate = params.isPrivate ?? repository.isPrivate;
        repository.isArchived = params.isArchived ?? repository.isArchived;
        repository.issuesDisabled = params.issuesDisabled ?? repository.issuesDisabled;
        repository.templates = params.templates ?? repository.templates;
        repository.mergeMethods = params.mergeMethods ?? repository.mergeMethods;
        repository.defaultMergeMethod = params.defaultMergeMethod ?? repository.defaultMergeMethod;
        repository.rulesetMergeMethods = params.rulesetMergeMethods ?? repository.rulesetMergeMethods;
        repository.requiresUpToDate = params.requiresUpToDate ?? repository.requiresUpToDate;
        repository.defaultBranch = params.defaultBranch ?? repository.defaultBranch;
        repository.mergeQueueMethod = params.mergeQueueMethod ?? repository.mergeQueueMethod;
        repository.autoMergeAllowed = params.autoMergeAllowed ?? repository.autoMergeAllowed;
        repository.viewerCanMergeAsAdmin = params.viewerCanMergeAsAdmin ?? repository.viewerCanMergeAsAdmin;
        repository.deleteBranchOnMerge = params.deleteBranchOnMerge ?? repository.deleteBranchOnMerge;
        repository.commitEmails = params.commitEmails ?? repository.commitEmails;
    }

    /**
     * Gives the repository a GitHub Actions workflow with its runs — a broken one when its latest run on the default
     * branch failed — or, for a workflow it has by that name, adds the runs. Returns the workflow's id.
     */
    workflow(params: GitHubWorldWorkflowParams): number {
        const repository = this.getRepository(params.repository);
        let workflow = repository.workflows.find(candidate => candidate.name === params.name);
        if (!workflow) {
            workflow = { id: this.nextWorkflowId++, name: params.name, state: params.state ?? 'active' };
            repository.workflows.push(workflow);
        }

        for (const run of params.runs ?? []) {
            this.workflowRun(params.repository, params.name, run);
        }

        return workflow.id;
    }

    /** A run of the repository's workflow `name`, as GitHub records one between two polls. Returns the run's id. */
    workflowRun(nameWithOwner: string, name: string, run: GitHubWorldRunParams): number {
        const repository = this.getRepository(nameWithOwner);
        const workflow = repository.workflows.find(candidate => candidate.name === name);
        if (!workflow) {
            throw new Error(`No workflow ${name} in ${nameWithOwner}`);
        }

        const id = this.nextRunId++;
        repository.runs.push({
            id,
            workflowId: workflow.id,
            headBranch: run.branch ?? repository.defaultBranch,
            event: run.event ?? 'push',
            status: run.conclusion === null ? 'in_progress' : 'completed',
            conclusion: run.conclusion,
            createdAt: new Date(Date.now() - run.minutesAgo * 60_000).toISOString(),
        });
        return id;
    }

    /** The run finishes, as GitHub records it between two reads. */
    finishRun(nameWithOwner: string, runId: number, conclusion: string): void {
        const { runs } = this.getRepository(nameWithOwner);
        const index = runs.findIndex(candidate => candidate.id === runId);
        const run = runs[index];
        if (!run) {
            throw new Error(`No run ${runId} in ${nameWithOwner}`);
        }

        runs[index] = { ...run, status: 'completed', conclusion };
    }

    /**
     * Gives a run of the repository these jobs, in place of those it had; a run without any answers an empty list.
     * Returns the jobs' ids, for {@link jobLog}.
     */
    runJobs(nameWithOwner: string, runId: number, jobs: readonly GitHubWorldJobParams[]): readonly number[] {
        const repository = this.getRepository(nameWithOwner);
        const run = repository.runs.find(candidate => candidate.id === runId);
        if (!run) {
            throw new Error(`No run ${runId} in ${nameWithOwner}`);
        }

        const started = Date.parse(run.createdAt);
        const answered = jobs.map(job => this.toActionsJob(job, started));
        repository.jobs.set(runId, answered);
        return answered.map(job => job.id);
    }

    /** Re-running the repository's runs' failed jobs is refused from now on: GitHub's status and its words. */
    refuseRerun(nameWithOwner: string, status: number, message: string): void {
        this.getRepository(nameWithOwner).rerunRefusal = { status, json: { message } };
    }

    /** A job of the run finishes, as GitHub records it between two reads, keeping its id. */
    finishJob(nameWithOwner: string, runId: number, jobId: number, conclusion: string): void {
        const { jobs } = this.getRepository(nameWithOwner);
        jobs.set(
            runId,
            (jobs.get(runId) ?? []).map(job =>
                job.id === jobId ? { ...job, status: 'completed', conclusion, completedAt: job.startedAt } : job,
            ),
        );
    }

    /**
     * A log with lines in the job's steps, by step number: each at the second its step started, and a step's first line
     * the `##[group]Run` of its name for a run step, which is what tells a step from the one before it in that second.
     */
    jobLogBySteps(
        nameWithOwner: string,
        runId: number,
        jobId: number,
        byStep: Readonly<Record<number, readonly string[]>>,
    ): void {
        const job = this.getRepository(nameWithOwner)
            .jobs.get(runId)
            ?.find(candidate => candidate.id === jobId);
        if (!job) {
            throw new Error(`No job ${jobId} in run ${runId}`);
        }

        const lines = job.steps.flatMap(step => {
            const texts = byStep[step.number] ?? [];
            return (step.name.startsWith('Run ') ? [`##[group]${step.name}`, ...texts] : texts).map(
                text => `${step.startedAt} ${text}`,
            );
        });
        this.jobLog(nameWithOwner, jobId, lines.join('\n'));
    }

    /** What the job's log answers: its text, plain as GitHub keeps it, or an error status (410 past retention, 502). */
    jobLog(nameWithOwner: string, jobId: number, log: GitHubActionsLog): void {
        this.getRepository(nameWithOwner).logs.set(jobId, log);
    }

    private toActionsJob(job: GitHubWorldJobParams, started: number): GitHubActionsJob {
        const steps = job.steps ?? [];
        return {
            id: this.nextJobId++,
            name: job.name,
            status: job.conclusion === null ? (job.status ?? 'in_progress') : 'completed',
            conclusion: job.conclusion,
            startedAt: toWholeSecond(started),
            completedAt: job.conclusion === null ? null : toWholeSecond(started + steps.length * 1000),
            steps: steps.map((step, index) => ({
                name: step.name,
                number: index + 1,
                status: step.conclusion === null ? 'in_progress' : 'completed',
                conclusion: step.conclusion,
                startedAt: toWholeSecond(started + index * 1000),
                completedAt: step.conclusion === null ? null : toWholeSecond(started + (index + 1) * 1000),
            })),
        };
    }

    /** Gives the repository a tag, so a run on a ref of that name is on the tag. */
    tag(nameWithOwner: string, name: string): void {
        this.getRepository(nameWithOwner).tagNames.push(name);
    }

    /** Gives the repository its history (git-client D9): its commits, branches and tags, replacing any before. */
    history(nameWithOwner: string, params: GitHubWorldHistoryParams): void {
        const repository = this.getRepository(nameWithOwner);
        repository.commits = new Map(
            params.commits.map(commit => [
                commit.oid,
                { ...commit, committedDate: new Date(Date.now() - commit.minutesAgo * 60_000).toISOString() },
            ]),
        );
        repository.branches = params.branches;
        repository.tags = params.tags ?? {};
    }

    /** The issue of `repository` titled `title`, as GitHub has it now; `undefined` when there is none. */
    findIssue(repository: string, title: string): (GitHubWorldItemState & { readonly number: number }) | undefined {
        const item = [...this.items.values()].find(
            candidate => candidate.repository === repository && candidate.title === title && !candidate.pullRequest,
        );
        return item && { ...this.stateOf(item.id), number: item.number };
    }

    /** Makes GitHub fail every issue created in `repository` from now on, as `failure` says. */
    failCreate(repository: string, failure: GitHubWorldFailure): void {
        this.failures.set(failureKey(`R_${slug(repository)}`, 'CreateIssue'), failure);
    }

    /** Makes the viewer a member of the organisation `login`: its repositories and projects are offered to track. */
    organization(login: string): void {
        this.organizations.add(login);
    }

    /** Adds a project, the viewer's by default; returns its node id. */
    project(params: GitHubWorldProjectParams): string {
        const id = `PVT_${params.number}`;
        const owner = params.owner ?? this.viewer;
        const project: WorldProject = {
            id,
            title: params.title,
            number: params.number,
            owner,
            ownerKind: this.organizations.has(owner) ? 'org' : 'user',
            views: params.views ?? [{ name: 'View 1' }],
            places: [],
        };
        this.projects.set(id, project);
        if (this.github) {
            this.answerProjectPoll(this.github, project);
        }

        return id;
    }

    /** Adds a draft issue to a project; returns its project item's id. */
    draft(params: GitHubWorldDraftParams): string {
        const project = this.getProject(params.project);
        const updatedAt = new Date(Date.now() - params.minutesAgo * 60_000).toISOString();
        const draft: WorldDraft = {
            kind: 'draft',
            id: `DI_${project.number}_${project.places.length + 1}`,
            title: params.title,
            createdAt: updatedAt,
            updatedAt,
        };
        return placeIn(project, draft, params.status ?? null, updatedAt).id;
    }

    /** The draft issues of a project as GitHub has them now, in its order. */
    draftsOf(projectId: string): GitHubWorldDraftState[] {
        return this.getProject(projectId).places.flatMap(place =>
            place.content.kind === 'draft' ? [{ title: place.content.title, status: place.status }] : [],
        );
    }

    /** Adds an issue, open by default; returns its node id. */
    issue(params: GitHubWorldIssueParams): string {
        const item = this.createItem(`I_${slug(params.repository)}_${params.number}`, params, null, params.issueType);
        return item.id;
    }

    /** Adds an open pull request; returns its node id. */
    pullRequest(params: GitHubWorldPullRequestParams): string {
        return this.createPullRequest(params, null).item.id;
    }

    /** Adds a comment to an item, its newest: call them oldest first. Returns its node id. */
    comment(id: string, params: GitHubWorldCommentParams): string {
        const item = this.get(id);
        const commentId = `IC_${id}_${item.comments.length + 1}`;
        item.comments.push({
            id: commentId,
            author: params.author,
            body: params.body,
            createdAt: new Date(Date.now() - params.minutesAgo * 60_000).toISOString(),
        });
        return commentId;
    }

    /** Adds a submitted review to a pull request, its newest: call them oldest first. */
    review(id: string, params: GitHubWorldReviewParams): void {
        this.get(id).pullRequest?.reviews.push(params);
    }

    /**
     * Starts the viewer's draft review on github.com, or with `null` submits or discards it. Whether that moves
     * `updated_at` on GitHub isn't known (code review D21), so here it doesn't: only the statuses' read can find out.
     */
    setPendingReview(id: string, review: GitHubWorldPendingReview | null): void {
        const { pullRequest } = this.get(id);
        if (pullRequest) {
            pullRequest.pendingReview = review;
        }
    }

    /** Adds a stack of open pull requests; returns their node ids, bottom first. */
    stack(params: GitHubWorldStackParams): string[] {
        const stack: WorldStack = {
            id: `PRS_${slug(params.repository)}_${params.number}`,
            number: params.number,
            entries: [],
        };
        this.stacks.set(stack.id, stack);
        for (const [index, pullRequest] of params.pullRequests.entries()) {
            const place = { stack, position: index + 1 };
            stack.entries.push(this.createPullRequest({ ...pullRequest, repository: params.repository }, place));
        }

        return stack.entries.map(entry => entry.item.id);
    }

    /** The address of an item on github.com. */
    urlOf(id: string): URL {
        return new URL(toUrl(this.get(id)));
    }

    /** What the item is now on GitHub. */
    stateOf(id: string): GitHubWorldItemState {
        const item = this.get(id);
        const projects: Record<string, GitHubWorldStatus | null> = {};
        for (const place of item.projectItems) {
            projects[place.project.title] = place.status;
        }

        return {
            state: item.state,
            stateReason: item.stateReason,
            isDraft: item.pullRequest?.isDraft ?? false,
            labels: [...item.labels],
            assignees: [...item.assignees],
            milestone: item.milestone,
            comments: item.comments.map(comment => comment.body),
            reviewRequests: [...(item.pullRequest?.reviewRequests ?? [])],
            merged: item.pullRequest?.merged ?? false,
            projects,
        };
    }

    /** The place in its repository's merge queue of a pull request, from 1; `null` outside it. */
    queuePositionOf(id: string): number | null {
        const item = this.get(id);
        return item.pullRequest?.queued ? toQueuePosition(this.getRepository(item.repository), item.pullRequest) : null;
    }

    /** The auto-merge turned on for a pull request; `null` for none. */
    autoMergeOf(id: string): Readonly<WorldAutoMerge> | null {
        return this.get(id).pullRequest?.autoMerge ?? null;
    }

    /** Someone puts the pull request `id` in its repository's merge queue, last, on github.com. */
    enqueue(id: string): void {
        const item = this.get(id);
        if (!item.pullRequest) {
            throw new Error(`Item ${id} is not a pull request in the GitHub world`);
        }

        this.addToQueue([{ item, pullRequest: item.pullRequest }], false);
    }

    /** Someone takes the pull request `id`, and the rest of its stack, out of the merge queue on github.com. */
    dequeue(id: string): void {
        this.removeFromQueue(this.get(id));
    }

    /** The head commit of a pull request: the `sha` a merge of it must name. */
    headOf(id: string): string {
        return toHeadRefOid(this.get(id));
    }

    /**
     * Pushes a commit by `author` to the branch of the pull request `id`, as someone does on github.com: its head
     * moves, so a merge naming the one before is refused. Returns the new head.
     */
    push(id: string, author: string, headline: string): string {
        const item = this.get(id);
        if (!item.pullRequest) {
            throw new Error(`Item ${id} is not a pull request in the GitHub world`);
        }

        return pushCommit(item, item.pullRequest, { author, headline });
    }

    /** The approval it had no longer counts, as after a dismissed review: it needs one again. */
    withdrawApproval(id: string): void {
        const { pullRequest } = this.get(id);
        if (!pullRequest) {
            throw new Error(`${id} is not a pull request`);
        }

        pullRequest.reviewDecision = 'REVIEW_REQUIRED';
    }

    /** Renames an item, which moves its `updated_at` to now. */
    retitle(id: string, title: string): void {
        const item = this.get(id);
        item.title = title;
        item.updatedAt = new Date().toISOString();
    }

    /**
     * Sets an item's "Status" in a project, as someone does on github.com: the project item's `updated_at` moves to
     * now, the issue's stays.
     */
    setStatus(id: string, projectId: string, status: GitHubWorldStatus | null): void {
        const place = this.get(id).projectItems.find(other => other.project.id === projectId);
        if (!place) {
            throw new Error(`Item ${id} is not in project ${projectId} in the GitHub world`);
        }

        place.status = status;
        place.updatedAt = new Date().toISOString();
    }

    /** Makes `search` stop finding an item — a review request withdrawn, an issue unassigned. */
    leave(id: string, search: MyWorkSearch): void {
        this.get(id).foundBy.delete(search);
    }

    /**
     * Deletes an item. GitHub's search index catches up later, so the searches go on finding it while a read
     * answers `null` with a `NOT_FOUND` error, as GitHub does.
     */
    delete(id: string): void {
        this.get(id).deleted = true;
    }

    /** Makes GitHub fail every `mutation` of the item `id` from now on, as `failure` says. */
    failEdit(id: string, mutation: GitHubWorldMutation, failure: GitHubWorldFailure): void {
        this.get(id);
        this.failures.set(failureKey(id, mutation), failure);
    }

    /**
     * Keeps every mutation unanswered — and the world as it was — until the returned function is called, to
     * see an edit before GitHub confirms it. The test calls it before it ends: a request still waiting when the
     * browser closes cannot be answered.
     */
    holdEdits(): () => void {
        let release = () => {};
        const held = new Promise<void>(resolve => {
            release = resolve;
        });
        this.heldEdits = held;
        return () => {
            if (this.heldEdits === held) {
                this.heldEdits = null;
            }

            release();
        };
    }

    /**
     * Makes GitHub refuse every merge of the pull request `id` at once from now on, as it refuses a merge it will not
     * make (`400`, `failed`), saying `message`.
     */
    refuseMerge(id: string, message: string): void {
        this.get(id);
        this.mergeRefusals.set(id, message);
    }

    /**
     * Keeps the merges GitHub accepts pending — the pull request still open — until the returned function is
     * called, which merges them: to see a pull request being merged before GitHub says it is.
     */
    holdMerges(): () => void {
        this.mergesHeld = true;
        return () => {
            this.mergesHeld = false;
            for (const merge of this.merges.values()) {
                if (merge.refusal === null) {
                    this.completeMerge(merge);
                }
            }
        };
    }

    /**
     * Refuses the merges {@link holdMerges} holds, as GitHub fails a merge while it runs (`failed`, saying `message`):
     * the pull requests stay open, and merges accepted from now on are no longer held.
     */
    refuseHeldMerges(message: string): void {
        this.mergesHeld = false;
        for (const merge of this.merges.values()) {
            if (merge.landing.some(entry => !entry.pullRequest.merged)) {
                merge.refusal = message;
            }
        }
    }

    /**
     * Keeps `search` from answering until the returned function is called — a slow search on the first
     * download. The test calls it before it ends: a request still waiting when the browser closes cannot be
     * answered.
     */
    holdSearch(search: MyWorkSearch): () => void {
        let release = () => {};
        this.heldSearches.set(
            search,
            new Promise<void>(resolve => {
                release = resolve;
            }),
        );
        return () => {
            this.heldSearches.delete(search);
            release();
        };
    }

    /** Answers `github`'s reads and the app's edits from this world, from now on. */
    install(github: GitHubMock): void {
        this.github = github;
        github.searchIssues = q => this.search(q);
        this.installReads(github);
        this.installTracking(github);
        this.installEdits(github);
        for (const repository of this.repositories.values()) {
            this.answerRepositoryPoll(github, repository);
        }

        for (const project of this.projects.values()) {
            this.answerProjectPoll(github, project);
        }

        for (const item of this.items.values()) {
            this.answerMerge(github, item);
        }
    }

    private installReads(github: GitHubMock) {
        github.graphql('RepositoryMetadata', ({ variables }) => {
            const repository = this.findRepository(variables);
            if (!repository) {
                return { repository: null };
            }

            const users = [this.viewer, ...repository.users];
            return {
                repository: {
                    id: `R_${slug(repository.nameWithOwner)}`,
                    nameWithOwner: repository.nameWithOwner,
                    viewerPermission: repository.viewerPermission,
                    isArchived: repository.isArchived,
                    hasIssuesEnabled: !repository.issuesDisabled,
                    mergeCommitAllowed: repository.mergeMethods.includes('MERGE'),
                    squashMergeAllowed: repository.mergeMethods.includes('SQUASH'),
                    rebaseMergeAllowed: repository.mergeMethods.includes('REBASE'),
                    viewerDefaultMergeMethod: repository.defaultMergeMethod,
                    autoMergeAllowed: repository.autoMergeAllowed,
                    deleteBranchOnMerge: repository.deleteBranchOnMerge,
                    viewerDefaultCommitEmail: repository.commitEmails[0] ?? null,
                    viewerPossibleCommitEmails: [...repository.commitEmails],
                    labels: {
                        pageInfo: LAST_PAGE,
                        nodes: repository.labels.map(label => ({
                            id: labelId(repository, label.name),
                            name: label.name,
                            color: label.color,
                            description: null,
                        })),
                    },
                    milestones: {
                        totalCount: repository.milestones.length,
                        nodes: repository.milestones.map(title => ({
                            id: milestoneId(repository, title),
                            title,
                            dueOn: null,
                        })),
                    },
                    assignableUsers: {
                        pageInfo: LAST_PAGE,
                        nodes: users.map(login => ({ id: userId(login), name: null, ...createUser(login) })),
                    },
                    issueTypes: null,
                },
            };
        });
        github.graphql('RepositoryCommitRefs', ({ variables }) => {
            const repository = this.repositories.get(`${String(variables.owner)}/${String(variables.name)}`);
            if (!repository) {
                return { repository: null };
            }

            const toRefs = (refs: Readonly<Record<string, string>>) => {
                const nodes = Object.entries(refs).flatMap(([name, oid]) => {
                    const commit = repository.commits.get(oid);
                    return commit ? [{ name, target: toCommitTarget(commit) }] : [];
                });
                return { pageInfo: LAST_PAGE, nodes };
            };
            const tipOid = repository.branches[repository.defaultBranch];
            const tip = tipOid === undefined ? undefined : repository.commits.get(tipOid);
            return {
                repository: {
                    defaultBranchRef: tip
                        ? {
                              name: repository.defaultBranch,
                              target: {
                                  ...toCommitTarget(tip),
                                  ...(variables.withHistory === true
                                      ? { history: toHistory(repository, tip, 100) }
                                      : {}),
                              },
                          }
                        : null,
                    ...(variables.withBranches === true ? { branches: toRefs(repository.branches) } : {}),
                    ...(variables.withTags === true ? { tags: toRefs(repository.tags) } : {}),
                },
            };
        });
        github.graphql('CommitHistories', ({ variables }) => {
            const first = typeof variables.first === 'number' ? variables.first : 100;
            const nodes: CommitHistoriesQuery['nodes'] = readIds(variables).map(id => {
                const found = this.findCommit(id);
                return found ? { history: toHistory(found.repository, found.commit, first) } : null;
            });
            return { nodes };
        });
        github.graphql('CommitDetail', ({ variables }) => {
            const found = this.findCommit(String(variables.id));
            const node: CommitDetailQuery['node'] = found
                ? {
                      ...toCommitFields(found.commit),
                      message: found.commit.body
                          ? `${found.commit.headline}\n\n${found.commit.body}`
                          : found.commit.headline,
                  }
                : null;
            return { node };
        });
        github.graphql('CommitStates', ({ variables }) => {
            const nodes: CommitStatesQuery['nodes'] = readIds(variables).map(id => {
                const found = this.findCommit(id);
                if (!found) {
                    return null;
                }

                const { repository, commit } = found;

                const pullRequest = commit.pullRequest;
                return {
                    id,
                    associatedPullRequests: {
                        nodes: pullRequest
                            ? [
                                  {
                                      ...pullRequest,
                                      url: `https://github.com/${repository.nameWithOwner}/pull/${pullRequest.number}`,
                                      isDraft: false,
                                  },
                              ]
                            : [],
                    },
                    statusCheckRollup: commit.ci ? { state: commit.ci } : null,
                };
            });
            return { nodes };
        });
        github.graphql('CommitChecks', ({ variables }) => {
            const found = this.findCommit(String(variables.id));
            if (!found) {
                return { node: null };
            }

            const { repository, commit } = found;
            const runs = commit.failedRuns ?? [];
            const node: CommitChecksQuery['node'] = {
                statusCheckRollup: commit.ci
                    ? {
                          contextPage: {
                              totalCount: runs.length,
                              nodes: runs.map(runId => toFailedCheckRun(repository.nameWithOwner, runId)),
                          },
                      }
                    : null,
            };
            return { node };
        });
        github.graphql('RepositoryIssueTemplates', ({ variables }) => {
            const repository = this.repositories.get(`${String(variables.owner)}/${String(variables.name)}`);
            if (!repository) {
                return { repository: null };
            }

            const { blankIssuesEnabled = true, markdown = [], forms = {} } = repository.templates;
            const files = Object.entries(forms);
            return {
                repository: {
                    nameWithOwner: repository.nameWithOwner,
                    isBlankIssuesEnabled: blankIssuesEnabled,
                    issueTemplates: markdown.map(template => ({
                        name: template.name,
                        filename: template.filename,
                        about: null,
                        title: template.title ?? null,
                        body: template.body,
                        labels: { nodes: (template.labels ?? []).map(name => ({ name })) },
                        assignees: { nodes: [] },
                        type: null,
                    })),
                    templateFiles:
                        files.length > 0
                            ? { entries: files.map(([name, text]) => ({ name, object: { text, isTruncated: false } })) }
                            : null,
                },
            };
        });
        // Every repository of the world whose name holds the words typed (`<text> in:name`).
        github.graphql('RepositorySearch', ({ variables }) => {
            const text = String(variables.query)
                .replace(/\s*in:name\s*/u, '')
                .trim()
                .toLowerCase();
            return {
                search: {
                    nodes: [...this.repositories.values()]
                        .filter(repository => repository.nameWithOwner.toLowerCase().includes(text))
                        .map(repository => ({
                            nameWithOwner: repository.nameWithOwner,
                            isPrivate: repository.isPrivate,
                            isArchived: repository.isArchived,
                            hasIssuesEnabled: !repository.issuesDisabled,
                            viewerPermission: repository.viewerPermission,
                            pushedAt: new Date().toISOString(),
                        })),
                },
            };
        });
        // Every repository of the world holding the words typed in its name or description, within `org:` when it says;
        // GitHub's other qualifiers are left out of what it matches.
        github.graphql('RepositoryBrowseSearch', ({ variables }) => {
            const terms = String(variables.query).toLowerCase().split(/\s+/u).filter(Boolean);
            const words = terms.filter(term => !term.includes(':'));
            const owner = terms.find(term => term.startsWith('org:'))?.slice('org:'.length);
            return {
                search: {
                    nodes: [...this.repositories.values()]
                        .filter(repository => {
                            const name = repository.nameWithOwner.toLowerCase();
                            const text = `${name} ${repository.description ?? ''}`.toLowerCase();
                            return (
                                (owner === undefined || name.startsWith(`${owner}/`)) &&
                                words.every(word => text.includes(word))
                            );
                        })
                        .map(repository => ({
                            ...this.toCandidate(repository),
                            description: repository.description,
                        })),
                },
            };
        });
        github.graphql('RepositoryLabel', ({ variables }) => {
            const repository = this.repositories.get(`${String(variables.owner)}/${String(variables.name)}`);
            const label = repository?.labels.find(candidate => candidate.name === variables.label);
            return {
                repository: repository
                    ? {
                          label: label
                              ? {
                                    id: labelId(repository, label.name),
                                    name: label.name,
                                    color: label.color,
                                    description: null,
                                }
                              : null,
                      }
                    : null,
            };
        });
        github.graphql('UserByLogin', ({ variables }) => {
            const login = String(variables.login);
            return { user: { id: userId(login), name: null, ...createUser(login) } };
        });
        github.graphql('ViewerProjects', () => ({
            viewer: {
                projectsV2: { nodes: [...this.projects.values()].map(project => toViewerProject(project)) },
                organizations: { nodes: [] },
            },
        }));
        github.graphql('ItemByNumber', ({ variables }) => {
            const nameWithOwner = `${String(variables.owner)}/${String(variables.name)}`.toLowerCase();
            if (![...this.repositories.keys()].some(name => name.toLowerCase() === nameWithOwner)) {
                return new GitHubPartialAnswer<'ItemByNumber'>({ repository: null }, [
                    {
                        type: 'NOT_FOUND',
                        path: ['repository'],
                        message: `Could not resolve to a Repository with the name '${nameWithOwner}'.`,
                    },
                ]);
            }

            const found = [...this.items.values()].find(
                item =>
                    !item.deleted &&
                    item.repository.toLowerCase() === nameWithOwner &&
                    item.number === Number(variables.number),
            );
            return { repository: { issueOrPullRequest: found ? { id: found.id } : null } };
        });
        github.graphql('ItemsByIds', ({ variables }) => {
            const ids = readIds(variables);
            return new GitHubPartialAnswer<'ItemsByIds'>(
                { nodes: ids.map(id => this.readNode(id) ?? null) },
                notFoundErrors(ids, id => this.readItem(id) !== undefined),
            );
        });
        github.graphql('PullRequestStatuses', ({ variables }) => {
            const ids = readIds(variables);
            return new GitHubPartialAnswer<'PullRequestStatuses'>(
                {
                    nodes: ids.map(id => {
                        const node = this.readNode(id);
                        if (!node) {
                            return null;
                        }

                        // GitHub answers an empty object for a node of another type than the fragment's.
                        return node.__typename === 'PullRequest' ? node : {};
                    }),
                },
                notFoundErrors(ids, id => this.readItem(id) !== undefined),
            );
        });
        github.graphql('PullRequestPendingReviews', ({ variables }) => {
            const ids = readIds(variables);
            return new GitHubPartialAnswer<'PullRequestPendingReviews'>(
                {
                    nodes: ids.map(id => {
                        const node = this.readNode(id);
                        if (!node) {
                            return null;
                        }

                        return node.__typename === 'PullRequest' ? node : {};
                    }),
                },
                notFoundErrors(ids, id => this.readItem(id) !== undefined),
            );
        });
        // Every pull request of each stack, deleted ones left out; a stack the world has not is not there.
        github.graphql('PullRequestStacks', ({ variables }) => ({
            nodes: readIds(variables).map(id => {
                const stack = this.stacks.get(id);
                if (!stack) {
                    return null;
                }

                const entries = stack.entries.filter(entry => !entry.item.deleted);
                return {
                    id,
                    entries: {
                        totalCount: entries.length,
                        nodes: entries.slice(0, Number(variables.first)).map(entry => ({
                            pullRequest: this.toPullRequestNode(entry.item, entry.pullRequest),
                        })),
                    },
                };
            }),
        }));
        // Read ahead for "my work" after every poll (D18).
        github.graphql('ItemDetails', ({ variables }) => {
            const ids = readIds(variables);
            return new GitHubPartialAnswer<'ItemDetails'>(
                { nodes: ids.map(id => this.readDetailNode(id) ?? null) },
                notFoundErrors(ids, id => this.readItem(id) !== undefined),
            );
        });
        github.graphql('ItemDetail', ({ variables }) => {
            const id = String(variables.id);
            const node = this.readDetailNode(id);
            return new GitHubPartialAnswer<'ItemDetail'>(
                { node: node ?? null },
                node ? [] : [notFoundError(id, ['node'])],
            );
        });
        github.graphql('PullRequestMergeGuard', ({ variables }) => {
            const item = this.readItem(String(variables.id));
            return {
                node: item?.pullRequest
                    ? {
                          mergeable: getMergeable(item.pullRequest),
                          mergeStateStatus: getMergeStateStatus(item.pullRequest, this.getRepository(item.repository)),
                          viewerCanMergeAsAdmin: this.getRepository(item.repository).viewerCanMergeAsAdmin,
                      }
                    : null,
            };
        });
        // Read by the merge panel, and by the opened item of a pull request with failing checks for which are required:
        // the texts GitHub proposes, the base branch's ruleset if its repository has one, and no check listed, as
        // `ItemDetail` lists none.
        github.graphql('PullRequestMergeOptions', ({ variables }) => {
            const id = String(variables.id);
            const item = this.readItem(id);
            if (!item?.pullRequest) {
                return new GitHubPartialAnswer<'PullRequestMergeOptions'>({ node: null }, [
                    notFoundError(id, ['node']),
                ]);
            }

            const node = this.toPullRequestNode(item, item.pullRequest);
            const texts = toProposedTexts(item, item.pullRequest);
            const repository = this.getRepository(item.repository);
            const allowed = repository.rulesetMergeMethods;
            const rules = [
                ...(allowed
                    ? [{ type: 'PULL_REQUEST' as const, parameters: { allowedMergeMethods: [...allowed] } }]
                    : []),
                ...(repository.mergeQueueMethod
                    ? [{ type: 'MERGE_QUEUE' as const, parameters: { mergeMethod: repository.mergeQueueMethod } }]
                    : []),
            ];
            const answer: PullRequestMergeOptionsQuery = {
                node: {
                    ...node,
                    mergeHeadline: texts.MERGE.title,
                    mergeBody: texts.MERGE.body,
                    squashHeadline: texts.SQUASH.title,
                    squashBody: texts.SQUASH.body,
                    viewerCanMergeAsAdmin: repository.viewerCanMergeAsAdmin,
                    viewerCanEnableAutoMerge: repository.autoMergeAllowed,
                    autoMergeBody: item.pullRequest.autoMerge && { commitBody: item.pullRequest.autoMerge.commitBody },
                    // The commit pushed last, else the head as the author's, under the pull request's title.
                    headCommit: {
                        nodes: [
                            {
                                commit: toHeadCommit(item, item.pullRequest),
                            },
                        ],
                    },
                    baseRef: {
                        target: node.baseRef?.target ?? null,
                        rules: { nodes: rules },
                        branchProtectionRule: null,
                    },
                    statusCheckRollup: node.statusCheckRollup && {
                        ...node.statusCheckRollup,
                        contextPage: {
                            nodes: [
                                ...item.pullRequest.failedRuns.map(runId => toFailedCheckRun(item.repository, runId)),
                                ...item.pullRequest.failedOutsideActions.map(toFailedCheckOutsideActions),
                            ],
                        },
                    },
                },
            };
            this.landBranchUpdate(item, item.pullRequest);
            return answer;
        });
        github.graphql('MoreComments', ({ variables }) => {
            const id = String(variables.id);
            const item = this.readItem(id);
            if (!item) {
                return new GitHubPartialAnswer<'MoreComments'>({ node: null }, [notFoundError(id, ['node'])]);
            }

            const before = parseCursor(variables.before) ?? item.comments.length;
            return { node: { id, commentPage: toCommentPage(item, before, OLDER_COMMENT_PAGE) } };
        });
        github.graphql('MoreReviews', ({ variables }) => {
            const id = String(variables.id);
            const item = this.readItem(id);
            if (!item?.pullRequest) {
                return new GitHubPartialAnswer<'MoreReviews'>({ node: null }, [notFoundError(id, ['node'])]);
            }

            const { reviews } = item.pullRequest;
            return {
                node: { id, reviews: toReviewPage(item, reviews, parseCursor(variables.before) ?? reviews.length) },
            };
        });
    }

    /** What tracking reads: the candidates, a lookup by name, the downloads and the re-reads of projects. */
    private installTracking(github: GitHubMock) {
        github.graphql('TrackingCandidates', () => {
            const nodes = [...this.organizations].map(login => ({
                login,
                avatarUrl: `https://avatars.githubusercontent.com/${login}`,
                repositories: this.toCandidatePage(login),
            }));
            return {
                viewer: {
                    login: this.viewer,
                    repositories: this.toCandidatePage(this.viewer),
                    organizations: { nodes },
                },
            };
        });
        github.graphql('OrganizationRepositories', ({ variables }) => {
            const login = String(variables.login);
            return {
                organization: this.organizations.has(login) ? { repositories: this.toCandidatePage(login) } : null,
            };
        });
        github.graphql('TrackingProjects', () => {
            const nodes = [...this.organizations].map(login => {
                const projects = this.projectsOf(login);
                return { login, projectsV2: { totalCount: projects.length, nodes: projects } };
            });
            const own = this.projectsOf(this.viewer);
            return {
                viewer: { projectsV2: { totalCount: own.length, nodes: own }, organizations: { nodes } },
            };
        });
        github.graphql('RepositoryForTracking', ({ variables }) => {
            const repository = this.findRepository(variables);
            return repository
                ? { repository: this.toCandidate(repository) }
                : new GitHubPartialAnswer<'RepositoryForTracking'>({ repository: null }, [repositoryNotFound()]);
        });
        github.graphql('ProjectForTracking', ({ variables }) => {
            const project = [...this.projects.values()].find(
                candidate => candidate.owner === variables.login && candidate.number === variables.number,
            );
            return { repositoryOwner: { projectV2: project ? this.toTrackingProject(project) : null } };
        });

        github.graphql('RepositoryIssues', ({ variables }) => {
            const repository = this.findRepository(variables);
            if (!repository) {
                return new GitHubPartialAnswer<'RepositoryIssues'>({ repository: null }, [repositoryNotFound()]);
            }

            const states = readStrings(variables.states);
            const items = this.readRepositoryItems(repository.nameWithOwner).filter(
                item => !item.pullRequest && states.includes(item.state),
            );
            return {
                repository: {
                    nameWithOwner: repository.nameWithOwner,
                    issues: toItemPage(items, ISSUE_PAGE, variables.after, item => this.toIssueNode(item)),
                },
            };
        });
        github.graphql('RepositoryPullRequests', ({ variables }) => {
            const repository = this.findRepository(variables);
            if (!repository) {
                return new GitHubPartialAnswer<'RepositoryPullRequests'>({ repository: null }, [repositoryNotFound()]);
            }

            const states = readStrings(variables.states);
            const pullRequests = this.readRepositoryItems(repository.nameWithOwner).flatMap(item =>
                item.pullRequest && states.includes(item.state) ? [{ item, pullRequest: item.pullRequest }] : [],
            );
            return {
                repository: {
                    nameWithOwner: repository.nameWithOwner,
                    pullRequests: toItemPage(
                        pullRequests,
                        Number(variables.first),
                        variables.after,
                        ({ item, pullRequest }) => this.toPullRequestNode(item, pullRequest),
                    ),
                },
            };
        });

        github.graphql('ProjectFull', ({ variables }) => {
            const id = String(variables.id);
            const project = this.projects.get(id);
            if (!project) {
                return new GitHubPartialAnswer<'ProjectFull'>({ node: null }, [notFoundError(id, ['node'])]);
            }

            return {
                node: {
                    ...this.toTrackingProject(project),
                    viewerCanUpdate: true,
                    fields: { nodes: toProjectFields(project) },
                    views: { nodes: toProjectViews(project) },
                    items: this.toProjectItemPage(project.places, PROJECT_FIRST_PAGE, 0),
                },
            };
        });
        github.graphql('ProjectSchema', ({ variables }) => {
            const id = String(variables.id);
            const project = this.projects.get(id);
            if (!project) {
                return new GitHubPartialAnswer<'ProjectSchema'>({ node: null }, [notFoundError(id, ['node'])]);
            }

            return {
                node: {
                    title: project.title,
                    closed: false,
                    viewerCanUpdate: true,
                    fields: { nodes: toProjectFields(project) },
                    views: { nodes: toProjectViews(project) },
                    items: { totalCount: project.places.length },
                },
            };
        });
        github.graphql('ProjectItems', ({ variables }) => {
            const id = String(variables.id);
            const project = this.projects.get(id);
            if (!project) {
                return new GitHubPartialAnswer<'ProjectItems'>({ node: null }, [notFoundError(id, ['node'])]);
            }

            const places = selectPlaces(project, String(variables.query));
            return {
                node: {
                    items: this.toProjectItemPage(places, Number(variables.first), parseCursor(variables.after) ?? 0),
                },
            };
        });
    }

    /**
     * Answers a repository's change list (`GET /repos/{o}/{r}/issues?since=`): its issues and pull requests updated
     * since then, the most recently updated first, with an ETag hashed from them — `304` while it is the one sent —
     * and its GitHub Actions ({@link answerRepositoryActions}): no workflows until a test gives it some.
     */
    private answerRepositoryPoll(github: GitHubMock, repository: WorldRepository) {
        answerRepositoryActions(
            github,
            repository.nameWithOwner,
            () => ({ ...repository, tags: repository.tagNames }),
            runId => answerRerun(repository, runId),
        );
        github.rest('GET', `/repos/${repository.nameWithOwner}/issues`, ({ url, ifNoneMatch }) => {
            const since = url.searchParams.get('since') ?? '';
            const json = [...this.items.values()]
                .filter(
                    item => !item.deleted && item.repository === repository.nameWithOwner && item.updatedAt >= since,
                )
                .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .map(item => ({
                    node_id: item.id,
                    number: item.number,
                    updated_at: item.updatedAt,
                    ...(item.pullRequest ? { pull_request: {} } : {}),
                }));
            const etag = etagOf(json);
            return ifNoneMatch === etag ? { status: 304, etag } : { status: 200, json, etag };
        });
    }

    /**
     * Answers a project's change signal (`GET /users|orgs/{o}/projectsV2/{n}`): the project, with an ETag hashed from
     * its items' values and their issues' — `304` while it is the one sent.
     */
    private answerProjectPoll(github: GitHubMock, project: WorldProject) {
        const base = project.ownerKind === 'org' ? 'orgs' : 'users';
        github.rest('GET', `/${base}/${project.owner}/projectsV2/${project.number}`, ({ ifNoneMatch }) => {
            const etag = etagOf(
                project.places.map(place => [
                    place.id,
                    place.status,
                    place.archived,
                    place.updatedAt,
                    place.content.updatedAt,
                ]),
            );
            const json = { node_id: project.id, number: project.number, updated_at: getUpdatedAt(project) };
            return ifNoneMatch === etag ? { status: 304, etag } : { status: 200, json, etag };
        });
    }

    /** The items of the repository the variables name (`owner`, `name`); `undefined` for one GitHub does not have. */
    private readRepositoryItems(nameWithOwner: string) {
        return [...this.items.values()]
            .filter(item => !item.deleted && item.repository === nameWithOwner)
            .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    /** The repository the variables name (`owner`, `name`) in any case, as GitHub finds it; `undefined` with none. */
    private findRepository(variables: Readonly<Record<string, unknown>>) {
        const name = `${String(variables.owner)}/${String(variables.name)}`.toLowerCase();
        return [...this.repositories.values()].find(repository => repository.nameWithOwner.toLowerCase() === name);
    }

    /** The repositories of `owner` as the tracking screens list them. */
    private toCandidatePage(owner: string): TrackingRepositoryPageFieldsFragment {
        const nodes = [...this.repositories.values()]
            .filter(repository => repository.nameWithOwner.split('/')[0] === owner)
            .map(repository => this.toCandidate(repository));
        return { totalCount: nodes.length, pageInfo: LAST_PAGE, nodes };
    }

    private toCandidate(repository: WorldRepository): TrackingRepositoryFieldsFragment {
        const [owner = ''] = repository.nameWithOwner.split('/');
        const open = [...this.items.values()].filter(
            item => !item.deleted && item.repository === repository.nameWithOwner && item.state === 'OPEN',
        );
        return {
            id: `R_${slug(repository.nameWithOwner)}`,
            nameWithOwner: repository.nameWithOwner,
            isPrivate: repository.isPrivate,
            isArchived: false,
            pushedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
            viewerPermission: repository.viewerPermission,
            owner: { login: owner },
            issues: { totalCount: open.filter(item => !item.pullRequest).length },
            pullRequests: { totalCount: open.filter(item => item.pullRequest).length },
        };
    }

    /** The projects of `owner` as the tracking screens list them. */
    private projectsOf(owner: string): TrackingProjectFieldsFragment[] {
        return [...this.projects.values()]
            .filter(project => project.owner === owner)
            .map(project => this.toTrackingProject(project));
    }

    private toTrackingProject(project: WorldProject): TrackingProjectFieldsFragment {
        return {
            ...toViewerProject(project),
            updatedAt: getUpdatedAt(project),
            items: { totalCount: project.places.filter(place => !place.archived).length },
            owner:
                project.ownerKind === 'org'
                    ? { __typename: 'Organization', login: project.owner }
                    : { __typename: 'User', login: project.owner },
        };
    }

    /** A page of a project's items, `first` from the `start`-th on, as GitHub answers it. */
    private toProjectItemPage(
        places: readonly WorldProjectItem[],
        first: number,
        start: number,
    ): ProjectItemPageFieldsFragment {
        const end = Math.min(places.length, start + first);
        return {
            totalCount: places.length,
            pageInfo: { hasNextPage: end < places.length, endCursor: end > start ? `C${end}` : null },
            nodes: places.slice(start, end).map(place => this.toProjectItemRowNode(place)),
        };
    }

    /** A project item as a tracked project's page reads it: its values, and its issue's, pull request's or draft's. */
    private toProjectItemRowNode(place: WorldProjectItem): ProjectItemRowFieldsFragment {
        const values = toProjectItemValues(place);
        const { content } = place;
        const common = {
            id: place.id,
            updatedAt: place.updatedAt,
            fieldValues: values.fieldValues,
            isArchived: place.archived,
        };
        if (content.kind === 'draft') {
            return { ...common, type: 'DRAFT_ISSUE', content: this.toDraftNode(content) };
        }

        return {
            ...common,
            type: content.pullRequest ? 'PULL_REQUEST' : 'ISSUE',
            content: this.readNode(content.id) ?? null,
        };
    }

    private toDraftNode(draft: WorldDraft): DraftIssueFieldsFragment {
        return {
            __typename: 'DraftIssue',
            id: draft.id,
            title: draft.title,
            body: '',
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt,
            creator: createUser(this.viewer),
            assignees: { nodes: [] },
        };
    }

    private installEdits(github: GitHubMock) {
        const byItemId = (key: string) => (variables: Readonly<Record<string, unknown>>) =>
            this.readItem(String(variables[key]));

        this.mutation(github, 'AddLabels', {
            findItem: byItemId('labelableId'),
            apply: (item, variables) => {
                for (const name of this.readLabelNames(item, variables)) {
                    if (!item.labels.includes(name)) {
                        item.labels.push(name);
                    }
                }
            },
            answer: item => ({ addLabelsToLabelable: { labelable: this.toLabelable(item) } }),
            refused: { addLabelsToLabelable: null },
        });
        this.mutation(github, 'RemoveLabels', {
            findItem: byItemId('labelableId'),
            apply: (item, variables) => {
                const removed = this.readLabelNames(item, variables);
                item.labels = item.labels.filter(name => !removed.includes(name));
            },
            answer: item => ({ removeLabelsFromLabelable: { labelable: this.toLabelable(item) } }),
            refused: { removeLabelsFromLabelable: null },
        });
        this.mutation(github, 'AddAssignees', {
            findItem: byItemId('assignableId'),
            apply: (item, variables) => {
                for (const login of readLogins(variables.assigneeIds)) {
                    if (!item.assignees.includes(login)) {
                        item.assignees.push(login);
                    }
                }
            },
            answer: item => ({ addAssigneesToAssignable: { assignable: toAssignable(item) } }),
            refused: { addAssigneesToAssignable: null },
        });
        this.mutation(github, 'RemoveAssignees', {
            findItem: byItemId('assignableId'),
            apply: (item, variables) => {
                const removed = readLogins(variables.assigneeIds);
                item.assignees = item.assignees.filter(login => !removed.includes(login));
            },
            answer: item => ({ removeAssigneesFromAssignable: { assignable: toAssignable(item) } }),
            refused: { removeAssigneesFromAssignable: null },
        });
        this.mutation(github, 'UpdateIssueMilestone', {
            findItem: byItemId('id'),
            apply: (item, variables) => {
                item.milestone = this.readMilestone(item, variables.milestoneId);
            },
            answer: item => ({
                updateIssue: {
                    issue: { id: item.id, updatedAt: item.updatedAt, milestone: this.toMilestone(item) },
                },
            }),
            refused: { updateIssue: null },
        });
        this.mutation(github, 'UpdatePullRequestMilestone', {
            findItem: byItemId('pullRequestId'),
            apply: (item, variables) => {
                item.milestone = this.readMilestone(item, variables.milestoneId);
            },
            answer: item => ({
                updatePullRequest: {
                    pullRequest: { id: item.id, updatedAt: item.updatedAt, milestone: this.toMilestone(item) },
                },
            }),
            refused: { updatePullRequest: null },
        });
        this.mutation(github, 'CloseIssue', {
            findItem: byItemId('issueId'),
            apply: (item, variables) => {
                item.state = 'CLOSED';
                item.stateReason = variables.stateReason === 'NOT_PLANNED' ? 'NOT_PLANNED' : 'COMPLETED';
                item.closedAt = new Date().toISOString();
            },
            answer: item => ({ closeIssue: { issue: toIssueState(item) } }),
            refused: { closeIssue: null },
        });
        this.mutation(github, 'ReopenIssue', {
            findItem: byItemId('issueId'),
            apply: item => {
                item.state = 'OPEN';
                item.stateReason = 'REOPENED';
                item.closedAt = null;
            },
            answer: item => ({ reopenIssue: { issue: toIssueState(item) } }),
            refused: { reopenIssue: null },
        });
        this.mutation(github, 'ClosePullRequest', {
            findItem: byItemId('pullRequestId'),
            apply: item => {
                item.state = 'CLOSED';
                item.closedAt = new Date().toISOString();
            },
            answer: item => ({ closePullRequest: { pullRequest: toPullRequestState(item) } }),
            refused: { closePullRequest: null },
        });
        this.mutation(github, 'ReopenPullRequest', {
            findItem: byItemId('pullRequestId'),
            apply: item => {
                item.state = 'OPEN';
                item.closedAt = null;
            },
            answer: item => ({ reopenPullRequest: { pullRequest: toPullRequestState(item) } }),
            refused: { reopenPullRequest: null },
        });
        this.mutation(github, 'MarkReadyForReview', {
            findItem: byItemId('pullRequestId'),
            apply: item => {
                if (item.pullRequest) {
                    item.pullRequest.isDraft = false;
                }
            },
            answer: item => ({ markPullRequestReadyForReview: { pullRequest: toPullRequestState(item) } }),
            refused: { markPullRequestReadyForReview: null },
        });
        // Brings the base branch in with a merge commit by the viewer — not at once, as on GitHub: the answer and the
        // next read of the merge panel still find the old head (live, 2026-11-02), then it lands
        // (`landBranchUpdate`).
        this.mutation(github, 'UpdatePullRequestBranch', {
            findItem: byItemId('pullRequestId'),
            apply: item => {
                if (item.pullRequest) {
                    item.pullRequest.updatingBranch = true;
                }
            },
            answer: item => ({ updatePullRequestBranch: { pullRequest: { id: item.id } } }),
            refused: { updatePullRequestBranch: null },
        });
        // Auto-merge: GitHub refuses it for a stacked pull request, though `viewerCanEnableAutoMerge` reads true (live,
        // 2026-11-02).
        this.mutation(github, 'EnablePullRequestAutoMerge', {
            findItem: byItemId('pullRequestId'),
            refuse: (item, variables) => {
                if (item.pullRequest?.stack) {
                    return 'Auto-merge is not supported for stacked pull requests.';
                }

                if (!this.getRepository(item.repository).autoMergeAllowed) {
                    return 'Pull request Auto merge is not allowed for this repository';
                }

                return variables.expectedHeadOid === toHeadRefOid(item) ? null : HEAD_MOVED;
            },
            apply: (item, variables) => {
                if (item.pullRequest) {
                    item.pullRequest.autoMerge = {
                        mergeMethod: readMergeMethod(variables.mergeMethod),
                        commitHeadline: readText(variables.commitHeadline),
                        commitBody: readText(variables.commitBody),
                        enabledAt: new Date().toISOString(),
                    };
                }
            },
            answer: item => ({ enablePullRequestAutoMerge: { pullRequest: this.toPullRequestAnswer(item) } }),
            refused: { enablePullRequestAutoMerge: null },
        });
        this.mutation(github, 'DisablePullRequestAutoMerge', {
            findItem: byItemId('pullRequestId'),
            apply: item => {
                if (item.pullRequest) {
                    item.pullRequest.autoMerge = null;
                }
            },
            answer: item => ({ disablePullRequestAutoMerge: { pullRequest: this.toPullRequestAnswer(item) } }),
            refused: { disablePullRequestAutoMerge: null },
        });
        this.mutation(github, 'EnqueuePullRequest', {
            findItem: byItemId('pullRequestId'),
            refuse: (item, variables) => {
                if (!this.getRepository(item.repository).mergeQueueMethod) {
                    return `No merge queue found for branch '${toHeadRefName(item)}'`;
                }

                return variables.expectedHeadOid === toHeadRefOid(item) ? null : HEAD_MOVED;
            },
            // The one way here to ask for the queue, and it always jumps it (`EnqueuePullRequest.gql`).
            apply: item => {
                if (item.pullRequest) {
                    this.addToQueue([{ item, pullRequest: item.pullRequest }], true);
                }
            },
            keepsUpdatedAt: true,
            answer: item => ({
                enqueuePullRequest: {
                    mergeQueueEntry: {
                        position: item.pullRequest
                            ? toQueuePosition(this.getRepository(item.repository), item.pullRequest)
                            : 0,
                    },
                },
            }),
            refused: { enqueuePullRequest: null },
        });
        // A stack leaves whole, and only through its first member in the queue (live, 2026-11-03).
        this.mutation(github, 'DequeuePullRequest', {
            findItem: byItemId('id'),
            refuse: item => {
                const first = item.pullRequest && getQueuedInStack({ item, pullRequest: item.pullRequest })[0];
                return first?.item === item ? null : `No merge queue found for branch '${toHeadRefName(item)}'`;
            },
            apply: item => this.removeFromQueue(item),
            keepsUpdatedAt: true,
            answer: () => ({ dequeuePullRequest: { clientMutationId: null } }),
            refused: { dequeuePullRequest: null },
        });
        // Its branch: deleted, and restored at its last head (live, #56). The answers say nothing of the pull request.
        this.mutation(github, 'DeleteRef', {
            findItem: variables => this.findByHeadRefId(String(variables.refId)),
            apply: item => {
                if (item.pullRequest) {
                    item.pullRequest.branchDeleted = true;
                }
            },
            keepsUpdatedAt: true,
            answer: () => ({ deleteRef: { clientMutationId: null } }),
            refused: { deleteRef: null },
        });
        this.mutation(github, 'CreateRef', {
            findItem: variables =>
                [...this.items.values()].find(
                    item =>
                        `R_${slug(item.repository)}` === variables.repositoryId &&
                        item.pullRequest !== null &&
                        `refs/heads/${toHeadRefName(item)}` === variables.name &&
                        toHeadRefOid(item) === variables.oid,
                ),
            apply: item => {
                if (item.pullRequest) {
                    item.pullRequest.branchDeleted = false;
                }
            },
            keepsUpdatedAt: true,
            answer: item => ({ createRef: { ref: { id: toHeadRefId(item) } } }),
            refused: { createRef: null },
        });
        // A new open pull request at once, on a branch of its own (live, #59).
        this.mutation(github, 'RevertPullRequest', {
            findItem: byItemId('pullRequestId'),
            apply: () => undefined,
            keepsUpdatedAt: true,
            answer: item => {
                const number = Math.max(...[...this.items.values()].map(other => other.number)) + 1;
                this.pullRequest({
                    repository: item.repository,
                    number,
                    title: `Revert "${item.title}"`,
                    foundBy: ['authored'],
                    minutesAgo: 0,
                });
                return {
                    revertPullRequest: {
                        revertPullRequest: { number, url: `https://github.com/${item.repository}/pull/${number}` },
                    },
                };
            },
            refused: { revertPullRequest: null },
        });
        // A merge with a chosen commit email: it answers at once, and doesn't take a stack (merging D5).
        this.mutation(github, 'MergePullRequest', {
            findItem: byItemId('pullRequestId'),
            refuse: (item, variables) => {
                if (item.pullRequest?.stack) {
                    return 'Merging with this API does not support stacked pull requests.';
                }

                return variables.expectedHeadOid === toHeadRefOid(item) ? null : HEAD_MOVED;
            },
            apply: item => {
                if (item.pullRequest) {
                    this.completeMerge({
                        landing: [{ item, pullRequest: item.pullRequest }],
                        uuid: '',
                        enqueues: false,
                        refusal: null,
                    });
                }
            },
            answer: () => ({ mergePullRequest: { pullRequest: { mergeCommit: { oid: MERGE_COMMIT_OID } } } }),
            refused: { mergePullRequest: null },
        });
        this.mutation(github, 'ConvertToDraft', {
            findItem: byItemId('pullRequestId'),
            apply: item => {
                if (item.pullRequest) {
                    item.pullRequest.isDraft = true;
                }
            },
            answer: item => ({ convertPullRequestToDraft: { pullRequest: toPullRequestState(item) } }),
            refused: { convertPullRequestToDraft: null },
        });
        this.mutation(github, 'RequestReviews', {
            findItem: byItemId('pullRequestId'),
            apply: (item, variables) => {
                for (const login of readLogins(variables.userIds)) {
                    if (item.pullRequest && !item.pullRequest.reviewRequests.includes(login)) {
                        item.pullRequest.reviewRequests.push(login);
                    }
                }
            },
            answer: item => ({
                requestReviews: {
                    pullRequest: {
                        id: item.id,
                        updatedAt: item.updatedAt,
                        reviewRequests: {
                            nodes: (item.pullRequest?.reviewRequests ?? []).map(login => ({
                                requestedReviewer: { __typename: 'User', id: userId(login), ...createUser(login) },
                            })),
                        },
                    },
                },
            }),
            refused: { requestReviews: null },
        });
        this.mutation(github, 'AddComment', {
            findItem: byItemId('subjectId'),
            apply: (item, variables) => {
                item.comments.push({
                    id: `IC_${item.id}_${item.comments.length + 1}`,
                    author: this.viewer,
                    body: String(variables.body),
                    createdAt: new Date().toISOString(),
                });
            },
            answer: item => {
                const comment = item.comments.at(-1);
                return {
                    addComment: {
                        commentEdge: { node: comment ? toCommentNode(item, comment) : null },
                    },
                };
            },
            refused: { addComment: null },
        });
        this.mutation(github, 'AddToProject', {
            findItem: byItemId('contentId'),
            apply: (item, variables) => {
                const project = this.projects.get(String(variables.projectId));
                if (project && !item.projectItems.some(place => place.project === project)) {
                    item.projectItems.push(placeIn(project, item, null));
                }
            },
            answer: (item, variables) => {
                const place = item.projectItems.find(other => other.project.id === variables.projectId);
                return { addProjectV2ItemById: { item: place ? toProjectItemDetail(place) : null } };
            },
            refused: { addProjectV2ItemById: null },
        });
        this.projectFieldMutation(github, 'SetProjectFieldValue', {
            apply: (place, variables) => {
                const { value } = variables;
                const optionId = isPlainObject(value) ? value.singleSelectOptionId : undefined;
                const option = STATUS_OPTIONS.find(candidate => statusOptionId(candidate.name) === optionId);
                if (variables.fieldId === statusFieldId(place.project) && option) {
                    place.status = option.name;
                }
            },
            answer: (place, variables) => ({
                updateProjectV2ItemFieldValue: { projectV2Item: toProjectItemFieldResult(place, variables.fieldName) },
            }),
            refused: { updateProjectV2ItemFieldValue: null },
        });
        this.projectFieldMutation(github, 'ClearProjectFieldValue', {
            apply: (place, variables) => {
                if (variables.fieldId === statusFieldId(place.project)) {
                    place.status = null;
                }
            },
            answer: (place, variables) => ({
                clearProjectV2ItemFieldValue: { projectV2Item: toProjectItemFieldResult(place, variables.fieldName) },
            }),
            refused: { clearProjectV2ItemFieldValue: null },
        });
        github.graphql('CreateIssue', async ({ variables }): Promise<GitHubGraphQLAnswer<'CreateIssue'>> => {
            const repositoryId = String(variables.repositoryId);
            this.received.push({ mutation: 'CreateIssue', itemId: repositoryId });
            await this.heldEdits;

            const repository = [...this.repositories.values()].find(
                candidate => `R_${slug(candidate.nameWithOwner)}` === repositoryId,
            );
            const failure = this.failures.get(failureKey(repositoryId, 'CreateIssue'));
            if (!repository || failure?.kind === 'refuse' || repository.isArchived) {
                const message =
                    failure?.kind === 'refuse' ? failure.message : 'Repository was archived so is read-only.';
                return new GitHubPartialAnswer<'CreateIssue'>({ createIssue: null }, [
                    { type: 'UNPROCESSABLE', path: ['createIssue'], message },
                ]);
            }

            // Without push access GitHub silently drops labels, assignees and the milestone (D14).
            const pushes =
                ['WRITE', 'MAINTAIN', 'ADMIN'].includes(repository.viewerPermission) && failure?.kind !== 'drop';
            const number =
                Math.max(
                    0,
                    ...[...this.items.values()]
                        .filter(item => item.repository === repository.nameWithOwner)
                        .map(item => item.number),
                ) + 1;
            const labelIds = readStrings(variables.labelIds);
            const assignees = pushes ? readLogins(variables.assigneeIds) : [];
            const item = this.createItem(
                `I_${slug(repository.nameWithOwner)}_${number}`,
                {
                    repository: repository.nameWithOwner,
                    number,
                    title: String(variables.title),
                    foundBy: assignees.includes(this.viewer) ? ['assigned'] : [],
                    minutesAgo: 0,
                    labels: pushes
                        ? repository.labels
                              .filter(label => labelIds.includes(labelId(repository, label.name)))
                              .map(label => label.name)
                        : [],
                    milestone: pushes
                        ? repository.milestones.find(title => milestoneId(repository, title) === variables.milestoneId)
                        : undefined,
                },
                null,
            );
            item.assignees = assignees;
            for (const projectId of readStrings(variables.projectV2Ids)) {
                const project = this.projects.get(projectId);
                if (project) {
                    item.projectItems.push(placeIn(project, item, null, item.updatedAt));
                }
            }

            return { createIssue: { issue: { ...this.toIssueNode(item), parent: null } } };
        });
        github.graphql('AddDraftIssue', async ({ variables }) => {
            const projectId = String(variables.projectId);
            this.received.push({ mutation: 'AddDraftIssue', itemId: projectId });
            await this.heldEdits;

            const project = this.projects.get(projectId);
            if (!project) {
                return new GitHubPartialAnswer<'AddDraftIssue'>({ addProjectV2DraftIssue: null }, [
                    notFoundError(projectId, ['addProjectV2DraftIssue']),
                ]);
            }

            const now = new Date().toISOString();
            const draft: WorldDraft = {
                kind: 'draft',
                id: `DI_${project.number}_${project.places.length + 1}`,
                title: String(variables.title),
                createdAt: now,
                updatedAt: now,
            };
            const place = placeIn(project, draft, null, now);
            return { addProjectV2DraftIssue: { projectItem: this.toProjectItemRowNode(place) } };
        });
    }

    /**
     * Answers a mutation of one project item's field — an issue's, a pull request's or a draft's: held while
     * {@link holdEdits} holds, recorded, failed as {@link failEdit} said for the item, else applied — the project
     * item's `updatedAt` moving to now — and answered with the field's value as it then is.
     */
    private projectFieldMutation<TName extends 'ClearProjectFieldValue' | 'SetProjectFieldValue'>(
        github: GitHubMock,
        name: TName,
        handler: {
            readonly apply: (place: WorldProjectItem, variables: Readonly<Record<string, unknown>>) => void;
            readonly answer: (
                place: WorldProjectItem,
                variables: Readonly<Record<string, unknown>>,
            ) => GitHubOperationData<TName>;
            readonly refused: GitHubOperationData<TName>;
        },
    ): void {
        github.graphql(name, async ({ variables }): Promise<GitHubGraphQLAnswer<TName>> => {
            const place = this.findPlace(variables.itemId);
            this.received.push({ mutation: name, itemId: place?.content.id ?? '' });
            await this.heldEdits;

            const [field = ''] = Object.keys(handler.refused);
            if (!place) {
                return new GitHubPartialAnswer<TName>(handler.refused, [
                    { type: 'NOT_FOUND', path: [field], message: 'Could not resolve to a node.' },
                ]);
            }

            const failure = this.failures.get(failureKey(place.content.id, name));
            if (failure?.kind === 'refuse') {
                return new GitHubPartialAnswer<TName>(handler.refused, [
                    { type: 'FORBIDDEN', path: [field], message: failure.message },
                ]);
            }

            if (failure?.kind !== 'drop') {
                handler.apply(place, variables);
                place.updatedAt = new Date().toISOString();
            }

            return handler.answer(place, variables);
        });
    }

    /** The project item `id` names, of a live issue or pull request or a draft; `undefined` for none. */
    private findPlace(id: unknown): WorldProjectItem | undefined {
        for (const project of this.projects.values()) {
            const place = project.places.find(candidate => candidate.id === id);
            if (place && (place.content.kind === 'draft' || !place.content.deleted)) {
                return place;
            }
        }

        return undefined;
    }

    /**
     * Answers the mutation `name`: held while {@link holdEdits} holds, recorded, failed as {@link failEdit} said,
     * else applied — the item's `updatedAt` moving to now, unless the handler keeps it — and answered with the item as it then is.
     */
    private mutation<TName extends GitHubWorldMutation>(
        github: GitHubMock,
        name: TName,
        handler: WorldMutationHandler<TName>,
    ): void {
        github.graphql(name, async ({ variables }): Promise<GitHubGraphQLAnswer<TName>> => {
            const item = handler.findItem(variables);
            this.received.push({ mutation: name, itemId: item?.id ?? '' });
            await this.heldEdits;

            const [field = ''] = Object.keys(handler.refused);
            if (!item) {
                return new GitHubPartialAnswer<TName>(handler.refused, [
                    { type: 'NOT_FOUND', path: [field], message: 'Could not resolve to a node.' },
                ]);
            }

            const failure = this.failures.get(failureKey(item.id, name));
            if (failure?.kind === 'refuse') {
                return new GitHubPartialAnswer<TName>(handler.refused, [
                    { type: 'FORBIDDEN', path: [field], message: failure.message },
                ]);
            }

            const refusal = handler.refuse?.(item, variables) ?? null;
            if (refusal !== null) {
                return new GitHubPartialAnswer<TName>(handler.refused, [
                    { type: 'UNPROCESSABLE', path: [field], message: refusal },
                ]);
            }

            if (failure?.kind !== 'drop') {
                handler.apply(item, variables);
                if (!handler.keepsUpdatedAt) {
                    item.updatedAt = new Date().toISOString();
                }
            }

            return handler.answer(item, variables);
        });
    }

    /**
     * Answers the merges of the pull request `item` (`PUT …/merge-async`) as GitHub does: refused at once (`400`,
     * `failed`) when {@link refuseMerge} said so of one it lands, the `sha` sent is not its head, or the stack must be
     * rebased first; else accepted (`202`, `pending`) with a `uuid` to ask by — merged at once, or once
     * {@link holdMerges} lets go. In a stack it lands every open one from the lowest up to it, in order (live,
     * 2026-11-02). On a merge queue's branch it merges nothing: with the `sha` alone it answers `enqueued` as it follows,
     * every one going in the queue with a position of its own, and with a method or a text it accepts and then fails
     * (live, 2026-11-03) — unless asked past the rules to merge directly. Past the rules (`bypass_rules`) is refused to
     * who isn't {@link GitHubWorldRepositoryParams.viewerCanMergeAsAdmin}.
     */
    private answerMerge(github: GitHubMock, item: WorldItem) {
        for (const runId of item.pullRequest?.failedRuns ?? []) {
            github.rest('POST', `/repos/${item.repository}/actions/runs/${runId}/rerun-failed-jobs`, () => ({
                status: 201,
                json: {},
            }));
        }

        const { pullRequest } = item;
        if (!pullRequest) {
            return;
        }

        const path = `/repos/${item.repository}/pulls/${item.number}/merge-async`;
        github.rest('PUT', path, ({ body }) => {
            if (item.deleted || item.state !== 'OPEN') {
                return { status: 405, json: { message: 'Pull Request is not mergeable' } };
            }

            const landing = getLanding({ item, pullRequest });
            const sha = isPlainObject(body) ? body.sha : undefined;
            let message = landing.map(entry => this.mergeRefusals.get(entry.item.id)).find(text => text !== undefined);
            if (message === undefined && sha !== toHeadRefOid(item)) {
                message = 'Pull request head branch was modified.';
            }

            if (message === undefined && landing.slice(1).some(entry => isBehindBelow(entry.pullRequest))) {
                message = 'This stack must be rebased before it can be merged.';
            }

            const repository = this.getRepository(item.repository);
            const asked = isPlainObject(body) ? body : {};
            const past = asked.bypass_rules === true;
            if (message === undefined && past && !repository.viewerCanMergeAsAdmin) {
                message = 'You do not have permission to bypass the rules of this branch.';
            }

            if (message !== undefined) {
                return { status: 400, json: { status: 'failed', details: { message } } };
            }

            const direct = past && asked.merge_action === 'direct_merge';
            const enqueues = repository.mergeQueueMethod !== null && !direct;
            const custom = enqueues && ['merge_method', 'commit_title', 'commit_message'].some(key => key in asked);
            const uuid = `merge-${slug(item.id)}-${this.merges.size + 1}`;
            const merge: WorldMerge = {
                landing,
                uuid,
                enqueues,
                refusal: custom ? 'Custom merge params are not supported when merging via a merge queue' : null,
            };
            this.merges.set(merge.uuid, merge);
            github.rest('GET', `${path}/${merge.uuid}`, () => {
                if (merge.refusal !== null) {
                    return { status: 200, json: { status: 'failed', details: { message: merge.refusal } } };
                }

                if (pullRequest.queued) {
                    return {
                        status: 200,
                        json: {
                            status: 'enqueued',
                            details: { message: 'Pull request was added to the merge queue.' },
                        },
                    };
                }

                return {
                    status: 200,
                    json: pullRequest.merged
                        ? { status: 'merged', details: { message: 'Pull request was merged.', sha: MERGE_COMMIT_OID } }
                        : { status: 'pending', details: { message: 'Merge request is in progress.', uuid } },
                };
            });
            if (!this.mergesHeld && merge.refusal === null) {
                this.completeMerge(merge);
            }

            return {
                status: 202,
                json: {
                    status: 'pending',
                    details: { message: 'Merge request enqueued.', uuid: merge.uuid, expected_head_sha: sha },
                },
            };
        });
    }

    private createPullRequest(params: GitHubWorldPullRequestParams, stack: WorldStackPlace | null): WorldStackEntry {
        const pullRequest: WorldPullRequest = {
            branchDeleted: false,
            failedRuns: params.failedRuns ?? [],
            failedOutsideActions: params.failedOutsideActions ?? [],
            isDraft: params.isDraft ?? false,
            reviewDecision: params.reviewDecision === undefined ? 'REVIEW_REQUIRED' : params.reviewDecision,
            failingChecks: params.failingChecks ?? 0,
            conflicts: params.conflicts ?? false,
            reviewRequests: [...(params.reviewRequests ?? [])],
            reviews: [],
            pendingReview: null,
            closes: params.closes ?? [],
            behindBase: params.behindBase ?? false,
            updatingBranch: false,
            pushed: null,
            stack,
            rebasedOn: null,
            proposedTexts: params.proposedTexts ?? {},
            merged: false,
            queued: null,
            autoMerge: null,
        };
        const item = this.createItem(`PR_${slug(params.repository)}_${params.number}`, params, pullRequest);
        const below = getBelow(pullRequest);
        pullRequest.rebasedOn = below ? toHeadRefOid(below.item) : null;
        if (this.github) {
            this.answerMerge(this.github, item);
        }

        return { item, pullRequest };
    }

    private createItem(
        id: string,
        params: GitHubWorldItemParams,
        pullRequest: WorldPullRequest | null,
        issueType?: GitHubWorldIssueType,
    ): WorldItem {
        this.getRepository(params.repository);
        const updatedAt = new Date(Date.now() - params.minutesAgo * 60_000).toISOString();
        const foundBy = params.foundBy ?? [];
        const item: WorldItem = {
            kind: 'item',
            id,
            repository: params.repository,
            number: params.number,
            title: params.title,
            author: params.author ?? this.viewer,
            createdAt: new Date(Date.parse(updatedAt) - 24 * 60 * 60_000).toISOString(),
            updatedAt,
            state: params.closed ? 'CLOSED' : 'OPEN',
            stateReason: params.closed && !pullRequest ? 'COMPLETED' : null,
            closedAt: params.closed ? updatedAt : null,
            labels: [...(params.labels ?? [])],
            assignees: foundBy.includes('assigned') ? [this.viewer] : [],
            milestone: params.milestone ?? null,
            comments: [],
            projectItems: [],
            pullRequest,
            issueType: issueType ?? null,
            bodyHtml: params.bodyHtml ?? '',
            foundBy: new Set(foundBy),
            deleted: false,
        };
        for (const placement of params.projects ?? []) {
            const place = placeIn(this.getProject(placement.project), item, placement.status ?? null, updatedAt);
            place.archived = placement.archived ?? false;
            item.projectItems.push(place);
        }

        this.items.set(id, item);
        return item;
    }

    /** The commit whose node id is `id`, and its repository. */
    private findCommit(id: string): { repository: WorldRepository; commit: WorldCommit } | undefined {
        for (const repository of this.repositories.values()) {
            const commit = repository.commits.get(id.replace(/^C_/, ''));
            if (commit) {
                return { repository, commit };
            }
        }

        return undefined;
    }

    private getRepository(nameWithOwner: string): WorldRepository {
        let repository = this.repositories.get(nameWithOwner);
        if (!repository) {
            repository = {
                nameWithOwner,
                viewerPermission: 'WRITE',
                labels: DEFAULT_LABELS,
                milestones: ['v1.0'],
                users: ['monalisa', 'hubot'],
                description: null,
                isPrivate: false,
                isArchived: false,
                issuesDisabled: false,
                templates: {},
                mergeMethods: ['MERGE', 'SQUASH', 'REBASE'],
                defaultMergeMethod: 'MERGE',
                rulesetMergeMethods: null,
                requiresUpToDate: false,
                defaultBranch: 'main',
                mergeQueueMethod: null,
                queue: [],
                autoMergeAllowed: false,
                viewerCanMergeAsAdmin: false,
                deleteBranchOnMerge: false,
                commitEmails: [],
                workflows: [],
                runs: [],
                tagNames: [],
                jobs: new Map(),
                logs: new Map(),
                rerunRefusal: null,
                commits: new Map(),
                branches: {},
                tags: {},
            };
            this.repositories.set(nameWithOwner, repository);
            if (this.github) {
                this.answerRepositoryPoll(this.github, repository);
            }
        }

        return repository;
    }

    private getProject(id: string): WorldProject {
        const project = this.projects.get(id);
        if (!project) {
            throw new Error(`No project ${id} in the GitHub world`);
        }

        return project;
    }

    /** A live item; `undefined` for an id GitHub does not know or that was deleted. */
    private readItem(id: string): WorldItem | undefined {
        const item = this.items.get(id);
        return item && !item.deleted ? item : undefined;
    }

    /** The row of a live item, as `ItemsByIds` reads it. */
    private readNode(id: string): IssueFieldsFragment | PullRequestFieldsFragment | undefined {
        const item = this.readItem(id);
        if (!item) {
            return undefined;
        }

        return item.pullRequest ? this.toPullRequestNode(item, item.pullRequest) : this.toIssueNode(item);
    }

    /** A live item as `ItemDetail` reads it: its row, its rendered description, its comments and projects. */
    private readDetailNode(id: string): IssueDetailFieldsFragment | PullRequestDetailFieldsFragment | undefined {
        const item = this.readItem(id);
        if (!item) {
            return undefined;
        }

        const details = {
            body: '',
            bodyHTML: item.bodyHtml,
            reactionGroups: [],
            commentPage: toCommentPage(item, item.comments.length, COMMENT_PAGE),
            projectItems: { nodes: item.projectItems.map(place => toProjectItemDetail(place)) },
        };
        if (!item.pullRequest) {
            const noIssues = { totalCount: 0, nodes: [] };
            return {
                ...this.toIssueNode(item),
                ...details,
                parent: null,
                subIssues: noIssues,
                blockedBy: noIssues,
                blocking: noIssues,
            };
        }

        const node = this.toPullRequestNode(item, item.pullRequest);
        return {
            ...node,
            ...details,
            commits: { totalCount: 1 },
            headRepository: { nameWithOwner: item.repository },
            statusCheckRollup: node.statusCheckRollup && {
                ...node.statusCheckRollup,
                contextPage: { totalCount: 0, nodes: [] },
            },
            latestReviews: { nodes: [] },
            reviews: toReviewPage(item, item.pullRequest.reviews, item.pullRequest.reviews.length),
            reviewRequests: {
                nodes: item.pullRequest.reviewRequests.map(login => ({ requestedReviewer: createUser(login) })),
            },
        };
    }

    private toIssueNode(item: WorldItem): IssueFieldsFragment {
        return {
            ...this.createItemFields(item),
            __typename: 'Issue',
            issueState: item.state,
            stateReason: item.stateReason,
            issueType: item.issueType && { name: item.issueType, color: ISSUE_TYPE_COLORS[item.issueType] },
            subIssuesSummary: { total: 0, completed: 0 },
        };
    }

    /** Makes the update of the branch GitHub accepted: no longer behind, at a merge commit by the viewer. */
    private landBranchUpdate(item: WorldItem, pullRequest: WorldPullRequest) {
        if (!pullRequest.updatingBranch) {
            return;
        }

        pullRequest.updatingBranch = false;
        pullRequest.behindBase = false;
        const below = getBelow(pullRequest);
        pullRequest.rebasedOn = below ? toHeadRefOid(below.item) : null;
        pushCommit(item, pullRequest, {
            author: this.viewer,
            headline: `Merge branch '${this.getRepository(item.repository).defaultBranch}' into ${toHeadRefName(item)}`,
        });
    }

    private toPullRequestNode(item: WorldItem, pullRequest: WorldPullRequest): PullRequestFieldsFragment {
        const { failingChecks, reviewDecision, stack: place, queued, autoMerge } = pullRequest;
        const below = getBelow(pullRequest);
        const repository = this.getRepository(item.repository);
        return {
            ...this.createItemFields(item),
            __typename: 'PullRequest',
            state: pullRequest.merged ? 'MERGED' : item.state,
            isDraft: pullRequest.isDraft,
            merged: pullRequest.merged,
            reviewDecision,
            mergeable: getMergeable(pullRequest),
            mergeStateStatus: getMergeStateStatus(pullRequest, repository),
            statusCheckRollup: {
                state: failingChecks > 0 ? 'FAILURE' : 'SUCCESS',
                contexts: {
                    checkRunCountsByState: [
                        { state: 'SUCCESS', count: CHECK_COUNT - failingChecks },
                        { state: 'FAILURE', count: failingChecks },
                    ],
                    statusContextCountsByState: [],
                },
            },
            reviewRequests: {
                nodes: pullRequest.reviewRequests.map(login => ({ requestedReviewer: { login } })),
            },
            latestOpinionatedReviews: { nodes: [] },
            pendingReviews: {
                nodes: pullRequest.pendingReview
                    ? [
                          {
                              id: `PRR_${item.id}`,
                              createdAt: new Date(
                                  Date.now() - pullRequest.pendingReview.minutesAgo * 60_000,
                              ).toISOString(),
                              comments: { totalCount: pullRequest.pendingReview.comments },
                          },
                      ]
                    : [],
            },
            stack: place && { id: place.stack.id, number: place.stack.number, size: place.stack.entries.length },
            stackEntry: place && { position: place.position },
            headRefOid: toHeadRefOid(item),
            headRef: pullRequest.branchDeleted ? null : { id: toHeadRefId(item) },
            isCrossRepository: false,
            // Only once its pull request closed (live, #56): false again once it is gone.
            viewerCanDeleteHeadRef: item.state !== 'OPEN' && !pullRequest.branchDeleted,
            baseRefOid: pullRequest.behindBase ? STALE_BASE_OID : (pullRequest.rebasedOn ?? BASE_OID),
            // A stack's later one is based on another member's branch, which has no queue.
            isMergeQueueEnabled: repository.mergeQueueMethod !== null && !below,
            mergeQueueEntry: queued && {
                position: toQueuePosition(repository, pullRequest),
                state: 'AWAITING_CHECKS',
                estimatedTimeToMerge: 13 * 60,
                enqueuedAt: queued.enqueuedAt,
                enqueuer: { login: this.viewer },
            },
            autoMergeRequest: autoMerge && {
                mergeMethod: autoMerge.mergeMethod,
                enabledAt: autoMerge.enabledAt,
                enabledBy: { login: this.viewer },
                commitHeadline: autoMerge.commitHeadline,
            },
            baseRef: { target: { oid: below ? toHeadRefOid(below.item) : BASE_OID } },
            additions: 12 * item.number,
            deletions: 3 * item.number,
            changedFiles: 2,
            headRefName: toHeadRefName(item),
            baseRefName: below ? toHeadRefName(below.item) : repository.defaultBranch,
            closingIssuesReferences: { nodes: pullRequest.closes.map(issueId => ({ id: issueId })) },
        };
    }

    private findByHeadRefId(refId: string) {
        return [...this.items.values()].find(item => item.pullRequest !== null && toHeadRefId(item) === refId);
    }

    /** The pull request `item` as a mutation answers with it. */
    private toPullRequestAnswer(item: WorldItem): PullRequestFieldsFragment {
        if (!item.pullRequest) {
            throw new Error(`Item ${item.id} is not a pull request in the GitHub world`);
        }

        return this.toPullRequestNode(item, item.pullRequest);
    }

    /** Lands the pull requests of a merge GitHub accepted, or puts them in the merge queue, as the merge says. */
    private completeMerge(merge: WorldMerge) {
        if (merge.enqueues) {
            this.addToQueue(merge.landing, false);
            return;
        }

        for (const { item, pullRequest } of merge.landing) {
            if (pullRequest.merged) {
                continue;
            }

            const now = new Date().toISOString();
            pullRequest.merged = true;
            pullRequest.queued = null;
            pullRequest.branchDeleted = this.getRepository(item.repository).deleteBranchOnMerge;
            item.state = 'CLOSED';
            item.closedAt = now;
            item.updatedAt = now;
        }
    }

    /**
     * Puts the pull requests in their repository's merge queue, in order: last, or at its front when they jump it. Their
     * `updatedAt` stays: the queue doesn't move it on GitHub (live, 2026-11-03).
     */
    private addToQueue(entries: readonly WorldStackEntry[], jump: boolean) {
        const now = new Date().toISOString();
        const added = entries.filter(entry => !entry.pullRequest.queued);
        for (const entry of added) {
            entry.pullRequest.queued = { enqueuedAt: now };
        }

        const [first] = added;
        if (first) {
            const { queue } = this.getRepository(first.item.repository);
            queue.splice(jump ? 0 : queue.length, 0, ...added);
        }
    }

    /** Takes the pull request and every other of its stack in the queue out of it, all at once; `updatedAt` stays. */
    private removeFromQueue(item: WorldItem) {
        if (!item.pullRequest) {
            return;
        }

        const repository = this.getRepository(item.repository);
        const { queue } = repository;
        for (const entry of getQueuedInStack({ item, pullRequest: item.pullRequest })) {
            entry.pullRequest.queued = null;
            queue.splice(toQueuePosition(repository, entry.pullRequest) - 1, 1);
        }
    }

    private createItemFields(item: WorldItem) {
        const repository = this.getRepository(item.repository);
        const [owner = ''] = item.repository.split('/');
        return {
            id: item.id,
            url: toUrl(item),
            number: item.number,
            title: item.title,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            closedAt: item.closedAt,
            author: createUser(item.author),
            assignees: { nodes: item.assignees.map(login => createUser(login)) },
            labels: { nodes: this.toLabels(item).map(label => ({ name: label.name, color: label.color })) },
            milestone: item.milestone === null ? null : { title: item.milestone, dueOn: null },
            comments: { totalCount: item.comments.length },
            repository: {
                nameWithOwner: item.repository,
                isPrivate: false,
                viewerPermission: repository.viewerPermission,
                owner: { login: owner },
            },
            projectItems: { nodes: item.projectItems.map(place => toProjectItemRow(place)) },
        };
    }

    /** The item's labels with their ids and colours, as its repository has them. */
    private toLabels(item: WorldItem) {
        const repository = this.getRepository(item.repository);
        return item.labels.map(name => ({
            id: labelId(repository, name),
            name,
            color: repository.labels.find(label => label.name === name)?.color ?? 'ededed',
        }));
    }

    private toLabelable(item: WorldItem) {
        const labels = { nodes: this.toLabels(item) };
        return item.pullRequest
            ? { __typename: 'PullRequest' as const, id: item.id, updatedAt: item.updatedAt, labels }
            : { __typename: 'Issue' as const, id: item.id, updatedAt: item.updatedAt, labels };
    }

    private toMilestone(item: WorldItem) {
        const repository = this.getRepository(item.repository);
        return item.milestone === null
            ? null
            : { id: milestoneId(repository, item.milestone), title: item.milestone, dueOn: null };
    }

    /** The names of the labels a label mutation names by id, those of the item's repository. */
    private readLabelNames(item: WorldItem, variables: Readonly<Record<string, unknown>>) {
        const repository = this.getRepository(item.repository);
        const ids = readStrings(variables.labelIds);
        return repository.labels
            .filter(label => ids.includes(labelId(repository, label.name)))
            .map(label => label.name);
    }

    /** The milestone's title a milestone mutation names by id; `null` clears it. */
    private readMilestone(item: WorldItem, milestoneIdValue: unknown) {
        const repository = this.getRepository(item.repository);
        return repository.milestones.find(title => milestoneId(repository, title) === milestoneIdValue) ?? null;
    }

    /** What the search `q` finds, as `GET /search/issues` lists it; `undefined` for a query no group sends. */
    private async search(q: string): Promise<GitHubSearchHit[] | undefined> {
        const search = findSearch(q);
        if (!search) {
            return undefined;
        }

        await this.heldSearches.get(search);

        const hits: GitHubSearchHit[] = [];
        for (const item of this.items.values()) {
            if (item.foundBy.has(search) && item.state === 'OPEN') {
                hits.push({
                    nodeId: item.id,
                    updatedAt: item.updatedAt,
                    number: item.number,
                    repository: item.repository,
                    isPullRequest: item.pullRequest !== null,
                });
            }
        }

        return hits.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    private get(id: string): WorldItem {
        const item = this.items.get(id);
        if (!item) {
            throw new Error(`No item ${id} in the GitHub world`);
        }

        return item;
    }
}

/**
 * Re-runs a run's failed jobs as GitHub does (`POST …/actions/runs/{id}/rerun-failed-jobs`): the run goes again as its next
 * attempt and those jobs start, unless {@link GitHubWorld.refuseRerun} said otherwise.
 */
function answerRerun(repository: WorldRepository, runId: number): GitHubRestAnswer {
    if (repository.rerunRefusal) {
        return repository.rerunRefusal;
    }

    repository.runs = repository.runs.map(run =>
        run.id === runId ? { ...run, status: 'in_progress', conclusion: null, attempt: (run.attempt ?? 1) + 1 } : run,
    );
    repository.jobs.set(
        runId,
        (repository.jobs.get(runId) ?? []).map(job =>
            job.conclusion === 'failure'
                ? {
                      ...job,
                      status: 'in_progress',
                      conclusion: null,
                      startedAt: new Date().toISOString(),
                      completedAt: null,
                  }
                : job,
        ),
    );
    return { status: 201, json: {} };
}

/** A ref's target as `CommitRefTargetFields` gives it. */
function toCommitTarget(commit: WorldCommit) {
    return { id: `C_${commit.oid}`, oid: commit.oid, committedDate: commit.committedDate };
}

/** `history(first:)` from `tip`: it and its ancestors, newest first, as GitHub pages them. */
function toHistory(repository: WorldRepository, tip: WorldCommit, first: number) {
    const reachable = new Map<string, WorldCommit>();
    const queue = [tip];
    for (let commit = queue.pop(); commit; commit = queue.pop()) {
        if (reachable.has(commit.oid)) {
            continue;
        }

        reachable.set(commit.oid, commit);
        for (const parent of commit.parents ?? []) {
            const found = repository.commits.get(parent);
            if (found) {
                queue.push(found);
            }
        }
    }

    const ordered = [...reachable.values()].toSorted((a, b) => b.committedDate.localeCompare(a.committedDate));
    return { nodes: ordered.slice(0, first).map(commit => toCommitFields(commit)) };
}

function toCommitFields(commit: WorldCommit): CommitFieldsFragment {
    return {
        id: `C_${commit.oid}`,
        oid: commit.oid,
        messageHeadline: commit.headline,
        committedDate: commit.committedDate,
        author: { name: commit.author, user: createUser(commit.author) },
        parents: { nodes: (commit.parents ?? []).map(oid => ({ id: `C_${oid}`, oid })) },
    };
}

/** Adds `content` to the end of the project; returns its project item. */
function placeIn(
    project: WorldProject,
    content: WorldItem | WorldDraft,
    status: GitHubWorldStatus | null,
    updatedAt = new Date().toISOString(),
): WorldProjectItem {
    const place: WorldProjectItem = {
        id: `PVTI_${project.number}_${content.id}`,
        project,
        content,
        status,
        updatedAt,
        archived: false,
    };
    project.places.push(place);
    return place;
}

/** When the project last changed: its items' values, or their issues'. */
function getUpdatedAt(project: WorldProject) {
    return project.places.reduce(
        (latest, place) => [latest, place.updatedAt, place.content.updatedAt].reduce((a, b) => (a > b ? a : b)),
        '1970-01-01T00:00:00.000Z',
    );
}

/**
 * The items of a project a `ProjectItems` query finds: every one for none; those updated on or after the day of
 * `updated:>=YYYY-MM-DD`; else those not archived whose title holds the query, as GitHub answers free text.
 */
function selectPlaces(project: WorldProject, query: string): readonly WorldProjectItem[] {
    if (query === '') {
        return project.places;
    }

    const since = /^updated:>=(\d{4}-\d{2}-\d{2})$/.exec(query)?.[1];
    if (since !== undefined) {
        return project.places.filter(
            place => place.updatedAt.slice(0, 10) >= since || place.content.updatedAt.slice(0, 10) >= since,
        );
    }

    const text = query.toLowerCase();
    return project.places.filter(place => !place.archived && place.content.title.toLowerCase().includes(text));
}

function toViewerProject(project: WorldProject) {
    return {
        id: project.id,
        title: project.title,
        number: project.number,
        url: `https://github.com/${project.ownerKind === 'org' ? 'orgs' : 'users'}/${project.owner}/projects/${project.number}`,
        closed: false,
    };
}

/** The fields of a project, as `ProjectFull` and `ProjectSchema` read them. */
function toProjectFields(project: WorldProject): ProjectFieldFieldsFragment[] {
    return PROJECT_FIELDS.map(field =>
        field.name === 'Status'
            ? {
                  id: statusFieldId(project),
                  name: field.name,
                  dataType: field.dataType,
                  options: STATUS_OPTIONS.map(option => ({
                      id: statusOptionId(option.name),
                      name: option.name,
                      color: option.color,
                  })),
              }
            : { id: fieldId(project, field.name), name: field.name, dataType: field.dataType },
    );
}

/** The saved views of a project, as `ProjectFull` and `ProjectSchema` read them: a board's columns its "Status". */
function toProjectViews(project: WorldProject): ProjectViewFieldsFragment[] {
    const ref = (name: GitHubWorldProjectFieldName) => ({ id: fieldId(project, name), name });
    return project.views.map((view, index) => {
        const layout = view.layout ?? 'TABLE_LAYOUT';
        return {
            id: `PVTV_${project.number}_${index + 1}`,
            number: index + 1,
            name: view.name,
            layout,
            filter: view.filter ?? null,
            groupByFields: { nodes: view.groupBy ? [ref(view.groupBy)] : [] },
            verticalGroupByFields: { nodes: layout === 'BOARD_LAYOUT' ? [ref('Status')] : [] },
            sortByFields: { nodes: [] },
            fields: { nodes: VIEW_FIELDS.map(ref) },
        };
    });
}

/** An item's place in a project as its row reads it (`ItemProjectItemFields`): its "Status" only. */
function toProjectItemRow(place: WorldProjectItem): ItemProjectItemFieldsFragment {
    const option = STATUS_OPTIONS.find(candidate => candidate.name === place.status);
    return {
        id: place.id,
        isArchived: place.archived,
        updatedAt: place.updatedAt,
        project: toViewerProject(place.project),
        fieldValueByName: option
            ? { name: option.name, color: option.color, optionId: statusOptionId(option.name) }
            : null,
    };
}

/** An item's place in a project with every value (`ProjectItemValuesFields`). */
function toProjectItemValues(place: WorldProjectItem): ProjectItemValuesFieldsFragment {
    const option = STATUS_OPTIONS.find(candidate => candidate.name === place.status);
    return {
        id: place.id,
        updatedAt: place.updatedAt,
        fieldValues: {
            nodes: option
                ? [
                      {
                          __typename: 'ProjectV2ItemFieldSingleSelectValue',
                          optionId: statusOptionId(option.name),
                          name: option.name,
                          color: option.color,
                          field: { id: statusFieldId(place.project) },
                      },
                  ]
                : [],
        },
    };
}

/** A project item as a field edit is answered with (`ProjectItemFieldResultFields`): the value of the field named. */
function toProjectItemFieldResult(place: WorldProjectItem, fieldName: unknown): ProjectItemFieldResultFieldsFragment {
    const values = toProjectItemValues(place).fieldValues.nodes ?? [];
    return {
        id: place.id,
        updatedAt: place.updatedAt,
        fieldValueByName: fieldName === 'Status' ? (values[0] ?? null) : null,
    };
}

/** An item's place in a project as the item view reads it (`ProjectItemDetailFields`). */
function toProjectItemDetail(place: WorldProjectItem): ProjectItemDetailFieldsFragment {
    return {
        ...toProjectItemRow(place),
        fieldValues: toProjectItemValues(place).fieldValues,
        project: {
            ...toViewerProject(place.project),
            viewerCanUpdate: true,
            fields: { nodes: toProjectFields(place.project) },
        },
    };
}

/**
 * The comments of an item before the `before`-th, `count` at most, as a page GitHub answers: its cursor is the
 * index of its first comment.
 */
function toCommentPage(item: WorldItem, before: number, count: number) {
    const start = Math.max(0, before - count);
    return {
        totalCount: item.comments.length,
        pageInfo: { hasPreviousPage: start > 0, startCursor: start < before ? `C${start}` : null },
        nodes: item.comments.slice(start, before).map(comment => toCommentNode(item, comment)),
    };
}

function toReviewPage(item: WorldItem, reviews: readonly GitHubWorldReviewParams[], before: number) {
    const start = Math.max(0, before - REVIEW_PAGE);
    return {
        pageInfo: { hasPreviousPage: start > 0, startCursor: start < before ? `C${start}` : null },
        nodes: reviews.slice(start, before).map(review => ({
            id: review.id,
            url: `${toUrl(item)}#pullrequestreview-${review.id}`,
            author: createUser(review.author),
            state: review.state,
            bodyHTML: review.bodyHtml ?? '',
            submittedAt: new Date(Date.now() - review.minutesAgo * 60_000).toISOString(),
        })),
    };
}

function toCommentNode(item: WorldItem, comment: WorldComment): IssueCommentFieldsFragment {
    return {
        id: comment.id,
        url: `${toUrl(item)}#issuecomment-${comment.id}`,
        createdAt: comment.createdAt,
        lastEditedAt: null,
        author: createUser(comment.author),
        bodyHTML: `<p>${escapeHtml(comment.body)}</p>`,
    };
}

function toAssignable(item: WorldItem) {
    const assignees = { nodes: item.assignees.map(login => ({ id: userId(login), ...createUser(login) })) };
    return item.pullRequest
        ? { __typename: 'PullRequest' as const, id: item.id, updatedAt: item.updatedAt, assignees }
        : { __typename: 'Issue' as const, id: item.id, updatedAt: item.updatedAt, assignees };
}

function toIssueState(item: WorldItem) {
    return {
        id: item.id,
        updatedAt: item.updatedAt,
        state: item.state,
        stateReason: item.stateReason,
        closedAt: item.closedAt,
    };
}

function toPullRequestState(item: WorldItem) {
    return {
        id: item.id,
        updatedAt: item.updatedAt,
        state: item.state,
        isDraft: item.pullRequest?.isDraft ?? false,
        closedAt: item.closedAt,
    };
}

function toUrl(item: WorldItem) {
    return `https://github.com/${item.repository}/${item.pullRequest ? 'pull' : 'issues'}/${item.number}`;
}

function createUser(login: string) {
    return { login, avatarUrl: `https://avatars.githubusercontent.com/${login}` };
}

function userId(login: string) {
    return `U_${login}`;
}

function labelId(repository: WorldRepository, name: string) {
    return `LA_${slug(repository.nameWithOwner)}_${slug(name)}`;
}

function milestoneId(repository: WorldRepository, title: string) {
    return `MI_${slug(repository.nameWithOwner)}_${slug(title)}`;
}

function statusFieldId(project: WorldProject) {
    return `PVTSSF_${project.number}_status`;
}

function fieldId(project: WorldProject, name: GitHubWorldProjectFieldName) {
    return name === 'Status' ? statusFieldId(project) : `PVTF_${project.number}_${slug(name.toLowerCase())}`;
}

function statusOptionId(name: GitHubWorldStatus) {
    return `status_${slug(name)}`;
}

function failureKey(id: string, mutation: GitHubWorldMutation) {
    return `${id} ${mutation}`;
}

/** GitHub's error for an id a read cannot resolve, at `path`. */
function notFoundError(id: string, path: readonly (number | string)[]): GitHubGraphQLErrorEntry {
    return { type: 'NOT_FOUND', path, message: `Could not resolve to a node with the global id of '${id}'.` };
}

/** GitHub's error for a repository it does not show the viewer. */
function repositoryNotFound(): GitHubGraphQLErrorEntry {
    return { type: 'NOT_FOUND', path: ['repository'], message: 'Could not resolve to a Repository.' };
}

/** GitHub's error for each id of a `nodes(ids:)` read it cannot resolve. */
function notFoundErrors(ids: readonly string[], exists: (id: string) => boolean): GitHubGraphQLErrorEntry[] {
    const errors: GitHubGraphQLErrorEntry[] = [];
    for (const [index, id] of ids.entries()) {
        if (!exists(id)) {
            errors.push(notFoundError(id, ['nodes', index]));
        }
    }

    return errors;
}

function findSearch(q: string): MyWorkSearch | undefined {
    return MY_WORK_SEARCHES.find(search => MY_WORK_QUERIES[search] === q);
}

/** Whether it merges, as GitHub has worked it out. */
function getMergeable(pullRequest: WorldPullRequest): MergeableState {
    if (pullRequest.updatingBranch) {
        return 'UNKNOWN';
    }

    return pullRequest.conflicts ? 'CONFLICTING' : 'MERGEABLE';
}

/** Where its merge stands, in the order GitHub tells it: not worked out, conflicts, a draft, behind, then the rest. */
function getMergeStateStatus(pullRequest: WorldPullRequest, repository: WorldRepository): MergeStateStatus {
    if (pullRequest.updatingBranch) {
        return 'UNKNOWN';
    }

    if (pullRequest.conflicts) {
        return 'DIRTY';
    }

    if (pullRequest.isDraft) {
        return 'DRAFT';
    }

    if (pullRequest.behindBase && repository.requiresUpToDate) {
        return 'BEHIND';
    }

    if (pullRequest.failingChecks > 0) {
        return 'UNSTABLE';
    }

    return pullRequest.reviewDecision === 'APPROVED' ? 'CLEAN' : 'BLOCKED';
}

/** The `ids` variable of a node read, as the app sent it. */
function readIds(variables: Readonly<Record<string, unknown>>): string[] {
    return readStrings(variables.ids);
}

/** A list of ids as GraphQL takes it: a list, or one id alone. */
function readStrings(value: unknown): string[] {
    if (typeof value === 'string') {
        return [value];
    }

    return Array.isArray(value) ? value.filter(entry => typeof entry === 'string') : [];
}

/** The logins of the users a mutation names by id. */
function readLogins(value: unknown): string[] {
    return readStrings(value).map(id => id.replace(/^U_/, ''));
}

/** A page of a repository's items: `first` of them after the cursor, as a connection answers. */
function toItemPage<TItem, TNode>(
    items: readonly TItem[],
    first: number,
    after: unknown,
    toNode: (item: TItem) => TNode,
) {
    const start = parseCursor(after) ?? 0;
    const end = Math.min(items.length, start + first);
    return {
        totalCount: items.length,
        pageInfo: { hasNextPage: end < items.length, endCursor: end > start ? `C${end}` : null },
        nodes: items.slice(start, end).map(toNode),
    };
}

/** The index a cursor of the world stands for: a comment page's first comment, or a project page's next item. */
function parseCursor(value: unknown): number | undefined {
    const match = typeof value === 'string' ? /^C(\d+)$/.exec(value) : null;
    return match?.[1] === undefined ? undefined : Number(match[1]);
}

/** The branch a pull request of the world is opened from. */
function toHeadRefId(item: WorldItem) {
    return `REF_${item.id}`;
}

/** A failed check of the merge options, of a GitHub Actions run. */
function toFailedCheckRun(nameWithOwner: string, runId: number) {
    return {
        __typename: 'CheckRun' as const,
        id: `CR_${runId}`,
        name: `ci / run ${runId}`,
        status: 'COMPLETED' as const,
        conclusion: 'FAILURE' as const,
        detailsUrl: `https://github.com/${nameWithOwner}/actions/runs/${runId}`,
        startedAt: null,
        completedAt: null,
        isRequired: false,
        checkSuite: { app: { slug: 'github-actions' }, workflowRun: { databaseId: runId, workflow: { name: 'ci' } } },
    };
}

function toFailedCheckOutsideActions(name: string) {
    return {
        // Its address is replaced below: a check outside Actions has none of a run's.
        ...toFailedCheckRun('', 0),
        id: `CR_${name}`,
        name,
        detailsUrl: null,
        checkSuite: { app: { slug: 'other' }, workflowRun: null },
    };
}

function toHeadRefName(item: WorldItem) {
    return `change-${item.number}`;
}

/** The head commit as `PullRequestMergeOptions` reads it: the one pushed last, else the author's under the title. */
function toHeadCommit(item: WorldItem, pullRequest: WorldPullRequest) {
    const author = pullRequest.pushed?.author ?? item.author;
    return {
        oid: toHeadRefOid(item),
        messageHeadline: pullRequest.pushed?.headline ?? item.title,
        author: { name: author, user: { login: author } },
    };
}

/** The commit texts GitHub proposes for a pull request: the test's, else GitHub's usual ones. */
function toProposedTexts(
    item: WorldItem,
    pullRequest: WorldPullRequest,
): Readonly<Record<GitHubWorldCommitMethod, GitHubWorldCommitText>> {
    const [owner = ''] = item.repository.split('/');
    return {
        MERGE: pullRequest.proposedTexts.MERGE ?? {
            title: `Merge pull request #${item.number} from ${owner}/${toHeadRefName(item)}`,
            body: item.title,
        },
        SQUASH: pullRequest.proposedTexts.SQUASH ?? { title: `${item.title} (#${item.number})`, body: '' },
    };
}

/** The head commit of a pull request: one of its own, so a merge naming another one can be told apart. */
function toHeadRefOid(item: WorldItem) {
    return item.pullRequest?.pushed?.oid ?? item.number.toString(16).padStart(40, 'f');
}

/** Pushes a commit to the pull request's branch: its head moves to a commit of its own. Returns the new head. */
function pushCommit(item: WorldItem, pullRequest: WorldPullRequest, commit: Omit<WorldPushedCommit, 'oid'>): string {
    const previous = pullRequest.pushed ? Number.parseInt(pullRequest.pushed.oid.slice(0, 8), 16) : 0;
    const oid = `${(previous + 1).toString(16).padStart(8, '0')}${item.number.toString(16).padStart(32, 'e')}`;
    pullRequest.pushed = { ...commit, oid };
    item.updatedAt = new Date().toISOString();
    return oid;
}

/** The pull request below it in its stack — its base; `undefined` for one on the default branch. */
function getBelow(pullRequest: WorldPullRequest): WorldStackEntry | undefined {
    const place = pullRequest.stack;
    return place && place.position > 1 ? place.stack.entries[place.position - 2] : undefined;
}

/** In a stack, it sits on an old head of the one below it, or its base moved: the stack must be rebased (D21). */
function isBehindBelow(pullRequest: WorldPullRequest): boolean {
    const below = getBelow(pullRequest);
    return pullRequest.behindBase || (below !== undefined && pullRequest.rebasedOn !== toHeadRefOid(below.item));
}

/**
 * What a merge of `entry` lands, in order: it alone, or in a stack every open one from the lowest up to it — GitHub
 * merges "a contiguous group starting from the lowest unmerged pull request" (stacked PRs D11).
 */
function getLanding(entry: WorldStackEntry): WorldStackEntry[] {
    const place = entry.pullRequest.stack;
    if (!place) {
        return [entry];
    }

    return place.stack.entries
        .slice(0, place.position)
        .filter(other => !other.item.deleted && other.item.state === 'OPEN');
}

/** The pull request itself when in a merge queue — in a stack, every one of it there, the lowest first. */
function getQueuedInStack(entry: WorldStackEntry): WorldStackEntry[] {
    const all = entry.pullRequest.stack?.stack.entries ?? [entry];
    return all.filter(other => other.pullRequest.queued);
}

/** The place of the pull request in its repository's merge queue, from 1. */
function toQueuePosition(repository: WorldRepository, pullRequest: WorldPullRequest): number {
    return repository.queue.findIndex(entry => entry.pullRequest === pullRequest) + 1;
}

function readMergeMethod(value: unknown): PullRequestMergeMethod {
    switch (value) {
        case 'MERGE':
        case 'SQUASH':
        case 'REBASE':
            return value;
        default:
            throw new Error(`Not a merge method: ${String(value)}`);
    }
}

function readText(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

/** `acme/web` → `acme_web`, for node ids. */
function slug(text: string) {
    return text.replace(/[^\w]/g, '_');
}

/** The moment as GitHub writes a job's and a step's times: ISO at a whole second. */
function toWholeSecond(time: number) {
    return new Date(time).toISOString().replace(/\.\d+Z$/, 'Z');
}
