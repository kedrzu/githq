import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, waitFor } from 'storybook/test';

import type { EditRequest } from '@/edits/EditTypes.js';
import { REVIEW_VIEWER } from '@/testing/sampleReviews.js';
import { sampleThread } from '@/testing/sampleThreads.js';
import { useSampleReviewCommentActions } from '@/testing/useSampleReviewCommentActions.js';
import { withReadingCursor } from '@/testing/withReadingCursor.js';

import ReviewComment from './ReviewComment.vue';

/** As wide as a thread under its line in split. */
const WIDTH = 584;

const COMMENT = sampleThread().comments[0]!;
/** What Edit saves, and the edit on its way. */
const EDITED = 'What happens when the same workout is edited twice offline?';

/** The edits saved, by the stories that save one. */
const onEdit = fn<(request: EditRequest) => void>();

const meta = {
    component: ReviewComment,
    args: {
        commentId: COMMENT.id,
        author: COMMENT.author,
        createdAt: COMMENT.createdAt,
        url: COMMENT.url,
        html: COMMENT.bodyHTML,
        body: COMMENT.body,
    },
    // On a thread's page colour, with the view's comment actions (`parameters.menu`), an edit open (`parameters.editing`)
    // or an edit on its way (`parameters.edit`).
    render: (args, { parameters }) => ({
        components: { ReviewComment },
        setup() {
            const commentActions = parameters.menu
                ? useSampleReviewCommentActions({
                      edits: parameters.edit ? { [COMMENT.id]: parameters.edit } : {},
                      onEdit,
                  })
                : null;
            if (parameters.editing) {
                commentActions?.actions.startEdit(COMMENT.id, COMMENT.body);
            }

            return { args, commentActions };
        },
        template: `
          <div style="width: ${WIDTH}px; background: #0d1117" data-testid="frame">
            <ReviewComment v-bind="args" :actions="commentActions" />
          </div>`,
    }),
} satisfies Meta<typeof ReviewComment>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Review / Comment`: who, how long ago linking to GitHub, and what it says in the card text colour. No ⋯ without actions. */
export const Comment: Story = {};

/** Changed since: "· edited". */
export const Edited: Story = { args: { edited: true } };

/** `· pending`: still in the viewer's draft. */
export const Pending: Story = { args: { inDraft: true } };

/** A reply on its way: as typed, dimmed, "Sending…", no link to GitHub yet. */
export const Sending: Story = {
    args: { author: REVIEW_VIEWER, url: undefined, html: undefined, text: EDITED, sending: true },
};

/** With the view's actions, the viewer's own: the ⋯ there, out of sight until hovered (`· hovered`). */
export const WithMenu: Story = {
    args: { canEdit: true, canDelete: true },
    parameters: { menu: true },
};

/** `· editing`: the editor in place under the header row; Update saves the edit through the view. */
export const Editing: Story = {
    args: { canEdit: true, canDelete: true, edited: true },
    parameters: { menu: true, editing: true },
    play: async ({ canvas }) => {
        onEdit.mockClear();
        const editor = await canvas.findByRole('textbox', { name: 'Edit comment' });
        await userEvent.clear(editor);
        await userEvent.type(editor, EDITED);
        await userEvent.click(canvas.getByRole('button', { name: /^Update comment/u }));
        await waitFor(() =>
            expect(onEdit).toHaveBeenCalledWith({ kind: 'editComment', commentId: COMMENT.id, body: EDITED }),
        );
        await expect(canvas.queryByRole('textbox', { name: 'Edit comment' })).toBeNull();
    },
};

/** Its edit on its way: the new text dimmed, "Sending…", no ⋯ — GitHub has nothing to act on yet. */
export const EditSending: Story = {
    args: { canEdit: true, canDelete: true },
    parameters: { menu: true, edit: EDITED },
};

/** Code review's cursor on it: tinted over its whole box, and its menu shows Edit's and Quote reply's keys. */
export const Current: Story = {
    args: { canEdit: true, canDelete: true, canQuote: true, current: true },
    parameters: { menu: true },
};

/** On a pull request's page, under its reading cursor: not `current`, yet its menu shows the keys there too. */
export const UnderReadingCursor: Story = {
    args: { canEdit: true, canDelete: true, canQuote: true },
    parameters: { menu: true },
    decorators: [withReadingCursor(COMMENT.id)],
};
