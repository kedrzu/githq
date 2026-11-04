import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, userEvent, within } from 'storybook/test';
import { defineComponent, h, shallowRef } from 'vue';

import { createCommitGraphTest } from '@/testing/createCommitGraphTest.js';
import type { CommitGraphTestOptions } from '@/testing/createCommitGraphTest.js';
import { SAMPLE_COMMITS_NOW, sampleCommit, sampleCommitRef, sampleWebappHistory } from '@/testing/sampleCommits.js';

import { CommitGraphStore } from './CommitGraphStore.js';
import CommitRefList from './CommitRefList.vue';
import type { CommitPullRequest, CommitState } from './CommitTypes.js';

const NEVER = new Promise<void>(() => {});
const REPOSITORY = 'acme/web';

const meta = {
    component: CommitRefList,
} satisfies Meta<typeof CommitRefList>;

export default meta;

type Story = StoryObj<typeof CommitRefList>;

/** CH3: the default branch, then branches and tags, newest first, a branch's tip with its pull request and CI. */
export const List: Story = {
    render: () => renderList(webapp()),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(await canvas.findByRole('row', { name: /main/ })).toHaveTextContent('default');
        await expect(await canvas.findByRole('img', { name: 'Checks failing' })).toBeVisible();
    },
};

/** CH34: the branches' pull request and CI not known yet: an empty bar in their place. */
export const NotKnownYet: Story = {
    render: () => renderList({ ...webapp(), holdIf: operation => (operation === 'CommitStates' ? NEVER : null) }),
    play: async ({ canvasElement }) => {
        const bars = await within(canvasElement).findAllByRole('img', {
            name: 'Pull request and checks not known yet',
        });
        await expect(bars.length).toBeGreaterThan(0);
    },
};

/** CH10: dozens of branches and hundreds of tags: the newest of each, the rest counted, typing finds them. */
export const LongList: Story = {
    render: () => renderList(longList()),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(await canvas.findByText('46 more branches · type to find one')).toBeVisible();
        await expect(canvas.getByText('319 more tags · type to find one')).toBeVisible();
    },
};

/** CH15: typing narrows both groups, the best match selected; the group left with none says so. */
export const Filtering: Story = {
    render: () => renderList(webapp()),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.type(await canvas.findByRole('combobox'), 'rel');
        await expect(canvas.getByRole('gridcell', { selected: true })).toHaveTextContent('release/4.2');
        await expect(canvas.getByText('No tag matches "rel".')).toBeVisible();
    },
};

/** CH17: a filter that matches many: the newest, and how many more. */
export const FilteringMany: Story = {
    render: () => renderList(longList()),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.type(await canvas.findByRole('combobox'), 'v3.1');
        await expect(await canvas.findByText(/\d+ more · keep typing/)).toBeVisible();
    },
};

/** The webapp sample with release branches, whose tips have pull requests of each state. */
function webapp(): CommitGraphTestOptions {
    const sample = sampleWebappHistory();
    return {
        ...sample,
        branches: [...sample.branches, sampleCommitRef('release/4.2', 'a7')],
    };
}

function longList(): CommitGraphTestOptions {
    const commits = Array.from({ length: 400 }, (_, index) => sampleCommit(`c${index}`, index));
    const pullRequest: CommitPullRequest = {
        number: 33_950,
        state: 'OPEN',
        title: 'A change',
        url: 'https://github.com/acme/web/pull/33950',
        isDraft: false,
    };
    const state: CommitState = { pullRequest, ci: 'PENDING' };
    return {
        commits,
        branches: [
            sampleCommitRef('main', 'c399'),
            ...Array.from({ length: 66 }, (_, index) =>
                sampleCommitRef(`renovate/a-rather-long-branch-name-${index}`, `c${index}`),
            ),
        ],
        tags: Array.from({ length: 339 }, (_, index) =>
            sampleCommitRef(`v3.${Math.floor(index / 10)}.${index % 10}`, `c${index}`),
        ),
        states: new Map([['c65', state]]),
    };
}

/** The list over the real store and a GitHub holding `options`, at the sample's moment, in a column of its default width. */
function renderList(options: CommitGraphTestOptions) {
    return defineComponent({
        setup() {
            const { container, ready } = createCommitGraphTest(options);
            provideContainer(container);
            const store = container.resolve(CommitGraphStore);
            const opened = shallowRef(false);
            const open = async () => {
                await ready;
                await store.open(REPOSITORY);
                opened.value = true;
            };
            void open();
            return () => {
                const refs = opened.value ? store.get(REPOSITORY)?.refs : null;
                return h(
                    'div',
                    { style: 'display: flex; width: 280px; height: 100vh' },
                    refs
                        ? [
                              h(CommitRefList, {
                                  nameWithOwner: REPOSITORY,
                                  refs,
                                  now: SAMPLE_COMMITS_NOW,
                              }),
                          ]
                        : [],
                );
            };
        },
    });
}
