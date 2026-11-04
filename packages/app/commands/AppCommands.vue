<!-- The app's own actions and the two sheets that show them all, for the shell: ⌘K opens the command menu wherever the user is, `?` the keyboard help, `C` a new issue in the quick capture (H1) — in the repository of the screen, offered as a sub-issue of the issue open (H6), else in the repository used last; a project's screen registers its own `C` (H5) — `,` Settings and "Sign out"; on any screen that belongs to a repository — its view, an item's page or the item opened over a list, a workflow's run, its settings — the repository's own actions as a group headed by its name (`repository`, `useRepositoryCommands`): its page on GitHub, copying its link, "Repository settings" while tracked (typing "settings" still finds the app's first), off its view, which registers its sections on `1`–`4` itself, its sections too, and last, so that a plain Enter cannot start it, "Track repository" while it is not tracked (D34); "Stop tracking" is not offered (D32); in the desktop app, while an update is ready, "Restart to update" and "Update later" (U1). Settings and each of its sections, and the broken workflows (actions W2, reached from here while the sidebar does not show them), are places it goes to. The menu finds places and items in the local copy — my work and its groups, the tracked projects and their saved views, the tracked repositories, the items kept — and goes there at once; an item opens as items open from lists (over the screen, or on its page), any `owner/name` typed opens that repository's screen (J5); "Search repositories…" asks GitHub from its submenu (E7–E10). The merge panel lives here too, over every screen, open for whatever `MergePanelStore` names. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import {
  CircleArrowDown,
  CircleHelp,
  Clock,
  Command as CommandIcon,
  LogOut,
  Settings,
  SquarePen,
} from 'lucide-vue-next';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import { ItemResolver } from '@/item/ItemResolver.js';
import { formatShortReference, getOpenedItemRoute } from '@/item/itemRoutes.js';
import { useOpenItem } from '@/item/useOpenItem.js';
import MergePanelHost from '@/merge/MergePanelHost.vue';
import * as groupLabels from '@/myWork/MyWorkGroupLabel.loc.js';
import { getMyWorkGroupPath } from '@/myWork/myWorkRoutes.js';
import NewIssue from '@/newIssue/NewIssue.vue';
import { NewIssueComposer } from '@/newIssue/NewIssueComposer.js';
import { ProjectStore } from '@/projects/ProjectStore.js';
import { LastRepositoryTab } from '@/repository/LastRepositoryTab.js';
import { useRepositoryCommands } from '@/repository/useRepositoryCommands.js';
import { AppUpdate } from '@/services/AppUpdate.js';
import * as settingsSectionLabels from '@/settings/SettingsSectionLabel.loc.js';
import { getSettingsPath, SETTINGS_PATH, SETTINGS_SECTIONS } from '@/settings/settingsRoutes.js';
import { isPendingItem } from '@/store/isPendingItem.js';
import { ItemStore } from '@/store/ItemStore.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import { PendingUntracks } from '@/tracking/PendingUntracks.js';
import { BROKEN_WORKFLOWS_PATH, getProjectPath } from '@/tracking/trackingRoutes.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import * as l from './AppCommands.loc.js';
import CommandMenu from './CommandMenu.vue';
import { APP_KEYS, CommandRegistry, NEW_ISSUE_KEY } from './CommandRegistry.js';
import type { Command } from './CommandTypes.js';
import KeyHelp from './KeyHelp.vue';
import type { NavigationData, NavigationPlace, NavigationResult } from './searchNavigation.js';
import { useCommands } from './useCommands.js';
import { useRepositorySearchCommand } from './useRepositorySearchCommand.js';

const t = useTranslate();
const registry = useService(CommandRegistry);
const auth = useService(AuthStore);
const items = useService(ItemStore);
const pendingUntracks = useService(PendingUntracks);
const projects = useService(ProjectStore);
const resolver = useService(ItemResolver);
const composer = useService(NewIssueComposer);
const update = useService(AppUpdate);
const repositoryTabs = useService(LastRepositoryTab);
const route = useRoute();
const router = useRouter();
const openItem = useOpenItem();
const repositorySearchCommand = useRepositorySearchCommand();
const repositoryCommands = useRepositoryCommands();

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
  {
    id: 'app.signOut',
    title: t(l.signOut),
    section: 'app',
    icon: LogOut,
    run: () => auth.signOut(),
  },
  repositorySearchCommand(),
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

/** "Restart to update" and "Update later" while an update is ready — only ever in the desktop app (`AppUpdate`). */
function getUpdateCommands(): Command[] {
  const version = update.readyVersion;
  if (version === null) {
    return [];
  }

  return [
    {
      id: 'app.restartToUpdate',
      title: t(l.restartToUpdate),
      detail: t(l.updateVersion, { version }),
      section: 'app',
      icon: CircleArrowDown,
      run: () => update.restart(),
    },
    {
      id: 'app.updateLater',
      title: t(l.updateLater),
      section: 'app',
      icon: Clock,
      run: () => update.later(),
    },
  ];
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
  ];
  for (const project of pendingUntracks.projects) {
    places.push({
      id: `project:${project.id}`,
      group: 'projects',
      kind: 'project',
      title: project.title,
      detail: project.owner,
      keywords: [project.owner],
      path: getProjectPath(project),
    });
    for (const view of projects.get(project.id)?.views ?? []) {
      places.push({
        id: `view:${view.id}`,
        group: 'projects',
        kind: 'view',
        title: `${project.title} · ${view.name}`,
        detail: t(l.savedView),
        path: getProjectPath(project, view.number),
      });
    }
  }

  for (const tracked of pendingUntracks.repositories) {
    places.push({
      id: `repository:${tracked.nameWithOwner}`,
      group: 'repositories',
      kind: 'repository',
      title: tracked.nameWithOwner,
      path: repositoryTabs.getPath(tracked.nameWithOwner),
    });
  }

  places.push(
    {
      id: 'settings',
      group: 'goTo',
      kind: 'settings',
      title: t(l.settings),
      key: APP_KEYS.settings,
      path: SETTINGS_PATH,
    },
    ...SETTINGS_SECTIONS.map((section): NavigationPlace => ({
      id: `settings:${section}`,
      group: 'goTo',
      kind: section,
      title: t(l.settingsSection, { section: t(settingsSectionLabels[section]) }),
      path: getSettingsPath(section),
    })),
  );
  return places;
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
  />
  <NewIssue />
  <MergePanelHost />
</template>
