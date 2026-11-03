import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { groupReviewFiles } from './groupReviewFiles.js';
import ReviewFileList from './ReviewFileList.vue';
import type { ReviewFile, ReviewFileCollapseReason, ReviewFileState } from './ReviewFiles.js';

const FILES: readonly ReviewFile[] = [
    file('README.md', 6, 0, { viewed: 'VIEWED' }),
    file('bun.lock', 214, 37),
    file('.github/workflows/e2e.yml', 7, 2, { viewed: 'VIEWED' }),
    file('docs/architecture.md', 18, 6, { viewed: 'VIEWED' }),
    file('docs/sync.md', 96, 0, { changeType: 'ADDED' }),
    file('docs/old.md', 0, 40, { changeType: 'DELETED' }),
    file('public/images/offline-hero.png', 0, 0, { changeType: 'ADDED' }),
    file('src/api/client.ts', 9, 3),
    file('src/api/workouts.ts', 18, 11, { changeType: 'RENAMED', previousPath: 'src/api/old.ts' }),
    file('src/api/generated/schema.json', 880, 120),
];

const READY: ReviewFileState = { kind: 'ready', before: '', after: '' };
const STATES: Readonly<Record<string, ReviewFileState>> = {
    'public/images/offline-hero.png': { kind: 'binary' },
    'src/api/generated/schema.json': { kind: 'tooLarge' },
    'src/api/client.ts': { kind: 'failed', error: new Error('GitHub answered 502') },
    'docs/sync.md': { kind: 'loading' },
};

const COLLAPSES: Readonly<Record<string, ReviewFileCollapseReason>> = {
    'bun.lock': 'lockFile',
    'src/api/generated/schema.json': 'generated',
};

const meta = {
    component: ReviewFileList,
    args: {
        groups: groupReviewFiles(FILES),
        files: FILES,
        getState: (path: string) => STATES[path] ?? READY,
        getCollapse: (path: string) => COLLAPSES[path] ?? null,
        getCollapseReason: (path: string) => COLLAPSES[path] ?? null,
        hideViewed: false,
        currentPath: 'docs/sync.md',
        changedFiles: FILES.length,
        listComplete: true,
        onSelect: fn(),
    },
    render: args => ({
        components: { ReviewFileList },
        setup: () => ({ args }),
        template: `<div style="width: 300px; height: 500px"><ReviewFileList v-bind="args" /></div>`,
    }),
} satisfies Meta<typeof ReviewFileList>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR46: the files in tree order, viewed ones with an eye; loading, failed, binary and too large marked. */
export const Files: Story = {};

/** Nothing arrived yet. */
export const Empty: Story = { args: { groups: [], files: [], currentPath: null, changedFiles: null } };

/** CR21: viewed files hidden: the eye lit, the count still of all of them. */
export const HidingViewed: Story = {
    args: { groups: groupReviewFiles(FILES.filter(({ viewed }) => viewed !== 'VIEWED')), hideViewed: true },
};

/** D35: GitHub lists 3000 at most: "3,000+" and a note at the foot. */
export const MoreThanListed: Story = { args: { changedFiles: 4210 } };

/** The list still arriving page by page: "10+", and no note at the foot, as the rest is on its way. */
export const StillArriving: Story = { args: { changedFiles: 238, listComplete: false } };

function file(path: string, additions: number, deletions: number, more: Partial<ReviewFile> = {}): ReviewFile {
    return { path, previousPath: null, changeType: 'MODIFIED', additions, deletions, viewed: 'UNVIEWED', ...more };
}
