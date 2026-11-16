<!-- The layout of the app's screens (`meta.layout: 'shell'`): `AppShell` with the signed-in user, GitHub's allowance, how fresh the screen is — on Settings' screens where the settings are saved too (githq D26), a review its own, a repository's commit graph on its Commits section, a tracked repository's or project's own poll (a saved view GitHub answers says so; its Workflows section how far the first read of its runs is, and a run's page too unless its log's state has more to say), the workflows' poll on the broken workflows, else my work's — and its counts for the sidebar (a group's once it is in, the total once all are: first run and loading D14), the download of everything tracked for the status bar's left segment (D4), the open items of each tracked repository and project once they are in, the place the screen is in (`getOpenPlace`) — under its row in the sidebar, and under any tracked place tapped open in the places panel, its sections with their tabs' counts or its saved views (`getSidebarChildren`), sliding open while the animations are on and no reduced motion is asked for —, the entry "Draft reviews", the entry "Broken workflows" and each repository's marker of its workflows, and the sidebar's collapsed state, which is remembered in this browser — a route with `meta.railForced` shows the rail without touching it —, and whether syncing the settings stopped (the avatar's dot, the toast telling why once), the toast of an untrack that can still be undone and the toast of viewed marks GitHub didn't take (above the route, so moving between screens keeps it), and the toasts of failed edits and of merges the user moved on from (merging D15), and of a run's failed jobs that did not re-run (actions W4l), and of an issue just created, with Create another and Open (mobile D44), in the desktop app the toast saying the app updated (desktop releases D7), in the web builds the screen saying a link was handed to the desktop app (`desktopLinks/`), and in the status bar a merge GitHub has not said the end of, in grey, until the next refresh settles it (PM36), and on `<html>` whether the short animations play (`data-motion`, the `motion` mixin). An item the address opens over the screen (`?pane=issue&issue=owner|name|12`, GitHub's project pane; a workflow's `?pane=workflow&workflow=owner|name|deploy.yml`, a workflow's run's `?pane=run&run=owner|name|123`, one instance per run) shows here, in the panel beside it — so any list can open one — and the shell tells whether the window has room for the panel (`ItemNavigation.panelFits`), where an item opens otherwise on its page; a tracked project or repository in the sidebar has its context menu; the command menu (⌘K) and the keyboard help (`?`) open over any screen; an item's own page is a screen of its own, and the screen's segment of the status bar then tells how fresh the item is. In the phone layout (`PhoneLayout`, mobile D5) the shell is the phone's — its top bar on a screen that draws none of its own (`meta.ownTopBar`), the places panel — and the command line floats over the screen (mobile D17): on an item's page the comment box's pill, showing the item's draft when there is one (`CommentDrafts`), which grows into the item's composer docked above the keyboard with the cursor in it (`ItemNavigation.requestComment`, mobile D51), and ⌘; elsewhere ⌘ with the part the list shows (`PhoneLayout.part`), opening the command menu with the place's parts first — while the list is selecting several, with how many, opening it on them (mobile D28); either opens the command menu. The toasts then sit above it. -->
<script lang="ts" setup>
import { getSettingsNameWithOwner } from '@githq/github/settings/getSettingsNameWithOwner.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import { Columns3, List } from 'lucide-vue-next';
import { computed, defineAsyncComponent, watch, watchEffect } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import AppCommands from '@/commands/AppCommands.vue';
import { CommandRegistry } from '@/commands/CommandRegistry.js';
import { CommitGraphStore } from '@/commits/CommitGraphStore.js';
import OpenedCommit from '@/commits/OpenedCommit.vue';
import Toaster from '@/components/Toaster.vue';
import { CommentDrafts } from '@/edits/CommentDrafts.js';
import { EditQueue } from '@/edits/EditQueue.js';
import CloseToasts from '@/edits/CloseToasts.vue';
import EditToasts from '@/edits/EditToasts.vue';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { useEditTexts } from '@/edits/useEditTexts.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { ItemResolver } from '@/item/ItemResolver.js';
import { prefersReducedMotion } from '@/landing/prefersReducedMotion.js';
import { ListViewOptionsStore } from '@/lists/ListViewOptionsStore.js';
import { getOpenedItemRoute } from '@/item/itemRoutes.js';
import OpenedItem from '@/item/OpenedItem.vue';
import { getPullRequestCommands } from '@/merge/getPullRequestCommands.js';
import { MergeContext } from '@/merge/MergeContext.js';
import { MergePanelStore } from '@/merge/MergePanelStore.js';
import MergeToasts from '@/merge/MergeToasts.vue';
import { PullRequestCommands } from '@/merge/PullRequestCommands.js';
import { buildMyWork } from '@/myWork/buildMyWork.js';
import { getDraftReviews } from '@/myWork/getDraftReviews.js';
import IssueCreatedToasts from '@/newIssue/IssueCreatedToasts.vue';
import { getProjectViewTabs } from '@/projects/getProjectViewTabs.js';
import * as projectTexts from '@/projects/ProjectPage.loc.js';
import ProjectContextMenu from '@/projects/ProjectContextMenu.vue';
import { ProjectStore } from '@/projects/ProjectStore.js';
import type { Project } from '@/projects/ProjectTypes.js';
import { ALL_ITEMS_LIST } from '@/projects/projectViewOptions.js';
import { ProjectViewAnswers } from '@/projects/ProjectViewAnswers.js';
import { BrowsedRepositories } from '@/repos/BrowsedRepositories.js';
import { getRepositorySectionCounts } from '@/repository/getRepositorySectionCounts.js';
import { LastRepositoryTab } from '@/repository/LastRepositoryTab.js';
import RepositoryContextMenu from '@/repository/RepositoryContextMenu.vue';
import { REPOSITORY_SECTION_ICONS, REPOSITORY_SECTIONS } from '@/repository/RepositorySection.js';
import type { RepositorySection } from '@/repository/RepositorySection.js';
import * as repositoryTexts from '@/repository/RepositoryView.loc.js';
import { saysWhereSettingsAreSaved } from '@/settings/settingsRoutes.js';
import { SettingsSync } from '@/settings/sync/SettingsSync.js';
import SyncStoppedToast from '@/settings/SyncStoppedToast.vue';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { LocalPreferences } from '@/services/LocalPreferences.js';
import { useNow } from '@/services/useNow.js';
import AppShell from '@/shell/AppShell.vue';
import PhoneCommandLine from '@/shell/PhoneCommandLine.vue';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { getNewestEdits } from '@/shell/getNewestEdits.js';
import type { DatedSegmentEdits } from '@/shell/getNewestEdits.js';
import type { SegmentEdits } from '@/shell/SegmentEdits.js';
import type { SidebarTracked, SidebarTrackedStatus } from '@/shell/Sidebar.vue';
import type { SidebarMyWorkCounts, SidebarSubEntry } from '@/shell/SidebarTypes.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import type { MyWorkGroup } from '@/store/ItemStoreTypes.js';
import { groupStacks } from '@/store/stacks/groupStacks.js';
import type { Freshness } from '@/sync/Freshness.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import { DownloadProgress } from '@/tracking/DownloadProgress.js';
import { getOpenPlace } from '@/tracking/getOpenPlace.js';
import { PendingUntracks } from '@/tracking/PendingUntracks.js';
import { TrackedItems } from '@/tracking/TrackedItems.js';
import {
  getGitHubUrl,
  getProjectPath,
  getRepositoryPath,
  getRepositorySection,
  getRouteNameWithOwner,
  isRepositorySectionShownOnPhone,
  isWorkflowRunRoute,
} from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import type { TrackedProject, TrackedTarget } from '@/tracking/TrackingTypes.js';
import TrackFailedToast from '@/tracking/TrackFailedToast.vue';
import UntrackToast from '@/tracking/UntrackToast.vue';
import { ReviewScreenFreshness } from '@/review/ReviewScreenFreshness.js';
import ReviewViewedToast from '@/review/ReviewViewedToast.vue';
import { haveOpenItemsArrived } from '@/tracking/utils/haveOpenItemsArrived.js';
import { releaseTabFocus, useTabFocus } from '@/utils/useTabFocus.js';
import { buildRepositoryWorkflows } from '@/workflows/buildRepositoryWorkflows.js';
import { useWorkflowRerunTexts } from '@/workflows/useWorkflowRerunTexts.js';
import { getSidebarBrokenWorkflows } from '@/workflows/utils/getSidebarBrokenWorkflows.js';
import { getSidebarWorkflowMarker } from '@/workflows/utils/getSidebarWorkflowMarker.js';
import OpenedWorkflow from '@/workflows/OpenedWorkflow.vue';
import OpenedWorkflowRun from '@/workflows/OpenedWorkflowRun.vue';
import WorkflowDispatchToast from '@/workflows/WorkflowDispatchToast.vue';
import WorkflowRerunToast from '@/workflows/WorkflowRerunToast.vue';
import { WorkflowRunStore } from '@/workflows/WorkflowRunStore.js';
import { WorkflowStore } from '@/workflows/WorkflowStore.js';
import { WorkflowRunRoutes } from '@/workflows/workflowRunRoutes.js';

// The desktop app's toasts, in the desktop build only (`__DESKTOP__`); the web builds drop them. Not suspensible: a
// toast arrives later than the screen, and loading it as a dependency of Nuxt's root `<Suspense>`, which re-renders the
// shell before the chunk is in, breaks Vue's patch of the page (a blank window).
const UpdatedToast = __DESKTOP__
  ? defineAsyncComponent({ loader: () => import('@/desktop/UpdatedToast.vue'), suspensible: false })
  : null;
const UpdateReadyToast = __DESKTOP__
  ? defineAsyncComponent({ loader: () => import('@/desktop/UpdateReadyToast.vue'), suspensible: false })
  : null;
const QuitHintToast = __DESKTOP__
  ? defineAsyncComponent({ loader: () => import('@/desktop/QuitHintToast.vue'), suspensible: false })
  : null;
// The web's toast of a newer deploy, in the web builds only; the desktop app has its own updater.
const NewVersionToast = __DESKTOP__
  ? null
  : defineAsyncComponent({ loader: () => import('@/shell/NewVersionToast.vue'), suspensible: false });
// Handing the page's link to the desktop app, in the web builds only; the desktop build drops it. Not suspensible, like
// the toasts above: the shell's suspense waiting for this chunk also breaks dragging the panels (Reka UI).
const DesktopHandOff = !__DESKTOP__
  ? defineAsyncComponent({ loader: () => import('@/desktopLinks/DesktopHandOff.vue'), suspensible: false })
  : null;

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
const drafts = useService(CommentDrafts);
const tracking = useService(TrackingStore);
const browsed = useService(BrowsedRepositories);
const pendingUntracks = useService(PendingUntracks);
const download = useService(DownloadProgress);
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
const reviewFreshness = useService(ReviewScreenFreshness);
const route = useRoute();
const editor = useService(ItemEditor);
const mergePanel = useService(MergePanelStore);
const pullRequestCommands = useService(PullRequestCommands);
const phone = useService(PhoneLayout);
const projectStore = useService(ProjectStore);
const listViewOptions = useService(ListViewOptionsStore);
const router = useRouter();
const t = useTranslate();
// The day a project's saved filters count from, and the time a repository's broken workflows are told against.
const now = useNow(60_000);

// Motion plays under this attribute (the `motion` mixin, `styles/tokens.scss`); leaving the shell takes it away. Not
// `useHead`: `nuxt/app` doesn't resolve in the component tests that mount this layout, and the shell is never prerendered.
watchEffect(onCleanup => {
  if (tracking.animations) {
    const root = document.documentElement;
    root.dataset.motion = 'on';
    onCleanup(() => delete root.dataset.motion);
  }
});

// The sidebar's rows under a place slide open by script (`Reveal`), which the `motion` mixin can't hold back: they ask
// the same — the app's animations on, and no reduced motion asked for.
const animate = computed(() => tracking.animations && !prefersReducedMotion());

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

// The sidebar counts what the list of "my work" shows unfiltered (D11): a group once its search is in, the total once
// every group is (first run and loading D14); nothing before any is.
const myWorkCounts = computed((): SidebarMyWorkCounts | null => {
  const { membership } = items;
  if (MY_WORK_GROUPS.every(group => membership[group] === undefined)) {
    return null;
  }

  const { counts } = buildMyWork({
    membership,
    getItem: id => items.get(id),
    stacks: groupStacks(items.all),
    filter: 'all',
    sort: 'updated',
  });
  const arrived = (group: MyWorkGroup) => (membership[group] === undefined ? null : counts[group]);
  return {
    reviewRequested: arrived('reviewRequested'),
    authored: arrived('authored'),
    assigned: arrived('assigned'),
    mentioned: arrived('mentioned'),
    total: MY_WORK_GROUPS.every(group => membership[group] !== undefined) ? counts.total : null,
  };
});

/** The repository's section or the project's view the screen is in, which the sidebar expands under its row. */
const openPlace = computed(() =>
  getOpenPlace({
    route,
    list: navigation.list,
    resolve: path => router.resolve(path),
    getShownSection: (nameWithOwner, section) => repositoryTabs.getShown(nameWithOwner, section),
    findProject: address => {
      const found = tracking.projects.find(
        candidate =>
          candidate.owner === address.owner &&
          candidate.ownerKind === address.ownerKind &&
          candidate.number === address.number,
      );
      return found ? (projectStore.get(found.id) ?? { id: found.id, views: [] }) : null;
    },
    findItem: reference => {
      const id = resolver.peek(reference);
      return (id && items.get(id)) || null;
    },
  }),
);

// Each tracked project and repository — not one being untracked, with Undo on offer — with its open items once they have arrived, blank before (first run and loading D4), the open place marked.
const tracked = computed((): SidebarTracked => ({
  projects: pendingUntracks.projects.map(project => ({
    key: `project:${project.id}`,
    label: project.title,
    to: getProjectRowPath(project),
    target: { kind: 'project', id: project.id },
    status: getTrackedStatus(
      { kind: 'project', id: project.id },
      haveOpenItemsArrived(tracking.getSyncState({ kind: 'project', id: project.id })),
    ),
    open: openPlace.value?.kind === 'project' && openPlace.value.id === project.id,
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
      open: openPlace.value?.kind === 'repository' && openPlace.value.nameWithOwner === repository.nameWithOwner,
    };
  }),
}));

// The entry "Broken workflows" (actions W1): only while something is known broken, or on its own screen.
const brokenWorkflows = computed(() => getSidebarBrokenWorkflows(workflows.totals, route.name === 'workflows'));

const draftReviews = computed(() => getDraftReviews(items.all).length);

// How fresh the screen is (D15): a review how far its files are (code review D35); a repository's commit graph its refs as last read, tracked or not (git-client D9); a
// tracked repository's or project's own poll — a saved view GitHub answers says so (K6); an untracked repository's item
// section the reads of the screen browsing it (D34); the broken workflows and a repository's Workflows section their own
// poll; anything else shows what "my work" holds.
const screenFreshness = computed((): Freshness => {
  if (reviewFreshness.current) {
    return reviewFreshness.current;
  }

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
      // The state the page shows, so the bar and the page's note read the same freshness.
      return browsed.getFreshness(nameWithOwner, shown, browsed.getShownState(nameWithOwner, shown));
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

// Settings' screens say where the settings are saved next to "Up to date" (githq D26).
const shownFreshness = computed((): Freshness => {
  const freshness = screenFreshness.value;
  return freshness.kind === 'fresh' && auth.viewer && saysWhereSettingsAreSaved(route)
    ? {
        kind: 'settingsSaved',
        checkedAt: freshness.checkedAt,
        saving: settingsSync.state.state,
        repository: getSettingsNameWithOwner(auth.viewer.login),
      }
    : freshness;
});

const opened = computed(() => getOpenedItemRoute(route));
/** The item opened over the screen, in the panel beside it; `null` with none, or on the item's own page. */
const overScreen = computed(() => (opened.value && !opened.value.onPage ? opened.value : null));
const openedId = computed(() =>
  opened.value?.kind === 'issue' ? (resolver.peek(opened.value.reference) ?? null) : null,
);
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
  if (opened.value?.kind !== 'issue') {
    return null;
  }

  const id = resolver.peek(opened.value.reference);
  if (id === null) {
    return null;
  }

  return id === undefined ? { kind: 'partial' } : details.getFreshness(id);
});

/**
 * The rows under a tracked place in the sidebar, as its tabs show them: a repository's sections, a project's saved views.
 * Called by the sidebar as it draws, so they follow the stores.
 */
function getSidebarChildren(target: TrackedTarget): readonly SidebarSubEntry[] {
  switch (target.kind) {
    case 'repository':
      return getRepositoryChildren(target.nameWithOwner);
    case 'project':
      return getProjectChildren(target.id);
    default:
      return assertNever(target);
  }
}

/**
 * A tracked repository's sections with their tabs' counts — Workflows its broken ones, with the red dot of "Broken
 * workflows" (actions W1). On a phone Commits and Workflows leave for github.com, as the command line's menu says (mobile
 * D21).
 */
function getRepositoryChildren(nameWithOwner: string): SidebarSubEntry[] {
  const place = openPlace.value;
  const shown = place?.kind === 'repository' && place.nameWithOwner === nameWithOwner ? place.section : null;
  const counts = getRepositorySectionCounts({
    items: items.all.filter(item => item.repository.nameWithOwner === nameWithOwner),
    sync: tracking.getSyncState({ kind: 'repository', nameWithOwner }),
    workflows: buildRepositoryWorkflows({
      stored: workflows.get(nameWithOwner),
      settings: workflows.getRefSettings(nameWithOwner),
      now: now.value,
    }),
  });
  const marker = getSidebarWorkflowMarker(workflows.getState(nameWithOwner));
  return REPOSITORY_SECTIONS.map(section => {
    const external =
      phone.active && !isRepositorySectionShownOnPhone(section)
        ? getGitHubUrl(getRepositoryPath(nameWithOwner, section))
        : undefined;
    const broken = section === 'workflows' && typeof counts.workflows === 'number' && counts.workflows > 0;
    return {
      key: section,
      label: t(repositoryTexts[section]),
      to: getRepositoryPath(nameWithOwner, section),
      icon: REPOSITORY_SECTION_ICONS[section],
      count: getSectionCount(section),
      current: section === shown,
      external,
      marker: broken && (marker === 'new' || marker === 'settled') ? marker : undefined,
    };
  });

  function getSectionCount(section: RepositorySection) {
    switch (section) {
      case 'issues':
      case 'pullRequests':
        return counts[section] === null ? '' : String(counts[section]);
      case 'commits':
        return '';
      case 'workflows':
        return counts.workflows === 'unknown' ? '–' : counts.workflows === null ? '' : String(counts.workflows);
      default:
        return assertNever(section);
    }
  }
}

/**
 * A tracked project's saved views as its tabs show them — "All items" after them only while it is shown —, each with
 * its layout's icon; none before its copy is loaded.
 */
function getProjectChildren(projectId: string): SidebarSubEntry[] {
  const project = projectStore.get(projectId);
  if (!project) {
    return [];
  }

  const place = openPlace.value;
  const projectItems = projectStore.getItems(projectId);
  const tabs = getProjectViewTabs({
    project,
    shownKey: place?.kind === 'project' && place.id === projectId ? place.viewKey : null,
    allItems: { name: t(projectTexts.allItems), to: getAllItemsAddress(project) },
    isKept: list => listViewOptions.has(list),
    filterContext: {
      viewerLogin: auth.viewer?.login ?? '',
      today: new Date(now.value).toISOString().slice(0, 10),
      hasDrafts: projectItems.some(item => item.draft !== null),
      hasDraftPullRequests: projectItems.some(item => {
        const content = item.contentId === null ? undefined : items.get(item.contentId);
        return content?.kind === 'pullRequest' && content.isDraft;
      }),
    },
  });
  return tabs.map(tab => ({
    key: tab.key,
    label: tab.name,
    to: tab.to,
    icon: project.views.find(view => view.id === tab.key)?.layout === 'BOARD_LAYOUT' ? Columns3 : List,
    count: '',
    current: tab.current,
    modified: tab.modified,
    answered: tab.answered,
  }));
}

/** Where a project's row leads: the open project's view the screen is in, so its row goes back to that list; another its first view. */
function getProjectRowPath(project: TrackedProject) {
  const place = openPlace.value;
  if (place?.kind !== 'project' || place.id !== project.id || place.viewKey === null) {
    return getProjectPath(project);
  }

  if (place.viewKey === ALL_ITEMS_LIST) {
    return `${getProjectPath(project)}?all`;
  }

  const view = projectStore.get(project.id)?.views.find(candidate => candidate.id === place.viewKey);
  return getProjectPath(project, view?.number);
}

/**
 * Where "All items" is while it is shown: the project's page showing it, or the list an item full screen was opened
 * from.
 */
function getAllItemsAddress(project: Project): RouteLocationRaw {
  if (typeof route.name === 'string' && route.name.startsWith('project-')) {
    return { path: route.path, query: { all: null } };
  }

  return navigation.list?.path ?? { path: getProjectPath(project), query: { all: null } };
}

function getTrackedStatus(target: TrackedTarget, openArrived: boolean): SidebarTrackedStatus {
  if (tracking.getProgress(target).state === 'hidden') {
    return { kind: 'hidden' };
  }

  return openArrived ? { kind: 'count', count: trackedItems.getOpenCount(target) } : { kind: 'downloading' };
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

/**
 * The command line's menu: on a list with the place's parts first (mobile D17) — selecting several, the plain one,
 * acting on them (D28) — on an item's page the plain one.
 */
function openCommandLineMenu() {
  const parts = opened.value?.onPage || (phone.selecting && phone.selectedCount > 0) ? undefined : phone.part?.parts;
  if (parts) {
    registry.openParts(parts);
  } else {
    registry.openMenu();
  }
}
</script>

<template>
  <!-- Signed out (the route guard is about to move on to the landing page), nothing of the shell is drawn. -->
  <AppShell
    v-if="auth.viewer"
    v-model:collapsed="collapsed"
    :rail-forced="route.meta.railForced === true"
    :panel-fits="navigation.panelFits"
    :viewer="auth.viewer"
    :rate-limit="rateLimits.get('graphql')"
    :notice="sync.notice"
    :last-refreshed-at="items.getSyncState('myWork').lastSuccessAt"
    :download="download.current"
    :freshness="opened?.onPage ? (itemFreshness ?? shownFreshness) : shownFreshness"
    :item-freshness="opened?.onPage ? null : itemFreshness"
    :my-work-counts="myWorkCounts"
    :tracked="tracked"
    :get-children="getSidebarChildren"
    :animate="animate"
    :edits="opened?.onPage ? (itemEdits ?? listEdits) : listEdits"
    :item-edits="opened?.onPage ? null : itemEdits"
    :settings-sync-stopped="settingsSync.state.state === 'stopped'"
    :broken-workflows="brokenWorkflows"
    :draft-reviews="draftReviews"
    :phone="phone.active"
    :own-top-bar="route.meta.ownTopBar === true"
    @sign-out="auth.signOut()"
    @search="registry.openMenu()"
    @show-failure="showLastFailure"
    @update:panel-fits="navigation.setPanelFits"
  >
    <slot />
    <template
      v-if="overScreen"
      #panel
    >
      <OpenedItem
        v-if="overScreen.kind === 'issue'"
        :reference="overScreen.reference"
        arrangement="panel"
      />
      <OpenedWorkflow
        v-else-if="overScreen.kind === 'workflow'"
        :reference="overScreen.reference"
        arrangement="panel"
      />
      <OpenedCommit
        v-else-if="overScreen.kind === 'commit'"
        :reference="overScreen.reference"
        arrangement="panel"
      />
      <OpenedWorkflowRun
        v-else-if="overScreen.kind === 'run'"
        :key="WorkflowRunRoutes.formatKey(overScreen.reference)"
        :reference="overScreen.reference"
        arrangement="panel"
      />
    </template>
    <template
      v-if="phone.active"
      #commandLine
    >
      <PhoneCommandLine
        :variant="opened?.onPage ? 'item' : 'list'"
        :part="phone.part"
        :selected="phone.selecting ? phone.selectedCount : null"
        :draft="opened?.onPage && openedId !== null ? drafts.get(openedId) : ''"
        @menu="openCommandLineMenu"
        @comment="navigation.requestComment(openedId)"
      />
    </template>
    <template #trackedMenu="{ target }">
      <RepositoryContextMenu
        v-if="target.kind === 'repository'"
        :name-with-owner="target.nameWithOwner"
        :current="openPlace?.kind === 'repository' && openPlace.nameWithOwner === target.nameWithOwner"
      />
      <ProjectContextMenu
        v-else
        :project-id="target.id"
        :current="openPlace?.kind === 'project' && openPlace.id === target.id"
        :shown-view="openPlace?.kind === 'project' && openPlace.id === target.id ? openPlace.viewKey : null"
      />
    </template>
  </AppShell>
  <Toaster
    v-if="auth.viewer"
    :above-command-line="phone.active"
  >
    <CloseToasts />
    <EditToasts />
    <MergeToasts />
    <WorkflowRerunToast />
    <WorkflowDispatchToast />
    <SyncStoppedToast :login="auth.viewer.login" />
    <UntrackToast />
    <TrackFailedToast />
    <ReviewViewedToast />
    <IssueCreatedToasts />
    <component
      :is="UpdatedToast"
      v-if="UpdatedToast"
    />
    <component
      :is="UpdateReadyToast"
      v-if="UpdateReadyToast"
    />
    <component
      :is="QuitHintToast"
      v-if="QuitHintToast"
    />
    <component
      :is="NewVersionToast"
      v-if="NewVersionToast"
    />
  </Toaster>
  <AppCommands v-if="auth.viewer" />
  <component
    :is="DesktopHandOff"
    v-if="DesktopHandOff && auth.viewer"
  />
</template>
