import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { computed, defineComponent, ref } from 'vue';

import TrackedListView from './TrackedListView.vue';
import TrackedProjectRow from './TrackedProjectRow.vue';
import TrackedRepositoryRow from './TrackedRepositoryRow.vue';
import type { TrackedStatus } from './TrackingTypes.js';
import type { TrackedOwnerGroup, TrackedOwnerRelation } from './utils/groupTrackedByOwner.js';

const NOW = Date.parse('2026-05-04T12:00:00Z');
const SYNCED: TrackedStatus = { kind: 'read', at: NOW - 14_000, slower: false };

/** A repository's row as the section gives it. */
interface RepositoryRowData {
    readonly nameWithOwner: string;
    readonly isPrivate: boolean | null;
    readonly openCount: number;
    readonly status: TrackedStatus;
}

/** A project's row as the section gives it. */
interface ProjectRowData {
    readonly id: string;
    readonly title: string;
    readonly number: number;
    readonly itemCount: number;
    readonly repositories: readonly string[];
    readonly trackedRepositories: number;
    readonly status: TrackedStatus;
}

/** What a story shows. */
interface TrackedListArgs {
    readonly kind: 'repositories' | 'projects';
    readonly repositories: readonly TrackedOwnerGroup<RepositoryRowData>[];
    readonly projects: readonly TrackedOwnerGroup<ProjectRowData>[];
    readonly onOpen: (row: unknown) => void;
    readonly onUntrack: (row: unknown) => void;
    readonly onAdd: (owner?: string) => void;
    readonly loaded: boolean;
}

/** One owner's group. */
interface GroupParams<T> {
    readonly login: string;
    readonly relation: TrackedOwnerRelation;
    readonly total?: number;
    readonly rows: readonly T[];
}

function group<T>(params: GroupParams<T>): TrackedOwnerGroup<T> {
    const total = params.total ?? null;
    return {
        login: params.login,
        relation: params.relation,
        ownerKind: params.relation === 'own' ? 'user' : 'org',
        total,
        canTrackMore: total !== null && params.relation !== 'notMember' && params.rows.length < total,
        rows: params.rows,
    };
}

function repository(nameWithOwner: string, openCount: number, isPrivate: boolean | null = false): RepositoryRowData {
    return { nameWithOwner, isPrivate, openCount, status: SYNCED };
}

const OWN_REPOSITORIES: readonly RepositoryRowData[] = [
    repository('mlaine/advent-2025', 0),
    repository('mlaine/blog', 2),
    repository('mlaine/notes', 3, true),
    repository('mlaine/tasklet', 18),
];

const REPOSITORY_GROUPS: readonly TrackedOwnerGroup<RepositoryRowData>[] = [
    group({ login: 'mlaine', relation: 'own', total: 4, rows: OWN_REPOSITORIES }),
    group({
        login: 'fitloop',
        relation: 'organization',
        total: 312,
        rows: [repository('fitloop/api', 96, true), repository('fitloop/webapp', 142, true)],
    }),
    group({
        login: 'nuxt',
        relation: 'notMember',
        rows: [{ ...repository('nuxt/nuxt', 812), status: { kind: 'read' as const, at: NOW - 60_000, slower: false } }],
    }),
];

const PROJECT_GROUPS: readonly TrackedOwnerGroup<ProjectRowData>[] = [
    group({
        login: 'mlaine',
        relation: 'own',
        total: 1,
        rows: [
            {
                id: 'PVT_1',
                title: 'tasklet Roadmap',
                number: 1,
                itemCount: 34,
                repositories: ['mlaine/tasklet'],
                trackedRepositories: 1,
                status: SYNCED,
            },
        ],
    }),
    group({
        login: 'fitloop',
        relation: 'organization',
        total: 6,
        rows: [
            {
                id: 'PVT_9',
                title: 'Docs revamp',
                number: 9,
                itemCount: 12,
                repositories: ['fitloop/webapp'],
                trackedRepositories: 1,
                status: SYNCED,
            },
            {
                id: 'PVT_12',
                title: 'Platform Q4',
                number: 12,
                itemCount: 128,
                repositories: ['fitloop/webapp', 'fitloop/api', 'fitloop/mobile', 'fitloop/infra'],
                trackedRepositories: 2,
                status: SYNCED,
            },
            {
                id: 'PVT_14',
                title: 'Ideas',
                number: 14,
                itemCount: 3,
                repositories: [],
                trackedRepositories: 0,
                status: SYNCED,
            },
        ],
    }),
];

// No `component`: Storybook's types can't take a generic component; the stories render it themselves.
const meta = {
    args: {
        kind: 'repositories',
        repositories: REPOSITORY_GROUPS,
        projects: PROJECT_GROUPS,
        onOpen: fn(),
        onUntrack: fn(),
        onAdd: fn(),
        loaded: true,
    },
    // As tall as Settings' section, like in the app; an untracked row leaves, as the section's would.
    render: args =>
        defineComponent({
            setup() {
                const gone = ref<ReadonlySet<string>>(new Set());
                const repositories = computed(() => without(args.repositories, row => row.nameWithOwner));
                const projects = computed(() => without(args.projects, row => row.id));

                return () => (
                    <div style={{ display: 'flex', height: '100vh' }}>
                        {args.kind === 'repositories' ? (
                            <TrackedListView
                                kind="repositories"
                                groups={repositories.value}
                                getKey={row => row.nameWithOwner}
                                loaded={args.loaded}
                                onOpen={args.onOpen}
                                onUntrack={row => untrack(row.nameWithOwner, row)}
                                onAdd={args.onAdd}
                            >
                                {{
                                    row: ({ row, selected }: { row: RepositoryRowData; selected: boolean }) => (
                                        <TrackedRepositoryRow
                                            {...row}
                                            now={NOW}
                                            selected={selected}
                                            onUntrack={() => untrack(row.nameWithOwner, row)}
                                        />
                                    ),
                                }}
                            </TrackedListView>
                        ) : (
                            <TrackedListView
                                kind="projects"
                                groups={projects.value}
                                getKey={row => row.id}
                                loaded={args.loaded}
                                onOpen={args.onOpen}
                                onUntrack={row => untrack(row.id, row)}
                                onAdd={args.onAdd}
                            >
                                {{
                                    row: ({ row, selected }: { row: ProjectRowData; selected: boolean }) => (
                                        <TrackedProjectRow
                                            {...row}
                                            now={NOW}
                                            selected={selected}
                                            onUntrack={() => untrack(row.id, row)}
                                        />
                                    ),
                                }}
                            </TrackedListView>
                        )}
                    </div>
                );

                function untrack(key: string, row: unknown) {
                    gone.value = new Set([...gone.value, key]);
                    args.onUntrack(row);
                }

                function without<T>(groups: readonly TrackedOwnerGroup<T>[], getKey: (row: T) => string) {
                    return groups
                        .map(entry => ({ ...entry, rows: entry.rows.filter(row => !gone.value.has(getKey(row))) }))
                        .filter(entry => entry.rows.length > 0);
                }
            },
        }),
} satisfies Meta<TrackedListArgs>;

export default meta;

type Story = StoryObj<TrackedListArgs>;

/** G8: the user's own repositories, an organisation's with "Track more", and an owner they aren't in. */
export const Repositories: Story = {};

/** T17: where each project's items come from, how many items, how it stands. */
export const Projects: Story = { args: { kind: 'projects' } };

/** Before GitHub's lists are read: what this browser keeps, by owner, no totals and no "Track more". */
export const BeforeListsRead: Story = {
    args: {
        repositories: [
            group({ login: 'mlaine', relation: 'own', rows: OWN_REPOSITORIES }),
            group({ login: 'fitloop', relation: 'unknown', rows: [repository('fitloop/webapp', 142, null)] }),
        ],
    },
};

/** ES24: nothing tracked: the note and its button alone. */
export const NothingTracked: Story = { args: { repositories: [], projects: [] } };
