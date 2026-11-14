import { useContainer } from '@nzyme/vue-ioc/useContainer.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';
import { defineComponent, ref } from 'vue';

import ItemView from '@/item/ItemView.vue';
import { D1_ISSUE, D1_ISSUE_DETAIL } from '@/testing/sampleItemDetails.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_MAINTAINER_EDITING } from '@/testing/sampleRepositories.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { APP_KEYS, CommandRegistry } from './CommandRegistry.js';
import type { Command, CommandKeySheet } from './CommandTypes.js';
import KeyHelp from './KeyHelp.vue';
import { useCommands } from './useCommands.js';

/** The help over an opened item: its keys, and the app's `?` that opens it. Closing the item is written out. */
const Harness = defineComponent({
    props: {
        startOpen: { type: Boolean, default: true },
    },
    setup(props) {
        // The open item keeps what the user chose in their settings, which are kept in the local copy.
        setIndexedDbPersistence(useContainer());
        const registry = useService(CommandRegistry);
        const closed = ref('open');

        useCommands(() => [
            {
                id: 'app.help',
                title: 'Keyboard shortcuts',
                section: 'app',
                key: APP_KEYS.help,
                run: () => registry.setHelpOpen(true),
            },
        ]);
        registry.setHelpOpen(props.startOpen);

        return () => (
            <div style={{ display: 'flex', height: '100vh' }}>
                <div style={{ width: '560px', height: '100%' }}>
                    <ItemView
                        item={D1_ISSUE}
                        detail={D1_ISSUE_DETAIL}
                        arrangement="panel"
                        now={SAMPLE_NOW}
                        loadThreadMiddle={() => Promise.resolve()}
                        editing={SAMPLE_MAINTAINER_EDITING}
                        onClose={() => (closed.value = 'closed')}
                    />
                </div>
                <p
                    style={{ padding: '16px' }}
                    tid="item"
                >
                    {closed.value}
                </p>
                <KeyHelp
                    open={registry.helpOpen}
                    onUpdate:open={(open: boolean) => registry.setHelpOpen(open)}
                    commands={registry.commands}
                />
            </div>
        );
    },
});

const meta = {
    component: Harness,
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `?` over an opened item: its keys and the app's, by section, read from the registry. */
export const OverOpenItem: Story = {};

/** Closed: `?` opens it. */
export const Closed: Story = { args: { startOpen: false } };

/** CR29: a screen's own sheet, in place of the actions that can run now: a row may speak of two keys, and it shows whatever can run. */
export const ScreenSheet: StoryObj<typeof KeyHelp> = {
    render: () => ({
        components: { KeyHelp },
        setup: () => ({
            commands: [
                { id: 'newIssue', title: 'New issue', section: 'app', key: 'C', run: () => {} },
            ] satisfies Command[],
            sheet: {
                title: 'Keys in a review',
                columns: [
                    { title: 'Moving', rows: [{ keys: [']', '['], label: 'Next and previous file' }] },
                    { title: 'Files', rows: [{ keys: ['Space'], label: 'Collapse or expand the file' }] },
                    {
                        title: 'Writing',
                        rows: [{ keys: ['Mod+Enter', 'Mod+Shift+Enter'], label: 'Your default, and the other' }],
                    },
                ],
                footer: [{ keys: ['Alt+Mod+B'], label: 'Conversation' }],
            } satisfies CommandKeySheet,
        }),
        template: `<KeyHelp :open="true" :commands="commands" :sheet="sheet" />`,
    }),
    play: async () => {
        const help = within(document.body);
        await expect(help.getByRole('dialog', { name: 'Keys in a review' })).toBeVisible();
        await expect(help.getByRole('region', { name: 'Moving' })).toBeVisible();
        await expect(help.getByText('Next and previous file')).toBeVisible();
        await expect(help.getByText('Conversation')).toBeVisible();
        await expect(help.queryByText('New issue')).toBeNull();
    },
};
