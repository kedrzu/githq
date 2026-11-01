<!-- The context menu of a list's rows (L1–L4): the actions that fit the item right-clicked — or the items selected together, only those that fit every one of them — under its reference ("3 issues · 2 repositories"). An issue: open it, its project fields and adding it to a project, assign, labels, milestone, type, comment, copy its link or reference, close as completed or not planned. A pull request: open its files on GitHub, ask for reviews, draft or ready, copy its branch, close — never merge (D6). Only what the user may do in that repository is offered, and one quiet line says what is left out and why. Every entry shows its key, so the menu also teaches the keyboard. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import {
  CircleCheckBig,
  CircleSlash,
  FileDiff,
  GitBranch,
  GitPullRequestClosed,
  Github,
  Hash,
  Info,
  Link,
  Maximize2,
  MessageSquare,
  PanelRight,
  RotateCcw,
  SquareKanban,
} from 'lucide-vue-next';
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import CommandMenuSections from '@/commands/CommandMenuSections.vue';
import type { Command, CommandOption } from '@/commands/CommandTypes.js';
import type { StateOption } from '@/commands/useEditCommands.js';
import { EDIT_KEYS, useEditCommands } from '@/commands/useEditCommands.js';
import MenuLabel from '@/components/MenuLabel.vue';
import MenuSeparator from '@/components/MenuSeparator.vue';
import type { EditRequest } from '@/edits/EditTypes.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { getItemMenuSections } from '@/item/getItemMenuSections.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { formatShortReference, getItemPagePath, getItemReference } from '@/item/itemRoutes.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import type { ItemDetailProject } from '@/store/ItemDetailTypes.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item } from '@/store/ItemTypes.js';
import { isPendingItem } from '@/store/isPendingItem.js';

import * as l from './ItemContextMenu.loc.js';

const props = defineProps<{
  /** The items it acts on: the one right-clicked, or those selected together. */
  ids: readonly string[];
}>();

const emit = defineEmits<{
  /** "Open": the one item opens as Enter opens it. */
  open: [];
}>();

const t = useTranslate();
const auth = useService(AuthStore);
const items = useService(ItemStore);
const repositories = useService(RepositoryStore);
const editor = useService(ItemEditor);
const navigation = useService(ItemNavigation);
const clock = useService(Clock);
const browser = useService(Browser);
const router = useRouter();
const editCommands = useEditCommands();

const selected = computed(() => props.ids.flatMap(id => items.get(id) ?? []));
const one = computed(() => (selected.value.length === 1 ? (selected.value[0] ?? null) : null));
/** The repositories of the items, each once (`owner/name`). */
const repositoryNames = computed(() => [...new Set(selected.value.map(item => item.repository.nameWithOwner))]);
const metadata = computed(() => repositoryNames.value.flatMap(name => repositories.get(name) ?? []));
/** The projects of the items the user may write to, each once. */
const places = computed(() => {
  const byProject = new Map<string, ItemDetailProject>();
  for (const item of selected.value) {
    for (const place of editor.getPlaces(item)) {
      if (place.viewerCanUpdate && !byProject.has(place.projectId)) {
        byProject.set(place.projectId, place);
      }
    }
  }

  return [...byProject.values()];
});

const heading = computed(() => {
  const item = one.value;
  if (item) {
    return `${item.repository.nameWithOwner}#${isPendingItem(item) ? '…' : item.number}`;
  }

  const count = selected.value.length;
  const repositoryCount = repositoryNames.value.length;
  const kinds = new Set(selected.value.map(candidate => candidate.kind));
  const what =
    kinds.size > 1 ? t(l.items, { count }) : kinds.has('issue') ? t(l.issues, { count }) : t(l.pulls, { count });
  return `${what} · ${t(l.repositories, { count: repositoryCount })}`;
});

const sections = computed(() =>
  getItemMenuSections([...getOwnCommands(), ...getEditCommands()], one.value?.kind ?? 'issue'),
);

/** What the user may not do here, said once: the one item's repository gives them too low a role. */
const note = computed(() => {
  const item = one.value;
  if (!item) {
    return null;
  }

  const permissions = editor.getPermissions(item);
  return permissions.labels ? null : t(l.needsTriage, { repository: item.repository.nameWithOwner });
});

// What the submenus offer, and what the user may do there, read for every repository of the items.
watch(
  repositoryNames,
  names => {
    for (const name of names) {
      void repositories.ensure(name);
    }
  },
  { immediate: true },
);

function getEditCommands(): Command[] {
  return editCommands({
    section: 'selection',
    items: selected.value,
    metadata: metadata.value,
    loading: metadata.value.length < repositoryNames.value.length,
    viewerLogin: auth.viewer?.login ?? '',
    getPermissions: item => editor.getPermissions(item),
    places: places.value,
    now: clock.now(),
    stateOptions: getStateOptions(),
    stateTitle: getStateTitle(),
    edit,
    setField: (place, field, value) =>
      one.value
        ? edit({ kind: 'projectField', projectItemId: place.itemId, fieldId: field.id, value })
        : edit({ kind: 'projectFieldInProject', projectId: place.projectId, fieldId: field.id, value }),
  });
}

/** Going to the items, writing about them, copying them, adding them to a project. */
function getOwnCommands(): Command[] {
  const item = one.value;
  const commands: Command[] = [
    {
      id: 'menu.openOnGitHub',
      title: t(l.openOnGitHub),
      section: 'item',
      key: 'O',
      icon: Github,
      detail: item ? undefined : t(l.tabs, { count: selected.value.length }),
      run: () => {
        for (const candidate of selected.value) {
          browser.openInNewTab(candidate.url);
        }
      },
    },
    {
      id: 'menu.copyLink',
      title: item ? t(l.copyLink) : t(l.copyLinks),
      section: 'item',
      icon: Link,
      run: () => copy(selected.value.map(candidate => candidate.url).join('\n')),
    },
  ];
  if (selected.value.some(candidate => editor.getPermissions(candidate).addToProject)) {
    commands.push({
      id: 'menu.addToProject',
      title: t(l.addToProject),
      section: 'item',
      icon: SquareKanban,
      prepare: () => void repositories.ensureViewerProjects(),
      options: () => ({ loading: repositories.viewerProjects === null, options: getProjectOptions() }),
    });
  }

  if (!item || isPendingItem(item)) {
    return commands;
  }

  commands.push(
    { id: 'menu.open', title: t(l.open), section: 'item', key: 'Enter', icon: PanelRight, run: () => emit('open') },
    {
      id: 'menu.openPage',
      title: t(l.openPage),
      section: 'item',
      icon: Maximize2,
      run: () => void router.push(getItemPagePath(getItemReference(item), item.kind)),
    },
  );
  if (editor.getPermissions(item).comment) {
    commands.push({
      id: 'menu.comment',
      title: t(l.comment),
      section: 'item',
      key: EDIT_KEYS.comment,
      icon: MessageSquare,
      run: () => {
        navigation.requestComment(item.id);
        emit('open');
      },
    });
  }

  if (item.kind === 'issue') {
    commands.push({
      id: 'menu.copyReference',
      title: t(l.copyReference),
      section: 'item',
      icon: Hash,
      detail: formatShortReference(item),
      run: () => copy(`${item.repository.nameWithOwner}#${item.number}`),
    });
  } else {
    commands.push(
      {
        id: 'menu.openFiles',
        title: t(l.openFiles),
        section: 'item',
        key: 'Shift+O',
        icon: FileDiff,
        run: () => browser.openInNewTab(`${item.url}/files`),
      },
      {
        id: 'menu.copyBranch',
        title: t(l.copyBranch),
        section: 'item',
        icon: GitBranch,
        detail: item.headRefName,
        run: () => copy(item.headRefName),
      },
    );
  }

  return commands;
}

/** Close the open ones — a pull request alone without a reason — or reopen them when all are closed. */
function getStateOptions(): StateOption[] {
  const closable = selected.value.filter(item => editor.getPermissions(item).state);
  if (closable.length === 0) {
    return [];
  }

  if (closable.every(item => item.state !== 'OPEN')) {
    return [{ key: 'reopen', text: t(l.reopen), icon: RotateCcw, request: { kind: 'reopen' } }];
  }

  if (one.value?.kind === 'pullRequest') {
    return [
      {
        key: 'close',
        text: t(l.closePullRequest),
        icon: GitPullRequestClosed,
        request: { kind: 'close', reason: 'COMPLETED' },
      },
    ];
  }

  return [
    {
      key: 'completed',
      text: t(l.closeCompleted),
      icon: CircleCheckBig,
      request: { kind: 'close', reason: 'COMPLETED' },
    },
    {
      key: 'notPlanned',
      text: t(l.closeNotPlanned),
      icon: CircleSlash,
      request: { kind: 'close', reason: 'NOT_PLANNED' },
    },
  ];
}

function getStateTitle() {
  const item = one.value;
  if (selected.value.every(candidate => candidate.state !== 'OPEN')) {
    return t(l.reopen);
  }

  if (!item) {
    return t(l.closeItems, { count: selected.value.length });
  }

  return item.kind === 'issue' ? t(l.closeIssue) : t(l.closePullRequest);
}

/** The projects not every one of the items is in already. */
function getProjectOptions(): CommandOption[] {
  return (repositories.viewerProjects ?? [])
    .filter(
      project =>
        !project.closed && !selected.value.every(item => item.projects.some(place => place.projectId === project.id)),
    )
    .map(project => ({
      value: project.id,
      label: project.title,
      detail: project.owner,
      pick: () => edit({ kind: 'addToProject', project }),
    }));
}

function edit(request: EditRequest) {
  void editor.edit(props.ids, request);
}

function copy(text: string) {
  void navigator.clipboard.writeText(text);
}
</script>

<template>
  <!-- A project's draft issue is not an item of the local copy: nothing to offer here. -->
  <MenuLabel v-if="selected.length === 0">{{ t(l.nothing) }}</MenuLabel>
  <MenuLabel v-else>
    <span :class="css.itemContextMenu_heading">{{ heading }}</span>
  </MenuLabel>
  <CommandMenuSections :sections="sections" />
  <template v-if="note">
    <MenuSeparator />
    <p :class="css.itemContextMenu_note">
      <Info
        :class="css.itemContextMenu_noteIcon"
        aria-hidden="true"
      />
      {{ note }}
    </p>
  </template>
</template>

<style lang="scss" module="css">
.itemContextMenu_heading {
  font-family: $font-family-mono;
}

.itemContextMenu_note {
  display: flex;
  gap: $spacing-8;
  align-items: flex-start;
  max-width: 264px;
  padding: $spacing-6 $spacing-8;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.itemContextMenu_noteIcon {
  flex: none;
  width: 13px;
  height: 13px;
  margin-top: 1px;
}
</style>
