import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import SignInBanner from './SignInBanner.vue';

const meta = {
    component: SignInBanner,
    args: { failure: 'cancelled', onTryAgain: fn(), onDismiss: fn() },
} satisfies Meta<typeof SignInBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

/** G1: back from GitHub after "Cancel" on its consent screen. */
export const Cancelled: Story = {};

/** Back from GitHub, but the sign-in could not be finished (a foreign `state`, a refused code, the network). */
export const Failed: Story = { args: { failure: 'failed' } };

/** GitHub granted fewer scopes than githq asked for. */
export const MissingScopes: Story = { args: { failure: 'missingScopes' } };

/** Signed out because GitHub stopped accepting the stored token. */
export const TokenRejected: Story = { args: { failure: 'tokenRejected' } };
