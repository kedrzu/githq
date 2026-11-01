import type { BrowserContext, Page, Request, Route } from '@playwright/test';

import type { Sdk } from '@githq/github/generated.gen.js';
import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import { OAUTH_TOKEN_PATH } from '@githq/github/oauth.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

/** A GraphQL operation the app sends: a method of the generated SDK (`packages/github/src/operations`). */
export type GitHubOperationName = keyof Sdk;

/** The `data` GitHub answers an operation with, as the generated SDK types it. */
export type GitHubOperationData<TName extends GitHubOperationName> = Awaited<ReturnType<Sdk[TName]>>;

/** An operation as the app sent it, for a handler to answer by. */
export interface GitHubGraphQLRequest {
    /**
     * The variables the app sent. Untyped on purpose: they are what the test checks, not what it may assume.
     */
    readonly variables: Readonly<Record<string, unknown>>;
    /** The token from the `Authorization` header, or `null` without one. */
    readonly token: string | null;
}

/**
 * What an operation is answered with: its `data`, its data in part ({@link GitHubPartialAnswer}), or GitHub
 * refusing the request ({@link GitHubHttpError}).
 */
export type GitHubGraphQLAnswer<TName extends GitHubOperationName> =
    | GitHubOperationData<TName>
    | GitHubPartialAnswer<TName>
    | GitHubHttpError;

/** An operation's answer, or a function making it per request; it may wait (to hold an answer back). */
export type GitHubGraphQLHandler<TName extends GitHubOperationName> =
    | GitHubGraphQLAnswer<TName>
    | ((request: GitHubGraphQLRequest) => GitHubGraphQLAnswer<TName> | Promise<GitHubGraphQLAnswer<TName>>);

/** A page of `github.com` as a test answers it: a redirect back to the app, usually. */
export interface GitHubWebAnswer {
    readonly status: number;
    readonly headers?: Readonly<Record<string, string>>;
    readonly body?: string;
}

/** A REST call of GitHub's API as a test answers it ({@link GitHubMock.rest}): its status, JSON and ETag. */
export interface GitHubRestAnswer {
    readonly status: number;
    /** The body; none for a `304`. */
    readonly json?: unknown;
    /** The `ETag` header, which the app sends back as `If-None-Match`. */
    readonly etag?: string;
}

/** A REST call as the app made it, for a handler to answer by. */
export interface GitHubRestRequest {
    readonly url: URL;
    /** The `If-None-Match` header, or `null`. */
    readonly ifNoneMatch: string | null;
    /** The JSON body (a `PUT`'s, a `POST`'s); `undefined` without one. */
    readonly body: unknown;
}

/** A GraphQL operation the mock answered, as the app sent it ({@link GitHubMock.graphqlCalls}). */
export interface GitHubGraphQLCall {
    readonly name: GitHubOperationName;
    readonly variables: Readonly<Record<string, unknown>>;
}

/** A REST call the mock answered through {@link GitHubMock.rest}, and its status ({@link GitHubMock.restCalls}). */
export interface GitHubRestCall extends GitHubRestRequest {
    readonly method: string;
    readonly status: number;
}

/** What the app's token exchange (`POST /api/auth/token`) answers when it succeeds. */
export interface GitHubTokenExchange {
    readonly accessToken: string;
    readonly scopes: readonly string[];
}

/** GitHub's GraphQL allowance, sent with every answer as `x-ratelimit-*`. */
export interface GitHubMockRateLimit {
    limit: number;
    remaining: number;
    resetAt: Date;
}

/** An issue or pull request a search finds, as `GET /search/issues` lists it. */
export interface GitHubSearchHit {
    /** The GraphQL node id, which the app then reads the item by. */
    readonly nodeId: string;
    readonly updatedAt: string;
    readonly number: number;
    /** `owner/name`. */
    readonly repository: string;
    readonly isPullRequest: boolean;
}

/**
 * GitHub refusing a request with an HTTP status — `new GitHubHttpError(401, 'Bad credentials')` for a token it
 * no longer accepts — answered as GitHub does: the status and `{ message }`.
 */
export class GitHubHttpError {
    constructor(
        readonly status: number,
        readonly message: string,
    ) {}
}

/** A GraphQL answer's body as GitHub sends it. */
export interface GitHubGraphQLBody {
    readonly data: unknown;
    readonly errors?: readonly GitHubGraphQLErrorEntry[];
}

/**
 * A query answered in part, as GitHub answers a node that is gone or hidden, or a field the token may not read:
 * the data with `null` there, and an error whose `path` points at it (`NOT_FOUND` at `['nodes', 1]`).
 */
export class GitHubPartialAnswer<TName extends GitHubOperationName> {
    constructor(
        readonly data: GitHubOperationData<TName>,
        readonly errors: readonly GitHubGraphQLErrorEntry[],
    ) {}

    /** The answer's body: `errors` only when there are some, as GitHub leaves it out. */
    toBody(): GitHubGraphQLBody {
        return this.errors.length > 0 ? { data: this.data, errors: this.errors } : { data: this.data };
    }
}

const GRAPHQL_URL = 'https://api.github.com/graphql';
const SEARCH_ISSUES_URL = 'https://api.github.com/search/issues';
const API_HOST = 'api.github.com';
/** The user's settings repository (`GET /repos/<login>/githq-settings`), which every first sign-in looks for. */
const SETTINGS_REPOSITORY_PATH = /^\/repos\/[^/]+\/githq-settings$/;

/** GitHub's hosts, subdomains included: nothing of the tests may reach them. */
const GITHUB_HOSTS = ['github.com', 'githubusercontent.com', 'githubassets.com'];

/** Where the avatars are: answered with one picture whatever the user. */
const AVATARS_HOST = 'avatars.githubusercontent.com';

/** The app's Worker, whose redirects to GitHub are answered by the mock. */
const WORKER_PATH = '/api/';

/** The headers GitHub's API lets a page read across origins (`access-control-expose-headers`). */
const EXPOSED_HEADERS =
    'ETag, Link, Location, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Resource, X-RateLimit-Reset';

/** A 1×1 PNG, the avatar of every user. */
const AVATAR_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/cfMJ6QAAAABJRU5ErkJggg==',
    'base64',
);

/**
 * GitHub for the e2e tests: every request a browser context makes to a GitHub host is answered here, from
 * what the test registered — GraphQL operations by name ({@link graphql}), `github.com` pages by path
 * ({@link web}), avatars with one picture. GitHub itself is never reached.
 *
 * A request nobody registered is aborted — the app sees a network failure — and recorded;
 * {@link assertAllRouted} then throws, naming each one, which the `github` fixture does after every test.
 * So a test whose app calls something the test did not expect fails, even when the app swallows the error.
 *
 * The Worker's half of the sign-in is the one call to GitHub that a browser does not make: the Worker trades
 * the code for a token at `github.com`. Its endpoint (`POST /api/auth/token`) is therefore answered in the
 * browser too ({@link tokenExchange}), and unrouted like any other until a test registers it — so the Worker
 * never calls GitHub during the tests. The Worker's other way to GitHub, the redirect to its consent screen,
 * is answered like a request to that screen (Chromium would not route it).
 *
 * The issue search (`GET /search/issues`), which every signed-in app polls for "my work", is always answered:
 * from {@link searchIssues}, finding nothing until a test says otherwise — a query it does not know is unrouted.
 * A test of "my work" sets it, and the item reads, from a {@link GitHubWorld}.
 *
 * {@link holdAnswers} keeps every answer back until {@link releaseAnswers} — to see what the app shows before
 * GitHub has said anything, as after a reload on a slow connection.
 *
 * Other REST endpoints — the conditional requests that poll tracked repositories and projects — are answered by
 * method and path ({@link rest}); one not registered is unrouted. The settings repository, which every first
 * sign-in looks for (`GET /repos/<login>/githq-settings`), is the exception: until a test registers it, there is none
 * (404).
 *
 * To extend: a new GraphQL operation needs nothing here (its name and `data` type come from the generated SDK).
 */
export class GitHubMock {
    /** The allowance every GraphQL answer reports; set it to see the status bar change. */
    rateLimit: GitHubMockRateLimit = {
        limit: 5000,
        remaining: 4812,
        resetAt: new Date(Date.now() + 45 * 60_000),
    };

    /** What the search allowance (30 a minute) reports. */
    searchRateLimit: GitHubMockRateLimit = {
        limit: 30,
        remaining: 29,
        resetAt: new Date(Date.now() + 60_000),
    };

    /**
     * What a search finds by its query (`is:open is:pr author:@me archived:false`); nothing by default.
     * `undefined` for a query the test did not expect: the search is unrouted. It may wait, to hold a search
     * back.
     */
    searchIssues: (
        q: string,
    ) => readonly GitHubSearchHit[] | undefined | Promise<readonly GitHubSearchHit[] | undefined> = () => [];

    private readonly operations = new Map<GitHubOperationName, (request: GitHubGraphQLRequest) => Promise<unknown>>();
    private readonly pages = new Map<string, (url: URL) => GitHubWebAnswer>();
    private readonly answeredGraphQL: GitHubGraphQLCall[] = [];
    private readonly answeredRest: GitHubRestCall[] = [];
    private readonly restHandlers = new Map<
        string,
        (request: GitHubRestRequest) => GitHubRestAnswer | Promise<GitHubRestAnswer>
    >();
    private tokenExchangeAnswer: GitHubTokenExchange | GitHubHttpError | null = null;
    private readonly unrouted: string[] = [];
    private readonly apiRequestsByPage = new Map<Page, string[]>();
    /** While answers are held: settles when they are released. */
    private held: { readonly released: Promise<void>; readonly release: () => void } | null = null;
    private heldCount = 0;

    /** Answers every GitHub request of `context` from this mock, from now on. */
    async install(context: BrowserContext): Promise<void> {
        await context.route(
            url => isGitHubHost(url.hostname),
            route => this.handleGitHub(route),
        );
        await context.route(
            url => url.pathname.startsWith(WORKER_PATH) && !isGitHubHost(url.hostname),
            route => this.handleWorker(route),
        );
        await context.route(
            // The app's token exchange, which the Worker forwards to `github.com`: answered in the browser instead.
            url => url.pathname === OAUTH_TOKEN_PATH,
            route => this.handleTokenExchange(route),
        );
    }

    /**
     * Answers the GraphQL operation `name` (`query Viewer { … }`) with `handler` — its `data`, a
     * {@link GitHubHttpError}, or a function of the request — replacing what was registered for it before.
     */
    graphql<TName extends GitHubOperationName>(name: TName, handler: GitHubGraphQLHandler<TName>): void {
        this.operations.set(name, async request => (typeof handler === 'function' ? await handler(request) : handler));
    }

    /**
     * Answers the REST call `method path` of GitHub's API (`GET /repos/acme/api/issues`), whatever its query, with
     * `handler` — replacing what was registered for it before.
     */
    rest(
        method: string,
        path: string,
        handler: (request: GitHubRestRequest) => GitHubRestAnswer | Promise<GitHubRestAnswer>,
    ): void {
        this.restHandlers.set(`${method} ${path}`, handler);
    }

    /** The GraphQL operations answered so far, oldest first — to check what the app asked GitHub, and what not. */
    get graphqlCalls(): readonly GitHubGraphQLCall[] {
        return this.answeredGraphQL;
    }

    /** The REST calls answered through {@link rest} so far, oldest first, with the status each was answered with. */
    get restCalls(): readonly GitHubRestCall[] {
        return this.answeredRest;
    }

    /**
     * The requests to GitHub's API that `page` made so far, oldest first: a GraphQL operation by its name
     * (`Viewer`), a REST call as `<method> <path>` (`GET /search/issues`) — to tell which of several tabs asked.
     */
    apiRequestsOf(page: Page): readonly string[] {
        return this.apiRequestsByPage.get(page) ?? [];
    }

    /** Answers the `github.com` page at `path` (`/login/oauth/authorize`) by its full address. */
    web(path: string, handler: (url: URL) => GitHubWebAnswer): void {
        this.pages.set(path, handler);
    }

    /** Answers the app's token exchange (`POST /api/auth/token`) as the Worker would after asking GitHub. */
    tokenExchange(answer: GitHubTokenExchange | GitHubHttpError): void {
        this.tokenExchangeAnswer = answer;
    }

    /**
     * Keeps every GitHub request waiting, answered or refused only once {@link releaseAnswers} is called. A
     * test that holds answers releases them before it ends: a request still waiting when the browser closes
     * cannot be answered.
     */
    holdAnswers(): void {
        if (this.held) {
            return;
        }

        let release = () => {};
        const released = new Promise<void>(resolve => {
            release = resolve;
        });
        this.held = { released, release };
    }

    /** How many requests wait for {@link releaseAnswers} now. */
    get heldRequests(): number {
        return this.heldCount;
    }

    /** Answers the requests held since {@link holdAnswers}, and every request from now on, at once. */
    releaseAnswers(): void {
        this.held?.release();
        this.held = null;
    }

    /** Throws when any request was left unanswered, naming each; then forgets them. */
    assertAllRouted(): void {
        if (this.unrouted.length === 0) {
            return;
        }

        const requests = this.unrouted.splice(0);
        throw new Error(
            `The app made GitHub requests the test did not mock (GitHubMock):\n${requests.map(request => `- ${request}`).join('\n')}`,
        );
    }

    private async handleGitHub(route: Route) {
        const request = route.request();
        this.recordApiRequest(request);
        await this.waitForRelease();
        await this.answerGitHub(route, request.method(), new URL(request.url()));
    }

    /**
     * The app's Worker (`/api/*`), asked for real; a redirect of it to GitHub (`/api/auth/authorize` to the
     * consent screen) is answered here instead of followed — Chromium does not route a redirect's target, so
     * the browser would otherwise open the real `github.com`.
     */
    private async handleWorker(route: Route) {
        const response = await route.fetch({ maxRedirects: 0 });
        const location = response.headers().location;
        const target = location === undefined ? undefined : new URL(location, route.request().url());
        if (target && isGitHubHost(target.hostname)) {
            await this.waitForRelease();
            await this.answerGitHub(route, 'GET', target);
            return;
        }

        await route.fulfill({ response });
    }

    private recordApiRequest(request: Request) {
        const url = new URL(request.url());
        if (url.hostname !== API_HOST || request.serviceWorker()) {
            return;
        }

        const page = request.frame().page();
        const name =
            url.href === GRAPHQL_URL
                ? (readOperationName(readQuery(parseJson(request.postData()))) ?? '(no name)')
                : `${request.method()} ${url.pathname}`;
        const requests = this.apiRequestsByPage.get(page) ?? [];
        requests.push(name);
        this.apiRequestsByPage.set(page, requests);
    }

    private async waitForRelease() {
        if (!this.held) {
            return;
        }

        this.heldCount++;
        try {
            await this.held.released;
        } finally {
            this.heldCount--;
        }
    }

    /** Answers `route` as GitHub would answer `method url` — the request's own, or a redirect's target. */
    private async answerGitHub(route: Route, method: string, url: URL) {
        if (url.href === GRAPHQL_URL && method === 'POST') {
            await this.handleGraphQL(route);
            return;
        }

        if (`${url.origin}${url.pathname}` === SEARCH_ISSUES_URL && method === 'GET') {
            await this.handleSearch(route, url);
            return;
        }

        const rest =
            url.hostname === API_HOST
                ? (this.restHandlers.get(`${method} ${url.pathname}`) ??
                  (method === 'GET' && SETTINGS_REPOSITORY_PATH.test(url.pathname) ? answerNoRepository : undefined))
                : undefined;
        if (rest) {
            const request = route.request();
            const ifNoneMatch = (await request.allHeaders())['if-none-match'] ?? null;
            const body = parseJson(request.postData());
            const answer = await rest({ url, ifNoneMatch, body });
            this.answeredRest.push({ method, url, ifNoneMatch, body, status: answer.status });
            const fulfilled = this.apiAnswer(answer.status, answer.json, 'core', this.rateLimit);
            await route.fulfill({
                ...fulfilled,
                headers: { ...fulfilled.headers, ...(answer.etag === undefined ? {} : { etag: answer.etag }) },
            });
            return;
        }

        if (url.hostname === AVATARS_HOST && method === 'GET') {
            await route.fulfill({ status: 200, contentType: 'image/png', body: AVATAR_PNG });
            return;
        }

        const page = url.hostname === 'github.com' ? this.pages.get(url.pathname) : undefined;
        if (page) {
            const answer = page(url);
            await route.fulfill({ status: answer.status, headers: { ...answer.headers }, body: answer.body ?? '' });
            return;
        }

        await this.reject(route, `${method} ${url.href}`);
    }

    private async handleGraphQL(route: Route) {
        const request = route.request();
        const body = parseJson(request.postData());
        const name = readOperationName(readQuery(body));
        const operation = name === undefined ? undefined : this.findOperation(name);
        if (!operation) {
            await this.reject(route, `${describe(request)} — operation ${name ?? '(no name)'}`);
            return;
        }

        const variables = isPlainObject(body) && isPlainObject(body.variables) ? body.variables : {};
        this.answeredGraphQL.push({ name: operation.name, variables });
        const handler = operation.handler;
        const answer = await handler({ variables, token: readToken(request) });
        await route.fulfill(
            answer instanceof GitHubHttpError
                ? this.apiAnswer(answer.status, { message: answer.message }, 'graphql', this.rateLimit)
                : this.apiAnswer(200, toGraphQLBody(answer), 'graphql', this.rateLimit),
        );
    }

    /** The handler registered for the operation named `name` in a document, with the name as the SDK types it. */
    private findOperation(name: string) {
        for (const [known, handler] of this.operations) {
            if (known === name) {
                return { name: known, handler };
            }
        }

        return undefined;
    }

    private async handleSearch(route: Route, url: URL) {
        const hits = await this.searchIssues(url.searchParams.get('q') ?? '');
        if (!hits) {
            await this.reject(route, `GET ${url.href}`);
            return;
        }

        const items = hits.map(hit => ({
            node_id: hit.nodeId,
            updated_at: hit.updatedAt,
            number: hit.number,
            repository_url: `https://api.github.com/repos/${hit.repository}`,
            ...(hit.isPullRequest ? { pull_request: {} } : {}),
        }));
        await route.fulfill(
            this.apiAnswer(
                200,
                { total_count: items.length, incomplete_results: false, items },
                'search',
                this.searchRateLimit,
            ),
        );
    }

    private async handleTokenExchange(route: Route) {
        const request = route.request();
        const answer = this.tokenExchangeAnswer;
        if (request.method() !== 'POST' || !answer) {
            await this.reject(route, describe(request));
            return;
        }

        await route.fulfill(
            answer instanceof GitHubHttpError
                ? { status: answer.status, json: { error: answer.message } }
                : { status: 200, json: answer },
        );
    }

    /** An answer of GitHub's API: the JSON, the bucket's allowance, and the CORS headers a page needs to read both. */
    private apiAnswer(status: number, json: unknown, resource: string, rateLimit: GitHubMockRateLimit) {
        return {
            status,
            json,
            headers: {
                'access-control-allow-origin': '*',
                'access-control-expose-headers': EXPOSED_HEADERS,
                'x-ratelimit-resource': resource,
                'x-ratelimit-limit': String(rateLimit.limit),
                'x-ratelimit-remaining': String(rateLimit.remaining),
                'x-ratelimit-reset': String(Math.floor(rateLimit.resetAt.getTime() / 1000)),
            },
        };
    }

    private async reject(route: Route, description: string) {
        this.unrouted.push(description);
        await route.abort('blockedbyclient');
    }
}

/** The body GitHub answers an operation with: `{ data }`, and `errors` only when there are some. */
function toGraphQLBody(answer: unknown): GitHubGraphQLBody {
    return answer instanceof GitHubPartialAnswer ? answer.toBody() : { data: answer };
}

function isGitHubHost(hostname: string) {
    return GITHUB_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`));
}

/** The GraphQL document of a request's body; empty without one. */
function readQuery(body: unknown) {
    return isPlainObject(body) && typeof body.query === 'string' ? body.query : '';
}

/** The operation's name from its document: `query Viewer { … }` → `Viewer`. */
function readOperationName(query: string) {
    return /\b(?:query|mutation|subscription)\s+(\w+)/.exec(query)?.[1];
}

function readToken(request: Request) {
    const authorization = request.headers().authorization;
    return authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null;
}

function describe(request: Request) {
    return `${request.method()} ${request.url()}`;
}

function parseJson(text: string | null): unknown {
    if (text === null) {
        return undefined;
    }

    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

/** No such repository, as GitHub answers it. */
function answerNoRepository(): GitHubRestAnswer {
    return { status: 404, json: { message: 'Not Found' } };
}
