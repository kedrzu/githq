import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { shallowRef } from 'vue';

import { buildFileLineRows, buildReviewRows, getReviewRowPath } from './buildReviewRows.js';
import type { ReviewFileContent, ReviewRow } from './buildReviewRows.js';
import type { DiffLayout } from './diff/buildDiffRows.js';
import { computeFileDiff } from './diff/computeFileDiff.js';
import DiffCode from './DiffCode.vue';
import ReviewDiffRow from './ReviewDiffRow.vue';
import type { ReviewFile, ReviewFileCollapseReason } from './ReviewFiles.js';
import type { FileSyntax } from './syntax/createFileSyntax.js';
import { loadGrammar, tokenizeLines } from './syntax/tokenizeLines.js';
import type { CommentedLines } from './utils/isLineCommented.js';

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
        `private outbox = new Outbox(db, { flushAfter: 200, retries: 3, backoff: 'exponential', onConflict: 'keep-both', storage: 'indexeddb', label: 'a line long enough to wrap on any screen a laptop has', badge: '<img src=x>' })`,
    );
const DIFF = computeFileDiff({ before: BEFORE, after: AFTER, ignoreWhitespace: false });

const FILE = file('src/sync/engine.ts', 6, 3);
/** 120 lines in a class, changed at 30, 70 and 85: a gap at its top, a long and a short one between hunks, one at its end. */
const GAPS_BEFORE = `export class Outbox {
${Array.from({ length: 118 }, (_, index) => `    const kept${index + 2} = ${index + 2};`).join('\n')}
}
`;
const GAPS_DIFF = computeFileDiff({
    before: GAPS_BEFORE,
    after: [30, 70, 85].reduce((text, line) => text.replace(`kept${line} = ${line};`, `kept${line} = 0;`), GAPS_BEFORE),
    ignoreWhitespace: false,
});
const GAPS_FILE = file('src/sync/outbox.ts', 3, 3);
/** 1,200 lines, changed at 1,100: numbers of four digits. */
const LONG_BEFORE = Array.from({ length: 1200 }, (_, index) => `const kept${index + 1} = ${index + 1};`).join('\n');
const LONG_DIFF = computeFileDiff({
    before: LONG_BEFORE,
    after: LONG_BEFORE.replace('kept1100 = 1100;', 'kept1100 = 0;'),
    ignoreWhitespace: false,
});
const LONG_FILE = file('src/sync/long.ts', 1, 1);
const FILES_URL = 'https://github.com/fitloop/webapp/pull/1202/files';
/** The SHA-256 of `src/sync/engine.ts`, which is GitHub's anchor for it. */
const ENGINE_SHA256 = '0b9f02836c850d13ddf4864de8031855512dc842b927a8ffcee839ac0fa33825';

const meta = {
    component: ReviewDiffRow,
    args: {
        row: { kind: 'end', key: 'end', collapsed: false },
        githubUrl: FILES_URL,
        onRetry: fn(),
    },
} satisfies Meta<typeof ReviewDiffRow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR4: a file's block, split: header, changed and unchanged lines, a line that wraps, the lines left out. */
export const Split: Story = { render: () => renderRows(fileRows(FILE, { kind: 'lines', rows: lines('split') })) };

/** CR5: unified. */
export const Unified: Story = { render: () => renderRows(fileRows(FILE, { kind: 'lines', rows: lines('unified') })) };

/** CR70, D43: lines a comment is being written on are tinted, their numbers on that side in accent. */
export const SplitCommented: Story = {
    args: { commented: [{ side: 'after', start: 3, end: 5 }] },
    render: args => renderRows(fileRows(FILE, { kind: 'lines', rows: lines('split') }), { commented: args.commented }),
};

/** Unified, the same. */
export const UnifiedCommented: Story = {
    args: { commented: [{ side: 'after', start: 3, end: 5 }] },
    render: args =>
        renderRows(fileRows(FILE, { kind: 'lines', rows: lines('unified') }), { commented: args.commented }),
};

/** Split with its tokens arrived: the colours over the tints and the window, which axe holds to AA. */
export const SplitColoured: Story = {
    loaders: [loadTokens],
    render: (_args, { loaded }) => renderRows(fileRows(FILE, { kind: 'lines', rows: lines('split', loaded.syntax) })),
};

/** Unified with its tokens arrived. */
export const UnifiedColoured: Story = {
    loaders: [loadTokens],
    render: (_args, { loaded }) => renderRows(fileRows(FILE, { kind: 'lines', rows: lines('unified', loaded.syntax) })),
};

/** Each kind of token in its own colour: the title, tag and built-in kinds, which the TypeScript sample has no scopes for. */
export const CodeKinds: Story = {
    loaders: [loadKindSamples],
    render: (_args, { loaded }) => ({
        components: { DiffCode },
        setup: () => ({ samples: loaded.samples }),
        template: `<div><DiffCode v-for="sample in samples" :key="sample.text" :text="sample.text" :tokens="sample.tokens" :line="0" /></div>`,
    }),
};

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

/** CR21: a viewed file: only its header, the name dimmed and the mark ticked (D13). */
export const Viewed: Story = {
    render: () => renderRows(fileRows(file('docs/sync.md', 96, 0, { viewed: 'VIEWED' }), { kind: 'collapsed' })),
};

/** A viewed file opened with Space. */
export const ViewedOpened: Story = {
    render: () =>
        renderRows(
            fileRows(file('docs/sync.md', 96, 0, { viewed: 'VIEWED' }), { kind: 'lines', rows: lines('split') }),
        ),
};

/** CR108, D44: the current file, its header tinted with an accent chevron and its block edged in accent, between two others. */
export const Current: Story = {
    render: () =>
        renderRows(
            [
                ...fileRows(file('src/sync/queue.ts', 4, 0), { kind: 'collapsed' }),
                ...fileRows(FILE, { kind: 'lines', rows: lines('split') }),
                ...fileRows(file('src/sync/outbox.ts', 2, 1), { kind: 'collapsed' }),
            ],
            { currentPath: FILE.path },
        ),
};

/** Collapsed to its header, the header carries it alone. */
export const CurrentCollapsed: Story = {
    render: () => renderRows(fileRows(FILE, { kind: 'collapsed' }), { currentPath: FILE.path }),
};

/** Viewed, dimmed name and ticked mark under the tint. */
export const CurrentViewed: Story = {
    render: () => {
        const viewed = file('docs/sync.md', 96, 0, { viewed: 'VIEWED' });
        return renderRows(fileRows(viewed, { kind: 'collapsed' }), { currentPath: viewed.path });
    },
};

/** The pinned header pushed up by the next file's (D41): the same tint, its block ending at its rounded bottom. */
export const CurrentPushed: Story = {
    render: () =>
        renderRows(fileRows(FILE, { kind: 'lines', rows: lines('split') }).slice(0, 1), {
            currentPath: FILE.path,
            pushed: true,
        }),
};

/** CR88: files on their way in split, a bar for each line where its code will start (D38): a modified file mirrors its context, an added one is on the right alone, a deleted one on the left alone. */
export const PlaceholderSplit: Story = { render: () => renderRows(placeholderRows(), { layout: 'split' }) };

/** CR89: the same files unified, the same lines in one column. */
export const PlaceholderUnified: Story = { render: () => renderRows(placeholderRows(), { layout: 'unified' }) };

/** CR61: a jump's target, fetched ahead of the rest. */
export const FetchingFirst: Story = { render: () => renderRows(fileRows(FILE, { kind: 'placeholder', first: true })) };

/** CR103: the lines left out (D42): ↑ alone at a file's top, ↓ and ↑ between hunks, one ↕ for a short gap, ↓ alone at its end, each with the declaration what follows sits in. */
export const Gaps: Story = {
    args: { onExpand: fn() },
    render: args => ({
        components: { ReviewDiffRow },
        setup: () => ({
            rows: fileRows(GAPS_FILE, {
                kind: 'lines',
                rows: buildFileLineRows({ path: GAPS_FILE.path, diff: GAPS_DIFF, layout: 'unified' }),
            }),
            githubUrl: FILES_URL,
            onExpand: args.onExpand,
        }),
        template: `<div style="width: 1000px"><ReviewDiffRow v-for="row in rows" :key="row.key" :row="row" :github-url="githubUrl" @expand="onExpand" /></div>`,
    }),
    play: async ({ canvas }) => {
        await expect(canvas.getByText('26 lines above')).toBeVisible();
        await expect(canvas.getByText('33 lines')).toBeVisible();
        await expect(canvas.getByText('8 lines')).toBeVisible();
        await expect(canvas.getByText('32 lines below')).toBeVisible();
        await expect(canvas.getAllByText('export class Outbox {')).toHaveLength(4);
    },
};

/** CR62: a push reset the context expanded in the file: its first gap says so, once, its arrows working as ever. */
export const ExpansionReset: Story = {
    render: () =>
        renderRows(
            fileRows(FILE, {
                kind: 'lines',
                rows: buildFileLineRows({ path: FILE.path, diff: DIFF, layout: 'split', expansionReset: true }),
            }),
        ),
    play: async ({ canvas }) => {
        await expect(
            canvas.getAllByText(/^Context you expanded here was reset by the push · \d+ lines$/u),
        ).toHaveLength(1);
    },
};

/** D42, `Diff / Gap · reset, nothing hidden`: a gap a push reset whose lines are all shown for threads says only that, with no count, no arrow and no click. */
export const ExpansionResetNothingHidden: Story = {
    args: { onExpand: fn() },
    render: args => ({
        components: { ReviewDiffRow },
        setup: () => ({
            rows: fileRows(FILE, {
                kind: 'lines',
                rows: buildFileLineRows({ path: FILE.path, diff: DIFF, layout: 'split', expansionReset: true }).map(
                    row => (row.kind === 'gap' && row.expansionReset ? { ...row, hidden: 0 } : row),
                ),
            }),
            githubUrl: FILES_URL,
            onExpand: args.onExpand,
        }),
        template: `<div style="width: 1000px"><ReviewDiffRow v-for="row in rows" :key="row.key" :row="row" :github-url="githubUrl" layout="split" @expand="onExpand" /></div>`,
    }),
    play: async ({ canvas }) => {
        await expect(
            canvas.getByText('Context you expanded here was reset by the push', { exact: true }),
        ).toBeVisible();
    },
};

/** D43: a file of four-digit line numbers, split: the number column widens for the comment icon to stay inside it. */
export const FourDigitsSplit: Story = {
    render: () =>
        renderRows(
            fileRows(LONG_FILE, {
                kind: 'lines',
                rows: buildFileLineRows({ path: LONG_FILE.path, diff: LONG_DIFF, layout: 'split' }),
            }),
            { layout: 'split' },
        ),
};

/** D43: the same, unified: both number columns widen. */
export const FourDigitsUnified: Story = {
    render: () =>
        renderRows(
            fileRows(LONG_FILE, {
                kind: 'lines',
                rows: buildFileLineRows({ path: LONG_FILE.path, diff: LONG_DIFF, layout: 'unified' }),
            }),
            { layout: 'unified' },
        ),
};

/** CR62: GitHub took its viewed mark off since the last visit. */
export const ChangedSince: Story = {
    render: () => ({
        components: { ReviewDiffRow },
        setup: () => ({ rows: fileRows(FILE, { kind: 'lines', rows: lines('split') }), url: FILES_URL }),
        template: `<div style="width: 1000px"><ReviewDiffRow v-for="row in rows" :key="row.key" :row="row" :github-url="url" changed-since /></div>`,
    }),
    play: async ({ canvas }) => {
        await expect(canvas.getByText('Changed since your last visit')).toBeVisible();
    },
};

/** CR67: failed, in place: GitHub's words, without the requester's own, and a link to the very file. */
export const Failed: Story = {
    render: () =>
        renderRows(
            fileRows(FILE, {
                kind: 'failed',
                error: new GitHubApiError({
                    status: 200,
                    message: 'GitHub GraphQL error: Something went wrong',
                    errors: [{ message: 'Something went wrong' }],
                }),
            }),
        ),
    play: async ({ canvas }) => {
        await expect(canvas.getByText('Something went wrong')).toBeVisible();
        await expect(canvas.queryByText(/GitHub GraphQL error/u)).toBeNull();
        await waitFor(() =>
            expect(canvas.getByText('Open on GitHub').closest('a')).toHaveAttribute(
                'href',
                `${FILES_URL}#diff-${ENGINE_SHA256}`,
            ),
        );
    },
};

/** CR67: too large, saying how large. */
export const TooLarge: Story = {
    render: () => renderRows(fileRows(FILE, { kind: 'tooLarge', before: 120, after: 4_200_000 })),
    play: async ({ canvas }) => {
        await expect(canvas.getByText(/^4\.2 MB\./u)).toBeVisible();
    },
};

/** CR65: binary, its sizes before and after. */
export const Binary: Story = {
    render: () => renderRows(fileRows(FILE, { kind: 'binary', before: 12_000, after: 14_000 })),
};

/** CR65: a new binary file. */
export const BinaryNew: Story = {
    render: () =>
        renderRows(
            fileRows(file('public/hero.png', 0, 0, { changeType: 'ADDED' }), {
                kind: 'binary',
                before: null,
                after: 48_000,
            }),
        ),
};

/** CR65: a submodule, which has no size. */
export const BinaryNoSize: Story = {
    render: () => renderRows(fileRows(FILE, { kind: 'binary', before: null, after: null })),
};

/** CR68: waiting for the allowance: the first of them says when and how many; the others only that they wait. */
export const Paused: Story = {
    render: () => {
        const until = new Date('2026-10-30T14:32:00').getTime();
        return renderRows(
            buildReviewRows({
                files: [FILE, file('src/styles/sync.css', 29, 0), file('src/sync/queue.ts', 9, 0)],
                getContent: () => ({ kind: 'paused', until }),
            }),
        );
    },
    play: async ({ canvas }) => {
        await expect(canvas.getByText(/This file and 2 others will load then/u)).toHaveTextContent('14:32');
        await expect(canvas.getAllByText("Waiting for GitHub's API allowance")).toHaveLength(3);
    },
};

/** CR2: a header counts its threads. */
export const WithThreads: Story = {
    render: () =>
        renderRows([
            {
                kind: 'header',
                key: 'header',
                file: FILE,
                collapsed: false,
                collapseReason: null,
                threadsUnder: false,
                threads: { open: 1, outdated: 1, lineGone: 1, resolved: 1 },
            },
        ]),
    play: async ({ canvas }) => {
        await expect(canvas.getByText('1 open · 1 outdated · 1 outdated, line gone · 1 resolved')).toBeInTheDocument();
    },
};

/** CR14: a file gone from the diff has a struck name and says so, with neither Viewed nor a chevron. */
export const GoneHeader: Story = {
    render: () =>
        renderRows([
            {
                kind: 'header',
                key: 'header',
                file: file('src/sync/retry-policy.ts', 0, 0, { gone: { kind: 'notInDiff' }, changeType: 'DELETED' }),
                collapsed: false,
                collapseReason: null,
                threadsUnder: true,
                threads: { open: 1, outdated: 0, lineGone: 0, resolved: 0 },
            },
        ]),
    play: async ({ canvas }) => {
        await expect(canvas.getByText("No longer in this pull request's diff")).toBeInTheDocument();
        await expect(canvas.queryByRole('button', { name: /Viewed/u })).not.toBeInTheDocument();
    },
};

/** The list stopped short: it isn't known to be gone. */
export const GoneUncertain: Story = {
    render: () =>
        renderRows([
            {
                kind: 'header',
                key: 'header',
                file: file('src/sync/retry-policy.ts', 0, 0, { gone: { kind: 'notListed' }, changeType: 'DELETED' }),
                collapsed: false,
                collapseReason: null,
                threadsUnder: true,
                threads: { open: 1, outdated: 0, lineGone: 0, resolved: 0 },
            },
        ]),
    play: async ({ canvas }) => {
        await expect(canvas.getByText('Not among the files GitHub has listed')).toBeInTheDocument();
    },
};

/** CR11: nothing but whitespace changed, and it's hidden. */
export const OnlyWhitespace: Story = {
    render: () => renderRows([{ kind: 'onlyWhitespace', key: 'onlyWhitespace' }]),
};

/** A new file with nothing in it. */
export const EmptyFile: Story = { render: () => renderRows(fileRows(FILE, { kind: 'lines', rows: [] })) };

function lines(layout: DiffLayout, syntax?: FileSyntax) {
    return buildFileLineRows({ path: FILE.path, diff: DIFF, layout, syntax });
}

async function loadTokens() {
    await loadGrammar('typescript');
    const syntax: FileSyntax = {
        before: shallowRef(tokenizeLines('typescript', DIFF.before)),
        after: shallowRef(tokenizeLines('typescript', DIFF.after)),
    };
    return { syntax };
}

async function loadKindSamples() {
    const samples = [];
    for (const [language, text] of [
        ['typescript', 'export class Engine { run() {} } // done'],
        ['python', 'print(len(x), None)'],
        ['xml', '<div a="b">x</div>'],
    ] as const) {
        await loadGrammar(language);
        samples.push({ text, tokens: tokenizeLines(language, [text]) });
    }

    return { samples };
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
    });
}

/** A modified, an added and a deleted file, all still on their way. */
function placeholderRows() {
    return [
        file('src/sync/engine.ts', 14, 9),
        file('src/sync/outbox.ts', 22, 0, { changeType: 'ADDED' }),
        file('src/sync/pending.ts', 0, 18, { changeType: 'DELETED' }),
    ].flatMap(shown => fileRows(shown, { kind: 'placeholder' }));
}

interface RenderRowsOptions {
    readonly commented?: CommentedLines;
    readonly layout?: DiffLayout;
    /** The file whose rows are drawn as the current one (D44). */
    readonly currentPath?: string;
    /** Every row drawn as a pinned header being pushed up. */
    readonly pushed?: boolean;
}

function renderRows(rows: readonly ReviewRow[], { commented, layout, currentPath, pushed }: RenderRowsOptions = {}) {
    return {
        components: { ReviewDiffRow },
        setup: () => ({
            rows,
            githubUrl: FILES_URL,
            commented,
            layout,
            pushed,
            isCurrent,
        }),
        template: `<div style="width: 1000px"><ReviewDiffRow v-for="row in rows" :key="row.key" :row="row" :github-url="githubUrl" :commented="commented" :layout="layout" :pushed="pushed" :current="isCurrent(row)" /></div>`,
    };

    function isCurrent(row: ReviewRow) {
        return getReviewRowPath(row.key) === currentPath;
    }
}

function file(path: string, additions: number, deletions: number, more: Partial<ReviewFile> = {}): ReviewFile {
    return { path, previousPath: null, changeType: 'MODIFIED', additions, deletions, viewed: 'UNVIEWED', ...more };
}
