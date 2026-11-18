<!-- The commit an address opens, in its arrangement: in the shell's panel beside the repository's Commits section (`?pane=commit&commit=owner|name|<sha>`) or on its page (`/owner/name/commit/<sha>`), in any repository the user can see, tracked or not (git-client D11), shown in its details (`CommitDetails`) and moved as any opened item is (`useItemArrangement`): "Open full screen" (`⇧Enter`) and "Back to the panel" are its button and a command, as any opened item's, `⇧O` opens the commit's pull request in its place, as any item opens, by its address (a fork's commit answers with its upstream's), Escape goes back the way it came — the Commits section, or with no list behind it (opened by its address) up to it — after the graph's list of branches and tags lying over the graph leaves (`CommitGraphStore.takeEscape`), `P`/`⇧P` open its first or second parent in its place, replacing the address, and `O` opens it on GitHub. In the panel the graph beside it owns `K`/`J`, moving its cursor, which the panel follows; on the page they step through the list of commits it was opened from (`ItemNavigation.list`, by their keys, `CommitRoutes.formatKey`). A short sha in the address settles on the full oid once GitHub names it (`CommitGraphStore.resolveOid`), replacing the address. What it shows is read once it rests on a commit — 150 ms, so holding a key reads only where it stops; a panel that had no commit reads at once —: its details (with its pull request and CI state), its checks, and for a loaded row its state as the rows ask for it. Opened with no graph in memory (its page after a reload) it opens the repository's graph for the branches and tags pointing at it and whether it is loaded; the branch or tag chosen last in the graph's list says why the graph stayed when the commit is its (CH16). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, shallowRef, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { bindCommand } from '@/commands/bindCommand.js';
import {
  firstParent,
  lineDown,
  lineUp,
  openCommitPullRequest,
  openOnGitHub,
  pageDown,
  pageUp,
  secondParent,
} from '@/commands/definitions/index.js';
import { useCommands } from '@/commands/useCommands.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { parseItemUrl } from '@/item/itemRoutes.js';
import type { ItemArrangement } from '@/item/itemRoutes.js';
import { useItemArrangement, useItemKeys } from '@/item/useItemArrangement.js';
import { useOpenItemReference } from '@/item/useOpenItemReference.js';
import { useReadingCursor } from '@/reading/useReadingCursor.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { useNow } from '@/services/useNow.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { getGitHubUrl, getRepositoryPath } from '@/tracking/trackingRoutes.js';

import CommitDetails from './CommitDetails.vue';
import { CommitGraphStore } from './CommitGraphStore.js';
import { CommitRoutes, parseCommitKey } from './commitRoutes.js';
import type { CommitReference } from './commitRoutes.js';
import type { CommitParent } from './CommitTypes.js';
import { groupCommitRefs } from './groupCommitRefs.js';
import * as l from './OpenedCommit.loc.js';

const props = defineProps<{
  reference: CommitReference;
  arrangement: ItemArrangement;
}>();

/** How long it rests on a commit it moved to before that is read: holding a key reads only where it stops. */
const DETAIL_PAUSE_MS = 150;
/** How often the ages move on. */
const AGE_TICK_MS = 30_000;
/** A full oid, as GitHub writes it. */
const FULL_OID = /^[0-9a-f]{40}$/u;

const t = useTranslate();
const store = useService(CommitGraphStore);
const navigation = useService(ItemNavigation);
const browser = useService(Browser);
const clock = useService(Clock);
const route = useRoute();
const router = useRouter();
const openItemReference = useOpenItemReference();
const now = useNow(AGE_TICK_MS);
const phone = useService(PhoneLayout);
const details = useTemplateRef('details');

const nameWithOwner = computed(() => `${props.reference.owner}/${props.reference.name}`);
/** The sha as the address names it, as GitHub is asked for it. */
const rev = computed(() => props.reference.oid.toLowerCase());
/** Its full oid: the address's when it is one, else once GitHub named it; `null` until then. */
const fullOid = computed(
  () => store.resolveOid(nameWithOwner.value, rev.value) ?? (FULL_OID.test(rev.value) ? rev.value : null),
);
/** What the details show it by: its full oid once known, the address's sha until then. */
const oid = computed(() => fullOid.value ?? rev.value);
/** Its key among the steps of a list of commits, once its full oid is known. */
const key = computed(() =>
  fullOid.value === null ? null : CommitRoutes.formatKey({ ...props.reference, oid: fullOid.value }),
);
const url = computed(() => getGitHubUrl(`${nameWithOwner.value}/commit/${oid.value}`));
const refs = computed(() => groupCommitRefs(store.get(nameWithOwner.value)?.refs ?? null).get(oid.value) ?? []);
/** The ref chosen last in the graph's list, when this is its commit: why the graph stayed (CH16). */
const chosenRef = computed(() => {
  const chosen = store.getChosenRef(nameWithOwner.value);
  return chosen?.oid === oid.value ? chosen : null;
});

/** On its page, not on a phone: ↓ ↑ PageDown PageUp scroll the details (a commit has nothing to stop on). */
const scrolling = computed(() => props.arrangement === 'page' && !phone.active);
const scrollKeys = useReadingCursor({
  scroller: () => details.value?.scroll ?? null,
  cursor: shallowRef(null),
  stops: false,
  isActive: scrolling,
});

const arranging = useItemArrangement({
  routes: CommitRoutes,
  reference: () => props.reference,
  arrangement: () => props.arrangement,
  id: key,
  // With no list behind it, closing goes up to its repository's Commits section.
  parent: () => ({ path: getRepositoryPath(nameWithOwner.value, 'commits'), title: nameWithOwner.value }),
  resolveStep: stepKey => {
    const reference = parseCommitKey(stepKey);
    return reference && { reference };
  },
});
const keys = useItemKeys({
  place: 'commit',
  arrangement: () => props.arrangement,
  // In the panel the graph beside it moves its cursor with them, and the panel follows.
  steps: () => props.arrangement === 'page',
  closesToPanel: () => arranging.closesToPanel,
  onEscape: () => store.takeEscape(),
  close: () => arranging.close(),
  arrange: arrangement => arranging.arrange(arrangement),
  previous: () => arranging.step(-1),
  next: () => arranging.step(1),
});

useCommands(() => {
  const { commands } = keys;
  return [
    commands.next,
    commands.previous,
    bindCommand(firstParent, { section: 'item', menu: false, run: () => openParent(0) }, t),
    bindCommand(secondParent, { section: 'item', menu: false, run: () => openParent(1) }, t),
    bindCommand(openCommitPullRequest, { section: 'item', menu: false, run: openPullRequest }, t),
    commands.close,
    ...getScrollCommands(),
    bindCommand(openOnGitHub, { place: 'commit', section: 'item', run: () => browser.openInNewTab(url.value) }, t),
    commands.closeFullScreen,
    ...(commands.openFullScreen ? [commands.openFullScreen] : []),
  ];
});

// The commit opened last, by its key: the list it was opened from selects it when it comes back.
watch(
  key,
  current => {
    if (current !== null) {
      navigation.setLastOpened(current);
    }
  },
  { immediate: true },
);

// With no graph in memory (its page after a reload), the repository's: its branches and tags, and whether it is loaded.
watch(
  nameWithOwner,
  current => {
    if (!store.get(current)) {
      void store.open(current);
    }
  },
  { immediate: true },
);

// A short sha settles on the full oid once GitHub names it, in place of the address.
watch(
  fullOid,
  full => {
    if (full !== null && full !== props.reference.oid) {
      void router.replace(locate({ ...props.reference, oid: full }));
    }
  },
  { immediate: true },
);

// What it shows is read once it rests on a commit. Nothing to rest from on opening: it reads at once.
watch(
  () => `${nameWithOwner.value}/${rev.value}`,
  (_current, previous, onCleanup) => {
    if (previous === undefined) {
      read();
    } else {
      onCleanup(clock.schedule(read, DETAIL_PAUSE_MS));
    }
  },
  { immediate: true },
);

/**
 * Its details (with its pull request and CI state); with its full oid known its checks too, and for a loaded row its
 * state as the rows ask for it. A short sha waits for the address to settle on the full oid, which reads the rest.
 */
function read() {
  const current = nameWithOwner.value;
  store.ensureDetail(current, rev.value);
  const full = fullOid.value;
  if (full === null) {
    return;
  }

  const commit = store.getCommit(current, full);
  if (commit && store.getCommitPlace(current, full) !== 'notLoaded') {
    store.ensureStates(current, [commit]);
  }

  store.ensureChecks(current, full);
}

/** The page's keys for scrolling, off in the panel, where the graph beside it has ↓ ↑. */
function getScrollCommands() {
  const motion = { place: 'commit', section: 'item', menu: false, when: () => scrolling.value } as const;
  return [
    bindCommand(lineDown, { ...motion, title: t(l.scrollDown), run: () => scrollKeys.move(1) }, t),
    bindCommand(lineUp, { ...motion, title: t(l.scrollUp), run: () => scrollKeys.move(-1) }, t),
    bindCommand(pageDown, { ...motion, title: t(l.screenDown), run: () => scrollKeys.page(1) }, t),
    bindCommand(pageUp, { ...motion, title: t(l.screenUp), run: () => scrollKeys.page(-1) }, t),
  ];
}

/** A parent there is none of does nothing. */
function openParent(index: number) {
  const parent = store.getCommit(nameWithOwner.value, oid.value)?.parents[index];
  if (parent) {
    openInPlace(parent);
  }
}

/** Another commit of the repository (a parent) in its place, replacing the address. */
function openInPlace(commit: CommitParent) {
  arranging.openInPlace(CommitRoutes.formatKey({ ...props.reference, oid: commit.oid }));
}

/** As any item opens, found by its address: a fork's commit answers with its upstream's pull request. */
function openPullRequest() {
  const pullRequest = store.getState(nameWithOwner.value, oid.value)?.pullRequest;
  const reference = pullRequest && parseItemUrl(pullRequest.url);
  if (reference) {
    openItemReference(reference, 'pullRequest');
  }
}

/** The address of `reference` in this arrangement, the rest of the address kept. */
function locate(reference: CommitReference) {
  return props.arrangement === 'page'
    ? { path: CommitRoutes.getPagePath(reference), query: route.query, hash: route.hash }
    : { path: route.path, query: CommitRoutes.getQuery(route.query, reference), hash: route.hash };
}
</script>

<template>
  <CommitDetails
    ref="details"
    :name-with-owner="nameWithOwner"
    :oid="oid"
    :refs="refs"
    :chosen-ref="chosenRef"
    :url="url"
    :now="now"
    :other-arrangement="keys.otherArrangement"
    @close="arranging.close()"
    @step="arranging.step($event)"
    @open-parent="openInPlace"
    @open-pull-request="openPullRequest"
    @arrange="arranging.arrange($event)"
  />
</template>
