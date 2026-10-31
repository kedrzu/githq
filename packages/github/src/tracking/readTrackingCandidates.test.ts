import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { createGitHubRequester } from '../createGitHubRequester.js';
import { getSdk } from '../generated.gen.js';
import type {
    TrackingCandidatesQuery,
    TrackingProjectFieldsFragment,
    TrackingProjectsQuery,
    TrackingRepositoryPageFieldsFragment,
} from '../generated.gen.js';
import type { GitHubGraphQLErrorEntry } from '../GitHubApiError.js';
import { readTrackingCandidates } from './readTrackingCandidates.js';
import type { TrackingCandidates } from './readTrackingCandidates.js';

// GitHub's answer for an organization with OAuth App access restrictions that has not approved the app, as
// reported by its users (the shape of `FORBIDDEN` errors; not reproduced live — see the M4 plan).
const RESTRICTED: GitHubGraphQLErrorEntry = {
    type: 'FORBIDDEN',
    path: ['viewer', 'organizations', 'nodes', 1, 'repositories'],
    message:
        'Although you appear to have the correct authorization credentials, the `acme` organization has enabled OAuth App access restrictions, meaning that data access to third-parties is limited. For more information on these restrictions, including how to enable this app, visit https://docs.github.com/articles/restricting-access-to-your-organization-s-data/',
};

const OWN_REPOSITORIES = repositoryPage('kedrzu/githq');
const ORG_REPOSITORIES = repositoryPage('lesscommerce/lesscms');
const ORG_PROJECT: TrackingProjectFieldsFragment = {
    id: 'PVT_1',
    title: 'Roadmap',
    number: 1,
    url: 'https://github.com/orgs/lesscommerce/projects/1',
    closed: false,
    updatedAt: '2026-10-30T10:00:00Z',
    items: { totalCount: 12 },
    owner: { __typename: 'Organization', login: 'lesscommerce' },
};

test('marks an organization that refused for its OAuth App restriction and keeps the rest of the read', async () => {
    const candidates: TrackingCandidatesQuery = {
        viewer: {
            login: 'kedrzu',
            repositories: OWN_REPOSITORIES,
            organizations: {
                nodes: [
                    { login: 'lesscommerce', avatarUrl: 'https://avatars.example/lc', repositories: ORG_REPOSITORIES },
                    null,
                ],
            },
        },
    };
    const projects: TrackingProjectsQuery = {
        viewer: {
            projectsV2: { totalCount: 0, nodes: [] },
            organizations: {
                nodes: [{ login: 'lesscommerce', projectsV2: { totalCount: 60, nodes: [ORG_PROJECT] } }, null],
            },
        },
    };
    const other: GitHubGraphQLErrorEntry = { type: 'NOT_FOUND', path: ['viewer', 'x'], message: 'Gone' };
    const sdk = sdkAnswering({
        TrackingCandidates: { data: candidates, errors: [RESTRICTED, other] },
        TrackingProjects: {
            data: projects,
            errors: [{ ...RESTRICTED, path: ['viewer', 'organizations', 'nodes', 1, 'projectsV2'] }],
        },
    });
    const reported: GitHubGraphQLErrorEntry[] = [];

    const result = await readTrackingCandidates(sdk, { onPartialErrors: errors => reported.push(...errors) });

    const expected: TrackingCandidates = {
        login: 'kedrzu',
        repositories: OWN_REPOSITORIES,
        projects: [],
        organizations: [
            {
                login: 'lesscommerce',
                avatarUrl: 'https://avatars.example/lc',
                repositories: ORG_REPOSITORIES,
                projects: [ORG_PROJECT],
                projectCount: 60,
                hiddenPrivate: false,
            },
            {
                login: 'acme',
                avatarUrl: 'https://github.com/acme.png',
                repositories: null,
                projects: [],
                projectCount: 0,
                hiddenPrivate: true,
            },
        ],
    };
    expect(result).toEqual(expected);
    expect(reported).toEqual([other]);
});

function repositoryPage(nameWithOwner: string): TrackingRepositoryPageFieldsFragment {
    return {
        totalCount: 1,
        pageInfo: { hasNextPage: false, endCursor: 'Y3Vy' },
        nodes: [
            {
                id: `R_${nameWithOwner}`,
                nameWithOwner,
                isPrivate: true,
                isArchived: false,
                pushedAt: '2026-10-30T10:00:00Z',
                viewerPermission: 'ADMIN',
                owner: { login: nameWithOwner.split('/')[0] ?? '' },
                issues: { totalCount: 3 },
                pullRequests: { totalCount: 1 },
            },
        ],
    };
}

function sdkAnswering(answers: Record<string, unknown>) {
    const fetch: Fetch = (_, init) => {
        const body = typeof init?.body === 'string' ? init.body : '';
        const operation = /\bquery (\w+)/.exec(body)?.[1] ?? '';
        return Promise.resolve(
            Response.json(answers[operation] ?? { errors: [{ message: `No answer for ${operation}` }] }),
        );
    };

    return getSdk(createGitHubRequester({ getToken: () => 'gho_token', fetch }));
}
