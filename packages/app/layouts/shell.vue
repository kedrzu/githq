<!-- The layout of the app's screens (`meta.layout: 'shell'`): `AppShell` with the signed-in user, GitHub's allowance, how fresh the screen is — a repository's commit graph on its Commits section, a tracked repository's or project's own poll (a saved view GitHub answers says so; its Workflows section how far the first read of its runs is, and a run's page too unless its log's state has more to say), the workflows' poll on the broken workflows, else my work's — and its counts for the sidebar, the entry "Broken workflows" and each repository's marker of its workflows, and the sidebar's collapsed state, which is remembered in this browser, and whether syncing the settings stopped (the avatar's dot, the toast telling why once), the toast of an untrack that can still be undone (above the route, so moving between screens keeps it), and the toasts of failed edits and of merges the user moved on from (merging D15), and of a run's failed jobs that did not re-run (actions W4l), and in the status bar a merge GitHub has not said the end of, in grey, until the next refresh settles it (PM36). An item the address opens over the screen (`?pane=issue&issue=owner|name|12`, GitHub's project pane) shows here — in the panel beside it, or in a modal, as this browser remembers (`ItemNavigation`), the shell under it inert — so any list can open one; a tracked project or repository in the sidebar has its context menu; the command menu (⌘K) and the keyboard help (`?`) open over any screen; an item's own page is a screen of its own, and the screen's segment of the status bar then tells how fresh the item is. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import AppCommands from '@/commands/AppCommands.vue';
import { CommandRegistry } from '@/commands/CommandRegistry.js';
import { CommitGraphStore } from '@/commits/CommitGraphStore.js';
import Toaster from '@/components/Toaster.vue';
import { EditQueue } from '@/edits/EditQueue.js';
import CloseToasts from '@/edits/CloseToasts.vue';
import EditToasts from '@/edits/EditToasts.vue';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { useEditTexts } from '@/edits/useEditTexts.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { ItemResolver } from '@/item/ItemResolver.js';
import { getOpenedItemRoute } from '@/item/itemRoutes.js';
import OpenedItem from '@/item/OpenedItem.vue';
import { getPullRequestCommands } from '@/merge/getPullRequestCommands.js';
import { MergeContext } from '@/merge/MergeContext.js';
import { MergePanelStore } from '@/merge/MergePanelStore.js';
import MergeToasts from '@/merge/MergeToasts.vue';
import { PullRequestCommands } from '@/merge/PullRequestCommands.js';
import { buildMyWork } from '@/myWork/buildMyWork.js';
import ProjectContextMenu from '@/projects/ProjectContextMenu.vue';
import { ProjectViewAnswers } from '@/projects/ProjectViewAnswers.js';
import { BrowsedRepositories } from '@/repos/BrowsedRepositories.js';
import { LastRepositoryTab } from '@/repository/LastRepositoryTab.js';
import RepositoryContextMenu from '@/repository/RepositoryContextMenu.vue';
import { SettingsSync } from '@/settings/sync/SettingsSync.js';
import SyncStoppedToast from '@/settings/SyncStoppedToast.vue';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { LocalPreferences } from '@/services/LocalPreferences.js';
import AppShell from '@/shell/AppShell.vue';
import { getNewestEdits } from '@/shell/getNewestEdits.js';
import type { DatedSegmentEdits } from '@/shell/getNewestEdits.js';
import type { SegmentEdits } from '@/shell/SegmentEdits.js';
import type { SidebarTracked, SidebarTrackedStatus } from '@/shell/Sidebar.vue';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import { groupStacks } from '@/store/stacks/groupStacks.js';
import type { Freshness } from '@/sync/Freshness.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import { PendingUntracks } from '@/tracking/PendingUntracks.js';
import { TrackedItems } from '@/tracking/TrackedItems.js';
import {
  getProjectPath,
  getRepositorySection,
  getRouteNameWithOwner,
  isWorkflowRunRoute,
} from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import type { TrackedTarget, TrackingProgress } from '@/tracking/TrackingTypes.js';
import TrackFailedToast from '@/tracking/TrackFailedToast.vue';
import UntrackToast from '@/tracking/UntrackToast.vue';
import { haveOpenItemsArrived } from '@/tracking/utils/haveOpenItemsArrived.js';
import { releaseTabFocus, useTabFocus } from '@/utils/useTabFocus.js';
import { useWorkflowRerunTexts } from '@/workflows/useWorkflowRerunTexts.js';
import { getSidebarBrokenWorkflows } from '@/workflows/utils/getSidebarBrokenWorkflows.js';
import { getSidebarWorkflowMarker } from '@/workflows/utils/getSidebarWorkflowMarker.js';
import WorkflowRerunToast from '@/workflows/WorkflowRerunToast.vue';
import { WorkflowRunStore } from '@/workflows/WorkflowRunStore.js';
import { WorkflowStore } from '@/workflows/WorkflowStore.js';

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
const browsed = useService(BrowsedRepositories);
const pendingUntracks = useService(PendingUntracks);
const trackedItems = useService(TrackedItems);
const answers = useService(ProjectViewAnswers);
const editTexts = useEditTexts();
const rerunTexts = useWorkflowRerunTexts();
const registry = useService(CommandRegistry);
const preferences = useService(LocalPreferences);
const navigation = useService(ItemNavigation);
const settingsSync = useService(SettingsSync);
const workflows = useService(WorkflowStore);
const workflowRuns = useService(WorkflowRunStore);
const repositoryTabs = useService(LastRepositoryTab);
const commitGraphs = useService(CommitGraphStore);
const route = useRoute();
const editor = useService(ItemEditor);
const mergePanel = useService(MergePanelStore);
const pullRequestCommands = useService(PullRequestCommands);

useTabFocus();
// Another screen: the keys are its list's again, whatever Tab focused on the last one.
watch(
  () => route.path,
  () => releaseTabFocus(),
);

// Merging from the screens' lists (merging D9): the rows and keys of a pull request the viewer may merge offer it.
provideContext(MergeContext, {
  canOpen: id => {
    const item = items.get(id);
    return item?.kind === 'pullRequest' && editor.getPermissions(item).mergePanel;
  },
  open: (id, options) => mergePanel.open(id, options),
  getRecord: id => mergePanel.getRecord(id),
  getCommands: id => {
    const item = details.getItem(id);
    return item?.kind === 'pullRequest'
      ? getPullRequestCommands({
          pr: item,
          permissions: editor.getPermissions(item),
          items: items.all,
          outcomeUnknown: mergePanel.isOutcomeUnknown(item.id),
        })
      : [];
  },
  run: (id, command) => {
    const item = details.getItem(id);
    if (item?.kind === 'pullRequest') {
      void pullRequestCommands.run(item, command);
    }
  },
});

const collapsed = preferences.sidebarCollapsed;

// The sidebar counts what the list of "my work" shows unfiltered (D11); nothing before the first download.
const myWorkCounts = computed(() =>
  items.getSyncState('myWork').lastSuccessAt === null
    ? null
    : buildMyWork({
        membership: items.membership,
        getItem: id => items.get(id),
        stacks: groupStacks(items.all),
        filter: 'all',
        sort: 'updated',
      }).counts,
);

// Each tracked project and repository — not one being untracked, with Undo on offer — with its open items once they have arrived, else how far its download is.
const tracked = computed((): SidebarTracked => ({
  projects: pendingUntracks.projects.map(project => ({
    key: `project:${project.id}`,
    label: project.title,
    to: getProjectPath(project),
    target: { kind: 'project', id: project.id },
    status: getTrackedStatus(
      { kind: 'project', id: project.id },
      haveOpenItemsArrived(tracking.getSyncState({ kind: 'project', id: project.id })),
    ),
  })),
  repositories: pendingUntracks.repositories.map(repository => {
    const target: TrackedTarget = { kind: 'repository', nameWithOwner: repository.nameWithOwner };
    return {
      key: `repository:${repository.nameWithOwner}`,
      label: repository.nameWithOwner,
      to: repositoryTabs.getPath(repository.nameWithOwner),
      target,
      status: getTrackedStatus(target, haveOpenItemsArrived(tracking.getSyncState(target))),
      isPrivate: trackedItems.isPrivate(repository.nameWithOwner) === true,
      workflowMarker: getSidebarWorkflowMarker(workflows.getState(repository.nameWithOwner)),
    };
  }),
}));

// The entry "Broken workflows" (actions W1): only while something is known broken, or on its own screen.
const brokenWorkflows = computed(() => getSidebarBrokenWorkflows(workflows.totals, route.name === 'workflows'));

// How fresh the screen is (D15): a repository's commit graph its refs as last read, tracked or not (git-client D9); a
// tracked repository's or project's own poll — a saved view GitHub answers says so (K6); an untracked repository's item
// section the reads of the screen browsing it (D34); the broken workflows and a repository's Workflows section their own
// poll; anything else shows what "my work" holds.
const screenFreshness = computed((): Freshness => {
  if (route.name === 'workflows') {
    return sync.getWorkflowsFreshness();
  }

  const { owner, name, number } = route.params;
  if (isWorkflowRunRoute(route)) {
    return workflowRuns.pageFreshness ?? sync.getRepositoryWorkflowsFreshness(getRouteNameWithOwner(route));
  }

  if (route.name === 'repository' && typeof owner === 'string' && typeof name === 'string') {
    const nameWithOwner = `${owner}/${name}`;
    const shown = repositoryTabs.getShown(nameWithOwner, getRepositorySection(route.params.section));
    if (shown === 'commits') {
      return commitGraphs.getFreshness(nameWithOwner);
    }

    if (tracking.isTracked({ kind: 'repository', nameWithOwner })) {
      return shown === 'workflows'
        ? sync.getRepositoryWorkflowsFreshness(nameWithOwner)
        : sync.getRepositoryFreshness(nameWithOwner);
    }

    if (shown !== 'workflows') {
      return browsed.getFreshness(nameWithOwner, shown);
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

// The user's edits (D15): the list's segment names the item being sent, the item's the fields. A merge GitHub has not
// said the end of is grey until the next refresh settles it (merging PM36); it and a failure, the newer one says it. A
// run's re-run that failed is said the same way, though it is no edit (actions W4l).
const listEdits = computed((): SegmentEdits | null => {
  if (queue.pending.length > 0) {
    return { kind: 'sending', text: editTexts.sending(queue.pending) };
  }

  const unansweredId = mergePanel.unanswered.at(-1);
  const pr = unansweredId === undefined ? undefined : details.getItem(unansweredId);
  const record = unansweredId === undefined ? null : mergePanel.getRecord(unansweredId);
  const unanswered: DatedSegmentEdits | null =
    pr && record
      ? {
          edits: { kind: 'unanswered', text: editTexts.unanswered(`${pr.repository.nameWithOwner}#${pr.number}`) },
          at: record.at,
        }
      : null;
  const failure = lastFailure.value;
  const failed: DatedSegmentEdits | null = failure
    ? { edits: { kind: 'failed', text: editTexts.failed(failure) }, at: failure.at }
    : null;
  const rerun = workflowRuns.rerunFailure;
  const rerunFailed: DatedSegmentEdits | null = rerun
    ? { edits: { kind: 'failed', text: rerunTexts.segment(rerun) }, at: rerun.at }
    : null;
  return getNewestEdits([unanswered, failed, rerunFailed]);
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

  const record = mergePanel.unanswered.includes(id) ? mergePanel.getRecord(id) : null;
  const unanswered: DatedSegmentEdits | null = record
    ? { edits: { kind: 'unanswered', text: editTexts.unanswered(null) }, at: record.at }
    : null;
  const failure = queue.failures.findLast(candidate => candidate.failed.some(failed => failed.edit.itemId === id));
  const failed: DatedSegmentEdits | null = failure
    ? { edits: { kind: 'failed', text: editTexts.failed(failure) }, at: failure.at }
    : null;
  return getNewestEdits([unanswered, failed]);
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
  const failure = lastFailure.value;
  const rerun = workflowRuns.rerunFailure;
  if (rerun && (!failure || rerun.at > failure.at)) {
    workflowRuns.setRerunToast(true);
  } else if (failure) {
    queue.setToast(failure.id, true);
  }
}
</script>

<template>
  <!-- Signed out (the route guard is about to move on to the landing page), nothing of the shell is drawn. -->
  <AppShell
    v-if="auth.viewer"
    v-model:collapsed="collapsed"
    :inert="overList === 'modal'"
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
    :settings-sync-stopped="settingsSync.state.state === 'stopped'"
    :broken-workflows="brokenWorkflows"
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
  <Toaster v-if="auth.viewer">
    <CloseToasts />
    <EditToasts />
    <MergeToasts />
    <WorkflowRerunToast />
    <SyncStoppedToast :login="auth.viewer.login" />
    <UntrackToast />
    <TrackFailedToast />
  </Toaster>
  <AppCommands v-if="auth.viewer" />
</template>
