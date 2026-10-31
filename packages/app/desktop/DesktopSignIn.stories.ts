import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import DesktopSignIn from './DesktopSignIn.vue';

const meta = {
    component: DesktopSignIn,
    args: { state: { kind: 'idle' }, persistent: true, onStart: fn(), onOpen: fn(), onCancel: fn() },
    // As tall as the desktop app's window: the screen fills it.
    render: args => ({
        components: { DesktopSignIn },
        setup: () => ({ args }),
        template: '<div style="height: 100vh"><DesktopSignIn v-bind="args" /></div>',
    }),
} satisfies Meta<typeof DesktopSignIn>;

export default meta;

type Story = StoryObj<typeof meta>;

/** S1: before signing in, with what GitHub will ask for and that the data stays on this computer. */
export const BeforeSigningIn: Story = {};

/** Asking GitHub for a code: the button is busy. */
export const Requesting: Story = { args: { state: { kind: 'requesting' } } };

/** S2: the code, and githq waiting for the user to approve it on GitHub. */
export const CodeShown: Story = {
    args: {
        state: {
            kind: 'waiting',
            code: { userCode: 'WDJB-MJHT', verificationUri: 'https://github.com/login/device', expiresIn: 900 },
        },
    },
};

/** S3: the code expired before it was used. */
export const Expired: Story = { args: { state: { kind: 'failed', failure: 'expired' } } };

/** S3: the user cancelled on GitHub. */
export const Denied: Story = { args: { state: { kind: 'failed', failure: 'denied' } } };

/** S3: GitHub could not be reached. */
export const Offline: Story = { args: { state: { kind: 'failed', failure: 'offline' } } };

/** S3: anything else went wrong. */
export const Failed: Story = { args: { state: { kind: 'failed', failure: 'failed' } } };

/** S3: GitHub granted fewer scopes than githq asks for, so the token was refused. */
export const MissingScopes: Story = { args: { state: { kind: 'failed', failure: 'missingScopes' } } };

/** S4: no system keychain, so the user will sign in again at the next start. */
export const NoKeychain: Story = { args: { persistent: false } };

/** Signed out because GitHub stopped accepting the kept token. */
export const SignedOut: Story = { args: { signedOut: true } };
