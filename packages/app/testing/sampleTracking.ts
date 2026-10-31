import type {
    CandidateProject,
    CandidateRepositories,
    CandidateRepository,
    TrackingCandidates,
} from '@/tracking/TrackingTypes.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import { SAMPLE_NOW } from './sampleMyWork.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** sigma-clinic's repositories of the mockups (G2, G4): the four first ones, then "pay" ones among many others. */
const SIGMA_NAMES: readonly [string, number, number, boolean?][] = [
    ['portal', 5 * MINUTE, 142],
    ['api', 20 * MINUTE, 96],
    ['payments', HOUR, 41],
    ['mobile', HOUR + 5 * MINUTE, 58],
    ['payments-worker', 3 * HOUR, 12],
    ['platform-infra', 2 * DAY, 31],
    ['payroll-export', 2 * DAY + HOUR, 9],
    ['stripe-pay-sdk', 7 * DAY, 23],
    ['payout-reports', 90 * DAY, 4],
    ['pay-e2e', 150 * DAY, 0],
    ['pay-portal-legacy', 700 * DAY, 6, true],
];

/** A candidate repository for stories and specs. */
export function sampleCandidateRepository(
    nameWithOwner: string,
    params: { ago: number; open: number; isPrivate?: boolean; isArchived?: boolean },
): CandidateRepository {
    return {
        id: `R_${nameWithOwner}`,
        nameWithOwner,
        owner: parseRepositoryName(nameWithOwner).owner,
        isPrivate: params.isPrivate ?? false,
        isArchived: params.isArchived ?? false,
        pushedAt: new Date(SAMPLE_NOW - params.ago).toISOString(),
        openIssues: Math.ceil(params.open / 2),
        openPullRequests: Math.floor(params.open / 2),
    };
}

/** A candidate project for stories and specs. */
export function sampleCandidateProject(
    title: string,
    owner: string,
    number: number,
    itemCount: number,
): CandidateProject {
    return {
        id: `PVT_${owner}_${number}`,
        title,
        number,
        owner,
        ownerKind: owner === 'kedrzu' ? 'user' : 'org',
        url: `https://github.com/${owner === 'kedrzu' ? 'users' : 'orgs'}/${owner}/projects/${number}`,
        closed: false,
        updatedAt: new Date(SAMPLE_NOW - number * DAY).toISOString(),
        itemCount,
    };
}

/** The user's own twelve public repositories: githq, skills, dotfiles, blog and eight more. */
const OWN: CandidateRepository[] = [
    sampleCandidateRepository('kedrzu/githq', { ago: 12 * MINUTE, open: 18 }),
    sampleCandidateRepository('kedrzu/skills', { ago: 2 * DAY, open: 7 }),
    sampleCandidateRepository('kedrzu/dotfiles', { ago: 21 * DAY, open: 0 }),
    sampleCandidateRepository('kedrzu/blog', { ago: 120 * DAY, open: 2 }),
    ...['notes', 'cv', 'talks', 'snippets', 'aoc-2025', 'homelab', 'recipes', 'nvim'].map((name, index) =>
        sampleCandidateRepository(`kedrzu/${name}`, { ago: (150 + index * 20) * DAY, open: index % 3 }),
    ),
];

/** The page of sigma-clinic's repositories first read: 20 of 312, the rest to come. */
const SIGMA: CandidateRepositories = {
    repositories: [
        ...SIGMA_NAMES.map(([name, ago, open, isArchived]) =>
            sampleCandidateRepository(`sigma-clinic/${name}`, {
                ago,
                open,
                isPrivate: name !== 'stripe-pay-sdk',
                isArchived,
            }),
        ),
        ...Array.from({ length: 9 }, (_, index) =>
            sampleCandidateRepository(`sigma-clinic/service-${index + 1}`, {
                ago: (200 + index * 10) * DAY,
                open: index,
                isPrivate: true,
            }),
        ),
    ],
    totalCount: 312,
    nextCursor: 'cursor-20',
};

/**
 * What the tracking screens offer in the mockups (G2): the user's twelve repositories and their project, sigma-clinic
 * with 312 repositories and four projects, and acme-health, which hides its private data from githq (G5).
 */
export const SAMPLE_CANDIDATES: TrackingCandidates = {
    login: 'kedrzu',
    repositories: { repositories: OWN, totalCount: OWN.length, nextCursor: null },
    projects: [sampleCandidateProject('githq Roadmap', 'kedrzu', 1, 34)],
    organizations: [
        {
            login: 'sigma-clinic',
            avatarUrl: '',
            hiddenPrivate: false,
            repositories: SIGMA,
            projects: [
                sampleCandidateProject('Platform Q4', 'sigma-clinic', 2, 128),
                sampleCandidateProject('Bug triage', 'sigma-clinic', 3, 61),
                sampleCandidateProject('Docs revamp', 'sigma-clinic', 4, 12),
                sampleCandidateProject('Mobile 2.0', 'sigma-clinic', 5, 210),
            ],
        },
        {
            login: 'acme-health',
            avatarUrl: '',
            hiddenPrivate: true,
            repositories: {
                repositories: [
                    sampleCandidateRepository('acme-health/fhir-tools', { ago: 3 * DAY, open: 14 }),
                    sampleCandidateRepository('acme-health/design-tokens', { ago: 14 * DAY, open: 3 }),
                    sampleCandidateRepository('acme-health/acme-health.github.io', { ago: 120 * DAY, open: 1 }),
                ],
                totalCount: 3,
                nextCursor: null,
            },
            projects: [],
        },
    ],
};

/** G10: a brand-new account with nothing to pick. */
export const EMPTY_CANDIDATES: TrackingCandidates = {
    login: 'kedrzu',
    repositories: { repositories: [], totalCount: 0, nextCursor: null },
    projects: [],
    organizations: [],
};

/** What the first sign-in chooses at first in the mockups: the user's own repositories and project. */
export const SAMPLE_OWN_CHOICE = {
    repositories: OWN.map(repository => repository.nameWithOwner),
    projects: ['PVT_kedrzu_1'],
};
