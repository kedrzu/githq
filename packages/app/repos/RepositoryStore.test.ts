/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import type {
    RepositoryLabelsQuery,
    RepositoryMetadataQuery,
    ViewerProjectsQuery,
} from '@githq/github/generated.gen.js';
import { createPromise } from '@nzyme/utils/createPromise.js';

import { createIndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import { ItemPersistence } from '@/store/ItemPersistence.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';

import { RepositoryPersistence } from './RepositoryPersistence.js';
import { RepositoryStore } from './RepositoryStore.js';
import type { RepositoryMetadata, ViewerProject } from './RepositoryTypes.js';

test("a repository's metadata is read once, used for 10 minutes — after a reload too — and read again after", async () => {
    const login = uniqueLogin();
    const before = setup(login);

    const metadata = await before.repositories.ensure('acme/web');
    await before.repositories.ensure('acme/web');

    const expected: RepositoryMetadata = {
        nameWithOwner: 'acme/web',
        id: 'R_web',
        viewerPermission: 'TRIAGE',
        hasIssuesEnabled: true,
        isArchived: false,
        labels: [{ id: 'LA_bug', name: 'bug', color: 'd73a4a', description: null }],
        milestones: [{ id: 'MI_1', title: 'v1', dueOn: null }],
        assignableUsers: [{ id: 'U_ewa', login: 'ewa', name: 'Ewa', avatarUrl: 'https://avatars.test/ewa' }],
        // The disabled type is not offered.
        issueTypes: [{ id: 'IT_bug', name: 'Bug', color: 'RED', description: null }],
        fetchedAt: before.session.clock.now(),
    };
    expect(metadata).toEqual(expected);
    expect(before.operations()).toEqual(['RepositoryMetadata']);
    await before.session.clock.advance(0);

    const after = setup(login);
    await after.session.clock.advance(5 * 60_000);
    expect(await after.repositories.ensure('acme/web')).toEqual(expected);
    expect(after.repositories.get('acme/web')).toEqual(expected);
    expect(after.operations()).toEqual([]);

    await after.session.clock.advance(6 * 60_000);
    expect((await after.repositories.ensure('acme/web'))?.fetchedAt).toBe(after.session.clock.now());
    expect(after.operations()).toEqual(['RepositoryMetadata']);
});

test('the labels past the first page are read too, from where it ended', async () => {
    const { repositories, session, operations } = setup(uniqueLogin());

    const metadata = await repositories.ensure('acme/big');

    expect(metadata?.labels.map(label => label.name)).toEqual(['bug', 'regression']);
    expect(operations()).toEqual(['RepositoryMetadata', 'RepositoryLabels']);
    expect(session.github.requests.at(-1)?.variables).toEqual({ owner: 'acme', name: 'big', after: 'LA_cursor' });
});

test("an organisation hiding its projects from githq leaves only its own out of the viewer's projects", async () => {
    const login = uniqueLogin();
    const { repositories } = setup(login);

    const projects = await repositories.ensureViewerProjects();

    const expected: ViewerProject[] = [
        {
            id: 'PVT_mine',
            title: 'Mine',
            number: 1,
            url: 'https://github.com/users/me/projects/1',
            owner: login,
            closed: false,
        },
        {
            id: 'PVT_acme',
            title: 'Roadmap',
            number: 3,
            url: 'https://github.com/orgs/acme/projects/3',
            owner: 'acme',
            closed: false,
        },
    ];
    expect(projects).toEqual(expected);
    expect(repositories.viewerProjects).toEqual(expected);
});

test('an answer arriving after the user signed out is dropped', async () => {
    const { repositories, session } = setup(uniqueLogin());
    const held = createPromise();
    session.github.hold = held.promise;
    const late = repositories.ensure('acme/web');
    await session.clock.advance(0);

    session.signOutFromAnotherTab();
    held.resolve();

    expect(await late).toBeNull();
    expect(repositories.get('acme/web')).toBeUndefined();
});

function setup(login: string) {
    const session = createTestSession({ login, answer });
    const persistence = createIndexedDbPersistence();
    session.container.set(ItemPersistence, persistence);
    session.container.set(RepositoryPersistence, persistence);
    // Opens the copy the metadata is kept in.
    session.container.resolve(ItemStore);
    const repositories = session.container.resolve(RepositoryStore);

    return {
        session,
        repositories,
        /** The operations asked of GitHub, besides the stored user's check. */
        operations: () => session.operations().filter(operation => operation !== 'Viewer'),
    };
}

function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
    switch (request.operation) {
        case 'RepositoryMetadata':
            return { data: repositoryMetadata(request.variables.name) };
        case 'RepositoryLabels': {
            const data: RepositoryLabelsQuery = {
                repository: {
                    labels: {
                        pageInfo: { hasNextPage: false, endCursor: null },
                        nodes: [{ id: 'LA_regression', name: 'regression', color: 'b60205', description: null }],
                    },
                },
            };
            return { data };
        }
        case 'ViewerProjects':
            return {
                data: viewerProjects(),
                errors: [
                    {
                        type: 'FORBIDDEN',
                        path: ['viewer', 'organizations', 'nodes', 0, 'projectsV2'],
                        message: 'The organization has enabled OAuth App access restrictions.',
                    },
                ],
            };
        default:
            return undefined;
    }
}

function repositoryMetadata(name: unknown): RepositoryMetadataQuery {
    return {
        repository: {
            id: 'R_web',
            nameWithOwner: `acme/${String(name)}`,
            viewerPermission: 'TRIAGE',
            isArchived: false,
            hasIssuesEnabled: true,
            labels: {
                // `acme/big` has more labels than a page holds.
                pageInfo: { hasNextPage: name === 'big', endCursor: 'LA_cursor' },
                nodes: [{ id: 'LA_bug', name: 'bug', color: 'd73a4a', description: null }],
            },
            milestones: { totalCount: 1, nodes: [{ id: 'MI_1', title: 'v1', dueOn: null }] },
            assignableUsers: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [{ id: 'U_ewa', login: 'ewa', name: 'Ewa', avatarUrl: 'https://avatars.test/ewa' }],
            },
            issueTypes: {
                nodes: [
                    { id: 'IT_bug', name: 'Bug', color: 'RED', description: null, isEnabled: true },
                    { id: 'IT_old', name: 'Old', color: 'GRAY', description: null, isEnabled: false },
                ],
            },
        },
    };
}

function viewerProjects(): ViewerProjectsQuery {
    return {
        viewer: {
            projectsV2: {
                nodes: [
                    {
                        id: 'PVT_mine',
                        title: 'Mine',
                        number: 1,
                        url: 'https://github.com/users/me/projects/1',
                        closed: false,
                    },
                ],
            },
            organizations: {
                nodes: [
                    // Hidden: GitHub nulls the organisation its projects could not be read from.
                    null,
                    {
                        login: 'acme',
                        projectsV2: {
                            nodes: [
                                {
                                    id: 'PVT_acme',
                                    title: 'Roadmap',
                                    number: 3,
                                    url: 'https://github.com/orgs/acme/projects/3',
                                    closed: false,
                                },
                            ],
                        },
                    },
                ],
            },
        },
    };
}

function uniqueLogin() {
    return `user-${crypto.randomUUID()}`;
}
