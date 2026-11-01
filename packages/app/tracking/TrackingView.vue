<!-- Changing what is tracked, later (G8, T1, T2), the body of Settings' Repositories and Projects sections: one place for both directions. What is tracked, how much of it this browser keeps and how fresh it is, with "Untrack" (⌫) and a download in place; and what could be: the repositories the user's work lives in, then, through the owner filter and the search it puts in Settings' header (`/`), everything the user and their organisations have, the rest of a long list read as it is needed. A search naming something else (`owner/name`, a project's address) looks it up and offers it, whoever's it is. ↑/↓ move between the rows, `T` tracks. Every organisation stays listed beside it, one hiding its private data with the way to request approval. Rendered inside `SettingsView`, whose header takes the controls. -->
<script lang="ts">
import type { TrackedTarget } from './TrackingTypes.js';

/** How a tracked repository or project stands now. */
export type TrackedRowState =
  /** `total`: what GitHub counts in the parts it started reading; `null` before the first page. */
  | { readonly kind: 'downloading'; readonly done: number; readonly total: number | null }
  | { readonly kind: 'hidden' }
  /** GitHub refuses to list its changes (a 403): they are not followed until it answers again. */
  | { readonly kind: 'refused' }
  /**
   * Read at `at` (epoch ms); `fresh` within its poll's interval; `slower` when GitHub refuses the free check, so
   * it is checked less often, through GraphQL.
   */
  | { readonly kind: 'read'; readonly at: number | null; readonly fresh: boolean; readonly slower: boolean };

/** A tracked repository or project. */
export interface TrackedRow {
  readonly target: TrackedTarget;
  readonly name: string;
  /** The login it belongs to. */
  readonly owner: string;
  readonly to: string;
  /** `null`: not known yet, or a project — no tag. */
  readonly isPrivate: boolean | null;
  /** Its items this browser keeps; `null` before it counted them. */
  readonly items: number | null;
  /** The latest change of an item this browser keeps of it (epoch ms); `null` when none tells. */
  readonly activeAt: number | null;
  readonly state: TrackedRowState;
}

/** A repository the user's work lives in that is not tracked. */
export interface SuggestedRepository {
  readonly nameWithOwner: string;
  readonly isPrivate: boolean;
  /** Its items in "my work". */
  readonly items: number;
  /** The latest change of one of them (epoch ms). */
  readonly activeAt: number;
}

/** Which of the two it shows. */
export type TrackingTab = 'projects' | 'repositories';
</script>

<script lang="ts" setup>
import { sumOver } from '@nzyme/utils/array/sumOver.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { ArrowUpRight, BookMarked, ChevronDown, CircleCheck, Lock, Plus, SquareKanban } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch, watchEffect } from 'vue';
import { RouterLink } from 'vue-router';

import Button from '@/components/Button.vue';
import Menu from '@/components/Menu.vue';
import MenuRadioGroup from '@/components/MenuRadioGroup.vue';
import MenuRadioItem from '@/components/MenuRadioItem.vue';
import ProgressBar from '@/components/ProgressBar.vue';
import SearchField from '@/components/SearchField.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { SETTINGS_CONTROLS_ID } from '@/settings/SettingsView.vue';
import { formatBytes } from '@/utils/formatBytes.js';
import { formatCheckedAge } from '@/utils/formatCheckedAge.js';
import { formatShortDate } from '@/utils/formatShortDate.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';
import { isSingleKeyShortcut } from '@/utils/isSingleKeyShortcut.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';
import { useFilteredListKeys } from '@/utils/useFilteredListKeys.js';

import { getCandidateProjects, getCandidateRepositories, getOwnerLists } from './trackingCandidates.js';
import { getProjectPath, getRepositoryPath } from './trackingRoutes.js';
import * as l from './TrackingView.loc.js';
import type {
  CandidateOrganization,
  CandidateProject,
  CandidateRepository,
  TrackingCandidates,
} from './TrackingTypes.js';
import { getApprovalUrl } from './utils/getApprovalUrl.js';
import { parseTrackingReference } from './utils/parseTrackingReference.js';
import type { TrackingReference } from './utils/parseTrackingReference.js';

/** The owner filter's value when it names nobody; no login is empty. */
const ALL_OWNERS = '';
/** How long the search must stay as it is before what it names is looked up. */
const LOOKUP_DELAY_MS = 300;

/** Something that could be tracked, as a row shows it. */
interface OfferRow {
  readonly key: string;
  readonly name: string;
  readonly icon: LucideIcon;
  /** `null`: not a repository, no tag. */
  readonly isPrivate: boolean | null;
  /** A project's owner, dim after its title. */
  readonly owner: string | null;
  readonly meta: string;
  readonly active: string | null;
  track(): void;
}

/** A list of rows that could be tracked, under its heading. */
interface OfferSection {
  readonly name: string;
  readonly detail: string;
  readonly rows: readonly OfferRow[];
}

const props = defineProps<{
  tracked: { readonly repositories: readonly TrackedRow[]; readonly projects: readonly TrackedRow[] };
  suggested: readonly SuggestedRepository[];
  /** What the user and their organisations have; `null` while it is read. */
  candidates: TrackingCandidates | null;
  approvals: Readonly<Record<string, number>>;
  /** How much this browser keeps, of everything (`null`: unknown): it can't tell per repository. */
  storedBytes: number | null;
  now: number;
  find: (reference: TrackingReference) => Promise<CandidateProject | CandidateRepository | null>;
  tab: TrackingTab;
  /** What the search field holds when the section opens. */
  initialSearch?: string;
}>();

const emit = defineEmits<{
  untrack: [target: TrackedTarget];
  /** A repository of "my work", by name: the section finds what it needs to track it. */
  trackSuggested: [nameWithOwner: string];
  track: [candidate: CandidateProject | CandidateRepository];
  /** The next page of the owner's repositories is needed. */
  loadMore: [owner: string];
  requestApproval: [organization: string];
}>();

const t = useTranslate();
const browser = useService(Browser);
const numbers = new Intl.NumberFormat(APP_LANGUAGE);
const searchField = useTemplateRef<{ focus(): void }>('searchField');
const lists = useTemplateRef<HTMLElement>('lists');

const filter = ref(props.initialSearch ?? '');
const owner = ref(ALL_OWNERS);
const found = shallowRef<CandidateProject | CandidateRepository | null>(null);
const lookingUp = ref(false);
const selectedOffer = ref<string | null>(null);
const listKeys = useFilteredListKeys({ container: lists, rows: '[data-row-focus]', filterField: searchField, filter });

const approvalUrl = getApprovalUrl(browser.origin);
const searchText = computed(() => filter.value.trim());
const needle = computed(() => searchText.value.toLowerCase());
const reference = computed(() => parseTrackingReference(searchText.value));
const referencePath = computed(() => {
  const named = reference.value;
  if (!named) {
    return null;
  }

  return (
    named.kind === 'repository' ? getRepositoryPath(`${named.owner}/${named.name}`) : getProjectPath(named)
  ).toLowerCase();
});
const narrowed = computed(() => needle.value !== '' || owner.value !== ALL_OWNERS);
const owners = computed(() => {
  const candidates = props.candidates;
  return candidates ? [candidates.login, ...candidates.organizations.map(organization => organization.login)] : [];
});
const rows = computed(() => (props.tab === 'repositories' ? props.tracked.repositories : props.tracked.projects));
const shownRows = computed(() => rows.value.filter(row => isOwnerShown(row.owner) && matchesSearch(row.name, row.to)));
const itemsKept = computed(() => sumOver(rows.value, row => row.items ?? 0));
const trackedKeys = computed(
  () =>
    new Set([
      ...props.tracked.repositories.map(row => row.name),
      ...props.tracked.projects.map(row => (row.target.kind === 'project' ? row.target.id : '')),
    ]),
);
const matchingRepositories = computed(() =>
  (props.candidates ? getCandidateRepositories(props.candidates) : [])
    .filter(
      repository =>
        !trackedKeys.value.has(repository.nameWithOwner) &&
        isOwnerShown(repository.owner) &&
        matchesSearch(repository.nameWithOwner, getRepositoryPath(repository.nameWithOwner)),
    )
    .toSorted((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? '')),
);
const untrackedProjects = computed(() =>
  (props.candidates ? getCandidateProjects(props.candidates) : []).filter(
    project => !trackedKeys.value.has(project.id) && isOwnerShown(project.owner),
  ),
);
const matchingProjects = computed(() =>
  untrackedProjects.value.filter(project => matchesSearch(project.title, getProjectPath(project))),
);
const matchingOffers = computed(() =>
  props.tab === 'repositories' ? matchingRepositories.value : matchingProjects.value,
);
// What the search names, once what is read of the lists doesn't have it: only what the section lists (a repository
// on Repositories, a project on Projects), not while the lists are being read, and not under an owner filter naming
// someone else.
const lookupReference = computed(() => {
  const named = reference.value;
  const isKindShown = named?.kind === (props.tab === 'repositories' ? 'repository' : 'project');
  const isListed = shownRows.value.length > 0 || matchingOffers.value.length > 0;
  const isOwnerNamed = owner.value === ALL_OWNERS || owner.value.toLowerCase() === named?.owner.toLowerCase();
  return named && isKindShown && props.candidates && !isListed && isOwnerNamed ? named : null;
});
const foundOffer = computed((): OfferRow | null => {
  const candidate = found.value;
  if (!candidate) {
    return null;
  }

  if ('nameWithOwner' in candidate) {
    return trackedKeys.value.has(candidate.nameWithOwner) ? null : toRepositoryOffer(candidate);
  }

  return trackedKeys.value.has(candidate.id) ? null : toProjectOffer(candidate);
});
// The owners a filter looks through: a search that names an owner (`acme/web`, or the tail of a login, `me/web`) only
// that one's, and one naming a project none, as projects are all read at once.
const pagedOwners = computed(() => {
  const candidates = props.candidates;
  if (!candidates || props.tab !== 'repositories' || !narrowed.value || reference.value?.kind === 'project') {
    return [];
  }

  const named = reference.value?.owner.toLowerCase();
  return getOwnerLists(candidates).filter(
    list => isOwnerShown(list.login) && (named === undefined || list.login.toLowerCase().endsWith(named)),
  );
});
const pagesLeft = computed(() => pagedOwners.value.some(list => list.nextCursor !== null));
const untrackedTotal = computed(() => {
  const candidates = props.candidates;
  if (!candidates) {
    return 0;
  }

  if (props.tab === 'projects') {
    return untrackedProjects.value.length;
  }

  return sumOver(
    getOwnerLists(candidates).filter(list => isOwnerShown(list.login)),
    list => Math.max(0, list.totalCount - props.tracked.repositories.filter(row => row.owner === list.login).length),
  );
});
const offerSections = computed((): OfferSection[] => {
  if (!props.candidates) {
    return [];
  }

  if (!narrowed.value && props.tab === 'repositories') {
    return props.suggested.length === 0
      ? []
      : [{ name: t(l.suggested), detail: t(l.suggestedDetail), rows: props.suggested.map(toSuggestedOffer) }];
  }

  const listed =
    props.tab === 'repositories'
      ? matchingRepositories.value.map(toRepositoryOffer)
      : matchingProjects.value.map(toProjectOffer);
  const offered = foundOffer.value ? [...listed, foundOffer.value] : listed;
  // Nothing left of the owner chosen: the line under the lists says so, not a heading over nothing.
  const isOwnerDone = needle.value === '' && untrackedTotal.value === 0;
  return offered.length === 0 && (!narrowed.value || isOwnerDone)
    ? []
    : [{ name: t(l.notTracked), detail: getNotTrackedDetail(listed.length), rows: offered }];
});
const offers = computed(() => offerSections.value.flatMap(section => section.rows));
// Net of the suggestions `untrackedTotal` counted: those of an owner whose list GitHub gave.
const moreRepositories = computed(() => {
  const listed = new Set(props.candidates ? getOwnerLists(props.candidates).map(list => list.login) : []);
  const suggestedCounted = props.suggested.filter(repository =>
    listed.has(parseRepositoryName(repository.nameWithOwner).owner),
  );
  return Math.max(0, untrackedTotal.value - suggestedCounted.length);
});
// Under the lists: what is left to find, what tracking a project means, or that nothing matches once all was read.
const listNote = computed(() => {
  if (!props.candidates) {
    return null;
  }

  if (narrowed.value) {
    if (needle.value === '' && owner.value !== ALL_OWNERS && untrackedTotal.value === 0) {
      return getOwnerDoneNote();
    }

    const nothing = shownRows.value.length === 0 && offers.value.length === 0;
    return needle.value !== '' && nothing && !lookingUp.value && !pagesLeft.value
      ? t(l.noMatch, { filter: searchText.value })
      : null;
  }

  if (props.tab === 'projects') {
    return t(l.projectsNote);
  }

  return moreRepositories.value > 0
    ? t(l.moreRepositories, { count: moreRepositories.value, formatted: numbers.format(moreRepositories.value) })
    : null;
});
const organizations = computed(() => props.candidates?.organizations ?? []);
const ownerOrganization = computed(() => organizations.value.find(organization => organization.login === owner.value));

// The rest of what the filter looks through, a page at a time and an owner at a time: a page that arrives changes
// `pagedOwners`, which asks for the next; one that fails changes nothing, which stops it. With no filter on there
// are no owners to read, so clearing it stops the reading.
watchEffect(() => {
  const next = pagedOwners.value.find(list => list.nextCursor !== null);
  if (next) {
    emit('loadMore', next.login);
  }
});

// Latest wins: a change cancels the wait for the delay, and what was asked before it is dropped when it answers.
watch(
  lookupReference,
  (named, _before, onCleanup) => {
    found.value = null;
    lookingUp.value = named !== null;
    if (!named) {
      return;
    }

    let stale = false;
    const timer = setTimeout(() => void lookUp(named, () => stale), LOOKUP_DELAY_MS);
    onCleanup(() => {
      stale = true;
      clearTimeout(timer);
    });
  },
  { immediate: true },
);

onWindowEvent('keydown', event => {
  if (event.key === '/' && isSingleKeyShortcut(event) && !isLayerOpen()) {
    event.preventDefault();
    searchField.value?.focus();
    return;
  }

  if (!isSingleKeyShortcut(event) || !listKeys.isInside(event.target)) {
    return;
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    const target = findRowTarget(event.target);
    if (target) {
      event.preventDefault();
      actOnRow(event.target, 0, () => emit('untrack', target));
    }
  } else if (event.key.toLowerCase() === 't') {
    const offer = findOffer(event.target);
    if (offer) {
      event.preventDefault();
      // The row goes up into the tracked ones, or away: the next one takes the focus.
      actOnRow(event.target, 1, () => offer.track());
    }
  }
});

async function lookUp(named: TrackingReference, isStale: () => boolean) {
  const candidate = await props.find(named);
  if (!isStale()) {
    found.value = candidate;
    lookingUp.value = false;
  }
}

/** Runs a key's action, then puts the focus `step` rows on from where it was, so the keyboard goes on from there. */
function actOnRow(from: EventTarget | null, step: 0 | 1, run: () => void) {
  const index = from instanceof Element ? getRowElements().findIndex(element => element.contains(from)) : -1;
  run();
  void nextTick(() => {
    const elements = getRowElements();
    elements[Math.min(index + step, elements.length - 1)]?.focus();
  });
}

function getRowElements() {
  return [...(lists.value?.querySelectorAll<HTMLElement>('[data-row-focus]') ?? [])];
}

function isOwnerShown(login: string) {
  return owner.value === ALL_OWNERS || owner.value === login;
}

function matchesSearch(name: string, path: string) {
  return (
    name.toLowerCase().includes(needle.value) ||
    (referencePath.value !== null && path.toLowerCase() === referencePath.value)
  );
}

// How many are listed of how many there are; one looked up by name is no part of the lists, so it is not counted.
function getNotTrackedDetail(listed: number) {
  const total = numbers.format(untrackedTotal.value);
  const hidden = ownerOrganization.value?.hiddenPrivate ? [t(l.privateHidden)] : [];
  if (needle.value === '') {
    return owner.value === ALL_OWNERS
      ? t(l.projectsYouCanSee, { count: untrackedTotal.value, formatted: total })
      : [t(l.inOwner, { total, owner: owner.value }), ...hidden].join(' · ');
  }

  if (foundOffer.value) {
    return hidden.join('');
  }

  const counted = numbers.format(listed);
  const matching =
    owner.value === ALL_OWNERS
      ? t(l.matching, { matching: counted, total })
      : t(l.matchingInOwner, { matching: counted, total, owner: owner.value });
  return [matching, ...hidden].join(' · ');
}

// The owner chosen has nothing left to track: one hiding its private data says so instead of a count.
function getOwnerDoneNote() {
  const organization = ownerOrganization.value;
  if (!organization?.hiddenPrivate) {
    return t(l.ownerDone, { owner: owner.value });
  }

  return props.tab === 'repositories' ? hiddenLimit(organization) : t(l.hiddenProjects);
}

function toRepositoryOffer(repository: CandidateRepository): OfferRow {
  return {
    key: repository.nameWithOwner,
    name: repository.nameWithOwner,
    icon: repository.isPrivate ? Lock : BookMarked,
    isPrivate: repository.isPrivate,
    owner: null,
    meta: [
      t(l.open, { count: repository.openIssues + repository.openPullRequests }),
      ...(repository.isArchived ? [t(l.archived)] : []),
    ].join(' · '),
    active: repository.pushedAt === null ? null : activeText(Date.parse(repository.pushedAt)),
    track: () => emit('track', repository),
  };
}

function toProjectOffer(project: CandidateProject): OfferRow {
  return {
    key: project.id,
    name: project.title,
    icon: SquareKanban,
    isPrivate: null,
    owner: project.owner,
    meta: itemsText(project.itemCount),
    active: null,
    track: () => emit('track', project),
  };
}

function toSuggestedOffer(repository: SuggestedRepository): OfferRow {
  return {
    key: repository.nameWithOwner,
    name: repository.nameWithOwner,
    icon: repository.isPrivate ? Lock : BookMarked,
    isPrivate: repository.isPrivate,
    owner: null,
    meta: t(l.inMyWork, { count: repository.items, age: formatCheckedAge(repository.activeAt, props.now) }),
    active: null,
    track: () => emit('trackSuggested', repository.nameWithOwner),
  };
}

function itemsText(count: number) {
  return t(l.items, { count, formatted: numbers.format(count) });
}

function activeText(at: number) {
  return t(l.active, { age: formatCheckedAge(at, props.now) });
}

function trackedDetail() {
  if (narrowed.value) {
    return t(l.matches, { count: shownRows.value.length });
  }

  const parts = [
    props.tab === 'repositories'
      ? t(l.trackedRepositories, { count: rows.value.length })
      : t(l.trackedProjects, { count: rows.value.length }),
  ];
  if (itemsKept.value > 0) {
    parts.push(itemsText(itemsKept.value));
  }

  if (props.tab === 'repositories' && rows.value.length > 0 && props.storedBytes !== null) {
    parts.push(t(l.inThisBrowser, { size: formatBytes(props.storedBytes) }));
  }

  return parts.join(' · ');
}

function hiddenLimit(organization: CandidateOrganization) {
  const list = organization.repositories;
  return list ? t(l.hiddenLimitCounted, { count: list.totalCount }) : t(l.hiddenLimit);
}

function stateText(state: TrackedRowState) {
  switch (state.kind) {
    case 'downloading':
      return t(l.waiting);
    case 'hidden':
      return t(l.hidden);
    case 'refused':
      return t(l.refused);
    case 'read': {
      const read = readText(state.at);
      return state.slower ? t(l.slower, { read }) : read;
    }
  }
}

function readText(at: number | null) {
  if (at === null) {
    return t(l.staleNever);
  }

  return t(l.ago, { age: formatCheckedAge(at, props.now) });
}

function rowIcon(row: TrackedRow) {
  if (row.target.kind === 'project') {
    return SquareKanban;
  }

  return row.isPrivate === true ? Lock : BookMarked;
}

function findRowTarget(from: EventTarget | null): TrackedTarget | null {
  const element = from instanceof Element ? from.closest<HTMLElement>('[data-tracked-key]') : null;
  const key = element?.dataset.trackedKey;
  return rows.value.find(row => keyOf(row.target) === key)?.target ?? null;
}

function findOffer(from: EventTarget | null) {
  const element = from instanceof Element ? from.closest<HTMLElement>('[data-offer-key]') : null;
  const key = element?.dataset.offerKey;
  return offers.value.find(offer => offer.key === key) ?? null;
}

/** Its approval was requested from here, and it no longer hides anything: approved, as far as githq can tell (D14). */
function isApproved(organization: { readonly login: string; readonly hiddenPrivate: boolean }) {
  return !organization.hiddenPrivate && props.approvals[organization.login] != null;
}

function getOrganizationState(organization: { readonly login: string; readonly hiddenPrivate: boolean }) {
  if (organization.hiddenPrivate) {
    return l.privateHidden;
  }

  return isApproved(organization) ? l.approved : l.noRestrictions;
}

function keyOf(target: TrackedTarget) {
  return target.kind === 'repository' ? `repository:${target.nameWithOwner}` : `project:${target.id}`;
}
</script>

<template>
  <div :class="css.trackingView">
    <Teleport
      defer
      :to="`#${SETTINGS_CONTROLS_ID}`"
    >
      <Menu align="end">
        <template #trigger>
          <Button
            :class="css.trackingView_owner"
            size="sm"
            variant="outline"
            :aria-label="t(l.ownerLabel, { owner: owner === ALL_OWNERS ? t(l.allOwners) : owner })"
          >
            {{ owner === ALL_OWNERS ? t(l.allOwners) : owner }}
            <ChevronDown
              :class="css.trackingView_ownerIcon"
              aria-hidden="true"
            />
          </Button>
        </template>
        <MenuRadioGroup v-model="owner">
          <MenuRadioItem :value="ALL_OWNERS">{{ t(l.allOwners) }}</MenuRadioItem>
          <MenuRadioItem
            v-for="login in owners"
            :key="login"
            :value="login"
          >
            {{ login }}
          </MenuRadioItem>
        </MenuRadioGroup>
      </Menu>
      <SearchField
        ref="searchField"
        v-model="filter"
        :class="css.trackingView_search"
        size="sm"
        :label="t(l.findLabel)"
        :placeholder="t(tab === 'repositories' ? l.findRepository : l.findProject)"
        kbd="/"
        @keydown="listKeys.onFilterKeydown"
      />
    </Teleport>

    <div :class="css.trackingView_body">
      <div
        ref="lists"
        :class="css.trackingView_lists"
      >
        <section
          v-if="!narrowed || shownRows.length > 0"
          :aria-label="t(l.tracked)"
        >
          <div :class="css.trackingView_section">
            <h2 :class="css.trackingView_sectionName">{{ t(l.tracked) }}</h2>
            <span :class="css.trackingView_sectionDetail">{{ trackedDetail() }}</span>
          </div>
          <ul :class="css.trackingView_rows">
            <li
              v-for="row in shownRows"
              :key="keyOf(row.target)"
              :class="css.trackingView_row"
              :data-tracked-key="keyOf(row.target)"
            >
              <component
                :is="rowIcon(row)"
                :class="css.trackingView_icon"
                aria-hidden="true"
              />
              <span :class="css.trackingView_title">
                <RouterLink
                  :to="row.to"
                  :class="css.trackingView_name"
                  data-row-focus
                  aria-keyshortcuts="Backspace"
                  >{{ row.name }}</RouterLink
                >
                <span
                  v-if="row.target.kind === 'project'"
                  :class="css.trackingView_owned"
                  >{{ row.owner }}</span
                >
                <span
                  v-else-if="row.isPrivate !== null"
                  :class="css.trackingView_tag"
                  >{{ t(row.isPrivate ? l.private : l.public) }}</span
                >
              </span>
              <template v-if="row.state.kind === 'downloading' && row.state.total">
                <span :class="css.trackingView_downloading">{{
                  t(l.downloading, { done: numbers.format(row.state.done), total: numbers.format(row.state.total) })
                }}</span>
                <span :class="css.trackingView_spacer" />
                <Button
                  :class="css.trackingView_untrack"
                  size="sm"
                  variant="outline"
                  kbd="Backspace"
                  @click="emit('untrack', row.target)"
                >
                  {{ t(l.untrack) }}
                </Button>
                <ProgressBar
                  :class="css.trackingView_bar"
                  :value="row.state.done / row.state.total"
                  :label="row.name"
                />
              </template>
              <template v-else>
                <span
                  v-if="row.items !== null"
                  :class="row.target.kind === 'repository' ? css.trackingView_items : css.trackingView_meta"
                  >{{ row.target.kind === 'repository' ? numbers.format(row.items) : itemsText(row.items) }}</span
                >
                <span
                  v-if="narrowed"
                  :class="css.trackingView_spacer"
                />
                <span
                  v-if="row.activeAt !== null"
                  :class="css.trackingView_meta"
                  >{{ activeText(row.activeAt) }}</span
                >
                <span
                  v-if="!narrowed"
                  :class="css.trackingView_spacer"
                />
                <Button
                  :class="css.trackingView_untrack"
                  size="sm"
                  variant="outline"
                  kbd="Backspace"
                  @click="emit('untrack', row.target)"
                >
                  {{ t(l.untrack) }}
                </Button>
                <span
                  :class="[
                    css.trackingView_state,
                    (row.state.kind === 'hidden' || row.state.kind === 'refused') && css.trackingView_state_amber,
                  ]"
                >
                  <span
                    v-if="row.state.kind === 'read'"
                    :class="[css.trackingView_dot, row.state.fresh && css.trackingView_dot_fresh]"
                    aria-hidden="true"
                  />
                  {{ stateText(row.state) }}
                </span>
              </template>
            </li>
          </ul>
          <p
            v-if="!narrowed && tab === 'repositories' && rows.length > 0"
            :class="css.trackingView_note"
          >
            {{ t(l.untrackNote) }}
          </p>
        </section>

        <section
          v-for="section in offerSections"
          :key="section.name"
          :aria-label="section.name"
        >
          <div :class="css.trackingView_section">
            <h2 :class="css.trackingView_sectionName">{{ section.name }}</h2>
            <span :class="css.trackingView_sectionDetail">{{ section.detail }}</span>
          </div>
          <ul :class="css.trackingView_rows">
            <li
              v-for="row in section.rows"
              :key="row.key"
              :class="css.trackingView_row"
              :data-offer-key="row.key"
              @focusin="selectedOffer = row.key"
              @focusout="selectedOffer = null"
            >
              <component
                :is="row.icon"
                :class="css.trackingView_icon"
                aria-hidden="true"
              />
              <span :class="css.trackingView_title">
                <span :class="css.trackingView_name">{{ row.name }}</span>
                <span
                  v-if="row.isPrivate !== null"
                  :class="css.trackingView_tag"
                  >{{ t(row.isPrivate ? l.private : l.public) }}</span
                >
                <span
                  v-if="row.owner !== null"
                  :class="css.trackingView_owned"
                  >{{ row.owner }}</span
                >
              </span>
              <span :class="css.trackingView_meta">{{ row.meta }}</span>
              <span :class="css.trackingView_spacer" />
              <span
                v-if="row.active !== null"
                :class="css.trackingView_meta"
                >{{ row.active }}</span
              >
              <Button
                size="sm"
                variant="outline"
                :icon="Plus"
                :kbd="selectedOffer === row.key ? 'T' : undefined"
                aria-keyshortcuts="T"
                data-row-focus
                @click="row.track()"
              >
                {{ t(l.track) }}
              </Button>
            </li>
          </ul>
        </section>

        <p
          v-if="listNote"
          :class="css.trackingView_note"
        >
          {{ listNote }}
        </p>
      </div>

      <aside
        v-if="!candidates || organizations.length > 0"
        :class="css.trackingView_side"
        :aria-label="t(l.organisations)"
      >
        <h2 :class="css.trackingView_sectionName">{{ t(l.organisations) }}</h2>
        <p
          v-if="!candidates"
          :class="css.trackingView_note"
          role="status"
        >
          {{ t(l.readingOrganisations) }}
        </p>
        <div
          v-for="organization in organizations"
          :key="organization.login"
          :class="[css.trackingView_org, organization.hiddenPrivate && css.trackingView_org_hidden]"
        >
          <div :class="css.trackingView_orgLine">
            <component
              :is="organization.hiddenPrivate ? Lock : CircleCheck"
              :class="css.trackingView_orgIcon"
              aria-hidden="true"
            />
            <span :class="css.trackingView_orgName">{{ organization.login }}</span>
            <span
              :class="[css.trackingView_orgState, isApproved(organization) && css.trackingView_orgState_approved]"
              >{{ t(getOrganizationState(organization)) }}</span
            >
          </div>
          <template v-if="organization.hiddenPrivate">
            <p :class="css.trackingView_orgDetail">
              {{ t(l.hiddenDetail) }}
              <template v-if="approvals[organization.login] != null">
                {{ t(l.hiddenRequested, { date: formatShortDate(approvals[organization.login] ?? 0) }) }}
              </template>
              {{ hiddenLimit(organization) }}
            </p>
            <div>
              <Button
                size="sm"
                :link="approvalUrl"
                :icon="ArrowUpRight"
                target="_blank"
                @click="emit('requestApproval', organization.login)"
              >
                {{ t(l.requestApproval) }}
              </Button>
            </div>
          </template>
        </div>
      </aside>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.trackingView {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.trackingView_spacer {
  flex: 1;
}

// In the header: at its full width where there is room, shrinking first where there is not.
.trackingView_search {
  flex: 1 1 120px;
  max-width: 280px;
}

.trackingView_owner {
  flex: none;
}

.trackingView_ownerIcon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}

.trackingView_body {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 28px;
  align-content: flex-start;
  align-items: flex-start;
  min-height: 0;
  padding: 20px;
  overflow-y: auto;
}

// Too narrow for both, the organisations go under the lists.
.trackingView_lists {
  display: flex;
  flex: 1 1 420px;
  flex-direction: column;
  gap: $spacing-8;
  max-width: 796px;
  min-width: 0;
}

.trackingView_section {
  display: flex;
  gap: $spacing-8;
  align-items: baseline;
  padding: 10px $spacing-12 $spacing-6;
}

.trackingView_sectionName {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $color-fg-2;
}

.trackingView_sectionDetail {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.trackingView_rows {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: 0;
  margin: 0;
  list-style: none;
}

.trackingView_row {
  display: flex;
  gap: $spacing-12;
  align-items: center;
  min-height: 34px;
  padding: $spacing-4 $spacing-12;
  border-radius: $radius-md;

  &:hover {
    background: $color-bg-2;
  }

  &:focus-within {
    background: $color-sel;
  }
}

.trackingView_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.trackingView_title {
  display: flex;
  flex: 0 1 280px;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
}

.trackingView_name {
  @include focus-ring;

  min-width: 0;
  overflow: hidden;
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  color: $color-fg;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: $radius-sm;
}

.trackingView_tag {
  flex: none;
  padding: 0 $spacing-6;
  font-size: 11px;
  line-height: 13px;
  color: $color-fg-dim;
  border: 1px solid $color-border-2;
  border-radius: $radius-sm;
}

.trackingView_owned {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.trackingView_items {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.trackingView_meta {
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trackingView_downloading {
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-xs;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trackingView_bar {
  flex: none;
  width: 120px;
}

// Shown on the row the pointer or the focus is on.
.trackingView_untrack {
  visibility: hidden;

  .trackingView_row:hover &,
  .trackingView_row:focus-within & {
    visibility: visible;
  }
}

// A long state ("GitHub refuses…") wraps before the name or the counts give way.
.trackingView_state {
  display: inline-flex;
  flex: 0 1000 auto;
  gap: $spacing-6;
  align-items: center;
  justify-content: flex-end;
  min-width: 80px;
  text-align: right;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.trackingView_state_amber {
  color: $color-amber;
}

.trackingView_dot {
  width: 6px;
  height: 6px;
  background: $color-amber;
  border-radius: 50%;
}

.trackingView_dot_fresh {
  background: $color-green;
}

.trackingView_note {
  padding: $spacing-2 $spacing-12 $spacing-10 38px;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.trackingView_side {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: $spacing-12;
  width: 340px;
  padding-top: 10px;
}

.trackingView_org {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  padding: 10px $spacing-12;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
}

.trackingView_org_hidden {
  background: rgba($color-amber, 0.05);
  border-color: rgba($color-amber, 0.33);
}

.trackingView_orgLine {
  display: flex;
  gap: $spacing-8;
  align-items: center;
}

.trackingView_orgIcon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;

  .trackingView_org_hidden & {
    color: $color-amber;
  }
}

.trackingView_orgName {
  flex: 1;
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.trackingView_orgState {
  font-size: $font-size-xs;
  color: $color-fg-dim;

  .trackingView_org_hidden & {
    color: $color-amber;
  }
}

.trackingView_orgState_approved {
  color: $color-green;
}

.trackingView_orgDetail {
  font-size: $font-size-xs;
  line-height: 18px;
  color: $color-fg-dim;
}
</style>
