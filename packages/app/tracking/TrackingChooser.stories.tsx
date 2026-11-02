import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn, userEvent, within } from 'storybook/test';
import { defineComponent, ref, shallowRef } from 'vue';

import SavingChoice from '@/settings/SavingChoice.vue';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import {
    EMPTY_CANDIDATES,
    SAMPLE_CANDIDATES,
    SAMPLE_OWN_CHOICE,
    SAMPLE_PICKER_CANDIDATES,
    SAMPLE_TRACKED,
    sampleCandidateRepository,
} from '@/testing/sampleTracking.js';

import TrackingChooser from './TrackingChooser.vue';
import type { TrackingCandidates } from './TrackingTypes.js';

/** The chooser's props, as a story passes them. */
type ChooserArgs = InstanceType<typeof TrackingChooser>['$props'];

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
    render: args => renderChooser(args, false),
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

/** G2's saving choice, ticked (G12): "Track these" then creates the settings repository. */
export const SavingTicked: Story = {
    args: { creates: 'mlaine/githq-settings' },
    render: args => renderChooser(args, true),
};

/** G10 with the saving choice above "Continue to My work". */
export const NothingToPickWithSaving: Story = {
    args: { candidates: EMPTY_CANDIDATES, repositories: [], projects: [] },
    render: args => renderChooser(args, true),
};

/**
 * T18: the picker — the user's twelve all tracked, folded to their header; skyline-labs with what is tracked and two
 * picked in sight, no projects, no heading, no footer (its dialog has one).
 */
export const Picker: Story = {
    args: {
        candidates: SAMPLE_PICKER_CANDIDATES,
        tracked: SAMPLE_TRACKED,
        repositories: ['skyline-labs/mobile', 'skyline-labs/payments'],
        projects: [],
    },
    render: args => renderPicker(args),
};

/** T1: the picker searching "web" — every owner narrowed, tracked and untracked alike. */
export const PickerSearching: Story = {
    args: { ...Picker.args, filter: 'web', repositories: [] },
    render: args => renderPicker(args),
};

/** The picker while what the user and their organisations have is read. */
export const PickerReading: Story = {
    args: { ...Picker.args, candidates: null, reading: true, repositories: [] },
    render: args => renderPicker(args),
};

/** The picker after reading that failed: a repository can still be looked up by name. */
export const PickerNotRead: Story = {
    args: { ...Picker.args, candidates: null, reading: false, repositories: [] },
    render: args => renderPicker(args),
};

/**
 * The picker with its own picks and filter, as its dialog keeps them; the next page of an organisation asked for arrives
 * at once — the rest of skyline-labs, with `skyline-labs/legacy-billing`.
 */
function renderPicker({ onLoadMore, ...args }: ChooserArgs) {
    return defineComponent({
        setup() {
            const repositories = ref(args.repositories);
            const filter = ref(args.filter ?? '');
            const candidates = shallowRef(args.candidates);
            function loadMore(owner: string) {
                onLoadMore?.(owner);
                candidates.value = candidates.value && readNextPage(candidates.value, owner);
            }

            return () => (
                <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <TrackingChooser
                        {...args}
                        candidates={candidates.value}
                        repositories={repositories.value}
                        filter={filter.value}
                        onUpdate:repositories={value => (repositories.value = value)}
                        onUpdate:filter={value => (filter.value = value)}
                        onLoadMore={loadMore}
                    />
                </div>
            );
        },
    });
}

/** The candidates with the owner's last page read: one more repository, nothing left to read. */
function readNextPage(candidates: TrackingCandidates, owner: string): TrackingCandidates {
    return {
        ...candidates,
        organizations: candidates.organizations.map(organization =>
            organization.login === owner && organization.repositories?.nextCursor != null
                ? {
                      ...organization,
                      repositories: {
                          ...organization.repositories,
                          repositories: [
                              ...organization.repositories.repositories,
                              sampleCandidateRepository(`${owner}/legacy-billing`, {
                                  ago: 400 * 86_400_000,
                                  open: 3,
                                  isPrivate: true,
                              }),
                          ],
                          nextCursor: null,
                      },
                  }
                : organization,
        ),
    };
}

/** The chooser with its own choice; with `saving`, the saving choice in its band, ticked as `creates` says. */
function renderChooser(args: ChooserArgs, saving: boolean) {
    return defineComponent({
        setup() {
            const repositories = ref(args.repositories);
            const projects = ref(args.projects);
            const save = ref(Boolean(args.creates));
            const savingChoice = () => (
                <SavingChoice
                    modelValue={save.value}
                    onUpdate:modelValue={value => (save.value = value)}
                />
            );
            return () => (
                <div style={{ height: '100vh', overflowY: 'auto' }}>
                    <TrackingChooser
                        {...args}
                        repositories={repositories.value}
                        projects={projects.value}
                        onUpdate:repositories={value => (repositories.value = value)}
                        onUpdate:projects={value => (projects.value = value)}
                        v-slots={saving ? { saving: () => savingChoice() } : {}}
                    />
                </div>
            );
        },
    });
}
