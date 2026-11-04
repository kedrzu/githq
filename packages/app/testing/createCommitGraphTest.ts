import type { PullRequestCheckFieldsFragment } from '@githq/github/generated.gen.js';
import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';

import { AuthStore } from '@/auth/AuthStore.js';
import { CommitGraphStore } from '@/commits/CommitGraphStore.js';
import { CommitPersistence } from '@/commits/CommitPersistence.js';
import type { CommitRef, CommitState, KeptCommit } from '@/commits/CommitTypes.js';
import { orderCommits } from '@/commits/orderCommits.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { ItemStore } from '@/store/ItemStore.js';

import { createSignedInBrowser } from './createSignedInBrowser.js';
import { fakeCommitGitHub } from './fakeCommitGitHub.js';
import { fakeOnline } from './fakeOnline.js';
import { SAMPLE_COMMITS_NOW } from './sampleCommits.js';
import { setIndexedDbPersistence } from './setIndexedDbPersistence.js';

const REPOSITORY = 'acme/web';

/** What GitHub holds of `acme/web`, and what of it is already kept. */
export interface CommitGraphTestOptions {
    /** Every commit on GitHub. */
    readonly commits: readonly KeptCommit[];
    /** The branches; a branch per commit nothing descends from when not given. */
    readonly branches?: readonly CommitRef[];
    readonly tags?: readonly CommitRef[];
    readonly defaultBranch?: string | null;
    /** The pull request and CI state GitHub answers; a commit not in it has neither. */
    readonly states?: ReadonlyMap<string, CommitState>;
    /** The checks GitHub lists, by oid; a commit not in it has none. */
    readonly checks?: ReadonlyMap<string, readonly PullRequestCheckFieldsFragment[]>;
    /** The full message below the first line GitHub answers, by oid; a commit not in it has none. */
    readonly bodies?: ReadonlyMap<string, string>;
    /** The first line of the commits whose headline cuts it, by oid. */
    readonly subjects?: ReadonlyMap<string, string>;
    /** The commits kept from an earlier open, which draw at once; all of them when not given. */
    readonly kept?: readonly KeptCommit[];
    /** Nothing is kept: the first open of the repository. */
    readonly firstOpen?: boolean;
    /** Holds back the answers to an operation while its promise is pending. */
    holdIf?(operation: string): Promise<void> | null;
    /** GitHub answers an operation it returns `true` for with a 502. */
    failIf?(operation: string): boolean;
    /** `false`: the browser starts offline. */
    readonly online?: boolean;
}

/**
 * The real `CommitGraphStore` in a container of its own, for a component spec or story in a browser: a signed-in user,
 * the sample's moment, and a GitHub answering the commit operations from `options`. Change `github.repository` and
 * call `store.open` to have GitHub answer what moved.
 *
 * @util
 */
export function createCommitGraphTest(options: CommitGraphTestOptions) {
    const fake = fakeCommitGitHub();
    const repository = fake.repository(REPOSITORY);
    const branches = options.branches ?? getTipBranches(options.commits);
    const tags = options.tags ?? [];
    repository.defaultBranch = options.defaultBranch === undefined ? 'main' : options.defaultBranch;
    // One request answers the refs, whatever their number: paging them is the store's tests' to prove.
    repository.refsPerPage = Number.POSITIVE_INFINITY;
    for (const commit of options.commits) {
        repository.commits.set(commit.oid, commit);
    }

    for (const branch of branches) {
        repository.branch(branch.name, branch.oid);
    }

    for (const tag of tags) {
        repository.tag(tag.name, tag.oid);
    }

    for (const [oid, state] of options.states ?? []) {
        repository.states.set(oid, state);
    }

    for (const [oid, checks] of options.checks ?? []) {
        repository.checks.set(oid, checks);
    }

    for (const [oid, body] of options.bodies ?? []) {
        repository.bodies.set(oid, body);
    }

    for (const [oid, subject] of options.subjects ?? []) {
        repository.subjects.set(oid, subject);
    }

    const github = {
        repository,
        /** Another repository on the same GitHub. */
        otherRepository: (nameWithOwner: string) => fake.repository(nameWithOwner),
        /** The operations asked, in order. */
        requests: [] as string[],
    };

    const browser = createSignedInBrowser(async (_url, init) => {
        const { query, variables } = readBody(init?.body);
        const operation = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? '';
        github.requests.push(operation);
        await options.holdIf?.(operation);
        const answer = options.failIf?.(operation) ? undefined : fake.answer({ operation, variables });
        return answer ? Response.json(answer) : Response.json({ message: 'Server Error' }, { status: 502 });
    });

    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    const online = fakeOnline(options.online !== false);
    container.set(Browser, {
        ...browser,
        isOnline: online.isOnline,
        onOnlineChange: online.onOnlineChange,
    });
    container.set(Clock, {
        now: () => SAMPLE_COMMITS_NOW,
        schedule: (callback, delayMs) => {
            const timer = setTimeout(callback, delayMs);
            return () => clearTimeout(timer);
        },
    });
    setIndexedDbPersistence(container);
    const store = container.resolve(CommitGraphStore);

    return { container, store, github, setOnline: online.setOnline, ready: keep() };

    /** Resolves once the kept copy is written, before the view opens the graph. */
    async function keep() {
        const items = container.resolve(ItemStore);
        await items.ready();
        const login = container.resolve(AuthStore).viewer?.login;
        if (options.firstOpen || !login) {
            return;
        }

        const persistence = container.resolve(CommitPersistence);
        await persistence.saveCommits(login, options.kept ?? options.commits);
        await persistence.saveCommitRefs(login, {
            repository: REPOSITORY,
            defaultBranch: repository.defaultBranch,
            branches: [...branches],
            tags: [...tags],
            fetchedAt: SAMPLE_COMMITS_NOW,
        });
    }
}

/** A branch per commit nothing descends from, so all of them are reachable; the newest is `main`. */
function getTipBranches(commits: readonly KeptCommit[]): CommitRef[] {
    const parents = new Set(commits.flatMap(commit => commit.parents.map(parent => parent.oid)));
    return orderCommits(commits)
        .filter(commit => !parents.has(commit.oid))
        .map((commit, index) => ({
            name: index === 0 ? 'main' : `branch-${index}`,
            oid: commit.oid,
            commitId: commit.id,
            committedDate: commit.committedDate,
        }));
}

function readBody(body: unknown): { query: string; variables: Readonly<Record<string, unknown>> } {
    const parsed: unknown = JSON.parse(typeof body === 'string' ? body : '{}');
    if (typeof parsed !== 'object' || parsed === null) {
        return { query: '', variables: {} };
    }

    const query = 'query' in parsed && typeof parsed.query === 'string' ? parsed.query : '';
    const variables = 'variables' in parsed ? parsed.variables : null;
    return { query, variables: typeof variables === 'object' && variables !== null ? { ...variables } : {} };
}
