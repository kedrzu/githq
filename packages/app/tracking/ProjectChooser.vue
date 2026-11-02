<!-- Picking projects to track (T22, D25; `TrackProjectsDialog`): the repository picker's layout (T18) for projects. Owners on the left with how many of their projects are tracked of all — an organisation that hasn't approved githq can't list its projects (G5) and says so in amber, "– / –"; the filter (`/`) and the sort (most recently updated first) above a note on what tracking a project brings in; the projects grouped by owner, the user's own first. A tracked project shows a grey, fixed tick and "tracked", and no key or group action changes it; an owner with all of them tracked folds to its header (Show). Closed projects wait behind "N closed projects hidden" (Show closed), unless a filter is typed. The model is only what is picked. Keys: J/K and ↑/↓ between the rows, Space picks, Shift+click or Shift+Space the shown rows from the last one clicked to this one, ⌘A in the filter all that match, ⌘↵ tracks. A filter naming a project nothing listed matches — its address, or `owner/number` — looks it up (latest wins) and offers it; ticked, it is handed on (`found`). -->
<script lang="ts" setup>
import { sumOver } from '@nzyme/utils/array/sumOver.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { ArrowDownWideNarrow, Building2, Info, Lock, User } from 'lucide-vue-next';
import { computed, ref, useTemplateRef, watch } from 'vue';

import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Button from '@/components/Button.vue';
import ChoiceList from '@/components/ChoiceList.vue';
import type { ChoiceListOption } from '@/components/ChoiceList.vue';
import SearchField from '@/components/SearchField.vue';
import { findMatches, prepareMatchTexts } from '@/utils/findMatches.js';
import { isSingleKeyShortcut } from '@/utils/isSingleKeyShortcut.js';
import { useFilteredListKeys } from '@/utils/useFilteredListKeys.js';

import CandidateProjectRow from './CandidateProjectRow.vue';
import HiddenOrganizationNotice from './HiddenOrganizationNotice.vue';
import * as l from './ProjectChooser.loc.js';
import type { CandidateProject, CandidateRepository, TrackedProject, TrackingCandidates } from './TrackingTypes.js';
import { useCandidateLookup } from './useCandidateLookup.js';
import { parseTrackingReference } from './utils/parseTrackingReference.js';
import type { TrackingReference } from './utils/parseTrackingReference.js';

/** A project's number after its owner, `owner/12`: a project, where `parseTrackingReference` reads a repository. */
const PROJECT_NUMBER = /^\d+$/u;

/** An owner's group of projects. */
interface OwnerGroup {
  readonly login: string;
  readonly own: boolean;
  /** It hasn't approved githq, so GitHub lists none of its projects (G5). */
  readonly hidden: boolean;
  /** Its projects, most recently updated first: what GitHub listed, then what was found by name. */
  readonly projects: readonly CandidateProject[];
  /** Not an owner GitHub listed: shown for a project found by name. */
  readonly unlisted: boolean;
}

/** A group as the list shows it now. */
interface ShownGroup extends OwnerGroup {
  readonly rows: readonly CandidateProject[];
  /** Those of its projects the filter matches, best first. */
  readonly matching: readonly CandidateProject[];
  /** The closed ones matching that wait behind "Show closed". */
  readonly closedHidden: readonly CandidateProject[];
  /** The rows shown that can be picked: not tracked. */
  readonly choosable: readonly CandidateProject[];
  /** How many of its projects are picked. */
  readonly picked: number;
  /** How many of its projects are tracked. */
  readonly tracked: number;
  /** Every one of its projects is tracked. */
  readonly allTracked: boolean;
  /** Folded to its header: all of it tracked, and neither its owner picked, a filter typed nor "Show". */
  readonly folded: boolean;
}

const props = defineProps<{
  /** What the user and their organisations have; `null` while it is read, or when reading it failed. */
  candidates: TrackingCandidates | null;
  /** What the rows' "updated 1d ago" are counted from. */
  now: number;
  /** The projects tracked, which show with a fixed tick. */
  tracked: readonly TrackedProject[];
  /** Looked-up projects the user ticked (the `found` event), kept by the parent so confirming can track them. */
  found: readonly CandidateProject[];
  /** When the user opened GitHub's page to request each organisation's approval (epoch ms). */
  approvals: Readonly<Record<string, number>>;
  /** Looks up a project the filter names (G10). */
  find: (reference: TrackingReference) => Promise<CandidateProject | CandidateRepository | null>;
  /** `candidates` are being read: the list says so. */
  reading?: boolean;
  /** The owner it opens on (a group's "Track more"); all owners when not given or GitHub doesn't list it. */
  initialOwner?: string;
}>();

/** The picked projects, by id. */
const projects = defineModel<readonly string[]>('projects', { required: true });
/** What the filter holds; the parent gives it its first text (`?q=`) and clears it on Esc. */
const filter = defineModel<string>('filter', { default: '' });

const emit = defineEmits<{
  /** ⌘↵. */
  track: [];
  requestApproval: [organization: string];
  /** A looked-up project ticked. */
  found: [project: CandidateProject];
}>();

const t = useTranslate();
const root = useTemplateRef<HTMLElement>('root');
const filterField = useTemplateRef<{ focus(): void }>('filterField');

const owner = ref<string>(props.initialOwner ?? 'all');
const unfoldedOwners = ref<ReadonlySet<string>>(new Set());
const closedShown = ref<ReadonlySet<string>>(new Set());
/** The project last clicked: where a Shift+click's range starts. */
const anchor = ref<string | null>(null);
const listKeys = useFilteredListKeys({
  container: root,
  rows: '[data-tracking-row] [role="checkbox"]',
  filterField,
  filter,
});

const trackedIds = computed(() => new Set(props.tracked.map(project => project.id)));
const picked = computed(() => new Set(projects.value));
const needle = computed(() => filter.value.trim());
const listedGroups = computed((): OwnerGroup[] => {
  const candidates = props.candidates;
  return candidates
    ? [
        { login: candidates.login, own: true, hidden: false, projects: candidates.projects, unlisted: false },
        ...candidates.organizations.map(organization => ({
          login: organization.login,
          own: false,
          hidden: organization.hiddenPrivate,
          projects: organization.projects,
          unlisted: false,
        })),
      ]
    : [];
});
const listedLogins = computed(() => new Set(listedGroups.value.map(group => group.login)));
const listedProjects = computed(() => listedGroups.value.flatMap(group => group.projects));
/** The project the filter names by its address or `owner/number`. */
const reference = computed(() => parseProjectReference(needle.value));
// What the filter names, once nothing listed matches it: not while the lists are first read — after reading them
// failed it still is — and not under an owner picked that it doesn't name.
const lookupReference = computed(() => {
  const named = reference.value;
  if (
    !named ||
    (!props.candidates && props.reading) ||
    (owner.value !== 'all' && owner.value.toLowerCase() !== named.owner.toLowerCase())
  ) {
    return null;
  }

  return isListed() ? null : named;
});
const { lookedUp, lookingUp } = useCandidateLookup({
  reference: () => lookupReference.value,
  find: named => props.find(named),
  accept: candidate => ('nameWithOwner' in candidate ? null : candidate),
});
/** Found by name and not among what GitHub listed: under their owner. */
const extraProjects = computed(() => {
  const listed = new Set(listedProjects.value.map(project => project.id));
  const extras = new Map<string, CandidateProject>();
  for (const project of [...props.found, ...(lookedUp.value ? [lookedUp.value] : [])]) {
    if (!listed.has(project.id)) {
      extras.set(project.id, project);
    }
  }

  return [...extras.values()];
});
const groups = computed((): OwnerGroup[] => {
  const extras = new Map<string, CandidateProject[]>();
  for (const project of extraProjects.value) {
    extras.set(project.owner, [...(extras.get(project.owner) ?? []), project]);
  }

  return [
    ...listedGroups.value.map(group => ({
      ...group,
      projects: sortByUpdate([...group.projects, ...(extras.get(group.login) ?? [])]),
    })),
    ...[...extras]
      .filter(([login]) => !listedLogins.value.has(login))
      .map(([login, found]) => ({ login, own: false, hidden: false, projects: sortByUpdate(found), unlisted: true })),
  ];
});
const pickedHidden = computed(() =>
  owner.value === 'all' ? null : (groups.value.find(group => group.login === owner.value && group.hidden) ?? null),
);
const filteredGroups = computed(() =>
  groups.value.filter(group => owner.value === 'all' || group.login === owner.value).map(showGroup),
);
// A search leaves out the owners it matches nothing of.
const shownGroups = computed(() =>
  needle.value === '' ? filteredGroups.value : filteredGroups.value.filter(group => group.matching.length > 0),
);
/** The rows in the order shown, which a range follows. */
const shownIds = computed(() => shownGroups.value.flatMap(group => group.rows.map(row => row.id)));
const totalProjects = computed(() => listedProjects.value.length);
const ownerOptions = computed((): ChoiceListOption<string>[] => [
  countedOption(
    { value: 'all', label: t(l.allOwners) },
    sumOver(listedGroups.value, group => countTracked(group)),
    totalProjects.value,
  ),
  // Of what GitHub listed: a project found by name isn't counted among all of an owner's.
  ...listedGroups.value.map(group =>
    group.hidden
      ? {
          value: group.login,
          label: group.login,
          icon: Lock,
          warning: true,
          count: t(l.hiddenCount),
          countLabel: t(l.hiddenCountLabel),
        }
      : countedOption(
          { value: group.login, label: group.login, icon: group.own ? User : Building2 },
          countTracked(group),
          group.projects.length,
        ),
  ),
]);
/** The filter matched nothing, nothing was found by its name, and nothing is left to look up. */
const nothingMatches = computed(
  () =>
    needle.value !== '' &&
    !props.reading &&
    shownGroups.value.every(group => group.matching.length === 0) &&
    !lookingUp.value &&
    !lookedUp.value,
);

/** Whether the click toggling a checkbox held Shift; read in the capture phase, before the checkbox toggles. */
let rangeClick = false;

// Another filter shows other rows: a range starts anew.
watch(filter, () => {
  anchor.value = null;
});

// The owner it opened on turns out not to be one GitHub lists (someone else's group's "Track more"): all of them.
watch(
  () => props.candidates,
  candidates => {
    if (candidates && owner.value !== 'all' && !listedLogins.value.has(owner.value)) {
      owner.value = 'all';
    }
  },
  { immediate: true },
);

onWindowEvent('keydown', event => {
  if (event.defaultPrevented) {
    return;
  }

  if (matchesCommandKey(event, 'Mod+Enter')) {
    event.preventDefault();
    emit('track');
    return;
  }

  if (!isSingleKeyShortcut(event)) {
    return;
  }

  // ↑/↓ inside the list took their turn already (`useFilteredListKeys`); here the focus is still on the dialog
  // around it, as it is when it opens.
  switch (event.key) {
    case '/':
      event.preventDefault();
      filterField.value?.focus();
      break;
    case 'j':
    case 'ArrowDown':
      event.preventDefault();
      listKeys.moveFocus(1, event.target);
      break;
    case 'k':
    case 'ArrowUp':
      event.preventDefault();
      listKeys.moveFocus(-1, event.target);
      break;
  }
});

/**
 * A project's address, or `owner/number` — which `parseTrackingReference` reads as a repository. The lookup reads the
 * owner by its login whatever kind it is, and the project found carries its owner's real kind.
 */
function parseProjectReference(text: string): TrackingReference | null {
  const named = parseTrackingReference(text);
  if (named?.kind === 'repository' && PROJECT_NUMBER.test(named.name)) {
    return {
      kind: 'project',
      owner: named.owner,
      ownerKind: named.owner === props.candidates?.login ? 'user' : 'org',
      number: Number(named.name),
    };
  }

  return named?.kind === 'project' ? named : null;
}

/** Whether what the filter names is among the rows already, by its address or a match. */
function isListed() {
  const listed = [...listedProjects.value, ...props.found];
  return listed.some(project => isNamed(project)) || matchProjects(listed).length > 0;
}

/** Whether the filter names this project by its address or `owner/number`. */
function isNamed(project: CandidateProject) {
  const named = reference.value;
  return (
    named?.kind === 'project' &&
    project.number === named.number &&
    project.owner.toLowerCase() === named.owner.toLowerCase()
  );
}

function matchProjects(rows: readonly CandidateProject[]) {
  return findMatches(
    filter.value,
    prepareMatchTexts(rows, project => [project.title]),
  ).map(({ row }) => row);
}

function showGroup(group: OwnerGroup): ShownGroup {
  const matched = matchProjects(group.projects);
  // A project's address finds it too.
  const matching = [...matched, ...group.projects.filter(project => !matched.includes(project) && isNamed(project))];
  const tracked = countTracked(group);
  const allTracked = group.projects.length > 0 && group.projects.every(project => trackedIds.value.has(project.id));
  const folded = allTracked && owner.value === 'all' && needle.value === '' && !unfoldedOwners.value.has(group.login);
  const closedFolded = needle.value === '' && !closedShown.value.has(group.login);
  const rows = folded ? [] : matching.filter(project => !(closedFolded && project.closed));
  return {
    ...group,
    rows,
    matching,
    closedHidden: folded || !closedFolded ? [] : matching.filter(project => project.closed),
    choosable: rows.filter(project => !trackedIds.value.has(project.id)),
    picked: group.projects.filter(project => picked.value.has(project.id)).length,
    tracked,
    allTracked,
    folded,
  };
}

function countTracked(group: OwnerGroup) {
  return props.tracked.filter(project => project.owner === group.login).length;
}

// T22: "your projects · all 1 tracked", "organisation · 2 of 6 tracked · 1 picked", "organisation · projects hidden".
function groupDetail(group: ShownGroup) {
  if (group.hidden) {
    return t(l.projectsHidden);
  }

  const kind = group.unlisted ? [] : [t(group.own ? l.ownKind : l.organisationKind)];
  const pickedCount = group.picked > 0 ? [t(l.pickedCount, { count: group.picked })] : [];
  if (needle.value !== '') {
    const tracked = group.matching.filter(project => trackedIds.value.has(project.id)).length;
    return [
      ...kind,
      t(l.matches, { count: group.matching.length, filter: needle.value }),
      ...(tracked > 0 ? [t(l.trackedCount, { count: tracked })] : []),
      ...pickedCount,
    ].join(' · ');
  }

  if (group.unlisted) {
    return pickedCount.join(' · ');
  }

  const total = group.projects.length;
  const tracked =
    total === 0
      ? t(l.noProjects)
      : group.allTracked
        ? t(l.allTracked, { count: total })
        : t(l.trackedOf, { selected: group.tracked, total });
  return [...kind, tracked, ...pickedCount].join(' · ');
}

function closedText(group: ShownGroup) {
  const names = group.closedHidden
    .map(project => t(l.closedName, { title: project.title, number: project.number }))
    .join(', ');
  return t(l.closedHidden, { count: group.closedHidden.length, names });
}

/** Whether every project of the group the list can pick is picked. */
function isAllPicked(group: ShownGroup) {
  return group.choosable.length > 0 && group.choosable.every(project => picked.value.has(project.id));
}

function toggleGroup(group: ShownGroup) {
  setProjects(
    group.choosable.map(project => project.id),
    !isAllPicked(group),
  );
}

function onFilterKeydown(event: KeyboardEvent) {
  if (matchesCommandKey(event, 'Mod+A') && needle.value !== '') {
    event.preventDefault();
    setProjects(
      shownGroups.value.flatMap(group => group.matching.map(project => project.id)),
      true,
    );
  } else {
    listKeys.onFilterKeydown(event);
  }
}

function addTo(set: ReadonlySet<string>, login: string) {
  return new Set([...set, login]);
}

function onClickCapture(event: MouseEvent) {
  rangeClick = event.shiftKey;
}

/** Keeps a Shift+click on a row from selecting the text up to it. */
function onMousedown(event: MouseEvent) {
  if (event.shiftKey && event.target instanceof Element && event.target.closest('[data-tracking-row]')) {
    event.preventDefault();
    // Kept from the row by the prevented default, the focus follows the click.
    event.target.closest('[data-tracking-row]')?.querySelector<HTMLElement>('[role="checkbox"]')?.focus();
  }
}

/** Picks a project, or with Shift the shown ones from the anchor to it. */
function setProject(id: string, chosen: boolean) {
  setProjects(pickRange(id), chosen);
  anchor.value = id;
}

/** What is tracked is never picked, whatever asks: a range, ⌘A, Select all. */
function setProjects(ids: readonly string[], chosen: boolean) {
  const next = new Set(projects.value);
  for (const id of ids) {
    if (chosen && !trackedIds.value.has(id)) {
      next.add(id);
    } else if (!chosen) {
      next.delete(id);
    }
  }

  projects.value = [...next];
  const looked = lookedUp.value;
  if (chosen && looked && !trackedIds.value.has(looked.id) && ids.includes(looked.id)) {
    emit('found', looked);
  }
}

/** The rows a click on `id` sets: with Shift, all shown from the anchor to it; else, or with no anchor shown, itself. */
function pickRange(id: string) {
  const rows = shownIds.value;
  const from = rangeClick && anchor.value !== null ? rows.indexOf(anchor.value) : -1;
  const to = rows.indexOf(id);
  if (from < 0 || to < 0) {
    return [id];
  }

  return rows.slice(Math.min(from, to), Math.max(from, to) + 1);
}

function countedOption(option: ChoiceListOption<string>, selected: number, total: number): ChoiceListOption<string> {
  return {
    ...option,
    count: t(l.ownerCount, { selected, total }),
    countLabel: t(l.ownerCountTracked, { selected, total }),
  };
}

function sortByUpdate(rows: readonly CandidateProject[]) {
  return rows.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
</script>

<template>
  <div
    ref="root"
    :class="css.projectChooser"
    @click.capture="onClickCapture"
    @mousedown="onMousedown"
  >
    <ChoiceList
      v-if="candidates"
      v-model="owner"
      :label="t(l.owners)"
      :options="ownerOptions"
    />
    <div v-else />

    <section
      :class="css.projectChooser_projects"
      :aria-label="t(l.projects)"
    >
      <div :class="css.projectChooser_tools">
        <SearchField
          ref="filterField"
          v-model="filter"
          :class="css.projectChooser_filter"
          :label="t(l.filterLabel)"
          :placeholder="t(l.filterPlaceholder, { count: totalProjects })"
          kbd="/"
          @keydown="onFilterKeydown"
        />
        <span :class="css.projectChooser_sort">
          <ArrowDownWideNarrow
            :class="css.projectChooser_sortIcon"
            aria-hidden="true"
          />
          {{ t(l.recentlyUpdated) }}
        </span>
      </div>

      <p :class="css.projectChooser_note">
        <Info
          :class="css.projectChooser_noteIcon"
          aria-hidden="true"
        />
        {{ t(l.note) }}
      </p>

      <p
        v-if="!candidates && reading"
        :class="css.projectChooser_text"
        role="status"
      >
        {{ t(l.reading) }}
      </p>
      <p
        v-else-if="!candidates"
        :class="css.projectChooser_text"
        role="alert"
      >
        {{ t(l.notRead) }}
      </p>

      <HiddenOrganizationNotice
        v-if="pickedHidden"
        :organization="pickedHidden.login"
        variant="panel"
        :requested-at="approvals[pickedHidden.login] ?? null"
        @request-approval="emit('requestApproval', pickedHidden.login)"
      />

      <template
        v-for="group in pickedHidden ? [] : shownGroups"
        :key="group.login"
      >
        <div :class="css.projectChooser_group">
          <h2 :class="css.projectChooser_groupName">{{ group.login }}</h2>
          <span :class="css.projectChooser_groupDetail">{{ groupDetail(group) }}</span>
          <Button
            v-if="group.folded"
            variant="framed"
            size="sm"
            @click="unfoldedOwners = addTo(unfoldedOwners, group.login)"
          >
            {{ t(l.show) }}
          </Button>
          <Button
            v-else-if="group.choosable.length > 0"
            variant="framed"
            size="sm"
            @click="toggleGroup(group)"
          >
            {{ isAllPicked(group) ? t(l.selectNone) : t(l.selectAll) }}
          </Button>
        </div>

        <HiddenOrganizationNotice
          v-if="group.hidden"
          :organization="group.login"
          variant="banner"
          subject="projects"
          @explain="owner = group.login"
        />

        <CandidateProjectRow
          v-for="project in group.rows"
          :key="project.id"
          :project="project"
          :now="now"
          :tracked="trackedIds.has(project.id)"
          :model-value="picked.has(project.id)"
          @update:model-value="setProject(project.id, $event)"
        />

        <p
          v-if="group.closedHidden.length > 0"
          :class="css.projectChooser_closed"
        >
          {{ closedText(group) }}
          <Button
            variant="framed"
            size="sm"
            @click="closedShown = addTo(closedShown, group.login)"
          >
            {{ t(l.showClosed) }}
          </Button>
        </p>
      </template>

      <p
        v-if="nothingMatches"
        :class="css.projectChooser_text"
      >
        {{ t(l.nothingMatches, { filter: needle }) }}
      </p>
    </section>
  </div>
</template>

<style lang="scss" module="css">
// The repository picker's layout (T18): the owners and the projects scroll apart, the filter staying over the rows.
.projectChooser {
  display: grid;
  flex: 1;
  grid-template-rows: minmax(0, 1fr);
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 28px;
  min-height: 0;
  padding: $spacing-4 20px 0;

  // A row the keys move to stays clear of the filter over it.
  [data-tracking-row] [role='checkbox'] {
    scroll-margin-top: 56px;
  }
}

.projectChooser_projects {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  min-width: 0;
  padding-bottom: $spacing-12;
  overflow-y: auto;
}

.projectChooser_tools {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding-bottom: $spacing-8;
  background: $color-bg-2;
}

.projectChooser_filter {
  flex: 1;
}

.projectChooser_sort {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  padding: 6px 10px;
  font-size: $font-size-sm;
  color: $color-fg-2;
  border: 1px solid $color-border;
  border-radius: 7px;
}

.projectChooser_sortIcon {
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.projectChooser_note {
  display: flex;
  gap: $spacing-8;
  align-items: flex-start;
  padding: $spacing-4 $spacing-12;
  font-size: $font-size-xs;
  line-height: 18px;
  color: $color-fg-dim;
}

.projectChooser_noteIcon {
  flex: none;
  width: 13px;
  height: 13px;
  margin-top: 2px;
}

.projectChooser_group {
  display: flex;
  gap: $spacing-8;
  align-items: baseline;
  padding: $spacing-12 $spacing-12 $spacing-4;
}

.projectChooser_groupName {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $color-fg-2;
}

.projectChooser_groupDetail {
  flex: 1;
  min-width: 0;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.projectChooser_closed {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  padding: $spacing-4 $spacing-12 $spacing-4 37px;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.projectChooser_text {
  padding: $spacing-4 $spacing-12 $spacing-4 37px;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}
</style>
