import type { PullRequestState } from '@githq/github/generated.gen.js';

import type { CommitPullRequest, CommitRef, CommitState, KeptCommit } from '@/commits/CommitTypes.js';

import { createSeededRandom } from './createSeededRandom.js';

const EPOCH = Date.parse('2026-10-01T00:00:00Z');

/** A commit for tests and stories, committed `minutes` after a fixed epoch, its parents named by oid. */
export function sampleCommit(oid: string, minutes: number, parents: readonly string[] = []): KeptCommit {
    return {
        repository: 'acme/web',
        oid,
        id: `C_${oid}`,
        headline: `Commit ${oid}`,
        committedDate: new Date(EPOCH + minutes * 60_000).toISOString(),
        author: { name: 'Octo Cat', login: 'octocat', avatarUrl: null },
        parents: parents.map(parent => ({ id: `C_${parent}`, oid: parent })),
    };
}

/** Options of `sampleHistory`. */
export interface SampleHistoryOptions {
    readonly count: number;
    /** Seeds the generator, so the same options give the same history. */
    readonly seed: number;
    /** Dates some commits before their parents, as a skewed clock would. */
    readonly skew?: boolean;
}

/**
 * A random but reproducible history: branches off recent commits, merges (some octopus), new roots, and parents that
 * aren't loaded. Listed oldest first.
 */
export function sampleHistory(options: SampleHistoryOptions): KeptCommit[] {
    const random = createSeededRandom(options.seed);
    const commits: KeptCommit[] = [];

    for (let i = 0; i < options.count; i++) {
        const parents: string[] = [];
        if (i > 0 && random() > 0.03) {
            parents.push(`c${Math.max(0, i - 1 - Math.floor(random() * 8))}`);
            if (random() < 0.15) {
                parents.push(`c${Math.floor(random() * i)}`);
                if (random() < 0.1) {
                    parents.push(`c${Math.floor(random() * i)}`);
                }
            }
        }
        if (random() < 0.02) {
            parents.push(`missing${i}`);
        }
        const minutes = options.skew && random() < 0.05 ? (i - 30) * 10 : i * 10;
        commits.push(sampleCommit(`c${i}`, minutes, parents));
    }

    return commits;
}

/** A branch or tag named `name` pointing at the sample commit `oid`. */
export function sampleCommitRef(name: string, oid: string): CommitRef {
    return { name, oid, commitId: `C_${oid}`, committedDate: new Date(EPOCH).toISOString() };
}

/** The moment `sampleWebappHistory`'s ages are counted to: its newest commit is 12 minutes old. */
export const SAMPLE_COMMITS_NOW = EPOCH + 24 * 60 * 60_000;

/** `sampleWebappHistory`'s commits, refs and their pull request and CI state. */
export interface SampleWebappHistory {
    readonly commits: readonly KeptCommit[];
    readonly branches: readonly CommitRef[];
    readonly tags: readonly CommitRef[];
    readonly states: ReadonlyMap<string, CommitState>;
}

/**
 * A small history as CH12 draws it, in `acme/web`: `main` with a merged pull request, a release branch merged back
 * with its tag, a feature branch with an open pull request whose CI runs, a fix whose CI fails, and a draft and a
 * closed pull request. Its first commit is the repository's first.
 */
export function sampleWebappHistory(): SampleWebappHistory {
    const people = {
        rafal: { name: 'Rafał Hoffmann', login: 'rhoffmann', avatarUrl: null },
        marta: { name: 'Marta Laine', login: 'mlaine', avatarUrl: null },
        jan: { name: 'Jan Dvořák', login: 'jdvorak', avatarUrl: null },
        sam: { name: 'Sam Becker', login: null, avatarUrl: null },
    };
    const commit = (
        oid: string,
        hoursAgo: number,
        headline: string,
        author: KeptCommit['author'],
        parents: readonly string[] = [],
    ): KeptCommit => ({
        ...sampleCommit(oid, 24 * 60 - hoursAgo * 60, parents),
        headline,
        author,
    });

    const commits = [
        commit('a1', 0.2, 'feat: preview a class while dragging it in the week view', people.rafal, ['a3']),
        commit('a2', 0.6, "fix: booking time uses the studio's timezone", people.marta, ['a4']),
        commit('a3', 1, 'Merge pull request #1226 from acme/feat/member-search', people.jan, ['a4', 'a5']),
        commit('a4', 2, 'chore: bump vite to 6.2', people.sam, ['a6']),
        commit('a5', 5, 'feat: search members by email', people.jan, ['a6']),
        commit('a6', 9, "Merge branch 'release/4.2'", people.sam, ['a8', 'a7']),
        commit('a7', 12, 'fix: export CSV header encoding', people.marta, ['a8']),
        commit('a8', 20, 'chore: prepare the 4.2.1 release', people.marta, ['a9']),
        commit('a9', 23, 'Initial commit', people.marta),
    ];
    const states = new Map<string, CommitState>([
        ['a1', { pullRequest: samplePullRequest(1231, 'OPEN'), ci: 'PENDING' }],
        ['a2', { pullRequest: samplePullRequest(1228, 'OPEN'), ci: 'FAILURE' }],
        ['a3', { pullRequest: samplePullRequest(1226, 'MERGED'), ci: 'SUCCESS' }],
        ['a4', { pullRequest: samplePullRequest(1229, 'OPEN', true), ci: null }],
        ['a5', { pullRequest: samplePullRequest(1226, 'MERGED'), ci: 'SUCCESS' }],
        ['a6', { pullRequest: samplePullRequest(1214, 'CLOSED'), ci: null }],
        ['a7', { pullRequest: samplePullRequest(1209, 'MERGED'), ci: 'SUCCESS' }],
        ['a8', { pullRequest: null, ci: 'FAILURE' }],
    ]);

    return {
        commits,
        branches: [
            sampleCommitRef('feat/calendar-sync', 'a1'),
            sampleCommitRef('fix/booking-tz', 'a2'),
            sampleCommitRef('main', 'a3'),
            sampleCommitRef('release/4.2', 'a7'),
        ],
        tags: [sampleCommitRef('v4.2.1', 'a7')],
        states,
    };
}

function samplePullRequest(number: number, state: PullRequestState, isDraft = false): CommitPullRequest {
    return {
        number,
        state,
        title: `Pull request ${number}`,
        url: `https://github.com/acme/web/pull/${number}`,
        isDraft,
    };
}
