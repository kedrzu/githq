import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { computed, defineComponent, ref } from 'vue';

import TrackedListView from './TrackedListView.vue';
import TrackedProjectRow from './TrackedProjectRow.vue';
import TrackedRepositoryRow from './TrackedRepositoryRow.vue';
import type { TrackedStatus } from './TrackingTypes.js';
import type { SortablePlace } from './useSortableRows.js';

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
    readonly owner: string;
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
    /** In the user's order. */
    readonly repositories: readonly RepositoryRowData[];
    /** In the user's order. */
    readonly projects: readonly ProjectRowData[];
    readonly onOpen: (row: unknown) => void;
    readonly onUntrack: (row: unknown) => void;
    readonly onAdd: () => void;
    readonly onMove: (row: unknown, place: SortablePlace<unknown>) => void;
    readonly loaded: boolean;
    /** A phone's Settings (mobile D35). */
    readonly phone?: boolean;
}

function repository(nameWithOwner: string, openCount: number, isPrivate: boolean | null = false): RepositoryRowData {
    return { nameWithOwner, isPrivate, openCount, status: SYNCED };
}

/** Owners mixed, as the user ordered them (D44). */
const REPOSITORIES: readonly RepositoryRowData[] = [
    repository('mlaine/tasklet', 18),
    repository('fitloop/webapp', 142, true),
    repository('mlaine/blog', 2),
    repository('fitloop/api', 96, true),
    repository('mlaine/notes', 3, true),
    { ...repository('nuxt/nuxt', 812), status: { kind: 'read', at: NOW - 60_000, slower: false } },
    repository('mlaine/advent-2025', 0),
];

const PROJECTS: readonly ProjectRowData[] = [
    {
        id: 'PVT_12',
        owner: 'fitloop',
        title: 'Platform Q4',
        number: 12,
        itemCount: 128,
        repositories: ['fitloop/webapp', 'fitloop/api', 'fitloop/mobile', 'fitloop/infra'],
        trackedRepositories: 2,
        status: SYNCED,
    },
    {
        id: 'PVT_1',
        owner: 'mlaine',
        title: 'tasklet Roadmap',
        number: 1,
        itemCount: 34,
        repositories: ['mlaine/tasklet'],
        trackedRepositories: 1,
        status: SYNCED,
    },
    {
        id: 'PVT_9',
        owner: 'fitloop',
        title: 'Docs revamp',
        number: 9,
        itemCount: 12,
        repositories: ['fitloop/webapp'],
        trackedRepositories: 1,
        status: SYNCED,
    },
    {
        id: 'PVT_14',
        owner: 'fitloop',
        title: 'Ideas',
        number: 14,
        itemCount: 3,
        repositories: [],
        trackedRepositories: 0,
        status: SYNCED,
    },
];

// No `component`: Storybook's types can't take a generic component; the stories render it themselves.
const meta = {
    args: {
        kind: 'repositories',
        repositories: REPOSITORIES,
        projects: PROJECTS,
        onOpen: fn(),
        onUntrack: fn(),
        onAdd: fn(),
        onMove: fn(),
        loaded: true,
    },
    // As tall as Settings' section, like in the app; an untracked row leaves and a moved one takes its place, as the
    // section's would through the store.
    render: args =>
        defineComponent({
            setup() {
                const gone = ref<ReadonlySet<string>>(new Set());
                const repositoryOrder = ref<readonly RepositoryRowData[]>(args.repositories);
                const projectOrder = ref<readonly ProjectRowData[]>(args.projects);
                const repositories = computed(() =>
                    repositoryOrder.value.filter(row => !gone.value.has(row.nameWithOwner)),
                );
                const projects = computed(() => projectOrder.value.filter(row => !gone.value.has(row.id)));

                return () => (
                    <div style={{ display: 'flex', height: '100vh' }}>
                        {args.kind === 'repositories' ? (
                            <TrackedListView
                                kind="repositories"
                                rows={repositories.value}
                                getKey={row => row.nameWithOwner}
                                loaded={args.loaded}
                                phone={args.phone}
                                onOpen={args.onOpen}
                                onUntrack={row => untrack(row.nameWithOwner, row)}
                                onAdd={args.onAdd}
                                onMove={(row, place) => {
                                    repositoryOrder.value = moveRow(repositoryOrder.value, row, place);
                                    args.onMove(row, place);
                                }}
                            >
                                {{
                                    row: ({ row, selected }: { row: RepositoryRowData; selected: boolean }) => (
                                        <TrackedRepositoryRow
                                            {...row}
                                            now={NOW}
                                            selected={selected}
                                            phone={args.phone}
                                            onUntrack={() => untrack(row.nameWithOwner, row)}
                                        />
                                    ),
                                }}
                            </TrackedListView>
                        ) : (
                            <TrackedListView
                                kind="projects"
                                rows={projects.value}
                                getKey={row => row.id}
                                loaded={args.loaded}
                                phone={args.phone}
                                onOpen={args.onOpen}
                                onUntrack={row => untrack(row.id, row)}
                                onAdd={args.onAdd}
                                onMove={(row, place) => {
                                    projectOrder.value = moveRow(projectOrder.value, row, place);
                                    args.onMove(row, place);
                                }}
                            >
                                {{
                                    row: ({ row, selected }: { row: ProjectRowData; selected: boolean }) => (
                                        <TrackedProjectRow
                                            {...row}
                                            now={NOW}
                                            selected={selected}
                                            phone={args.phone}
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
            },
        }),
} satisfies Meta<TrackedListArgs>;

export default meta;

type Story = StoryObj<TrackedListArgs>;

/** G8: one flat list in the user's order, owners mixed, each row naming its owner. */
export const Repositories: Story = {};

/** T17: each project's owner, where its items come from, how many items, how it stands. */
export const Projects: Story = { args: { kind: 'projects' } };

/** Before GitHub's lists are read: what this browser keeps, without a visibility tag where nothing tells. */
export const BeforeListsRead: Story = {
    args: { repositories: [repository('mlaine/tasklet', 18), repository('fitloop/webapp', 142, null)] },
};

/** ES24: nothing tracked: the note and its button alone. */
export const NothingTracked: Story = { args: { repositories: [], projects: [] } };

/** MB151: on a phone, the same flat list, each row drilling into its settings; no dragging. */
export const RepositoriesPhone: Story = { args: { phone: true } };

/** MB154: a phone's Projects. */
export const ProjectsPhone: Story = { args: { kind: 'projects', phone: true } };

/** MB162: nothing tracked on a phone: the note and "Track repositories" the width of the screen. */
export const NothingTrackedPhone: Story = { args: { repositories: [], projects: [], phone: true } };

/** The list with `row` put right before or after `place.anchor`, as `TrackingStore.move` puts it. */
function moveRow<T>(rows: readonly T[], row: T, place: SortablePlace<T>): readonly T[] {
    const rest = rows.filter(candidate => candidate !== row);
    const index = rest.indexOf(place.anchor) + (place.side === 'after' ? 1 : 0);
    return [...rest.slice(0, index), row, ...rest.slice(index)];
}
