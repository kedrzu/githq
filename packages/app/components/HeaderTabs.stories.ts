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
        },
    },
} satisfies Meta<typeof HeaderTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A repository's sections in one bordered group (CH67), with their counts; Pull requests shown, filled. */
export const Sections: Story = {};

/** Folded (CH77): one menu button showing the current section, its icon and count. */
export const SectionsCompact: Story = { args: { compact: true } };

/** A project's saved views, each a link, drawn as the sections are: one GitHub answers carries a cloud, one changed here a dot, each saying so in its tooltip. */
export const SavedViews: Story = {
    args: {
        tabs: {
            kind: 'links',
            label: 'Saved views',
            links: [
                { key: '1', label: 'Current sprint', to: '/views/1', current: true },
                { key: '2', label: 'Board', to: '/views/2', current: false, modified: true },
                { key: '3', label: 'Next sprint', to: '/views/3', current: false, answered: true },
            ],
        },
    },
};

/** Folded (D13): the current saved view on one menu button. */
export const SavedViewsCompact: Story = { args: { ...SavedViews.args, compact: true } };
