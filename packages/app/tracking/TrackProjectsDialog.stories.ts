import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { userEvent, within } from 'storybook/test';
import { defineComponent, h, ref } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { answerTrackingCandidates } from '@/testing/answerTrackingCandidates.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { TrackingStore } from './TrackingStore.js';
import type { TrackedProject } from './TrackingTypes.js';
import TrackProjectsDialog from './TrackProjectsDialog.vue';

/** What T22 tracks. */
const TRACKED: TrackedProject[] = [
    { id: 'PVT_mlaine_1', owner: 'mlaine', ownerKind: 'user', number: 1, title: 'tasklet Roadmap' },
    { id: 'PVT_fitloop_12', owner: 'fitloop', ownerKind: 'org', number: 12, title: 'Platform Q4' },
    { id: 'PVT_fitloop_9', owner: 'fitloop', ownerKind: 'org', number: 9, title: 'Docs revamp' },
];

const meta = {
    component: TrackProjectsDialog,
    // Over a real tracking store, GitHub answering what T22 shows.
    render: () =>
        defineComponent({
            setup() {
                const container = createContainer();
                container.set(LanguageContext, () => APP_LANGUAGE);
                container.set(
                    Browser,
                    createSignedInBrowser(
                        answerTrackingCandidates({
                            login: 'mlaine',
                            repositories: { names: ['mlaine/tasklet', 'mlaine/mdlint'] },
                            organizations: { fitloop: { names: ['fitloop/webapp', 'fitloop/api'] } },
                            projects: {
                                mlaine: [{ title: 'tasklet Roadmap', number: 1, daysAgo: 1, items: 34 }],
                                fitloop: [
                                    { title: 'Platform Q4', number: 12, daysAgo: 0.1, items: 128 },
                                    { title: 'Docs revamp', number: 9, daysAgo: 0.5, items: 12 },
                                    { title: 'Bug triage', number: 7, daysAgo: 1.2, items: 61 },
                                    { title: 'Mobile 2.0', number: 15, daysAgo: 2, items: 210 },
                                    { title: 'Hiring pipeline', number: 3, daysAgo: 21, items: 19 },
                                    { title: 'Q3 Launch', number: 11, daysAgo: 40, items: 88, closed: true },
                                ],
                            },
                            hidingOrganizations: ['acme-health'],
                        }),
                    ),
                );
                setIndexedDbPersistence(container);
                provideContainer(container);
                const tracking = container.resolve(TrackingStore);
                const ready = ref(false);
                void trackSome();
                async function trackSome() {
                    await tracking.ready();
                    for (const project of TRACKED) {
                        tracking.track({ project });
                    }

                    ready.value = true;
                }
                const open = ref(true);
                return () =>
                    ready.value
                        ? h(TrackProjectsDialog, {
                              open: open.value,
                              'onUpdate:open': value => {
                                  open.value = value;
                              },
                          })
                        : null;
            },
        }),
} satisfies Meta<typeof TrackProjectsDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

/** T22: opened with "Track projects", Bug triage picked; tracked ones with a grey, fixed tick, Q3 Launch closed. */
export const BugTriagePicked: Story = {
    play: async ({ canvasElement }) => {
        const body = within(canvasElement.ownerDocument.body);
        await userEvent.click(await body.findByRole('checkbox', { name: /^Bug triage/ }));
    },
};

/** G5 in the project picker: acme-health picked on the left, why it can't list its projects and how it gets fixed. */
export const HiddenOrganisation: Story = {
    play: async ({ canvasElement }) => {
        const body = within(canvasElement.ownerDocument.body);
        await userEvent.click(await body.findByRole('radio', { name: /^acme-health/ }));
    },
};
