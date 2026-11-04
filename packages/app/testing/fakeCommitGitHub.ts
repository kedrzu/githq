import type {
    CommitChecksQuery,
    CommitDetailQuery,
    CommitFieldsFragment,
    CommitHistoriesQuery,
    CommitRefFieldsFragment,
    CommitStatesQuery,
    PullRequestCheckFieldsFragment,
    RepositoryCommitRefsQuery,
} from '@githq/github/generated.gen.js';

import type { CommitState, KeptCommit } from '@/commits/CommitTypes.js';
import { orderCommits } from '@/commits/orderCommits.js';

import type { TestGraphQLAnswer, TestGraphQLRequest } from './createTestSession.js';
import { sampleCommit } from './sampleCommits.js';

/** A fake GitHub answering the commit operations, in `bun test` and in a browser alike. */
export interface FakeCommitGitHub {
    /** The repository `owner/name`, created empty the first time. */
    repository(nameWithOwner: string): FakeCommitRepository;
    /** The answer to a commit operation; `undefined` for any other. */
    answer(request: Pick<TestGraphQLRequest, 'operation' | 'variables'>): TestGraphQLAnswer | undefined;
}

/** A repository on the fake GitHub. */
export interface FakeCommitRepository {
    /** Every commit, by oid. */
    readonly commits: Map<string, KeptCommit>;
    /** The oid of each branch, by name. */
    readonly branches: Map<string, string>;
    /** The oid of each tag, by name. */
    readonly tags: Map<string, string>;
    /** The pull request and CI state of the commits having any, by oid. */
    readonly states: Map<string, CommitState>;
    /** The checks of the commits having any, by oid; an answer holds the first 100, as `CommitChecks` asks. */
    readonly checks: Map<string, readonly PullRequestCheckFieldsFragment[]>;
    /** The full message below the first line of the commits having one, by oid. */
    readonly bodies: Map<string, string>;
    /** The first line of the commits whose headline cuts it, by oid; the headline for any other. */
    readonly subjects: Map<string, string>;
    /** The default branch's name. */
    defaultBranch: string | null;
    /** How many branches or tags a page of them holds. */
    refsPerPage: number;
    /** Adds a commit, `minutes` after the samples' epoch. */
    add(oid: string, minutes: number, parents: readonly string[]): void;
    /**
     * Adds `<prefix><from>` … `<prefix><to - 1>`, each the child of the one before (the first too, when there is one),
     * 10 minutes apart from `start`.
     */
    line(prefix: string, from: number, to: number, start?: number): void;
    branch(name: string, oid: string): void;
    deleteBranch(name: string): void;
    tag(name: string, oid: string): void;
}

/**
 * A GitHub of commits for the store's tests, and for its specs and stories through `createCommitGraphTest`. It honours
 * what `RepositoryCommitRefs` asks for and pages the refs, as GitHub does. The samples' commit ids are `C_<oid>`.
 *
 * @util
 */
export function fakeCommitGitHub(): FakeCommitGitHub {
    const repositories = new Map<string, FakeCommitRepository>();

    return {
        repository(nameWithOwner) {
            let repository = repositories.get(nameWithOwner);
            if (!repository) {
                repository = createRepository();
                repositories.set(nameWithOwner, repository);
            }

            return repository;
        },
        answer({ operation, variables }) {
            switch (operation) {
                case 'RepositoryCommitRefs': {
                    const repository = repositories.get(`${String(variables.owner)}/${String(variables.name)}`);
                    return { data: repository ? answerRefs(repository, variables) : { repository: null } };
                }
                case 'CommitHistories': {
                    const data: CommitHistoriesQuery = {
                        nodes: readIds(variables).map(id => {
                            const found = findCommit(id);
                            if (!found) {
                                return null;
                            }

                            const history = historyOf(found.repository, found.commit.oid);
                            return { history: { nodes: history.slice(0, Number(variables.first)).map(toNode) } };
                        }),
                    };
                    return { data };
                }
                case 'CommitDetail': {
                    const found = findCommit(String(variables.id));
                    const data: CommitDetailQuery = {
                        node: found
                            ? {
                                  ...toNode(found.commit),
                                  message: toMessage(found.repository, found.commit),
                              }
                            : null,
                    };
                    return { data };
                }
                case 'CommitStates': {
                    const data: CommitStatesQuery = {
                        nodes: readIds(variables).map(id => {
                            const found = findCommit(id);
                            if (!found) {
                                return null;
                            }

                            const state = found.repository.states.get(found.commit.oid);
                            return {
                                id: found.commit.id,
                                associatedPullRequests: { nodes: state?.pullRequest ? [state.pullRequest] : [] },
                                statusCheckRollup: state?.ci ? { state: state.ci } : null,
                            };
                        }),
                    };
                    return { data };
                }
                case 'CommitChecks': {
                    const found = findCommit(String(variables.id));
                    const checks = found?.repository.checks.get(found.commit.oid);
                    const data: CommitChecksQuery = {
                        node: found
                            ? {
                                  statusCheckRollup: checks
                                      ? { contextPage: { totalCount: checks.length, nodes: checks.slice(0, 100) } }
                                      : null,
                              }
                            : null,
                    };
                    return { data };
                }
                default:
                    return undefined;
            }
        },
    };

    function findCommit(id: string) {
        for (const repository of repositories.values()) {
            const commit = repository.commits.get(id.replace(/^C_/, ''));
            if (commit) {
                return { repository, commit };
            }
        }

        return null;
    }
}

function createRepository(): FakeCommitRepository {
    const repository: FakeCommitRepository = {
        commits: new Map(),
        branches: new Map(),
        tags: new Map(),
        states: new Map(),
        checks: new Map(),
        bodies: new Map(),
        subjects: new Map(),
        defaultBranch: 'main',
        refsPerPage: 100,
        add(oid, minutes, parents) {
            repository.commits.set(oid, sampleCommit(oid, minutes, parents));
        },
        line(prefix, from, to, start = 0) {
            for (let i = from; i < to; i++) {
                const parent = `${prefix}${i - 1}`;
                const parents = repository.commits.has(parent) ? [parent] : [];
                repository.add(`${prefix}${i}`, start + (i - from) * 10, parents);
            }
        },
        branch(name, oid) {
            repository.branches.set(name, oid);
        },
        deleteBranch(name) {
            repository.branches.delete(name);
        },
        tag(name, oid) {
            repository.tags.set(name, oid);
        },
    };
    return repository;
}

/** The commit's history as GitHub gives it: the commit and its ancestors, newest first. */
function historyOf(repository: FakeCommitRepository, oid: string): KeptCommit[] {
    const ancestors = new Map<string, KeptCommit>();
    const queue = [oid];
    for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
        const commit = repository.commits.get(next);
        if (commit && !ancestors.has(next)) {
            ancestors.set(next, commit);
            queue.push(...commit.parents.map(parent => parent.oid));
        }
    }

    return orderCommits([...ancestors.values()]);
}

function answerRefs(
    repository: FakeCommitRepository,
    variables: TestGraphQLRequest['variables'],
): RepositoryCommitRefsQuery {
    const { defaultBranch } = repository;
    const tipOid = defaultBranch === null ? undefined : repository.branches.get(defaultBranch);
    const tip = tipOid === undefined ? undefined : repository.commits.get(tipOid);
    return {
        repository: {
            defaultBranchRef:
                tip && defaultBranch !== null
                    ? {
                          name: defaultBranch,
                          target: {
                              id: tip.id,
                              oid: tip.oid,
                              committedDate: tip.committedDate,
                              ...(variables.withHistory === true
                                  ? { history: { nodes: historyOf(repository, tip.oid).slice(0, 100).map(toNode) } }
                                  : {}),
                          },
                      }
                    : null,
            ...(variables.withBranches === true
                ? { branches: refPage(repository, repository.branches, variables.branchesAfter) }
                : {}),
            ...(variables.withTags === true ? { tags: refPage(repository, repository.tags, variables.tagsAfter) } : {}),
        },
    };
}

/** A page of refs by name, as GitHub orders them; the cursor is how many came before. */
function refPage(repository: FakeCommitRepository, refs: ReadonlyMap<string, string>, after: unknown) {
    const start = typeof after === 'string' ? Number(after) : 0;
    const names = [...refs].toSorted(([a], [b]) => a.localeCompare(b));
    const end = start + repository.refsPerPage;
    const nodes: CommitRefFieldsFragment[] = [];
    for (const [name, oid] of names.slice(start, end)) {
        const commit = repository.commits.get(oid);
        if (commit) {
            nodes.push({ name, target: { id: commit.id, oid: commit.oid, committedDate: commit.committedDate } });
        }
    }

    return { pageInfo: { hasNextPage: end < names.length, endCursor: String(Math.min(end, names.length)) }, nodes };
}

/** A commit's whole message, as git keeps it. */
function toMessage(repository: FakeCommitRepository, { oid, headline }: KeptCommit) {
    const subject = repository.subjects.get(oid) ?? headline;
    const body = repository.bodies.get(oid);
    return body ? `${subject}\n\n${body}` : subject;
}

function toNode(commit: KeptCommit): CommitFieldsFragment {
    return {
        id: commit.id,
        oid: commit.oid,
        messageHeadline: commit.headline,
        committedDate: commit.committedDate,
        author: {
            name: commit.author.name,
            user: commit.author.login
                ? { login: commit.author.login, avatarUrl: commit.author.avatarUrl ?? 'https://avatars.test/user' }
                : null,
        },
        parents: { nodes: commit.parents.map(parent => ({ id: parent.id, oid: parent.oid })) },
    };
}

function readIds(variables: TestGraphQLRequest['variables']) {
    return Array.isArray(variables.ids) ? variables.ids.map(String) : [];
}
