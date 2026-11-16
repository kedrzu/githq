import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { defineComponent, h, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { SAMPLE_MY_WORK_COUNTS, SAMPLE_TRACKED, sampleGetChildren, withOpenPlace } from '@/testing/samplePlaces.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import PlacesPanel from './PlacesPanel.vue';

const CHECKED_AT = new Date('2026-10-30T14:06:00').getTime();

const meta = {
    component: PlacesPanel,
    args: {
        open: true,
        viewer: SAMPLE_VIEWER,
        counts: SAMPLE_MY_WORK_COUNTS,
        tracked: SAMPLE_TRACKED,
        getChildren: sampleGetChildren({ phone: true }),
        freshness: { kind: 'fresh', checkedAt: CHECKED_AT },
        rateLimit: { resource: 'graphql', limit: 5000, remaining: 4812, resetAt: new Date('2026-10-30T15:00:00Z') },
        onSignOut: fn(),
        onShowFailure: fn(),
    },
    decorators: [showingRoute()],
} satisfies Meta<typeof PlacesPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

/** In My work (mobile MB26): the places over the dimmed screen, My work marked; at the foot how fresh and the allowance, then the user. */
export const InMyWork: Story = { decorators: [onPage('/')] };

/** In a repository, on its pull requests (MB270): its sections shown under it to begin with, Pull requests marked. */
export const InRepository: Story = {
    args: {
        tracked: withOpenPlace(SAMPLE_TRACKED, 'repository:skyline-labs/portal'),
        getChildren: sampleGetChildren({
            open: { kind: 'repository', nameWithOwner: 'skyline-labs/portal' },
            current: 'pullRequests',
            phone: true,
        }),
    },
    decorators: [onPage('/skyline-labs/portal/pulls')],
};

/** While everything tracked downloads (mobile D31): the foot says how far in place of the allowance. */
export const Downloading: Story = {
    args: { download: { done: 1240, total: 8000, secondsLeft: 120, repositories: 3, projects: 1 } },
    decorators: [onPage('/')],
};

/** Offline (mobile D12): the foot says so in amber. */
export const Offline: Story = {
    args: { notice: { kind: 'offline', since: CHECKED_AT } },
    decorators: [onPage('/')],
};

/** Closed: nothing of it on the page. */
export const Closed: Story = { args: { open: false } };

/** The story's address, on a wrapper's `data-route`, for a spec to see where a link went. */
function showingRoute(): Decorator {
    return story => {
        const Story = story();
        return defineComponent({
            setup: () => {
                const route = useRoute();
                return () => h('div', { 'data-route': route.fullPath }, [h(Story)]);
            },
        });
    };
}

/** Opens the story at an address, the panel once it is there: as in the app, opened on a screen already shown. */
function onPage(path: string): Decorator {
    return story => {
        const Story = story();
        return defineComponent({
            setup: () => {
                const router = useRouter();
                const there = ref(false);
                void go();
                return () => (there.value ? h(Story) : null);

                async function go() {
                    await router.replace(path);
                    there.value = true;
                }
            },
        });
    };
}
