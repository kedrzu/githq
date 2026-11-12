import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { createThreadRowSample, sampleThread } from '@/testing/sampleThreads.js';
import ReviewWrittenComment from '../writing/ReviewWrittenComment.vue';
import type { ReviewCommentStatus, ReviewCommentTarget } from '../writing/ReviewWriting.js';
import ReviewThreadRow from './ReviewThreadRow.vue';

const HUNK = '@@ -212,3 +212,3 @@ export interface WorkoutPatch {\n title?: string\n-notes?: string\n+note?: string';
const COMMIT = { oid: 'a91d03b0', abbreviatedOid: 'a91d03b' };
const VIEWER = { login: 'mlaine', avatarUrl: '' };
const REPLY: ReviewCommentTarget = {
    id: 'reply',
    path: 'src/sync/engine.ts',
    side: 'after',
    line: 47,
    startLine: null,
    threadId: 'T_1',
};

const meta = {
    component: ReviewThreadRow,
    args: {
        row: createThreadRowSample({ kind: 'onLine', inline: 'right' }),
        onToggle: fn(),
    },
    render: args => ({
        components: { ReviewThreadRow },
        setup: () => ({ args }),
        template: `<div style="width: 1000px"><ReviewThreadRow v-bind="args" /></div>`,
    }),
} satisfies Meta<typeof ReviewThreadRow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The thread with its reply slot drawn as the review draws it: the box while written, the comment once sent. */
const renderWithReply: NonNullable<Story['render']> = args => {
    return {
        components: { ReviewThreadRow, ReviewWrittenComment },
        setup: () => ({ args, viewer: VIEWER, getStatus }),
        template: `<div style="width: 1000px">
          <ReviewThreadRow v-bind="args">
            <template #reply="{ target }">
              <ReviewWrittenComment
                :target="target"
                in-thread
                repository="fitloop/webapp"
                :item-number="1202"
                text=""
                :status="getStatus(target)"
                :draft-open="false"
                :draft-count="0"
                :draft-first="false"
                :focused="false"
                reply-to="sofiab"
                :author="viewer"
              />
            </template>
          </ReviewThreadRow>
        </div>`,
    };

    function getStatus(target: ReviewCommentTarget): ReviewCommentStatus {
        return args.replies?.box?.id === target.id
            ? { kind: 'editing' }
            : { kind: 'sending', way: 'single', body: 'Agreed, migrating it.' };
    }
};

/** CR2: under its line, on the right half in split, the comments' HTML as GitHub gave it, its links opening outside. */
export const OnRightHalf: Story = {
    play: async ({ canvas }) => {
        const link = canvas.getByRole('link', { name: 'the docs' });
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(canvas.getAllByRole('link', { name: /open on.GitHub/u })[0]).toHaveAttribute(
            'href',
            'https://github.com/fitloop/webapp/pull/1202#discussion_r1',
        );
    },
};

/** On a deleted line: the left half. */
export const OnLeftHalf: Story = { args: { row: createThreadRowSample({ kind: 'onLine', inline: 'left' }) } };

/** CR3: unified, indented to the code. */
export const Unified: Story = { args: { row: createThreadRowSample({ kind: 'onLine', inline: 'unified' }) } };

/** `Review / Comment · pending`: still in the reader's draft. */
export const PendingComment: Story = {
    args: {
        row: createThreadRowSample({
            kind: 'onLine',
            inline: 'right',
            thread: {
                ...sampleThread(),
                comments: sampleThread().comments.map((comment, index) =>
                    index === 1 ? { ...comment, state: 'PENDING' as const } : comment,
                ),
            },
        }),
    },
    play: async ({ canvas }) => {
        await expect(canvas.getAllByText('Pending · in your draft')).toHaveLength(1);
    },
};

/** A line not found in a file the pull request deletes: there's no "file now" for it to be missing from. */
export const LineGoneFromDeletedFile: Story = {
    args: {
        row: createThreadRowSample({
            kind: 'fileTop',
            diffHunk: HUNK,
            commit: COMMIT,
            fileDeleted: true,
            thread: sampleThread({ isOutdated: true }),
        }),
    },
    play: async ({ canvas }) => {
        await expect(canvas.getByText(/the pull request deletes this file/u)).toBeInTheDocument();
    },
};

/** `· focused`: where N and ⇧N are (CR15). */
export const Focused: Story = { args: { focused: true } };

/** CR2: outdated, found again: the head says the place is approximate. */
export const OutdatedFound: Story = {
    args: {
        row: createThreadRowSample({
            kind: 'onLine',
            inline: 'right',
            approximate: true,
            thread: sampleThread({ isOutdated: true }),
        }),
    },
    play: async ({ canvas }) => {
        await expect(canvas.getByText(/so the place is approximate/u)).toBeInTheDocument();
    },
};

/** CR12: a collapsed file not loaded says so, by the code. */
export const InCollapsedNotLoaded: Story = {
    args: { row: createThreadRowSample({ kind: 'inCollapsed', diffHunk: HUNK, notLoaded: true }) },
    play: async ({ canvas }) => {
        await expect(canvas.getByText(/the file isn't loaded while collapsed/u)).toBeInTheDocument();
    },
};

/** `· resolved`: one line, whatever else it is. */
export const Resolved: Story = {
    args: {
        row: createThreadRowSample({
            kind: 'fileTop',
            diffHunk: HUNK,
            thread: sampleThread({ isResolved: true, isOutdated: true }),
        }),
    },
    play: async ({ args, canvas }) => {
        await expect(canvas.queryByRole('figure')).not.toBeInTheDocument();
        await userEvent.click(canvas.getByRole('button', { name: /Resolved/u }));
        await expect(args.onToggle).toHaveBeenCalled();
    },
};

/** A resolved thread opened from its line. */
export const ResolvedOpen: Story = {
    args: {
        open: true,
        row: createThreadRowSample({ kind: 'onLine', inline: 'right', thread: sampleThread({ isResolved: true }) }),
    },
};

/** CR10: outdated, its line gone: a box above the first change with the old code and the commit. */
export const FileTopLineGone: Story = {
    args: {
        row: createThreadRowSample({
            kind: 'fileTop',
            diffHunk: HUNK,
            commit: COMMIT,
            thread: sampleThread({ isOutdated: true }),
        }),
    },
    play: async ({ canvas }) => {
        await expect(canvas.getByText('The code it was written on, at a91d03b')).toBeInTheDocument();
    },
};

/** A thread on the file itself: GitHub gives it no code, and none is drawn. */
export const FileThread: Story = {
    args: {
        row: createThreadRowSample({ kind: 'fileTop', diffHunk: '', thread: sampleThread({ subjectType: 'FILE' }) }),
    },
    play: async ({ canvas }) => {
        await expect(canvas.queryByRole('figure')).not.toBeInTheDocument();
    },
};

/** CR12: under a collapsed file's header, with the code as it was. */
export const InCollapsed: Story = {
    args: { row: createThreadRowSample({ kind: 'inCollapsed', diffHunk: HUNK }) },
    play: async ({ canvas }) => {
        await expect(canvas.getByText('Line 213, as it was when commented')).toBeInTheDocument();
    },
};

/** CR14: in a gone file's block, with the code and the commit. */
export const Gone: Story = { args: { row: createThreadRowSample({ kind: 'gone', diffHunk: HUNK }) } };

/** CR74: what can be done with it: the field and Resolve. */
export const WithActions: Story = {
    args: { onReply: fn(), onSetResolved: fn() },
    play: async ({ args, canvas }) => {
        await userEvent.click(canvas.getByRole('button', { name: 'Reply…' }));
        await expect(args.onReply).toHaveBeenCalledOnce();
        await userEvent.click(canvas.getByRole('button', { name: 'Resolve' }));
        await expect(args.onSetResolved).toHaveBeenCalledWith(true);
    },
};

/** Focused, `R` is its key, and only then. */
export const FocusedWithKey: Story = {
    args: { focused: true },
    play: async ({ canvas }) => {
        await expect(canvas.getByRole('button', { name: /Reply…/ })).toHaveAttribute('aria-keyshortcuts', 'R');
    },
};

/** `Review / Thread · replying` (D39): the box inside the thread, in a band with the viewer's avatar; Resolve thread under it. */
export const Replying: Story = {
    args: { replies: { sent: [], box: REPLY }, viewer: VIEWER, onSetResolved: fn() },
    render: renderWithReply,
    play: async ({ args, canvas }) => {
        const thread = canvas.getByRole('group', { name: /^Thread by/u });
        const box = await canvas.findByRole('group', { name: /^Reply.to.sofiab$/u });
        await expect(canvas.queryByRole('button', { name: 'Reply…' })).toBeNull();
        await expect(thread).toContainElement(box);
        await userEvent.click(canvas.getByRole('button', { name: /^Resolve.thread$/u }));
        await expect(args.onSetResolved).toHaveBeenCalledWith(true);
    },
};

/** A reply on its way: the last of the thread's comments, and Reply… is back. */
export const ReplySent: Story = {
    args: { replies: { sent: [REPLY], box: null }, viewer: VIEWER },
    render: renderWithReply,
    play: async ({ canvas }) => {
        await expect(canvas.getByText('Agreed, migrating it.')).toBeVisible();
        await expect(canvas.getByRole('button', { name: 'Reply…' })).toBeVisible();
    },
};

/** Not for this viewer: nothing offered that GitHub would refuse. */
export const NothingAllowed: Story = {
    args: {
        row: createThreadRowSample({
            kind: 'onLine',
            inline: 'right',
            thread: sampleThread({ viewerCanReply: false, viewerCanResolve: false }),
        }),
    },
    play: async ({ canvas }) => {
        await expect(canvas.queryByRole('button', { name: 'Reply…' })).toBeNull();
        await expect(canvas.queryByRole('button', { name: 'Resolve' })).toBeNull();
    },
};

/** Opened, a resolved one can be opened again. */
export const ResolvedOpened: Story = {
    args: {
        open: true,
        onSetResolved: fn(),
        row: createThreadRowSample({ kind: 'onLine', inline: 'right', thread: sampleThread({ isResolved: true }) }),
    },
    play: async ({ args, canvas }) => {
        await userEvent.click(canvas.getByRole('button', { name: 'Unresolve' }));
        await expect(args.onSetResolved).toHaveBeenCalledWith(false);
    },
};

/** GitHub refused: back as it was, saying so where it happened. */
export const ResolveRefused: Story = {
    args: { resolveFailure: { kind: 'refused', message: 'Must have write access' } },
    play: async ({ canvas }) => {
        await expect(canvas.getByRole('alert')).toHaveTextContent("Couldn't resolve it: Must have write access");
    },
};

/** CR36: a reply in a thread holding a pending comment says where it goes. */
export const ReplyToDraft: Story = {
    args: {
        onSetResolved: fn(),
        onReply: fn(),
        row: createThreadRowSample({
            kind: 'onLine',
            inline: 'right',
            thread: sampleThread({
                comments: sampleThread().comments.map(comment => ({ ...comment, state: 'PENDING' })),
            }),
        }),
    },
    play: async ({ canvas }) => {
        await expect(canvas.getByRole('button', { name: /Add.to.your.draft…/u })).toBeVisible();
    },
};

/** Refused with no words of GitHub's: the reason is the app's. */
export const ResolveRefusedWithoutWords: Story = {
    args: { resolveFailure: { kind: 'refused', message: null } },
    play: async ({ canvas }) => {
        await expect(canvas.getByRole('alert')).toHaveTextContent('GitHub gave no reason.');
    },
};
