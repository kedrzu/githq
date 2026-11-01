import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { fn, userEvent, within } from 'storybook/test';
import { defineComponent, h } from 'vue';

import LandingScreen from './LandingScreen.vue';
import SignInBanner from './SignInBanner.vue';

// The sections follow the page's width (`landing-narrow`, `landing-mobile`), not the browser's: a story sets it
// to the design's frames, whatever the size of the browser running the tests.
function pageOfWidth(width: number): Decorator {
    return story => {
        const Story = story();
        return defineComponent({
            setup: () => () => h('div', { style: { width: `${width}px` } }, [h(Story)]),
        });
    };
}

const wide = pageOfWidth(1440);
const phone = pageOfWidth(390);

const meta = {
    component: LandingScreen,
    args: { onSignIn: fn() },
} satisfies Meta<typeof LandingScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A first visit on a wide screen: the navigation, the hero, the GitHub concepts, the statement, the features, the details, the comparison, open source, the last call to action and the footer. */
export const Landing: Story = { decorators: [wide] };

/** G1: back from GitHub after "Cancel" on its consent screen, the banner above the hero. */
export const SignInCancelled: Story = {
    decorators: [wide],
    render: args => ({
        components: { LandingScreen, SignInBanner },
        setup: () => ({ args }),
        template: `<LandingScreen v-bind="args"><template #banner><SignInBanner failure="cancelled" /></template></LandingScreen>`,
    }),
};

/** On a phone: the navigation folds into a menu, the features, the details and the footer stack, the screenshots are cropped to their top left. */
export const Phone: Story = { decorators: [phone] };

/** On a phone, the navigation's menu open. */
export const PhoneMenuOpen: Story = {
    decorators: [phone],
    play: async ({ canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole('button', { name: 'Menu' }));
    },
};

/** On a phone, back from GitHub after "Cancel". */
export const PhoneSignInCancelled: Story = { ...SignInCancelled, decorators: [phone] };
