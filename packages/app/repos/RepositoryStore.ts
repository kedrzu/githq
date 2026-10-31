import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import type {
    RepositoryLabelFieldsFragment,
    RepositoryMetadataQuery,
    RepositoryUserFieldsFragment,
    ViewerProjectsQuery,
} from '@githq/github/generated.gen.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { filterNotNull } from '@nzyme/utils/array/filterNotNull.js';
import { mapNotNull } from '@nzyme/utils/array/mapNotNull.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import { createExpiringReads } from '@/utils/createExpiringReads.js';
import type { ExpiringReads } from '@/utils/createExpiringReads.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import type { PersistedRepositories } from './RepositoryPersistence.js';
import { RepositoryPersistence } from './RepositoryPersistence.js';
import type {
    RepositoryIssueType,
    RepositoryLabel,
    RepositoryMetadata,
    RepositoryMilestone,
    RepositoryUser,
    ViewerProject,
    ViewerProjects,
} from './RepositoryTypes.js';

/** How long repository metadata and the viewer's projects are used without reading them again. */
const METADATA_TTL_MS = 10 * 60_000;
/**
 * How many pages of 100 labels or assignable users are read at most. Past them the pickers do not offer the rest,
 * but an edit naming one still finds it ({@link RepositoryStore} `complete`).
 */
const MAX_PAGES = 10;

/** What {@link RepositoryStore} `complete` looks up. */
export interface RepositoryNames {
    /** Label names. */
    readonly labels: readonly string[];
    /** User logins. */
    readonly logins: readonly string[];
}

/** A page of a connection, as GitHub answers it. */
interface Page<T> {
    readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
    readonly nodes?: readonly (T | null)[] | null;
}

/** The signed-in user the metadata is read for, captured when they signed in. */
interface Session {
    readonly account: Account;
    /** Resolves once the kept metadata is in memory; never rejects. */
    ready: Promise<void>;
    /** The metadata, by `owner/name`. */
    readonly repositories: ExpiringReads<string, RepositoryMetadata>;
    /** The viewer's projects, under one key. */
    readonly viewerProjects: ExpiringReads<typeof VIEWER_PROJECTS, ViewerProjects>;
}

/** The key the viewer's projects are read under. */
const VIEWER_PROJECTS = 'viewerProjects';

/**
 * What the pickers offer and what the viewer may do, per repository (D14) — labels, open milestones, assignable
 * users, issue types, the viewer's permission — and the projects the viewer can add items to. Read lazily, when
 * a picker or an item of the repository opens ({@link ensure}), used for 10 minutes, and kept in the
 * signed-in user's local copy.
 *
 * It follows the signed-in user like the item store: their metadata leaves memory when they sign out (the item
 * store deletes the copy holding it), and an answer arriving for a session that ended is dropped.
 */
export type RepositoryStore = Resolved<typeof RepositoryStore>;
export const RepositoryStore = defineService({
    name: 'RepositoryStore',
    deps: {
        accounts: AccountSession,
        items: ItemStore,
        persistence: RepositoryPersistence,
        rateLimits: GitHubRateLimitStore,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, items, persistence, rateLimits, clock, logger }) {
        const repositoriesRef = shallowRef<ReadonlyMap<string, RepositoryMetadata>>(new Map());
        const viewerProjectsRef = shallowRef<ViewerProjects | null>(null);

        let session: Session | null = null;

        accounts.onChange(follow);

        return {
            /** The metadata of `owner/name` as last read, or `undefined`; reactive. */
            get(nameWithOwner: string) {
                return repositoriesRef.value.get(nameWithOwner);
            },
            /** The projects the viewer can add items to, as last read, or `null`; reactive. */
            get viewerProjects(): readonly ViewerProject[] | null {
                return viewerProjectsRef.value?.projects ?? null;
            },
            ensure,
            ensureViewerProjects,
            complete,
        };

        /**
         * The metadata of `owner/name`: the copy in memory while it is under `maxAgeMs` old (10 minutes; `0` after
         * GitHub said something in it is gone), else read from GitHub. Never rejects: when GitHub cannot be asked or
         * does not answer, the copy in memory however old, or `null` without one or for a repository GitHub does not
         * show the user.
         */
        async function ensure(nameWithOwner: string, maxAgeMs = METADATA_TTL_MS): Promise<RepositoryMetadata | null> {
            const current = session;
            if (!current) {
                return null;
            }

            await current.ready;
            return isCurrent(current)
                ? current.repositories.ensure(nameWithOwner, maxAgeMs)
                : (repositoriesRef.value.get(nameWithOwner) ?? null);
        }

        /**
         * The metadata with the labels and users it does not hold looked up by name — past the pages read, or made
         * since. One GitHub does not know stays out. Rejects when GitHub cannot be asked or does not answer.
         */
        async function complete(metadata: RepositoryMetadata, names: RepositoryNames): Promise<RepositoryMetadata> {
            const current = session;
            const labelNames = names.labels.filter(name => !metadata.labels.some(label => label.name === name));
            const logins = names.logins.filter(login => !metadata.assignableUsers.some(user => user.login === login));
            if (!current || (labelNames.length === 0 && logins.length === 0)) {
                return metadata;
            }

            const { owner, name } = parseRepositoryName(metadata.nameWithOwner);
            const labels = await Promise.all(
                labelNames.map(
                    async label =>
                        (await current.account.sdk.RepositoryLabel({ owner, name, label })).repository?.label,
                ),
            );
            const users = await Promise.all(
                logins.map(async login => (await current.account.sdk.UserByLogin({ login })).user),
            );

            return {
                ...metadata,
                labels: [...metadata.labels, ...labels.filter(label => label != null).map(toLabel)],
                assignableUsers: [...metadata.assignableUsers, ...users.filter(user => user != null).map(toUser)],
            };
        }

        /** The projects the viewer can add items to, as {@link ensure} reads metadata. */
        async function ensureViewerProjects(): Promise<readonly ViewerProject[] | null> {
            const current = session;
            if (!current) {
                return null;
            }

            await current.ready;
            const projects = isCurrent(current)
                ? await current.viewerProjects.ensure(VIEWER_PROJECTS)
                : viewerProjectsRef.value;
            return projects?.projects ?? null;
        }

        /** Another account signed in, or none: the metadata of whoever was before leaves memory. */
        function follow(account: Account | null) {
            session = null;
            repositoriesRef.value = new Map();
            viewerProjectsRef.value = null;
            if (!account) {
                return;
            }

            const now = () => clock.now();
            const current: Session = {
                account,
                ready: Promise.resolve(),
                repositories: createExpiringReads({
                    now,
                    maxAgeMs: METADATA_TTL_MS,
                    getKept: nameWithOwner => repositoriesRef.value.get(nameWithOwner),
                    read: nameWithOwner => readRepository(current, nameWithOwner),
                }),
                viewerProjects: createExpiringReads({
                    now,
                    maxAgeMs: METADATA_TTL_MS,
                    getKept: () => viewerProjectsRef.value ?? undefined,
                    read: () => readViewerProjects(current),
                }),
            };
            session = current;
            current.ready = readKept(current);
        }

        /** Puts the kept metadata into memory, once the item store opened the copy, under what was read since. */
        async function readKept(current: Session) {
            await items.ready();
            if (!isCurrent(current)) {
                return;
            }

            let persisted: PersistedRepositories;
            try {
                persisted = await persistence.loadRepositories(current.account.login);
            } catch (error) {
                logger.warn('Could not read the kept repository metadata; reading it again from GitHub', { error });
                return;
            }

            if (!isCurrent(current)) {
                return;
            }

            const repositories = new Map<string, RepositoryMetadata>();
            for (const metadata of persisted.repositories) {
                repositories.set(metadata.nameWithOwner, metadata);
            }

            repositoriesRef.value = repositories;
            viewerProjectsRef.value = persisted.viewerProjects;
        }

        /** `null` when GitHub cannot be asked, does not answer, or does not show the repository. */
        async function readRepository(current: Session, nameWithOwner: string) {
            const { owner, name } = parseRepositoryName(nameWithOwner);
            if (rateLimits.remaining('graphql') === 0) {
                return null;
            }

            let answer: RepositoryMetadataQuery;
            try {
                answer = await current.account.sdk.RepositoryMetadata({ owner, name });
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('Repository metadata could not be read', { nameWithOwner, error });
                }

                return null;
            }

            if (!isCurrent(current)) {
                return null;
            }

            if (!answer.repository) {
                logger.warn('Repository not found', { nameWithOwner });
                return null;
            }

            const [labels, users] = await Promise.all([
                readPages(answer.repository.labels, async after => {
                    const page = await current.account.sdk.RepositoryLabels({ owner, name, after });
                    return page.repository?.labels;
                }),
                readPages(answer.repository.assignableUsers, async after => {
                    const page = await current.account.sdk.RepositoryAssignableUsers({ owner, name, after });
                    return page.repository?.assignableUsers;
                }),
            ]);
            if (!isCurrent(current)) {
                return null;
            }

            const metadata = toRepositoryMetadata({
                repository: answer.repository,
                labels,
                users,
                fetchedAt: clock.now(),
            });
            repositoriesRef.value = new Map(repositoriesRef.value).set(metadata.nameWithOwner, metadata);
            persistence.saveRepository(current.account.login, metadata).catch((error: unknown) => {
                logger.warn('Could not keep repository metadata', { error });
            });
            return metadata;
        }

        /**
         * `null` when GitHub cannot be asked or does not answer. An organisation hiding its projects from githq
         * (OAuth App restrictions) leaves only its own out.
         */
        async function readViewerProjects(current: Session) {
            if (rateLimits.remaining('graphql') === 0) {
                return null;
            }

            const errors: GitHubGraphQLErrorEntry[] = [];
            let answer: ViewerProjectsQuery;
            try {
                answer = await current.account.sdk.ViewerProjects(
                    {},
                    { onPartialErrors: found => errors.push(...found) },
                );
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn("The viewer's projects could not be read", { error });
                }

                return null;
            }

            if (!isCurrent(current)) {
                return null;
            }

            if (errors.length > 0) {
                logger.warn("The viewer's projects read in part", { errors });
            }

            const projects = toViewerProjects(answer, current.account.login, clock.now());
            viewerProjectsRef.value = projects;
            persistence.saveViewerProjects(current.account.login, projects).catch((error: unknown) => {
                logger.warn("Could not keep the viewer's projects", { error });
            });
            return projects;
        }

        /**
         * The nodes of `first` and of the pages after it, up to {@link MAX_PAGES}. A page that cannot be read ends
         * it: the pickers offer what was read.
         */
        async function readPages<T>(
            first: Page<T> | null | undefined,
            readNext: (after: string) => Promise<Page<T> | null | undefined>,
        ): Promise<T[]> {
            const nodes: T[] = [];
            let page = first;
            for (let read = 1; page; read++) {
                nodes.push(...filterNotNull(page.nodes ?? []));

                const after = page.pageInfo.endCursor;
                if (!page.pageInfo.hasNextPage || after === null || read >= MAX_PAGES) {
                    break;
                }

                try {
                    page = await readNext(after);
                } catch (error) {
                    logger.warn('A page of repository metadata could not be read', { error });
                    break;
                }
            }

            return nodes;
        }

        /** Whether `current` is still the session — here and in the store every request was authorised by. */
        function isCurrent(current: Session) {
            return session === current && accounts.isCurrent(current.account);
        }
    },
});

/** What {@link toRepositoryMetadata} builds the metadata from. */
interface ToRepositoryMetadataParams {
    readonly repository: NonNullable<RepositoryMetadataQuery['repository']>;
    /** Every page read. */
    readonly labels: readonly RepositoryLabelFieldsFragment[];
    /** Every page read. */
    readonly users: readonly RepositoryUserFieldsFragment[];
    readonly fetchedAt: number;
}

function toRepositoryMetadata(params: ToRepositoryMetadataParams): RepositoryMetadata {
    const { repository, fetchedAt } = params;

    return {
        nameWithOwner: repository.nameWithOwner,
        id: repository.id,
        viewerPermission: repository.viewerPermission,
        hasIssuesEnabled: repository.hasIssuesEnabled,
        isArchived: repository.isArchived,
        labels: params.labels.map(toLabel),
        milestones: mapNotNull(
            repository.milestones?.nodes ?? [],
            (milestone): RepositoryMilestone | null =>
                milestone && { id: milestone.id, title: milestone.title, dueOn: milestone.dueOn },
        ),
        assignableUsers: params.users.map(toUser),
        issueTypes: mapNotNull(repository.issueTypes?.nodes ?? [], (issueType): RepositoryIssueType | null =>
            issueType?.isEnabled
                ? {
                      id: issueType.id,
                      name: issueType.name,
                      color: issueType.color,
                      description: issueType.description,
                  }
                : null,
        ),
        fetchedAt,
    };
}

function toLabel(label: RepositoryLabelFieldsFragment): RepositoryLabel {
    return { id: label.id, name: label.name, color: label.color, description: label.description };
}

function toUser(user: RepositoryUserFieldsFragment): RepositoryUser {
    return { id: user.id, login: user.login, name: user.name, avatarUrl: user.avatarUrl };
}

function toViewerProjects(answer: ViewerProjectsQuery, viewer: string, fetchedAt: number): ViewerProjects {
    const projects: ViewerProject[] = mapNotNull(
        answer.viewer.projectsV2.nodes ?? [],
        project => project && { ...project, owner: viewer },
    );
    for (const organization of filterNotNull(answer.viewer.organizations.nodes ?? [])) {
        projects.push(
            ...mapNotNull(
                organization.projectsV2.nodes ?? [],
                project => project && { ...project, owner: organization.login },
            ),
        );
    }

    return { projects, fetchedAt };
}
