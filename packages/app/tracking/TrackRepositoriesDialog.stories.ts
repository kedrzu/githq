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
import TrackRepositoriesDialog from './TrackRepositoriesDialog.vue';

const TRACKED = ['mlaine/tasklet', 'mlaine/mdlint', 'fitloop/webapp', 'fitloop/api'];

const meta = {
    component: TrackRepositoriesDialog,
    // Over a real tracking store, GitHub answering what T18 shows.
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
                            organizations: {
                                fitloop: {
                                    names: [
                                        'fitloop/webapp',
                                        'fitloop/api',
                                        'fitloop/mobile',
                                        'fitloop/platform-infra',
                                    ],
                                    total: 312,
                                },
                            },
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
                    for (const nameWithOwner of TRACKED) {
                        tracking.track({ repository: { nameWithOwner, id: `R_${nameWithOwner}` } });
                    }

                    ready.value = true;
                }
                const open = ref(true);
                return () =>
                    ready.value
                        ? h(TrackRepositoriesDialog, {
                              open: open.value,
                              'onUpdate:open': value => {
                                  open.value = value;
                              },
                          })
                        : null;
            },
        }),
} satisfies Meta<typeof TrackRepositoriesDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

/** T18: opened with "Track repositories", two picked; tracked rows with a grey, fixed tick. */
export const TwoPicked: Story = {
    play: async ({ canvasElement }) => {
        const body = within(canvasElement.ownerDocument.body);
        await userEvent.click(await body.findByRole('checkbox', { name: /^fitloop\/mobile/ }));
        await userEvent.click(await body.findByRole('checkbox', { name: /^fitloop\/platform-infra/ }));
    },
};
