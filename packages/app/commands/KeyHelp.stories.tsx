import { useService } from '@nzyme/vue-ioc/useService.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';

import ItemView from '@/item/ItemView.vue';
import { D1_ISSUE, D1_ISSUE_DETAIL } from '@/testing/sampleItemDetails.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_MAINTAINER_EDITING } from '@/testing/sampleRepositories.js';

import { APP_KEYS, CommandRegistry } from './CommandRegistry.js';
import KeyHelp from './KeyHelp.vue';
import { useCommands } from './useCommands.js';

/** The help over an opened item: its keys, and the app's `?` that opens it. Closing the item is written out. */
const Harness = defineComponent({
    props: {
        startOpen: { type: Boolean, default: true },
    },
    setup(props) {
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
                        loadAllComments={() => Promise.resolve()}
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
