<!-- Changing what is tracked, later (G8), the body of Settings' Repositories and Projects sections: one place for both directions. What is tracked — how much of it this browser keeps and how fresh it is, with "Untrack" (⌫) — and what could be: the repositories the user's work lives in, what the user and their organisations have (found with `/`), and anyone's by name. The organisations hiding their private data from githq stay listed beside it, with the way to request approval. Repositories and projects each in their own section (`tab`). -->
<script lang="ts">
import type { TrackedTarget } from './TrackingTypes.js';

/** How a tracked repository or project stands now. */
export type TrackedRowState =
  | { readonly kind: 'downloading'; readonly percent: number | null }
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
  readonly to: string;
  readonly isPrivate: boolean;
  /** Its items this browser keeps; `null` before it counted them. */
  readonly items: number | null;
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
import { ArrowUpRight, BookMarked, CircleCheck, Lock, Plus, SquareKanban } from 'lucide-vue-next';
import { computed, ref, useTemplateRef } from 'vue';
import { RouterLink } from 'vue-router';

import Button from '@/components/Button.vue';
import SearchField from '@/components/SearchField.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { formatAge } from '@/utils/formatAge.js';
import { formatCheckedAge } from '@/utils/formatCheckedAge.js';
import { formatShortDate } from '@/utils/formatShortDate.js';
import { isSingleKeyShortcut } from '@/utils/isSingleKeyShortcut.js';
import { useFilteredListKeys } from '@/utils/useFilteredListKeys.js';

import TrackByName from './TrackByName.vue';
import { getCandidateProjects, getCandidateRepositories } from './trackingCandidates.js';
import * as l from './TrackingView.loc.js';
import type { CandidateProject, CandidateRepository, TrackingCandidates } from './TrackingTypes.js';
import { getApprovalUrl } from './utils/getApprovalUrl.js';
import type { TrackingReference } from './utils/parseTrackingReference.js';

/** How many untracked ones a filter lists. */
const MATCHES_SHOWN = 20;

const props = defineProps<{
  tracked: { readonly repositories: readonly TrackedRow[]; readonly projects: readonly TrackedRow[] };
  suggested: readonly SuggestedRepository[];
  /** What the user and their organisations have; `null` while it is read. */
  candidates: TrackingCandidates | null;
  approvals: Readonly<Record<string, number>>;
  now: number;
  find: (reference: TrackingReference) => Promise<CandidateProject | CandidateRepository | null>;
  tab: TrackingTab;
}>();

const emit = defineEmits<{
  untrack: [target: TrackedTarget];
  /** A repository of "my work", by name: the section finds what it needs to track it. */
  trackSuggested: [nameWithOwner: string];
  track: [candidate: CandidateProject | CandidateRepository];
  requestApproval: [organization: string];
}>();

const t = useTranslate();
const browser = useService(Browser);
const numbers = new Intl.NumberFormat(APP_LANGUAGE);
const searchField = useTemplateRef<{ focus(): void }>('searchField');
const lists = useTemplateRef<HTMLElement>('lists');

const filter = ref('');
const listKeys = useFilteredListKeys({ container: lists, rows: '[data-row-focus]', filterField: searchField, filter });

const approvalUrl = getApprovalUrl(browser.origin);
const needle = computed(() => filter.value.trim().toLowerCase());
const rows = computed(() => (props.tab === 'repositories' ? props.tracked.repositories : props.tracked.projects));
const shownRows = computed(() =>
  needle.value === '' ? rows.value : rows.value.filter(row => row.name.toLowerCase().includes(needle.value)),
);
const itemsKept = computed(() => sumOver(rows.value, row => row.items ?? 0));
const trackedKeys = computed(
  () =>
    new Set([
      ...props.tracked.repositories.map(row => row.name),
      ...props.tracked.projects.map(row => (row.target.kind === 'project' ? row.target.id : '')),
    ]),
);
const untrackedRepositories = computed((): CandidateRepository[] => {
  const candidates = props.candidates;
  if (!candidates) {
    return [];
  }

  return getCandidateRepositories(candidates).filter(repository => !trackedKeys.value.has(repository.nameWithOwner));
});
const untrackedProjects = computed((): CandidateProject[] => {
  const candidates = props.candidates;
  if (!candidates) {
    return [];
  }

  return getCandidateProjects(candidates).filter(project => !trackedKeys.value.has(project.id));
});
const matchingRepositories = computed(() =>
  untrackedRepositories.value
    .filter(repository => repository.nameWithOwner.toLowerCase().includes(needle.value))
    .slice(0, MATCHES_SHOWN),
);
const matchingProjects = computed(() =>
  untrackedProjects.value
    .filter(project => needle.value === '' || project.title.toLowerCase().includes(needle.value))
    .slice(0, MATCHES_SHOWN),
);
const organizations = computed(() => props.candidates?.organizations ?? []);

onWindowEvent('keydown', event => {
  if (event.key === '/' && isSingleKeyShortcut(event)) {
    event.preventDefault();
    searchField.value?.focus();
    return;
  }

  if (
    (event.key === 'Backspace' || event.key === 'Delete') &&
    isSingleKeyShortcut(event) &&
    listKeys.isInside(event.target)
  ) {
    const target = findRowTarget(event.target);
    if (target) {
      event.preventDefault();
      emit('untrack', target);
    }
  }
});

function stateText(state: TrackedRowState) {
  switch (state.kind) {
    case 'downloading':
      return state.percent === null ? t(l.waiting) : t(l.downloading, { percent: state.percent });
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

  return row.isPrivate ? Lock : BookMarked;
}

function findRowTarget(from: EventTarget | null): TrackedTarget | null {
  const element = from instanceof Element ? from.closest<HTMLElement>('[data-tracked-key]') : null;
  const key = element?.dataset.trackedKey;
  return rows.value.find(row => keyOf(row.target) === key)?.target ?? null;
}

function keyOf(target: TrackedTarget) {
  return target.kind === 'repository' ? `repository:${target.nameWithOwner}` : `project:${target.id}`;
}
</script>

<template>
  <div :class="css.trackingView">
    <header :class="css.trackingView_header">
      <span :class="css.trackingView_spacer" />
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
    </header>

    <div :class="css.trackingView_body">
      <div
        ref="lists"
        :class="css.trackingView_lists"
      >
        <section :aria-label="t(l.tracked)">
          <div :class="css.trackingView_section">
            <h2 :class="css.trackingView_sectionName">{{ t(l.tracked) }}</h2>
            <span :class="css.trackingView_sectionDetail">
              {{
                tab === 'repositories'
                  ? t(l.trackedRepositories, { count: rows.length })
                  : t(l.trackedProjects, { count: rows.length })
              }}<template v-if="itemsKept > 0">
                · {{ t(l.itemsKept, { count: itemsKept, formatted: numbers.format(itemsKept) }) }}</template
              >
            </span>
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
                :class="[css.trackingView_icon, row.target.kind === 'project' && css.trackingView_icon_project]"
                aria-hidden="true"
              />
              <RouterLink
                :to="row.to"
                :class="css.trackingView_name"
                data-row-focus
                aria-keyshortcuts="Backspace"
                >{{ row.name }}</RouterLink
              >
              <span :class="css.trackingView_items">{{ row.items === null ? '' : numbers.format(row.items) }}</span>
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
            </li>
          </ul>
          <p
            v-if="rows.length > 0"
            :class="css.trackingView_note"
          >
            {{ t(l.untrackNote) }}
          </p>
        </section>

        <section
          v-if="tab === 'repositories' && needle === '' && suggested.length > 0"
          :aria-label="t(l.suggested)"
        >
          <div :class="css.trackingView_section">
            <h2 :class="css.trackingView_sectionName">{{ t(l.suggested) }}</h2>
            <span :class="css.trackingView_sectionDetail">{{ t(l.suggestedDetail) }}</span>
          </div>
          <ul :class="css.trackingView_rows">
            <li
              v-for="repository in suggested"
              :key="repository.nameWithOwner"
              :class="css.trackingView_row"
            >
              <component
                :is="repository.isPrivate ? Lock : BookMarked"
                :class="css.trackingView_icon"
                aria-hidden="true"
              />
              <span :class="css.trackingView_name">{{ repository.nameWithOwner }}</span>
              <span :class="css.trackingView_meta">{{
                t(l.inMyWork, { count: repository.items, age: formatAge(repository.activeAt, now) })
              }}</span>
              <span :class="css.trackingView_spacer" />
              <Button
                size="sm"
                :icon="Plus"
                data-row-focus
                @click="emit('trackSuggested', repository.nameWithOwner)"
              >
                {{ t(l.track) }}
              </Button>
            </li>
          </ul>
        </section>

        <section
          v-if="(tab === 'repositories' && needle !== '') || (tab === 'projects' && matchingProjects.length > 0)"
          :aria-label="t(l.notTracked)"
        >
          <div :class="css.trackingView_section">
            <h2 :class="css.trackingView_sectionName">
              {{ tab === 'projects' && needle === '' ? t(l.suggested) : t(l.notTracked) }}
            </h2>
            <span :class="css.trackingView_sectionDetail">{{
              needle === '' ? t(l.suggestedProjectsDetail) : t(l.matching, { filter: filter.trim() })
            }}</span>
          </div>
          <ul :class="css.trackingView_rows">
            <template v-if="tab === 'repositories'">
              <li
                v-for="repository in matchingRepositories"
                :key="repository.nameWithOwner"
                :class="css.trackingView_row"
              >
                <component
                  :is="repository.isPrivate ? Lock : BookMarked"
                  :class="css.trackingView_icon"
                  aria-hidden="true"
                />
                <span :class="css.trackingView_name">{{ repository.nameWithOwner }}</span>
                <span :class="css.trackingView_spacer" />
                <Button
                  size="sm"
                  :icon="Plus"
                  data-row-focus
                  @click="emit('track', repository)"
                >
                  {{ t(l.track) }}
                </Button>
              </li>
            </template>
            <template v-else>
              <li
                v-for="project in matchingProjects"
                :key="project.id"
                :class="css.trackingView_row"
              >
                <SquareKanban
                  :class="[css.trackingView_icon, css.trackingView_icon_project]"
                  aria-hidden="true"
                />
                <span :class="css.trackingView_name">{{ project.title }}</span>
                <span :class="css.trackingView_meta">{{
                  t(l.projectMeta, { owner: project.owner, count: project.itemCount })
                }}</span>
                <span :class="css.trackingView_spacer" />
                <Button
                  size="sm"
                  :icon="Plus"
                  data-row-focus
                  @click="emit('track', project)"
                >
                  {{ t(l.track) }}
                </Button>
              </li>
            </template>
          </ul>
          <p
            v-if="needle !== '' && (tab === 'repositories' ? matchingRepositories : matchingProjects).length === 0"
            :class="css.trackingView_note"
          >
            {{ t(l.noMatch, { filter: filter.trim() }) }}
          </p>
        </section>

        <section :aria-label="t(l.byName)">
          <div :class="css.trackingView_section">
            <h2 :class="css.trackingView_sectionName">{{ t(l.byName) }}</h2>
            <span :class="css.trackingView_sectionDetail">{{ t(l.byNameDetail) }}</span>
          </div>
          <div :class="css.trackingView_byName">
            <TrackByName
              :find="find"
              @found="emit('track', $event)"
            />
          </div>
        </section>
      </div>

      <aside
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
            <span :class="css.trackingView_orgState">{{
              t(organization.hiddenPrivate ? l.privateHidden : l.visible)
            }}</span>
          </div>
          <template v-if="organization.hiddenPrivate">
            <p :class="css.trackingView_orgDetail">
              {{
                approvals[organization.login] == null
                  ? t(l.hiddenDetail)
                  : t(l.hiddenRequested, { date: formatShortDate(approvals[organization.login] ?? 0) })
              }}
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

.trackingView_header {
  display: flex;
  flex: none;
  gap: $spacing-10;
  align-items: center;
  height: $list-header-height;
  padding: 0 20px;
  border-bottom: 1px solid $color-border;
}

.trackingView_spacer {
  flex: 1;
}

.trackingView_search {
  width: 280px;
}

.trackingView_body {
  display: flex;
  flex: 1;
  gap: 28px;
  align-items: flex-start;
  min-height: 0;
  padding: 20px;
  overflow-y: auto;
}

.trackingView_lists {
  display: flex;
  flex: 1;
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

.trackingView_icon_project {
  color: $color-accent;
}

.trackingView_name {
  @include focus-ring;

  flex: none;
  width: 240px;
  overflow: hidden;
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  color: $color-fg;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: $radius-sm;
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

// Shown on the row the pointer or the focus is on.
.trackingView_untrack {
  visibility: hidden;

  .trackingView_row:hover &,
  .trackingView_row:focus-within & {
    visibility: visible;
  }
}

.trackingView_state {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  justify-content: flex-end;
  width: 120px;
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

.trackingView_byName {
  padding: $spacing-4 $spacing-12;
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
  color: $color-green;

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

.trackingView_orgDetail {
  font-size: $font-size-xs;
  line-height: 18px;
  color: $color-fg-dim;
}
</style>
