import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { buildFileLineRows, buildReviewRows } from './buildReviewRows.js';
import type { ReviewFileContent, ReviewRow } from './buildReviewRows.js';
import type { DiffLayout } from './diff/buildDiffRows.js';
import { computeFileDiff } from './diff/computeFileDiff.js';
import ReviewDiffRow from './ReviewDiffRow.vue';
import type { ReviewFile, ReviewFileCollapseReason } from './ReviewFiles.js';

const BEFORE = `import { db } from '../db/client'
import { PendingStore } from './pending'

const MAX_BATCH = 20
const RETRY_DELAY_MS = 2_000

${Array.from({ length: 30 }, (_, index) => `// A line nobody changed, number ${index + 1}`).join('\n')}

export class SyncEngine {
  private pending = new PendingStore(db)
  private conflicts: Workout[] = []
  private running = false
}
`;
const AFTER = BEFORE.replace(
    "import { PendingStore } from './pending'",
    `import { Outbox } from './outbox'
import { replayQueue } from './queue'`,
)
    .replace('MAX_BATCH = 20', 'MAX_BATCH = 50')
    .replace(
        'private pending = new PendingStore(db)',
        `private outbox = new Outbox(db, { flushAfter: 200, retries: 3, backoff: 'exponential', onConflict: 'keep-both', storage: 'indexeddb', label: 'a line long enough to wrap on any screen a laptop has' })`,
    );
const DIFF = computeFileDiff({ before: BEFORE, after: AFTER, ignoreWhitespace: false });

const FILE = file('src/sync/engine.ts', 6, 3);

const meta = {
    component: ReviewDiffRow,
    args: {
        row: { kind: 'end', key: 'end', collapsed: false },
        githubUrl: 'https://github.com/fitloop/webapp/pull/1202/files',
        onRetry: fn(),
    },
} satisfies Meta<typeof ReviewDiffRow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR4: a file's block, split: header, changed and unchanged lines, a line that wraps, the lines left out. */
export const Split: Story = { render: () => renderRows(fileRows(FILE, { kind: 'lines', rows: lines('split') })) };

/** CR5: unified. */
export const Unified: Story = { render: () => renderRows(fileRows(FILE, { kind: 'lines', rows: lines('unified') })) };

/** A renamed file says where it came from. */
export const Renamed: Story = {
    render: () =>
        renderRows(
            fileRows(file('src/sync/outbox.ts', 2, 1, { changeType: 'RENAMED', previousPath: 'src/sync/pending.ts' }), {
                kind: 'lines',
                rows: lines('split'),
            }),
        ),
};

/** CR12: collapsed, each saying why: a lock file, a generated one, a large one; and one collapsed by hand. CR13: opened, it still says why. */
export const Collapsed: Story = {
    render: () =>
        renderRows([
            ...fileRows(file('bun.lock', 214, 37), { kind: 'collapsed' }, 'lockFile'),
            ...fileRows(file('src/api/schema.gen.ts', 880, 120), { kind: 'collapsed' }, 'generated'),
            ...fileRows(file('data/fixtures.json', 5000, 0), { kind: 'collapsed' }, 'large'),
            ...fileRows(FILE, { kind: 'collapsed' }),
            ...fileRows(file('yarn.lock', 6, 3), { kind: 'lines', rows: lines('split') }, 'lockFile'),
        ]),
};

/** CR21: a viewed file: the name dimmed and the mark ticked. */
export const Viewed: Story = {
    render: () =>
        renderRows(
            fileRows(file('docs/sync.md', 96, 0, { viewed: 'VIEWED' }), { kind: 'lines', rows: lines('split') }),
        ),
};

/** CR60: on its way, quiet bars. */
export const Placeholder: Story = { render: () => renderRows(fileRows(FILE, { kind: 'placeholder' })) };

/** CR67: failed, in place. */
export const Failed: Story = {
    render: () => renderRows(fileRows(FILE, { kind: 'failed', error: new Error('GitHub answered 502.') })),
};

/** CR67: too large. */
export const TooLarge: Story = { render: () => renderRows(fileRows(FILE, { kind: 'tooLarge' })) };

/** CR65: binary. */
export const Binary: Story = { render: () => renderRows(fileRows(FILE, { kind: 'binary' })) };

/** A new file with nothing in it. */
export const EmptyFile: Story = { render: () => renderRows(fileRows(FILE, { kind: 'lines', rows: [] })) };

function lines(layout: DiffLayout) {
    return buildFileLineRows({ path: FILE.path, diff: DIFF, layout });
}

/** The rows the diff would draw for the file, without the room left under the last one. */
function fileRows(
    shown: ReviewFile,
    content: ReviewFileContent,
    collapseReason: ReviewFileCollapseReason | null = null,
): ReviewRow[] {
    return buildReviewRows({
        files: [shown],
        getContent: () => content,
        getCollapseReason: () => collapseReason,
    }).filter(row => row.kind !== 'tail');
}

function renderRows(rows: readonly ReviewRow[]) {
    return {
        components: { ReviewDiffRow },
        setup: () => ({ rows, githubUrl: 'https://github.com/fitloop/webapp/pull/1202/files' }),
        template: `<div style="width: 1000px"><ReviewDiffRow v-for="row in rows" :key="row.key" :row="row" :github-url="githubUrl" /></div>`,
    };
}

function file(path: string, additions: number, deletions: number, more: Partial<ReviewFile> = {}): ReviewFile {
    return { path, previousPath: null, changeType: 'MODIFIED', additions, deletions, viewed: 'UNVIEWED', ...more };
}
