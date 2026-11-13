import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import { withGitHubLinks } from '@/testing/withGitHubLinks.js';
import { withSubmoduleHistory } from '@/testing/withSubmoduleHistory.js';

import ReviewSubmoduleBlock from './ReviewSubmoduleBlock.vue';
import type { ReviewSubmoduleChange, ReviewSubmoduleHistory } from './ReviewSubmodules.js';

const BEFORE = 'a1c9e2f0b7d84c3e9a5f1b2c3d4e5f6a7b8c9d0e';
const AFTER = 'd4f7b21c0e9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c';
const CHANGE: ReviewSubmoduleChange = {
    nameWithOwner: 'fitloop/webapp',
    headOid: '9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f',
    path: 'nzyme',
    before: BEFORE,
    after: AFTER,
};
const AHEAD: ReviewSubmoduleHistory = {
    repository: 'kedrzu/nzyme',
    relation: { kind: 'ahead', count: 3 },
    commits: [
        {
            oid: 'b1e2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
            subject: 'feat(ioc): resolve child containers lazily',
            author: 'kedrzu',
        },
        {
            oid: 'c2f3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
            subject: 'fix(vue-forms): keep focus while a button is busy',
            author: 'mlaine',
        },
        { oid: AFTER, subject: 'chore: release 4.2.0', author: null },
    ],
    moreCommits: 0,
    files: [
        { path: 'packages/ioc/src/Container.ts', previousPath: null, status: 'modified', additions: 24, deletions: 9 },
        { path: 'packages/ioc/src/lazy.ts', previousPath: null, status: 'added', additions: 61, deletions: 0 },
        {
            path: 'packages/vue-forms/src/useButton.ts',
            previousPath: null,
            status: 'modified',
            additions: 7,
            deletions: 3,
        },
        {
            path: 'packages/vue-forms/src/legacy.ts',
            previousPath: null,
            status: 'removed',
            additions: 0,
            deletions: 42,
        },
    ],
    moreFiles: false,
    pullRequests: [
        {
            number: 412,
            state: 'OPEN',
            title: 'Resolve child containers lazily',
            url: 'https://github.com/kedrzu/nzyme/pull/412',
            isDraft: false,
        },
    ],
};

/** A bump bigger than a list shows at first: 38 commits brought in, 48 files changed. */
const LARGE: ReviewSubmoduleHistory = {
    ...AHEAD,
    relation: { kind: 'ahead', count: 38 },
    commits: Array.from({ length: 38 }, (_, index) => ({
        oid: (((index + 1) * 0x9e3779b1) >>> 0).toString(16).padStart(8, '0').repeat(5),
        subject: `feat(ioc): step ${index + 1} of resolving child containers lazily`,
        author: index % 3 === 0 ? 'anowak' : 'kedrzu',
    })),
    files: Array.from({ length: 48 }, (_, index) => ({
        path: `packages/ioc/src/lazy/Step${index + 1}.ts`,
        previousPath: null,
        status: index % 4 === 0 ? 'added' : 'modified',
        additions: index * 3,
        deletions: index % 5,
    })),
};

/** The block as wide as the review's diff is on a wide screen, or on a narrow one. */
function ofWidth(width: number): Decorator {
    return story => {
        const Story = story();
        return defineComponent({
            setup: () => () => h('div', { style: { width: `${width}px` } }, [h(Story)]),
        });
    };
}

const WIDE = ofWidth(1100);
const NARROW = ofWidth(600);

const meta = {
    component: ReviewSubmoduleBlock,
    args: { change: CHANGE },
    decorators: [withGitHubLinks()],
} satisfies Meta<typeof ReviewSubmoduleBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Bumped forward: the open pull request carrying the new commit, the commits brought in and the files they change. */
export const Ahead: Story = { decorators: [withSubmoduleHistory({ kind: 'ready', ...AHEAD })] };

/** A large bump, wide: the panels side by side, 20 rows each and Show more for the rest. */
export const Large: Story = { decorators: [WIDE, withSubmoduleHistory({ kind: 'ready', ...LARGE })] };

/** A large bump, narrow: the files' panel under the commits'. */
export const LargeNarrow: Story = { decorators: [NARROW, withSubmoduleHistory({ kind: 'ready', ...LARGE })] };

/** A small bump no pull request carries: a quiet card saying so, and panels with no foot. */
export const NoPullRequest: Story = {
    decorators: [WIDE, withSubmoduleHistory({ kind: 'ready', ...AHEAD, pullRequests: [] })],
};

/** Two pull requests carry the new commit, the open one and the merged one: a card each. */
export const TwoPullRequests: Story = {
    decorators: [
        WIDE,
        withSubmoduleHistory({
            kind: 'ready',
            ...AHEAD,
            pullRequests: [
                ...AHEAD.pullRequests,
                {
                    number: 405,
                    state: 'MERGED',
                    title: 'Split Container into a resolver and a registry',
                    url: 'https://github.com/kedrzu/nzyme/pull/405',
                    isDraft: false,
                },
            ],
        }),
    ],
};

/** Rolled back: the commits it drops, the files as the rollback moves them, and the comparison the other way round. */
export const RolledBack: Story = {
    decorators: [
        withSubmoduleHistory({
            kind: 'ready',
            ...AHEAD,
            relation: { kind: 'behind', count: 2 },
            commits: AHEAD.commits.slice(0, 2),
            files: [
                {
                    path: 'packages/ioc/src/Container.ts',
                    previousPath: null,
                    status: 'modified',
                    additions: 9,
                    deletions: 24,
                },
                {
                    path: 'packages/ioc/src/lazy.ts',
                    previousPath: null,
                    status: 'removed',
                    additions: 0,
                    deletions: 61,
                },
            ],
            pullRequests: [
                {
                    number: 398,
                    state: 'MERGED',
                    title: 'Keep focus while a button is busy',
                    url: 'https://github.com/kedrzu/nzyme/pull/398',
                    isDraft: false,
                },
            ],
        }),
    ],
};

/** Moved to a commit on another line: ahead and behind at once. */
export const Diverged: Story = {
    decorators: [
        withSubmoduleHistory({ kind: 'ready', ...AHEAD, relation: { kind: 'diverged', ahead: 3, behind: 1 } }),
    ],
};

/** Added: no comparison, only the commit it starts at and the pull request that brought it. */
export const Added: Story = {
    args: { change: { ...CHANGE, before: null } },
    decorators: [
        withSubmoduleHistory({
            kind: 'ready',
            ...AHEAD,
            relation: { kind: 'added' },
            commits: [],
            files: [],
            pullRequests: [{ ...AHEAD.pullRequests[0]!, state: 'MERGED' }],
        }),
    ],
};

/** Removed: nothing is read of it, so there is no pull request to look for. */
export const Removed: Story = {
    args: { change: { ...CHANGE, after: null } },
    decorators: [
        withSubmoduleHistory({
            kind: 'ready',
            repository: null,
            relation: { kind: 'removed' },
            commits: [],
            moreCommits: 0,
            files: [],
            moreFiles: false,
            pullRequests: [],
        }),
    ],
};

/** More commits and files than GitHub lists: it says how many more commits, and that files may be missing. */
export const More: Story = {
    decorators: [
        withSubmoduleHistory({
            kind: 'ready',
            ...AHEAD,
            relation: { kind: 'ahead', count: 312 },
            moreCommits: 309,
            moreFiles: true,
            pullRequests: [],
        }),
    ],
};

/** Its history on its way: quiet bars, as tall as the row is estimated. */
export const Loading: Story = { decorators: [withSubmoduleHistory({ kind: 'loading' })] };

/** Its repository isn't visible to the user: it says so, with the comparison on GitHub. */
export const Unreadable: Story = {
    decorators: [withSubmoduleHistory({ kind: 'unreadable', repository: 'kedrzu/nzyme' })],
};

/** GitHub refused: its words and Try again. */
export const Failed: Story = {
    decorators: [
        withSubmoduleHistory({
            kind: 'failed',
            error: new GitHubApiError({ message: 'GitHub answered 502', status: 502, githubMessage: 'Server Error' }),
        }),
    ],
};

/** GitHub's allowance ran out: when it carries on by itself. */
export const Paused: Story = {
    decorators: [withSubmoduleHistory({ kind: 'paused', until: new Date('2026-10-30T14:32:00').getTime() })],
};
