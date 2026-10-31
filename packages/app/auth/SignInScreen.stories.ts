import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import SignInScreen from './SignInScreen.vue';

const meta = {
    component: SignInScreen,
    args: { failure: null, onSignIn: fn() },
} satisfies Meta<typeof SignInScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

/** G1b: before signing in, with what GitHub's consent screen will ask for explained up front. */
export const FirstVisit: Story = {};

/** G1c: back from GitHub after "Cancel" on its consent screen. */
export const Cancelled: Story = { args: { failure: 'cancelled' } };

/** Back from GitHub, but the sign-in could not be finished (a foreign `state`, a refused code, the network). */
export const Failed: Story = { args: { failure: 'failed' } };

/** GitHub granted fewer scopes than githq asked for. */
export const MissingScopes: Story = { args: { failure: 'missingScopes' } };

/** Signed out because GitHub stopped accepting the stored token. */
export const TokenRejected: Story = { args: { failure: 'tokenRejected' } };
