import { Form } from '@nzyme/vue-forms/components/Form.jsx';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ArrowUpRight, Github, ListFilter, LogOut, Plus, Rows3, Search } from 'lucide-vue-next';
import { defineComponent, ref } from 'vue';

import { StoryPage, StoryRow, StorySection } from '@/.storybook/StoryLayout.jsx';

import Button from './Button.vue';

const meta = {
    component: Button,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Every variant and size, as the mockups use them. */
export const Gallery: Story = {
    render: () => (
        <StoryPage>
            <StorySection title="Sign-in — light, large, with its key">
                <StoryRow>
                    <Button
                        variant="light"
                        size="lg"
                        icon={Github}
                        kbd="↵"
                    >
                        Sign in with GitHub
                    </Button>
                </StoryRow>
            </StorySection>
            <StorySection title="A footer — secondary next to primary">
                <StoryRow>
                    <Button>Only my repositories</Button>
                    <Button
                        variant="primary"
                        kbd="⌘↵"
                    >
                        Track these
                    </Button>
                    <Button
                        variant="primary"
                        kbd="⌘↵"
                    >
                        Create issue
                    </Button>
                </StoryRow>
            </StorySection>
            <StorySection title="A toolbar — small ghost and outline">
                <StoryRow>
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={ListFilter}
                    >
                        Filter
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        icon={Rows3}
                    >
                        Group: Reason
                    </Button>
                </StoryRow>
            </StorySection>
            <StorySection title="Deleting something — danger">
                <StoryRow>
                    <Button
                        variant="danger"
                        icon={LogOut}
                    >
                        Sign out and clear
                    </Button>
                </StoryRow>
            </StorySection>
            <StorySection title="Inline — link">
                <p style={{ fontSize: '12.5px', color: '#838992' }}>
                    GitHub will ask for access to your repositories. <Button variant="link">Why?</Button>
                </p>
            </StorySection>
            <StorySection title="The sidebar — a field-like button and an entry, full width (block)">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '220px' }}>
                    <Button
                        variant="field"
                        block
                        icon={Search}
                        kbd="⌘K"
                        aria-disabled="true"
                    >
                        Search…
                    </Button>
                    <Button
                        variant="ghost"
                        block
                        icon={Plus}
                        aria-disabled="true"
                    >
                        Track repositories…
                    </Button>
                </div>
            </StorySection>
            <StorySection title="A row's meta line — small link with its key">
                <p style={{ fontSize: '12px', color: '#838992' }}>
                    approved · ready to merge{' '}
                    <Button
                        variant="link"
                        size="sm"
                        link="https://github.com/acme/web/pull/477"
                        icon={ArrowUpRight}
                        kbd="O"
                    >
                        Open on GitHub
                    </Button>
                </p>
            </StorySection>
            <StorySection title="States — busy, disabled, shown but not built yet">
                <StoryRow>
                    <Button
                        variant="primary"
                        busy
                    >
                        Track these
                    </Button>
                    <Button
                        variant="primary"
                        disabled
                    >
                        Track these
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={ListFilter}
                        aria-disabled="true"
                    >
                        Filter
                    </Button>
                </StoryRow>
            </StorySection>
        </StoryPage>
    ),
};

/**
 * An action that takes a while: "Track these" stays busy until "Finish" settles it, and clicks or Enter in
 * between are ignored.
 */
export const AsyncClick: Story = {
    render: () =>
        defineComponent({
            setup() {
                const runs = ref(0);
                let finish: (() => void) | undefined;

                function track() {
                    runs.value++;
                    return new Promise<void>(resolve => {
                        finish = resolve;
                    });
                }

                function finishTracking() {
                    finish?.();
                    finish = undefined;
                }

                return () => (
                    <StoryPage>
                        <StoryRow>
                            <Button
                                variant="primary"
                                onClick={track}
                            >
                                Track these
                            </Button>
                            <Button onClick={finishTracking}>Finish</Button>
                            <span tid="runs">Runs: {runs.value}</span>
                        </StoryRow>
                    </StoryPage>
                );
            },
        }),
};

/** A submit button submits its `Form` — on click or Enter in a field — and is busy while it does. */
export const Submit: Story = {
    render: () =>
        defineComponent({
            setup() {
                const submits = ref(0);
                let finish: (() => void) | undefined;

                function submit() {
                    submits.value++;
                    return new Promise<void>(resolve => {
                        finish = resolve;
                    });
                }

                return () => (
                    <StoryPage>
                        <Form onSubmit={submit}>
                            <StoryRow>
                                <Button
                                    type="submit"
                                    variant="primary"
                                >
                                    Create issue
                                </Button>
                                <span tid="submits">Submits: {submits.value}</span>
                            </StoryRow>
                        </Form>
                        <StoryRow>
                            <Button onClick={() => finish?.()}>Finish</Button>
                        </StoryRow>
                    </StoryPage>
                );
            },
        }),
};
