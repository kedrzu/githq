import {
    AppWindow,
    BookOpen,
    CircleArrowDown,
    CircleHelp,
    Clock,
    Command as CommandIcon,
    PanelLeft,
    Plus,
    ScrollText,
    Search,
    Settings,
    SquarePen,
    Undo2,
} from 'lucide-vue-next';

import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './app.loc.js';

/**
 * A new issue in the quick capture (H1): in the repository of the screen, else the one used last; from a repository's
 * or a project's menu, in that one. No key (commands D7): only a project has `C`, {@link newIssueInProject}.
 */
export const newIssue = defineAppCommand({
    id: 'newIssue',
    title: l.newIssue,
    icon: SquarePen,
    keywords: [l.createKeyword],
    places: ['app', 'repository', 'project'],
});

/** Opens the command menu, or closes it: the one key the open menu still takes (`CommandRegistry`). */
export const commandMenu = defineAppCommand({
    id: 'commandMenu',
    title: l.commandMenu,
    icon: CommandIcon,
    key: 'Mod+K',
    places: ['app'],
});

/** Opens the keyboard help: what can run here, by its keys (`KeyHelp`). */
export const help = defineAppCommand({
    id: 'help',
    title: l.help,
    icon: CircleHelp,
    key: '?',
    places: ['app'],
});

/** Opens githq's documentation in a new tab (in the desktop app githq.dev's, in the system browser). */
export const documentation = defineAppCommand({
    id: 'documentation',
    title: l.documentation,
    icon: BookOpen,
    keywords: [l.docsKeyword, l.helpKeyword],
    places: ['app'],
});

/** Goes to Settings. The command menu offers Settings as a place, so the command is its key's alone. */
export const settings = defineAppCommand({
    id: 'settings',
    title: l.settings,
    icon: Settings,
    key: ',',
    places: ['app'],
});

/**
 * Collapses or expands the sidebar; the binding names which way it goes and gives its icon. A review's `Mod+B` (its
 * file list) takes the key there (commands D13).
 */
export const sidebar = defineAppCommand({
    id: 'sidebar',
    title: l.sidebar,
    icon: PanelLeft,
    key: 'Mod+B',
    places: ['app'],
});

/** Searches GitHub for any repository from its submenu (E6–E10), going to the one picked. */
export const searchRepositories = defineAppCommand({
    id: 'searchRepositories',
    title: l.searchRepositories,
    icon: Search,
    places: ['app'],
});

/** Opens the screen in the githq desktop app (web builds only). */
export const openInDesktop = defineAppCommand({
    id: 'openInDesktop',
    title: l.openInDesktop,
    icon: AppWindow,
    places: ['app'],
});

/**
 * Moves to the new version githq has: on the web a reload to the one deployed, in the desktop app a restart into the
 * update downloaded, or another try at installing it. One command (commands D1): the toast offering it runs it by its
 * key, the command menu offers it without, Settings' Updates section by the key too. The binding names what it does
 * there.
 */
export const loadNewVersion = defineAppCommand({
    id: 'loadNewVersion',
    title: l.loadNewVersion,
    icon: CircleArrowDown,
    key: 'Alt+R',
    places: ['app', 'settings'],
});

/** Puts off the update ready or failed: its toast goes until the next launch or check (U50). */
export const updateLater = defineAppCommand({
    id: 'updateLater',
    title: l.updateLater,
    icon: Clock,
    places: ['app'],
});

/** Goes to the changelog in Settings, from the toast saying the app was updated. */
export const whatChanged = defineAppCommand({
    id: 'whatChanged',
    title: l.whatChanged,
    icon: ScrollText,
    key: 'Alt+W',
    places: ['app'],
});

/** Goes to Sync settings, from the toast saying syncing the settings stopped (settings-sync T9). */
export const openSyncSettings = defineAppCommand({
    id: 'openSyncSettings',
    title: l.openSyncSettings,
    icon: Settings,
    key: 'Alt+S',
    places: ['app'],
});

/**
 * Selects in the list the items that failed of a change of several (K2), from the newest toast saying so: the list has no
 * key of its own for it.
 */
export const selectFailed = defineAppCommand({
    id: 'selectFailed',
    title: l.selectFailed,
    key: 'Alt+F',
    places: ['app'],
});

/** A new issue added to the project on screen (H5), its binding naming the project. */
export const newIssueInProject = defineAppCommand({
    id: 'newIssueInProject',
    title: l.newIssueInProject,
    icon: SquarePen,
    key: 'C',
    places: ['project'],
});

/**
 * Items already on GitHub added to the project on screen from the local copy, several in a row (K8), its binding
 * naming the project; the empty project opens its submenu too. In menus only.
 */
export const addItemsToProject = defineAppCommand({
    id: 'addItemsToProject',
    title: l.addItemsToProject,
    icon: Plus,
    places: ['project'],
});

/**
 * Back to the merge panel of a merge GitHub refused, its text kept (merging D15, PM35): the newest such toast's, never the
 * selected row's — `⇧M` is that.
 */
export const backToMerge = defineAppCommand({
    id: 'backToMerge',
    title: l.backToMerge,
    key: 'Alt+M',
    places: ['app'],
});

/** The branch of a merge confirmed in a toast deleted or restored (PM34): the toast's own, `⇧D` being the row's. */
export const mergedBranch = defineAppCommand({
    id: 'mergedBranch',
    title: l.mergedBranch,
    key: 'Alt+D',
    places: ['app'],
});

/**
 * Takes back what a toast says was just done, while it shows: a close or an untrack in the shell's toasts (`app`), a
 * discarded comment in a review's (`review`), whose ⌘Z goes first there (commands D13). The binding names what it takes
 * back.
 */
export const undo = defineAppCommand({
    id: 'undo',
    title: l.undo,
    icon: Undo2,
    key: 'Mod+Z',
    places: ['app', 'review'],
});
