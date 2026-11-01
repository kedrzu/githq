/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type {
    IssueFieldsFragment,
    PullRequestFieldsFragment,
    PullRequestStatusFieldsFragment,
} from '@githq/github/generated.gen.js';
import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import { createTestContainer } from '@nzyme/ioc-testing/createTestContainer.js';
import { createPromise } from '@nzyme/utils/createPromise.js';

import { AuthStore, TOKEN_KEY, VIEWER_KEY } from '@/auth/AuthStore.js';
import type { BrowserShape } from '@/services/Browser.js';
import { Browser } from '@/services/Browser.js';
import type { ClockShape } from '@/services/Clock.js';
import { Clock } from '@/services/Clock.js';
import { createTestTabs } from '@/testing/createTestTabs.js';
import { ProjectPersistence } from '@/projects/ProjectPersistence.js';
import type { PersistedItems } from '@/store/ItemPersistence.js';
import { ItemPersistence } from '@/store/ItemPersistence.js';
import { ItemStore } from '@/store/ItemStore.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import type { MyWorkGroup } from '@/store/ItemStoreTypes.js';
import { TrackingPersistence } from '@/tracking/TrackingPersistence.js';

import type { Freshness } from './Freshness.js';
import type { SyncNotice } from './SyncEngine.js';
import { EDIT_RESERVE } from './getAllowancePause.js';
import { SyncEngine } from './SyncEngine.js';

const START = Date.UTC(2026, 9, 30, 13, 0, 0);
const MONDAY = '2026-10-26T10:00:00Z';
const TUESDAY = '2026-10-27T10:00:00Z';
const WEDNESDAY = '2026-10-28T10:00:00Z';

const REPOSITORY: IssueFieldsFragment['repository'] = {
    nameWithOwner: 'acme/web',
    isPrivate: false,
    viewerPermission: 'WRITE',
    owner: { login: 'acme' },
};

const QUERIES: Record<MyWorkGroup, string> = {
    reviewRequested: 'is:open is:pr review-requested:@me archived:false',
    authored: 'is:open is:pr author:@me archived:false',
    assigned: 'is:open is:issue assignee:@me archived:false',
    mentioned: 'is:open mentions:@me archived:false',
};

test('a poll runs the four searches, re-reads only new or changed items, drops deleted ones, and an item no search finds leaves my work and the local copy', async () => {
    const github = fakeGitHub();
    github.found.assigned = [issueNode('I_1', MONDAY), issueNode('I_9', MONDAY)];
    github.found.authored = [pullRequestNode('PR_1', MONDAY)];
    // Deleted between the search and the re-read.
    github.deleted.add('I_9');
    const { items, clock } = await setup(github, 'alice');

    expect(github.searches()).toEqual([QUERIES.reviewRequested, QUERIES.authored, QUERIES.assigned, QUERIES.mentioned]);
    // Each group's new items are read as its search answers.
    expect(github.graphql('ItemsByIds')).toEqual([['PR_1'], ['I_1', 'I_9']]);
    expect(items.get('I_1')?.updatedAt).toBe(MONDAY);
    expect(items.get('I_9')).toBeUndefined();
    expect(items.membership.assigned).toEqual(new Set(['I_1']));
    expect(items.membership.authored).toEqual(new Set(['PR_1']));

    // Nothing moved (and the search caught up with the deletion): searched again, nothing re-read.
    github.found.assigned = [issueNode('I_1', MONDAY)];
    github.requests.length = 0;
    await clock.advance(30_000);
    expect(github.searches()).toHaveLength(4);
    expect(github.graphql('ItemsByIds')).toEqual([]);

    // The issue was edited, then unassigned: it is re-read only when it moved, and leaves when no search has it.
    github.found.assigned = [issueNode('I_1', TUESDAY)];
    await clock.advance(30_000);
    expect(github.graphql('ItemsByIds')).toEqual([['I_1']]);
    expect(items.get('I_1')?.updatedAt).toBe(TUESDAY);

    // Mentioned too: unassigned, it stays for the mention.
    github.found.mentioned = [issueNode('I_1', TUESDAY)];
    github.found.assigned = [];
    await clock.advance(30_000);
    expect(items.membership.assigned).toEqual(new Set());
    expect(items.get('I_1')?.updatedAt).toBe(TUESDAY);

    // In no group any more: it leaves the local copy; the pull request, still mine, stays.
    github.found.mentioned = [];
    await clock.advance(30_000);
    expect(items.membership.mentioned).toEqual(new Set());
    expect(items.get('I_1')).toBeUndefined();
    expect(items.get('PR_1')?.updatedAt).toBe(MONDAY);
});

test('an item GitHub will not show, or shows without a field it refuses, does not stop the poll', async () => {
    const github = fakeGitHub();
    const hidden = issueNode('I_hidden', MONDAY);
    github.found.assigned = [issueNode('I_1', MONDAY), hidden];
    // In an organisation with OAuth App restrictions: its project's place comes back `null`, the rest is there.
    github.found.authored = [{ ...pullRequestNode('PR_1', MONDAY), projectItems: { nodes: [null] } }];
    github.forbiddenProject.set('PR_1', 0);
    const { items, clock } = await setup(github, 'alice');

    expect(items.get('PR_1')).toMatchObject({ kind: 'pullRequest', projects: [] });
    expect(items.membership.authored).toEqual(new Set(['PR_1']));
    expect(items.get('I_hidden')?.updatedAt).toBe(MONDAY);

    // Changed, but now hidden behind a restriction: the kept copy stays, and the poll still succeeds.
    github.found.assigned = [issueNode('I_1', MONDAY), { ...hidden, updatedAt: TUESDAY }];
    github.refused.set('I_hidden', {
        type: 'FORBIDDEN',
        message: 'Resource protected by organization SAML enforcement.',
    });
    await clock.advance(30_000);

    expect(items.get('I_hidden')?.updatedAt).toBe(MONDAY);
    expect(items.membership.assigned).toEqual(new Set(['I_1', 'I_hidden']));
    expect(items.getSyncState('myWork')).toMatchObject({ lastSuccessAt: START + 30_000, lastError: null });
});

test('each group is written as its search answers: one that fails later leaves the groups before it in place', async () => {
    const github = fakeGitHub();
    github.found.reviewRequested = [pullRequestNode('PR_review', MONDAY)];
    github.found.authored = [pullRequestNode('PR_1', MONDAY)];
    github.found.assigned = [issueNode('I_1', MONDAY)];
    github.failSearch = 'assigned';
    const { items } = await setup(github, 'alice');

    expect(items.membership).toEqual({ reviewRequested: new Set(['PR_review']), authored: new Set(['PR_1']) });
    expect(items.get('PR_1')?.updatedAt).toBe(MONDAY);
    expect(items.getSyncState('myWork')).toMatchObject({ lastSuccessAt: null, lastError: expect.any(String) });
});

test('the open pull requests of my work get their status re-read, without the rest of the item', async () => {
    const github = fakeGitHub();
    github.found.authored = [pullRequestNode('PR_1', MONDAY)];
    const { items, clock } = await setup(github, 'alice');
    github.requests.length = 0;

    github.statuses.set('PR_1', { ...pullRequestNode('PR_1', MONDAY), reviewDecision: 'APPROVED' });
    await clock.advance(60_000);

    expect(github.graphql('PullRequestStatuses')).toEqual([['PR_1']]);
    expect(items.get('PR_1')).toMatchObject({ kind: 'pullRequest', reviewDecision: 'APPROVED', updatedAt: MONDAY });
});

test('after signing out nothing more is asked of GitHub', async () => {
    const github = fakeGitHub();
    const { auth, clock } = await setup(github, 'alice');
    expect(github.requests.length).toBeGreaterThan(0);
    github.requests.length = 0;

    auth.signOut();
    await clock.advance(60 * 60_000);

    expect(github.requests).toEqual([]);
});

test("an answer for a session that has ended — another account took over in another tab — is not written into the new account's copy", async () => {
    const github = fakeGitHub();
    github.found.assigned = [issueNode('I_alice', MONDAY)];
    const held = createPromise();
    github.hold = held.promise;
    const { items, clock, fromAnotherTab } = await setup(github, 'alice');
    // Alice's re-read of her issue is on its way.
    expect(github.graphql('ItemsByIds')).toEqual([['I_alice']]);
    const switchedAt = github.requests.length;

    github.found.assigned = [];
    github.hold = null;
    fromAnotherTab({ [TOKEN_KEY]: 'gho_bob', [VIEWER_KEY]: JSON.stringify(viewerOf('bob')) });
    await items.ready();
    await clock.advance(0);

    held.resolve();
    await clock.advance(10 * 60_000);

    expect(items.get('I_alice')).toBeUndefined();
    expect(items.membership.assigned).toEqual(new Set());
    // Bob's loops polled; Alice's asked nothing more.
    const tokens = new Set(github.requests.slice(switchedAt).map(request => request.token));
    expect(tokens).toEqual(new Set(['gho_bob']));
});

test('a used-up search allowance pauses the loop until it resets: no request meanwhile, and the bar says until when', async () => {
    const github = fakeGitHub();
    github.searchAllowance = { remaining: 0, resetAt: START + 90_000 };
    const { sync, clock } = await setup(github, 'alice');

    // The first search reported the bucket empty: the next one is not sent.
    expect(github.searches()).toHaveLength(1);
    const expectedNotice: SyncNotice = {
        kind: 'paused',
        until: START + 90_000,
        allowance: { resource: 'search', limit: 30, remaining: 0, resetAt: new Date(START + 90_000) },
    };
    expect(sync.notice).toEqual(expectedNotice);
    const expectedFreshness: Freshness = { kind: 'paused', since: null, until: START + 90_000 };
    expect(sync.myWorkFreshness).toEqual(expectedFreshness);

    github.searchAllowance = { remaining: 29, resetAt: START + 150_000 };
    await clock.advance(89_000);
    expect(github.searches()).toHaveLength(1);

    await clock.advance(1000);
    expect(github.searches()).toHaveLength(5);
    expect(sync.notice).toBeNull();
    expect(sync.myWorkFreshness.kind).toBe('fresh');
});

test("polling pauses with the GraphQL allowance down to what is kept for the user's edits, and resumes at the reset", async () => {
    const github = fakeGitHub();
    github.found.assigned = [issueNode('I_1', MONDAY)];
    const { sync, items, clock } = await setup(github, 'alice');

    // Read while more was known to be left; GitHub's answer says only the reserve is.
    github.graphqlAllowance = { remaining: EDIT_RESERVE, resetAt: START + 600_000 };
    github.found.assigned = [issueNode('I_1', TUESDAY)];
    await clock.advance(30_000);
    expect(github.graphql('ItemsByIds')).toEqual([['I_1'], ['I_1']]);

    // Changed again on GitHub: not read while only the reserve is left.
    github.found.assigned = [issueNode('I_1', WEDNESDAY)];
    await clock.advance(30_000);
    expect(github.graphql('ItemsByIds')).toHaveLength(2);
    expect(sync.notice).toMatchObject({
        kind: 'paused',
        until: START + 600_000,
        allowance: { resource: 'graphql', remaining: EDIT_RESERVE },
    });

    github.graphqlAllowance = { remaining: 5000, resetAt: START + 4_200_000 };
    await clock.advance(540_000);
    expect(sync.notice).toBeNull();
    expect(items.get('I_1')?.updatedAt).toBe(WEDNESDAY);
});

test('GitHub asking to slow down (403 with retry-after) pauses the loop for that long', async () => {
    const github = fakeGitHub();
    github.refuseSearch = { status: 403, retryAfter: 120 };
    const { sync, clock } = await setup(github, 'alice');
    expect(github.searches()).toHaveLength(1);
    expect(sync.notice).toEqual({ kind: 'paused', until: START + 120_000, allowance: null });

    github.refuseSearch = null;
    await clock.advance(119_000);
    expect(github.searches()).toHaveLength(1);

    await clock.advance(1000);
    expect(github.searches()).toHaveLength(5);
});

test('a slow poll is never overlapped by the next one — not by its timer, the tab being shown or the connection coming back', async () => {
    const github = fakeGitHub();
    const held = createPromise();
    github.holdSearch = held.promise;
    const { clock, browser } = await setup(github, 'alice');
    expect(github.searches()).toHaveLength(1);

    await clock.advance(10 * 60_000);
    browser.hide();
    browser.show();
    browser.goOffline();
    browser.goOnline();
    await clock.advance(0);
    expect(github.searches()).toHaveLength(1);

    github.holdSearch = null;
    held.resolve();
    await clock.advance(0);
    expect(github.searches()).toHaveLength(4);

    await clock.advance(30_000);
    expect(github.searches()).toHaveLength(8);
});

test('freshness: up to date after a poll, still up to date while the next one runs, stale "as of" the last success when offline', async () => {
    const github = fakeGitHub();
    const { sync, clock, browser } = await setup(github, 'alice');
    const polledAt = START;
    expect(sync.myWorkFreshness).toEqual({ kind: 'fresh', checkedAt: polledAt });

    browser.goOffline();
    // Fresh for an interval and some slack, whatever happens.
    await clock.advance(40_000);
    expect(sync.myWorkFreshness).toEqual({ kind: 'fresh', checkedAt: polledAt });
    expect(sync.notice).toEqual({ kind: 'offline', since: START });

    await clock.advance(10_000);
    const expected: Freshness = { kind: 'stale', since: polledAt, reason: 'offline' };
    expect(sync.myWorkFreshness).toEqual(expected);
    expect(github.searches()).toHaveLength(4);

    browser.goOnline();
    await clock.advance(0);
    expect(github.searches()).toHaveLength(8);
    expect(sync.myWorkFreshness).toEqual({ kind: 'fresh', checkedAt: START + 50_000 });
});

interface FakeRequest {
    readonly url: string;
    readonly token: string;
    /** The search query, or the GraphQL operation's name. */
    readonly name: string;
    readonly ids: readonly string[];
}

interface FakeGitHub {
    /** What each "my work" search finds; the node reads answer from these too. */
    found: Partial<Record<MyWorkGroup, readonly (IssueFieldsFragment | PullRequestFieldsFragment)[]>>;
    /** Read back as `null`, with a `NOT_FOUND` error at the node. */
    deleted: Set<string>;
    /** Read back as `null`, with this error at the node or (with a `path`) under it. */
    refused: Map<string, GitHubGraphQLErrorEntry>;
    /**
     * Read with a `FORBIDDEN` error at the project of this index of `projectItems` — an organisation's OAuth App
     * restrictions; the node itself should already have `null` there.
     */
    forbiddenProject: Map<string, number>;
    /** What `PullRequestStatuses` answers, over `found`. */
    statuses: Map<string, PullRequestStatusFieldsFragment>;
    requests: FakeRequest[];
    searchAllowance: { remaining: number; resetAt: number };
    graphqlAllowance: { remaining: number; resetAt: number };
    refuseSearch: { status: number; retryAfter: number } | null;
    /** This group's search fails with a 502. */
    failSearch: MyWorkGroup | null;
    /** GraphQL answers wait for it. */
    hold: Promise<void> | null;
    /** Searches wait for it. */
    holdSearch: Promise<void> | null;
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
    /** The queries searched, in order. */
    searches(): string[];
    /** The ids each call of the GraphQL operation `name` asked for. */
    graphql(name: string): (readonly string[])[];
}

/** GitHub answering the searches from `found` and the node reads from what the searches found. */
function fakeGitHub(): FakeGitHub {
    const github: FakeGitHub = {
        found: {},
        deleted: new Set(),
        refused: new Map(),
        forbiddenProject: new Map(),
        statuses: new Map(),
        requests: [],
        searchAllowance: { remaining: 29, resetAt: START + 60_000 },
        graphqlAllowance: { remaining: 4800, resetAt: START + 3_600_000 },
        refuseSearch: null,
        failSearch: null,
        hold: null,
        holdSearch: null,
        fetch,
        searches: () =>
            github.requests.filter(request => request.url.includes('/search/')).map(request => request.name),
        graphql: name => github.requests.filter(request => request.name === name).map(request => request.ids),
    };
    // Every item a search ever found, as the node reads answer it — also once no search finds it.
    const known = new Map<string, IssueFieldsFragment | PullRequestFieldsFragment>();
    return github;

    async function fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        const token = (new Headers(init?.headers).get('Authorization') ?? '').replace('Bearer ', '');

        if (url.pathname === '/search/issues') {
            const q = url.searchParams.get('q') ?? '';
            github.requests.push({ url: url.href, token, name: q, ids: [] });
            await github.holdSearch;
            return searchAnswer(q);
        }

        const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
        const { name, ids } = readGraphQL(body);
        github.requests.push({ url: url.href, token, name, ids });
        await github.hold;
        const graphqlHeaders = rateLimitHeaders(
            'graphql',
            github.graphqlAllowance.remaining,
            github.graphqlAllowance.resetAt,
        );
        if (name === 'Viewer') {
            return Response.json(
                { data: { viewer: viewerOf(token.replace('gho_', '')) } },
                { headers: graphqlHeaders },
            );
        }

        // As GitHub answers: `null` for a node it cannot give, with an error pointing at it.
        const errors: GitHubGraphQLErrorEntry[] = [];
        const nodes = ids.map((id, index) => {
            const refused = github.refused.get(id);
            if (refused) {
                errors.push({ ...refused, path: ['nodes', index, ...(refused.path ?? [])] });
                return null;
            }

            if (github.deleted.has(id)) {
                errors.push({
                    type: 'NOT_FOUND',
                    path: ['nodes', index],
                    message: `Could not resolve to a node with the global id of '${id}'`,
                });
                return null;
            }

            const node = known.get(id) ?? null;
            const forbidden = github.forbiddenProject.get(id);
            if (forbidden !== undefined && node) {
                errors.push({
                    type: 'FORBIDDEN',
                    path: ['nodes', index, 'projectItems', 'nodes', forbidden, 'project'],
                    message:
                        'Although you appear to have the correct authorization credentials, the organization has enabled OAuth App access restrictions.',
                });
            }

            return name === 'PullRequestStatuses' ? (github.statuses.get(id) ?? node) : node;
        });
        return Response.json(errors.length > 0 ? { data: { nodes }, errors } : { data: { nodes } }, {
            headers: graphqlHeaders,
        });
    }

    function searchAnswer(q: string) {
        const { remaining, resetAt } = github.searchAllowance;
        const headers = rateLimitHeaders('search', remaining, resetAt);
        if (github.refuseSearch) {
            headers.set('retry-after', String(github.refuseSearch.retryAfter));
            return Response.json(
                { message: 'You have exceeded a secondary rate limit.' },
                { status: github.refuseSearch.status, headers },
            );
        }

        const group = MY_WORK_GROUPS.find(key => QUERIES[key] === q);
        if (group !== undefined && group === github.failSearch) {
            return Response.json({ message: 'Server Error' }, { status: 502, headers });
        }

        const nodes = group ? (github.found[group] ?? []) : [];
        for (const node of nodes) {
            known.set(node.id, node);
        }

        const items = nodes.map(node => ({
            node_id: node.id,
            updated_at: node.updatedAt,
            number: node.number,
            repository_url: 'https://api.github.com/repos/acme/web',
            ...(node.__typename === 'PullRequest' ? { pull_request: {} } : {}),
        }));
        return Response.json({ total_count: items.length, incomplete_results: false, items }, { headers });
    }
}

function readGraphQL(body: unknown) {
    if (typeof body !== 'object' || body === null || !('query' in body) || !('variables' in body)) {
        throw new Error('Not a GraphQL request');
    }

    const name = /query\s+(\w+)/.exec(String(body.query))?.[1] ?? '';
    const { variables } = body;
    const ids =
        typeof variables === 'object' && variables !== null && 'ids' in variables && Array.isArray(variables.ids)
            ? variables.ids.map(String)
            : [];
    return { name, ids };
}

function rateLimitHeaders(resource: string, remaining: number, resetAt: number) {
    return new Headers({
        'x-ratelimit-resource': resource,
        'x-ratelimit-limit': resource === 'search' ? '30' : '5000',
        'x-ratelimit-remaining': String(remaining),
        'x-ratelimit-reset': String(Math.floor(resetAt / 1000)),
    });
}

/** Signs `login` in, with an empty kept copy, and waits for the first poll. */
async function setup(github: FakeGitHub, login: string) {
    const local = new Map<string, string>([
        [TOKEN_KEY, `gho_${login}`],
        [VIEWER_KEY, JSON.stringify(viewerOf(login))],
    ]);
    const storageListeners: ((key: string | null) => void)[] = [];
    const visibilityListeners: (() => void)[] = [];
    const onlineListeners: (() => void)[] = [];
    let visible = true;
    let online = true;

    const browser: BrowserShape = {
        fetch: (input, init) => github.fetch(input, init),
        localStorage: {
            getItem: key => local.get(key) ?? null,
            setItem: (key, value) => {
                local.set(key, value);
            },
            removeItem: key => {
                local.delete(key);
            },
            key: index => [...local.keys()][index] ?? null,
            get length() {
                return local.size;
            },
        },
        sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        origin: 'https://githq.test',
        getRandomValues: bytes => {
            crypto.getRandomValues(bytes);
        },
        navigate: () => {},
        replaceLocation: () => {},
        openInNewTab: () => {},
        onLocalStorageChange: listener => {
            storageListeners.push(listener);
        },
        isVisible: () => visible,
        onVisibilityChange: listener => {
            visibilityListeners.push(listener);
        },
        isOnline: () => online,
        onOnlineChange: listener => {
            onlineListeners.push(listener);
        },
        writeCookie: () => {},
        estimateStorage: () => Promise.resolve(null),
        ...createTestTabs().open(),
    };

    const clock = fakeClock();
    const { container } = createTestContainer();
    container.set(Browser, browser);
    container.set(Clock, clock);
    container.set(ItemPersistence, {
        load: () => Promise.resolve<PersistedItems>({ items: [], membership: {}, sync: {} }),
        save: async () => {},
        destroy: async () => {},
    });
    // Nothing tracked: the loops of tracked repositories and projects have nothing to ask.
    container.set(TrackingPersistence, {
        loadTracking: () => Promise.resolve({ tracking: null, syncStates: [] }),
        saveTracking: async () => {},
        saveSyncState: async () => {},
        deleteSyncState: async () => {},
    });
    container.set(ProjectPersistence, {
        loadProjects: () => Promise.resolve({ projects: [], items: [] }),
        saveProject: async () => {},
        saveProjectItems: async () => {},
        deleteProject: async () => {},
    });

    const auth = container.resolve(AuthStore);
    const items = container.resolve(ItemStore);
    const sync = container.resolve(SyncEngine);
    // The stored user's check with GitHub is not what these tests are about.
    github.requests.length = 0;
    await items.ready();
    await clock.advance(0);

    return {
        auth,
        items,
        sync,
        clock,
        browser: {
            hide: () => setVisible(false),
            show: () => setVisible(true),
            goOffline: () => setOnline(false),
            goOnline: () => setOnline(true),
        },
        fromAnotherTab,
    };

    function setVisible(value: boolean) {
        visible = value;
        for (const listener of visibilityListeners) {
            listener();
        }
    }

    function setOnline(value: boolean) {
        online = value;
        for (const listener of onlineListeners) {
            listener();
        }
    }

    /** Another tab writes `changes` (`null` removes a key), and this tab gets a `storage` event for each. */
    function fromAnotherTab(changes: Record<string, string | null>) {
        for (const [key, value] of Object.entries(changes)) {
            if (value === null) {
                local.delete(key);
            } else {
                local.set(key, value);
            }
        }

        for (const key of Object.keys(changes)) {
            for (const listener of storageListeners) {
                listener(key);
            }
        }
    }
}

/** A clock that moves only when told, running the timers that fall due on the way and letting their work settle. */
function fakeClock() {
    let now = START;
    let timers: { at: number; callback: () => void }[] = [];

    const clock: ClockShape & { advance(ms: number): Promise<void> } = {
        now: () => now,
        schedule: (callback, delayMs) => {
            const timer = { at: now + delayMs, callback };
            timers.push(timer);
            return () => {
                timers = timers.filter(other => other !== timer);
            };
        },
        advance: async ms => {
            const end = now + ms;
            await settle();
            for (;;) {
                const next = timers.toSorted((a, b) => a.at - b.at)[0];
                if (!next || next.at > end) {
                    break;
                }

                timers = timers.filter(other => other !== next);
                now = next.at;
                next.callback();
                await settle();
            }

            now = end;
            await settle();
        },
    };
    return clock;
}

/** Lets the promises in flight — fetches, their bodies, the polls awaiting them — run as far as they can. */
async function settle() {
    for (let round = 0; round < 30; round++) {
        await new Promise(resolve => {
            setTimeout(resolve, 0);
        });
    }
}

function viewerOf(login: string) {
    return { login, name: null, avatarUrl: `https://avatars.test/${login}` };
}

function issueNode(id: string, updatedAt: string): IssueFieldsFragment {
    return {
        __typename: 'Issue',
        id,
        url: `https://github.com/acme/web/issues/${id}`,
        number: 1,
        title: `Issue ${id}`,
        issueState: 'OPEN',
        stateReason: null,
        createdAt: MONDAY,
        updatedAt,
        closedAt: null,
        author: null,
        assignees: { nodes: [] },
        labels: { nodes: [] },
        milestone: null,
        issueType: null,
        comments: { totalCount: 0 },
        subIssuesSummary: { total: 0, completed: 0 },
        repository: REPOSITORY,
        projectItems: { nodes: [] },
    };
}

function pullRequestNode(id: string, updatedAt: string): PullRequestFieldsFragment {
    return {
        __typename: 'PullRequest',
        id,
        url: `https://github.com/acme/web/pull/${id}`,
        number: 2,
        title: `Pull request ${id}`,
        state: 'OPEN',
        isDraft: false,
        merged: false,
        reviewDecision: 'REVIEW_REQUIRED',
        mergeable: 'MERGEABLE',
        mergeStateStatus: 'BLOCKED',
        createdAt: MONDAY,
        updatedAt,
        closedAt: null,
        additions: 1,
        deletions: 1,
        changedFiles: 1,
        headRefName: 'feature',
        baseRefName: 'main',
        author: null,
        assignees: { nodes: [] },
        labels: { nodes: [] },
        milestone: null,
        comments: { totalCount: 0 },
        closingIssuesReferences: { nodes: [] },
        repository: REPOSITORY,
        projectItems: { nodes: [] },
        statusCheckRollup: null,
        reviewRequests: { nodes: [] },
        latestOpinionatedReviews: { nodes: [] },
    };
}
