import type {
    DraftIssueFieldsFragment,
    IssueCommentFieldsFragment,
    IssueDetailFieldsFragment,
    IssueFieldsFragment,
    IssueStateReason,
    IssueTypeColor,
    ItemProjectItemFieldsFragment,
    MergeStateStatus,
    ProjectFieldFieldsFragment,
    ProjectItemDetailFieldsFragment,
    ProjectItemFieldResultFieldsFragment,
    ProjectItemPageFieldsFragment,
    ProjectItemRowFieldsFragment,
    ProjectItemValuesFieldsFragment,
    ProjectV2FieldType,
    ProjectV2SingleSelectFieldOptionColor,
    ProjectV2ViewLayout,
    ProjectViewFieldsFragment,
    PullRequestDetailFieldsFragment,
    PullRequestFieldsFragment,
    PullRequestReviewDecision,
    RepositoryPermission,
    TrackingProjectFieldsFragment,
    TrackingRepositoryFieldsFragment,
    TrackingRepositoryPageFieldsFragment,
} from '@githq/github/generated.gen.js';
import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { escapeHtml } from '../utils/escapeHtml.js';

import { GitHubPartialAnswer } from './GitHubMock.js';
import type { GitHubGraphQLAnswer, GitHubMock, GitHubOperationData, GitHubSearchHit } from './GitHubMock.js';

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

/** An issue of the world; assigned to the viewer when "assigned" finds it. */
export interface GitHubWorldIssueParams extends GitHubWorldItemParams {
    /** Its issue type; none by default. */
    readonly issueType?: GitHubWorldIssueType;
}

/** The issue types of every repository of the world. */
export type GitHubWorldIssueType = 'Bug' | 'Feature' | 'Task';

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
    /** Whose review it asks for (logins). */
    readonly reviewRequests?: readonly string[];
    /** Its base branch moved on since it was last rebased (`baseRefOid` is not the base's tip). */
    readonly behindBase?: boolean;
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
    /** Public by default. */
    readonly isPrivate?: boolean;
    /** Archived: read-only, it takes no issue. */
    readonly isArchived?: boolean;
    /** Issues turned off in its settings. */
    readonly issuesDisabled?: boolean;
    /** Its issue templates and forms; none (blank issues allowed) by default. */
    readonly templates?: GitHubWorldTemplates;
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

/** An organisation the viewer belongs to ({@link GitHubWorld.organization}). */
export interface GitHubWorldOrganizationParams {
    /**
     * It has OAuth App access restrictions and has not approved githq (G5): GitHub leaves it out of what the
     * tracking screens read, with an error naming it, and lists only its public repositories.
     */
    readonly hidesPrivateData?: boolean;
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
    /** Its "Status" in each project it is in, by the project's title; `null` when empty. */
    readonly projects: Readonly<Record<string, GitHubWorldStatus | null>>;
}

interface WorldRepository {
    readonly nameWithOwner: string;
    viewerPermission: RepositoryPermission;
    labels: readonly GitHubWorldLabel[];
    milestones: readonly string[];
    users: readonly string[];
    isPrivate: boolean;
    isArchived: boolean;
    issuesDisabled: boolean;
    templates: GitHubWorldTemplates;
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
    isDraft: boolean;
    readonly reviewDecision: PullRequestReviewDecision | null;
    readonly failingChecks: number;
    readonly conflicts: boolean;
    reviewRequests: string[];
    readonly closes: readonly string[];
    readonly behindBase: boolean;
    /** Its place in a stack; `null` for a pull request in none. */
    readonly stack: WorldStackPlace | null;
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
    /** The answer's data when it fails with an error: its field `null`. */
    readonly refused: GitHubOperationData<TName>;
}

/** How many checks a pull request of the world runs. */
const CHECK_COUNT = 5;
/** The tip of every base branch of the world; each pull request is up to date with it but those behind it. */
const BASE_OID = '0000000000000000000000000000000000000001';
/** Where a pull request behind its base branch was last rebased on. */
const STALE_BASE_OID = '0000000000000000000000000000000000000002';
/** A connection the world answers whole: no page after it. */
const LAST_PAGE = { hasNextPage: false, endCursor: null };
/** The comments an opened item reads at once (`commentPage: comments(last: 50)`), and per older page. */
const COMMENT_PAGE = 50;
const OLDER_COMMENT_PAGE = 100;

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

/** How many items `ProjectFull` reads with the project. */
const PROJECT_FIRST_PAGE = 100;

/**
 * A small GitHub for the e2e tests: repositories with issues and pull requests, some found by the four "my work"
 * searches, the viewer's organisations, and projects with a "Status", saved views and draft issues.
 * {@link install} makes a {@link GitHubMock} answer from it, with the shapes of the generated SDK: the searches by
 * their query; `ItemsByIds`, `PullRequestStatuses`, `PullRequestStacks` (its {@link stack}s), `ItemDetails`,
 * `ItemDetail` and `MoreComments` by node id (the check list and the reviews left out); `ItemByNumber`;
 * `RepositoryMetadata`; `ViewerProjects` (every project of the world is the viewer's).
 *
 * It answers tracking as GitHub does: what the tracking screens offer (the viewer's repositories and projects,
 * their organisations' — one hiding its private data left out with an error), a lookup by name, a tracked
 * repository's download (`RepositoryIssues`, `RepositoryPullRequests`) and its change list
 * (`GET /repos/{o}/{r}/issues?since=`), a tracked project's download and re-reads (`ProjectFull`,
 * `ProjectSchema`, `ProjectItems` — `updated:>=` by day, any other query matched against the titles, as GitHub
 * answers a saved view's free text) and its change signal (`GET /users|orgs/{o}/projectsV2/{n}`). Both REST
 * answers carry an ETag that is a hash of what they say, answered `304` while it is the one the app sent back.
 *
 * It answers the app's edits as GitHub does: each mutation changes the world and answers with the state it
 * then has — unless the test said GitHub fails it ({@link failEdit}). {@link holdEdits} keeps their answers
 * back, to see an edit before GitHub confirms it; {@link edits} lists what the app sent, {@link stateOf} what an
 * item is now. And it can change while the app runs ({@link retitle}, {@link setStatus}, {@link leave},
 * {@link delete}), as GitHub does between two polls.
 */
export class GitHubWorld {
    private readonly items = new Map<string, WorldItem>();
    private readonly repositories = new Map<string, WorldRepository>();
    private readonly projects = new Map<string, WorldProject>();
    private readonly stacks = new Map<string, WorldStack>();
    private readonly organizations = new Map<string, GitHubWorldOrganizationParams>();
    private readonly heldSearches = new Map<MyWorkSearch, Promise<void>>();
    private readonly failures = new Map<string, GitHubWorldFailure>();
    private readonly received: GitHubWorldEdit[] = [];
    private heldEdits: Promise<void> | null = null;
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
        repository.isPrivate = params.isPrivate ?? repository.isPrivate;
        repository.isArchived = params.isArchived ?? repository.isArchived;
        repository.issuesDisabled = params.issuesDisabled ?? repository.issuesDisabled;
        repository.templates = params.templates ?? repository.templates;
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
    organization(login: string, params: GitHubWorldOrganizationParams = {}): void {
        this.organizations.set(login, params);
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
            projects,
        };
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
    }

    private installReads(github: GitHubMock) {
        github.graphql('RepositoryMetadata', ({ variables }) => {
            const repository = this.repositories.get(`${String(variables.owner)}/${String(variables.name)}`);
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
        github.graphql('MoreComments', ({ variables }) => {
            const id = String(variables.id);
            const item = this.readItem(id);
            if (!item) {
                return new GitHubPartialAnswer<'MoreComments'>({ node: null }, [notFoundError(id, ['node'])]);
            }

            const before = parseCursor(variables.before) ?? item.comments.length;
            return { node: { id, commentPage: toCommentPage(item, before, OLDER_COMMENT_PAGE) } };
        });
    }

    /** What tracking reads: the candidates, a lookup by name, the downloads and the re-reads of projects. */
    private installTracking(github: GitHubMock) {
        github.graphql('TrackingCandidates', () => {
            const errors: GitHubGraphQLErrorEntry[] = [];
            const nodes = [...this.organizations].map(([login, organization], index) => {
                if (organization.hidesPrivateData) {
                    errors.push(restrictedError(login, ['viewer', 'organizations', 'nodes', index]));
                    return null;
                }

                return {
                    login,
                    avatarUrl: `https://avatars.githubusercontent.com/${login}`,
                    repositories: this.toCandidatePage(login, false),
                };
            });
            return new GitHubPartialAnswer<'TrackingCandidates'>(
                {
                    viewer: {
                        login: this.viewer,
                        repositories: this.toCandidatePage(this.viewer, false),
                        organizations: { nodes },
                    },
                },
                errors,
            );
        });
        github.graphql('OrganizationRepositories', ({ variables }) => {
            const login = String(variables.login);
            const organization = this.organizations.get(login);
            return {
                organization: organization
                    ? { repositories: this.toCandidatePage(login, organization.hidesPrivateData ?? false) }
                    : null,
            };
        });
        github.graphql('TrackingProjects', () => {
            const errors: GitHubGraphQLErrorEntry[] = [];
            const nodes = [...this.organizations].map(([login, organization], index) => {
                if (organization.hidesPrivateData) {
                    errors.push(restrictedError(login, ['viewer', 'organizations', 'nodes', index]));
                    return null;
                }

                const projects = this.projectsOf(login);
                return { login, projectsV2: { totalCount: projects.length, nodes: projects } };
            });
            const own = this.projectsOf(this.viewer);
            return new GitHubPartialAnswer<'TrackingProjects'>(
                {
                    viewer: { projectsV2: { totalCount: own.length, nodes: own }, organizations: { nodes } },
                },
                errors,
            );
        });
        github.graphql('RepositoryForTracking', ({ variables }) => {
            const repository = this.repositories.get(`${String(variables.owner)}/${String(variables.name)}`);
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
            const states = readStrings(variables.states);
            const nodes = this.readRepositoryItems(variables)
                ?.filter(item => !item.pullRequest && states.includes(item.state))
                .map(item => this.toIssueNode(item));
            return nodes
                ? { repository: { issues: { totalCount: nodes.length, pageInfo: LAST_PAGE, nodes } } }
                : new GitHubPartialAnswer<'RepositoryIssues'>({ repository: null }, [repositoryNotFound()]);
        });
        github.graphql('RepositoryPullRequests', ({ variables }) => {
            const states = readStrings(variables.states);
            const nodes = this.readRepositoryItems(variables)?.flatMap(item =>
                item.pullRequest && states.includes(item.state) ? [this.toPullRequestNode(item, item.pullRequest)] : [],
            );
            return nodes
                ? { repository: { pullRequests: { totalCount: nodes.length, pageInfo: LAST_PAGE, nodes } } }
                : new GitHubPartialAnswer<'RepositoryPullRequests'>({ repository: null }, [repositoryNotFound()]);
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
     * since then, the most recently updated first, with an ETag hashed from them — `304` while it is the one sent.
     */
    private answerRepositoryPoll(github: GitHubMock, repository: WorldRepository) {
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
    private readRepositoryItems(variables: Readonly<Record<string, unknown>>) {
        const name = `${String(variables.owner)}/${String(variables.name)}`;
        if (!this.repositories.has(name)) {
            return undefined;
        }

        return [...this.items.values()]
            .filter(item => !item.deleted && item.repository === name)
            .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    /** The repositories of `owner` as the tracking screens list them; only the public ones when `publicOnly`. */
    private toCandidatePage(owner: string, publicOnly: boolean): TrackingRepositoryPageFieldsFragment {
        const nodes = [...this.repositories.values()]
            .filter(repository => repository.nameWithOwner.split('/')[0] === owner)
            .filter(repository => !publicOnly || !repository.isPrivate)
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
     * else applied — the item's `updatedAt` moving to now — and answered with the item as it then is.
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

            if (failure?.kind !== 'drop') {
                handler.apply(item, variables);
                item.updatedAt = new Date().toISOString();
            }

            return handler.answer(item, variables);
        });
    }

    private createPullRequest(params: GitHubWorldPullRequestParams, stack: WorldStackPlace | null): WorldStackEntry {
        const pullRequest: WorldPullRequest = {
            isDraft: params.isDraft ?? false,
            reviewDecision: params.reviewDecision === undefined ? 'REVIEW_REQUIRED' : params.reviewDecision,
            failingChecks: params.failingChecks ?? 0,
            conflicts: params.conflicts ?? false,
            reviewRequests: [...(params.reviewRequests ?? [])],
            closes: params.closes ?? [],
            behindBase: params.behindBase ?? false,
            stack,
        };
        const item = this.createItem(`PR_${slug(params.repository)}_${params.number}`, params, pullRequest);
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

    private getRepository(nameWithOwner: string): WorldRepository {
        let repository = this.repositories.get(nameWithOwner);
        if (!repository) {
            repository = {
                nameWithOwner,
                viewerPermission: 'WRITE',
                labels: DEFAULT_LABELS,
                milestones: ['v1.0'],
                users: ['monalisa', 'hubot'],
                isPrivate: false,
                isArchived: false,
                issuesDisabled: false,
                templates: {},
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

    private toPullRequestNode(item: WorldItem, pullRequest: WorldPullRequest): PullRequestFieldsFragment {
        const { failingChecks, reviewDecision, stack: place } = pullRequest;
        const below = place && place.position > 1 ? place.stack.entries[place.position - 2] : undefined;
        return {
            ...this.createItemFields(item),
            __typename: 'PullRequest',
            state: item.state,
            isDraft: pullRequest.isDraft,
            merged: false,
            reviewDecision,
            mergeable: pullRequest.conflicts ? 'CONFLICTING' : 'MERGEABLE',
            mergeStateStatus: getMergeStateStatus(pullRequest),
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
            stack: place && { id: place.stack.id, number: place.stack.number, size: place.stack.entries.length },
            stackEntry: place && { position: place.position },
            baseRefOid: pullRequest.behindBase ? STALE_BASE_OID : BASE_OID,
            baseRef: { target: { oid: BASE_OID } },
            additions: 12 * item.number,
            deletions: 3 * item.number,
            changedFiles: 2,
            headRefName: toHeadRefName(item),
            baseRefName: below ? toHeadRefName(below.item) : 'main',
            closingIssuesReferences: { nodes: pullRequest.closes.map(issueId => ({ id: issueId })) },
        };
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

/** GitHub's error for an organisation's part it keeps from githq: OAuth App access restrictions (G5). */
function restrictedError(login: string, path: readonly (number | string)[]): GitHubGraphQLErrorEntry {
    return {
        type: 'FORBIDDEN',
        path,
        message: `Although you appear to have the correct authorization credentials, the \`${login}\` organization has enabled OAuth App access restrictions, meaning that data access to third-parties is limited.`,
    };
}

/** An ETag hashed from what an answer says, as GitHub's are: the same while nothing it says changes. */
function etagOf(value: unknown): string {
    let hash = 5381;
    for (const char of JSON.stringify(value)) {
        hash = (Math.imul(hash, 33) ^ (char.codePointAt(0) ?? 0)) >>> 0;
    }

    return `W/"${hash.toString(16)}"`;
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

function getMergeStateStatus(pullRequest: WorldPullRequest): MergeStateStatus {
    if (pullRequest.conflicts) {
        return 'DIRTY';
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

/** The index a cursor of the world stands for: a comment page's first comment, or a project page's next item. */
function parseCursor(value: unknown): number | undefined {
    const match = typeof value === 'string' ? /^C(\d+)$/.exec(value) : null;
    return match?.[1] === undefined ? undefined : Number(match[1]);
}

/** `acme/web` → `acme_web`, for node ids. */
/** The branch a pull request of the world is opened from. */
function toHeadRefName(item: WorldItem) {
    return `change-${item.number}`;
}

function slug(text: string) {
    return text.replace(/[^\w]/g, '_');
}
