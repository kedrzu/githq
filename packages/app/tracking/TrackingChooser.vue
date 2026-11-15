<!-- Choosing what to track (G2, D20), on the first sign-in and in a modal afterwards (T18, D25; `TrackRepositoriesDialog`): the user's repositories and their organisations', newest push first, each owner's group with how many are chosen — the long ones folded, opened in full by picking the owner on the left, by "Show all" or by typing a filter (G4: an organisation may have hundreds; more pages are asked for as they are needed). An organisation hiding its private repositories from githq says so in its group and explains itself when picked (G5). Keys: `/` the filter, ↑/↓ between the rows, Space chooses, Shift+click or Shift+Space sets the rows shown from the last one clicked to this one, ⌘A all that match, Esc clears the filter, ⌘↵ tracks. The filter also asks GitHub (mobile D34, G18, G19): from two typed characters, once typing pauses and over all owners, GitHub's repository search follows the user's own matches under "On GitHub", with what the filter names by its address looked up first; what the user's lists show is not repeated there, a row found ticks like any other and is handed on (`found`), and while GitHub answers one line says so. On the first sign-in the projects sit beside the repositories; with nothing at all to pick (G10), the field is that search, a project's address looked up too; the `saving` slot holds what the page says about saving to GitHub (settings-sync G2, G12–G14), in a band above the footer, or above "Continue to My work" (G10). As the picker (`tracked` given, T18) it has no heading, projects, footer or G10, and the model is only what is picked: the tracked repositories show with a grey, fixed tick and "tracked", no key or group action changes them, an owner with all of them tracked folds to its header, counts say "tracked", and J and K move too. On a phone (`PhoneLayout.active`; mobile D7, D34, MB135–MB138, MB163, MB164) it is one column: the question, then the search pinned at the top while the list scrolls — finding projects too — with Repositories and Projects as two segments counting picked / all (matches while searching), no owners on the left: each owner's group folds and unfolds by its own "Show all", an organisation hiding its private repositories says so in its group and explains itself in a sheet from below (MB137); rows a finger's height; the saving choice at the end of the list; the footer pinned at the bottom, and while the search has the cursor or text the question folds away and the footer is one line, "Track these" at its end with how many of the matches are ticked (it rides above the keyboard where the screen follows it, `FirstSignInFrame`). No key hints are drawn on a phone (`KeyHintsContext`). -->
<script lang="ts" setup>
import { sumOver } from '@nzyme/utils/array/sumOver.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { ArrowDownWideNarrow, Building2, CircleX, Inbox, Lock, SquareKanban, User } from 'lucide-vue-next';
import { computed, ref, useTemplateRef, watch, watchEffect } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Button from '@/components/Button.vue';
import type { ButtonSize, ButtonVariant } from '@/components/Button.vue';
import Checkbox from '@/components/Checkbox.vue';
import ChoiceList from '@/components/ChoiceList.vue';
import type { ChoiceListOption } from '@/components/ChoiceList.vue';
import IconButton from '@/components/IconButton.vue';
import Kbd from '@/components/Kbd.vue';
import { KeyHintsContext } from '@/components/KeyHintsContext.js';
import SearchField from '@/components/SearchField.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { findMatches, prepareMatchTexts } from '@/utils/findMatches.js';
import { isSingleKeyShortcut } from '@/utils/isSingleKeyShortcut.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';
import { useFilteredListKeys } from '@/utils/useFilteredListKeys.js';
import { useGitHubSearch } from '@/utils/useGitHubSearch.js';

import CandidateRepositoryRow from './CandidateRepositoryRow.vue';
import FoundOnGitHub from './FoundOnGitHub.vue';
import HiddenOrganizationNotice from './HiddenOrganizationNotice.vue';
import { getCandidateProjects, getCandidateRepositories } from './trackingCandidates.js';
import * as l from './TrackingChooser.loc.js';
import type {
  CandidateProject,
  CandidateRepositories,
  CandidateRepository,
  TrackedRepositoryEntry,
  TrackingCandidates,
} from './TrackingTypes.js';
import { useCandidateLookup } from './useCandidateLookup.js';
import { parseTrackingReference } from './utils/parseTrackingReference.js';
import type { TrackingReference } from './utils/parseTrackingReference.js';

/** How many projects the column shows of all owners' until unfolded (the chosen ones besides). */
const FOLDED_PROJECTS = 6;
/** How many rows a folded owner's group shows (an organisation's chosen ones besides). */
const FOLDED_ROWS = 4;
/** G10: what its field takes besides a search. */
const EXAMPLES = ['vitejs/vite', 'github.com/orgs/tauri-apps/projects/2'];

/** How a group's action is drawn. */
interface GroupActionLook {
  readonly variant: ButtonVariant;
  readonly tone?: 'accent';
  readonly size: ButtonSize;
}

/** What a phone's segments show (mobile MB135): the repositories' groups, or the projects. */
type PhoneSegment = 'projects' | 'repositories';

/** A repository a row shows: offered by GitHub's lists, or (the picker) tracked yet not among what they gave so far. */
type ListedRepository = CandidateRepository | TrackedRepositoryEntry;

/** An owner's group of repositories. */
interface OwnerGroup {
  readonly login: string;
  readonly own: boolean;
  /** It hides its private repositories from githq (G5). */
  readonly hidden: boolean;
  /** `null` when GitHub listed none of its repositories. */
  readonly list: CandidateRepositories | null;
  /**
   * The picker: the tracked, found or looked-up repositories of this group that its list has not given — on a page not
   * read yet, or of an owner GitHub doesn't list.
   */
  readonly extras: readonly ListedRepository[];
  /** The picker: not an owner GitHub listed, shown for a repository found by name. */
  readonly unlisted: boolean;
}

/** How many of an owner's repositories are chosen — the picker: tracked — of how many it has. */
interface OwnerCount {
  readonly selected: number;
  readonly total: number;
}

/** A group as the list shows it now. */
interface ShownGroup extends OwnerGroup {
  readonly rows: readonly ListedRepository[];
  /** Those of its repositories the filter matches, best first. */
  readonly matching: readonly ListedRepository[];
  /** Those matching that can be chosen: the picker leaves out what is tracked. */
  readonly choosable: readonly ListedRepository[];
  readonly selected: number;
  readonly total: number;
  /** The picker: how many of its repositories are tracked. */
  readonly tracked: number;
  /** The picker: every one of its repositories is tracked. */
  readonly allTracked: boolean;
  /** Shown in full: its owner picked, a filter typed, or "Show all". */
  readonly unfolded: boolean;
  /** Rows the fold leaves out. */
  readonly folded: number;
}

const props = defineProps<{
  /** What the user and their organisations have; `null` (the picker only) while it is read, or when reading it failed. */
  candidates: TrackingCandidates | null;
  /** What the rows' "active 12m ago" are counted from. */
  now: number;
  /**
   * Repositories and projects found on GitHub that the user ticked (the `found` event), offered besides the user's: kept
   * by the parent so confirming can track them.
   */
  found: readonly (CandidateProject | CandidateRepository)[];
  /** When the user opened GitHub's page to request each organisation's approval (epoch ms). */
  approvals: Readonly<Record<string, number>>;
  /** Looks up a repository or project the filter names by its address, once nothing listed matches it. */
  find: (reference: TrackingReference) => Promise<CandidateProject | CandidateRepository | null>;
  /** GitHub's repository search for what the filter holds (mobile D34, G18): anyone's repositories. */
  search: (text: string) => Promise<readonly CandidateRepository[]>;
  /** The settings repository "Track these" creates, `owner/githq-settings`, when saving is ticked (G12). */
  creates?: string | null;
  /**
   * "Track these" is under way: it and ⌘↵ do nothing until it ends. "Only my repositories" shows as disabled but keeps
   * its focus and still emits — the page ignores it meanwhile.
   */
  busy?: boolean;
  /**
   * The picker (T18, D25), when given: the repositories already tracked, which show with a fixed tick. `repositories`
   * then holds only what is picked on top of them.
   */
  tracked?: readonly TrackedRepositoryEntry[];
  /** The picker: `candidates` are being read — the list says so. */
  reading?: boolean;
  /** The picker: the owner it opens on (a group's "Track more"); all owners when not given or GitHub doesn't list it. */
  initialOwner?: string;
}>();

defineSlots<{
  /** What the page says about saving to GitHub: the choice (G2, G12), or why it isn't offered (G13, G14). */
  saving?(): unknown;
}>();

/** The chosen repositories, `owner/name`. */
const repositories = defineModel<readonly string[]>('repositories', { required: true });
/** The chosen projects, by id. */
const projects = defineModel<readonly string[]>('projects', { required: true });
/** What the filter holds; the picker's parent gives it its first text (`?q=`) and clears it on Esc. */
const filter = defineModel<string>('filter', { default: '' });

const emit = defineEmits<{
  /** "Track these" (⌘↵), or "Continue to My work" when there was nothing to pick. The picker: only ⌘↵. */
  track: [];
  /** "Only my repositories": the user's own, nothing else. */
  onlyMine: [];
  /** More of the owner's repositories are needed: the next page. */
  loadMore: [owner: string];
  requestApproval: [organization: string];
  /** Found on GitHub — by the search or by its address — and ticked. */
  found: [candidate: CandidateProject | CandidateRepository];
}>();

const t = useTranslate();
const phoneLayout = useService(PhoneLayout);
// A phone has no keys to hint at (mobile D52): the field's `/`, "Track these"'s ⌘↵.
provideContext(KeyHintsContext, {
  get hidden() {
    return phoneLayout.active;
  },
});
const root = useTemplateRef<HTMLElement>('root');
const filterField = useTemplateRef<{ focus(): void }>('filterField');

const owner = ref<string>(props.initialOwner ?? 'all');
const unfoldedOwners = ref<ReadonlySet<string>>(new Set());
const projectsUnfolded = ref(false);
/** The segment a phone shows. */
const segment = ref<PhoneSegment>('repositories');
/** The filter has the cursor: on a phone the question folds away and the footer shrinks to a line (MB163). */
const filterFocused = ref(false);
/** The organisation hiding its private repositories whose sheet is up, on a phone (MB137). */
const explained = ref<string | null>(null);
/** The repository and the project last clicked in each list: where a Shift+click's range starts. */
const repositoryAnchor = ref<string | null>(null);
const projectAnchor = ref<string | null>(null);
const listKeys = useFilteredListKeys({
  container: root,
  rows: '[data-tracking-row] [role="checkbox"]',
  filterField,
  filter,
});

const picker = computed(() => props.tracked !== undefined);
const phone = computed(() => phoneLayout.active);
/** On a phone, the search has the cursor or text (MB163, MB164): the list is its matches. */
const typing = computed(() => phone.value && (filterFocused.value || needle.value !== ''));
const trackedNames = computed(() => new Set(props.tracked?.map(entry => entry.nameWithOwner)));
const readRepositories = computed(() => (props.candidates ? getCandidateRepositories(props.candidates) : []));
const listedGroups = computed((): OwnerGroup[] => {
  const candidates = props.candidates;
  return candidates
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
});
const listedLogins = computed(() => new Set(listedGroups.value.map(group => group.login)));
// What is tracked under an owner GitHub lists: of anyone else, it isn't what this list answers (T18: 14 of 15).
const trackedUnderListed = computed(() =>
  (props.tracked ?? []).filter(entry => listedLogins.value.has(parseRepositoryName(entry.nameWithOwner).owner)),
);
// Under their owners: what is tracked but not read yet (the picker), and what was found on GitHub and ticked — unless
// On GitHub shows it now.
const extraRepositories = computed(() => {
  const read = new Set(readRepositories.value.map(repository => repository.nameWithOwner));
  const extras = new Map<string, ListedRepository>();
  // A candidate found later tells more than what is tracked: it wins.
  for (const repository of [...trackedUnderListed.value, ...foundRepositories.value]) {
    if (!read.has(repository.nameWithOwner) && !gitHubNames.value.has(repository.nameWithOwner)) {
      extras.set(repository.nameWithOwner, repository);
    }
  }

  return [...extras.values()];
});
const groups = computed((): OwnerGroup[] => {
  if (extraRepositories.value.length === 0) {
    return listedGroups.value;
  }

  // Under its owner, whether GitHub lists them or not.
  const extras = new Map<string, ListedRepository[]>();
  for (const repository of extraRepositories.value) {
    const login = parseRepositoryName(repository.nameWithOwner).owner;
    extras.set(login, [...(extras.get(login) ?? []), repository]);
  }

  return [
    ...listedGroups.value.map(group => ({ ...group, extras: extras.get(group.login) ?? [] })),
    ...[...extras]
      .filter(([login]) => !listedLogins.value.has(login))
      .map(([login, rows]) => ({ login, own: false, hidden: false, list: null, extras: rows, unlisted: true })),
  ];
});
const chosenRepositories = computed(() => new Set(repositories.value));
const chosenProjects = computed(() => new Set(projects.value));
const needle = computed(() => filter.value.trim());
/** The repository the filter names by its address. */
const reference = computed(() => {
  const named = parseTrackingReference(needle.value);
  return named?.kind === 'repository' ? named : null;
});
/** The groups of the owner picked, as the filter leaves them. */
const filteredGroups = computed(() =>
  groups.value.filter(group => owner.value === 'all' || group.login === owner.value).map(showGroup),
);
// In the picker and on a phone (MB163) a search leaves out the owners it matches nothing of, unless more of theirs is
// still to read (T1).
const shownGroups = computed(() =>
  (picker.value || phone.value) && needle.value !== ''
    ? filteredGroups.value.filter(group => group.matching.length > 0 || group.list?.nextCursor != null)
    : filteredGroups.value,
);
// The owners a filter looks through, the rest of their lists read a page at a time. In the picker, a filter naming an
// owner (`acme/web`, or the tail of a login, `me/web`) reads only that one's.
const pagedGroups = computed(() => {
  if (needle.value === '') {
    return [];
  }

  const named = picker.value ? reference.value?.owner.toLowerCase() : undefined;
  return filteredGroups.value.filter(
    group => group.list?.nextCursor != null && (named === undefined || group.login.toLowerCase().endsWith(named)),
  );
});
/** The repositories' rows in the order shown, which a range follows. */
const shownRepositoryNames = computed(() => [
  ...(empty.value
    ? shownFoundRepositories.value
    : noneOfYours.value
      ? []
      : shownGroups.value.flatMap(group => group.rows)
  ).map(row => row.nameWithOwner),
  ...gitHubRepositories.value.map(repository => repository.nameWithOwner),
]);
/** The projects' rows in the order shown. */
const shownProjectIds = computed(() =>
  (empty.value
    ? [...shownFoundProjects.value, ...(lookedUpProject.value ? [lookedUpProject.value] : [])]
    : shownProjects.value
  ).map(project => project.id),
);
const ownerOptions = computed((): ChoiceListOption<string>[] => [
  ownerOption(
    { value: 'all', label: t(l.allOwners) },
    {
      selected: picker.value ? trackedUnderListed.value.length : repositories.value.length,
      total: totalRepositories.value,
    },
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
/** G10: the ones found and ticked, but those On GitHub shows now. */
const shownFoundRepositories = computed(() =>
  foundRepositories.value.filter(repository => !gitHubNames.value.has(repository.nameWithOwner)),
);
const shownFoundProjects = computed(() =>
  foundProjects.value.filter(project => project.id !== lookedUpProject.value?.id),
);
const allRepositories = computed(
  () =>
    new Map(
      [...readRepositories.value, ...foundRepositories.value].map(repository => [repository.nameWithOwner, repository]),
    ),
);
const totalRepositories = computed(() => sumOver(listedGroups.value, group => group.list?.totalCount ?? 0));
// The user's own first; within each, open before closed, the most recently updated first.
const allProjects = computed(() => {
  const candidates = props.candidates;
  return candidates
    ? getCandidateProjects(candidates).toSorted(
        (a, b) => Number(a.owner !== candidates.login) - Number(b.owner !== candidates.login),
      )
    : [];
});
// The picked owner's projects; of all owners, the first few and the chosen ones unless unfolded.
const ownerProjects = computed(() =>
  owner.value === 'all' ? allProjects.value : allProjects.value.filter(project => project.owner === owner.value),
);
const shownProjects = computed(() =>
  owner.value !== 'all' || projectsUnfolded.value
    ? ownerProjects.value
    : ownerProjects.value.filter((project, index) => index < FOLDED_PROJECTS || chosenProjects.value.has(project.id)),
);
/** The projects a phone's segment shows: the search finds them too (MB163). */
const phoneProjects = computed(() =>
  needle.value === ''
    ? shownProjects.value
    : findMatches(
        filter.value,
        prepareMatchTexts(ownerProjects.value, project => [project.title, project.owner]),
      ).map(({ row }) => row),
);
const segmentOptions = computed((): SegmentedTabsOption<PhoneSegment>[] => [
  {
    value: 'repositories',
    label: t(l.repositories),
    count:
      needle.value === ''
        ? t(l.ownerCount, { selected: repositories.value.length, total: totalRepositories.value })
        : shownRepositoryNames.value.length,
  },
  {
    value: 'projects',
    label: t(l.projects),
    count:
      needle.value === ''
        ? t(l.ownerCount, { selected: projects.value.length, total: allProjects.value.length })
        : phoneProjects.value.length,
  },
]);
/** How many of the matches shown on a phone are ticked, repositories and projects. */
const tickedMatches = computed(
  () =>
    shownRepositoryNames.value.filter(name => chosenRepositories.value.has(name)).length +
    phoneProjects.value.filter(project => chosenProjects.value.has(project.id)).length,
);
const empty = computed(
  () =>
    !picker.value &&
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
/** The footer's line under the count: on a phone shorter, and while searching how many of the matches are ticked. */
const footerDetail = computed(() => {
  if (!phone.value) {
    return summaryDetail.value;
  }

  if (needle.value !== '') {
    return t(l.matchesTicked, { count: tickedMatches.value });
  }

  const detail = t(l.summaryDetailPhone, { count: openToCopy.value });
  return props.creates ? t(l.summaryThenCreates, { detail, repository: props.creates }) : detail;
});
/** A phone's group action ("Select none", "Show all"): a text link in the accent, a finger's height. */
const groupActionLook = computed((): GroupActionLook =>
  phone.value ? { variant: 'link', tone: 'accent', size: 'md' } : { variant: 'framed', size: 'sm' },
);
// What the filter names, once nothing listed matches it: not while the lists are first read — after reading them
// failed it still is — and not under an owner picked that it doesn't name. G10 looks a project's address up too.
const lookupReference = computed(() => {
  if (empty.value) {
    return parseTrackingReference(needle.value);
  }

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
/** What the filter names by its address, looked up once nothing listed matches it; `null` while looking or not found. */
const { lookedUp } = useCandidateLookup({
  reference: () => lookupReference.value,
  find: named => props.find(named),
  accept: candidate => candidate,
});
const lookedUpRepository = computed(() =>
  lookedUp.value && 'nameWithOwner' in lookedUp.value ? lookedUp.value : null,
);
const lookedUpProject = computed(() =>
  lookedUp.value && !('nameWithOwner' in lookedUp.value) ? lookedUp.value : null,
);
/** GitHub's search for what the filter holds (mobile D34, G18), over all owners only. */
const gitHubSearch = useGitHubSearch({
  text: () => (owner.value === 'all' ? needle.value : ''),
  ask: () => props.search,
});
/**
 * What the user's lists show already: GitHub's search doesn't repeat it. What is tracked of an owner GitHub doesn't list
 * shows there with its fixed tick.
 */
const listedNames = computed(
  () => new Set([...readRepositories.value, ...trackedUnderListed.value].map(repository => repository.nameWithOwner)),
);
/** On GitHub's rows: what the filter's address found, then what GitHub's search did, not in the user's lists. */
const gitHubRepositories = computed(() => {
  const search = gitHubSearch.value;
  const rows = new Map<string, CandidateRepository>();
  for (const repository of [
    ...(lookedUpRepository.value ? [lookedUpRepository.value] : []),
    ...(search.kind === 'answered' ? search.result : []),
  ]) {
    if (!listedNames.value.has(repository.nameWithOwner) && !rows.has(repository.nameWithOwner)) {
      rows.set(repository.nameWithOwner, repository);
    }
  }

  return [...rows.values()];
});
const gitHubNames = computed(() => new Set(gitHubRepositories.value.map(repository => repository.nameWithOwner)));
/** On GitHub shows: GitHub is asked, or the filter's address found something. */
const showsGitHub = computed(
  () => gitHubSearch.value.kind !== 'tooShort' || gitHubRepositories.value.length > 0 || lookedUpProject.value !== null,
);
/** A filter typed, and none of the user's own match it with nothing of theirs left to read (G18). */
const noneOfYours = computed(
  () =>
    needle.value !== '' &&
    props.candidates !== null &&
    filteredGroups.value.every(group => group.matching.length === 0) &&
    pagedGroups.value.length === 0,
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
    if (!props.busy) {
      emit('track');
    }

    return;
  }

  if (event.key === '/' && isSingleKeyShortcut(event) && !empty.value) {
    event.preventDefault();
    filterField.value?.focus();
    return;
  }

  // The picker's own keys. ↑/↓ inside the list took their turn already (`useFilteredListKeys`); here the focus is
  // still on the dialog around it, as it is when it opens.
  if (picker.value && isSingleKeyShortcut(event)) {
    const delta = getMoveDelta(event.key);
    if (delta !== null) {
      event.preventDefault();
      listKeys.moveFocus(delta, event.target);
    }
  }
});

function getMoveDelta(key: string) {
  switch (key) {
    case 'j':
    case 'ArrowDown':
      return 1;
    case 'k':
    case 'ArrowUp':
      return -1;
    default:
      return null;
  }
}

/** Whether what the filter names is among the rows already, by name or match. */
function isListed() {
  const listed = [...readRepositories.value, ...trackedUnderListed.value, ...foundRepositories.value];
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
  return named !== null && repository.nameWithOwner.toLowerCase() === `${named.owner}/${named.name}`.toLowerCase();
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
  const total = group.list?.totalCount ?? group.extras.length;
  const tracked = countTracked(group);
  const allTracked =
    total > 0 && tracked >= total && listed.every(repository => trackedNames.value.has(repository.nameWithOwner));
  const unfolded = owner.value !== 'all' || needle.value !== '' || unfoldedOwners.value.has(group.login);
  const rows = unfolded ? matching : allTracked ? [] : matching.filter((row, index) => isInSight(group, row, index));
  return {
    ...group,
    rows,
    matching,
    choosable: matching.filter(row => !trackedNames.value.has(row.nameWithOwner)),
    selected: listed.filter(repository => chosenRepositories.value.has(repository.nameWithOwner)).length,
    total,
    tracked,
    allTracked,
    unfolded,
    folded: unfolded ? 0 : Math.max(0, total - rows.length),
  };
}

/**
 * Whether a folded group's row stays in sight: its first few; what its list hasn't given; an organisation's chosen and
 * tracked ones. The user's own fold whatever they are, said under them — but in the picker what is picked stays.
 */
function isInSight(group: OwnerGroup, repository: ListedRepository, index: number) {
  const chosen = chosenRepositories.value.has(repository.nameWithOwner);
  return (
    index < FOLDED_ROWS ||
    group.extras.includes(repository) ||
    (chosen && (picker.value || !group.own)) ||
    (!group.own && trackedNames.value.has(repository.nameWithOwner))
  );
}

function countTracked(group: OwnerGroup) {
  return (props.tracked ?? []).filter(entry => parseRepositoryName(entry.nameWithOwner).owner === group.login).length;
}

function groupDetail(group: ShownGroup) {
  if (picker.value || group.unlisted) {
    return pickerGroupDetail(group);
  }

  if (needle.value !== '') {
    return t(l.matching, { matching: group.matching.length, total: group.total, filter: filter.value.trim() });
  }

  if (group.hidden) {
    return t(l.organisationHidden);
  }

  return t(group.own ? l.yourRepositories : l.organisation, { selected: group.selected, total: group.total });
}

// T18: "organisation · 2 of 312 tracked · 2 picked", "your repositories · all 12 tracked";
// T1: "organisation · 6 matches for “web” · 2 tracked".
function pickerGroupDetail(group: ShownGroup) {
  const kind = group.unlisted ? [] : [t(group.own ? l.ownKind : l.organisationKind)];
  const picked = group.selected > 0 ? [t(l.pickedCount, { count: group.selected })] : [];
  if (needle.value !== '') {
    const tracked = group.matching.filter(row => trackedNames.value.has(row.nameWithOwner)).length;
    return [
      ...kind,
      t(l.matches, { count: group.matching.length, filter: needle.value }),
      ...(tracked > 0 ? [t(l.trackedCount, { count: tracked })] : []),
      ...picked,
    ].join(' · ');
  }

  if (group.hidden) {
    return [t(l.organisationHidden), ...picked].join(' · ');
  }

  if (group.unlisted) {
    return picked.join(' · ');
  }

  const tracked = group.allTracked
    ? t(l.allTracked, { count: group.total })
    : t(l.trackedOf, { selected: group.tracked, total: group.total });
  return [...kind, tracked, ...picked].join(' · ');
}

function foldedText(group: ShownGroup) {
  if (!group.own) {
    return t(l.moreOfTheirs, { count: group.folded });
  }

  const chosenFolded =
    group.selected - group.rows.filter(row => chosenRepositories.value.has(row.nameWithOwner)).length;
  const selection =
    chosenFolded === group.folded
      ? t(l.allSelected)
      : chosenFolded === 0
        ? t(l.noneSelected)
        : t(l.someSelected, { count: chosenFolded });
  return t(l.moreOfYours, { count: group.folded, selection });
}

/** Whether every repository of the group the list can choose is chosen. */
function isAllChosen(group: ShownGroup) {
  return group.choosable.length > 0 && group.choosable.every(row => chosenRepositories.value.has(row.nameWithOwner));
}

function toggleGroup(group: ShownGroup) {
  setRepositories(
    group.choosable.map(row => row.nameWithOwner),
    !isAllChosen(group),
  );
}

function selectAllMatching() {
  setRepositories(
    shownGroups.value.flatMap(group => group.matching.map(row => row.nameWithOwner)),
    true,
  );
}

/** "Why, and how to fix": the panel of the organisation picked on the left; on a phone, its sheet from below. */
function explain(login: string) {
  if (phone.value) {
    explained.value = login;
  } else {
    owner.value = login;
  }
}

function requestExplainedApproval() {
  if (explained.value !== null) {
    emit('requestApproval', explained.value);
  }
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

/** What is tracked is never chosen, whatever asks: a range, ⌘A. */
function setRepositories(names: readonly string[], chosen: boolean) {
  const next = new Set(repositories.value);
  for (const name of names) {
    if (chosen && !trackedNames.value.has(name)) {
      next.add(name);
    } else if (!chosen) {
      next.delete(name);
    }
  }

  repositories.value = [...next];
  if (chosen) {
    const found = new Set(foundRepositories.value.map(repository => repository.nameWithOwner));
    for (const repository of gitHubRepositories.value) {
      if (
        names.includes(repository.nameWithOwner) &&
        !found.has(repository.nameWithOwner) &&
        !trackedNames.value.has(repository.nameWithOwner)
      ) {
        emit('found', repository);
      }
    }
  }
}

/** Chooses a project, or with Shift the shown ones from the anchor to it. */
function setProject(id: string, chosen: boolean) {
  const range = new Set(pickRange(shownProjectIds.value, projectAnchor.value, id));
  projects.value = chosen
    ? [...new Set([...projects.value, ...range])]
    : projects.value.filter(other => !range.has(other));
  projectAnchor.value = id;
  const looked = lookedUpProject.value;
  if (chosen && looked && range.has(looked.id) && !foundProjects.value.some(project => project.id === looked.id)) {
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
    countLabel: t(picker.value ? l.ownerCountTracked : l.ownerCountLabel, count),
  };
}

function ownerCount(group: OwnerGroup): OwnerCount {
  const listed = [...(group.list?.repositories ?? []), ...group.extras];
  return {
    selected: picker.value
      ? countTracked(group)
      : listed.filter(repository => chosenRepositories.value.has(repository.nameWithOwner)).length,
    total: group.list?.totalCount ?? 0,
  };
}

function projectMeta(project: CandidateProject) {
  const meta = t(l.projectMeta, { owner: project.owner, count: project.itemCount });
  return project.closed ? `${meta} · ${t(l.projectClosed)}` : meta;
}
</script>

<template>
  <div
    ref="root"
    :class="[css.trackingChooser, picker && css.trackingChooser_picker]"
    @click.capture="onClickCapture"
    @mousedown="onMousedown"
  >
    <!-- G10: nothing to pick. -->
    <div
      v-if="empty"
      :class="[css.trackingChooser_empty, phone && css.trackingChooser_empty_phone]"
    >
      <!-- MB138: the question, the field to track one by name, and what a fresh account still has. -->
      <template v-if="phone">
        <div
          v-if="!typing"
          :class="css.trackingChooser_heading"
        >
          <h1 :class="css.trackingChooser_title">{{ t(l.title) }}</h1>
          <p :class="css.trackingChooser_subtitle">{{ t(l.subtitlePhone) }}</p>
        </div>
        <div :class="css.trackingChooser_phoneTools">
          <SearchField
            ref="filterField"
            v-model="filter"
            :class="css.trackingChooser_phoneSearch"
            :label="t(l.searchLabel)"
            :placeholder="t(l.searchPlaceholderPhone)"
            @keydown="onFilterKeydown"
            @focusin="filterFocused = true"
            @focusout="filterFocused = false"
          >
            <template
              v-if="filter !== ''"
              #end
            >
              <IconButton
                :icon="CircleX"
                :label="t(l.clearSearch)"
                @click="filter = ''"
              />
            </template>
          </SearchField>
        </div>
        <div
          v-if="needle === '' && found.length === 0"
          :class="css.trackingChooser_fresh"
        >
          <Inbox
            :class="css.trackingChooser_emptyIcon"
            aria-hidden="true"
          />
          <h2 :class="css.trackingChooser_freshTitle">{{ t(l.emptyTitle) }}</h2>
          <p :class="css.trackingChooser_freshDetail">{{ t(l.emptyDetailPhone) }}</p>
        </div>
      </template>
      <template v-else>
        <Inbox
          :class="css.trackingChooser_emptyIcon"
          aria-hidden="true"
        />
        <h1 :class="css.trackingChooser_emptyTitle">{{ t(l.emptyTitle) }}</h1>
        <p :class="css.trackingChooser_subtitle">{{ t(l.emptyDetail) }}</p>
        <div :class="css.trackingChooser_search">
          <SearchField
            ref="filterField"
            v-model="filter"
            :class="css.trackingChooser_searchField"
            :label="t(l.searchLabel)"
            :placeholder="t(l.searchPlaceholder)"
            @keydown="onFilterKeydown"
          />
          <p :class="css.trackingChooser_examples">
            {{ t(l.examples) }}
            <code
              v-for="example in EXAMPLES"
              :key="example"
              :class="css.trackingChooser_example"
              >{{ example }}</code
            >
          </p>
        </div>
      </template>
      <section
        v-if="shownFoundRepositories.length > 0 || shownFoundProjects.length > 0"
        :class="css.trackingChooser_found"
        :aria-label="t(l.chosen)"
      >
        <CandidateRepositoryRow
          v-for="repository in shownFoundRepositories"
          :key="repository.nameWithOwner"
          :repository="repository"
          :now="now"
          :touch="phone"
          :model-value="chosenRepositories.has(repository.nameWithOwner)"
          @update:model-value="setRepository(repository.nameWithOwner, $event)"
        />
        <div
          v-for="project in shownFoundProjects"
          :key="project.id"
          :class="[css.trackingChooser_project, phone && css.trackingChooser_project_touch]"
          data-tracking-row
        >
          <Checkbox
            :size="phone ? 'touch' : undefined"
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
      <section
        v-if="showsGitHub"
        :class="css.trackingChooser_found"
        :aria-label="t(l.onGitHub)"
      >
        <FoundOnGitHub
          :state="gitHubSearch.kind"
          :text="needle"
          :count="gitHubRepositories.length + (lookedUpProject ? 1 : 0)"
          :touch="phone"
        >
          <div
            v-if="lookedUpProject"
            :class="[css.trackingChooser_project, phone && css.trackingChooser_project_touch]"
            data-tracking-row
          >
            <Checkbox
              :size="phone ? 'touch' : undefined"
              :model-value="chosenProjects.has(lookedUpProject.id)"
              @update:model-value="setProject(lookedUpProject.id, $event)"
            >
              <span :class="css.trackingChooser_projectTitle">
                <SquareKanban
                  :class="css.trackingChooser_projectIcon"
                  aria-hidden="true"
                />
                {{ lookedUpProject.title }}
              </span>
            </Checkbox>
          </div>
          <CandidateRepositoryRow
            v-for="repository in gitHubRepositories"
            :key="repository.nameWithOwner"
            :repository="repository"
            :now="now"
            :touch="phone"
            :model-value="chosenRepositories.has(repository.nameWithOwner)"
            @update:model-value="setRepository(repository.nameWithOwner, $event)"
          />
        </FoundOnGitHub>
      </section>
      <div
        v-if="phone && $slots.saving"
        :class="css.trackingChooser_phoneSaving"
      >
        <slot name="saving" />
      </div>
      <slot
        v-else-if="!phone"
        name="saving"
      />
      <!-- On a phone the footer pinned at the bottom (MB138): what is picked, and "Continue to My work". -->
      <div
        v-if="phone"
        :class="css.trackingChooser_bottom"
      >
        <div :class="[css.trackingChooser_footer, css.trackingChooser_footer_phone]">
          <p :class="css.trackingChooser_summary">
            {{
              repositories.length + projects.length === 0
                ? t(l.nothingPicked)
                : t(l.summary, {
                    repositories: t(l.summaryRepositories, { count: repositories.length }),
                    projects: t(l.summaryProjects, { count: projects.length }),
                  })
            }}
          </p>
          <p :class="css.trackingChooser_summaryDetail">
            {{ repositories.length + projects.length === 0 ? t(l.nothingPickedDetail) : footerDetail }}
          </p>
          <Button
            variant="primary"
            size="lg"
            :class="css.trackingChooser_track"
            :busy="busy"
            @click="emit('track')"
          >
            {{ t(l.continue) }}
          </Button>
        </div>
      </div>
      <div v-else>
        <Button
          variant="primary"
          kbd="Mod+Enter"
          :keyshortcuts="formatAriaKeyShortcuts('Mod+Enter')"
          :busy="busy"
          @click="emit('track')"
        >
          {{ t(l.continue) }}
        </Button>
      </div>
    </div>

    <template v-else>
      <div
        :class="[
          css.trackingChooser_body,
          phone && css.trackingChooser_body_phone,
          typing && css.trackingChooser_body_typing,
        ]"
      >
        <div :class="css.trackingChooser_column">
          <!-- On a phone the question folds away while searching (MB163). -->
          <div
            v-if="!picker && !typing"
            :class="css.trackingChooser_heading"
          >
            <h1 :class="css.trackingChooser_title">{{ t(l.title) }}</h1>
            <p :class="css.trackingChooser_subtitle">{{ phone ? t(l.subtitlePhone) : t(l.subtitle) }}</p>
          </div>

          <!-- A phone's search, pinned at the top while the list scrolls, and the two segments (MB135). -->
          <div
            v-if="phone"
            :class="css.trackingChooser_phoneTools"
          >
            <SearchField
              ref="filterField"
              v-model="filter"
              :class="css.trackingChooser_phoneSearch"
              :label="t(picker ? l.filterLabel : l.findLabel)"
              :placeholder="t(picker ? l.filterPlaceholder : l.findPlaceholder, { count: totalRepositories })"
              @keydown="onFilterKeydown"
              @focusin="filterFocused = true"
              @focusout="filterFocused = false"
            >
              <template
                v-if="filter !== ''"
                #end
              >
                <IconButton
                  :icon="CircleX"
                  :label="t(l.clearSearch)"
                  @click="filter = ''"
                />
              </template>
            </SearchField>
            <SegmentedTabs
              v-if="!picker"
              v-model="segment"
              variant="strip"
              :label="t(l.segments)"
              :options="segmentOptions"
            />
          </div>

          <div :class="[css.trackingChooser_main, phone && css.trackingChooser_main_phone]">
            <template v-if="!phone">
              <ChoiceList
                v-if="candidates"
                v-model="owner"
                :label="t(l.owners)"
                :options="ownerOptions"
              />
              <div v-else />
            </template>

            <section
              v-show="!phone || segment === 'repositories'"
              :class="css.trackingChooser_repositories"
              :aria-label="t(l.repositories)"
            >
              <div
                v-if="!phone"
                :class="css.trackingChooser_tools"
              >
                <SearchField
                  ref="filterField"
                  v-model="filter"
                  :class="css.trackingChooser_filter"
                  :label="t(l.filterLabel)"
                  :placeholder="t(l.filterPlaceholder, { count: totalRepositories })"
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
              <p
                v-else-if="picker && !candidates"
                :class="css.trackingChooser_moreText"
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

              <div
                v-if="noneOfYours"
                :class="css.trackingChooser_group"
              >
                <h2 :class="css.trackingChooser_groupName">{{ t(l.yourOwn) }}</h2>
                <span :class="css.trackingChooser_groupDetail">{{
                  t(l.noneOfYours, { total: sumOver(filteredGroups, group => group.total), filter: needle })
                }}</span>
              </div>

              <template
                v-for="group in noneOfYours ? [] : shownGroups"
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
                    <h2 :class="css.trackingChooser_groupName">{{ group.login }}</h2>
                    <span :class="css.trackingChooser_groupDetail">{{ groupDetail(group) }}</span>
                  </template>
                  <Button
                    v-if="!group.unfolded && group.allTracked"
                    v-bind="groupActionLook"
                    :class="css.trackingChooser_groupAction"
                    @click="unfold(group.login)"
                  >
                    {{ t(l.show) }}
                  </Button>
                  <Button
                    v-else-if="!group.unfolded && (picker || !group.own) && group.folded > 0"
                    v-bind="groupActionLook"
                    :class="css.trackingChooser_groupAction"
                    @click="unfold(group.login)"
                  >
                    {{ phone ? t(l.showAllShort) : t(l.showAll, { count: group.total }) }}
                  </Button>
                  <Button
                    v-else-if="group.choosable.length > 0"
                    v-bind="groupActionLook"
                    :class="css.trackingChooser_groupAction"
                    @click="toggleGroup(group)"
                  >
                    {{ isAllChosen(group) ? t(l.selectNone) : t(l.selectAll, { count: group.choosable.length }) }}
                  </Button>
                </div>

                <HiddenOrganizationNotice
                  v-if="group.hidden && !pickedHidden"
                  :organization="group.login"
                  :variant="phone ? 'stacked' : 'banner'"
                  :public-count="group.list ? group.total : null"
                  @explain="explain(group.login)"
                />

                <CandidateRepositoryRow
                  v-for="repository in group.rows"
                  :key="repository.nameWithOwner"
                  :repository="repository"
                  :now="now"
                  :touch="phone"
                  :tracked="trackedNames.has(repository.nameWithOwner)"
                  :model-value="chosenRepositories.has(repository.nameWithOwner)"
                  @update:model-value="setRepository(repository.nameWithOwner, $event)"
                />

                <Button
                  v-if="group.folded > 0 && group.own && !picker"
                  variant="link"
                  size="sm"
                  :class="css.trackingChooser_more"
                  @click="unfold(group.login)"
                >
                  {{ foldedText(group) }}
                </Button>
                <Button
                  v-else-if="group.folded > 0 && !picker && phone"
                  variant="link"
                  tone="accent"
                  :class="css.trackingChooser_showAll"
                  @click="unfold(group.login)"
                >
                  {{ t(l.showAllOf, { count: group.total, owner: group.login }) }}
                </Button>
                <p
                  v-else-if="group.folded > 0 && !picker"
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
              </template>

              <FoundOnGitHub
                v-if="showsGitHub"
                :state="gitHubSearch.kind"
                :text="needle"
                :count="gitHubRepositories.length"
                :touch="phone"
              >
                <CandidateRepositoryRow
                  v-for="repository in gitHubRepositories"
                  :key="repository.nameWithOwner"
                  :repository="repository"
                  :now="now"
                  :touch="phone"
                  :tracked="trackedNames.has(repository.nameWithOwner)"
                  :model-value="chosenRepositories.has(repository.nameWithOwner)"
                  @update:model-value="setRepository(repository.nameWithOwner, $event)"
                />
              </FoundOnGitHub>

              <p
                v-if="needle !== '' && !phone"
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
              v-if="!picker"
              v-show="!phone || segment === 'projects'"
              :class="css.trackingChooser_projects"
              :aria-label="t(l.projects)"
            >
              <div
                v-if="!phone"
                :class="css.trackingChooser_group"
              >
                <h2 :class="css.trackingChooser_groupName">{{ t(l.projects) }}</h2>
                <span :class="css.trackingChooser_groupDetail">{{
                  t(l.projectsSelected, {
                    selected: projects.length,
                    total: allProjects.length,
                  })
                }}</span>
              </div>
              <div
                v-for="project in phone ? phoneProjects : shownProjects"
                :key="project.id"
                :class="[css.trackingChooser_project, phone && css.trackingChooser_project_touch]"
                data-tracking-row
              >
                <Checkbox
                  :class="css.trackingChooser_projectLabel"
                  :size="phone ? 'touch' : undefined"
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
                    </span>
                  </span>
                </Checkbox>
              </div>
              <Button
                v-if="needle === '' && shownProjects.length < ownerProjects.length"
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
              <p
                v-else-if="phoneProjects.length === 0 && phone"
                :class="css.trackingChooser_moreText"
              >
                {{ t(l.noProjectMatches, { filter: needle }) }}
              </p>
              <p :class="css.trackingChooser_hint">{{ t(l.projectHint) }}</p>
            </section>
          </div>

          <!-- On a phone the saving choice ends the list (MB136). -->
          <div
            v-if="phone && $slots.saving && !picker"
            :class="css.trackingChooser_phoneSaving"
          >
            <slot name="saving" />
          </div>
        </div>
      </div>

      <div
        v-if="!picker"
        :class="css.trackingChooser_bottom"
      >
        <div
          v-if="$slots.saving && !phone"
          :class="css.trackingChooser_saving"
        >
          <slot name="saving" />
        </div>
        <div
          :class="[
            css.trackingChooser_footer,
            phone && css.trackingChooser_footer_phone,
            typing && css.trackingChooser_footer_typing,
          ]"
        >
          <p :class="css.trackingChooser_summary">
            {{
              t(typing ? l.summaryShort : l.summary, {
                repositories: t(l.summaryRepositories, { count: repositories.length }),
                projects: t(l.summaryProjects, { count: projects.length }),
              })
            }}
          </p>
          <p :class="css.trackingChooser_summaryDetail">{{ footerDetail }}</p>
          <Button
            v-if="!typing"
            :variant="phone ? 'ghost' : undefined"
            :class="css.trackingChooser_onlyMine"
            :unavailable="busy"
            @click="emit('onlyMine')"
          >
            {{ phone ? t(l.onlyMinePhone) : t(l.onlyMine) }}
          </Button>
          <Button
            variant="primary"
            :size="phone && !typing ? 'lg' : undefined"
            :class="css.trackingChooser_track"
            kbd="Mod+Enter"
            :keyshortcuts="formatAriaKeyShortcuts('Mod+Enter')"
            :busy="busy"
            @click="emit('track')"
          >
            {{ t(l.track) }}
          </Button>
        </div>
      </div>
    </template>

    <!-- MB137: why an organisation's private repositories are missing, rising from below on a phone. -->
    <HiddenOrganizationNotice
      v-if="explained !== null"
      variant="sheet"
      :open="true"
      :organization="explained"
      :requested-at="approvals[explained] ?? null"
      @update:open="explained = null"
      @request-approval="requestExplainedApproval"
    />
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

.trackingChooser_search {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
}

.trackingChooser_searchField {
  padding: 5px 6px 5px 12px;
  background: $color-bg-2;
  border-radius: $radius-lg;
}

.trackingChooser_examples {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.trackingChooser_example {
  padding: 2px $spacing-6;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-2;
  background: $color-bg-3;
  border-radius: $radius-sm;
}

.trackingChooser_found {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

// A phone (mobile MB135): one column across the screen, rows and headings at its 16px gutter.
.trackingChooser_body_phone {
  padding: 20px 0 0;

  .trackingChooser_column {
    gap: $spacing-12;
    max-width: none;
  }

  .trackingChooser_heading {
    padding: 0 $spacing-16;
  }

  .trackingChooser_title {
    font-size: 22px;
  }

  .trackingChooser_subtitle {
    font-size: $font-size-md;
  }

  .trackingChooser_group {
    align-items: center;
    min-height: $touch-target-size;
    padding: $spacing-8 $spacing-16 0;
  }

  .trackingChooser_groupAction {
    min-height: $touch-target-size;
  }

  // Under the rows' names: the gutter, the phone's box and its gap.
  .trackingChooser_more,
  .trackingChooser_showAll {
    min-height: $touch-target-size;
    margin-left: $spacing-16 + 20px + $spacing-12;
  }

  .trackingChooser_moreText {
    padding-left: $spacing-16 + 20px + $spacing-12;
  }

  .trackingChooser_hint {
    padding: $spacing-12 $spacing-16 0;
  }
}

.trackingChooser_showAll {
  align-self: flex-start;
}

// The question folded away: the search right under the setup bar.
.trackingChooser_body.trackingChooser_body_typing {
  padding-top: $spacing-4;
}

// The search and the segments, pinned at the top of the screen's scroll.
.trackingChooser_phoneTools {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding: $spacing-8 $spacing-16 $spacing-6;
  background: $color-bg;

  .trackingChooser_phoneSearch {
    --search-field-background: #{$color-bg-2};

    min-height: $touch-target-size;
    padding: $spacing-4 $spacing-6 $spacing-4 $spacing-12;
    font-size: $font-size-phone-input;
    border-radius: $radius-lg;
  }
}

.trackingChooser_main_phone {
  display: flex;
  flex-direction: column;
}

.trackingChooser_project_touch {
  display: flex;
  align-items: center;
  min-height: $touch-target-size + $spacing-12;
  padding: $spacing-6 $spacing-16;
  font-size: $font-size-lg;
  border-radius: 0;

  &:hover {
    background: none;
  }
}

// The saving choice at the end of a phone's list.
.trackingChooser_phoneSaving {
  padding: $spacing-16;
  margin-top: $spacing-8;
  border-top: 1px solid $color-border;
}

// The count, "Only mine" beside it and "Track these" across the screen under them; while searching, one line with
// "Track these" at its end, over the keyboard.
.trackingChooser_footer_phone {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: $spacing-2 $spacing-12;
  padding: $spacing-12 $spacing-16 calc(#{$spacing-12} + #{$phone-home-indicator-room});

  .trackingChooser_summary {
    grid-row: 1;
    grid-column: 1;
  }

  .trackingChooser_summaryDetail {
    grid-row: 2;
    grid-column: 1;
    font-size: $font-size-xs;
  }

  .trackingChooser_onlyMine {
    grid-row: 1 / 3;
    grid-column: 2;
    align-self: center;
  }

  .trackingChooser_track {
    grid-row: 3;
    grid-column: 1 / -1;
    margin-top: $spacing-10;
  }
}

.trackingChooser_footer_typing {
  padding-bottom: $spacing-12;

  .trackingChooser_track {
    grid-row: 1 / 3;
    grid-column: 2;
    align-self: center;
    margin-top: 0;
  }
}

// MB138: from the top of the screen, the footer at its bottom.
.trackingChooser_empty_phone {
  flex: 1;
  gap: $spacing-12;
  width: auto;
  max-width: none;
  margin: 0;
  padding: 20px 0 0;

  .trackingChooser_heading {
    padding: 0 $spacing-16;
  }

  .trackingChooser_title {
    font-size: 22px;
  }

  .trackingChooser_subtitle {
    font-size: $font-size-md;
  }

  .trackingChooser_bottom {
    margin-top: auto;
  }
}

.trackingChooser_fresh {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  padding: $spacing-16;
}

.trackingChooser_freshTitle {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.trackingChooser_freshDetail {
  font-size: $font-size-md;
  line-height: 1.5;
  color: $color-fg-2;
}

// The picker fills its dialog: the owners and the repositories scroll apart, the filter staying over the rows.
.trackingChooser_picker {
  flex: 1;
  min-height: 0;
  outline: none;

  .trackingChooser_body {
    min-height: 0;
    padding: $spacing-4 20px 0;
  }

  .trackingChooser_column,
  .trackingChooser_main {
    height: 100%;
  }

  .trackingChooser_column {
    max-width: none;
  }

  .trackingChooser_main {
    grid-template-rows: minmax(0, 1fr);
    grid-template-columns: 200px minmax(0, 1fr);
    align-items: stretch;
  }

  .trackingChooser_repositories {
    padding-bottom: $spacing-12;
    overflow-y: auto;
  }

  .trackingChooser_tools {
    position: sticky;
    top: 0;
    z-index: 1;
    background: $color-bg-2;
  }

  // A row the keys move to stays clear of the filter over it.
  [data-tracking-row] [role='checkbox'] {
    scroll-margin-top: 56px;
  }
}
</style>
