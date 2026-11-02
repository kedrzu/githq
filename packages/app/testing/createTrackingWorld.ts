import type {
    IssueFieldsFragment,
    ProjectFieldFieldsFragment,
    ProjectItemRowFieldsFragment,
    PullRequestFieldsFragment,
} from '@githq/github/generated.gen.js';

import type { ProjectFieldOption } from '@/store/ItemDetailTypes.js';

import type { TestGraphQLAnswer, TestGraphQLRequest, TestRestAnswer } from './createTestSession.js';

/** An issue or pull request of the fake GitHub. */
export type WorldItem = IssueFieldsFragment | PullRequestFieldsFragment;

/** The fake GitHub's tracked project: `acme`'s project 1, "Roadmap". */
export interface WorldProject {
    readonly id: string;
    readonly fields: ProjectFieldFieldsFragment[];
    items: ProjectItemRowFieldsFragment[];
    /** Its REST ETag: moved by the test on a change, as GitHub's moves. */
    etag: string;
    /** GitHub shows it to the user; when not, it answers as for a project that is not there. */
    shown: boolean;
    /** GitHub refuses its REST (403), as for a public project of an organisation the user is not in. */
    restRefused: boolean;
    /** ISO; moved by the test on a change, as GitHub's moves. */
    updatedAt: string;
}

/**
 * A fake GitHub for the tracked repositories and projects, answering the operations the sync and the edits ask —
 * a page holds {@link TRACKING_WORLD_PAGE_SIZE} items, so a few make several pages. The test changes it between
 * polls, as people would change GitHub.
 */
export interface TrackingWorld {
    /** Every issue and pull request, by node id. */
    readonly items: Map<string, WorldItem>;
    readonly project: WorldProject;
    /** The node ids "my work" finds assigned to the user. */
    assigned: string[];
    /**
     * Operations answered with a 502, by `<operation> <after>` (`RepositoryIssues 2`, `search null`), or a REST
     * `GET` by its operation (`GET /repos/acme/web/issues`).
     */
    readonly failing: Set<string>;
    /** Repositories whose change list GitHub refuses (403), as an organisation restricting OAuth Apps does. */
    readonly refusedRepositories: Set<string>;
    answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined;
    answerRest(request: TestGraphQLRequest): TestRestAnswer | undefined;
}

/** How many nodes a page of the fake GitHub holds. */
export const TRACKING_WORLD_PAGE_SIZE = 2;

const STATUS_OPTIONS: readonly ProjectFieldOption[] = [
    { id: 'O_todo', name: 'Todo', color: 'GRAY' },
    { id: 'O_done', name: 'Done', color: 'GREEN' },
];

/** The Status field of the fake project. */
export const WORLD_STATUS_FIELD: ProjectFieldFieldsFragment = {
    id: 'F_status',
    name: 'Status',
    dataType: 'SINGLE_SELECT',
    options: [...STATUS_OPTIONS],
};

/** Creates the fake GitHub with no items; the test adds them. */
export function createTrackingWorld(): TrackingWorld {
    const world: TrackingWorld = {
        items: new Map(),
        project: {
            id: 'PVT_1',
            fields: [WORLD_STATUS_FIELD],
            items: [],
            etag: '"p1"',
            shown: true,
            restRefused: false,
            updatedAt: '2026-10-30T12:00:00Z',
        },
        refusedRepositories: new Set(),
        assigned: [],
        failing: new Set(),
        answer,
        answerRest,
    };
    let nextItem = 1;
    return world;

    function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
        const { operation, variables } = request;
        const after = typeof variables.after === 'string' ? variables.after : null;
        if (world.failing.has(`${operation} ${after}`)) {
            return undefined;
        }

        if (operation.startsWith('Project') && !world.project.shown) {
            return { data: { node: null } };
        }

        switch (operation) {
            case 'ItemsByIds':
            case 'PullRequestStatuses': {
                const ids = Array.isArray(variables.ids) ? variables.ids.map(String) : [];
                const nodes = ids.map(id => (operation === 'ItemsByIds' ? (world.items.get(id) ?? null) : null));
                return { data: { nodes } };
            }
            case 'PullRequestStacks': {
                const ids = Array.isArray(variables.ids) ? variables.ids.map(String) : [];
                return { data: { nodes: ids.map(id => stackNode(id)) } };
            }
            case 'RepositoryIssues':
            case 'RepositoryPullRequests': {
                const nameWithOwner = `${String(variables.owner)}/${String(variables.name)}`;
                const states = Array.isArray(variables.states) ? variables.states.map(String) : [];
                const matching = [...world.items.values()].filter(
                    item =>
                        item.repository.nameWithOwner === nameWithOwner &&
                        (operation === 'RepositoryIssues'
                            ? item.__typename === 'Issue' && states.includes(item.issueState)
                            : item.__typename === 'PullRequest' && states.includes(item.state)),
                );
                const connection = toPage(matching, after);
                return {
                    data: {
                        repository:
                            operation === 'RepositoryIssues' ? { issues: connection } : { pullRequests: connection },
                    },
                };
            }
            case 'ProjectFull':
                return { data: { node: { ...projectNode(), items: toPage(world.project.items, null) } } };
            case 'ProjectUpdatedAt':
                return { data: { node: { updatedAt: world.project.updatedAt } } };
            case 'ProjectSchema':
                return { data: { node: { ...projectNode(), items: { totalCount: world.project.items.length } } } };
            case 'ProjectItems': {
                const query = String(variables.query);
                const since = /^updated:>=(\d{4}-\d{2}-\d{2})$/.exec(query)?.[1];
                const matching = world.project.items.filter(
                    item => since === undefined || item.updatedAt.slice(0, 10) >= since,
                );
                return { data: { node: { items: toPage(matching, after) } } };
            }
            case 'SetProjectFieldValue':
                return setFieldValue(variables);
            case 'AddDraftIssue':
                return addDraft(variables);
            case 'AddToProject':
                return addToProject(variables);
            default:
                return undefined;
        }
    }

    function answerRest(request: TestGraphQLRequest): TestRestAnswer | undefined {
        const path = request.operation.replace(/^GET /, '');
        const { variables } = request;
        if (world.failing.has(request.operation)) {
            return undefined;
        }

        if (path === '/search/issues') {
            if (world.failing.has('search null')) {
                return undefined;
            }

            const ids = String(variables.q).includes('assignee:@me') ? world.assigned : [];
            const found = ids.map(id => world.items.get(id)).filter(item => item !== undefined);
            return {
                status: 200,
                body: {
                    total_count: found.length,
                    incomplete_results: false,
                    items: found.map(item => toRestIssue(item)),
                },
            };
        }

        const repository = /^\/repos\/([^/]+\/[^/]+)\/issues$/.exec(path)?.[1];
        if (repository !== undefined) {
            if (world.refusedRepositories.has(repository)) {
                return { status: 403, body: { message: 'Although you appear to have the correct authorization' } };
            }

            const since = String(variables.since);
            const changed = [...world.items.values()]
                .filter(item => item.repository.nameWithOwner === repository && item.updatedAt >= since)
                .toSorted((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
            // Like GitHub's: a hash of the body, whatever the URL.
            const etag = `"${changed.map(item => `${item.id}@${item.updatedAt}`).join(',')}"`;
            return variables.ifNoneMatch === etag
                ? { status: 304 }
                : { status: 200, etag, body: changed.map(item => toRestIssue(item)) };
        }

        if (path === '/orgs/acme/projectsV2/1') {
            if (!world.project.shown) {
                return { status: 404, body: { message: 'Not Found' } };
            }

            if (world.project.restRefused) {
                return { status: 403, body: { message: 'Resource not accessible by integration' } };
            }

            return variables.ifNoneMatch === world.project.etag
                ? { status: 304 }
                : {
                      status: 200,
                      etag: world.project.etag,
                      body: { node_id: world.project.id, updated_at: world.project.updatedAt },
                  };
        }

        return undefined;
    }

    /** The stack the world's pull requests say they are in, as `PullRequestStacks` reads it; `null` for none. */
    function stackNode(id: string) {
        const entries: { pullRequest: PullRequestFieldsFragment }[] = [];
        for (const item of world.items.values()) {
            if (item.__typename === 'PullRequest' && item.stack?.id === id) {
                entries.push({ pullRequest: item });
            }
        }

        return entries.length > 0 ? { id, entries: { totalCount: entries.length, nodes: entries } } : null;
    }

    function projectNode() {
        return {
            id: world.project.id,
            title: 'Roadmap',
            number: 1,
            url: 'https://github.com/orgs/acme/projects/1',
            closed: false,
            updatedAt: world.project.updatedAt,
            viewerCanUpdate: true,
            owner: { __typename: 'Organization', login: 'acme' },
            fields: { nodes: world.project.fields },
            views: { nodes: [] },
        };
    }

    function setFieldValue(variables: Readonly<Record<string, unknown>>): TestGraphQLAnswer {
        const value = variables.value;
        const optionId =
            typeof value === 'object' && value !== null && 'singleSelectOptionId' in value
                ? String(value.singleSelectOptionId)
                : null;
        const option = STATUS_OPTIONS.find(candidate => candidate.id === optionId);
        const updatedAt = '2026-10-30T13:30:00Z';
        const fieldValue = option && toStatusValue(option);
        world.project.items = world.project.items.map(item =>
            item.id === variables.itemId
                ? { ...item, updatedAt, fieldValues: { nodes: fieldValue ? [fieldValue] : [] } }
                : item,
        );
        return {
            data: {
                updateProjectV2ItemFieldValue: {
                    projectV2Item: { id: variables.itemId, updatedAt, fieldValueByName: fieldValue ?? null },
                },
            },
        };
    }

    function addToProject(variables: Readonly<Record<string, unknown>>): TestGraphQLAnswer | undefined {
        const content = world.items.get(String(variables.contentId));
        if (!content) {
            return undefined;
        }

        const item = {
            ...worldProjectItem(`PVTI_added${nextItem++}`, content, null),
            updatedAt: '2026-10-30T13:30:00Z',
        };
        world.project.items = [...world.project.items, item];
        const project = projectNode();
        return {
            data: {
                addProjectV2ItemById: {
                    item: {
                        id: item.id,
                        isArchived: false,
                        updatedAt: item.updatedAt,
                        fieldValueByName: null,
                        fieldValues: { nodes: [] },
                        project: {
                            id: project.id,
                            title: project.title,
                            number: project.number,
                            url: project.url,
                            viewerCanUpdate: project.viewerCanUpdate,
                            fields: project.fields,
                        },
                    },
                },
            },
        };
    }

    function addDraft(variables: Readonly<Record<string, unknown>>): TestGraphQLAnswer {
        const id = `PVTI_draft${nextItem++}`;
        const item: ProjectItemRowFieldsFragment = {
            id,
            updatedAt: '2026-10-30T13:30:00Z',
            isArchived: false,
            type: 'DRAFT_ISSUE',
            fieldValues: { nodes: [] },
            content: {
                __typename: 'DraftIssue',
                id: `DI_${id}`,
                title: String(variables.title),
                body: typeof variables.body === 'string' ? variables.body : '',
                createdAt: '2026-10-30T13:30:00Z',
                updatedAt: '2026-10-30T13:30:00Z',
                creator: null,
                assignees: { nodes: [] },
            },
        };
        world.project.items = [...world.project.items, item];
        return { data: { addProjectV2DraftIssue: { projectItem: item } } };
    }
}

/** A project item holding an issue or pull request of the fake GitHub, with its Status. */
export function worldProjectItem(
    id: string,
    content: WorldItem,
    status: 'O_todo' | 'O_done' | null,
): ProjectItemRowFieldsFragment {
    const option = STATUS_OPTIONS.find(candidate => candidate.id === status);
    return {
        id,
        updatedAt: content.updatedAt,
        isArchived: false,
        type: content.__typename === 'Issue' ? 'ISSUE' : 'PULL_REQUEST',
        content,
        fieldValues: { nodes: option ? [toStatusValue(option)] : [] },
    };
}

function toStatusValue(option: ProjectFieldOption) {
    return {
        __typename: 'ProjectV2ItemFieldSingleSelectValue',
        optionId: option.id,
        name: option.name,
        color: option.color,
        field: { id: WORLD_STATUS_FIELD.id },
    } as const;
}

function toPage<T>(nodes: readonly T[], after: string | null) {
    const start = after === null ? 0 : Number(after);
    const end = start + TRACKING_WORLD_PAGE_SIZE;
    return {
        totalCount: nodes.length,
        pageInfo: { hasNextPage: end < nodes.length, endCursor: String(end) },
        nodes: nodes.slice(start, end),
    };
}

function toRestIssue(item: WorldItem) {
    return {
        node_id: item.id,
        number: item.number,
        updated_at: item.updatedAt,
        repository_url: `https://api.github.com/repos/${item.repository.nameWithOwner}`,
        ...(item.__typename === 'PullRequest' ? { pull_request: {} } : {}),
    };
}
