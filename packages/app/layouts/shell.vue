<!-- The layout of the app's screens (`meta.layout: 'shell'`): `AppShell` with the signed-in user, GitHub's allowance, how fresh the screen is — a tracked repository's or project's own poll (a saved view GitHub answers says so), else my work's — and its counts for the sidebar, and the sidebar's collapsed state, which is remembered in this browser. An item the address opens over the screen (`?pane=issue&issue=owner|name|12`, GitHub's project pane) shows here — in the panel beside it, or in a modal, as this browser remembers (`ItemNavigation`) — so any list can open one; a tracked project or repository in the sidebar has its context menu; the command menu (⌘K) and the keyboard help (`?`) open over any screen; an item's own page is a screen of its own, and the screen's segment of the status bar then tells how fresh the item is. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import AppCommands from '@/commands/AppCommands.vue';
import { CommandRegistry } from '@/commands/CommandRegistry.js';
import { EditQueue } from '@/edits/EditQueue.js';
import EditToasts from '@/edits/EditToasts.vue';
import { useEditTexts } from '@/edits/useEditTexts.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { ItemResolver } from '@/item/ItemResolver.js';
import { getOpenedItemRoute } from '@/item/itemRoutes.js';
import OpenedItem from '@/item/OpenedItem.vue';
import { buildMyWork } from '@/myWork/buildMyWork.js';
import ProjectContextMenu from '@/projects/ProjectContextMenu.vue';
import { ProjectViewAnswers } from '@/projects/ProjectViewAnswers.js';
import RepositoryContextMenu from '@/repository/RepositoryContextMenu.vue';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { LocalPreferences } from '@/services/LocalPreferences.js';
import AppShell from '@/shell/AppShell.vue';
import type { SegmentEdits } from '@/shell/FreshnessSegment.vue';
import type { SidebarTracked, SidebarTrackedStatus } from '@/shell/Sidebar.vue';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Freshness } from '@/sync/Freshness.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import { TrackedItems } from '@/tracking/TrackedItems.js';
import { getProjectPath, getRepositoryPath } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import type { TrackedTarget, TrackingProgress } from '@/tracking/TrackingTypes.js';
import { haveOpenItemsArrived } from '@/tracking/utils/haveOpenItemsArrived.js';

defineSlots<{
  default(): unknown;
}>();

const auth = useService(AuthStore);
const rateLimits = useService(GitHubRateLimitStore);
const sync = useService(SyncEngine);
const items = useService(ItemStore);
const details = useService(ItemDetailStore);
const resolver = useService(ItemResolver);
const queue = useService(EditQueue);
const tracking = useService(TrackingStore);
const trackedItems = useService(TrackedItems);
const answers = useService(ProjectViewAnswers);
const editTexts = useEditTexts();
const registry = useService(CommandRegistry);
const preferences = useService(LocalPreferences);
const navigation = useService(ItemNavigation);
const route = useRoute();

const collapsed = preferences.sidebarCollapsed;

// The sidebar counts what the list of "my work" shows unfiltered (D11); nothing before the first download.
const myWorkCounts = computed(() =>
  items.getSyncState('myWork').lastSuccessAt === null
    ? null
    : buildMyWork({ membership: items.membership, getItem: id => items.get(id), filter: 'all', sort: 'updated' })
        .counts,
);

// Each tracked project and repository with its open items once they have arrived, else how far its download is.
const tracked = computed((): SidebarTracked => ({
  projects: tracking.projects.map(project => ({
    key: `project:${project.id}`,
    label: project.title,
    to: getProjectPath(project),
    target: { kind: 'project', id: project.id },
    status: getTrackedStatus(
      { kind: 'project', id: project.id },
      haveOpenItemsArrived(tracking.getSyncState({ kind: 'project', id: project.id })),
    ),
  })),
  repositories: tracking.repositories.map(repository => {
    const target: TrackedTarget = { kind: 'repository', nameWithOwner: repository.nameWithOwner };
    return {
      key: `repository:${repository.nameWithOwner}`,
      label: repository.nameWithOwner,
      to: getRepositoryPath(repository.nameWithOwner),
      target,
      status: getTrackedStatus(target, haveOpenItemsArrived(tracking.getSyncState(target))),
      isPrivate: trackedItems.isPrivate(repository.nameWithOwner),
    };
  }),
}));

// How fresh the screen is (D15): a tracked repository's or project's own poll — a saved view GitHub answers says
// so (K6); anything else shows what "my work" holds.
const screenFreshness = computed((): Freshness => {
  const { owner, name, number } = route.params;
  if (route.name === 'repository' && typeof owner === 'string' && typeof name === 'string') {
    const nameWithOwner = `${owner}/${name}`;
    if (tracking.isTracked({ kind: 'repository', nameWithOwner })) {
      return sync.getRepositoryFreshness(nameWithOwner);
    }
  }

  if (typeof route.name === 'string' && route.name.startsWith('project-')) {
    const project = tracking.projects.find(
      candidate => candidate.owner === owner && String(candidate.number) === number,
    );
    if (project) {
      const answered = answers.shown;
      return answered?.projectId === project.id ? answers.getFreshness(answered) : sync.getProjectFreshness(project.id);
    }
  }

  return sync.myWorkFreshness;
});

const opened = computed(() => getOpenedItemRoute(route));
/** How the item opened over the screen's list shows; `null` with none, or on the item's own page. */
const overList = computed(() => (opened.value && !opened.value.onPage ? navigation.listArrangement : null));
const openedId = computed(() => (opened.value ? (resolver.peek(opened.value.reference) ?? null) : null));
const lastFailure = computed(() => queue.failures.at(-1) ?? null);

// The user's edits (D15): the list's segment names the item being sent, the item's the fields.
const listEdits = computed((): SegmentEdits | null => {
  if (queue.pending.length > 0) {
    return { kind: 'sending', text: editTexts.sending(queue.pending) };
  }

  return lastFailure.value ? { kind: 'failed', text: editTexts.failed(lastFailure.value) } : null;
});
const itemEdits = computed((): SegmentEdits | null => {
  const id = openedId.value;
  if (id === null) {
    return null;
  }

  const pending = queue.pending.filter(edit => edit.itemId === id);
  if (pending.length > 0) {
    return { kind: 'sending', text: editTexts.sendingFields(pending) };
  }

  const failure = queue.failures.findLast(candidate => candidate.failed.some(failed => failed.edit.itemId === id));
  return failure ? { kind: 'failed', text: editTexts.failed(failure) } : null;
});
// How fresh the opened item's detail is (D15); nothing for an item GitHub says does not exist.
const itemFreshness = computed((): Freshness | null => {
  if (!opened.value) {
    return null;
  }

  const id = resolver.peek(opened.value.reference);
  if (id === null) {
    return null;
  }

  return id === undefined ? { kind: 'partial' } : details.getFreshness(id);
});

function getTrackedStatus(target: TrackedTarget, openArrived: boolean): SidebarTrackedStatus {
  const progress: TrackingProgress = tracking.getProgress(target);
  if (progress.state === 'hidden') {
    return { kind: 'hidden' };
  }

  if (openArrived) {
    return { kind: 'count', count: trackedItems.getOpenCount(target) };
  }

  return {
    kind: 'downloading',
    percent: progress.total ? Math.floor((progress.done / progress.total) * 100) : null,
  };
}

function showLastFailure() {
  if (lastFailure.value) {
    queue.setToast(lastFailure.value.id, true);
  }
}
</script>

<template>
  <!-- Signed out (the route guard is about to move on to sign-in), nothing of the shell is drawn. -->
  <AppShell
    v-if="auth.viewer"
    v-model:collapsed="collapsed"
    :viewer="auth.viewer"
    :rate-limit="rateLimits.get('graphql')"
    :notice="sync.notice"
    :last-refreshed-at="items.getSyncState('myWork').lastSuccessAt"
    :freshness="opened?.onPage ? (itemFreshness ?? screenFreshness) : screenFreshness"
    :item-freshness="opened?.onPage ? null : itemFreshness"
    :my-work-counts="myWorkCounts"
    :tracked="tracked"
    :edits="opened?.onPage ? (itemEdits ?? listEdits) : listEdits"
    :item-edits="opened?.onPage ? null : itemEdits"
    @sign-out="auth.signOut()"
    @search="registry.openMenu()"
    @show-failure="showLastFailure"
  >
    <slot />
    <template
      v-if="opened && overList === 'panel'"
      #panel
    >
      <OpenedItem
        :reference="opened.reference"
        arrangement="panel"
      />
    </template>
    <template #trackedMenu="{ target }">
      <RepositoryContextMenu
        v-if="target.kind === 'repository'"
        :name-with-owner="target.nameWithOwner"
      />
      <ProjectContextMenu
        v-else
        :project-id="target.id"
      />
    </template>
  </AppShell>
  <OpenedItem
    v-if="auth.viewer && opened && overList === 'modal'"
    :reference="opened.reference"
    arrangement="modal"
  />
  <EditToasts v-if="auth.viewer" />
  <AppCommands v-if="auth.viewer" />
</template>
