import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn, userEvent, within } from 'storybook/test';
import { defineComponent, ref } from 'vue';

import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { EMPTY_CANDIDATES, SAMPLE_CANDIDATES, SAMPLE_OWN_CHOICE } from '@/testing/sampleTracking.js';

import TrackingChooser from './TrackingChooser.vue';

const meta = {
    component: TrackingChooser,
    args: {
        candidates: SAMPLE_CANDIDATES,
        now: SAMPLE_NOW,
        found: [],
        approvals: {},
        find: fn(() => Promise.resolve(null)),
        repositories: [...SAMPLE_OWN_CHOICE.repositories, 'skyline-labs/portal', 'skyline-labs/api'],
        projects: SAMPLE_OWN_CHOICE.projects,
        onTrack: fn(),
        onOnlyMine: fn(),
        onLoadMore: fn(),
        onRequestApproval: fn(),
        onFound: fn(),
    },
    // The choice is the story's own, so its checkboxes work; as tall as the window, scrolling like the page.
    render: args =>
        defineComponent({
            setup() {
                const repositories = ref(args.repositories);
                const projects = ref(args.projects);
                return () => (
                    <div style={{ height: '100vh', overflowY: 'auto' }}>
                        <TrackingChooser
                            {...args}
                            repositories={repositories.value}
                            projects={projects.value}
                            onUpdate:repositories={value => (repositories.value = value)}
                            onUpdate:projects={value => (projects.value = value)}
                        />
                    </div>
                );
            },
        }),
} satisfies Meta<typeof TrackingChooser>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * G2: the user's own repositories chosen, two of skyline-labs's too; the long groups folded; acme-health says it
 * hides its private repositories; the projects beside.
 */
export const Choose: Story = {};

/** G4: an organisation with 312 repositories, picked on the left and filtered by typing — the rest read as needed. */
export const LargeOrganisation: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.click(canvas.getByRole('radio', { name: /^skyline-labs/ }));
        await userEvent.type(canvas.getByRole('textbox', { name: 'Filter repositories' }), 'pay');
    },
};

/** G5: the organisation hiding its private repositories, picked: why, how it gets fixed, and its public ones. */
export const HiddenOrganisation: Story = {
    play: async ({ canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole('radio', { name: /^acme-health/ }));
    },
};

/** G10: nothing to pick; someone else's repository or project can be tracked by name. */
export const NothingToPick: Story = {
    args: { candidates: EMPTY_CANDIDATES, repositories: [], projects: [] },
};
