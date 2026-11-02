import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn, userEvent, within } from 'storybook/test';
import { defineComponent, ref, shallowRef } from 'vue';

import SavingChoice from '@/settings/SavingChoice.vue';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import {
    EMPTY_CANDIDATES,
    SAMPLE_CANDIDATES,
    SAMPLE_OWN_CHOICE,
    SAMPLE_SETTINGS_CANDIDATES,
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
        onSave: fn(),
        onDiscard: fn(),
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

/** What Settings' sample tracks: its ticks before any change. */
const TRACKED_TICKS = {
    repositories: SAMPLE_TRACKED.repositories.map(entry => entry.nameWithOwner),
    projects: SAMPLE_TRACKED.projects.map(entry => entry.id),
};

/**
 * G8: Settings' form — what is tracked, ticked, with how each stands (synced, downloading, not shown, refused); one
 * staged untrack (kedrzu/blog) and one staged track (skyline-labs/mobile), said on their rows and in the bar at the
 * bottom; acme-health hiding its private repositories; what GitHub's lists don't hold under its owner or "Elsewhere".
 */
export const Settings: Story = {
    args: {
        candidates: SAMPLE_SETTINGS_CANDIDATES,
        tracked: SAMPLE_TRACKED,
        repositories: [...TRACKED_TICKS.repositories.filter(name => name !== 'kedrzu/blog'), 'skyline-labs/mobile'],
        projects: TRACKED_TICKS.projects,
    },
    render: args => renderSettings(args),
};

/** T1: Settings searching "web" — every owner narrowed, tracked and untracked alike. */
export const SettingsSearching: Story = {
    args: { ...Settings.args, initialSearch: 'web', ...TRACKED_TICKS },
    render: args => renderSettings(args),
};

/** Settings while what the user and their organisations have is read: what is tracked shows at once, by owner. */
export const SettingsReading: Story = {
    args: { ...Settings.args, candidates: null, reading: true, ...TRACKED_TICKS },
    render: args => renderSettings(args),
};

/**
 * Settings' form with its own ticks: "Discard" puts them back to what is tracked, as the section does, and the next page
 * of an organisation asked for arrives at once — the rest of skyline-labs, with `skyline-labs/legacy-billing`.
 */
function renderSettings({ onDiscard, onLoadMore, ...args }: ChooserArgs) {
    return defineComponent({
        setup() {
            const repositories = ref(args.repositories);
            const projects = ref(args.projects);
            const candidates = shallowRef(args.candidates);
            function discard() {
                repositories.value = TRACKED_TICKS.repositories;
                projects.value = TRACKED_TICKS.projects;
                onDiscard?.();
            }

            function loadMore(owner: string) {
                onLoadMore?.(owner);
                candidates.value = candidates.value && readNextPage(candidates.value, owner);
            }

            return () => (
                <div style={{ height: '100vh', overflowY: 'auto' }}>
                    <TrackingChooser
                        {...args}
                        candidates={candidates.value}
                        repositories={repositories.value}
                        projects={projects.value}
                        onUpdate:repositories={value => (repositories.value = value)}
                        onUpdate:projects={value => (projects.value = value)}
                        onDiscard={discard}
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
