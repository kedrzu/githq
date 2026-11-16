import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { CircleDot, GitCommitHorizontal, GitPullRequest, Workflow } from 'lucide-vue-next';

import { withPhoneLayout } from '@/testing/withPhoneLayout.js';

import HeaderTabs from './HeaderTabs.vue';

const meta = {
    component: HeaderTabs,
    decorators: [withPhoneLayout(false)],
    args: {
        tabs: {
            kind: 'model',
            label: 'Sections',
            options: [
                {
                    value: 'issues',
                    label: 'Issues',
                    icon: CircleDot,
                    count: 0,
                    keyshortcuts: '1',
                    tooltip: 'Go to issues',
                },
                {
                    value: 'pullRequests',
                    label: 'Pull requests',
                    icon: GitPullRequest,
                    count: 15,
                    keyshortcuts: '2',
                    tooltip: 'Go to pull requests',
                },
                {
                    value: 'commits',
                    label: 'Commits',
                    icon: GitCommitHorizontal,
                    keyshortcuts: '3',
                    tooltip: 'Go to commits',
                },
                {
                    value: 'workflows',
                    label: 'Workflows',
                    icon: Workflow,
                    count: '–',
                    keyshortcuts: '4',
                    tooltip: 'Go to workflows',
                },
            ],
            value: 'pullRequests',
            choose: () => undefined,
            stepHint: 'Previous / next section',
        },
    },
} satisfies Meta<typeof HeaderTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A repository's sections in one bordered group (CH67), with their counts; Pull requests shown, filled. */
export const Sections: Story = {};

/** Folded (CH77, CH82): one menu button showing the current section, its icon and count; its menu ends in the `[` `]` hint. */
export const SectionsCompact: Story = { args: { compact: true } };

/** A project's saved views, each a link with its key, drawn as the sections are: one GitHub answers carries a cloud, one changed here a dot, each saying so under its tooltip (D14–D16). */
export const SavedViews: Story = {
    args: {
        tabs: {
            kind: 'links',
            label: 'Saved views',
            links: [
                {
                    key: 'sprint',
                    label: 'Current sprint',
                    to: '/views/1',
                    current: true,
                    keyshortcuts: '1',
                    tooltip: 'Go to Current sprint',
                },
                {
                    key: 'board',
                    label: 'Board',
                    to: '/views/2',
                    current: false,
                    modified: true,
                    keyshortcuts: '2',
                    tooltip: 'Go to Board',
                },
                {
                    key: 'next',
                    label: 'Next sprint',
                    to: '/views/3',
                    current: false,
                    answered: true,
                    keyshortcuts: '3',
                    tooltip: 'Go to Next sprint',
                },
            ],
            stepHint: 'Previous / next view',
        },
    },
};

/** Folded (D13, D17): the current saved view on one menu button; its menu lists every view with its key and ends in the `[` `]` hint. */
export const SavedViewsCompact: Story = { args: { ...SavedViews.args, compact: true } };
