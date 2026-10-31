import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import { createTestContainer } from '@nzyme/ioc-testing/createTestContainer.js';

import { TOKEN_KEY, VIEWER_KEY } from '@/auth/AuthStore.js';
import type { BrowserShape } from '@/services/Browser.js';
import { Browser } from '@/services/Browser.js';
import type { ClockShape } from '@/services/Clock.js';
import { Clock } from '@/services/Clock.js';

import { createTestTabs } from './createTestTabs.js';
import type { TestTabs } from './createTestTabs.js';

/** A GraphQL operation as the fake GitHub received it. */
export interface TestGraphQLRequest {
    /** The operation's name, as in the SDK (`ItemDetails`). */
    readonly operation: string;
    readonly variables: Readonly<Record<string, unknown>>;
    /** The token it carried. */
    readonly token: string;
}

/** What the fake GitHub answers an operation with: its `data`, and the errors of a partial answer. */
export interface TestGraphQLAnswer {
    readonly data: unknown;
    readonly errors?: readonly GitHubGraphQLErrorEntry[];
}

/** What the fake GitHub answers a REST `GET` with. */
export interface TestRestAnswer {
    readonly status: number;
    /** JSON; none for a 304. */
    readonly body?: unknown;
    readonly etag?: string;
}

/** The parameters of {@link createTestSession}. */
export interface CreateTestSessionParams {
    /** Signed in as this user, or signed out. */
    readonly login: string | null;
    /** Answers the GraphQL operations; one it returns `undefined` for fails with a 502. */
    readonly answer: (request: TestGraphQLRequest) => TestGraphQLAnswer | undefined;
    /**
     * Answers the REST `GET`s, recorded as `GET <path>` with the query parameters and the ETag sent
     * (`ifNoneMatch`) as variables; one it returns `undefined` for — or every one, without it — fails with a 502.
     */
    readonly answerRest?: (request: TestGraphQLRequest) => TestRestAnswer | undefined;
    /**
     * The browser this session is a tab of, sharing its Web Locks and broadcast channels with the other sessions
     * opened in it; a browser of its own without it (the only tab).
     */
    readonly tabs?: TestTabs;
}

/** A moment of the tests' fake clock: a Friday afternoon. */
export const TEST_START = Date.UTC(2026, 9, 30, 13, 0, 0);

/**
 * A container for testing the stores against a fake GitHub: a browser with the user signed in, a clock that
 * moves only when told ({@link TestClock.advance}), and a GitHub answering GraphQL from `answer` — every request
 * recorded, any of them held back while {@link TestSessionGitHub.hold} is set. The stores' persistence
 * interfaces are left for the test to set. Several sessions given the same `tabs` are tabs of one browser —
 * each with its own clock and GitHub, so what each tab asked is told apart.
 */
export function createTestSession(params: CreateTestSessionParams) {
    const local = new Map<string, string>();
    if (params.login !== null) {
        local.set(TOKEN_KEY, `gho_${params.login}`);
        local.set(VIEWER_KEY, JSON.stringify(viewerOf(params.login)));
    }

    const storageListeners: ((key: string | null) => void)[] = [];
    const visibilityListeners: (() => void)[] = [];
    let visible = true;
    /** The pages opened in a new tab, in order. */
    const openedTabs: string[] = [];

    const tab = (params.tabs ?? createTestTabs()).open();

    const github: TestSessionGitHub = {
        requests: [],
        hold: null,
        holdIf: null,
        graphqlRemaining: 4800,
        coreRemaining: 4900,
    };

    const browser: BrowserShape = {
        fetch,
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
        openInNewTab: url => {
            openedTabs.push(url);
        },
        onLocalStorageChange: listener => {
            storageListeners.push(listener);
        },
        isVisible: () => visible,
        onVisibilityChange: listener => {
            visibilityListeners.push(listener);
        },
        isOnline: () => true,
        onOnlineChange: () => {},
        requestLock: tab.requestLock,
        openChannel: tab.openChannel,
        onPageLifecycle: tab.onPageLifecycle,
        estimateStorage: () => Promise.resolve(null),
    };

    const clock = createTestClock();
    const { container, logs } = createTestContainer();
    container.set(Browser, browser);
    container.set(Clock, clock);

    return {
        container,
        logs,
        clock,
        github,
        openedTabs,
        /** This tab: close it, or freeze it. */
        tab,
        /** The operations GitHub received, in order. */
        operations: () => github.requests.map(request => request.operation),
        setVisible,
        fromAnotherTab,
        signInFromAnotherTab: (login: string) =>
            fromAnotherTab({ [TOKEN_KEY]: `gho_${login}`, [VIEWER_KEY]: JSON.stringify(viewerOf(login)) }),
        signOutFromAnotherTab: () => fromAnotherTab({ [TOKEN_KEY]: null, [VIEWER_KEY]: null }),
    };

    async function fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
        const headers = new Headers(init?.headers);
        const token = (headers.get('Authorization') ?? '').replace('Bearer ', '');
        if ((init?.method ?? 'GET') === 'GET') {
            return await fetchRest(new URL(input instanceof Request ? input.url : input), token, headers);
        }

        const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
        const request = readRequest(body, token);
        github.requests.push(request);
        await github.hold;
        await github.holdIf?.(request);

        const limits = rateLimitHeaders('graphql', github.graphqlRemaining);
        if (request.operation === 'Viewer') {
            return Response.json({ data: { viewer: viewerOf(token.replace('gho_', '')) } }, { headers: limits });
        }

        const answer = params.answer(request);
        if (!answer) {
            return Response.json({ message: 'Server Error' }, { status: 502, headers: limits });
        }

        return Response.json(answer, { headers: limits });
    }

    async function fetchRest(url: URL, token: string, headers: Headers): Promise<Response> {
        const request: TestGraphQLRequest = {
            operation: `GET ${url.pathname}`,
            variables: { ...Object.fromEntries(url.searchParams), ifNoneMatch: headers.get('If-None-Match') },
            token,
        };
        github.requests.push(request);
        await github.hold;
        await github.holdIf?.(request);

        const limits = rateLimitHeaders('core', github.coreRemaining);
        const answer = params.answerRest?.(request);
        if (!answer) {
            return Response.json({ message: 'Server Error' }, { status: 502, headers: limits });
        }

        if (answer.etag !== undefined) {
            limits.set('etag', answer.etag);
        }

        return answer.status === 304
            ? new Response(null, { status: 304, headers: limits })
            : Response.json(answer.body ?? null, { status: answer.status, headers: limits });
    }

    function rateLimitHeaders(resource: string, remaining: number) {
        return new Headers({
            'x-ratelimit-resource': resource,
            'x-ratelimit-limit': '5000',
            'x-ratelimit-remaining': String(remaining),
            'x-ratelimit-reset': String(Math.floor((clock.now() + 3_600_000) / 1000)),
        });
    }

    function setVisible(value: boolean) {
        visible = value;
        for (const listener of visibilityListeners) {
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

/** The fake GitHub of {@link createTestSession}. */
export interface TestSessionGitHub {
    readonly requests: TestGraphQLRequest[];
    /** Every answer waits for it. */
    hold: Promise<void> | null;
    /** The answer to a request it returns a promise for waits for that promise. */
    holdIf: ((request: TestGraphQLRequest) => Promise<void> | null) | null;
    /** What every answer says is left of the GraphQL allowance. */
    graphqlRemaining: number;
    /** What every REST answer says is left of the core allowance. */
    coreRemaining: number;
}

/** A clock that moves only when told. */
export interface TestClock extends ClockShape {
    /** Moves the time on, running the timers that fall due on the way and letting their work settle. */
    advance(ms: number): Promise<void>;
}

function createTestClock(): TestClock {
    let now = TEST_START;
    let timers: { at: number; callback: () => void }[] = [];

    return {
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
}

/** Lets the promises in flight — fetches, their bodies, IndexedDB — run as far as they can. */
async function settle() {
    for (let round = 0; round < 30; round++) {
        await new Promise(resolve => {
            setTimeout(resolve, 0);
        });
    }
}

function readRequest(body: unknown, token: string): TestGraphQLRequest {
    if (typeof body !== 'object' || body === null || !('query' in body) || !('variables' in body)) {
        throw new Error('Not a GraphQL request');
    }

    const operation = /(?:query|mutation)\s+(\w+)/.exec(String(body.query))?.[1] ?? '';
    const { variables } = body;
    if (typeof variables !== 'object' || variables === null) {
        throw new Error('A GraphQL request without variables');
    }

    return { operation, variables: { ...variables }, token };
}

function viewerOf(login: string) {
    return { login, name: null, avatarUrl: `https://avatars.test/${login}` };
}
