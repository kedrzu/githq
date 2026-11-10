import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import type { ChangelogDevelopment, ChangelogRelease } from './buildChangelog.js';
import { withGitHubLinks } from '@/testing/withGitHubLinks.js';

import ChangelogView from './ChangelogView.vue';

const COMMITS_URL = 'https://github.com/kedrzu/githq/commits/632d28b';

const issueLink = (number: number) =>
    `<a class="issue-link js-issue-link" href="https://github.com/kedrzu/githq/pull/${number}">#${number}</a>`;

const NOTES = `<p>You can now merge pull requests from githq without a trip to GitHub, and close one in a single step, with undo. A repository shows its commit graph, and a failed workflow run opens right here, with its log. The repository view now splits Issues and Pull requests into sections of their own, so your old tab there has moved.</p>
<h2>Breaking changes</h2>
<ul><li>Split the repository view into Issues and Pull requests sections (${issueLink(92)})</li></ul>
<h2>Features</h2>
<ul><li>Merge pull requests from githq (${issueLink(80)})</li><li>Close a pull request in one step, with undo (${issueLink(133)})</li><li>Show a repository's commit graph (${issueLink(104)})</li><li>Open a failed run in githq, with its log, search and re-run (${issueLink(124)})</li></ul>
<h2>Fixes</h2>
<ul><li>Keep a tab left open across a deploy from stopping the sync (${issueLink(111)})</li><li>Open a repository on its remembered tab without flashing All first (${issueLink(94)})</li></ul>
<h2>Performance</h2>
<ul><li>Read the first sync's essentials first, a few requests at once (${issueLink(103)})</li></ul>`;

const NO_SUMMARY = `<h2>Features</h2>
<ul><li>Save what you track to a private repository in your GitHub account (${issueLink(70)})</li><li>Offer saved settings on the first sign-in and say when syncing stopped (${issueLink(71)})</li></ul>
<h2>Fixes</h2>
<ul><li>Move settings into one screen and the user to the bottom of the sidebar (${issueLink(68)})</li></ul>`;

const LATEST: ChangelogRelease = {
    kind: 'release',
    version: '0.2.0',
    publishedAt: '2026-11-03T12:00:00Z',
    html: NOTES,
    running: true,
    isNew: true,
};
const OLDER: readonly ChangelogRelease[] = [
    { ...LATEST, version: '0.1.2', publishedAt: '2026-10-21T12:00:00Z', running: false },
    { ...LATEST, version: '0.1.1', publishedAt: '2026-10-14T12:00:00Z', html: NO_SUMMARY, running: false },
    { ...LATEST, version: '0.1.0', publishedAt: '2026-10-02T12:00:00Z', running: false, isNew: false },
];

const DEVELOPMENT: ChangelogDevelopment = {
    kind: 'development',
    since: '0.2.0',
    commits: 7,
    limited: false,
    groups: [
        {
            kind: 'features',
            changes: [
                { description: 'Reach WCAG 2.2 AA and check it in stories and e2e', pullRequest: 132 },
                { description: 'Close a pull request in one step, with undo', pullRequest: 133 },
                { description: 'Show pull request sizes in green and red, the same in every list', pullRequest: 115 },
            ],
        },
        {
            kind: 'fixes',
            changes: [{ description: 'Say Workflows section where the app still said tab', pullRequest: 135 }],
        },
    ],
};

const UNTAGGED: readonly ChangelogRelease[] = [LATEST, ...OLDER].map(release => ({
    ...release,
    running: false,
    isNew: false,
}));

const meta = {
    component: ChangelogView,
    args: {
        content: { kind: 'versions', versions: [LATEST, ...OLDER] },
        commitsUrl: null,
        onOpenOnGitHub: fn(),
    },
    parameters: { layout: 'fullscreen' },
    decorators: [withGitHubLinks()],
} satisfies Meta<typeof ChangelogView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** U41: updated from 0.1.0 to 0.2.0, skipping two versions. */
export const Stable: Story = {};

/** U43: a Development build, one fold since the last Stable. */
export const Development: Story = {
    args: { content: { kind: 'versions', versions: [DEVELOPMENT, ...UNTAGGED] }, commitsUrl: COMMITS_URL },
};

/** Before the first Stable: no end to read to, so the commits stop after a few hundred. */
export const DevelopmentBeforeFirstStable: Story = {
    args: {
        content: { kind: 'versions', versions: [{ ...DEVELOPMENT, since: null, commits: 300, limited: true }] },
        commitsUrl: COMMITS_URL,
    },
};

/** U44: everything since the last Stable was filtered out. */
export const NothingYoudNotice: Story = {
    args: {
        content: { kind: 'versions', versions: [{ ...DEVELOPMENT, groups: [] }, ...UNTAGGED] },
        commitsUrl: COMMITS_URL,
    },
};

/** U45: no versions yet. */
export const NoVersions: Story = { args: { content: { kind: 'none', firstVersion: '0.1.0' } } };

/** U46: the versions are on their way. */
export const Loading: Story = { args: { content: { kind: 'loading' } } };

/** U47: waiting for the connection. */
export const Offline: Story = { args: { content: { kind: 'offline' } } };

/** U48: GitHub answered with an error, or not at all. */
export const Failed: Story = { args: { content: { kind: 'failed' } } };

/** U48 on a Development build: the link is to its commits, which is where its changes are. */
export const FailedOnDevelopment: Story = { args: { content: { kind: 'failed' }, commitsUrl: COMMITS_URL } };
