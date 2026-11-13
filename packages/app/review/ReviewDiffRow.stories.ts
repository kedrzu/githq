import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { shallowRef } from 'vue';

import { createThreadRowSample, sampleThread } from '@/testing/sampleThreads.js';
import { withSubmoduleHistory } from '@/testing/withSubmoduleHistory.js';

import {
    buildFileLineRows,
    buildPlaceholderRows,
    buildReviewRows,
    getReviewHeaderKey,
    getReviewRowPath,
} from './buildReviewRows.js';
import type { ReviewFileContent, ReviewGapDirection, ReviewRow, ReviewThreadRow } from './buildReviewRows.js';
import type { DiffLayout, DiffLineSide, DiffSplitRow, DiffUnifiedRow } from './diff/buildDiffRows.js';
import type { FileDiff } from './diff/computeFileDiff.js';
import { computeFileDiff } from './diff/computeFileDiff.js';
import DiffCode from './DiffCode.vue';
import ReviewDiffRow from './ReviewDiffRow.vue';
import type { ReviewFile, ReviewFileCollapseReason } from './ReviewFiles.js';
import type { ReviewSubmoduleChange } from './submodules/ReviewSubmodules.js';
import type { FileSyntax } from './syntax/createFileSyntax.js';
import { loadGrammar, tokenizeLines } from './syntax/tokenizeLines.js';
import type { CommentedLines } from './utils/isLineCommented.js';
import ReviewWrittenComment from './writing/ReviewWrittenComment.vue';
import type { ReviewCommentStatus, ReviewCommentTarget } from './writing/ReviewWriting.js';

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
/** The change undone: two lines become one, which leaves a deleted line alone on its row. */
const UNDONE_DIFF = computeFileDiff({ before: AFTER, after: BEFORE, ignoreWhitespace: false });

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
/**
 * The same class's patch, its first change two deleted lines for one added: a gap at its top, a long and a short one
 * between hunks, and one after the last, whose count the patch doesn't know.
 */
const PATCH_FILE = file('src/sync/outbox.ts', 3, 4, {
    patch: {
        layout: {
            hunks: [
                { beforeStart: 27, afterStart: 27, lines: '   --+   ' },
                { beforeStart: 67, afterStart: 66, lines: '   -+   ' },
                { beforeStart: 82, afterStart: 81, lines: '   -+   ' },
            ],
        },
        verdict: null,
        submodule: null,
    },
});
/** 1,200 lines, changed at 1,100: numbers of four digits. */
const LONG_BEFORE = Array.from({ length: 1200 }, (_, index) => `const kept${index + 1} = ${index + 1};`).join('\n');
const LONG_DIFF = computeFileDiff({
    before: LONG_BEFORE,
    after: LONG_BEFORE.replace('kept1100 = 1100;', 'kept1100 = 0;'),
    ignoreWhitespace: false,
});
const LONG_FILE = file('src/sync/long.ts', 1, 1);
const FILES_URL = 'https://github.com/fitloop/webapp/pull/1202/files';
/** A submodule's pointers before and after. */
const SUBMODULE = {
    path: 'nzyme',
    before: 'a1c9e2f0b7d84c3e9a5f1b2c3d4e5f6a7b8c9d0e',
    after: 'd4f7b21c0e9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c',
};
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

/** A deleted file current: its red count and change on the tint keep AA (D30). */
export const CurrentDeleted: Story = {
    render: () => {
        const deleted = file('src/sync/pending.ts', 0, 18, { changeType: 'DELETED' });
        return renderRows(fileRows(deleted, { kind: 'collapsed' }), { currentPath: deleted.path });
    },
};

/** A file gone from the diff current: its struck name and note on the tint keep AA (D30). */
export const CurrentGone: Story = {
    render: () => {
        const gone = file('src/sync/retry-policy.ts', 0, 0, { gone: { kind: 'notInDiff' }, changeType: 'DELETED' });
        return renderRows(
            [
                {
                    kind: 'header',
                    key: getReviewHeaderKey(gone.path),
                    file: gone,
                    collapsed: false,
                    collapseReason: null,
                    threadsUnder: true,
                    threads: { open: 1, outdated: 0, lineGone: 0, resolved: 0 },
                },
            ],
            { currentPath: gone.path },
        );
    },
};

/** CR88: files on their way in split, a bar for each line where its code will start (D38): a modified file mirrors its context, an added one is on the right alone, a deleted one on the left alone. */
export const PlaceholderSplit: Story = { render: () => renderRows(placeholderRows(), { layout: 'split' }) };

/** CR89: the same files unified, the same lines in one column. */
export const PlaceholderUnified: Story = { render: () => renderRows(placeholderRows(), { layout: 'unified' }) };

/** CR111: a file on its way drawn from its patch, split (D45): its lines' numbers, its changed runs paired as the diff pairs them, tinted, and its gaps, still. */
export const PatchPlaceholderSplit: Story = {
    render: () => renderRows(patchPlaceholderRows('split', false), { layout: 'split' }),
    play: async ({ canvas }) => {
        await expect(canvas.getByText('26 lines above')).toBeVisible();
        await expect(canvas.getByText('32 lines')).toBeVisible();
        await expect(canvas.getByText('8 lines')).toBeVisible();
    },
};

/** CR111: the same, unified. */
export const PatchPlaceholderUnified: Story = {
    render: () => renderRows(patchPlaceholderRows('unified', false), { layout: 'unified' }),
};

/** CR113: with whitespace hidden the same layout, every bar grey: which lines stay changed isn't known yet. */
export const PatchPlaceholderWhitespaceHidden: Story = {
    render: () => renderRows(patchPlaceholderRows('split', true), { layout: 'split' }),
};

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

/**
 * `Review / Thread · replying` (D39, CR92): a thread bare, with its reply box open, with a reply on its way, and resolved
 * bare and with a reply on its way, which stays one line.
 */
export const ThreadReplying: Story = {
    parameters: { rows: threadReplyRows() },
    render: (_args, { parameters }) => ({
        components: { ReviewDiffRow, ReviewWrittenComment },
        setup: () => ({ rows: parameters.rows, githubUrl: FILES_URL, getReplies, getStatus }),
        template: `<div style="width: 1000px">
          <ReviewDiffRow
            v-for="row in rows"
            :key="row.key"
            :row="row"
            :github-url="githubUrl"
            :thread-replies="getReplies(row)"
            :viewer="{ login: 'mlaine', avatarUrl: '' }"
          >
            <template #comment="{ target, inThread }">
              <ReviewWrittenComment
                :target="target"
                :in-thread="inThread"
                repository="fitloop/webapp"
                :item-number="1202"
                text="Agreed."
                :status="getStatus(target)"
                :draft-open="false"
                :draft-count="0"
                :draft-first="false"
                :focused="false"
                reply-to="sofiab"
                :author="{ login: 'mlaine', avatarUrl: '' }"
              />
            </template>
          </ReviewDiffRow>
        </div>`,
    }),
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

/** D43: a file of four-digit line numbers, split, the cursor on line 1100: the number column widens, the buttons after it. */
export const FourDigitsSplit: Story = { render: () => renderLongRows('split') };

/** D43: the same, unified: both number columns widen. */
export const FourDigitsUnified: Story = { render: () => renderLongRows('unified') };

/** CR120, D43: the line cursor on an unchanged line, split: the whole row tinted, a comment button in each half. */
export const CursorSplit: Story = {
    args: { onGutter: fn() },
    render: args =>
        renderCursor(lines('split'), line => line.layout === 'split' && line.left?.kind === 'context', args.onGutter),
};

/** A changed line under the cursor: both halves tinted over their red and green. */
export const CursorSplitChanged: Story = {
    args: { onGutter: fn() },
    render: args =>
        renderCursor(
            lines('split'),
            line => line.layout === 'split' && line.left?.kind === 'deleted' && line.right?.kind === 'added',
            args.onGutter,
        ),
};

/** An added line alone: the empty left half tinted too, its button at the same place, on the added line. */
export const CursorSplitAdded: Story = {
    args: { onGutter: fn() },
    render: args => renderCursor(lines('split'), line => line.layout === 'split' && line.left === null, args.onGutter),
};

/** CR121: a deleted line alone: the empty right half's button on the deleted line, the one C takes. */
export const CursorSplitDeleted: Story = {
    args: { onGutter: fn() },
    render: args =>
        renderCursor(
            lines('split', undefined, UNDONE_DIFF),
            line => line.layout === 'split' && line.right === null,
            args.onGutter,
        ),
};

/** CR123: unified, a deleted line: one button after the numbers, before the sign, on its older number. */
export const CursorUnifiedDeleted: Story = {
    args: { onGutter: fn() },
    render: args =>
        renderCursor(lines('unified'), line => line.layout === 'unified' && line.sign === '-', args.onGutter),
};

/** Unified, an added line under the cursor. */
export const CursorUnifiedAdded: Story = {
    args: { onGutter: fn() },
    render: args =>
        renderCursor(lines('unified'), line => line.layout === 'unified' && line.sign === '+', args.onGutter),
};

/** A line a comment is being written on under the cursor: its own tint, which the cursor's doesn't darken past AA. */
export const CursorCommented: Story = {
    render: () => {
        const rows = fileRows(FILE, { kind: 'lines', rows: lines('split') });
        return renderRows(rows, {
            commented: [{ side: 'after', start: 3, end: 5 }],
            cursorKey: findLineKey(rows, line => line.layout === 'split' && line.right?.line === 4),
        });
    },
};

/** CR126: the cursor on a gap between hunks: the arrow a click and E take lit, the count saying what it shows. */
export const CursorGap: Story = {
    render: () => {
        const rows = fileRows(GAPS_FILE, {
            kind: 'lines',
            rows: buildFileLineRows({ path: GAPS_FILE.path, diff: GAPS_DIFF, layout: 'unified' }),
        });
        return renderRows(rows, {
            cursorKey: rows.find(row => row.kind === 'gap' && row.hidden === 33)?.key,
            towardGap: () => 'up',
        });
    },
    play: async ({ canvas }) => {
        await expect(canvas.getByText('Show 20 above line 67', { exact: true })).toBeVisible();
    },
};

/** CR124: the cursor on a thread: its focused look. */
export const CursorThread: Story = {
    render: () => {
        const thread = { ...createThreadRowSample({ kind: 'onLine', inline: 'right' }), key: 'thread' };
        return renderRows([thread], { cursorKey: thread.key });
    },
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

/** D45: renamed with no lines changed, as its patch says, from the first frame. */
export const RenamedUnchanged: Story = {
    render: () =>
        renderRows(
            fileRows(file('src/sync/queue.ts', 0, 0, { changeType: 'RENAMED', previousPath: 'src/sync/replay.ts' }), {
                kind: 'renamedUnchanged',
            }),
        ),
    play: async ({ canvas }) => {
        await expect(canvas.getByText('Renamed, no changes')).toBeVisible();
        await expect(canvas.getByText('Open on GitHub')).toBeVisible();
    },
};

/** CR65: a binary file its patch says is one, before its blob gives the sizes (D45). */
export const BinaryNoSize: Story = {
    render: () => renderRows(fileRows(FILE, { kind: 'binary', before: null, after: null })),
};

/** A submodule's pointer moved: what lies between its two commits in place of a diff, its history read once it is drawn. */
export const Submodule: Story = {
    decorators: [
        withSubmoduleHistory({
            kind: 'ready',
            repository: 'kedrzu/nzyme',
            relation: { kind: 'ahead', count: 1 },
            commits: [
                { oid: SUBMODULE.after, subject: 'feat(ioc): resolve child containers lazily', author: 'kedrzu' },
            ],
            moreCommits: 0,
            files: [
                {
                    path: 'packages/ioc/src/Container.ts',
                    previousPath: null,
                    status: 'modified',
                    additions: 24,
                    deletions: 9,
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
        }),
    ],
    render: () =>
        renderRows(fileRows(file(SUBMODULE.path, 1, 1), { kind: 'submodule', ...SUBMODULE }), {
            submodule: { nameWithOwner: 'fitloop/webapp', headOid: 'f00dfeed', ...SUBMODULE },
        }),
    play: async ({ canvas }) => {
        await expect(canvas.getByText('1 commit ahead')).toBeVisible();
    },
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

function lines(layout: DiffLayout, syntax?: FileSyntax, diff: FileDiff = DIFF) {
    return buildFileLineRows({ path: FILE.path, diff, layout, syntax });
}

/** {@link LONG_FILE}'s rows, the cursor on its changed line. */
function renderLongRows(layout: DiffLayout) {
    const rows = fileRows(LONG_FILE, {
        kind: 'lines',
        rows: buildFileLineRows({ path: LONG_FILE.path, diff: LONG_DIFF, layout }),
    });
    const changed = (line: DiffSplitRow | DiffUnifiedRow) =>
        line.layout === 'split' ? line.right?.kind === 'added' : line.sign === '+';
    return renderRows(rows, { layout, cursorKey: findLineKey(rows, changed) });
}

/** {@link FILE}'s rows with the line cursor on the first line that matches, its comment buttons reporting. */
function renderCursor(
    lineRows: readonly ReviewRow[],
    match: (line: DiffSplitRow | DiffUnifiedRow) => boolean,
    onGutter: GutterHandler | undefined,
) {
    const rows = fileRows(FILE, { kind: 'lines', rows: lineRows });
    return renderRows(rows, { cursorKey: findLineKey(rows, match), onGutter });
}

/** The key of the first line row that matches. */
function findLineKey(rows: readonly ReviewRow[], match: (line: DiffSplitRow | DiffUnifiedRow) => boolean) {
    return rows.find(row => row.kind === 'line' && match(row.line))?.key;
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

/** {@link PATCH_FILE} on its way, its header first. */
function patchPlaceholderRows(layout: DiffLayout, hideWhitespace: boolean) {
    return fileRows(PATCH_FILE, {
        kind: 'placeholder',
        rows: buildPlaceholderRows({ file: PATCH_FILE, layout, hideWhitespace }),
    });
}

interface RenderRowsOptions {
    readonly commented?: CommentedLines;
    readonly layout?: DiffLayout;
    /** The file whose rows are drawn as the current one (D44). */
    readonly currentPath?: string;
    /** Every row drawn as a pinned header being pushed up. */
    readonly pushed?: boolean;
    /** The change a submodule's row shows. */
    readonly submodule?: ReviewSubmoduleChange;
    /** The row holding the line cursor (D44). */
    readonly cursorKey?: string;
    /** The hunk a click on a gap shows lines toward. */
    readonly towardGap?: () => ReviewGapDirection;
    /** Told what happens to a line's number or a comment button. */
    readonly onGutter?: GutterHandler;
}

type GutterHandler = (event: MouseEvent, side: DiffLineSide, line: number) => void;

function renderRows(
    rows: readonly ReviewRow[],
    { commented, layout, currentPath, pushed, submodule, cursorKey, towardGap, onGutter }: RenderRowsOptions = {},
) {
    return {
        components: { ReviewDiffRow },
        setup: () => ({
            rows,
            githubUrl: FILES_URL,
            commented,
            layout,
            pushed,
            submodule,
            cursorKey,
            towardGap,
            isCurrent,
            onGutter,
        }),
        template: `<div style="width: 1000px"><ReviewDiffRow v-for="row in rows" :key="row.key" :row="row" :github-url="githubUrl" :commented="commented" :layout="layout" :pushed="pushed" :current="isCurrent(row)" :cursor="row.key === cursorKey" :toward-gap="towardGap" :submodule="row.kind === 'submodule' ? submodule : null" @gutter="onGutter" /></div>`,
    };

    function isCurrent(row: ReviewRow) {
        return getReviewRowPath(row.key) === currentPath;
    }
}

function file(path: string, additions: number, deletions: number, more: Partial<ReviewFile> = {}): ReviewFile {
    return { path, previousPath: null, changeType: 'MODIFIED', additions, deletions, viewed: 'UNVIEWED', ...more };
}

/** {@link ThreadReplying}'s rows, by key: `bare`, `replying`, `sent`, `resolved`, `resolvedSent`. */
function threadReplyRows(): ReviewThreadRow[] {
    const open = createThreadRowSample({ kind: 'onLine', inline: 'right' });
    const resolved = createThreadRowSample({
        kind: 'onLine',
        inline: 'right',
        thread: sampleThread({ isResolved: true }),
    });
    const reply: ReviewCommentTarget = {
        id: 'reply',
        path: FILE.path,
        side: 'after',
        line: 47,
        startLine: null,
        threadId: open.placement.thread.id,
    };
    const sent: ReviewCommentTarget = { ...reply, id: 'sent' };
    return [
        { ...open, key: 'bare' },
        { ...open, key: 'replying', replies: [reply] },
        { ...open, key: 'sent', replies: [sent] },
        { ...resolved, key: 'resolved' },
        { ...resolved, key: 'resolvedSent', replies: [sent] },
    ];
}

/** As the review splits them: the box, and the replies on their way. */
function getReplies(row: ReviewRow) {
    if (row.kind !== 'thread') {
        return null;
    }

    return {
        sent: row.replies.filter(reply => reply.id === 'sent'),
        box: row.replies.find(reply => reply.id !== 'sent') ?? null,
    };
}

function getStatus(target: ReviewCommentTarget): ReviewCommentStatus {
    return target.id === 'sent'
        ? { kind: 'sending', way: 'single', body: 'Agreed, migrating it now instead of clearing the store.' }
        : { kind: 'editing' };
}
