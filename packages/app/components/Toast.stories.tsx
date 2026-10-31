import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ArrowUpRight } from 'lucide-vue-next';
import { defineComponent, onScopeDispose, ref } from 'vue';

import { StoryPage } from '@/.storybook/StoryLayout.jsx';

import Button from './Button.vue';
import TextField from './TextField.vue';
import Toast from './Toast.vue';
import Toaster from './Toaster.vue';

const meta = {
    component: Toast,
    parameters: {
        a11y: {
            context: {
                // reka-ui's toast viewport puts a focus guard on each side of it — empty, `aria-hidden`, focusable —
                // that hands focus on to the toasts or out of them (F8). axe flags them; they hide nothing. Only
                // they are left out: every rule still runs on the rest.
                exclude: ['[role="region"] > span[aria-hidden="true"][tabindex="0"]'],
            },
        },
    },
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

/** K1: a label GitHub refused — which edit, why, and the way to GitHub's labels. */
export const EditRejected: Story = {
    args: { title: 'Label “regression” wasn’t added to sigma-clinic/portal#1187' },
    render: args =>
        defineComponent({
            setup() {
                const dismissed = ref(0);
                const escapes = ref(0);
                const note = ref('');
                // What the screen behind sees of Escape: an opened item would close on it.
                const onKey = (event: KeyboardEvent) => {
                    if (event.key === 'Escape') {
                        escapes.value++;
                    }
                };
                window.addEventListener('keydown', onKey);
                onScopeDispose(() => window.removeEventListener('keydown', onKey));

                return () => (
                    <StoryPage>
                        <TextField
                            label="Note"
                            modelValue={note.value}
                            onUpdate:modelValue={value => (note.value = String(value ?? ''))}
                        />
                        <span tid="dismissed">Dismissed: {dismissed.value}</span>
                        <span tid="escapes">Escapes seen behind: {escapes.value}</span>
                        <Toaster label="Notifications">
                            <Toast
                                {...args}
                                duration={Number.POSITIVE_INFINITY}
                                onDismiss={() => dismissed.value++}
                            >
                                {{
                                    default: () =>
                                        'GitHub refused it: the label no longer exists in sigma-clinic/portal. The label was removed again.',
                                    actions: () => (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={ArrowUpRight}
                                            link="https://github.com/sigma-clinic/portal/labels"
                                        >
                                            Open labels on GitHub
                                        </Button>
                                    ),
                                }}
                            </Toast>
                        </Toaster>
                    </StoryPage>
                );
            },
        }),
};

/** K2: one of three items failed; the others went through. */
export const PartlyFailed: Story = {
    args: { title: '“q4-release” added to 2 of 3 items', tone: 'warning' },
    render: args => ({
        components: { Toast, Toaster },
        setup: () => ({ args }),
        template: `<Toaster label="Notifications"><Toast v-bind="args" :duration="Infinity">mobile#88 failed: you can read sigma-clinic/mobile but not edit its labels, so that change was undone.</Toast></Toaster>`,
    }),
};
