<!-- The app's own actions and the two sheets that show them all, for the shell: ⌘K opens the command menu wherever the user is, `?` the keyboard help, `,` Settings, and "New issue" opens the quick capture (H1) — with no key (commands D7: a project's screen registers its own on `C`, H5) — in the repository of the screen, offered as a sub-issue of the issue open (H6), else in the repository used last. The menu's top holds what is in context, what the sidebar shows and what the app proposes now (D36); the rest hangs under a parent. On any screen that belongs to a repository — its view, an item's page or the item opened over a list, a workflow's run, its settings — the repository's own actions as a group headed by its name (`repository`, `useRepositoryCommands`): its page on GitHub, copying its link, "Repository settings" while tracked (typing "settings" still finds the app's first), off its view, which registers its sections on `1`–`4` itself, its sections too, and last, so that a plain Enter cannot start it, "Track repository" while it is not tracked (D34); "Stop tracking" is not offered (D32). While an update is ready "Restart to update" (U1), after a failed install "Try again to install the update" (U40), both on ⌥R whether or not the toast offering it shows, with "Update later" beside them while the status bar's segment shows, each only while it can run (D18), and, offered by the app now (`proposed`), listed with nothing typed where its other actions are found only by typing. The places it goes to: my work and its groups, the draft reviews, the broken workflows (actions W2, reached from here while the sidebar does not show them), the tracked projects and repositories, and Settings; with nothing typed the menu lists neither the projects nor the repositories, but "Go to" ends with "Repositories…" and "Projects…", levels holding them alphabetically. Each of the last three holds a level: Settings its sections, with "Sign out" under Account and, in the desktop app, "Check for updates" and on macOS and Linux "Switch to Stable" or "Switch to Development", whichever isn't chosen, under Updates; a project its saved views, which typing finds on their own, and its actions; a repository, tracked or an `owner/name` typed (J5), its sections and actions, which typing finds only with its name. The menu finds items kept in the local copy and goes there at once; an item opens as items open from lists (over the screen, or on its page); "Search repositories…" asks GitHub from its submenu (E7–E10). "Run workflow…" (W46, W36) picks a tracked repository — the screen's straight away, ⌫ showing the others —, one of its workflows that can be run by hand, and fills its form (`useRunWorkflowCommand`). "Documentation", beside "Keyboard shortcuts" among the app's own, opens the docs in a new tab (`DOCS_URL`; in the desktop app githq.dev's, in the system browser). In the web builds "Open in desktop app" opens the screen in the githq desktop app. The phone's command line on a list opens the menu with the place's parts first (`CommandRegistry.openParts`, mobile D17): the screen names them, and they are these same rows — a repository's sections, a project's saved views (`useProjectCommands`), My work and its groups (`useMyWorkPlaces`). The merge panel lives here too, over every screen, open for whatever `MergePanelStore` names. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import type { LucideIcon } from 'lucide-vue-next';
import { BookMarked, GitBranch, LogOut, RotateCcw, SquareKanban } from 'lucide-vue-next';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import { useOpenInDesktopCommand } from '@/desktopLinks/useOpenInDesktopCommand.js';
import { ItemResolver } from '@/item/ItemResolver.js';
import { IssueRoutes, formatShortReference, getOpenedItemRoute } from '@/item/itemRoutes.js';
import { useOpenItem } from '@/item/useOpenItem.js';
import { DOCS_URL } from '@/landing/docsUrl.js';
import MergePanelHost from '@/merge/MergePanelHost.vue';
import { getDraftReviews } from '@/myWork/getDraftReviews.js';
import { DRAFT_REVIEWS_PATH } from '@/myWork/myWorkRoutes.js';
import { useMyWorkPlaces } from '@/myWork/useMyWorkPlaces.js';
import NewIssue from '@/newIssue/NewIssue.vue';
import { NewIssueComposer } from '@/newIssue/NewIssueComposer.js';
import { useProjectCommands } from '@/projects/useProjectCommands.js';
import { LastRepositoryTab } from '@/repository/LastRepositoryTab.js';
import { useRepositoryCommands } from '@/repository/useRepositoryCommands.js';
import { AppUpdate, isPrereleaseVersion } from '@/services/AppUpdate.js';
import type { UpdateState } from '@/services/AppUpdate.js';
import { Browser } from '@/services/Browser.js';
import * as settingsSectionLabels from '@/settings/SettingsSectionLabel.loc.js';
import type { SettingsSection } from '@/settings/settingsRoutes.js';
import { CONFIRM_STABLE_PATH, getSettingsPath, SETTINGS_PATH, SETTINGS_SECTIONS } from '@/settings/settingsRoutes.js';
import { SETTINGS_SECTION_ICONS } from '@/settings/settingsSectionIcons.js';
import { isPendingItem } from '@/store/isPendingItem.js';
import { ItemStore } from '@/store/ItemStore.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import { PendingUntracks } from '@/tracking/PendingUntracks.js';
import { BROKEN_WORKFLOWS_PATH, getProjectPath } from '@/tracking/trackingRoutes.js';
import type { TrackedProject } from '@/tracking/TrackingTypes.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';
import { useRunWorkflowCommand } from '@/workflows/useRunWorkflowCommand.js';

import * as l from './AppCommands.loc.js';
import { bindCommand } from './bindCommand.js';
import CommandMenu from './CommandMenu.vue';
import { CommandRegistry } from './CommandRegistry.js';
import type { BoundCommand, Command } from './CommandTypes.js';
import {
  checkForUpdates,
  commandMenu,
  documentation,
  help,
  loadNewVersion,
  newIssue,
  settings,
  updateLater,
} from './definitions/index.js';
import KeyHelp from './KeyHelp.vue';
import { keyOf } from './keyOf.js';
import type { NavigationData, NavigationPlace, NavigationResult } from './searchNavigation.js';
import { useCommands } from './useCommands.js';
import { useRepositorySearchCommand } from './useRepositorySearchCommand.js';

const t = useTranslate();
const registry = useService(CommandRegistry);
const auth = useService(AuthStore);
const items = useService(ItemStore);
const pendingUntracks = useService(PendingUntracks);
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
const runWorkflowCommands = useRunWorkflowCommand();
const myWorkPlace = useMyWorkPlaces();
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
const subjectRemoved = computed({
  get: () => registry.subjectRemoved,
  set: (removed: boolean) => registry.setRemoved('subject', removed),
});
const repositoryRemoved = computed({
  get: () => registry.repositoryRemoved,
  set: (removed: boolean) => registry.setRemoved('repository', removed),
});
const helpOpen = computed({
  get: () => registry.helpOpen,
  set: (open: boolean) => registry.setHelpOpen(open),
});

useCommands(() => [
  // Held down, ⌘K opens the menu once rather than flickering it.
  bindCommand(commandMenu, { section: 'app', menu: false, once: true, run: () => registry.openMenu() }, t),
  bindCommand(help, { section: 'app', run: () => registry.setHelpOpen(true) }, t),
  bindCommand(documentation, { section: 'app', run: () => browser.openInNewTab(DOCS_URL) }, t),
  bindCommand(newIssue, { place: 'app', section: 'app', run: startNewIssue }, t),
  bindCommand(
    settings,
    {
      section: 'app',
      // The key and the help sheet's line: the menu offers Settings as a place, under "Go to" (E5).
      menu: false,
      run: () => void router.push(SETTINGS_PATH),
    },
    t,
  ),
  repositorySearchCommand(),
  runWorkflowCommands.anyWorkflow(registry.repositoryRemoved ? null : contextRepository.value),
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
  return [
    ...(route.name === 'repository' ? [] : commands.sections),
    { ...commands.openOnGitHub, detail: name },
    commands.copyLink,
    // "Settings" alone stays the app's: a repository is in context nearly always.
    { ...commands.settings, title: t(l.repositorySettings) },
    // Last, so that a plain Enter cannot start it.
    commands.track,
  ];
});

/** What the updater proposes now, each only while it can run (D18) — only ever in the desktop app (`AppUpdate`). */
function getUpdateCommands(): BoundCommand[] {
  const { state, offer } = update;
  if (state === null) {
    return [];
  }

  const commands: BoundCommand[] = [];
  const { activity } = state;
  // On its key whatever the toast does (`UpdateReadyToast` shows the key on its button and registers nothing): "Later"
  // puts off the toast, not the update.
  if (activity.kind === 'ready' || activity.kind === 'installFailed') {
    const failed = activity.kind === 'installFailed';
    commands.push(
      bindCommand(
        loadNewVersion,
        {
          place: 'app',
          title: t(failed ? l.retryInstall : l.restartToUpdate),
          detail: t(l.updateVersion, { version: activity.version }),
          section: 'app',
          proposed: true,
          icon: failed ? RotateCcw : undefined,
          run: () => update.restart(),
        },
        t,
      ),
    );
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

  // Without its key: that is the section's own, while it is shown (`UpdatesView`).
  const check: Command = {
    id: 'checkForUpdates',
    title: t(checkForUpdates.title),
    section: 'app',
    icon: checkForUpdates.icon,
    run: () => update.check(),
  };
  return state.canChoose ? [check, getSwitchCommand(state)] : [check];
}

/** To the stream not chosen. A Development build goes to Stable only through the confirmation in Settings (D5, U13). */
function getSwitchCommand(state: UpdateState): Command {
  const toStable = state.stream === 'development';
  return {
    id: 'switchStream',
    title: t(toStable ? l.switchToStable : l.switchToDevelopment),
    section: 'app',
    icon: GitBranch,
    run: () => {
      if (!toStable) {
        update.setStream('development');
      } else if (isPrereleaseVersion(state.version)) {
        void router.push(CONFIRM_STABLE_PATH);
      } else {
        update.setStream('stable');
      }
    },
  };
}

function getUpdateLaterCommand(): BoundCommand {
  return bindCommand(updateLater, { section: 'app', proposed: true, run: () => update.later() }, t);
}

/**
 * The quick capture with the defaults of the screen: its repository, and the issue open as the parent — none of either
 * once taken out of the command menu it ran from.
 */
function startNewIssue() {
  const opened = registry.subjectRemoved ? null : IssueRoutes.getOpened(route);
  const openedId = opened ? resolver.peek(opened.reference) : null;
  const item = openedId ? items.get(openedId) : undefined;
  composer.start({
    repository: registry.repositoryRemoved ? null : repository.value,
    project: null,
    parent:
      item?.kind === 'issue' && !isPendingItem(item) ? { id: item.id, reference: formatShortReference(item) } : null,
  });
}

function getPlaces(): NavigationPlace[] {
  const places: NavigationPlace[] = [
    myWorkPlace(null),
    ...MY_WORK_GROUPS.map(group => myWorkPlace(group)),
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
      title: t(settings.title),
      key: keyOf(settings),
      path: SETTINGS_PATH,
      children: getSettingsRows,
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

  const projects = pendingUntracks.projects
    .map((project): NavigationPlace => ({
      id: `project:${project.id}`,
      group: 'projects',
      kind: 'project',
      title: project.title,
      detail: project.owner,
      keywords: [project.owner],
      path: getProjectPath(project),
      children: () => getProjectChildren(project),
      foundAlone: () => getSavedViews(project),
    }))
    .toSorted((a, b) => a.title.localeCompare(b.title));
  const repositories = pendingUntracks.repositories
    .map((tracked): NavigationPlace => ({
      id: `repository:${tracked.nameWithOwner}`,
      group: 'repositories',
      kind: 'repository',
      title: tracked.nameWithOwner,
      path: repositoryTabs.getPath(tracked.nameWithOwner),
      children: () => repositoryChildren(tracked.nameWithOwner),
      foundAlone: () => [],
    }))
    .toSorted((a, b) => a.title.localeCompare(b.title));
  // The empty menu lists neither (E13): "Go to" ends with a level of each, found by typing as well.
  if (repositories.length > 0) {
    places.push({
      id: 'repositories',
      group: 'goTo',
      kind: 'repositories',
      title: t(l.repositoriesLevel),
      count: repositories.length,
      placeholder: t(l.filterRepositories),
      children: () => repositories.map(place => toPlaceRow(place, BookMarked)),
      foundAlone: () => [],
    });
  }

  if (projects.length > 0) {
    places.push({
      id: 'projects',
      group: 'goTo',
      kind: 'projects',
      title: t(l.projectsLevel),
      count: projects.length,
      placeholder: t(l.filterProjects),
      children: () => projects.map(place => toPlaceRow(place, SquareKanban)),
      foundAlone: () => [],
    });
  }

  places.push(...projects, ...repositories);
  return places;
}

/** A place as a row of a level: Enter goes there, Tab or → enter what it holds, as on its own line. */
function toPlaceRow(place: NavigationPlace, icon: LucideIcon): Command {
  const { path } = place;
  return {
    id: place.id,
    title: place.title,
    detail: place.detail,
    keywords: place.keywords,
    section: 'app',
    icon,
    run: path === undefined ? undefined : () => void router.push(path),
    children: place.children,
    foundAlone: place.foundAlone,
  };
}

/** Settings' sections, with no keys: those run only on Settings itself (`SettingsView`). */
function getSettingsRows(): Command[] {
  return SETTINGS_SECTIONS.map(section => ({
    id: `settings:${section}`,
    title: t(settingsSectionLabels[section]),
    section: 'app',
    icon: SETTINGS_SECTION_ICONS[section],
    run: () => void router.push(getSettingsPath(section)),
    children: getSectionChildren(section),
  }));
}

function getSectionChildren(section: SettingsSection): (() => Command[]) | undefined {
  switch (section) {
    case 'account':
      return () => [{ id: 'signOut', title: t(l.signOut), section: 'app', icon: LogOut, run: () => auth.signOut() }];
    case 'updates':
      // Not on the state: it is `null` until the native side first tells it, and the section is there all the same.
      return getUpdateChildren;
    default:
      return undefined;
  }
}

function getProjectChildren(project: TrackedProject): Command[] {
  const commands = projectCommands(project);
  return [...getSavedViews(project), commands.newIssue, commands.openOnGitHub, commands.copyLink, commands.settings];
}

/** A project's saved views, without their keys: those run only on the project's own screen. */
function getSavedViews(project: TrackedProject): Command[] {
  return projectCommands(project).savedViews.map(({ command }) => command);
}

/** A repository's level, tracked or not: `when` of each row says which it is offered. Track last, as in its group (D34). */
function repositoryChildren(nameWithOwner: string): Command[] {
  const commands = repositoryCommands(nameWithOwner);
  return [
    ...commands.sections,
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
      if (result.place.path !== undefined) {
        void router.push(result.place.path);
      }

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
    v-model:subject-removed="subjectRemoved"
    v-model:repository-removed="repositoryRemoved"
    :commands="registry.commands"
    :subject="registry.subject"
    :repository="contextRepository"
    :navigation="navigationData"
    :start-command-id="registry.menu?.commandId ?? null"
    :parts="registry.menu?.parts ?? null"
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
