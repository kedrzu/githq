import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_CANDIDATES } from '@/testing/sampleTracking.js';

import type { TrackedRow } from './TrackingView.vue';
import TrackingView from './TrackingView.vue';

const meta = {
    component: TrackingView,
    args: {
        tab: 'repositories',
        tracked: {
            repositories: [
                repository('sigma-clinic/portal', true, 1420),
                repository('sigma-clinic/api', true, 1160),
                repository('kedrzu/githq', false, 430),
                repository('kedrzu/dotfiles', false, 6),
                repository('kedrzu/skills', false, 212),
                {
                    ...repository('kedrzu/blog', false, null),
                    state: { kind: 'downloading', percent: 18 },
                },
                { ...repository('acme/locked', false, 52), state: { kind: 'refused' } },
            ],
            projects: [
                {
                    target: { kind: 'project', id: 'PVT_kedrzu_1' },
                    name: 'githq Roadmap',
                    to: '/users/kedrzu/projects/1',
                    isPrivate: false,
                    items: 34,
                    state: { kind: 'read', at: SAMPLE_NOW - 14_000, fresh: true, slower: false },
                },
                {
                    target: { kind: 'project', id: 'PVT_acme_3' },
                    name: 'Acme public roadmap',
                    to: '/orgs/acme/projects/3',
                    isPrivate: false,
                    items: 120,
                    state: { kind: 'read', at: SAMPLE_NOW - 180_000, fresh: true, slower: true },
                },
            ],
        },
        suggested: [
            { nameWithOwner: 'sigma-clinic/mobile', isPrivate: true, items: 1, activeAt: SAMPLE_NOW - 3_600_000 },
            {
                nameWithOwner: 'sigma-clinic/platform-infra',
                isPrivate: true,
                items: 2,
                activeAt: SAMPLE_NOW - 2 * 86_400_000,
            },
        ],
        candidates: SAMPLE_CANDIDATES,
        approvals: { 'acme-health': Date.parse('2026-10-28T10:00:00Z') },
        now: SAMPLE_NOW,
        find: fn(() => Promise.resolve(null)),
        onUntrack: fn(),
        onTrackSuggested: fn(),
        onTrack: fn(),
        onRequestApproval: fn(),
    },
    render: args => ({
        components: { TrackingView },
        setup: () => ({ args }),
        template: '<div style="display: flex; height: 100vh"><TrackingView v-bind="args" /></div>',
    }),
} satisfies Meta<typeof TrackingView>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * G8: what is tracked, how much of it is kept and how fresh it is, with "Untrack"; the repositories the user's work
 * lives in, suggested; anyone's by name; acme-health hiding its private data, with the request remembered.
 */
export const Repositories: Story = {};

/** The projects: the tracked one, and the user's and their organisations' others to track. */
export const Projects: Story = { args: { tab: 'projects' } };

/** Before the organisations are read: what is tracked shows at once. */
export const ReadingOrganisations: Story = { args: { candidates: null, suggested: [] } };

function repository(name: string, isPrivate: boolean, items: number | null): TrackedRow {
    return {
        target: { kind: 'repository', nameWithOwner: name },
        name,
        to: `/${name}`,
        isPrivate,
        items,
        state: { kind: 'read', at: SAMPLE_NOW - 14_000, fresh: true, slower: false },
    };
}
