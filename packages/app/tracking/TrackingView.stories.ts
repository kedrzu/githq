import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { EMPTY_CANDIDATES, SAMPLE_CANDIDATES, sampleCandidateRepository } from '@/testing/sampleTracking.js';

import SettingsView from '@/settings/SettingsView.vue';

import type { TrackedRow } from './TrackingView.vue';
import TrackingView from './TrackingView.vue';

const meta = {
    component: TrackingView,
    args: {
        tab: 'repositories',
        tracked: {
            repositories: [
                repository('skyline-labs/portal', true, 1420),
                repository('skyline-labs/api', true, 1160),
                repository('kedrzu/githq', false, 430),
                repository('kedrzu/dotfiles', false, 6),
                repository('kedrzu/skills', false, 212),
                {
                    ...repository('kedrzu/blog', false, 412),
                    activeAt: null,
                    state: { kind: 'downloading', done: 412, total: 1180 },
                },
                { ...repository('acme/locked', false, 52), state: { kind: 'refused' } },
            ],
            projects: [
                {
                    target: { kind: 'project', id: 'PVT_kedrzu_1' },
                    name: 'githq Roadmap',
                    owner: 'kedrzu',
                    to: '/users/kedrzu/projects/1',
                    isPrivate: false,
                    items: 34,
                    activeAt: null,
                    state: { kind: 'read', at: SAMPLE_NOW - 14_000, fresh: true, slower: false },
                },
                {
                    target: { kind: 'project', id: 'PVT_acme_3' },
                    name: 'Acme public roadmap',
                    owner: 'acme',
                    to: '/orgs/acme/projects/3',
                    isPrivate: false,
                    items: 120,
                    activeAt: null,
                    state: { kind: 'read', at: SAMPLE_NOW - 180_000, fresh: true, slower: true },
                },
            ],
        },
        suggested: [
            { nameWithOwner: 'skyline-labs/mobile', isPrivate: true, items: 1, activeAt: SAMPLE_NOW - 3_600_000 },
            {
                nameWithOwner: 'skyline-labs/platform-infra',
                isPrivate: true,
                items: 2,
                activeAt: SAMPLE_NOW - 2 * 86_400_000,
            },
        ],
        candidates: SAMPLE_CANDIDATES,
        approvals: { 'acme-health': Date.parse('2026-10-28T10:00:00Z') },
        storedBytes: 48_000_000,
        now: SAMPLE_NOW,
        find: fn(() => Promise.resolve(null)),
        onUntrack: fn(),
        onTrackSuggested: fn(),
        onTrack: fn(),
        onLoadMore: fn(),
        onRequestApproval: fn(),
    },
    // In Settings, whose header takes its controls, as tall as the window, like in the app.
    render: args => ({
        components: { SettingsView, TrackingView },
        setup: () => ({ args }),
        template: `
            <div style="display: flex; height: 100vh">
                <SettingsView :section="args.tab" :repositories="7" :projects="2">
                    <TrackingView v-bind="args" />
                </SettingsView>
            </div>`,
    }),
} satisfies Meta<typeof TrackingView>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * G8: what is tracked, how much of it is kept and how fresh it is, with "Untrack" and a download in place; the
 * repositories the user's work lives in, suggested; how many more there are; acme-health hiding its private data, with
 * the request remembered.
 */
export const Repositories: Story = {};

/** T1: a search narrows what is tracked and what is not, Suggested gone; the rest of skyline-labs is being read. */
export const Searching: Story = { args: { initialSearch: 'pay' } };

/** T2: the projects, tracked and not. */
export const Projects: Story = { args: { tab: 'projects' } };

/** Before the organisations are read: what is tracked shows at once. */
export const ReadingOrganisations: Story = { args: { candidates: null, suggested: [] } };

/** Someone else's repository, named by the search, offered once GitHub answered. */
export const SomeoneElses: Story = {
    args: {
        initialSearch: 'vitejs/vite',
        find: fn(() => Promise.resolve(sampleCandidateRepository('vitejs/vite', { ago: 7_200_000, open: 88 }))),
    },
};

/** No organisations: the panel goes, heading and all. */
export const NoOrganisations: Story = { args: { candidates: EMPTY_CANDIDATES, suggested: [] } };

/** A narrow window: the keys hint goes, the search shrinks, and the organisations go under the lists. */
export const NarrowWindow: Story = {
    decorators: [() => ({ template: '<div style="width: 640px"><story /></div>' })],
};

function repository(name: string, isPrivate: boolean, items: number | null): TrackedRow {
    return {
        target: { kind: 'repository', nameWithOwner: name },
        name,
        owner: name.split('/')[0] ?? '',
        to: `/${name}`,
        isPrivate,
        items,
        activeAt: SAMPLE_NOW - 12 * 60_000,
        state: { kind: 'read', at: SAMPLE_NOW - 14_000, fresh: true, slower: false },
    };
}
