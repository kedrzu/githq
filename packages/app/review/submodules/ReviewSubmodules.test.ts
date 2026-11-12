/// <reference types="bun" />
import type { CommitPullRequest } from '@githq/github/readCommitPullRequests.js';
import type { ComparedCommit, ComparedFile } from '@githq/github/rest/compareCommits.js';
import { expect, test } from 'bun:test';
import { computed } from 'vue';

import { createTestSession } from '@/testing/createTestSession.js';
import type { TestGraphQLAnswer, TestGraphQLRequest, TestRestAnswer } from '@/testing/createTestSession.js';
import { uniqueLogin } from '@/testing/uniqueLogin.js';

import { ReviewSubmodules } from './ReviewSubmodules.js';
import type { ReviewSubmoduleChange, ReviewSubmoduleState } from './ReviewSubmodules.js';

const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);
const HEAD = 'head-1';
const NZYME = 'kedrzu/nzyme';
const BUMP: ReviewSubmoduleChange = {
    nameWithOwner: 'acme/web',
    headOid: HEAD,
    path: 'nzyme',
    before: OLD,
    after: NEW,
};

test('a forward bump asks for the head’s submodule URLs once for all of them, then one comparison and one pull-request query each; loading it again, or peeking, asks nothing', async () => {
    const github = createGitHub();
    github.compare(NZYME, OLD, NEW, {
        status: 'ahead',
        aheadBy: 260,
        commits: [commit('c1'), commit('c2')],
        files: [file('a.ts', 'modified')],
    });
    github.compare('kedrzu/skills', OLD, NEW, { status: 'ahead', aheadBy: 1, commits: [commit('c3')], files: [] });
    const open = pullRequest(7, 'OPEN');
    github.pullRequests(NZYME, NEW, [pullRequest(3, 'MERGED'), open, pullRequest(5, 'CLOSED')]);
    github.pullRequests('kedrzu/skills', NEW, []);
    const skills = { ...BUMP, path: 'skills' };
    const { session, submodules } = setup(github);
    const shown = computed(() => submodules.peek(BUMP).kind);

    expect(shown.value).toBe('waiting');
    await session.clock.advance(0);
    expect(requestsOf(session)).toEqual([]);

    submodules.load(BUMP);
    submodules.load(skills);
    await session.clock.advance(0);

    const expected: ReviewSubmoduleState = {
        kind: 'ready',
        repository: NZYME,
        relation: { kind: 'ahead', count: 260 },
        commits: [commit('c1'), commit('c2')],
        moreCommits: 258,
        files: [file('a.ts', 'modified')],
        moreFiles: false,
        pullRequests: [open],
    };
    expect(submodules.peek(BUMP)).toEqual(expected);
    expect(shown.value).toBe('ready');
    expect(submodules.peek(skills)).toMatchObject({ kind: 'ready', repository: 'kedrzu/skills', pullRequests: [] });
    const asked = [
        'CommitSubmodules acme/web@head-1',
        `GET /repos/kedrzu/nzyme/compare/${OLD}...${NEW}`,
        `GET /repos/kedrzu/skills/compare/${OLD}...${NEW}`,
        `CommitPullRequests kedrzu/nzyme@${NEW}`,
        `CommitPullRequests kedrzu/skills@${NEW}`,
    ];
    expect(requestsOf(session).toSorted()).toEqual(asked.toSorted());

    submodules.load(BUMP);
    submodules.load(skills);
    await session.clock.advance(0);
    expect(requestsOf(session)).toHaveLength(asked.length);
});

test('a rollback compares the other way round once more: the commits it drops, and the files as it moves them', async () => {
    const github = createGitHub();
    github.compare(NZYME, OLD, NEW, { status: 'behind', behindBy: 3, commits: [], files: [] });
    github.compare(NZYME, NEW, OLD, {
        status: 'ahead',
        aheadBy: 3,
        commits: [commit('c1'), commit('c2'), commit('c3')],
        files: [
            file('new.ts', 'added', { additions: 5 }),
            { ...file('moved.ts', 'renamed', { additions: 1, deletions: 2 }), previousPath: 'was.ts' },
        ],
    });
    github.pullRequests(NZYME, NEW, [pullRequest(3, 'MERGED')]);
    const { session, submodules } = setup(github);

    submodules.load(BUMP);
    await session.clock.advance(0);

    const expected: ReviewSubmoduleState = {
        kind: 'ready',
        repository: NZYME,
        relation: { kind: 'behind', count: 3 },
        commits: [commit('c1'), commit('c2'), commit('c3')],
        moreCommits: 0,
        files: [
            file('new.ts', 'removed', { deletions: 5 }),
            { ...file('was.ts', 'renamed', { additions: 2, deletions: 1 }), previousPath: 'moved.ts' },
        ],
        moreFiles: false,
        pullRequests: [pullRequest(3, 'MERGED')],
    };
    expect(submodules.peek(BUMP)).toEqual(expected);
    expect(requestsOf(session).filter(request => request.startsWith('GET '))).toEqual([
        `GET /repos/kedrzu/nzyme/compare/${OLD}...${NEW}`,
        `GET /repos/kedrzu/nzyme/compare/${NEW}...${OLD}`,
    ]);
});

test('diverged pointers list the commits brought in and count those left behind; 300 files say there may be more', async () => {
    const github = createGitHub();
    const files = Array.from({ length: 300 }, (_, index) => file(`f${index}.ts`, 'modified'));
    github.compare(NZYME, OLD, NEW, {
        status: 'diverged',
        aheadBy: 2,
        behindBy: 4,
        commits: [commit('c1'), commit('c2')],
        files,
    });
    github.pullRequests(NZYME, NEW, []);
    const { session, submodules } = setup(github);

    submodules.load(BUMP);
    await session.clock.advance(0);

    expect(submodules.peek(BUMP)).toMatchObject({
        kind: 'ready',
        relation: { kind: 'diverged', ahead: 2, behind: 4 },
        commits: [commit('c1'), commit('c2')],
        moreFiles: true,
    });
});

test('an added submodule asks only its URL and its pull requests; a removed one asks nothing', async () => {
    const github = createGitHub();
    github.pullRequests(NZYME, NEW, [pullRequest(7, 'OPEN')]);
    const { session, submodules } = setup(github);
    const added = { ...BUMP, before: null };
    const removed = { ...BUMP, after: null };

    submodules.load(removed);
    await session.clock.advance(0);
    expect(requestsOf(session)).toEqual([]);
    expect(submodules.peek(removed)).toEqual({
        kind: 'ready',
        repository: null,
        relation: { kind: 'removed' },
        commits: [],
        moreCommits: 0,
        files: [],
        moreFiles: false,
        pullRequests: [],
    });

    submodules.load(added);
    await session.clock.advance(0);
    expect(requestsOf(session)).toEqual(['CommitSubmodules acme/web@head-1', `CommitPullRequests kedrzu/nzyme@${NEW}`]);
    expect(submodules.peek(added)).toEqual({
        kind: 'ready',
        repository: NZYME,
        relation: { kind: 'added' },
        commits: [],
        moreCommits: 0,
        files: [],
        moreFiles: false,
        pullRequests: [pullRequest(7, 'OPEN')],
    });
});

test('a repository or pointer GitHub does not show, a submodule on another host and one the head does not declare are unreadable, not failed', async () => {
    const github = createGitHub();
    github.declare({ path: 'elsewhere', gitUrl: 'https://gitlab.com/kedrzu/nzyme.git' });
    github.pullRequests(NZYME, NEW, []);
    const { session, submodules } = setup(github);
    const elsewhere = { ...BUMP, path: 'elsewhere' };
    const undeclared = { ...BUMP, path: 'missing' };
    const unreadableHead = { ...BUMP, headOid: 'head-gone', before: NEW, after: OLD };

    // No comparison is answered: GitHub says 404.
    for (const change of [BUMP, elsewhere, undeclared, unreadableHead]) {
        submodules.load(change);
    }

    await session.clock.advance(0);

    expect(submodules.peek(BUMP)).toEqual({ kind: 'unreadable', repository: NZYME });
    expect(submodules.peek(elsewhere)).toEqual({ kind: 'unreadable', repository: null });
    expect(submodules.peek(undeclared)).toEqual({ kind: 'unreadable', repository: null });
    expect(submodules.peek(unreadableHead)).toEqual({ kind: 'unreadable', repository: null });
    // Only the GitHub-hosted one is compared.
    expect(requestsOf(session).filter(request => request.startsWith('GET '))).toEqual([
        `GET /repos/kedrzu/nzyme/compare/${OLD}...${NEW}`,
    ]);
});

test('a rate-limit refusal pauses the entry, nothing is asked until GitHub said, then it carries on by itself', async () => {
    const github = createGitHub();
    github.compare(NZYME, OLD, NEW, { status: 'ahead', aheadBy: 1, commits: [commit('c1')], files: [] });
    github.pullRequests(NZYME, NEW, [pullRequest(7, 'OPEN')]);
    github.rateLimit('CommitPullRequests');
    const { session, submodules } = setup(github);

    submodules.load(BUMP);
    await session.clock.advance(0);

    const until = session.clock.now() + 60_000;
    expect(submodules.peek(BUMP)).toEqual({ kind: 'paused', until });
    const asked = requestsOf(session).length;

    github.rateLimit(null);
    // Another entry asked meanwhile waits too.
    submodules.load({ ...BUMP, path: 'skills' });
    await session.clock.advance(59_000);
    expect(requestsOf(session)).toHaveLength(asked);
    expect(submodules.peek({ ...BUMP, path: 'skills' })).toEqual({ kind: 'paused', until });

    await session.clock.advance(1000);

    expect(submodules.peek(BUMP)).toMatchObject({ kind: 'ready', pullRequests: [pullRequest(7, 'OPEN')] });
});

test('any other failure fails the entry, and trying again reads it', async () => {
    const github = createGitHub();
    github.compare(NZYME, OLD, NEW, { status: 'ahead', aheadBy: 1, commits: [commit('c1')], files: [] });
    github.pullRequests(NZYME, NEW, []);
    github.failNext('CommitSubmodules');
    const { session, submodules } = setup(github);

    submodules.load(BUMP);
    await session.clock.advance(0);
    expect(submodules.peek(BUMP).kind).toBe('failed');

    submodules.load(BUMP);
    await session.clock.advance(0);
    expect(requestsOf(session)).toEqual(['CommitSubmodules acme/web@head-1']);

    submodules.retry(BUMP);
    await session.clock.advance(0);
    expect(submodules.peek(BUMP)).toMatchObject({ kind: 'ready', relation: { kind: 'ahead', count: 1 } });
});

test('another user signing in forgets what was read, and an answer for the one before is dropped', async () => {
    const github = createGitHub();
    github.compare(NZYME, OLD, NEW, { status: 'ahead', aheadBy: 1, commits: [commit('c1')], files: [] });
    github.pullRequests(NZYME, NEW, []);
    const { session, submodules } = setup(github);
    let release = () => {};
    session.github.hold = new Promise<void>(resolve => {
        release = resolve;
    });

    submodules.load(BUMP);
    await session.clock.advance(0);
    session.signInFromAnotherTab(uniqueLogin());
    release();
    await session.clock.advance(0);

    expect(submodules.peek(BUMP)).toEqual({ kind: 'waiting' });
});

interface TestComparison {
    readonly status: 'ahead' | 'behind' | 'diverged' | 'identical';
    readonly aheadBy?: number;
    readonly behindBy?: number;
    readonly commits: readonly ComparedCommit[];
    readonly files: readonly ComparedFile[];
}

interface TestSubmodule {
    readonly path: string;
    readonly gitUrl: string;
}

/** GitHub where `acme/web`'s head declares `nzyme` and `skills` and nothing else is there until a test adds it. */
function createGitHub() {
    const declared: TestSubmodule[] = [
        { path: 'nzyme', gitUrl: 'git@github.com:kedrzu/nzyme.git' },
        { path: 'skills', gitUrl: '../../kedrzu/skills.git' },
    ];
    const comparisons = new Map<string, TestComparison>();
    const associated = new Map<string, readonly CommitPullRequest[]>();
    const failing = new Set<string>();
    let rateLimited: string | null = null;

    return {
        declare: (submodule: TestSubmodule) => declared.push(submodule),
        compare: (nameWithOwner: string, base: string, head: string, comparison: TestComparison) =>
            comparisons.set(`GET /repos/${nameWithOwner}/compare/${base}...${head}`, comparison),
        pullRequests: (nameWithOwner: string, oid: string, pullRequests: readonly CommitPullRequest[]) =>
            associated.set(`${nameWithOwner}@${oid}`, pullRequests),
        failNext: (operation: string) => failing.add(operation),
        rateLimit: (operation: string | null) => {
            rateLimited = operation;
        },
        answer,
        answerRest,
    };

    function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
        if (failing.delete(request.operation)) {
            return undefined;
        }

        if (rateLimited === request.operation) {
            return { data: null, errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] };
        }

        const { owner, name, oid } = request.variables;
        switch (request.operation) {
            case 'CommitSubmodules':
                return {
                    data: {
                        repository:
                            owner === 'acme' && name === 'web' && oid === HEAD
                                ? { object: { submodules: { nodes: declared } } }
                                : null,
                    },
                };
            case 'CommitPullRequests': {
                const nodes = associated.get(`${String(owner)}/${String(name)}@${String(oid)}`);
                return { data: { repository: nodes ? { object: { associatedPullRequests: { nodes } } } : null } };
            }
            default:
                return undefined;
        }
    }

    function answerRest(request: TestGraphQLRequest): TestRestAnswer | undefined {
        const comparison = comparisons.get(request.operation);
        if (!comparison) {
            return { status: 404, body: { message: 'Not Found' } };
        }

        return {
            status: 200,
            body: {
                status: comparison.status,
                ahead_by: comparison.aheadBy ?? 0,
                behind_by: comparison.behindBy ?? 0,
                total_commits: comparison.aheadBy ?? 0,
                commits: comparison.commits.map(entry => ({
                    sha: entry.oid,
                    commit: { message: `${entry.subject}\n\nBody`, author: { name: 'Someone' } },
                    author: { login: entry.author },
                })),
                files: comparison.files.map(entry => ({
                    filename: entry.path,
                    previous_filename: entry.previousPath ?? undefined,
                    status: entry.status,
                    additions: entry.additions,
                    deletions: entry.deletions,
                })),
            },
        };
    }
}

function setup(github: ReturnType<typeof createGitHub>) {
    const session = createTestSession({ login: uniqueLogin(), answer: github.answer, answerRest: github.answerRest });
    return { session, submodules: session.container.resolve(ReviewSubmodules) };
}

/** What GitHub was asked, a GraphQL query with the commit it asked about. */
function requestsOf(session: ReturnType<typeof createTestSession>) {
    return session.github.requests
        .filter(({ operation }) => operation !== 'Viewer')
        .map(({ operation, variables }) =>
            operation.startsWith('GET ')
                ? operation
                : `${operation} ${String(variables.owner)}/${String(variables.name)}@${String(variables.oid)}`,
        );
}

function commit(oid: string): ComparedCommit {
    return { oid, subject: `Commit ${oid}`, author: 'kedrzu' };
}

interface TestFileLines {
    readonly additions?: number;
    readonly deletions?: number;
}

function file(path: string, status: string, { additions = 0, deletions = 0 }: TestFileLines = {}): ComparedFile {
    return { path, previousPath: null, status, additions, deletions };
}

function pullRequest(number: number, state: CommitPullRequest['state']): CommitPullRequest {
    return {
        number,
        state,
        title: `PR ${number}`,
        url: `https://github.com/kedrzu/nzyme/pull/${number}`,
        isDraft: false,
    };
}
