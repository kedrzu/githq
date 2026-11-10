import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { withGitHubLinks } from '@/testing/withGitHubLinks.js';

import GitHubLinks from './GitHubLinks.vue';

const meta = {
    component: GitHubLinks,
    // Links as a template binds them (`data-githq-link`, the app's path for `href`), beside one that stays GitHub's.
    render: () => ({
        components: { GitHubLinks },
        template: `
            <GitHubLinks>
                <p tid="text">The calendar now keeps the timezone of each booking.</p>
                <p>
                    Merged in
                    <a href="/acme/web/pull/15" data-githq-link="https://github.com/acme/web/pull/15">#15</a>,
                    which closes
                    <a href="/acme/web/issues/12#issuecomment-5" data-githq-link="https://github.com/acme/web/issues/12#issuecomment-5">a comment on #12</a>;
                    thanks
                    <a href="https://github.com/octocat" target="_blank" rel="noopener noreferrer">@octocat</a>.
                </p>
            </GitHubLinks>
        `,
    }),
} satisfies Meta<typeof GitHubLinks>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Two links githq shows, an item and a comment on one, and a profile, which stays GitHub's. */
export const Links: Story = { decorators: [withGitHubLinks()] };

/** The same in an opened item: an item linked opens there. */
export const InItem: Story = { decorators: [withGitHubLinks({ inItem: true })] };
