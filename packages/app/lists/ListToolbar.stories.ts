import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { CircleDot, GitCommitHorizontal, GitPullRequest, ListFilter, Workflow } from 'lucide-vue-next';
import { userEvent, within } from 'storybook/test';
import { defineComponent, h, shallowRef } from 'vue';

import * as definitions from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import type { HeaderTabsSet } from '@/components/HeaderTabs.vue';
import { useCommands } from '@/commands/useCommands.js';
import MenuItem from '@/components/MenuItem.vue';
import MenuLabel from '@/components/MenuLabel.vue';
import { withPhoneLayout } from '@/testing/withPhoneLayout.js';

import ListToolbar from './ListToolbar.vue';

const meta = {
    component: ListToolbar,
    // The desktop's, whatever the width; the phone's stories say so.
    decorators: [withPhoneLayout(false)],
    args: {
        title: 'Platform Q4',
        groupings: [
            { value: 'none', label: 'None' },
            { value: 'status', label: 'Status' },
        ],
        sorts: [{ value: 'updated', label: 'Updated' }],
        properties: [{ value: 'assignees', label: 'Assignees' }],
        options: { layout: 'list', grouping: 'status', sort: 'updated', properties: ['assignees'] },
    },
} satisfies Meta<typeof ListToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A list that is no repository or project (my work): the title is plain text. */
export const PlainTitle: Story = {};

/** A repository's or a project's view (R1, R2): the title opens its menu, which the page fills. */
export const TitleMenu: Story = {
    render: args => ({
        setup: () => () =>
            h(ListToolbar, args, {
                titleMenu: () => [h(MenuLabel, () => 'Platform Q4 · fitloop'), h(MenuItem, () => 'Open on GitHub')],
            }),
    }),
};

/**
 * On a phone (mobile MB32): the phone's top bar — the places button, the title, the display options as one icon and New
 * issue, the app's; the title's menu and what the list puts beside the title are not drawn.
 */
export const Phone: Story = {
    decorators: [withPhoneLayout(true), withNewIssue()],
    render: args => ({
        setup: () => () =>
            h(ListToolbar, args, {
                titleMenu: () => h(MenuItem, () => 'Open on GitHub'),
                default: () => h('span', 'Beside the title'),
            }),
    }),
};

/** On a phone in a project: New issue is the project's own, not the app's. */
export const PhoneInProject: Story = {
    decorators: [withPhoneLayout(true), withNewIssue({ inProject: true })],
    render: args => ({
        setup: () => () => h(ListToolbar, args),
    }),
};

/** A repository's sections as tabs, Pull requests shown. */
const SECTIONS: HeaderTabsSet = {
    kind: 'model',
    label: 'Sections',
    options: [
        { value: 'issues', label: 'Issues', icon: CircleDot, count: 0, keyshortcuts: '1' },
        { value: 'pullRequests', label: 'Pull requests', icon: GitPullRequest, count: 15, keyshortcuts: '2' },
        { value: 'commits', label: 'Commits', icon: GitCommitHorizontal, keyshortcuts: '3' },
        { value: 'workflows', label: 'Workflows', icon: Workflow, count: 1, keyshortcuts: '4' },
    ],
    value: 'pullRequests',
    choose: () => undefined,
};

/**
 * A repository's header with its sections and its state, at a width (`tid="toolbar-frame"`): the steps it gives way in
 * as the room runs out.
 */
export const Tabs: Story = {
    decorators: [withWidth(1200)],
    args: {
        title: 'healedcare/healed',
        tabs: SECTIONS,
        sorts: [
            { value: 'updated', label: 'Updated' },
            { value: 'created', label: 'Created' },
        ],
        filters: [
            {
                kind: 'menu',
                key: 'state',
                label: 'State',
                icon: ListFilter,
                title: 'Open',
                choices: [
                    { value: 'open', label: 'Open' },
                    { value: 'closed', label: 'Closed' },
                ],
                value: 'open',
                choose: () => undefined,
            },
        ],
    },
};

/** Step 1 (CH75): some view options moved into Display, the tabs side by side, Display labelled. */
export const OptionsInDisplay: Story = { ...Tabs, decorators: [withWidth(720)] };

/** Step 2 (CH76): every option in Display, which is an icon now — its name the tooltip and what screen readers say. */
export const DisplayAsIcon: Story = { ...Tabs, decorators: [withWidth(590)] };

/** Step 3 (CH77): the tabs one menu showing the current section, its icon and count. */
export const TabsAsMenu: Story = { ...Tabs, decorators: [withWidth(480)] };

/** On a phone, the options opened: a sheet from below with the grouping (`ListOptionsSheet`, mobile D36). */
export const PhoneDisplay: Story = {
    ...Phone,
    play: async ({ canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole('button', { name: 'Display' }));
    },
};

/** The story inside a frame of that width (`tid="toolbar-frame"`), which a spec narrows. */
function withWidth(width: number): Decorator {
    return story => {
        const Story = story();
        return defineComponent({
            setup: () => () => h('div', { tid: 'toolbar-frame', style: { width: `${width}px` } }, h(Story)),
        });
    };
}

/** What {@link withNewIssue} registers besides the app's New issue. */
interface WithNewIssueOptions {
    /** A project's own too, on its key, as its page registers it. */
    readonly inProject?: boolean;
}

/**
 * The app's New issue, as `AppCommands` offers it, and a project's own with `inProject`; under the story a line says
 * which ran (`tid="new-issue"`).
 */
function withNewIssue({ inProject = false }: WithNewIssueOptions = {}): Decorator {
    return story => {
        const Story = story();
        return defineComponent({
            setup() {
                const started = shallowRef<string | null>(null);
                useCommands(() => [
                    {
                        id: `app.${definitions.newIssue.id}`,
                        title: 'New issue',
                        section: 'app',
                        run: () => {
                            started.value = 'Started';
                        },
                    },
                    ...(inProject
                        ? [
                              {
                                  id: `project.${definitions.newIssueInProject.id}`,
                                  title: 'New issue in Platform Q4',
                                  section: 'view' as const,
                                  key: keyOf(definitions.newIssueInProject),
                                  run: () => {
                                      started.value = 'Started in the project';
                                  },
                              },
                          ]
                        : []),
                ]);
                return () => [h(Story), h('p', { tid: 'new-issue' }, started.value ?? 'Not started')];
            },
        });
    };
}
