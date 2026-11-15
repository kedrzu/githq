import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, ref, shallowRef } from 'vue';

import CommandMenu from '@/commands/CommandMenu.vue';
import { CommandRegistry } from '@/commands/CommandRegistry.js';
import type { NavigationData } from '@/commands/searchNavigation.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { Browser } from '@/services/Browser.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { ItemDetailProject } from '@/store/ItemDetailTypes.js';
import type { IssueItem } from '@/store/ItemTypes.js';
import { createFixedPhoneLayout } from '@/testing/createFixedPhoneLayout.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { D1_ISSUE_DETAIL } from '@/testing/sampleItemDetails.js';
import { sampleIssue } from '@/testing/sampleItems.js';
import { sampleUser } from '@/testing/sampleMyWork.js';
import { SAMPLE_PORTAL_METADATA } from '@/testing/sampleRepositories.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import SelectionActions from './SelectionActions.vue';

const PORTAL = {
    nameWithOwner: 'skyline-labs/portal',
    owner: 'skyline-labs',
    isPrivate: false,
    viewerPermission: 'WRITE',
} as const;
const PLACES = D1_ISSUE_DETAIL.projects.slice(0, 1);
/** {@link PLACES} with the status "In review" in place of "In progress". */
const PLACES_IN_REVIEW = PLACES.map(place => ({
    ...place,
    values: {
        ...place.values,
        status: { kind: 'singleSelect', optionId: 'status-review', name: 'In review', color: 'BLUE' },
    } satisfies ItemDetailProject['values'],
}));
const MLAINE = sampleUser('mlaine', '#81c995');
/** Nothing to go to: only the selection's actions are looked at. */
const NAVIGATION: NavigationData = { places: [], trackedRepositories: [], items: [] };

/** MB117's three issues: all assigned to mlaine, their labels and milestones not the same. */
const SELECTED: readonly IssueItem[] = [
    {
        ...sampleIssue('I_1187'),
        number: 1187,
        title: 'Calendar shows wrong timezone for recurring classes',
        repository: PORTAL,
        assignees: [MLAINE],
        labels: [{ name: 'bug', color: 'e5534b' }],
        milestone: { title: 'v4.2 — November', dueOn: null },
    },
    {
        ...sampleIssue('I_1204'),
        number: 1204,
        title: 'Waitlist promotion skips members with an expired pass',
        repository: PORTAL,
        assignees: [MLAINE],
        labels: [
            { name: 'bug', color: 'e5534b' },
            { name: 'ux', color: 'a57bf5' },
        ],
        milestone: null,
    },
    {
        ...sampleIssue('I_1176'),
        number: 1176,
        title: 'Document the studio timezone setting',
        repository: PORTAL,
        assignees: [MLAINE],
        labels: [],
        milestone: { title: 'v4.2 — November', dueOn: null },
    },
];

/** Their ids, the same array on every render: a new one would register the actions again and draw the menu again. */
const SELECTED_IDS = SELECTED.map(item => item.id);

/**
 * The selection's actions on a phone over three items of the real local copy, the command menu open over them as the
 * command line opens it (mobile D28): each change they ask for is written out above it, as the edit engine got it.
 */
const Harness = defineComponent({
    props: {
        /** #1204 is "In review" in the project, the others "In progress". */
        mixedStatus: { type: Boolean, default: false },
    },
    setup(props) {
        const container = createContainer();
        container.set(LanguageContext, () => APP_LANGUAGE);
        container.set(Browser, createSignedInBrowser());
        container.set(PhoneLayout, createFixedPhoneLayout(true));
        setIndexedDbPersistence(container);
        container.set(RepositoryStore, {
            get: () => SAMPLE_PORTAL_METADATA,
            viewerProjects: null,
            ensure: () => Promise.resolve(SAMPLE_PORTAL_METADATA),
            ensureViewerProjects: () => Promise.resolve(null),
            complete: metadata => Promise.resolve(metadata),
        });
        const asked = ref('Nothing asked');
        const editor = container.resolve(ItemEditor);
        container.set(ItemEditor, {
            ...editor,
            getPlaces: item => (props.mixedStatus && item.id === 'I_1204' ? PLACES_IN_REVIEW : PLACES),
            edit: (ids, request) => {
                asked.value = `${ids.join(' ')}: ${JSON.stringify(request)}`;
                return Promise.resolve({ failed: [] });
            },
        });
        provideContainer(container);

        const ready = shallowRef(false);
        void fill();

        return () =>
            h('div', { style: 'display: flex; flex-direction: column; height: 100vh' }, [
                h('output', { 'aria-label': 'Asked' }, asked.value),
                ready.value ? h(Selection) : null,
            ]);

        async function fill() {
            const store = container.resolve(ItemStore);
            await store.ready();
            store.upsertMany([...SELECTED]);
            ready.value = true;
        }
    },
});

/** The selection's actions and the command menu the command line opens over them. */
const Selection = defineComponent({
    setup() {
        const registry = useService(CommandRegistry);
        registry.openMenu();
        return () => [
            h(SelectionActions, { ids: SELECTED_IDS }),
            h(CommandMenu, {
                open: registry.menu !== null,
                'onUpdate:open': (open: boolean) => (open ? registry.openMenu() : registry.closeMenu()),
                commands: registry.commands,
                subject: registry.subject,
                repository: null,
                navigation: NAVIGATION,
                startCommandId: registry.menu?.commandId ?? null,
                parts: null,
                onNavigate: () => undefined,
            }),
        ];
    },
});

const meta = { component: Harness } satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Mobile D28, MB118: ⌘ over three selected issues on a phone — the chip "3 items", the actions headed "Only what applies
 * to all 3", Close 3 items, and the milestone and labels they don't share said "mixed", the assignee and the status they
 * share named.
 */
export const PhoneMenuOverSelection: Story = {};

/** The same, one of them in another status: the Status row says "mixed" (MB118). */
export const PhoneMenuOverMixedStatuses: Story = { args: { mixedStatus: true } };
