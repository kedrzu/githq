import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fireEvent, fn, userEvent } from 'storybook/test';

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
    'public/images/offline-hero.png': { kind: 'binary', before: null, after: 48_000 },
    'src/api/generated/schema.json': { kind: 'tooLarge', before: 80, after: 4_200_000 },
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
        filterPattern: '',
        filterRegex: false,
        matched: null,
        filterInvalid: false,
        selected: new Set<string>(),
        onSelect: fn(),
        onSelectRange: fn(),
        onToggleSelected: fn(),
        onMarkSelected: fn(),
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

/** CR2, CR14: open threads in amber, a click on them landing on the first; a file gone from the diff says so. */
export const Threads: Story = {
    args: {
        groups: groupReviewFiles([
            ...FILES,
            { ...file('src/sync/retry-policy.ts', 0, 0, { changeType: 'DELETED' }), gone: true },
        ]),
        openThreads: new Map([
            ['docs/sync.md', 2],
            ['src/sync/retry-policy.ts', 1],
        ]),
        onSelectThreads: fn(),
    },
    play: async ({ args, canvas }) => {
        await expect(canvas.getByText('not in the diff')).toBeInTheDocument();
        await userEvent.click(canvas.getByRole('img', { name: '2 open threads' }));
        await expect(args.onSelectThreads).toHaveBeenCalledWith('docs/sync.md');
    },
};

/** CR21: viewed files hidden: the eye lit, the count still of all of them. */
export const HidingViewed: Story = {
    args: { groups: groupReviewFiles(FILES.filter(({ viewed }) => viewed !== 'VIEWED')), hideViewed: true },
};

/** CR66: GitHub lists 3000 at most: "3,000+", and a note pinned at the foot under rows that scroll. */
export const MoreThanListed: Story = {
    args: { changedFiles: 4812 },
    play: async ({ canvas }) => {
        await expect(canvas.getByText('The other 4,802 can only be read', { exact: false })).toBeVisible();
    },
};

/** CR64: no files: no count of viewed ones either. */
export const NoFiles: Story = {
    args: { groups: [], files: [], currentPath: null, changedFiles: 0 },
    play: async ({ canvas }) => {
        await expect(canvas.queryByText(/viewed/u)).toBeNull();
    },
};

/** CR68: files waiting for the allowance carry the amber pause. */
export const Paused: Story = {
    args: { getState: () => ({ kind: 'paused', until: Date.UTC(2026, 9, 30, 14, 32) }), getCollapse: () => null },
    play: async ({ canvas }) => {
        await expect(canvas.getAllByRole('img', { name: "Waiting for GitHub's API allowance" })).toHaveLength(10);
    },
};

/** CR62: a file that lost its viewed mark is tagged. */
export const ChangedSince: Story = {
    args: { lostViewed: new Set(['src/api/client.ts']) },
    play: async ({ canvas }) => {
        await expect(canvas.getAllByText('changed since')).toHaveLength(1);
    },
};

/** The list still arriving page by page: "10+", and no note at the foot, as the rest is on its way. */
export const StillArriving: Story = { args: { changedFiles: 238, listComplete: false } };

/** CR27: a pattern on: flat, each file followed by its folder, and the count of what matches. */
export const Filtered: Story = {
    args: {
        groups: [{ folder: null, files: FILES.filter(({ path }) => path.endsWith('.md')) }],
        filterPattern: '*.md',
        matched: 4,
    },
    play: async ({ canvas }) => {
        await expect(canvas.getByText('4 of 10 match')).toBeVisible();
        await expect(canvas.getAllByText('docs')).toHaveLength(3);
    },
};

/** No file matches: it says so. */
export const NoMatch: Story = {
    args: { groups: [], filterPattern: '*.xyz', matched: 0 },
    play: async ({ canvas }) => {
        await expect(canvas.getByText('No files match this filter.')).toBeVisible();
    },
};

/** CR28: an invalid expression: red, says so, the list as it was. */
export const InvalidRegex: Story = {
    args: { filterPattern: '^src/(', filterRegex: true, filterInvalid: true },
    play: async ({ canvas }) => {
        await expect(canvas.getByRole('status')).toHaveTextContent('Not a valid regular expression');
        await expect(canvas.getByRole('button', { name: /README\.md/u })).toBeVisible();
    },
};

/** CR23: ten selected: rows tinted, the bar at the foot. */
export const Selected: Story = {
    args: { selected: new Set(FILES.map(({ path }) => path)) },
    play: async ({ canvas, args }) => {
        await expect(canvas.getByText('10 files selected')).toBeVisible();
        await userEvent.click(canvas.getByRole('button', { name: /Mark viewed/u }));
        await expect(args.onMarkSelected).toHaveBeenCalledOnce();
    },
};

/** D10: a click opens, ⇧click selects a range, ⌘click adds one. */
export const ClickKinds: Story = {
    play: async ({ canvas, args }) => {
        const row = canvas.getByRole('button', { name: /README\.md/u });
        await userEvent.click(row);
        await expect(args.onSelect).toHaveBeenCalledWith('README.md');
        await fireEvent.click(row, { shiftKey: true });
        await fireEvent.click(row, { metaKey: true });
        await expect(args.onSelectRange).toHaveBeenCalledWith('README.md');
        await expect(args.onToggleSelected).toHaveBeenCalledWith('README.md');
    },
};

function file(path: string, additions: number, deletions: number, more: Partial<ReviewFile> = {}): ReviewFile {
    return { path, previousPath: null, changeType: 'MODIFIED', additions, deletions, viewed: 'UNVIEWED', ...more };
}
