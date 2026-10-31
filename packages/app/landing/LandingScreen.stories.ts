import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import LandingScreen from './LandingScreen.vue';
import SignInBanner from './SignInBanner.vue';

const meta = {
    component: LandingScreen,
    args: { onSignIn: fn() },
} satisfies Meta<typeof LandingScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A first visit: what githq is, "Sign in with GitHub" and "Star on GitHub". */
export const Landing: Story = {};

/** G1: back from GitHub after "Cancel" on its consent screen, the banner above the hero. */
export const SignInCancelled: Story = {
    render: args => ({
        components: { LandingScreen, SignInBanner },
        setup: () => ({ args }),
        template: `<LandingScreen v-bind="args"><template #banner><SignInBanner failure="cancelled" /></template></LandingScreen>`,
    }),
};
