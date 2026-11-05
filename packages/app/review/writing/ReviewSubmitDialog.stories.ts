import type { Meta, StoryObj } from '@storybook/vue3-vite';

import ReviewSubmitDialog from './ReviewSubmitDialog.vue';

const COMMENTS = [
    {
        id: '1',
        where: 'engine.ts:48',
        excerpt: 'If ack throws after a partial send, the next flush sends those items again…',
    },
    {
        id: '2',
        where: 'engine.ts:50',
        excerpt: 'scheduleRetry needs a ceiling, or a dead token retries every 2 s forever.',
    },
    { id: '3', where: 'queue.ts:61', excerpt: 'MAX_ATTEMPTS = 8 reads arbitrary. Where does 8 come from?' },
];

const meta = {
    component: ReviewSubmitDialog,
    args: {
        open: true,
        number: 1202,
        commentCount: 3,
        comments: COMMENTS,
        choice: { event: 'COMMENT', body: '' },
    },
} satisfies Meta<typeof ReviewSubmitDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR75: a comment by default. */
export const Comment: Story = {};

/** The button takes the choice's name and colour. */
export const Approve: Story = { args: { choice: { event: 'APPROVE', body: 'Reads well.' } } };

export const RequestChanges: Story = { args: { choice: { event: 'REQUEST_CHANGES', body: 'See the retry.' } } };

/** The threads not read yet: only the count is known. */
export const CommentsNotRead: Story = { args: { comments: [] } };

/** No draft, nothing written: a comment needs its text, and the button says so. */
export const NoDraftComment: Story = { args: { commentCount: 0, comments: [] } };

/** No draft, nothing written: so do requested changes. */
export const NoDraftRequestChanges: Story = {
    args: { commentCount: 0, comments: [], choice: { event: 'REQUEST_CHANGES', body: '' } },
};

/** No draft: an approval needs no text. */
export const NoDraftApprove: Story = {
    args: { commentCount: 0, comments: [], choice: { event: 'APPROVE', body: '' } },
};

/** No draft, the text written: it can go. */
export const NoDraftCommentWritten: Story = {
    args: { commentCount: 0, comments: [], choice: { event: 'COMMENT', body: 'Fine by me.' } },
};
