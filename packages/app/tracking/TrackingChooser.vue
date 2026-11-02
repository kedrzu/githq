<!-- Choosing what to track (G2, D20), on the first sign-in and in Settings (G8, D24): the user's repositories and their organisations', newest push first, each owner's group with how many are chosen — the long ones folded, opened in full by picking the owner on the left, by "Show all" or by typing a filter (G4: an organisation may have hundreds; more pages are asked for as they are needed). The projects sit beside them. An organisation hiding its private repositories from githq says so in its group and explains itself when picked (G5). With nothing at all to pick, it offers tracking someone else's repository or project by name (G10). The `saving` slot holds what the page says about saving to GitHub (settings-sync G2, G12–G14), in a band above the footer, or above "Continue to My work" (G10). Keys: `/` the filter, ↑/↓ between the rows, Space chooses, Shift+click or Shift+Space sets the rows shown from the last one clicked to this one, ⌘A all that match, Esc clears the filter, ⌘↵ tracks. In Settings (`tracked` given) a tick means tracked: no heading, no footer and never G10; counts say "tracked", a group's action is "Track all"/"Untrack all", and each row's last column says what saving will do to it ("will be tracked", "will be untracked") or how a tracked one stands ("synced 14s ago"). What is tracked always shows, so it can be unticked — while the lists are read or after reading them failed (under each owner), on a page not read yet (under its owner), or of an owner GitHub doesn't list ("Elsewhere") — and never twice. A filter naming a repository or project nothing listed matches looks it up (latest wins) and offers it; ticked, it is handed on (`found`). The bar at the bottom (`PendingChanges`) shows while ticks differ from what is tracked: ⌘↵ saves, Esc discards once nothing else took it (the filter clears itself first, an open layer closes). -->
<script lang="ts" setup>
import { sumOver } from '@nzyme/utils/array/sumOver.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { ArrowDownWideNarrow, Building2, Inbox, Lock, SquareKanban, User } from 'lucide-vue-next';
import { computed, ref, shallowRef, useTemplateRef, watch, watchEffect } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Button from '@/components/Button.vue';
import Checkbox from '@/components/Checkbox.vue';
import ChoiceList from '@/components/ChoiceList.vue';
import type { ChoiceListOption } from '@/components/ChoiceList.vue';
import Kbd from '@/components/Kbd.vue';
import SearchField from '@/components/SearchField.vue';
import { findMatches, prepareMatchTexts } from '@/utils/findMatches.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';
import { isSingleKeyShortcut } from '@/utils/isSingleKeyShortcut.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';
import { useFilteredListKeys } from '@/utils/useFilteredListKeys.js';

import CandidateRepositoryRow from './CandidateRepositoryRow.vue';
import HiddenOrganizationNotice from './HiddenOrganizationNotice.vue';
import PendingChanges from './PendingChanges.vue';
import TrackByName from './TrackByName.vue';
import TrackedRowNote from './TrackedRowNote.vue';
import type { TrackedChange } from './TrackedRowNote.vue';
import { getCandidateProjects, getCandidateRepositories } from './trackingCandidates.js';
import * as l from './TrackingChooser.loc.js';
import type {
  CandidateProject,
  CandidateRepositories,
  CandidateRepository,
  TrackedEntries,
  TrackedProjectEntry,
  TrackedRepositoryEntry,
  TrackedStatus,
  TrackingCandidates,
} from './TrackingTypes.js';
import { parseTrackingReference } from './utils/parseTrackingReference.js';
import type { TrackingReference } from './utils/parseTrackingReference.js';

/** How many projects the column shows of all owners' until unfolded (the chosen ones besides). */
const FOLDED_PROJECTS = 6;
/** How many rows a folded owner's group shows (an organisation's chosen ones besides). */
const FOLDED_ROWS = 4;
/** The owner of Settings' "Elsewhere" group: no login is empty. */
const ELSEWHERE = '';
/** How long the filter must stay as it is before what it names is looked up (Settings). */
const LOOKUP_DELAY_MS = 300;

/** A repository a row shows: offered by GitHub's lists, or (Settings) tracked yet not among what they gave so far. */
type ListedRepository = CandidateRepository | TrackedRepositoryEntry;
/** A project a row shows, likewise. */
type ListedProject = CandidateProject | TrackedProjectEntry;

/** An owner's group of repositories. */
interface OwnerGroup {
  readonly login: string;
  readonly own: boolean;
  /** It hides its private repositories from githq (G5). */
  readonly hidden: boolean;
  /** `null` when GitHub listed none of its repositories. */
  readonly list: CandidateRepositories | null;
  /**
   * Settings: the tracked, found or looked-up repositories of this group that its list has not given — on a page not
   * read yet, of an owner GitHub doesn't list, or while nothing was read.
   */
  readonly extras: readonly ListedRepository[];
  /** Settings: not an owner GitHub listed — "Elsewhere", or a tracked one's owner while nothing was read. */
  readonly unlisted: boolean;
}

/** How many of an owner's repositories are chosen, of how many it has. */
interface OwnerCount {
  readonly selected: number;
  readonly total: number;
}

/** A group as the list shows it now. */
interface ShownGroup extends OwnerGroup {
  readonly rows: readonly ListedRepository[];
  /** Those of its repositories the filter matches, best first. */
  readonly matching: readonly ListedRepository[];
  readonly selected: number;
  readonly total: number;
  /** Shown in full: its owner picked, a filter typed, or "Show all". */
  readonly unfolded: boolean;
  /** Rows the fold leaves out. */
  readonly folded: number;
}

const props = defineProps<{
  /** What the user and their organisations have; `null` (Settings only) while it is read, or when reading it failed. */
  candidates: TrackingCandidates | null;
  /** What the rows' "active 12m ago" are counted from. */
  now: number;
  /**
   * Repositories and projects found by name, offered besides the user's: on sign-in through G10's field; in Settings,
   * a looked-up one the user ticked (the `found` event), kept by the parent so saving can track it.
   */
  found: readonly (CandidateProject | CandidateRepository)[];
  /** When the user opened GitHub's page to request each organisation's approval (epoch ms). */
  approvals: Readonly<Record<string, number>>;
  /** Looks up a repository or project the user names (G10; in Settings, typed in the filter). */
  find: (reference: TrackingReference) => Promise<CandidateProject | CandidateRepository | null>;
  /** The settings repository "Track these" creates, `owner/githq-settings`, when saving is ticked (G12). */
  creates?: string | null;
  /**
   * "Track these" is under way: it and ⌘↵ do nothing until it ends. "Only my repositories" shows as disabled but keeps
   * its focus and still emits — the page ignores it meanwhile. In Settings: saving is under way.
   */
  busy?: boolean;
  /**
   * Settings' form (G8, D24), when given: what is tracked now and how each stands. The ticks (`repositories`,
   * `projects`) are then what saving will track; a tick that differs from this is a staged change, which the bar at the
   * bottom saves (`save`) or discards (`discard`). No heading, no footer, no G10.
   */
  tracked?: TrackedEntries;
  /** Settings: `candidates` are being read — the list says so under what is tracked. */
  reading?: boolean;
  /** What the filter holds at first (`?q=`, from an untracked repository's or project's screen). */
  initialSearch?: string;
}>();

defineSlots<{
  /** What the page says about saving to GitHub: the choice (G2, G12), or why it isn't offered (G13, G14). */
  saving?(): unknown;
}>();

/** The chosen repositories, `owner/name`. */
const repositories = defineModel<readonly string[]>('repositories', { required: true });
/** The chosen projects, by id. */
const projects = defineModel<readonly string[]>('projects', { required: true });

const emit = defineEmits<{
  /** "Track these" (⌘↵), or "Continue to My work" when there was nothing to pick. */
  track: [];
  /** "Only my repositories": the user's own, nothing else. */
  onlyMine: [];
  /** More of the owner's repositories are needed: the next page. */
  loadMore: [owner: string];
  requestApproval: [organization: string];
  /** Found by name and chosen: on sign-in through G10's field; in Settings, a looked-up one ticked. */
  found: [candidate: CandidateProject | CandidateRepository];
  /** Settings: "Save N changes" (⌘↵) — track what the ticks say. */
  save: [];
  /** Settings: "Discard" (Esc) — the ticks back to what is tracked. */
  discard: [];
}>();

const t = useTranslate();
const root = useTemplateRef<HTMLElement>('root');
const filterField = useTemplateRef<{ focus(): void }>('filterField');

const owner = ref<string>('all');
const filter = ref(props.initialSearch ?? '');
const unfoldedOwners = ref<ReadonlySet<string>>(new Set());
const projectsUnfolded = ref(false);
/** The repository and the project last clicked in each list: where a Shift+click's range starts. */
const repositoryAnchor = ref<string | null>(null);
const projectAnchor = ref<string | null>(null);
/** Settings: what the filter names, looked up once nothing listed matches it; `null` while looking or not found. */
const lookedUp = shallowRef<CandidateProject | CandidateRepository | null>(null);
const lookingUp = ref(false);
const listKeys = useFilteredListKeys({
  container: root,
  rows: '[data-tracking-row] [role="checkbox"]',
  filterField,
  filter,
});

const settings = computed(() => props.tracked !== undefined);
const trackedNames = computed(() => new Set(props.tracked?.repositories.map(entry => entry.nameWithOwner)));
const trackedIds = computed(() => new Set(props.tracked?.projects.map(entry => entry.id)));
const repositoryStatuses = computed(
  () =>
    new Map(props.tracked?.repositories.map((entry): [string, TrackedStatus] => [entry.nameWithOwner, entry.status])),
);
const projectStatuses = computed(
  () => new Map(props.tracked?.projects.map((entry): [string, TrackedStatus] => [entry.id, entry.status])),
);
const readRepositories = computed(() => (props.candidates ? getCandidateRepositories(props.candidates) : []));
const extraRepositories = computed(() => {
  if (!settings.value) {
    return [];
  }

  const read = new Set(readRepositories.value.map(repository => repository.nameWithOwner));
  const looked = lookedUp.value && 'nameWithOwner' in lookedUp.value ? [lookedUp.value] : [];
  const extras = new Map<string, ListedRepository>();
  // A candidate found later tells more than what is tracked: it wins.
  for (const repository of [...(props.tracked?.repositories ?? []), ...foundRepositories.value, ...looked]) {
    if (!read.has(repository.nameWithOwner)) {
      extras.set(repository.nameWithOwner, repository);
    }
  }

  return [...extras.values()];
});
const groups = computed((): OwnerGroup[] => {
  const candidates = props.candidates;
  const listed: OwnerGroup[] = candidates
    ? [
        {
          login: candidates.login,
          own: true,
          hidden: false,
          list: candidates.repositories,
          extras: [],
          unlisted: false,
        },
        ...candidates.organizations.map(organization => ({
          login: organization.login,
          own: false,
          hidden: organization.hiddenPrivate,
          list: organization.repositories,
          extras: [],
          unlisted: false,
        })),
      ]
    : [];
  if (extraRepositories.value.length === 0) {
    return listed;
  }

  // Under its owner when GitHub lists them; else "Elsewhere" — or, while nothing was read, under its owner's login.
  const logins = new Set(listed.map(group => group.login));
  const extras = new Map<string, ListedRepository[]>();
  for (const repository of extraRepositories.value) {
    const login = parseRepositoryName(repository.nameWithOwner).owner;
    const key = logins.has(login) || !candidates ? login : ELSEWHERE;
    extras.set(key, [...(extras.get(key) ?? []), repository]);
  }

  return [
    ...listed.map(group => ({ ...group, extras: extras.get(group.login) ?? [] })),
    ...[...extras]
      .filter(([login]) => !logins.has(login))
      .map(([login, rows]) => ({ login, own: false, hidden: false, list: null, extras: rows, unlisted: true })),
  ];
});
const chosenRepositories = computed(() => new Set(repositories.value));
const chosenProjects = computed(() => new Set(projects.value));
const needle = computed(() => filter.value.trim());
const reference = computed(() => (settings.value ? parseTrackingReference(needle.value) : null));
/** The groups of the owner picked, as the filter leaves them. */
const filteredGroups = computed(() =>
  groups.value.filter(group => owner.value === 'all' || group.login === owner.value).map(showGroup),
);
// In Settings a search leaves out the owners it matches nothing of, unless more of theirs is still to read (T1).
const shownGroups = computed(() =>
  settings.value && needle.value !== ''
    ? filteredGroups.value.filter(group => group.matching.length > 0 || group.list?.nextCursor != null)
    : filteredGroups.value,
);
// The owners a filter looks through, the rest of their lists read a page at a time. In Settings, a filter naming an
// owner (`acme/web`, or the tail of a login, `me/web`) reads only that one's, and one naming a project none.
const pagedGroups = computed(() => {
  if (needle.value === '' || reference.value?.kind === 'project') {
    return [];
  }

  const named = reference.value?.owner.toLowerCase();
  return filteredGroups.value.filter(
    group => group.list?.nextCursor != null && (named === undefined || group.login.toLowerCase().endsWith(named)),
  );
});
/** The repositories' rows in the order shown, which a range follows. */
const shownRepositoryNames = computed(() =>
  empty.value
    ? foundRepositories.value.map(repository => repository.nameWithOwner)
    : shownGroups.value.flatMap(group => group.rows.map(row => row.nameWithOwner)),
);
/** The projects' rows in the order shown. */
const shownProjectIds = computed(() =>
  (empty.value ? foundProjects.value : shownProjects.value).map(project => project.id),
);
const ownerOptions = computed((): ChoiceListOption<string>[] => [
  ownerOption(
    { value: 'all', label: t(l.allOwners) },
    { selected: repositories.value.length, total: totalRepositories.value },
  ),
  ...groups.value
    .filter(group => !group.unlisted)
    .map(group =>
      ownerOption(
        {
          value: group.login,
          label: group.login,
          icon: group.hidden ? Lock : group.own ? User : Building2,
          warning: group.hidden,
        },
        ownerCount(group),
      ),
    ),
]);
const pickedHidden = computed(() =>
  owner.value === 'all' ? null : (groups.value.find(group => group.login === owner.value && group.hidden) ?? null),
);
const foundRepositories = computed(() =>
  props.found.filter((candidate): candidate is CandidateRepository => 'nameWithOwner' in candidate),
);
const foundProjects = computed(() =>
  props.found.filter((candidate): candidate is CandidateProject => !('nameWithOwner' in candidate)),
);
const allRepositories = computed(
  () =>
    new Map(
      [...readRepositories.value, ...foundRepositories.value].map(repository => [repository.nameWithOwner, repository]),
    ),
);
const totalRepositories = computed(() => sumOver(groups.value, group => group.list?.totalCount ?? 0));
// The user's own first; within each, open before closed, the most recently updated first.
const candidateProjects = computed(() => {
  const candidates = props.candidates;
  return candidates
    ? getCandidateProjects(candidates).toSorted(
        (a, b) => Number(a.owner !== candidates.login) - Number(b.owner !== candidates.login),
      )
    : [];
});
// In Settings, after them the tracked, found and looked-up projects GitHub's lists don't hold.
const extraProjects = computed(() => {
  if (!settings.value) {
    return [];
  }

  const read = new Set(candidateProjects.value.map(project => project.id));
  const looked = lookedUp.value && !('nameWithOwner' in lookedUp.value) ? [lookedUp.value] : [];
  const extras = new Map<string, ListedProject>();
  for (const project of [...(props.tracked?.projects ?? []), ...foundProjects.value, ...looked]) {
    if (!read.has(project.id)) {
      extras.set(project.id, project);
    }
  }

  return [...extras.values()];
});
const allProjects = computed((): ListedProject[] => [...candidateProjects.value, ...extraProjects.value]);
// The picked owner's projects; of all owners, the first few and the chosen ones unless unfolded.
const ownerProjects = computed(() =>
  owner.value === 'all' ? allProjects.value : allProjects.value.filter(project => project.owner === owner.value),
);
const shownProjects = computed(() =>
  owner.value !== 'all' || projectsUnfolded.value
    ? ownerProjects.value
    : ownerProjects.value.filter((project, index) => index < FOLDED_PROJECTS || isProjectInSight(project)),
);
const empty = computed(
  () =>
    !settings.value &&
    totalRepositories.value === 0 &&
    allProjects.value.length === 0 &&
    !groups.value.some(group => group.hidden),
);
const openToCopy = computed(() =>
  sumOver(repositories.value, name => {
    const repository = allRepositories.value.get(name);
    return repository ? repository.openIssues + repository.openPullRequests : 0;
  }),
);
const summaryDetail = computed(() => {
  const detail = t(l.summaryDetail, { count: openToCopy.value });
  return props.creates ? t(l.summaryThenCreates, { detail, repository: props.creates }) : detail;
});
/** Settings: what saving starts tracking, by name. */
const toTrack = computed(() =>
  settings.value
    ? [
        ...repositories.value.filter(name => !trackedNames.value.has(name)),
        ...projects.value.filter(id => !trackedIds.value.has(id)).map(projectTitle),
      ]
    : [],
);
/** Settings: what saving stops tracking, by name. */
const toUntrack = computed(() => [
  ...(props.tracked?.repositories ?? [])
    .filter(entry => !chosenRepositories.value.has(entry.nameWithOwner))
    .map(entry => entry.nameWithOwner),
  ...(props.tracked?.projects ?? []).filter(entry => !chosenProjects.value.has(entry.id)).map(entry => entry.title),
]);
const staged = computed(() => toTrack.value.length + toUntrack.value.length > 0);
// What the filter names, once nothing listed matches it (Settings): not while the lists are first read, and not under
// an owner picked that it doesn't name.
const lookupReference = computed(() => {
  const named = reference.value;
  if (
    !named ||
    !props.candidates ||
    (owner.value !== 'all' && owner.value.toLowerCase() !== named.owner.toLowerCase())
  ) {
    return null;
  }

  return isListed(named) ? null : named;
});
/** Settings: the filter matched nothing, nothing was found by its name, and nothing is left to read. */
const nothingMatches = computed(
  () =>
    settings.value &&
    needle.value !== '' &&
    shownGroups.value.every(group => group.matching.length === 0) &&
    pagedGroups.value.length === 0 &&
    !lookingUp.value &&
    !lookedUp.value,
);

/** Whether the click toggling a checkbox held Shift; read in the capture phase, before the checkbox toggles. */
let rangeClick = false;

// A filter looks through all of a shown group's repositories: the rest are asked for, a page at a time. Shown in
// full without one, a group asks for its next page when the user does ("Show more"): an organisation may have
// thousands.
watchEffect(() => {
  for (const group of pagedGroups.value) {
    emit('loadMore', group.login);
  }
});

// Another filter shows other rows: a range starts anew.
watch(filter, () => {
  repositoryAnchor.value = null;
});

// Latest wins: a change cancels the wait for the delay, and what was asked before it is dropped when it answers.
watch(
  lookupReference,
  (named, _before, onCleanup) => {
    lookedUp.value = null;
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
  if (event.defaultPrevented) {
    return;
  }

  if (matchesCommandKey(event, 'Mod+Enter')) {
    event.preventDefault();
    if (props.busy) {
      return;
    }

    if (!settings.value) {
      emit('track');
    } else if (staged.value) {
      emit('save');
    }

    return;
  }

  // Settings: Esc discards, once nothing else took it — the filter clears itself first, an open layer closes.
  if (event.key === 'Escape' && settings.value && staged.value && !props.busy && !isLayerOpen()) {
    event.preventDefault();
    emit('discard');
    return;
  }

  if (event.key === '/' && isSingleKeyShortcut(event) && !empty.value) {
    event.preventDefault();
    filterField.value?.focus();
  }
});

async function lookUp(named: TrackingReference, isStale: () => boolean) {
  const candidate = await props.find(named);
  if (!isStale()) {
    lookedUp.value = candidate;
    lookingUp.value = false;
  }
}

/** Whether what the filter names is among the rows already: a repository by name or match, a project by address. */
function isListed(named: TrackingReference) {
  if (named.kind === 'project') {
    return [...candidateProjects.value, ...foundProjects.value].some(
      project => project.owner.toLowerCase() === named.owner.toLowerCase() && project.number === named.number,
    );
  }

  const listed = [...readRepositories.value, ...(props.tracked?.repositories ?? []), ...foundRepositories.value];
  return (
    listed.some(repository => isNamed(repository)) ||
    findMatches(
      filter.value,
      prepareMatchTexts(listed, repository => [repository.nameWithOwner]),
    ).length > 0
  );
}

/** Whether the filter names this repository by its address (`owner/name`, a URL). */
function isNamed(repository: ListedRepository) {
  const named = reference.value;
  return (
    named?.kind === 'repository' &&
    repository.nameWithOwner.toLowerCase() === `${named.owner}/${named.name}`.toLowerCase()
  );
}

function onFilterKeydown(event: KeyboardEvent) {
  if (matchesCommandKey(event, 'Mod+A') && needle.value !== '') {
    event.preventDefault();
    selectAllMatching();
  } else {
    listKeys.onFilterKeydown(event);
  }
}

function showGroup(group: OwnerGroup): ShownGroup {
  const listed: ListedRepository[] = [...(group.list?.repositories ?? []), ...group.extras];
  const matched = findMatches(
    filter.value,
    prepareMatchTexts(listed, repository => [repository.nameWithOwner]),
  ).map(({ row }) => row);
  // A repository's address finds it too.
  const matching = [...matched, ...listed.filter(repository => !matched.includes(repository) && isNamed(repository))];
  const unfolded = owner.value !== 'all' || needle.value !== '' || unfoldedOwners.value.has(group.login);
  const rows = unfolded
    ? matching
    : matching.filter(
        // An organisation's chosen (or tracked) ones stay in sight; the user's own fold whatever they are, said under
        // them. Those its list hasn't given always show.
        (repository, index) =>
          index < FOLDED_ROWS ||
          (!group.own &&
            (chosenRepositories.value.has(repository.nameWithOwner) ||
              trackedNames.value.has(repository.nameWithOwner))) ||
          group.extras.includes(repository),
      );
  const total = group.list?.totalCount ?? group.extras.length;
  return {
    ...group,
    rows,
    matching,
    selected: listed.filter(repository => chosenRepositories.value.has(repository.nameWithOwner)).length,
    total,
    unfolded,
    folded: unfolded ? 0 : Math.max(0, total - rows.length),
  };
}

function groupName(group: ShownGroup) {
  return group.login === ELSEWHERE ? t(l.elsewhere) : group.login;
}

function groupDetail(group: ShownGroup) {
  if (settings.value) {
    return settingsGroupDetail(group);
  }

  if (needle.value !== '') {
    return t(l.matching, { matching: group.matching.length, total: group.total, filter: filter.value.trim() });
  }

  if (group.hidden) {
    return t(l.organisationHidden);
  }

  return t(group.own ? l.yourRepositories : l.organisation, { selected: group.selected, total: group.total });
}

// T1: "organisation · 6 matches for “web” · 2 tracked"; G8: "your repositories · 11 of 12 tracked".
function settingsGroupDetail(group: ShownGroup) {
  const kind = group.unlisted ? [] : [t(group.own ? l.ownKind : l.organisationKind)];
  if (needle.value !== '') {
    const ticked = group.matching.filter(row => chosenRepositories.value.has(row.nameWithOwner)).length;
    return [
      ...kind,
      t(l.matches, { count: group.matching.length, filter: needle.value }),
      t(l.trackedCount, { count: ticked }),
    ].join(' · ');
  }

  if (group.login === ELSEWHERE) {
    return t(l.elsewhereDetail);
  }

  if (group.unlisted) {
    return t(l.trackedCount, { count: group.selected });
  }

  if (group.hidden) {
    return t(l.organisationHidden);
  }

  return [...kind, t(l.trackedOf, { selected: group.selected, total: group.total })].join(' · ');
}

function foldedText(group: ShownGroup) {
  if (!group.own) {
    return t(l.moreOfTheirs, { count: group.folded });
  }

  const chosenFolded =
    group.selected - group.rows.filter(row => chosenRepositories.value.has(row.nameWithOwner)).length;
  const selection =
    chosenFolded === group.folded
      ? t(settings.value ? l.allTracked : l.allSelected)
      : chosenFolded === 0
        ? t(settings.value ? l.noneTracked : l.noneSelected)
        : t(settings.value ? l.someTracked : l.someSelected, { count: chosenFolded });
  return t(l.moreOfYours, { count: group.folded, selection });
}

function groupActionText(group: ShownGroup) {
  if (settings.value) {
    return t(isAllChosen(group) ? l.untrackAll : l.trackAll);
  }

  return isAllChosen(group) ? t(l.selectNone) : t(l.selectAll, { count: group.matching.length });
}

/** Whether every repository of the group the list can choose is chosen. */
function isAllChosen(group: ShownGroup) {
  return group.matching.length > 0 && group.matching.every(row => chosenRepositories.value.has(row.nameWithOwner));
}

function toggleGroup(group: ShownGroup) {
  setRepositories(
    group.matching.map(row => row.nameWithOwner),
    !isAllChosen(group),
  );
}

function selectAllMatching() {
  setRepositories(
    shownGroups.value.flatMap(group => group.matching.map(row => row.nameWithOwner)),
    true,
  );
}

function unfold(login: string) {
  unfoldedOwners.value = new Set([...unfoldedOwners.value, login]);
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

/** Chooses a repository, or with Shift the shown ones from the anchor to it. */
function setRepository(name: string, chosen: boolean) {
  setRepositories(pickRange(shownRepositoryNames.value, repositoryAnchor.value, name), chosen);
  repositoryAnchor.value = name;
}

function setRepositories(names: readonly string[], chosen: boolean) {
  const next = new Set(repositories.value);
  for (const name of names) {
    if (chosen) {
      next.add(name);
    } else {
      next.delete(name);
    }
  }

  repositories.value = [...next];
  const looked = lookedUp.value;
  if (chosen && looked && 'nameWithOwner' in looked && names.includes(looked.nameWithOwner)) {
    emit('found', looked);
  }
}

/** Chooses a project, or with Shift the shown ones from the anchor to it. */
function setProject(id: string, chosen: boolean) {
  const range = new Set(pickRange(shownProjectIds.value, projectAnchor.value, id));
  projects.value = chosen
    ? [...new Set([...projects.value, ...range])]
    : projects.value.filter(other => !range.has(other));
  projectAnchor.value = id;
  const looked = lookedUp.value;
  if (chosen && looked && !('nameWithOwner' in looked) && range.has(looked.id)) {
    emit('found', looked);
  }
}

/** The rows a click on `row` sets: with Shift, all shown from the anchor to it; else, or with no anchor shown, itself. */
function pickRange(rows: readonly string[], anchor: string | null, row: string) {
  const from = rangeClick && anchor !== null ? rows.indexOf(anchor) : -1;
  const to = rows.indexOf(row);
  if (from < 0 || to < 0) {
    return [row];
  }

  return rows.slice(Math.min(from, to), Math.max(from, to) + 1);
}

function ownerOption(option: ChoiceListOption<string>, count: OwnerCount): ChoiceListOption<string> {
  return {
    ...option,
    count: t(l.ownerCount, count),
    countLabel: t(settings.value ? l.ownerCountTracked : l.ownerCountLabel, count),
  };
}

function ownerCount(group: OwnerGroup): OwnerCount {
  const listed = [...(group.list?.repositories ?? []), ...group.extras];
  return {
    selected: listed.filter(repository => chosenRepositories.value.has(repository.nameWithOwner)).length,
    total: group.list?.totalCount ?? 0,
  };
}

/** Settings: a project the fold keeps in sight — chosen, tracked, or offered by name; on sign-in, chosen. */
function isProjectInSight(project: ListedProject) {
  return (
    chosenProjects.value.has(project.id) || trackedIds.value.has(project.id) || extraProjects.value.includes(project)
  );
}

function projectMeta(project: ListedProject) {
  if (!('itemCount' in project)) {
    return project.owner;
  }

  const meta = t(l.projectMeta, { owner: project.owner, count: project.itemCount });
  return project.closed ? `${meta} · ${t(l.projectClosed)}` : meta;
}

function projectTitle(id: string) {
  return allProjects.value.find(project => project.id === id)?.title ?? id;
}

/** Settings: what saving will do to a row whose tick differs from what is tracked. */
function getChange(tracked: boolean, ticked: boolean): TrackedChange | null {
  if (!settings.value || tracked === ticked) {
    return null;
  }

  return ticked ? 'track' : 'untrack';
}

function repositoryChange(name: string) {
  return getChange(trackedNames.value.has(name), chosenRepositories.value.has(name));
}

function projectChange(id: string) {
  return getChange(trackedIds.value.has(id), chosenProjects.value.has(id));
}

function repositoryStatus(name: string): TrackedStatus | null {
  return repositoryStatuses.value.get(name) ?? null;
}

function projectStatus(id: string): TrackedStatus | null {
  return projectStatuses.value.get(id) ?? null;
}
</script>

<template>
  <div
    ref="root"
    :class="[css.trackingChooser, settings && css.trackingChooser_settings]"
    @click.capture="onClickCapture"
    @mousedown="onMousedown"
  >
    <!-- G10: nothing to pick. -->
    <div
      v-if="empty"
      :class="css.trackingChooser_empty"
    >
      <Inbox
        :class="css.trackingChooser_emptyIcon"
        aria-hidden="true"
      />
      <h1 :class="css.trackingChooser_emptyTitle">{{ t(l.emptyTitle) }}</h1>
      <p :class="css.trackingChooser_subtitle">{{ t(l.emptyDetail) }}</p>
      <TrackByName
        :find="find"
        @found="emit('found', $event)"
      />
      <section
        v-if="found.length > 0"
        :class="css.trackingChooser_found"
        :aria-label="t(l.chosen)"
      >
        <CandidateRepositoryRow
          v-for="repository in foundRepositories"
          :key="repository.nameWithOwner"
          :repository="repository"
          :now="now"
          :model-value="chosenRepositories.has(repository.nameWithOwner)"
          @update:model-value="setRepository(repository.nameWithOwner, $event)"
        />
        <div
          v-for="project in foundProjects"
          :key="project.id"
          :class="css.trackingChooser_project"
          data-tracking-row
        >
          <Checkbox
            :model-value="chosenProjects.has(project.id)"
            @update:model-value="setProject(project.id, $event)"
          >
            <span :class="css.trackingChooser_projectTitle">
              <SquareKanban
                :class="css.trackingChooser_projectIcon"
                aria-hidden="true"
              />
              {{ project.title }}
            </span>
          </Checkbox>
        </div>
      </section>
      <slot name="saving" />
      <div>
        <Button
          variant="primary"
          kbd="Mod+Enter"
          :aria-keyshortcuts="formatAriaKeyShortcuts('Mod+Enter')"
          :busy="busy"
          @click="emit('track')"
        >
          {{ t(l.continue) }}
        </Button>
      </div>
    </div>

    <template v-else>
      <div :class="css.trackingChooser_body">
        <div :class="css.trackingChooser_column">
          <div
            v-if="!settings"
            :class="css.trackingChooser_heading"
          >
            <h1 :class="css.trackingChooser_title">{{ t(l.title) }}</h1>
            <p :class="css.trackingChooser_subtitle">{{ t(l.subtitle) }}</p>
          </div>

          <div :class="css.trackingChooser_main">
            <ChoiceList
              v-if="candidates"
              v-model="owner"
              :label="t(l.owners)"
              :options="ownerOptions"
            />
            <div v-else />

            <section
              :class="css.trackingChooser_repositories"
              :aria-label="t(l.repositories)"
            >
              <div :class="css.trackingChooser_tools">
                <SearchField
                  ref="filterField"
                  v-model="filter"
                  :class="css.trackingChooser_filter"
                  :label="t(l.filterLabel)"
                  :placeholder="
                    t(l.filterPlaceholder, { count: candidates ? totalRepositories : extraRepositories.length })
                  "
                  kbd="/"
                  @keydown="onFilterKeydown"
                />
                <span :class="css.trackingChooser_sort">
                  <ArrowDownWideNarrow
                    :class="css.trackingChooser_sortIcon"
                    aria-hidden="true"
                  />
                  {{ t(l.recentActivity) }}
                </span>
              </div>

              <p
                v-if="!candidates && reading"
                :class="css.trackingChooser_moreText"
                role="status"
              >
                {{ t(l.reading) }}
              </p>

              <HiddenOrganizationNotice
                v-if="pickedHidden"
                :organization="pickedHidden.login"
                variant="panel"
                :requested-at="approvals[pickedHidden.login] ?? null"
                @request-approval="emit('requestApproval', pickedHidden.login)"
              />

              <template
                v-for="group in shownGroups"
                :key="group.login"
              >
                <div :class="[css.trackingChooser_group, pickedHidden && css.trackingChooser_group_meanwhile]">
                  <template v-if="pickedHidden">
                    <h2 :class="css.trackingChooser_groupName">{{ t(l.visibleMeanwhile) }}</h2>
                    <span :class="css.trackingChooser_groupDetail">{{
                      t(l.publicRepositories, { count: group.total })
                    }}</span>
                  </template>
                  <template v-else>
                    <h2 :class="css.trackingChooser_groupName">{{ groupName(group) }}</h2>
                    <span :class="css.trackingChooser_groupDetail">{{ groupDetail(group) }}</span>
                  </template>
                  <Button
                    v-if="!group.unfolded && !group.own && group.folded > 0"
                    variant="framed"
                    size="sm"
                    :class="css.trackingChooser_groupAction"
                    @click="unfold(group.login)"
                  >
                    {{ t(l.showAll, { count: group.total }) }}
                  </Button>
                  <Button
                    v-else-if="group.matching.length > 0"
                    variant="framed"
                    size="sm"
                    :class="css.trackingChooser_groupAction"
                    @click="toggleGroup(group)"
                  >
                    {{ groupActionText(group) }}
                  </Button>
                </div>

                <HiddenOrganizationNotice
                  v-if="group.hidden && !pickedHidden"
                  :organization="group.login"
                  variant="banner"
                  :public-count="group.list ? group.total : null"
                  @explain="owner = group.login"
                />

                <CandidateRepositoryRow
                  v-for="repository in group.rows"
                  :key="repository.nameWithOwner"
                  :repository="repository"
                  :now="now"
                  :change="repositoryChange(repository.nameWithOwner)"
                  :status="repositoryStatus(repository.nameWithOwner)"
                  :model-value="chosenRepositories.has(repository.nameWithOwner)"
                  @update:model-value="setRepository(repository.nameWithOwner, $event)"
                />

                <Button
                  v-if="group.folded > 0 && group.own"
                  variant="link"
                  size="sm"
                  :class="css.trackingChooser_more"
                  @click="unfold(group.login)"
                >
                  {{ foldedText(group) }}
                </Button>
                <p
                  v-else-if="group.folded > 0"
                  :class="css.trackingChooser_moreText"
                >
                  {{ t(l.moreOfTheirs, { count: group.folded }) }}
                </p>
                <p
                  v-if="needle !== '' && group.list?.nextCursor != null"
                  :class="css.trackingChooser_moreText"
                  role="status"
                >
                  {{ t(l.loading) }}
                </p>
                <Button
                  v-else-if="group.unfolded && group.list?.nextCursor != null"
                  variant="link"
                  size="sm"
                  :class="css.trackingChooser_more"
                  @click="emit('loadMore', group.login)"
                >
                  {{ t(l.showMore, { count: group.total - (group.list?.repositories.length ?? 0) }) }}
                </Button>
                <p
                  v-else-if="!settings && needle !== '' && group.matching.length === 0 && owner !== 'all'"
                  :class="css.trackingChooser_moreText"
                >
                  {{ t(l.noMatch, { filter: filter.trim() }) }}
                </p>
              </template>

              <p
                v-if="nothingMatches"
                :class="css.trackingChooser_moreText"
              >
                {{ t(l.nothingMatches, { filter: needle }) }}
              </p>

              <p
                v-if="needle !== ''"
                :class="css.trackingChooser_hints"
              >
                <span><Kbd keys="ArrowUp ArrowDown" /> {{ t(l.hintMove) }}</span>
                <span><Kbd keys="Space" /> {{ t(l.hintSelect) }}</span>
                <span><Kbd keys="Shift+Click" /> {{ t(l.hintSelectRange) }}</span>
                <span><Kbd keys="Mod+A" /> {{ t(l.hintSelectAll) }}</span>
                <span><Kbd keys="Escape" /> {{ t(l.hintClear) }}</span>
              </p>
            </section>

            <section
              :class="css.trackingChooser_projects"
              :aria-label="t(l.projects)"
            >
              <div :class="css.trackingChooser_group">
                <h2 :class="css.trackingChooser_groupName">{{ t(l.projects) }}</h2>
                <span :class="css.trackingChooser_groupDetail">{{
                  t(settings ? l.projectsTracked : l.projectsSelected, {
                    selected: projects.length,
                    total: allProjects.length,
                  })
                }}</span>
              </div>
              <div
                v-for="project in shownProjects"
                :key="project.id"
                :class="css.trackingChooser_project"
                data-tracking-row
              >
                <Checkbox
                  :class="css.trackingChooser_projectLabel"
                  :model-value="chosenProjects.has(project.id)"
                  @update:model-value="setProject(project.id, $event)"
                >
                  <span :class="css.trackingChooser_projectText">
                    <span :class="css.trackingChooser_projectTitle">
                      <SquareKanban
                        :class="css.trackingChooser_projectIcon"
                        aria-hidden="true"
                      />
                      {{ project.title }}
                    </span>
                    <span :class="css.trackingChooser_projectMeta">
                      {{ projectMeta(project) }}
                      <template v-if="projectChange(project.id) || projectStatus(project.id)">
                        ·
                        <TrackedRowNote
                          :change="projectChange(project.id)"
                          :status="projectStatus(project.id)"
                          :now="now"
                        />
                      </template>
                    </span>
                  </span>
                </Checkbox>
              </div>
              <Button
                v-if="shownProjects.length < ownerProjects.length"
                variant="link"
                size="sm"
                :class="css.trackingChooser_more"
                @click="projectsUnfolded = true"
              >
                {{ t(l.showAllProjects, { count: ownerProjects.length }) }}
              </Button>
              <p
                v-if="ownerProjects.length === 0"
                :class="css.trackingChooser_moreText"
              >
                {{ t(l.noProjects) }}
              </p>
              <p :class="css.trackingChooser_hint">{{ t(l.projectHint) }}</p>
            </section>
          </div>
        </div>
      </div>

      <div
        v-if="settings && staged"
        :class="css.trackingChooser_pending"
      >
        <PendingChanges
          :class="css.trackingChooser_pendingBar"
          :to-track="toTrack"
          :to-untrack="toUntrack"
          :busy="busy"
          @save="emit('save')"
          @discard="emit('discard')"
        />
      </div>
      <div
        v-else-if="!settings"
        :class="css.trackingChooser_bottom"
      >
        <div
          v-if="$slots.saving"
          :class="css.trackingChooser_saving"
        >
          <slot name="saving" />
        </div>
        <div :class="css.trackingChooser_footer">
          <p :class="css.trackingChooser_summary">
            {{
              t(l.summary, {
                repositories: t(l.summaryRepositories, { count: repositories.length }),
                projects: t(l.summaryProjects, { count: projects.length }),
              })
            }}
          </p>
          <p :class="css.trackingChooser_summaryDetail">{{ summaryDetail }}</p>
          <Button
            :class="css.trackingChooser_onlyMine"
            :aria-disabled="busy || undefined"
            @click="emit('onlyMine')"
          >
            {{ t(l.onlyMine) }}
          </Button>
          <Button
            variant="primary"
            kbd="Mod+Enter"
            :aria-keyshortcuts="formatAriaKeyShortcuts('Mod+Enter')"
            :busy="busy"
            @click="emit('track')"
          >
            {{ t(l.track) }}
          </Button>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" module="css">
.trackingChooser {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.trackingChooser_body {
  flex: 1;
  padding: 36px $spacing-24 $spacing-24;
}

.trackingChooser_settings .trackingChooser_body {
  padding-top: 20px;
}

.trackingChooser_column {
  display: flex;
  flex-direction: column;
  gap: 22px;
  max-width: 1180px;
  margin: 0 auto;
}

.trackingChooser_heading {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
}

.trackingChooser_title {
  font-size: 24px;
  font-weight: $font-weight-semibold;
  letter-spacing: -0.3px;
  color: $color-fg;
}

.trackingChooser_subtitle {
  max-width: 720px;
  font-size: $font-size-lg;
  line-height: 21px;
  color: $color-fg-2;
}

.trackingChooser_main {
  display: grid;
  grid-template-columns: 200px minmax(0, 604px) 320px;
  gap: 28px;
  align-items: start;
}

.trackingChooser_repositories,
.trackingChooser_projects {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  min-width: 0;
}

.trackingChooser_tools {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding-bottom: $spacing-8;
}

.trackingChooser_filter {
  flex: 1;
}

.trackingChooser_sort {
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

.trackingChooser_sortIcon {
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.trackingChooser_group {
  display: flex;
  gap: $spacing-8;
  align-items: baseline;
  padding: $spacing-12 $spacing-12 $spacing-4;
}

.trackingChooser_group_meanwhile {
  padding-top: 18px;
}

.trackingChooser_projects .trackingChooser_group {
  padding-top: $spacing-8;
}

.trackingChooser_groupName {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $color-fg-2;
}

.trackingChooser_groupDetail {
  flex: 1;
  min-width: 0;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.trackingChooser_groupAction {
  flex: none;
}

.trackingChooser_more {
  align-self: flex-start;
  margin-left: 25px;
  color: $color-fg-dim;
}

.trackingChooser_moreText {
  padding: $spacing-4 $spacing-12 $spacing-4 37px;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.trackingChooser_hints {
  display: flex;
  gap: $spacing-16;
  padding: $spacing-12 $spacing-12 0;
  font-size: $font-size-xs;
  color: $color-fg-dim;

  span {
    display: inline-flex;
    gap: $spacing-6;
    align-items: center;
  }
}

.trackingChooser_project {
  padding: $spacing-8 $spacing-12;
  border-radius: $radius-md;

  &:hover {
    background: $color-bg-2;
  }

  &:focus-within {
    background: $color-sel;
  }
}

.trackingChooser_projectLabel {
  align-items: flex-start;
  width: 100%;
}

.trackingChooser_projectText {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.trackingChooser_projectTitle {
  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.trackingChooser_projectIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-accent;
}

.trackingChooser_projectMeta {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.trackingChooser_hint {
  padding: $spacing-12 0 0;
  font-size: $font-size-xs;
  line-height: 18px;
  color: $color-fg-dim;
}

.trackingChooser_bottom {
  position: sticky;
  bottom: 0;
}

.trackingChooser_pending {
  position: sticky;
  bottom: 0;
  padding: 0 $spacing-24 $spacing-16;
}

.trackingChooser_pendingBar {
  max-width: 1180px;
  margin: 0 auto;
}

.trackingChooser_saving {
  padding: 18px max(#{$spacing-24}, calc((100% - 1180px) / 2));
  background: $color-bg;
  border-top: 1px solid $color-border;
}

.trackingChooser_footer {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 14px max(#{$spacing-24}, calc((100% - 1180px) / 2));
  background: $color-bg-2;
  border-top: 1px solid $color-border;
}

.trackingChooser_summary {
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.trackingChooser_summaryDetail {
  flex: 1;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.trackingChooser_empty {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 520px;
  max-width: calc(100% - 48px);
  margin: auto;
  padding-bottom: 80px;
}

.trackingChooser_emptyIcon {
  width: 22px;
  height: 22px;
  color: $color-fg-2;
}

.trackingChooser_emptyTitle {
  font-size: 22px;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.trackingChooser_found {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}
</style>
