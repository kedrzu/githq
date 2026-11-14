import type { Meta, StoryObj } from '@storybook/vue3-vite';
import {
    CircleCheckBig,
    Coffee,
    Hourglass,
    Inbox,
    RotateCw,
    ShieldAlert,
    TriangleAlert,
    Github,
} from 'lucide-vue-next';

import Button from './Button.vue';
import EmptyState from './EmptyState.vue';

const meta = {
    component: EmptyState,
    args: {
        icon: CircleCheckBig,
        tone: 'good',
        title: 'Nothing on your plate',
        detail: 'No review requests, open pull requests, assigned issues or mentions, anywhere on GitHub.',
    },
    render: args => ({
        setup: () => () => (
            <div style={{ display: 'flex', height: '100vh' }}>
                <EmptyState {...args} />
            </div>
        ),
    }),
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

/** K4: empty is good news. */
export const Good: Story = {};

/** Just nothing here: the quiet grey. */
export const Muted: Story = {
    args: {
        icon: Inbox,
        tone: 'muted',
        title: 'No issues',
        detail: 'mlaine/tasklet has no issues, open or closed.',
    },
};

/** K5: just nothing here, with a way on. */
export const WithAction: Story = {
    args: {
        icon: Coffee,
        tone: 'muted',
        title: 'Nothing needs you right now',
        detail: 'No review requests, no assigned issues, and none of your pull requests are failing, blocked or asked to change.',
    },
    render: args => ({
        setup: () => () => (
            <div style={{ display: 'flex', height: '100vh' }}>
                <EmptyState {...args}>
                    {{
                        action: () => (
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={Hourglass}
                                kbd="3"
                                keyshortcuts="3"
                            >
                                2 of your pull requests are waiting on others
                            </Button>
                        ),
                    }}
                </EmptyState>
            </div>
        ),
    }),
};

/** It can't be read: amber, with the technical fact in a chip. */
export const Warning: Story = {
    args: {
        icon: TriangleAlert,
        tone: 'warning',
        title: "GitHub isn't answering",
        detail: "githq couldn't read fitloop/webapp's issues. It tries again by itself.",
        fact: 'api.github.com → 502',
    },
};

/** Something is broken: red, a fact that has no spaces to wrap at, and two ways on in a row. */
export const BrokenWithFactAndActions: Story = {
    args: {
        icon: ShieldAlert,
        tone: 'broken',
        title: 'Actions are switched off',
        detail: 'GitHub refuses to list the workflow runs of fitloop/webapp.',
        fact: 'GET /repos/fitloop/webapp/actions/runs → 403',
    },
    render: args => ({
        setup: () => () => (
            <div style={{ display: 'flex', height: '100vh' }}>
                <EmptyState {...args}>
                    {{
                        action: () => [
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={RotateCw}
                                kbd="R"
                                keyshortcuts="R"
                            >
                                Try again
                            </Button>,
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={Github}
                                kbd="O"
                                keyshortcuts="O"
                                link="https://github.com/fitloop/webapp/actions"
                            >
                                Open on GitHub
                            </Button>,
                        ],
                    }}
                </EmptyState>
            </div>
        ),
    }),
};

/** On a narrow screen the chip and the row of actions wrap. */
export const Narrow: Story = {
    ...BrokenWithFactAndActions,
    decorators: [() => ({ template: '<div style="width: 320px"><story /></div>' })],
};
