import type { RepositoryBrowseSearchQuery } from '@githq/github/generated.gen.js';
import type { Translator } from '@nzyme/i18n/Translator.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useContainer } from '@nzyme/vue-ioc/useContainer.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import type { LucideIcon } from 'lucide-vue-next';
import { CircleDot, Eye, GitCommitHorizontal, GitPullRequest, Link, Play, Workflow } from 'lucide-vue-next';
import { userEvent, within } from 'storybook/test';
import { defineComponent, ref } from 'vue';
import type { PropType } from 'vue';

import type { EditRequest } from '@/edits/EditTypes.js';
import { getEditPermissions } from '@/edits/getEditPermissions.js';
import type { ItemEditing } from '@/item/ItemEditing.js';
import ItemView from '@/item/ItemView.vue';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';
import { Browser } from '@/services/Browser.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import type { PhonePart } from '@/shell/PhoneLayout.js';
import type { Item, ItemRepository } from '@/store/ItemTypes.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { D1_ISSUE, D1_ISSUE_DETAIL } from '@/testing/sampleItemDetails.js';
import { sampleIssue, samplePullRequest } from '@/testing/sampleItems.js';
import { D1_ITEMS, SAMPLE_NOW, sampleUser } from '@/testing/sampleMyWork.js';
import {
    SAMPLE_CONTRIBUTOR_EDITING,
    SAMPLE_MAINTAINER_EDITING,
    SAMPLE_PORTAL_METADATA,
} from '@/testing/sampleRepositories.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { withPhoneLayout } from '@/testing/withPhoneLayout.js';

import CommandMenu from './CommandMenu.vue';
import { CommandRegistry } from './CommandRegistry.js';
import { bindCommand } from './bindCommand.js';
import type { CommandBinding } from './bindCommand.js';
import type { BoundCommand, Command, CommandFormField, CommandParts, CommandPlace } from './CommandTypes.js';
import { defineAppCommand } from './defineAppCommand.js';
import { commandMenu, sidebar as sidebarCommand } from './definitions/index.js';
import type { NavigationData, NavigationPlace, NavigationResult } from './searchNavigation.js';
import { useCommands } from './useCommands.js';
import { useEditCommands } from './useEditCommands.js';
import { useRepositorySearchCommand } from './useRepositorySearchCommand.js';

const PORTAL: ItemRepository = {
    nameWithOwner: 'skyline-labs/portal',
    owner: 'skyline-labs',
    isPrivate: false,
    viewerPermission: 'WRITE',
};

/**
 * E11, MB272: found by "cal" beside D1's portal#1187 (in Platform Q4 "In progress" and Bug triage): an open pull request
 * approved with its checks passed (behind its base), a draft with a check failing, a merged one and an issue closed as not planned.
 */
const FOUND_ITEMS: readonly Item[] = [
    {
        ...samplePullRequest('PR_1198'),
        repository: PORTAL,
        number: 1198,
        title: 'Calendar export to iCal feeds',
        author: sampleUser('tw', '#c3a6f2'),
        reviewDecision: 'APPROVED',
        checks: { state: 'SUCCESS', passing: 12, failing: 0, pending: 0 },
        // Behind its base, so approved with its checks passed but not ready to merge.
        mergeStateStatus: 'BEHIND',
        behindBase: true,
    },
    {
        ...samplePullRequest('PR_1212'),
        repository: PORTAL,
        number: 1212,
        title: 'Calendar sync with Google Workspace',
        author: sampleUser('olam', '#7fb3d5'),
        isDraft: true,
        checks: { state: 'FAILURE', passing: 8, failing: 1, pending: 0 },
    },
    {
        ...samplePullRequest('PR_1150'),
        repository: PORTAL,
        number: 1150,
        title: 'Calendar view for weekly bookings',
        author: sampleUser('pnowak', '#81c995'),
        state: 'MERGED',
        merged: true,
        closedAt: '2026-10-21T10:00:00Z',
    },
    {
        ...sampleIssue('I_1102'),
        repository: PORTAL,
        number: 1102,
        title: 'Calendar invites in Outlook format',
        state: 'CLOSED',
        stateReason: 'NOT_PLANNED',
        closedAt: '2026-10-21T10:00:00Z',
    },
];

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
        { id: 'settings', group: 'goTo', kind: 'settings', title: 'Settings', key: ',', path: '/settings' },
    ],
    trackedRepositories: ['skyline-labs/portal'],
    items: [
        ...D1_ITEMS,
        { ...sampleIssue('I_77'), number: 77, title: 'Keep reactivity when the sidebar collapses' },
        { ...sampleIssue('I_78'), number: 78, title: 'Żółty label is unreadable on the dark theme' },
        ...FOUND_ITEMS,
    ],
};

/** E13: what was opened lately, newest first — the first item no longer in the local copy, so left out. */
const RECENT_NAVIGATION: NavigationData = {
    ...NAVIGATION,
    recent: [
        { kind: 'place', id: 'project:q4' },
        { kind: 'item', id: 'I_gone' },
        { kind: 'item', id: 'I_77' },
        { kind: 'place', id: 'repository:portal' },
        { kind: 'item', id: 'PR_1198' },
    ],
};

const MOBILE_METADATA: RepositoryMetadata = {
    ...SAMPLE_PORTAL_METADATA,
    nameWithOwner: 'skyline-labs/mobile',
    id: 'R_mobile',
    viewerPermission: 'READ',
};

/** What GitHub's search answers in E8. */
const FOUND_REPOSITORIES: RepositoryBrowseSearchQuery = {
    search: {
        nodes: [
            foundRepository('vitejs/vite', "Next generation frontend tooling. It's fast!", false),
            foundRepository('fitloop/vite-plugin-billing', 'Billing pages as a Vite plugin', true),
            foundRepository('vitejs/no-description', null, false),
        ],
    },
};

/** A repository as GitHub's search answers with it. */
function foundRepository(nameWithOwner: string, description: string | null, isPrivate: boolean) {
    return {
        id: `R_${nameWithOwner}`,
        nameWithOwner,
        description,
        isPrivate,
        isArchived: false,
        pushedAt: null,
        viewerPermission: null,
        owner: { login: nameWithOwner.split('/')[0] ?? '' },
        issues: { totalCount: 0 },
        pullRequests: { totalCount: 0 },
    };
}

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
        /** "Search repositories" as the app has it, with GitHub answering this; left out it is not offered. */
        github: { type: Function as PropType<() => Promise<RepositoryBrowseSearchQuery>>, default: undefined },
        repository: { type: String as PropType<string | null>, default: null },
        /** Levels to walk into, under places, repositories and actions; what their rows do is written in `asked`. */
        levels: { type: Boolean, default: false },
        /** "Run workflow" with two workflows to run through a form: Deploy, and Release that can't run. */
        workflows: { type: Boolean, default: false },
        /**
         * On a workflow nobody can run by hand (W48): "Run workflow · CLA", disabled, and "Run workflow" starting at the
         * screen's repository (W36), whose workflows are still being read; fitloop/api beside it has Deploy.
         */
        repositoryWorkflows: { type: Boolean, default: false },
        /** Opened from the phone's command line on a list (mobile D17): the place's parts first. */
        parts: { type: String as PropType<PhonePlace | null>, default: null },
        /** A project, an issue, a repository and a pull request opened lately, as kept (`RecentVisitsStore`). */
        recent: { type: Boolean, default: false },
    },
    setup(props) {
        // The open item keeps what the user chose in their settings, which are kept in the local copy.
        setIndexedDbPersistence(useContainer());
        if (props.github) {
            useRepositorySearchStory(props.github);
        }

        const registry = useService(CommandRegistry);
        const phoneLayout = useService(PhoneLayout);
        const editCommands = useEditCommands();
        const asked = ref('Nothing asked');
        const went = ref('Nowhere');
        const sidebar = ref('expanded');
        const t = useTranslate();
        const navigation = props.levels ? createLevelNavigation(say) : props.recent ? RECENT_NAVIGATION : NAVIGATION;

        if (props.levels) {
            useCommands(() => createLevelCommands(say, t));
        }

        if (props.workflows) {
            useCommands(() => [createRunWorkflowCommand(say, t)]);
        }

        if (props.repositoryWorkflows) {
            useCommands(() => createRepositoryWorkflowCommands(say, t));
        }

        useCommands(() => [
            bindCommand(commandMenu, { section: 'app', menu: false, once: true, run: () => registry.openMenu() }, t),
            bindCommand(
                sidebarCommand,
                {
                    title: 'Collapse sidebar',
                    section: 'app',
                    run: () => {
                        sidebar.value = sidebar.value === 'expanded' ? 'collapsed' : 'expanded';
                    },
                },
                t,
            ),
        ]);
        if (props.repository !== null) {
            useCommands(() => [
                bindStory(
                    'pullRequests',
                    'repository',
                    {
                        title: 'Pull requests',
                        section: 'repository',
                        run: () => {
                            went.value = `/${props.repository}/pulls`;
                        },
                    },
                    t,
                ),
            ]);
        }
        if (props.subject === 'selection') {
            useCommands(
                () =>
                    editCommands({
                        place: 'list',
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

        const { parts } = props;
        if (parts !== null) {
            const shown = createParts(
                parts,
                path => {
                    went.value = path;
                },
                t,
            );
            useCommands(() => shown.registered);
            // What the list's screen gives the command line, whose chip the menu shows on a phone.
            phoneLayout.setPart(PHONE_PARTS[parts]);
            registry.openParts(() => shown.parts);
        } else if (props.startOpen) {
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
                            loadThreadMiddle={() => Promise.resolve()}
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
                    repository={props.repository}
                    navigation={navigation}
                    request={registry.menu}
                    onNavigate={navigate}
                />
            </div>
        );

        function say(text: string) {
            asked.value = text;
        }

        function edit(request: EditRequest) {
            asked.value = JSON.stringify(request);
        }

        function navigate(result: NavigationResult) {
            switch (result.kind) {
                case 'place':
                    went.value = result.place.path ?? result.place.title;
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
    // The story frame is narrower than a phone's width: the computer's menu unless a story says otherwise.
    decorators: [withPhoneLayout(false)],
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

/** E1: ⌘K on an open item — its actions with their keys and values, then the app's and the places to go. */
export const OnOpenItem: Story = {};

/** K1b: a contributor — what they can't edit is not offered; commenting and adding to a project are. */
export const OnOpenItemAsContributor: Story = { args: { editing: SAMPLE_CONTRIBUTOR_EDITING } };

/** E2: "Set status" opened — the status of both projects the item is in, the current one checked. */
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

/**
 * E11: issues and pull requests found in two lines — the kind icon in its state's tone, the title marked and its age;
 * under it the reference, the checks and standing, the first project's row field with "+1", the author.
 */
export const FoundItems: Story = {
    args: { subject: 'none' },
    play: async () => {
        await userEvent.keyboard('cal');
    },
};

/** E7: "Search repositories" opened, before typing. */
export const SearchBeforeTyping: Story = {
    args: {
        subject: 'none',
        startCommandId: 'app.searchRepositories',
        github: () => Promise.resolve(FOUND_REPOSITORIES),
    },
};

/** E8: what GitHub found: each with its description and visibility. */
export const SearchResults: Story = {
    args: { ...SearchBeforeTyping.args },
    play: async () => {
        await userEvent.keyboard('vite');
        // The menu is a dialog, outside the story's own element.
        await within(document.body).findByText('vitejs/vite');
    },
};

/** E9: GitHub has not answered yet. */
export const SearchAsking: Story = {
    args: { ...SearchBeforeTyping.args, github: () => new Promise(() => {}) },
    play: async () => {
        await userEvent.keyboard('vite');
    },
};

/** E10: GitHub found nothing. */
export const SearchNothingFound: Story = {
    args: { ...SearchBeforeTyping.args, github: () => Promise.resolve({ search: { nodes: [] } }) },
    play: async () => {
        await userEvent.keyboard('vitee');
        await within(document.body).findByText('Nothing on GitHub matches "vitee"');
    },
};

/** GitHub did not answer. */
export const SearchFailed: Story = {
    args: { ...SearchBeforeTyping.args, github: () => Promise.reject(new Error('Bad gateway')) },
    play: async () => {
        await userEvent.keyboard('vite');
        await within(document.body).findByText('GitHub did not answer. Change the search to try again.');
    },
};

/** The repository of the screen: a chip after the item's, its actions under its name, taken out with a second ⌫. */
export const OnOpenItemInRepository: Story = { args: { repository: 'skyline-labs/portal' } };

/** No item opened: the repository's chip stands alone and its actions lead the menu. */
export const InRepository: Story = { args: { subject: 'none', repository: 'skyline-labs/portal' } };

/** Closed: the keys open it (⌘K), or an action's submenu where nothing else runs it. */
export const Closed: Story = { args: { subject: 'selection', startOpen: false } };

/** Levels under a repository, a project, a repository not tracked and an action: → walks in, ← walks out. */
export const Levels: Story = { args: { subject: 'none', levels: true } };

/** The same on an open item: its chip stays over its own actions' pickers, and leaves in a place's level. */
export const LevelsOnOpenItem: Story = { args: { levels: true } };

/** A row found deeper: its whole way there, with the letters of the repository the text named marked. */
export const FoundInRepository: Story = {
    args: { subject: 'none', levels: true },
    play: async () => {
        await userEvent.keyboard('portal pull');
    },
};

/** W36 → W37: "Run workflow", then Deploy — its form, every field at its default. */
export const FormStep: Story = {
    args: { subject: 'none', workflows: true, startCommandId: 'app.runWorkflow' },
    play: async () => {
        await userEvent.keyboard('{Enter}');
    },
};

/** W37: the form filled — production, a version, no dry run — the version field focused. */
export const FormFilled: Story = {
    args: { subject: 'none', workflows: true, startCommandId: 'app.runWorkflow' },
    play: async ({ canvasElement }) => {
        await userEvent.keyboard('{Enter}');
        const body = within(canvasElement.ownerDocument.body);
        await userEvent.selectOptions(await body.findByRole('combobox', { name: 'environment' }), 'production');
        await userEvent.click(body.getByRole('switch', { name: 'dry_run' }));
        await userEvent.type(body.getByRole('textbox', { name: 'version' }), '2.14.0');
    },
};

/** A form that can't run: why, under the ref left to change, and Run unavailable. */
export const FormCantRun: Story = {
    args: { subject: 'none', workflows: true, startCommandId: 'app.runWorkflow' },
    play: async () => {
        await userEvent.keyboard('{ArrowDown}{Enter}');
    },
};

/**
 * W48 → W36: on CLA, which has no workflow_dispatch: its own line disabled, and "Run workflow" at the repository, its hint
 * at the footer's end.
 */
export const RunWorkflowInRepository: Story = { args: { subject: 'none', repositoryWorkflows: true } };

/**
 * W46: "Run workflow"'s level — the repositories under "Tracked repositories" and "Nothing to run", its own placeholder
 * and its step at the footer's end.
 */
export const RunWorkflowRepositories: Story = {
    args: { subject: 'none', repositoryWorkflows: true, startCommandId: 'app.runWorkflow' },
};

/**
 * Mobile D17, D21: the phone's command line on a repository's Issues — its sections first under its name, Issues and Pull
 * requests with their open items, Commits and Workflows marked ↗ as leaving for github.com; the rest as ⌘K has it.
 */
export const PartsOfRepository: Story = {
    args: { subject: 'none', repository: 'fitloop/webapp', parts: 'repository' },
};

/** Mobile MB223, D49: on a project's view — its saved views each with its count, the one shown checked and dotted as changed here. */
export const PartsOfProject: Story = { args: { subject: 'none', parts: 'project' } };

/** Mobile D17: on My work — the whole of it and its groups, each with its count once in, the one shown checked. */
export const PartsOfMyWork: Story = { args: { subject: 'none', parts: 'myWork' } };

/**
 * Mobile D16, MB223: on a phone the menu rises from below over a project's view — its saved views right above the
 * field, "This view" above them, the places above that; the field at the bottom with ⌘, the command line's chip (the view, dotted as changed here), "Do or find…" and ×, not focused,
 * so no keyboard comes; no keys on the rows nor a footer of them.
 */
export const PhonePartsOfProject: Story = {
    args: { subject: 'none', parts: 'project' },
    decorators: [withPhoneLayout(true)],
};

/** Mobile D17, MB39: on a phone over a repository's Issues — its sections nearest the thumb, the Issues chip in the field. */
export const PhonePartsOfRepository: Story = {
    args: { ...PartsOfRepository.args },
    decorators: [withPhoneLayout(true)],
};

/** Mobile MB38: on a phone over an open item — its actions nearest the thumb, the item's chip in the field. */
export const PhoneOnOpenItem: Story = { decorators: [withPhoneLayout(true)] };

/**
 * Mobile MB40: a picker from below — over it the way back, the item and "Set status"; the statuses read downwards above
 * a field that finds only them, a magnifier in it.
 */
export const PhoneStatusInTwoProjects: Story = {
    args: { startCommandId: 'item.status' },
    decorators: [withPhoneLayout(true)],
};

/**
 * Mobile MB41: typed on a phone (a hardware keyboard here; the on-screen one is not drawn) — the whole list upwards, the
 * best match nearest the field and highlighted.
 */
export const PhoneTyping: Story = {
    args: { subject: 'none' },
    decorators: [withPhoneLayout(true)],
    play: async () => {
        await userEvent.keyboard('plat');
    },
};

/**
 * Mobile MB272: the same found on a phone — the title on one line, then the reference, the checks as a count and the
 * standing in a word, the project field, the avatar and the age.
 */
export const PhoneFoundItems: Story = {
    ...FoundItems,
    decorators: [withPhoneLayout(true)],
};

/** E13, E15: nothing typed — "Recent" before "Go to": a project, an issue, a repository and a pull request opened lately. */
export const Recent: Story = { args: { subject: 'none', recent: true } };

/** The same on a phone over My work: its parts nearest the field, "Recent" above them. */
export const PhoneRecent: Story = {
    args: { subject: 'none', parts: 'myWork', recent: true },
    decorators: [withPhoneLayout(true)],
};

/** The list a phone's command line is on, for its parts. */
type PhonePlace = 'repository' | 'project' | 'myWork';

/** The part each list shows, as its screen gives it to the command line. */
const PHONE_PARTS: Readonly<Record<PhonePlace, PhonePart>> = {
    repository: { label: 'Issues', count: 142 },
    project: { label: 'Current sprint', count: 34, changed: true },
    myWork: { label: 'Assigned to me', count: 7 },
};

/** The parts of a place as its screen gives them, and what the screen registers of them (a repository's sections). */
function createParts(place: PhonePlace, go: (path: string) => void, t: Translator): StoryParts {
    switch (place) {
        case 'repository': {
            const issues = sectionCommand('issues', 'Issues', CircleDot, go, t);
            const pullRequests = sectionCommand('pullRequests', 'Pull requests', GitPullRequest, go, t);
            const commits = sectionCommand('commits', 'Commits', GitCommitHorizontal, go, t);
            const workflows = sectionCommand('workflows', 'Workflows', Workflow, go, t);
            const copyLink = bindStory(
                'copyLink',
                'repository',
                { title: 'Copy link', section: 'repository', icon: Link },
                t,
            );
            return {
                registered: [issues, pullRequests, commits, workflows, copyLink],
                parts: {
                    heading: 'fitloop/webapp',
                    rows: [
                        { kind: 'command', command: { ...issues, count: 142, current: true } },
                        { kind: 'command', command: { ...pullRequests, count: 18 } },
                        { kind: 'command', command: { ...commits, external: true } },
                        { kind: 'command', command: { ...workflows, external: true } },
                    ],
                },
            };
        }
        case 'project':
            return {
                registered: [],
                parts: {
                    heading: 'Platform Q4 · views',
                    rows: [
                        { kind: 'command', command: viewCommand('1', 'Backlog', 61, go) },
                        { kind: 'command', command: viewCommand('2', 'Roadmap', 128, go) },
                        // GitHub has not answered its filter yet.
                        { kind: 'command', command: viewCommand('3', 'By assignee', null, go) },
                        {
                            kind: 'command',
                            command: { ...viewCommand('4', 'Current sprint', 34, go), current: true, changed: true },
                        },
                    ],
                },
            };
        case 'myWork':
            return {
                registered: [],
                parts: {
                    heading: 'My work',
                    rows: [
                        { kind: 'place', place: myWorkPlace('myWork', 'My work', '/', 13) },
                        {
                            kind: 'place',
                            place: myWorkPlace(
                                'myWork:reviewRequested',
                                'Review requested',
                                '/pulls/review-requested',
                                2,
                            ),
                        },
                        { kind: 'place', place: myWorkPlace('myWork:authored', 'My pull requests', '/pulls', 4) },
                        {
                            kind: 'place',
                            place: {
                                ...myWorkPlace('myWork:assigned', 'Assigned to me', '/issues/assigned', 7),
                                current: true,
                            },
                        },
                        // Still arriving.
                        {
                            kind: 'place',
                            place: myWorkPlace('myWork:mentioned', 'Mentioned', '/issues/mentioned', null),
                        },
                    ],
                },
            };
        default:
            return assertNever(place);
    }
}

function sectionCommand(
    id: string,
    title: string,
    icon: LucideIcon,
    go: (path: string) => void,
    t: Translator,
): BoundCommand {
    return bindStory(
        `section.${id}`,
        'repository',
        { title, section: 'repository', icon, run: () => go(`/fitloop/webapp/${id}`) },
        t,
    );
}

function viewCommand(id: string, title: string, count: number | null, go: (path: string) => void): Command {
    return {
        id: `project.goToView.${id}`,
        title,
        section: 'view',
        icon: Eye,
        count,
        run: () => go(`/orgs/skyline-labs/projects/4/views/${id}`),
    };
}

function myWorkPlace(id: string, title: string, path: string, count: number | null): NavigationPlace {
    return { id, group: 'goTo', kind: 'myWork', title, path, count };
}

/** Signs a user in whose GitHub answers the search with `answer`, and registers the command. */
function useRepositorySearchStory(answer: () => Promise<RepositoryBrowseSearchQuery>) {
    useContainer().set(
        Browser,
        createSignedInBrowser((_input, init) =>
            typeof init?.body === 'string' && init.body.includes('query RepositoryBrowseSearch')
                ? answer().then(data => Response.json({ data }))
                : Promise.resolve(Response.json({ message: 'Server Error' }, { status: 502 })),
        ),
    );
    const searchCommand = useRepositorySearchCommand();
    useCommands(() => [searchCommand()]);
}

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

function createLevelNavigation(say: (text: string) => void): NavigationData {
    return {
        ...NAVIGATION,
        places: [
            ...NAVIGATION.places.map((place): NavigationPlace => {
                switch (place.id) {
                    case 'repository:portal':
                        return {
                            ...place,
                            children: () => [
                                levelRow('pulls', 'Pull requests', say),
                                {
                                    ...levelRow('workflows', 'Workflows', say),
                                    children: () => [
                                        levelRow('deploy', 'Deploy', say),
                                        levelRow('nightly', 'Nightly', say),
                                    ],
                                },
                            ],
                            foundAlone: () => [],
                        };
                    case 'project:q4':
                        return {
                            ...place,
                            children: () => [
                                levelRow('board', 'Board', say),
                                {
                                    id: 'iterations',
                                    title: 'Iterations',
                                    section: 'app',
                                    children: () => [levelRow('current', 'Current iteration', say)],
                                },
                            ],
                        };
                    default:
                        return place;
                }
            }),
            // E13: a place that is only a level, Enter opening it.
            {
                id: 'repositories',
                group: 'goTo',
                kind: 'repositories',
                title: 'Repositories',
                count: 1,
                placeholder: 'Filter repositories…',
                children: () => [levelRow('repository:portal', 'skyline-labs/portal', say)],
                foundAlone: () => [],
            },
        ],
        repositoryChildren: nameWithOwner => [levelRow('pulls', `Pull requests of ${nameWithOwner}`, say)],
    };
}

function createLevelCommands(say: (text: string) => void, t: Translator): BoundCommand[] {
    return [
        bindStory(
            'appearance',
            'app',
            {
                title: 'Appearance',
                section: 'app',
                children: () => [
                    {
                        id: 'theme',
                        title: 'Theme…',
                        section: 'app',
                        options: () => ({
                            options: [
                                { value: 'graphite', label: 'Graphite', pick: () => say('Graphite') },
                                { value: 'paper', label: 'Paper', pick: () => say('Paper') },
                            ],
                        }),
                    },
                    {
                        id: 'find',
                        title: 'Find a theme…',
                        section: 'app',
                        search: text => say(`Searched "${text}"`),
                        options: () => ({ options: [] }),
                    },
                ],
            },
            t,
        ),
        // A screen's action with a key and a level of its own, as the review's Go to file (commands D15).
        bindCommand(
            defineAppCommand({ id: 'follow', title: () => 'Follow people…', key: 'Mod+P', places: ['review'] }),
            {
                title: 'Follow people…',
                section: 'app',
                options: () => ({
                    several: true,
                    options: [
                        { value: 'ada', label: 'Ada', pick: () => say('Ada') },
                        { value: 'grace', label: 'Grace', pick: () => say('Grace') },
                    ],
                }),
            },
            t,
        ),
    ];
}

function levelRow(id: string, title: string, say: (text: string) => void): Command {
    return { id, title, section: 'app', run: () => say(title) };
}

/**
 * "Run workflow" (W36, W37) with Deploy — whose `version` input a `v1` ref doesn't have — and Release, which has no
 * `workflow_dispatch` trigger. Running says what it was given.
 */
function createRunWorkflowCommand(say: (text: string) => void, t: Translator): BoundCommand {
    const hint = `Runs on GitHub as ${SAMPLE_VIEWER.login}`;
    const refField: CommandFormField = {
        kind: 'text',
        name: 'ref',
        detail: 'branch or tag',
        hint: 'the default branch',
        default: 'main',
        required: true,
    };
    const version: CommandFormField = { kind: 'text', name: 'version', detail: 'string', hint: 'optional' };
    return bindStory(
        'runWorkflow',
        'app',
        {
            title: 'Run workflow',
            section: 'app',
            icon: Play,
            children: () => [
                {
                    id: 'deploy',
                    title: 'Deploy',
                    section: 'app',
                    form: values => ({
                        heading: 'Ref and inputs',
                        context: 'fitloop/webapp',
                        submitLabel: 'Run',
                        hint,
                        fields: [
                            refField,
                            {
                                kind: 'choice',
                                name: 'environment',
                                detail: 'choice',
                                hint: 'default: staging',
                                options: ['staging', 'production'],
                                default: 'staging',
                            },
                            ...(values.ref === 'v1' ? [] : [version]),
                            {
                                kind: 'boolean',
                                name: 'dry_run',
                                detail: 'boolean',
                                hint: 'default: true',
                                default: true,
                            },
                        ],
                        submit: entered => say(`Deploy ${JSON.stringify(entered)}`),
                    }),
                },
                {
                    id: 'release',
                    title: 'Release',
                    section: 'app',
                    form: () => ({
                        heading: 'Ref and inputs',
                        context: 'fitloop/webapp',
                        submitLabel: 'Run',
                        hint,
                        fields: [refField],
                        message: 'This ref has no workflow_dispatch trigger',
                        submit: entered => say(`Release ${JSON.stringify(entered)}`),
                    }),
                },
            ],
        },
        t,
    );
}

/** W48 and W36 (`repositoryWorkflows`): running says which workflow ran. */
function createRepositoryWorkflowCommands(say: (text: string) => void, t: Translator): BoundCommand[] {
    return [
        bindStory(
            'runWorkflow',
            'workflows',
            {
                title: 'Run workflow · CLA',
                section: 'view',
                icon: Play,
                unavailable: 'CLA has no workflow_dispatch trigger',
                hint: 'Enter picks another workflow',
                run: () => say('CLA ran'),
            },
            t,
        ),
        bindStory(
            'runWorkflow',
            'app',
            {
                title: 'Run workflow',
                section: 'app',
                icon: Play,
                start: 'webapp',
                placeholder: 'Pick a repository…',
                levelHint: 'Run workflow · step 1 of 3',
                children: () => [
                    {
                        id: 'webapp',
                        title: 'fitloop/webapp',
                        section: 'app',
                        group: 'Tracked repositories',
                        message: 'Reading the workflow files…',
                        children: () => [],
                    },
                    {
                        id: 'docs',
                        title: 'fitloop/docs',
                        section: 'app',
                        group: 'Nothing to run',
                        unavailable: 'no workflow with workflow_dispatch',
                    },
                    {
                        id: 'api',
                        title: 'fitloop/api',
                        section: 'app',
                        group: 'Tracked repositories',
                        placeholder: 'Pick a workflow…',
                        levelHint: 'Only workflows with workflow_dispatch · 1 of 2',
                        children: () => [
                            {
                                id: 'deploy',
                                title: 'Deploy',
                                section: 'app',
                                group: 'Workflows in fitloop/api you can run',
                                run: () => say('api Deploy ran'),
                            },
                        ],
                    },
                ],
            },
            t,
        ),
    ];
}

/** A binding of the story's own command: its title is the definition's too. */
type StoryBinding = CommandBinding<readonly [CommandPlace]> & { readonly title: string };

/** The parts of a place as its screen gives them, and what the screen registers of them. */
interface StoryParts {
    readonly parts: CommandParts;
    readonly registered: readonly BoundCommand[];
}

/** A command of the story, on a definition of its own made for it: the registry takes only bound commands. */
function bindStory(id: string, place: CommandPlace, binding: StoryBinding, t: Translator): BoundCommand {
    return bindCommand(defineAppCommand({ id, title: () => binding.title, places: [place] }), binding, t);
}
