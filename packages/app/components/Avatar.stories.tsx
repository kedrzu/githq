import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { StoryPage, StoryRow } from '@/.storybook/StoryLayout.jsx';

import Avatar from './Avatar.vue';

const meta: Meta<typeof Avatar> = {
    component: Avatar,
};

export default meta;

type Story = StoryObj<typeof Avatar>;

// Inline, so the story needs no network: a picture that loads, and one that never does.
const PICTURE =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"%3E%3Crect width="8" height="8" fill="%23d6a23a"/%3E%3Ccircle cx="4" cy="3" r="2" fill="%230e1013"/%3E%3C/svg%3E';
const BROKEN = 'data:image/png;base64,broken';

/** Sizes, with a picture and with the initials it falls back to. */
export const Gallery: Story = {
    render: () => (
        <StoryPage>
            <StoryRow>
                <Avatar
                    name="kedrzu"
                    src={PICTURE}
                    size="xs"
                />
                <Avatar
                    name="kedrzu"
                    src={PICTURE}
                />
                <Avatar
                    name="kedrzu"
                    src={PICTURE}
                    size="md"
                />
                <Avatar
                    name="olam"
                    src={BROKEN}
                    size="xs"
                />
                <Avatar name="phowak" />
                <Avatar
                    name="skyline-labs"
                    size="md"
                />
            </StoryRow>
        </StoryPage>
    ),
};
