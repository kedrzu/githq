import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';
import type { PropType } from 'vue';

import Toaster from '@/components/Toaster.vue';
import { withPhoneLayout } from '@/testing/withPhoneLayout.js';

import IssueCreatedToast from './IssueCreatedToast.vue';

/** The toast in a `Toaster` as the shell shows it; what it asked for is written out above it (`asked`). */
const Harness = defineComponent({
    props: {
        number: { type: Number as PropType<number | null>, default: null },
        phone: { type: Boolean, default: false },
    },
    setup(props) {
        const asked = ref('Nothing asked');
        const open = ref(true);

        return () => (
            <div>
                <span tid="asked">{asked.value}</span>
                <Toaster aboveCommandLine={props.phone}>
                    <IssueCreatedToast
                        open={open.value}
                        onUpdate:open={(value: boolean) => {
                            open.value = value;
                            asked.value = 'Dismissed';
                        }}
                        repository="fitloop/webapp"
                        title="Waitlist ignores paused memberships"
                        number={props.number}
                        offerAnother
                        onCreateAnother={() => (asked.value = 'Create another')}
                        onOpen={() => (asked.value = 'Open')}
                    />
                </Toaster>
            </div>
        );
    },
});

const meta = {
    component: Harness,
    decorators: [withPhoneLayout(false)],
    parameters: {
        a11y: {
            context: {
                // reka-ui's toast viewport puts an empty, focusable focus guard on each side of it (as in Toast's
                // stories): axe flags them; they hide nothing, and every rule still runs on the rest.
                exclude: ['[role="region"] > span[aria-hidden="true"][tabindex="0"]'],
            },
        },
    },
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Mobile D44 (MB215): created, GitHub's number still on its way. */
export const NumberOnItsWay: Story = {};

/** Mobile D44 (MB204): GitHub gave its number. */
export const Numbered: Story = { args: { number: 1211 } };

/** Mobile D44: on a phone, above the command line, its buttons a finger's height. */
export const OnPhone: Story = {
    args: { number: 1211, phone: true },
    decorators: [withPhoneLayout(true)],
};
