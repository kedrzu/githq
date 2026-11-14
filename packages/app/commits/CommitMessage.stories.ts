import type { Meta, StoryObj } from '@storybook/vue3-vite';

import CommitMessage from './CommitMessage.vue';

const meta = {
    component: CommitMessage,
} satisfies Meta<typeof CommitMessage>;

export default meta;

type Story = StoryObj<typeof CommitMessage>;

/** Paragraphs, a wrapped bullet list and trailers, with `#566` and `**x**` left as typed. */
export const Formatted: Story = {
    args: {
        body: [
            'Fold branches and tags into folders by their slashes, so #566 stays readable.',
            'Nothing is **interpreted** here.',
            '',
            '* Nest `feat/a` and `feat/b` under `feat`, and keep the folder open when its',
            'repository is revisited',
            '* Show more per folder',
            '',
            'Co-Authored-By: Ann <ann@example.com>',
            'Signed-off-by: Bob <bob@example.com>',
        ].join('\n'),
    },
};

export const Plain: Story = {
    args: { body: 'A single line of explanation.' },
};
