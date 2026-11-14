import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { userEvent, within } from 'storybook/test';
import { defineComponent, h, shallowRef } from 'vue';

import { NEW_ISSUE_KEY } from '@/commands/CommandRegistry.js';
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
 * issue, which runs what `C` runs; the title's menu and what the list puts beside the title are not drawn.
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

/** On a phone, the display options opened: every option is there, none being on the bar. */
export const PhoneDisplay: Story = {
    ...Phone,
    play: async ({ canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole('button', { name: 'Display' }));
    },
};

/** The app's New issue, on `C` as `AppCommands` offers it; under the story a line says whether it ran (`tid="new-issue"`). */
function withNewIssue(): Decorator {
    return story => {
        const Story = story();
        return defineComponent({
            setup() {
                const started = shallowRef(false);
                useCommands(() => [
                    {
                        id: 'app.newIssue',
                        title: 'New issue',
                        section: 'app',
                        key: NEW_ISSUE_KEY,
                        run: () => {
                            started.value = true;
                        },
                    },
                ]);
                return () => [h(Story), h('p', { tid: 'new-issue' }, started.value ? 'Started' : 'Not started')];
            },
        });
    };
}
