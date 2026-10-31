import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { CircleCheck, CircleDot, CircleSlash, GitMerge, GitPullRequest, GitPullRequestDraft } from 'lucide-vue-next';

import { StoryPage, StoryRow } from '@/.storybook/StoryLayout.jsx';

import StatePill from './StatePill.vue';

const meta: Meta<typeof StatePill> = {
    component: StatePill,
};

export default meta;

type Story = StoryObj<typeof StatePill>;

/** Every state of an issue and a pull request. */
export const Gallery: Story = {
    render: () => (
        <StoryPage>
            <StoryRow>
                <StatePill icon={CircleDot}>Open</StatePill>
                <StatePill
                    icon={CircleCheck}
                    tone="done"
                >
                    Closed
                </StatePill>
                <StatePill
                    icon={CircleSlash}
                    tone="draft"
                >
                    Not planned
                </StatePill>
            </StoryRow>
            <StoryRow>
                <StatePill icon={GitPullRequest}>Open</StatePill>
                <StatePill
                    icon={GitPullRequestDraft}
                    tone="draft"
                >
                    Draft
                </StatePill>
                <StatePill
                    icon={GitMerge}
                    tone="done"
                >
                    Merged
                </StatePill>
                <StatePill
                    icon={GitPullRequest}
                    tone="closed"
                >
                    Closed
                </StatePill>
            </StoryRow>
        </StoryPage>
    ),
};
