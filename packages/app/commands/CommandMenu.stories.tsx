import { useService } from '@nzyme/vue-ioc/useService.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { userEvent } from 'storybook/test';
import { defineComponent, ref } from 'vue';
import type { PropType } from 'vue';

import type { EditRequest } from '@/edits/EditTypes.js';
import { getEditPermissions } from '@/edits/getEditPermissions.js';
import type { ItemEditing } from '@/item/ItemEditing.js';
import ItemView from '@/item/ItemView.vue';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';
import type { Item } from '@/store/ItemTypes.js';
import { D1_ISSUE, D1_ISSUE_DETAIL } from '@/testing/sampleItemDetails.js';
import { sampleIssue } from '@/testing/sampleItems.js';
import { D1_ITEMS, SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import {
    SAMPLE_CONTRIBUTOR_EDITING,
    SAMPLE_MAINTAINER_EDITING,
    SAMPLE_PORTAL_METADATA,
} from '@/testing/sampleRepositories.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import CommandMenu from './CommandMenu.vue';
import { APP_KEYS, CommandRegistry } from './CommandRegistry.js';
import type { NavigationData, NavigationResult } from './searchNavigation.js';
import { useCommands } from './useCommands.js';
import { useEditCommands } from './useEditCommands.js';

/** What the menu finds while nothing is opened (E3): projects, repositories, items of the local copy. */
const NAVIGATION: NavigationData = {
    places: [
        { id: 'myWork', group: 'goTo', kind: 'myWork', title: 'My work', path: '/' },
        {
            id: 'project:q4',
            group: 'projects',
            kind: 'project',
            title: 'Platform Q4',
            detail: 'skyline-labs',
            keywords: ['skyline-labs'],
            path: '/orgs/skyline-labs/projects/4',
        },
        {
            id: 'project:onboarding',
            group: 'projects',
            kind: 'project',
            title: 'Platform onboarding',
            detail: 'skyline-labs',
            keywords: ['skyline-labs'],
            path: '/orgs/skyline-labs/projects/7',
        },
        {
            id: 'repository:portal',
            group: 'repositories',
            kind: 'repository',
            title: 'skyline-labs/portal',
            path: '/skyline-labs/portal',
        },
        { id: 'tracking', group: 'goTo', kind: 'tracking', title: 'Track repositories…', path: '/settings/tracking' },
    ],
    trackedRepositories: ['skyline-labs/portal'],
    items: [
        ...D1_ITEMS,
        { ...sampleIssue('I_77'), number: 77, title: 'Keep reactivity when the sidebar collapses' },
        { ...sampleIssue('I_78'), number: 78, title: 'Żółty label is unreadable on the dark theme' },
    ],
};

const MOBILE_METADATA: RepositoryMetadata = {
    ...SAMPLE_PORTAL_METADATA,
    nameWithOwner: 'skyline-labs/mobile',
    id: 'R_mobile',
    viewerPermission: 'READ',
};

/** E4: three issues in Platform Q4, one of them in a repository where the user only reads. */
const SELECTED: readonly Item[] = [
    selectedIssue('I_455', 'skyline-labs/portal', 455, 'Document webhook retry policy', 'WRITE'),
    selectedIssue('I_1210', 'skyline-labs/portal', 1210, 'Client switcher loses filter state', 'WRITE'),
    selectedIssue('I_91', 'skyline-labs/mobile', 91, 'Crash on Android 15 when opening receipts', 'READ'),
];

/**
 * The command menu over what registers its actions: the opened item's view (E1, E2) or a selection (E4), with
 * the app's ⌘K and `[`. What a pick asks for and where the menu goes are written out under it.
 */
const Harness = defineComponent({
    props: {
        subject: { type: String as PropType<'item' | 'selection' | 'none'>, required: true },
        editing: { type: Object as PropType<ItemEditing>, default: () => SAMPLE_MAINTAINER_EDITING },
        startCommandId: { type: String as PropType<string | null>, default: null },
        startOpen: { type: Boolean, default: true },
    },
    setup(props) {
        const registry = useService(CommandRegistry);
        const editCommands = useEditCommands();
        const asked = ref('Nothing asked');
        const went = ref('Nowhere');
        const sidebar = ref('expanded');

        useCommands(() => [
            {
                id: 'app.commandMenu',
                title: 'Open the command menu',
                section: 'app',
                key: APP_KEYS.commandMenu,
                menu: false,
                run: () => registry.openMenu(),
            },
            {
                id: 'app.sidebar',
                title: 'Collapse sidebar',
                section: 'app',
                key: APP_KEYS.sidebar,
                run: () => {
                    sidebar.value = sidebar.value === 'expanded' ? 'collapsed' : 'expanded';
                },
            },
        ]);
        if (props.subject === 'selection') {
            useCommands(
                () =>
                    editCommands({
                        section: 'selection',
                        items: SELECTED,
                        metadata: [SAMPLE_PORTAL_METADATA, MOBILE_METADATA],
                        loading: false,
                        viewerLogin: SAMPLE_VIEWER.login,
                        getPermissions: item =>
                            getEditPermissions({
                                item,
                                viewerLogin: SAMPLE_VIEWER.login,
                                permission: item.repository.viewerPermission,
                            }),
                        places: D1_ISSUE_DETAIL.projects.slice(0, 1),
                        now: SAMPLE_NOW,
                        stateOptions: [
                            {
                                key: 'completed',
                                text: 'Close as completed',
                                request: { kind: 'close', reason: 'COMPLETED' },
                            },
                            {
                                key: 'notPlanned',
                                text: 'Close as not planned',
                                request: { kind: 'close', reason: 'NOT_PLANNED' },
                            },
                        ],
                        stateTitle: 'Close 3 items…',
                        edit: edit,
                        setField: (place, field, value) =>
                            edit({
                                kind: 'projectFieldInProject',
                                projectId: place.projectId,
                                fieldId: field.id,
                                value,
                            }),
                    }),
                () => ({ kind: 'selection', label: '3 items', title: '3 items' }),
            );
        }

        if (props.startOpen) {
            registry.openMenu(props.startCommandId);
        }

        return () => (
            <div style={{ display: 'flex', height: '100vh' }}>
                {props.subject === 'item' ? (
                    <div style={{ width: '560px', height: '100%' }}>
                        <ItemView
                            item={D1_ISSUE}
                            detail={D1_ISSUE_DETAIL}
                            arrangement="panel"
                            now={SAMPLE_NOW}
                            loadAllComments={() => Promise.resolve()}
                            editing={props.editing}
                            onEdit={edit}
                        />
                    </div>
                ) : null}
                <p style={{ padding: '16px' }}>
                    <span tid="asked">{asked.value}</span> · <span tid="went">{went.value}</span> ·{' '}
                    <span tid="sidebar">{sidebar.value}</span>
                </p>
                <CommandMenu
                    open={registry.menu !== null}
                    onUpdate:open={(open: boolean) => (open ? registry.openMenu() : registry.closeMenu())}
                    commands={registry.commands}
                    subject={registry.subject}
                    navigation={NAVIGATION}
                    startCommandId={registry.menu?.commandId ?? null}
                    onNavigate={navigate}
                />
            </div>
        );

        function edit(request: EditRequest) {
            asked.value = JSON.stringify(request);
        }

        function navigate(result: NavigationResult) {
            switch (result.kind) {
                case 'place':
                    went.value = result.place.path;
                    break;
                case 'item':
                    went.value = `${result.item.repository.nameWithOwner}#${result.item.number}`;
                    break;
                case 'repository':
                    went.value = `/${result.nameWithOwner}`;
            }
        }
    },
});

const meta = {
    component: Harness,
    args: { subject: 'item' },
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

/** E1: ⌘K on an open item — its actions with their keys and values, then the app's and the places to go. */
export const OnOpenItem: Story = {};

/** K1b: a contributor — what they can't edit is not offered; commenting and adding to a project are. */
export const OnOpenItemAsContributor: Story = { args: { editing: SAMPLE_CONTRIBUTOR_EDITING } };

/** E2: "Set status…" opened — the status of both projects the item is in, the current one checked. */
export const StatusInTwoProjects: Story = { args: { startCommandId: 'item.status' } };

/** E3: nothing opened — typing finds projects, repositories and items of the local copy, and any `owner/name`. */
export const Typing: Story = { args: { subject: 'none' } };

/** E4: three items selected — their actions, "2 of 3 editable" where only some may take it. */
export const SeveralSelected: Story = { args: { subject: 'selection' } };

/** E5: letters typed are marked where they matched, in a title here. */
export const MatchInTitle: Story = {
    args: { subject: 'none' },
    play: async () => {
        await userEvent.keyboard('plat');
    },
};

/** E5: found only by a word the line does not show: that word, dimmed after the title, its letters marked. */
export const MatchInHiddenWord: Story = {
    play: async () => {
        await userEvent.keyboard('assignees');
    },
};

/** Closed: the keys open it (⌘K), or an action's submenu where nothing else runs it. */
export const Closed: Story = { args: { subject: 'selection', startOpen: false } };

function selectedIssue(
    id: string,
    nameWithOwner: string,
    number: number,
    title: string,
    permission: 'READ' | 'WRITE',
): Item {
    const base = sampleIssue(id);
    return {
        ...base,
        number,
        title,
        repository: { ...base.repository, nameWithOwner, viewerPermission: permission },
    };
}
