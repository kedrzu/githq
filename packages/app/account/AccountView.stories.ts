import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import AccountView from './AccountView.vue';

const meta = {
    component: AccountView,
    args: {
        viewer: SAMPLE_VIEWER,
        organizations: {
            kind: 'read',
            organizations: [
                { login: 'acme-health', hiddenPrivate: true, requestedAt: Date.parse('2026-10-28T10:00:00Z') },
                { login: 'skyline-labs', hiddenPrivate: false, requestedAt: Date.parse('2026-10-20T10:00:00Z') },
                { login: 'kedrzu-labs', hiddenPrivate: false, requestedAt: null },
            ],
        },
        copy: { repositories: 15, projects: 1, items: 3020, bytes: 48_200_000 },
        refresh: { kind: 'running', lastAt: SAMPLE_NOW - 14_000 },
        rateLimit: { resource: 'graphql', limit: 5000, remaining: 4812, resetAt: new Date(SAMPLE_NOW + 32 * 60_000) },
        now: SAMPLE_NOW,
        approvalUrl: 'https://githq.test/api/auth/approval',
        onRequestApproval: fn(),
        onRetry: fn(),
        onSignOut: fn(),
    },
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AccountView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** G9: who the user is, an organisation hiding its private data with the approval already requested, the copy kept here and signing out. */
export const Account: Story = {};

/** An organisation hiding its data whose approval was never requested. */
export const NotRequested: Story = {
    args: {
        organizations: {
            kind: 'read',
            organizations: [{ login: 'acme-health', hiddenPrivate: true, requestedAt: null }],
        },
    },
};

/** The organisations are being asked for; nothing downloaded yet, the allowance not known. */
export const Loading: Story = {
    args: {
        organizations: { kind: 'loading' },
        copy: { repositories: 0, projects: 0, items: 0, bytes: null },
        refresh: { kind: 'running', lastAt: null },
        rateLimit: null,
    },
};

/** GitHub could not be asked for the organisations: try again. */
export const Failed: Story = { args: { organizations: { kind: 'failed' } } };

/** A member of no organisation. */
export const NoOrganizations: Story = { args: { organizations: { kind: 'read', organizations: [] } } };

/** The allowance used up (K3): refresh waits for it to reset. */
export const RefreshPaused: Story = {
    args: {
        refresh: { kind: 'paused', until: SAMPLE_NOW + 18 * 60_000 },
        rateLimit: { resource: 'graphql', limit: 5000, remaining: 0, resetAt: new Date(SAMPLE_NOW + 18 * 60_000) },
    },
};
