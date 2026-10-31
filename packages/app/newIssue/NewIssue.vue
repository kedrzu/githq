<!-- The quick capture of a new issue as the app shows it (H1–H9): the dialog over whatever screen it was started from, fed by the stores — the chosen repository's options and templates, the repositories to choose from (the project's, the tracked ones, GitHub searched as the user types), the issues it can be a sub-issue of, the projects it can join — and creating through the composer. A form picked in a repository the user can't push to opens GitHub's own form in a new tab with the title in it (D14); what was written stays in the capture, which says so. -->
<script lang="ts" setup>
import type { RepositorySearchQuery } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { CancelError } from '@nzyme/utils/CancelError.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { useDataSource } from '@nzyme/vue-utils/useDataSource.js';
import { computed, ref, shallowRef, watch } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { AuthStore } from '@/auth/AuthStore.js';
import { scoreText } from '@/commands/scoreText.js';
import type { PickerOption } from '@/components/Picker.vue';
import type { EditFailureReason } from '@/edits/EditTypes.js';
import { formatShortReference } from '@/item/itemRoutes.js';
import { ProjectStore } from '@/projects/ProjectStore.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';
import { isPendingItem } from '@/store/isPendingItem.js';
import { ItemStore } from '@/store/ItemStore.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { parseTrackingReference } from '@/tracking/utils/parseTrackingReference.js';

import { findMissingFormFields } from './findMissingFormFields.js';
import { IssueTemplateStore } from './IssueTemplateStore.js';
import * as l from './NewIssue.loc.js';
import { NewIssueComposer } from './NewIssueComposer.js';
import type { NewIssueWaitingReason } from './NewIssueComposer.js';
import NewIssueDialog from './NewIssueDialog.vue';
import type { NewIssueRepositoryState, NewIssueWaitingEntry } from './NewIssueDialog.vue';
import type { RepositoryChoice, RepositoryChoiceSection } from './RepositoryChooser.vue';

/** How long typing rests before GitHub is searched for repositories. */
const SEARCH_DELAY_MS = 300;

/** What GitHub's search found for `text`. */
interface RepositorySearchResult {
  readonly text: string;
  readonly choices: readonly RepositoryChoice[];
}

/** A repository GitHub's search found. */
type FoundRepository = NonNullable<RepositorySearchQuery['search']['nodes']>[number];

const t = useTranslate();
const composer = useService(NewIssueComposer);
const auth = useService(AuthStore);
const accounts = useService(AccountSession);
const repositories = useService(RepositoryStore);
const templateStore = useService(IssueTemplateStore);
const items = useService(ItemStore);
const projects = useService(ProjectStore);
const tracking = useService(TrackingStore);

const repositoryQuery = ref('');
/** The repositories GitHub did not show the user, by name — read once each while the capture is open. */
const notFound = ref<ReadonlySet<string>>(new Set());

const open = computed({
  get: () => composer.open,
  set: (value: boolean) => {
    if (!value) {
      composer.close();
    }
  },
});
const draft = computed(() => composer.draft);
const repositoryName = computed(() => draft.value.repository);
const typedRepository = computed(() => repositoryQuery.value.trim());
// The chosen repository's options and templates are read as soon as it is chosen.
const chosenRepository = useDataSource({
  params: () => (open.value ? repositoryName.value : null),
  load: readRepository,
  behavior: 'eager',
});
// What is typed into the repository chooser searches GitHub once typing rests.
const repositorySearch = useDataSource({
  params: typedRepository,
  load: searchRepositories,
  default: () => ({ text: '', choices: [] }),
  debounce: { time: SEARCH_DELAY_MS, leading: false },
  behavior: 'eager',
  onError: error => {
    if (!(error instanceof CancelError)) {
      throw error;
    }
  },
});
/** What GitHub's search found for what is typed — kept while the next search runs. */
const found = computed(() => (typedRepository.value.length < 2 ? [] : repositorySearch.value.choices));
const searching = computed(
  () => typedRepository.value.length >= 2 && repositorySearch.value.text !== typedRepository.value,
);
const templates = computed(() => (repositoryName.value ? (templateStore.get(repositoryName.value) ?? null) : null));
/**
 * The chosen repository's metadata with the labels and people the draft names looked up past the pages the pickers
 * read (`complete`), as creating will: what is still not there is shown as left out. `read`: the metadata it was
 * completed from — stale once the store holds another.
 */
const completed = shallowRef<{ readonly read: RepositoryMetadata; readonly metadata: RepositoryMetadata } | null>(null);
const repositoryState = computed((): NewIssueRepositoryState => {
  const name = repositoryName.value;
  if (name === null) {
    return { kind: 'none' };
  }

  const isPrivate = isPrivateRepository(name);
  const stored = repositories.get(name);
  const metadata = stored && completed.value?.read === stored ? completed.value.metadata : stored;
  if (metadata?.isArchived) {
    return { kind: 'unavailable', nameWithOwner: name, isPrivate, why: 'archived' };
  }

  if (metadata && !metadata.hasIssuesEnabled) {
    return { kind: 'unavailable', nameWithOwner: name, isPrivate, why: 'issuesDisabled' };
  }

  if (metadata) {
    return { kind: 'ready', metadata, isPrivate };
  }

  return notFound.value.has(name) && chosenRepository.pending === null
    ? { kind: 'unavailable', nameWithOwner: name, isPrivate, why: 'notFound' }
    : { kind: 'loading', nameWithOwner: name, isPrivate };
});
const contextHint = computed(() => {
  const context = composer.context;
  const project = context?.project;
  if (project) {
    const [value] = project.values;
    return value
      ? t(l.inProjectColumn, { project: project.title, value: value.label })
      : t(l.inProject, { project: project.title });
  }

  if (context?.parent && draft.value.parent) {
    return t(l.fromIssue, { reference: context.parent.reference });
  }

  return context?.repository === null && repositoryName.value !== null ? t(l.lastUsed) : null;
});
const parentOptions = computed((): PickerOption[] => {
  const name = repositoryName.value;
  return items.all
    .filter(
      item =>
        item.kind === 'issue' &&
        item.state === 'OPEN' &&
        !isPendingItem(item) &&
        item.repository.nameWithOwner === name,
    )
    .map(item => ({ value: item.id, label: item.title, detail: formatShortReference(item) }));
});
const projectOptions = computed((): PickerOption[] => {
  const options = tracking.projects.flatMap(project => {
    const kept = projects.get(project.id);
    return kept?.viewerCanUpdate ? [{ value: kept.id, label: kept.title, detail: kept.owner }] : [];
  });
  for (const project of repositories.viewerProjects ?? []) {
    if (!project.closed && !options.some(option => option.value === project.id)) {
      options.push({ value: project.id, label: project.title, detail: project.owner });
    }
  }

  return options;
});
const repositoryChoices = computed((): RepositoryChoiceSection[] => {
  const typed = repositoryQuery.value.trim();
  const query = getTypedRepository(typed) ?? typed;
  const sections: RepositoryChoiceSection[] = [];
  const listed = new Set<string>();
  const project = composer.context?.project;
  if (project) {
    addSection('project', t(l.inProjectSection, { project: project.title }), getProjectRepositories(project.projectId));
  }

  addSection(
    'tracked',
    t(l.tracked),
    tracking.repositories.map(tracked => tracked.nameWithOwner),
  );
  addSection('yourWork', t(l.yourWork), getWorkRepositories());
  const others = found.value.filter(choice => !listed.has(choice.nameWithOwner));
  const available = others.filter(choice => !choice.unavailable);
  const unavailable = others.filter(choice => choice.unavailable);
  if (available.length > 0) {
    sections.push({ key: 'others', heading: t(l.others), choices: available });
  }

  if (unavailable.length > 0) {
    sections.push({ key: 'unavailable', heading: t(l.unavailable), choices: unavailable });
  }

  return sections;

  function addSection(key: string, heading: string, names: readonly string[]) {
    const choices = names
      .filter(name => !listed.has(name) && (!query || scoreText(query, name) !== null))
      .map((name): RepositoryChoice => {
        listed.add(name);
        return { nameWithOwner: name, isPrivate: isPrivateRepository(name), detail: getChoiceDetail(name) };
      });
    if (choices.length > 0) {
      sections.push({ key, heading, choices });
    }
  }
});
/** The issue form the body came from, while it is there (H8). */
const form = computed(() => {
  const filename = draft.value.form;
  const chosen = templates.value?.templates.find(
    template => template.kind === 'form' && template.form.filename === filename,
  );
  return chosen?.kind === 'form' ? chosen.form : null;
});
const missingFields = computed(() => (form.value ? findMissingFormFields(form.value, draft.value.body) : []));
const waiting = computed((): NewIssueWaitingEntry[] =>
  composer.waiting.map(({ id, draft: waited, why }) => ({
    id,
    title: waited.title.trim() || t(l.untitled),
    repository: waited.repository,
    why: describeWaiting(why, waited.repository ?? ''),
  })),
);
const rejection = computed(() => {
  const rejected = composer.rejection;
  return rejected ? describeRejection(rejected.reason, rejected.repository) : null;
});

watch(
  () =>
    [
      repositoryName.value ? repositories.get(repositoryName.value) : undefined,
      draft.value.labels,
      draft.value.assignees,
    ] as const,
  async ([read, labels, logins]) => {
    if (!read) {
      return;
    }

    const metadata = await repositories.complete(read, { labels, logins }).catch(() => read);
    if (repositoryName.value === read.nameWithOwner) {
      completed.value = { read, metadata };
    }
  },
  { immediate: true },
);

async function readRepository(name: string | null) {
  if (name === null) {
    return;
  }

  const [metadata] = await Promise.all([repositories.ensure(name), templateStore.ensure(name)]);
  if (!metadata) {
    notFound.value = new Set([...notFound.value, name]);
  }
}

/** Repositories named like `text` the user can see; one answered after more was typed is dropped (`CancelError`). */
async function searchRepositories(text: string): Promise<RepositorySearchResult> {
  const account = accounts.current;
  if (text.length < 2 || !account) {
    return { text, choices: [] };
  }

  const nodes: readonly FoundRepository[] = await account.sdk
    .RepositorySearch({ query: `${getTypedRepository(text) ?? text} in:name` })
    .then(answer => answer.search.nodes ?? [])
    .catch(() => []);

  if (text !== typedRepository.value || !accounts.isCurrent(account)) {
    throw new CancelError();
  }

  // `owner/name` typed in full (or its address) is offered even when the search does not rank it.
  const choices: RepositoryChoice[] = [];
  for (const node of nodes) {
    if (node && 'nameWithOwner' in node) {
      choices.push({
        nameWithOwner: node.nameWithOwner,
        isPrivate: node.isPrivate,
        detail: node.isPrivate ? t(l.private) : t(l.public),
        unavailable: node.isArchived ? t(l.archived) : node.hasIssuesEnabled ? undefined : t(l.issuesDisabled),
      });
    }
  }

  const typed = getTypedRepository(text);
  if (typed && !choices.some(choice => choice.nameWithOwner.toLowerCase() === typed.toLowerCase())) {
    choices.unshift({ nameWithOwner: typed, isPrivate: false });
  }

  return { text, choices };
}

function create(another: boolean) {
  void composer.submit(another);
}

function describeWaiting(why: NewIssueWaitingReason, repository: string) {
  switch (why.kind) {
    case 'refused':
      return describeRejection(why.reason, repository);
    case 'unconfirmed':
      return t(l.waitingUnconfirmed);
    case 'setAside':
      return t(l.waitingSetAside);
    default:
      return assertNever(why);
  }
}

function describeRejection(reason: EditFailureReason, repository: string) {
  switch (reason.kind) {
    case 'refused':
      return t(l.rejectedRefused, { message: reason.message.replace(/\.$/u, '') });
    case 'offline':
      return t(l.rejectedOffline);
    case 'missing':
      return t(l.rejectedMissing, { repository });
    case 'notAllowed':
    case 'dropped':
      return t(l.rejectedNotAllowed, { repository });
    default:
      return assertNever(reason);
  }
}

/** The repositories of the project's issues and pull requests, those with most items first. */
function getProjectRepositories(projectId: string) {
  return byCount(
    projects.getItems(projectId).flatMap(place => {
      const content = place.contentId === null ? undefined : items.get(place.contentId);
      return content ? [content.repository.nameWithOwner] : [];
    }),
  );
}

/** The repositories of what the local copy holds (my work), the used last and those with most items first. */
function getWorkRepositories() {
  const names = byCount(items.all.map(item => item.repository.nameWithOwner)).slice(0, 8);
  const last = composer.lastRepository;
  return last ? [last, ...names.filter(name => name !== last)] : names;
}

function byCount(names: readonly string[]) {
  const counts = new Map<string, number>();
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()].toSorted((a, b) => b[1] - a[1]).map(([name]) => name);
}

function getChoiceDetail(name: string) {
  const count = items.all.filter(item => item.repository.nameWithOwner === name && item.state === 'OPEN').length;
  return count > 0 ? t(l.openCount, { count }) : undefined;
}

/** `owner/name` typed in full or pasted as its address, else `null`. */
function getTypedRepository(text: string) {
  const reference = parseTrackingReference(text);
  return reference?.kind === 'repository' ? `${reference.owner}/${reference.name}` : null;
}

function isPrivateRepository(name: string) {
  return (
    items.all.some(item => item.repository.nameWithOwner === name && item.repository.isPrivate) ||
    found.value.some(choice => choice.nameWithOwner === name && choice.isPrivate)
  );
}
</script>

<template>
  <NewIssueDialog
    v-if="auth.viewer"
    v-model:open="open"
    v-model:repository-query="repositoryQuery"
    :draft="draft"
    :repository="repositoryState"
    :context-hint="contextHint"
    :templates="templates"
    :viewer-login="auth.viewer.login"
    :parent-options="parentOptions"
    :project-options="projectOptions"
    :repository-choices="repositoryChoices"
    :searching="searching"
    :rejection="rejection"
    :missing-fields="missingFields"
    :handoff="composer.handoff?.form ?? null"
    :waiting="waiting"
    @update="composer.update($event)"
    @create="create"
    @use-template="composer.useTemplate($event)"
    @restore="composer.restore($event)"
    @discard="composer.discard($event)"
  />
</template>
