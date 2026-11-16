import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';
import { withPhoneLayout } from '@/testing/withPhoneLayout.js';
import FirstSignInFrame from '@/tracking/FirstSignInFrame.vue';

import SavedSettingsOffer from './SavedSettingsOffer.vue';
import type { SettingsDocument } from './sync/SettingsDocument.js';

/** Six repositories and three projects tracked on another device, one repository untracked there. */
const SAVED: SettingsDocument = {
    version: 1,
    repositories: [
        ...[
            'mlaine/tasklet',
            'mlaine/mdlint',
            'mlaine/dotfiles',
            'fitloop/webapp',
            'fitloop/api',
            'fitloop/mobile',
        ].map(nameWithOwner => ({ nameWithOwner, id: `R_${nameWithOwner}`, tracking: true })),
        { nameWithOwner: 'mlaine/blog', id: 'R_blog', tracking: false },
    ],
    projects: [
        { id: 'PVT_q4', owner: 'fitloop', ownerKind: 'org', number: 4, title: 'Platform Q4', tracking: true },
        { id: 'PVT_road', owner: 'mlaine', ownerKind: 'user', number: 1, title: 'tasklet Roadmap', tracking: true },
        { id: 'PVT_docs', owner: 'fitloop', ownerKind: 'org', number: 7, title: 'Docs revamp', tracking: true },
    ],
};

const meta = {
    component: SavedSettingsOffer,
    args: {
        repository: 'mlaine/githq-settings',
        document: SAVED,
        privateRepositories: new Set(['fitloop/webapp', 'fitloop/api', 'fitloop/mobile']),
        load: fn(() => Promise.resolve()),
        onDecline: fn(),
    },
    // The story frame is narrower than a phone's width: the computer's layout unless a story says otherwise.
    decorators: [
        () => ({ template: '<div style="display: flex; min-height: 100vh"><story /></div>' }),
        withPhoneLayout(false),
    ],
} satisfies Meta<typeof SavedSettingsOffer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** G11: settings saved on another device, offered in place of choosing what to track. */
export const Offer: Story = {};

/** Mobile MB134: on a phone, in the first sign-in's frame — one column, the two answers pinned at the bottom. */
export const PhoneOffer: Story = {
    decorators: [
        () => ({
            components: { FirstSignInFrame },
            setup: () => ({ viewer: SAMPLE_VIEWER }),
            template: '<FirstSignInFrame :viewer="viewer"><story /></FirstSignInFrame>',
        }),
        withPhoneLayout(true),
    ],
};
