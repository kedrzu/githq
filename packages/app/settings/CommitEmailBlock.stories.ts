import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import CommitEmailBlock from './CommitEmailBlock.vue';

/** What GitHub offers for acme-corp/billing: the account's default first, the work address among the others. */
const SETTINGS = {
    viewerDefaultCommitEmail: 'michal@kedrzu.dev',
    viewerPossibleCommitEmails: ['michal@kedrzu.dev', 'michal@acme-corp.com', '1234+mlaine@users.noreply.github.com'],
};

const meta = {
    component: CommitEmailBlock,
    args: {
        owner: 'acme-corp',
        choices: { owner: 'michal@acme-corp.com', repository: undefined },
        settings: SETTINGS,
        onOwner: fn(),
        onRepository: fn(),
    },
    decorators: [() => ({ template: '<div style="padding: 0 32px"><story /></div>' })],
} satisfies Meta<typeof CommitEmailBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

/** T24: the owner's work address, the repository the same as its owner, so it commits as that address. */
export const OwnerAddress: Story = {};

/** Nothing chosen anywhere: both on GitHub's default. */
export const GitHubDefault: Story = { args: { choices: { owner: null, repository: undefined } } };

/** The repository's own address, over its owner's. */
export const RepositoryAddress: Story = {
    args: { choices: { owner: 'michal@acme-corp.com', repository: '1234+mlaine@users.noreply.github.com' } },
};

/** The repository explicitly on GitHub's default, over its owner's address. */
export const RepositoryGitHubDefault: Story = {
    args: { choices: { owner: 'michal@acme-corp.com', repository: null } },
};

/** T25: the owner's address isn't offered here: marked, left as it is, and the repository falls to GitHub's default. */
export const OwnerNotOffered: Story = {
    args: {
        settings: { ...SETTINGS, viewerPossibleCommitEmails: ['michal@kedrzu.dev'] },
    },
};

/** The repository's own address isn't offered here: marked too, and its owner's applies. */
export const RepositoryNotOffered: Story = {
    args: { choices: { owner: 'michal@acme-corp.com', repository: 'old@acme-corp.com' } },
};

/** GitHub's addresses not read yet: the stored choices, disabled, and no address it commits as. */
export const NotKnown: Story = { args: { settings: null } };

/** On a phone: each row's label, select and note stacked. */
export const Phone: Story = {
    args: { phone: true, settings: { ...SETTINGS, viewerPossibleCommitEmails: ['michal@kedrzu.dev'] } },
    decorators: [() => ({ template: '<div style="width: 390px"><story /></div>' })],
};
