import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';

import { StoryPage } from '@/.storybook/StoryLayout.jsx';
import Button from '@/components/Button.vue';

import CommitEmailMenu from './CommitEmailMenu.vue';
import type { ResolvedCommitEmail } from './resolveCommitEmail.js';

const EMAILS = ['michal@acme-corp.com', 'michal@kedrzu.dev', '12345+kedrzu@users.noreply.github.com'];

/** What a story changes of the menu. */
interface MenuStoryArgs {
    readonly resolved: ResolvedCommitEmail | null;
    readonly rememberable: boolean;
}

const meta: Meta<MenuStoryArgs> = {
    args: { resolved: { email: 'michal@acme-corp.com', source: 'owner' }, rememberable: true },
    render: args =>
        defineComponent({
            setup() {
                const open = ref(true);
                const current = ref(args.resolved?.email ?? 'michal@kedrzu.dev');
                const picked = ref('Nothing picked');

                return () => (
                    <StoryPage>
                        <div style={{ paddingTop: '220px' }}>
                            <CommitEmailMenu
                                open={open.value}
                                onUpdate:open={value => (open.value = value)}
                                emails={EMAILS}
                                current={current.value}
                                githubDefault="michal@kedrzu.dev"
                                resolved={args.resolved}
                                owner="acme-corp"
                                rememberable={args.rememberable}
                                onPick={(email, remember) => {
                                    current.value = email;
                                    picked.value = `${email}${remember ? ', remembered' : ''}`;
                                }}
                            >
                                {{
                                    trigger: () => (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                        >
                                            {current.value}
                                        </Button>
                                    ),
                                }}
                            </CommitEmailMenu>
                            <p data-testid="picked">{picked.value}</p>
                        </div>
                    </StoryPage>
                );
            },
        }),
};

export default meta;

type Story = StoryObj<MenuStoryArgs>;

/** PM48: on the owner's default, marked so and ticked; GitHub's default with its mark; "Remember" off. */
export const OwnerDefault: Story = {};

/** On GitHub's own default: no address carries a source but "GitHub default". */
export const GitHubDefault: Story = { args: { resolved: { email: 'michal@kedrzu.dev', source: 'github' } } };

/** An untracked repository: nothing to remember the pick for. */
export const Untracked: Story = { args: { rememberable: false } };
