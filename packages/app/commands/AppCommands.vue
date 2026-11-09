<!-- The app's own actions and the two sheets that show them all, for the shell: ⌘K opens the command menu wherever the user is, `?` the keyboard help, `C` a new issue in the quick capture (H1) — in the repository of the screen, offered as a sub-issue of the issue open (H6), else in the repository used last; a project's screen registers its own `C` (H5) — and `,` Settings. The menu's top holds what is in context, what the sidebar shows and what the app proposes now (D36); the rest hangs under a parent. On any screen that belongs to a repository — its view, an item's page or the item opened over a list, a workflow's run, its settings — the repository's own actions as a group headed by its name (`repository`, `useRepositoryCommands`): its page on GitHub, copying its link, "Repository settings" while tracked (typing "settings" still finds the app's first), off its view, which registers its sections on `1`–`4` itself, its sections too, and last, so that a plain Enter cannot start it, "Track repository" while it is not tracked (D34); "Stop tracking" is not offered (D32). While an update is ready "Restart to update" (U1), after a failed install "Try again to install the update" (U40), with "Update later" beside them while the status bar's segment shows, each only while it can run (D18). The places it goes to: my work and its groups, the draft reviews, the broken workflows (actions W2, reached from here while the sidebar does not show them), the tracked projects and repositories, and Settings. Each of the last three holds a level: Settings its sections, with "Sign out" under Account and, in the desktop app, "Check for updates" and on macOS and Linux "Switch to Stable" or "Switch to Development", whichever isn't chosen, under Updates; a project its saved views, which typing finds on their own, and its actions; a repository, tracked or an `owner/name` typed (J5), its sections and actions, which typing finds only with its name. The menu finds items kept in the local copy and goes there at once; an item opens as items open from lists (over the screen, or on its page); "Search repositories…" asks GitHub from its submenu (E7–E10). "Documentation", beside "Keyboard shortcuts" among the app's own, opens the docs in a new tab (`DOCS_URL`; in the desktop app githq.dev's, in the system browser). In the web builds "Open in desktop app" opens the screen in the githq desktop app. The merge panel lives here too, over every screen, open for whatever `MergePanelStore` names. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  BookMarked,
  BookOpen,
  CircleArrowDown,
  CircleHelp,
  CircleUser,
  Clock,
  CloudUpload,
  Command as CommandIcon,
  Eye,
  FileDiff,
  GitBranch,
  LogOut,
  PanelsTopLeft,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Settings,
  SquareKanban,
  SquarePen,
} from 'lucide-vue-next';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import { useOpenInDesktopCommand } from '@/desktopLinks/useOpenInDesktopCommand.js';
import { ItemResolver } from '@/item/ItemResolver.js';
import { formatShortReference, getOpenedItemRoute } from '@/item/itemRoutes.js';
import { useOpenItem } from '@/item/useOpenItem.js';
import { DOCS_URL } from '@/landing/landingLinks.js';
import MergePanelHost from '@/merge/MergePanelHost.vue';
import * as groupLabels from '@/myWork/MyWorkGroupLabel.loc.js';
import { getDraftReviews } from '@/myWork/getDraftReviews.js';
import { DRAFT_REVIEWS_PATH, getMyWorkGroupPath } from '@/myWork/myWorkRoutes.js';
import NewIssue from '@/newIssue/NewIssue.vue';
import { NewIssueComposer } from '@/newIssue/NewIssueComposer.js';
import { ProjectStore } from '@/projects/ProjectStore.js';
import { useProjectCommands } from '@/projects/useProjectCommands.js';
import { LastRepositoryTab } from '@/repository/LastRepositoryTab.js';
import { useRepositoryCommands } from '@/repository/useRepositoryCommands.js';
import { AppUpdate, isPrereleaseVersion } from '@/services/AppUpdate.js';
import type { UpdateState } from '@/services/AppUpdate.js';
import { Browser } from '@/services/Browser.js';
import * as settingsSectionLabels from '@/settings/SettingsSectionLabel.loc.js';
import type { SettingsSection } from '@/settings/settingsRoutes.js';
import { CONFIRM_STABLE_PATH, getSettingsPath, SETTINGS_PATH, SETTINGS_SECTIONS } from '@/settings/settingsRoutes.js';
import { isPendingItem } from '@/store/isPendingItem.js';
import { ItemStore } from '@/store/ItemStore.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import { PendingUntracks } from '@/tracking/PendingUntracks.js';
import { BROKEN_WORKFLOWS_PATH, getProjectPath } from '@/tracking/trackingRoutes.js';
import type { TrackedProject } from '@/tracking/TrackingTypes.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import * as l from './AppCommands.loc.js';
import CommandMenu from './CommandMenu.vue';
import { APP_KEYS, CommandRegistry, NEW_ISSUE_KEY } from './CommandRegistry.js';
import type { Command } from './CommandTypes.js';
import KeyHelp from './KeyHelp.vue';
import type { NavigationData, NavigationPlace, NavigationResult } from './searchNavigation.js';
import { useCommands } from './useCommands.js';
import { useRepositorySearchCommand } from './useRepositorySearchCommand.js';

const SETTINGS_SECTION_ICONS: Readonly<Record<SettingsSection, LucideIcon>> = {
  repositories: BookMarked,
  projects: SquareKanban,
  display: PanelsTopLeft,
  review: FileDiff,
  sync: CloudUpload,
  account: CircleUser,
  updates: CircleArrowDown,
  changelog: ScrollText,
};

const t = useTranslate();
const registry = useService(CommandRegistry);
const auth = useService(AuthStore);
const items = useService(ItemStore);
const pendingUntracks = useService(PendingUntracks);
const projects = useService(ProjectStore);
const resolver = useService(ItemResolver);
const composer = useService(NewIssueComposer);
const update = useService(AppUpdate);
const browser = useService(Browser);
const repositoryTabs = useService(LastRepositoryTab);
const route = useRoute();
const router = useRouter();
const openItem = useOpenItem();
const repositorySearchCommand = useRepositorySearchCommand();
const repositoryCommands = useRepositoryCommands();
const projectCommands = useProjectCommands();
// Opening the screen in the desktop app is for the web builds; the desktop build has none of it.
const openInDesktopCommand = !__DESKTOP__ ? useOpenInDesktopCommand() : null;

/** The repository a new issue starts in: the opened item's, or the one of a repository's view. */
const repository = computed(() => {
  const opened = getOpenedItemRoute(route);
  if (opened) {
    return `${opened.reference.owner}/${opened.reference.name}`;
  }

  const { owner, name } = route.params;
  return route.name === 'repository' && typeof owner === 'string' && typeof name === 'string'
    ? `${owner}/${name}`
    : null;
});

/**
 * The repository (`owner/name`) the screen belongs to, whose actions the menu offers: the one its address names (a
 * repository's view, an item's page, a workflow's run, its settings), else the one of the item opened over the screen;
 * `null` elsewhere.
 */
const contextRepository = computed(() => {
  const { owner, name } = route.params;
  if (typeof owner === 'string' && typeof name === 'string') {
    return `${owner}/${name}`;
  }

  const opened = getOpenedItemRoute(route);
  return opened ? `${opened.reference.owner}/${opened.reference.name}` : null;
});

const navigationData = computed((): NavigationData => ({
  places: getPlaces(),
  trackedRepositories: pendingUntracks.repositories.map(tracked => tracked.nameWithOwner),
  items: items.all,
  repositoryChildren,
}));
const enabledCommands = computed(() => registry.commands.filter(command => registry.isEnabled(command)));
const menuOpen = computed({
  get: () => registry.menu !== null,
  set: (open: boolean) => (open ? registry.openMenu() : registry.closeMenu()),
});
const helpOpen = computed({
  get: () => registry.helpOpen,
  set: (open: boolean) => registry.setHelpOpen(open),
});

useCommands(() => [
  {
    id: 'app.commandMenu',
    title: t(l.commandMenu),
    section: 'app',
    key: APP_KEYS.commandMenu,
    icon: CommandIcon,
    menu: false,
    run: () => registry.openMenu(),
  },
  {
    id: 'app.help',
    title: t(l.help),
    section: 'app',
    key: APP_KEYS.help,
    icon: CircleHelp,
    run: () => registry.setHelpOpen(true),
  },
  {
    id: 'app.documentation',
    title: t(l.documentation),
    section: 'app',
    icon: BookOpen,
    keywords: [t(l.docsKeyword), t(l.helpKeyword)],
    run: () => browser.openInNewTab(DOCS_URL),
  },
  {
    id: 'app.newIssue',
    title: t(l.newIssue),
    section: 'app',
    key: NEW_ISSUE_KEY,
    icon: SquarePen,
    keywords: [t(l.createKeyword)],
    run: startNewIssue,
  },
  {
    id: 'app.settings',
    title: t(l.settings),
    section: 'app',
    key: APP_KEYS.settings,
    icon: Settings,
    // The key and the help sheet's line: the menu offers Settings as a place, under "Go to" (E5).
    menu: false,
    run: () => {
      void router.push(SETTINGS_PATH);
    },
  },
  repositorySearchCommand(),
  ...(openInDesktopCommand ? [openInDesktopCommand()] : []),
  ...getUpdateCommands(),
]);

// The repository's own group follows the screen. Its view registers its sections, with their keys, itself.
useCommands(() => {
  const name = contextRepository.value;
  if (name === null) {
    return [];
  }

  const commands = repositoryCommands(name);
  const sections =
    route.name === 'repository' ? [] : [commands.issues, commands.pullRequests, commands.commits, commands.workflows];
  return [
    ...sections,
    { ...commands.openOnGitHub, detail: name },
    commands.copyLink,
    // "Settings" alone stays the app's: a repository is in context nearly always.
    { ...commands.settings, title: t(l.repositorySettings) },
    // Last, so that a plain Enter cannot start it.
    commands.track,
  ];
});

/** What the updater proposes now, each only while it can run (D18) — only ever in the desktop app (`AppUpdate`). */
function getUpdateCommands(): Command[] {
  const { state, offer } = update;
  if (state === null) {
    return [];
  }

  const commands: Command[] = [];
  const { activity } = state;
  if (activity.kind === 'ready') {
    commands.push({
      id: 'app.restartToUpdate',
      title: t(l.restartToUpdate),
      detail: t(l.updateVersion, { version: activity.version }),
      section: 'app',
      icon: CircleArrowDown,
      run: () => update.restart(),
    });
  }

  if (activity.kind === 'installFailed') {
    commands.push({
      id: 'app.retryInstall',
      title: t(l.retryInstall),
      detail: t(l.updateVersion, { version: activity.version }),
      section: 'app',
      icon: RotateCcw,
      run: () => update.restart(),
    });
  }

  // "Later" dismisses the update's toast and nothing else, so it goes with the toast.
  if (offer) {
    commands.push(getUpdateLaterCommand());
  }

  return commands;
}

/** What the Updates section holds, once the native side has told its state. */
function getUpdateChildren(): Command[] {
  const { state } = update;
  if (state === null) {
    return [];
  }

  const check: Command = {
    id: 'app.checkForUpdates',
    title: t(l.checkForUpdates),
    section: 'app',
    icon: RefreshCw,
    run: () => update.check(),
  };
  return state.canChoose ? [check, getSwitchCommand(state)] : [check];
}

/** To the stream not chosen. A Development build goes to Stable only through the confirmation in Settings (D5, U13). */
function getSwitchCommand(state: UpdateState): Command {
  if (state.stream === 'development') {
    return {
      id: 'app.switchToStable',
      title: t(l.switchToStable),
      section: 'app',
      icon: GitBranch,
      run: () => {
        if (isPrereleaseVersion(state.version)) {
          void router.push(CONFIRM_STABLE_PATH);
        } else {
          update.setStream('stable');
        }
      },
    };
  }

  return {
    id: 'app.switchToDevelopment',
    title: t(l.switchToDevelopment),
    section: 'app',
    icon: GitBranch,
    run: () => update.setStream('development'),
  };
}

function getUpdateLaterCommand(): Command {
  return {
    id: 'app.updateLater',
    title: t(l.updateLater),
    section: 'app',
    icon: Clock,
    run: () => update.later(),
  };
}

/** The quick capture with the defaults of the screen: its repository, and the issue open as the parent. */
function startNewIssue() {
  const opened = getOpenedItemRoute(route);
  const openedId = opened ? resolver.peek(opened.reference) : null;
  const item = openedId ? items.get(openedId) : undefined;
  composer.start({
    repository: repository.value,
    project: null,
    parent:
      item?.kind === 'issue' && !isPendingItem(item) ? { id: item.id, reference: formatShortReference(item) } : null,
  });
}

function getPlaces(): NavigationPlace[] {
  const places: NavigationPlace[] = [
    { id: 'myWork', group: 'goTo', kind: 'myWork', title: t(l.myWork), path: '/' },
    ...MY_WORK_GROUPS.map((group): NavigationPlace => ({
      id: `myWork:${group}`,
      group: 'goTo',
      kind: 'myWork',
      title: t(groupLabels[group]),
      detail: t(l.myWork),
      path: getMyWorkGroupPath(group),
    })),
    {
      id: 'workflows',
      group: 'goTo',
      kind: 'workflows',
      title: t(l.brokenWorkflows),
      path: BROKEN_WORKFLOWS_PATH,
    },
    {
      id: 'settings',
      group: 'goTo',
      kind: 'settings',
      title: t(l.settings),
      key: APP_KEYS.settings,
      path: SETTINGS_PATH,
      children: () => SETTINGS_SECTIONS.map(getSettingsRow),
    },
  ];
  if (getDraftReviews(items.all).length > 0) {
    places.unshift({
      id: 'draftReviews',
      group: 'goTo',
      kind: 'draftReviews',
      title: t(l.draftReviews),
      path: DRAFT_REVIEWS_PATH,
    });
  }

  for (const project of pendingUntracks.projects) {
    places.push({
      id: `project:${project.id}`,
      group: 'projects',
      kind: 'project',
      title: project.title,
      detail: project.owner,
      keywords: [project.owner],
      path: getProjectPath(project),
      children: () => getProjectChildren(project),
      foundAlone: () => getProjectViews(project),
    });
  }

  for (const tracked of pendingUntracks.repositories) {
    places.push({
      id: `repository:${tracked.nameWithOwner}`,
      group: 'repositories',
      kind: 'repository',
      title: tracked.nameWithOwner,
      path: repositoryTabs.getPath(tracked.nameWithOwner),
      children: () => repositoryChildren(tracked.nameWithOwner),
      foundAlone: () => [],
    });
  }

  return places;
}

function getSettingsRow(section: SettingsSection): Command {
  const row: Command = {
    id: `settings.${section}`,
    title: t(settingsSectionLabels[section]),
    section: 'app',
    icon: SETTINGS_SECTION_ICONS[section],
    run: () => void router.push(getSettingsPath(section)),
  };
  switch (section) {
    case 'account':
      return {
        ...row,
        children: () => [
          {
            id: 'app.signOut',
            title: t(l.signOut),
            section: 'app',
            icon: LogOut,
            run: () => auth.signOut(),
          },
        ],
      };
    case 'updates':
      // Not on the state: it is `null` until the native side first tells it, and the section is there all the same.
      return { ...row, children: getUpdateChildren };
    default:
      return row;
  }
}

function getProjectChildren(project: TrackedProject): Command[] {
  const commands = projectCommands(project);
  return [...getProjectViews(project), commands.newIssue, commands.openOnGitHub, commands.copyLink, commands.settings];
}

function getProjectViews(project: TrackedProject): Command[] {
  return (projects.get(project.id)?.views ?? []).map(view => ({
    id: `view:${view.id}`,
    title: view.name,
    detail: t(l.savedView),
    icon: Eye,
    section: 'view',
    run: () => void router.push(getProjectPath(project, view.number)),
  }));
}

/** A repository's level, tracked or not: `when` of each row says which it is offered. Track last, as in its group (D34). */
function repositoryChildren(nameWithOwner: string): Command[] {
  const commands = repositoryCommands(nameWithOwner);
  return [
    commands.issues,
    commands.pullRequests,
    commands.commits,
    commands.workflows,
    commands.newIssue,
    commands.openOnGitHub,
    commands.copyLink,
    commands.settings,
    commands.track,
  ];
}

function navigate(result: NavigationResult) {
  switch (result.kind) {
    case 'place':
      void router.push(result.place.path);
      return;
    case 'repository':
      void router.push(repositoryTabs.getPath(result.nameWithOwner));
      return;
    case 'item':
      openItem(result.item);
  }
}
</script>

<template>
  <CommandMenu
    v-model:open="menuOpen"
    :commands="registry.commands"
    :subject="registry.subject"
    :repository="contextRepository"
    :navigation="navigationData"
    :start-command-id="registry.menu?.commandId ?? null"
    @navigate="navigate"
  />
  <KeyHelp
    v-model:open="helpOpen"
    :commands="enabledCommands"
    :sheet="registry.keySheet"
  />
  <NewIssue />
  <MergePanelHost />
</template>
