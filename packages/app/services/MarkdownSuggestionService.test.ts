/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import type { ReferenceSearchQuery, RepositoryMetadataQuery } from '@githq/github/generated.gen.js';

import type { PersonSuggestion } from '@/components/SuggestionTypes.js';
import { RepositoryPersistence } from '@/repos/RepositoryPersistence.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { createIndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import { ItemPersistence } from '@/store/ItemPersistence.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { uniqueLogin } from '@/testing/uniqueLogin.js';
import { TrackingPersistence } from '@/tracking/TrackingPersistence.js';

import { MarkdownSuggestionService } from './MarkdownSuggestionService.js';

const THREAD: readonly PersonSuggestion[] = [
    { login: 'sofiab', avatarUrl: 'https://avatars.test/sofiab' },
    { login: 'mlaine', avatarUrl: 'https://avatars.test/mlaine' },
    { login: 'sofiab', avatarUrl: 'https://avatars.test/sofiab' },
];

test("@: the thread's people come first, with the names the repository gives them, each once; then the repository's", async () => {
    const suggest = await setup();

    // "Sofia Berg" is found by her name, and before `bert`, whose login matches better.
    expect(logins(suggest.people({ repository: 'acme/web', query: 'be', thread: THREAD }))).toEqual([
        'sofiab Sofia Berg',
        'bert',
    ]);
    expect(logins(suggest.people({ repository: 'acme/web', query: '', thread: THREAD }))).toEqual([
        'sofiab Sofia Berg',
        'mlaine',
        'bert',
        'zlind Zoë Lind',
    ]);
    // As the pickers find: without the diacritics.
    expect(logins(suggest.people({ repository: 'acme/web', query: 'zoe', thread: THREAD }))).toEqual([
        'zlind Zoë Lind',
    ]);
});

test("#: GitHub's search answers by number first, then the numbers starting with the digits typed", async () => {
    const suggest = await setup();

    const found = await suggest.searchReferences({ repository: 'acme/web', query: '12' });

    expect(found.map(({ number }) => number)).toEqual([12, 120]);
    expect(suggest.references({ repository: 'acme/web', query: '12' })).toBeNull();
});

async function setup() {
    const session = createTestSession({ login: uniqueLogin(), answer });
    const persistence = createIndexedDbPersistence();
    session.container.set(ItemPersistence, persistence);
    session.container.set(RepositoryPersistence, persistence);
    session.container.set(TrackingPersistence, persistence);
    session.container.resolve(ItemStore);
    await session.container.resolve(RepositoryStore).ensure('acme/web');
    return session.container.resolve(MarkdownSuggestionService);
}

function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
    switch (request.operation) {
        case 'RepositoryMetadata':
            return { data: repositoryMetadata() };
        case 'ReferenceSearch': {
            const data: ReferenceSearchQuery = {
                search: { nodes: [issue(120, 'Lists flash empty'), issue(12, 'Sub-issue links are lost')] },
            };
            return { data };
        }
        default:
            return undefined;
    }
}

function repositoryMetadata(): RepositoryMetadataQuery {
    return {
        repository: {
            id: 'R_web',
            nameWithOwner: 'acme/web',
            viewerPermission: 'WRITE',
            isArchived: false,
            hasIssuesEnabled: true,
            mergeCommitAllowed: true,
            squashMergeAllowed: true,
            rebaseMergeAllowed: true,
            viewerDefaultMergeMethod: 'MERGE',
            autoMergeAllowed: false,
            deleteBranchOnMerge: false,
            viewerDefaultCommitEmail: null,
            viewerPossibleCommitEmails: [],
            labels: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
            milestones: { totalCount: 0, nodes: [] },
            assignableUsers: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                    { id: 'U_sofiab', login: 'sofiab', name: 'Sofia Berg', avatarUrl: 'https://avatars.test/sofiab' },
                    { id: 'U_bert', login: 'bert', name: null, avatarUrl: 'https://avatars.test/bert' },
                    { id: 'U_zlind', login: 'zlind', name: 'Zoë Lind', avatarUrl: 'https://avatars.test/zlind' },
                ],
            },
            issueTypes: { nodes: [] },
        },
    };
}

function issue(number: number, title: string): NonNullable<ReferenceSearchQuery['search']['nodes']>[number] {
    return { __typename: 'Issue', number, title, issueState: 'OPEN', stateReason: null };
}

function logins(people: readonly PersonSuggestion[]) {
    return people.map(({ login, name }) => (name ? `${login} ${name}` : login));
}
