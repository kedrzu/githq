import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { ReviewFiles } from './ReviewFiles.js';
import type { PullRequestFiles, ReviewFile, ReviewFileListState, ReviewFileState } from './ReviewFiles.js';
import ReviewView from './ReviewView.vue';

const REFERENCE = { owner: 'fitloop', name: 'webapp', number: 1202 };

const meta = {
    component: ReviewView,
    args: { reference: REFERENCE },
} satisfies Meta<typeof ReviewView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The list on its way: nothing to show yet, and no spinner. */
export const Reading: Story = { render: () => renderView({ kind: 'loading' }) };

/** GitHub would not give the list: its words, Try again and Open on GitHub. */
export const ListFailed: Story = {
    render: () => renderView({ kind: 'failed', error: new Error('GitHub answered 502') }),
};

/** GitHub says the pull request isn't there, perhaps as access was lost: the code kept of it stays hidden. */
export const Gone: Story = { render: () => renderView({ kind: 'gone' }) };

/** A pull request with no changes. */
export const NoChanges: Story = { render: () => renderView({ kind: 'ready' }) };

/** Files arrived: the list at the left and the diff filling the rest, every file under its header. */
export const Files: Story = {
    render: () =>
        renderView(
            { kind: 'ready' },
            {
                'src/sync/queue.ts': { kind: 'ready', before: 'one\ntwo\nthree\n', after: 'one\nTWO\nthree\n' },
                'public/hero.png': { kind: 'binary' },
            },
        ),
};

/** The view over a real session, whose GitHub answers nothing, reading what is given. */
function renderView(list: ReviewFileListState, states: Readonly<Record<string, ReviewFileState>> = {}) {
    return defineComponent({
        setup() {
            const container = createContainer();
            container.set(LanguageContext, () => APP_LANGUAGE);
            container.set(Browser, createSignedInBrowser());
            setIndexedDbPersistence(container);
            const files = createFiles(list, states);
            container.set(ReviewFiles, { open: () => files });
            provideContainer(container);
            return () => h(ReviewView, { reference: REFERENCE });
        },
    });
}

function createFiles(list: ReviewFileListState, states: Readonly<Record<string, ReviewFileState>>): PullRequestFiles {
    const files = Object.keys(states).map((path): ReviewFile => ({
        path,
        previousPath: null,
        changeType: 'MODIFIED',
        additions: 1,
        deletions: 1,
        viewed: 'UNVIEWED',
    }));

    return {
        list,
        files,
        listComplete: list.kind === 'ready',
        id: 'PR_1202',
        headRefOid: 'head',
        changedFiles: files.length,
        version: 0,
        getState: path => states[path] ?? { kind: 'waiting' },
        prioritize: () => {},
        retry: () => {},
    };
}
