<!-- Creating an issue (H1, D20): a quick capture over the screen — the repository chip, the title, optional chips — that expands into the full form (H3: the body beside every field). Enter creates and closes, and the issue's toast follows with Create another and Open (`IssueCreatedToast`, mobile D44); ⌘Enter creates and keeps it open with the title cleared ("create another"), the toast showing too, to open what was created; Tab or "Details" expands, where ⌘Enter creates, ⌥⌘Enter creates another and Escape collapses; Escape closes the capture and keeps what was written. The repository chip opens the repository chooser (H2), which comes first while none is chosen — started outside a repository, nothing is chosen in advance (mobile D43); a repository with templates offers them (H7) — before anything else where it turned blank issues off — and an issue form becomes the body with its required fields checked (H8). A repository that won't take an issue says so before anything is typed; a creation GitHub refused shows why above the text it kept (H9). On a phone (`PhoneLayout.active`, mobile D42, MB194–MB195) it is a screen of its own, always the full form: a top bar with × (closing it, keeping what was written, as Escape does), "New issue" and Create, dim until there is a title; then the Repository row, opening the chooser as a menu at the bottom (MB193) — which comes first while none is chosen — the title, the item summary's rows and the project's card (`NewIssueFields` `summary`), and the body. A repository's templates rise as a menu at the bottom once it is chosen (mobile D39, MB200). The command line steps aside while it is open (mobile D18), and no key hints are drawn (mobile D52). -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import { AlertTriangle, BookMarked, ChevronDown, ChevronRight, ExternalLink, FileText, Lock, X } from 'lucide-vue-next';
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';

import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import BottomMenu from '@/components/BottomMenu.vue';
import Button from '@/components/Button.vue';
import Dialog from '@/components/Dialog.vue';
import IconButton from '@/components/IconButton.vue';
import Kbd from '@/components/Kbd.vue';
import { KeyHintsContext } from '@/components/KeyHintsContext.js';
import type { PickerOption } from '@/components/Picker.vue';
import PropertyRow from '@/components/PropertyRow.vue';
import PropertyValueButton from '@/components/PropertyValueButton.vue';
import TextArea from '@/components/TextArea.vue';
import TextField from '@/components/TextField.vue';
import { hasRole } from '@/edits/getEditPermissions.js';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import PhoneTopBar from '@/shell/PhoneTopBar.vue';

import type { IssueTemplate, RepositoryTemplates } from './IssueTemplateStore.js';
import type { NewIssueDraft } from './NewIssueComposer.js';
import * as l from './NewIssueDialog.loc.js';
import NewIssueFields from './NewIssueFields.vue';
import RepositoryChooser from './RepositoryChooser.vue';
import type { RepositoryChoiceSection } from './RepositoryChooser.vue';
import TemplateChooser from './TemplateChooser.vue';
import { toggleAssignee } from './toggleAssignee.js';

/** The chosen repository as far as githq knows it. */
export type NewIssueRepositoryState =
  | { readonly kind: 'none' }
  | { readonly kind: 'loading'; readonly nameWithOwner: string; readonly isPrivate: boolean }
  | { readonly kind: 'ready'; readonly metadata: RepositoryMetadata; readonly isPrivate: boolean }
  /** It won't take an issue: archived, issues turned off, or GitHub does not show it to the user. */
  | {
      readonly kind: 'unavailable';
      readonly nameWithOwner: string;
      readonly isPrivate: boolean;
      readonly why: 'archived' | 'issuesDisabled' | 'notFound';
    };

/** An issue's text waiting to be brought back into the capture. */
export interface NewIssueWaitingEntry {
  readonly id: number;
  /** Its title, or "Untitled". */
  readonly title: string;
  readonly repository: string | null;
  /** Why it waits: GitHub's reason, or that it was set aside. */
  readonly why: string;
}

const props = defineProps<{
  draft: NewIssueDraft;
  repository: NewIssueRepositoryState;
  /** What the defaults came from, at the footer's end ("in Platform Q4", "from portal#1187"). */
  contextHint: string | null;
  /** The repository's templates; `null` while read or for none. */
  templates: RepositoryTemplates | null;
  viewerLogin: string;
  parentOptions: readonly PickerOption[];
  projectOptions: readonly PickerOption[];
  /** The repository chooser's sections, for what is typed in it (`v-model:repository-query`). */
  repositoryChoices: readonly RepositoryChoiceSection[];
  /** GitHub is being searched for repositories. */
  searching: boolean;
  /** Why GitHub did not create the issue as written (H9). */
  rejection: string | null;
  /** The required fields of the issue form still empty (H8). */
  missingFields: readonly string[];
  /** The issue form just continued on GitHub, by name: what was written stays here (H7). */
  handoff?: string | null;
  /** Issues' texts waiting beside this one: refused by GitHub, unanswered, or set aside. */
  waiting?: readonly NewIssueWaitingEntry[];
}>();

const emit = defineEmits<{
  update: [patch: Partial<NewIssueDraft>];
  /** `another`: keep the capture open for the next one. */
  create: [another: boolean];
  /** A template picked: the caller fills the issue from it, or hands a form off to GitHub. */
  useTemplate: [template: IssueTemplate];
  /** A waiting text brought back into the capture. */
  restore: [id: number];
  /** A waiting text dropped. */
  discard: [id: number];
}>();

const open = defineModel<boolean>('open', { required: true });
const repositoryQuery = defineModel<string>('repositoryQuery', { required: true });

const t = useTranslate();
const phoneLayout = useService(PhoneLayout);
// A phone shows no key hints in the form, as on the item it becomes (mobile D52): its buttons, rows and menus.
provideContext(KeyHintsContext, {
  get hidden() {
    return phoneLayout.active;
  },
});
const expanded = ref(false);
/**
 * On a phone, the form has taken the focus: only then may a menu at the bottom (a chooser) open over it, so the two
 * don't both take the focus as they appear together.
 */
const phoneSettled = ref(false);
const choosingRepository = ref(false);
/** The templates are shown: asked for, or offered first where blank issues are off. */
const choosingTemplate = ref(false);
/** The user chose a template or a blank issue in this repository. */
const templateDecided = ref(false);
const titleRef = useTemplateRef<InstanceType<typeof TextField>>('title');
const bodyRef = useTemplateRef<InstanceType<typeof TextArea>>('body');

const phone = computed(() => phoneLayout.active);
/** Every field and the body: expanded on the computer, always on a phone. */
const full = computed(() => expanded.value || phone.value);
const metadata = computed(() => (props.repository.kind === 'ready' ? props.repository.metadata : null));
const repositoryName = computed(() => {
  const state = props.repository;
  switch (state.kind) {
    case 'none':
      return null;
    case 'ready':
      return state.metadata.nameWithOwner;
    default:
      return state.nameWithOwner;
  }
});
const isPrivate = computed(() => props.repository.kind !== 'none' && props.repository.isPrivate);
const canPush = computed(() => hasRole(metadata.value?.viewerPermission, 'WRITE'));
const templateCount = computed(() => props.templates?.templates.length ?? 0);
/** Where blank issues are off, a template must be chosen before the issue can be created. */
const templateRequired = computed(
  () => templateCount.value > 0 && props.templates?.blankIssuesEnabled === false && !templateDecided.value,
);
const unavailable = computed(() => (props.repository.kind === 'unavailable' ? props.repository : null));
const loading = computed(() => props.repository.kind === 'loading');
/** Create waits for the repository's details, then goes on if it can (`createWhenLoaded`). */
const canCreateOnceLoaded = computed(() => loading.value && props.draft.title.trim() !== '');
/**
 * Create or Create another (`another`), asked for while the repository's details were still loading: done once they
 * are in, if the issue can be created then — a key pressed early is not lost.
 */
const createWhenLoaded = ref<{ readonly another: boolean } | null>(null);
/** ⌥A pressed (an odd number of times) while the repository's details were still loading: applied once they are in. */
const assignMeWhenLoaded = ref(false);
const canCreate = computed(
  () =>
    props.repository.kind === 'ready' &&
    props.draft.title.trim() !== '' &&
    props.missingFields.length === 0 &&
    !templateRequired.value,
);

watch(
  open,
  isOpen => {
    if (isOpen) {
      expanded.value = props.draft.body.trim() !== '' || props.rejection !== null;
      // On a phone the chooser opens over the form once it is shown (`onOpenFocus`).
      choosingRepository.value = props.draft.repository === null && !phone.value;
      templateDecided.value = props.draft.form !== null || props.draft.body.trim() !== '';
      repositoryQuery.value = '';
      offerTemplates();
    } else {
      phoneSettled.value = false;
    }

    forgetWhatWaitsForDetails();
  },
  { immediate: true },
);

// A repository that asks for a template offers its templates as soon as they are known.
watch(
  () => [repositoryName.value, props.templates] as const,
  ([name], previous) => {
    if (name !== previous?.[0]) {
      templateDecided.value = props.draft.form !== null;
      forgetWhatWaitsForDetails();
    }

    offerTemplates();
  },
);

watch(
  () => props.rejection,
  rejection => {
    if (rejection !== null) {
      expanded.value = true;
    }
  },
);

watch(loading, async isLoading => {
  if (isLoading) {
    return;
  }

  const waitingCreate = createWhenLoaded.value;
  const assignMe = assignMeWhenLoaded.value;
  forgetWhatWaitsForDetails();
  if (assignMe && canPush.value) {
    toggleAssignMe();
    await nextTick();
  }

  if (waitingCreate) {
    createIssue(waitingCreate.another);
  }
});

function forgetWhatWaitsForDetails() {
  createWhenLoaded.value = null;
  assignMeWhenLoaded.value = false;
}

/**
 * Where blank issues are off, the repository's templates come before anything else; on a phone any repository's
 * templates rise once it is chosen, until one or a blank issue is (mobile D39).
 */
function offerTemplates() {
  const offered = phone.value ? templateCount.value > 0 && !templateDecided.value : templateRequired.value;
  choosingTemplate.value =
    props.templates?.nameWithOwner === repositoryName.value && offered && !choosingRepository.value;
}

function chooseRepository(nameWithOwner: string) {
  choosingRepository.value = false;
  emit('update', { repository: nameWithOwner });
  // A repository whose templates are known already offers them as it is chosen (`offerTemplates` runs on the change).
  void focusTitle();
}

/**
 * A phone's menu at the bottom closed — by ×, Escape or a tap above it: back to the form. Templates offered and dismissed
 * where a blank issue may be written count as declined, so they don't rise again as the repository's templates are read
 * anew (mobile D39).
 */
function onSheetOpen(isOpen: boolean) {
  if (!isOpen) {
    if (choosingTemplate.value && !templateRequired.value) {
      templateDecided.value = true;
    }

    backToTitle();
  }
}

function backToTitle() {
  choosingRepository.value = false;
  choosingTemplate.value = false;
  void focusTitle();
}

function useTemplate(template: IssueTemplate) {
  templateDecided.value = true;
  choosingTemplate.value = false;
  emit('useTemplate', template);
  // A form where the user can't push continues on GitHub; until the permission is known, the body is filled.
  if (template.kind === 'markdown' || canPush.value || props.repository.kind !== 'ready') {
    void expand();
  }
}

function restore(id: number) {
  emit('restore', id);
  expanded.value = true;
  void focusTitle();
}

function useBlank() {
  templateDecided.value = true;
  choosingTemplate.value = false;
  void focusTitle();
}

async function expand() {
  expanded.value = true;
  await nextTick();
  bodyRef.value?.focus();
}

async function focusTitle() {
  await nextTick();
  titleRef.value?.focus();
}

function create(another: boolean) {
  if (canCreateOnceLoaded.value) {
    createWhenLoaded.value = { another };
    return;
  }

  createIssue(another);
}

function createIssue(another: boolean) {
  if (!canCreate.value) {
    return;
  }

  emit('create', another);
  if (another) {
    void focusTitle();
  }
}

function onTitleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.isComposing) {
    const another = matchesCommandKey(event, 'Mod+Enter');
    if (!full.value) {
      event.preventDefault();
      create(another);
    } else if (!another && !matchesCommandKey(event, 'Alt+Mod+Enter')) {
      // Expanded, Mod+Enter is the whole form's (`onKeydown`); Enter goes on to the body.
      event.preventDefault();
      bodyRef.value?.focus();
    }

    return;
  }

  if (event.key === 'Tab' && !event.shiftKey && !expanded.value) {
    event.preventDefault();
    void expand();
  }
}

function onKeydown(event: KeyboardEvent) {
  if (matchesCommandKey(event, 'Alt+A') && loading.value) {
    event.preventDefault();
    assignMeWhenLoaded.value = !assignMeWhenLoaded.value;
    return;
  }

  if (matchesCommandKey(event, 'Alt+A') && canPush.value) {
    event.preventDefault();
    toggleAssignMe();
    return;
  }

  if (matchesCommandKey(event, 'Alt+R')) {
    event.preventDefault();
    choosingRepository.value = true;
    return;
  }

  if (full.value && (matchesCommandKey(event, 'Mod+Enter') || matchesCommandKey(event, 'Alt+Mod+Enter'))) {
    event.preventDefault();
    create(event.altKey);
  }
}

function toggleAssignMe() {
  emit('update', { assignees: toggleAssignee(props.draft.assignees, props.viewerLogin) });
}

/**
 * Opening puts the cursor in the title — or the chooser's field, where no repository is chosen yet: on a phone the
 * chooser then rises over the form.
 */
function onOpenFocus(event: Event) {
  if (phone.value) {
    event.preventDefault();
    phoneSettled.value = true;
    if (props.draft.repository === null) {
      choosingRepository.value = true;
    } else if (!choosingTemplate.value) {
      void focusTitle();
    }

    return;
  }

  if (!choosingRepository.value) {
    event.preventDefault();
    void focusTitle();
  }
}

/**
 * Escape steps back — out of a chooser, then out of the full form — before it closes the capture. On a phone a chooser
 * is a menu of its own, which Escape closes first, and the form is always full: Escape closes it.
 */
function onEscape(event: KeyboardEvent) {
  if (phone.value) {
    return;
  }

  if (choosingRepository.value || choosingTemplate.value) {
    event.preventDefault();
    backToTitle();
  } else if (expanded.value) {
    event.preventDefault();
    expanded.value = false;
    void focusTitle();
  }
}
</script>

<template>
  <Dialog
    v-model:open="open"
    :title="t(l.title)"
    :width="expanded ? 940 : 640"
    :edge="phone ? 'full' : undefined"
    bare
    fit-content
    @escape-key-down="onEscape"
    @open-auto-focus="onOpenFocus"
  >
    <div
      :class="[css.newIssueDialog, phone && css.newIssueDialog_phone]"
      data-no-commands
      data-layer
      @keydown="onKeydown"
    >
      <PhoneTopBar
        v-if="phone"
        :title="t(l.title)"
      >
        <template #start>
          <IconButton
            :icon="X"
            :label="t(l.close)"
            @click="open = false"
          />
        </template>
        <template #actions>
          <Button
            variant="primary"
            :class="css.newIssueDialog_phoneCreate"
            :disabled="!canCreate && !canCreateOnceLoaded"
            :busy="createWhenLoaded !== null"
            @click="create(false)"
            >{{ t(l.create) }}</Button
          >
        </template>
      </PhoneTopBar>
      <div
        v-else-if="!choosingRepository"
        :class="css.newIssueDialog_titleRow"
      >
        <Button
          variant="outline"
          size="sm"
          :icon="isPrivate ? Lock : BookMarked"
          :class="css.newIssueDialog_repository"
          :aria-label="repositoryName ? t(l.repositoryLabel, { repository: repositoryName }) : t(l.chooseRepository)"
          keyshortcuts="Alt+R"
          @click="choosingRepository = true"
        >
          {{ repositoryName ?? t(l.chooseRepository) }}
          <ChevronDown
            :class="css.newIssueDialog_repositoryIcon"
            aria-hidden="true"
          />
        </Button>
        <div
          :class="css.newIssueDialog_title"
          @keydown="onTitleKeydown"
        >
          <TextField
            ref="title"
            :model-value="draft.title"
            :label="t(l.titleLabel)"
            label-hidden
            bare
            :placeholder="t(l.titlePlaceholder)"
            autocomplete="off"
            @update:model-value="emit('update', { title: $event ?? '' })"
          />
        </div>
        <span
          v-if="draft.form"
          :class="css.newIssueDialog_form"
        >
          <FileText
            :class="css.newIssueDialog_repositoryIcon"
            aria-hidden="true"
          />
          {{ t(l.fromForm, { form: draft.form }) }}
        </span>
      </div>

      <RepositoryChooser
        v-if="choosingRepository && !phone"
        v-model:query="repositoryQuery"
        :sections="repositoryChoices"
        :searching="searching"
        @choose="chooseRepository"
        @back="backToTitle"
      />

      <template v-else>
        <div :class="css.newIssueDialog_content">
          <div
            v-if="rejection"
            :class="css.newIssueDialog_banner"
            role="alert"
          >
            <AlertTriangle
              :class="css.newIssueDialog_bannerIcon"
              aria-hidden="true"
            />
            <div :class="css.newIssueDialog_bannerText">
              <strong>{{ t(l.rejectedTitle) }}</strong>
              <span>{{ t(l.rejectedDetail, { reason: rejection }) }}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              kbd="Alt+R"
              @click="choosingRepository = true"
              >{{ t(l.anotherRepository) }}</Button
            >
          </div>

          <ul
            v-if="waiting && waiting.length > 0"
            :class="css.newIssueDialog_waiting"
            :aria-label="t(l.waitingLabel)"
          >
            <li
              v-for="entry in waiting"
              :key="entry.id"
              :class="css.newIssueDialog_waitingEntry"
            >
              <AlertTriangle
                :class="css.newIssueDialog_bannerIcon"
                aria-hidden="true"
              />
              <div :class="css.newIssueDialog_bannerText">
                <strong>{{ t(l.waitingTitle, { title: entry.title, repository: entry.repository ?? '' }) }}</strong>
                <span>{{ entry.why }}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                :aria-label="t(l.restoreLabel, { title: entry.title })"
                @click="restore(entry.id)"
                >{{ t(l.restore) }}</Button
              >
              <Button
                variant="ghost"
                size="sm"
                :icon="X"
                :aria-label="t(l.discardLabel, { title: entry.title })"
                @click="emit('discard', entry.id)"
              />
            </li>
          </ul>

          <div
            v-if="handoff"
            :class="css.newIssueDialog_banner"
            role="status"
          >
            <ExternalLink
              :class="css.newIssueDialog_bannerIcon"
              aria-hidden="true"
            />
            <div :class="css.newIssueDialog_bannerText">
              <strong>{{ t(l.handedOffTitle, { form: handoff }) }}</strong>
              <span>{{ t(l.handedOffDetail) }}</span>
            </div>
          </div>

          <div
            v-if="unavailable"
            :class="css.newIssueDialog_banner"
            role="status"
          >
            <AlertTriangle
              :class="css.newIssueDialog_bannerIcon"
              aria-hidden="true"
            />
            <div :class="css.newIssueDialog_bannerText">
              <strong>{{ t(l.unavailableTitle, { repository: unavailable.nameWithOwner }) }}</strong>
              <span>{{ t(l[unavailable.why]) }}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              kbd="Alt+R"
              @click="choosingRepository = true"
              >{{ t(l.anotherRepository) }}</Button
            >
          </div>

          <template v-if="phone">
            <dl :class="css.newIssueDialog_phoneRepository">
              <PropertyRow :label="t(l.repository)">
                <PropertyValueButton
                  :label="repositoryName ? t(l.repositoryLabel, { repository: repositoryName }) : t(l.chooseRepository)"
                  @click="choosingRepository = true"
                >
                  <span :class="repositoryName ? css.newIssueDialog_phoneRepositoryName : css.newIssueDialog_hint">{{
                    repositoryName ?? t(l.chooseRepository)
                  }}</span>
                  <ChevronRight
                    :class="css.newIssueDialog_phoneChevron"
                    aria-hidden="true"
                  />
                </PropertyValueButton>
              </PropertyRow>
            </dl>
            <div :class="css.newIssueDialog_phoneSection">
              <div
                :class="css.newIssueDialog_phoneTitle"
                @keydown="onTitleKeydown"
              >
                <TextField
                  ref="title"
                  :model-value="draft.title"
                  :label="t(l.titleLabel)"
                  label-hidden
                  bare
                  :placeholder="t(l.titlePlaceholder)"
                  autocomplete="off"
                  @update:model-value="emit('update', { title: $event ?? '' })"
                />
              </div>
              <span
                v-if="draft.form"
                :class="css.newIssueDialog_form"
              >
                <FileText
                  :class="css.newIssueDialog_repositoryIcon"
                  aria-hidden="true"
                />
                {{ t(l.fromForm, { form: draft.form }) }}
              </span>
              <NewIssueFields
                v-if="!unavailable"
                :draft="draft"
                :metadata="metadata"
                :can-push="canPush"
                :viewer-login="viewerLogin"
                :parent-options="parentOptions"
                :project-options="projectOptions"
                layout="summary"
                @update="emit('update', $event)"
              />
            </div>
            <div :class="css.newIssueDialog_phoneBody">
              <p
                v-if="missingFields.length > 0"
                :class="css.newIssueDialog_missing"
                role="status"
              >
                {{ t(l.stillRequired, { fields: missingFields.join(', ') }) }}
              </p>
              <p
                v-else-if="templateRequired && !choosingTemplate"
                :class="css.newIssueDialog_missing"
                role="status"
              >
                {{ t(l.templateRequired) }}
                <Button
                  variant="link"
                  @click="choosingTemplate = true"
                  >{{ t(l.chooseTemplate) }}</Button
                >
              </p>
              <TextArea
                ref="body"
                :model-value="draft.body"
                :label="t(l.bodyLabel)"
                label-hidden
                bare
                :placeholder="t(l.phoneBodyPlaceholder)"
                @update:model-value="emit('update', { body: $event ?? '' })"
              />
            </div>
          </template>

          <TemplateChooser
            v-else-if="choosingTemplate && templates && repositoryName"
            :repository="repositoryName"
            :templates="templates.templates"
            :blank-issues-enabled="templates.blankIssuesEnabled"
            :can-push="canPush"
            @use="useTemplate"
            @blank="useBlank"
            @back="backToTitle"
          />

          <div
            v-else-if="expanded"
            :class="css.newIssueDialog_columns"
          >
            <div :class="css.newIssueDialog_body">
              <TextArea
                ref="body"
                :model-value="draft.body"
                :label="t(l.bodyLabel)"
                label-hidden
                bare
                :placeholder="t(l.bodyPlaceholder)"
                @update:model-value="emit('update', { body: $event ?? '' })"
              />
            </div>
            <div :class="css.newIssueDialog_side">
              <NewIssueFields
                :draft="draft"
                :metadata="metadata"
                :can-push="canPush"
                :viewer-login="viewerLogin"
                :parent-options="parentOptions"
                :project-options="projectOptions"
                layout="rows"
                @update="emit('update', $event)"
              />
            </div>
          </div>

          <div
            v-else-if="!unavailable"
            :class="css.newIssueDialog_chips"
          >
            <NewIssueFields
              :draft="draft"
              :metadata="metadata"
              :can-push="canPush"
              :viewer-login="viewerLogin"
              :parent-options="parentOptions"
              :project-options="projectOptions"
              layout="chips"
              @update="emit('update', $event)"
            />
          </div>
        </div>

        <footer
          v-if="!phone"
          :class="css.newIssueDialog_footer"
        >
          <Button
            variant="ghost"
            size="sm"
            :kbd="expanded ? 'Mod+Enter' : 'Enter'"
            :disabled="!canCreate && !canCreateOnceLoaded"
            :busy="createWhenLoaded?.another === false"
            @click="create(false)"
            >{{ t(l.create) }}</Button
          >
          <Button
            variant="ghost"
            size="sm"
            :kbd="expanded ? 'Alt+Mod+Enter' : 'Mod+Enter'"
            :disabled="!canCreate && !canCreateOnceLoaded"
            :busy="createWhenLoaded?.another === true"
            @click="create(true)"
            >{{ t(l.createAnother) }}</Button
          >
          <Button
            v-if="!expanded"
            variant="ghost"
            size="sm"
            kbd="Tab"
            @click="expand()"
            >{{ t(l.details) }}</Button
          >
          <span
            v-else
            :class="css.newIssueDialog_hint"
            aria-hidden="true"
            ><Kbd keys="Escape" /> {{ t(l.collapse) }}</span
          >
          <Button
            v-if="templateCount > 0 && !choosingTemplate"
            variant="ghost"
            size="sm"
            @click="choosingTemplate = true"
            >{{ t(l.templates, { count: templateCount }) }}</Button
          >
          <span :class="css.newIssueDialog_spacer" />
          <span
            v-if="missingFields.length > 0"
            :class="css.newIssueDialog_missing"
            role="status"
            >{{ t(l.stillRequired, { fields: missingFields.join(', ') }) }}</span
          >
          <span
            v-else-if="templateRequired && !choosingTemplate"
            :class="css.newIssueDialog_missing"
            role="status"
            >{{ t(l.templateRequired) }}</span
          >
          <span
            v-else-if="rejection"
            :class="css.newIssueDialog_hint"
            >{{ t(l.notSent) }}</span
          >
          <span
            v-else-if="contextHint"
            :class="css.newIssueDialog_hint"
            >{{ contextHint }}</span
          >
        </footer>
      </template>

      <template v-if="phone">
        <BottomMenu
          :open="phoneSettled && choosingRepository"
          :title="t(l.repository)"
          :context="t(l.title)"
          @update:open="onSheetOpen"
        >
          <RepositoryChooser
            v-model:query="repositoryQuery"
            :sections="repositoryChoices"
            :searching="searching"
            @choose="chooseRepository"
            @back="backToTitle"
          />
        </BottomMenu>
        <BottomMenu
          :open="phoneSettled && choosingTemplate && templates !== null && repositoryName !== null"
          :title="t(l.template)"
          :context="t(l.templateContext, { repository: repositoryName ?? '' })"
          @update:open="onSheetOpen"
        >
          <TemplateChooser
            v-if="templates && repositoryName"
            :repository="repositoryName"
            :templates="templates.templates"
            :blank-issues-enabled="templates.blankIssuesEnabled"
            :can-push="canPush"
            @use="useTemplate"
            @blank="useBlank"
            @back="backToTitle"
          />
        </BottomMenu>
      </template>
    </div>
  </Dialog>
</template>

<style lang="scss" module="css">
.newIssueDialog {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.newIssueDialog_content {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.newIssueDialog_titleRow {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  padding: $spacing-12 14px;
}

// The chip names a repository as code does; over the button's own font.
.newIssueDialog_titleRow .newIssueDialog_repository {
  font-family: $font-family-mono;
}

.newIssueDialog_repositoryIcon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-2;
}

.newIssueDialog_title {
  flex: 1;
  min-width: 0;
}

.newIssueDialog_form {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  font-size: $font-size-xs;
  color: $color-fg-2;
}

.newIssueDialog_banner {
  display: flex;
  gap: $spacing-10;
  align-items: flex-start;
  margin: 0 14px $spacing-10;
  padding: $spacing-10 $spacing-12;
  font-size: $font-size-sm;
  background: $color-bg-3;
  border: 1px solid $color-amber;
  border-radius: $radius-md;
}

.newIssueDialog_bannerIcon {
  flex: none;
  width: 14px;
  height: 14px;
  margin-top: 2px;
  color: $color-amber;
}

.newIssueDialog_bannerText {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-2;
  color: $color-fg-2;

  strong {
    font-weight: $font-weight-medium;
    color: $color-fg;
  }
}

.newIssueDialog_waiting {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  margin: 0 14px $spacing-10;
  padding: 0;
  list-style: none;
}

.newIssueDialog_waitingEntry {
  display: flex;
  gap: $spacing-10;
  align-items: flex-start;
  padding: $spacing-8 $spacing-12;
  font-size: $font-size-sm;
  background: $color-bg-3;
  border: 1px solid $color-border-2;
  border-radius: $radius-md;
}

.newIssueDialog_chips {
  padding: 0 14px $spacing-10;
}

.newIssueDialog_columns {
  display: flex;
  min-height: 0;
  border-top: 1px solid $color-border;
}

.newIssueDialog_body {
  flex: 1;
  min-width: 0;
  max-height: 60vh;
  padding: $spacing-12 14px;
  overflow-y: auto;
}

.newIssueDialog_side {
  flex: none;
  width: 300px;
  padding: $spacing-12 14px;
  border-left: 1px solid $color-border;
}

.newIssueDialog_footer {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-6 $spacing-10;
  font-size: $font-size-xs;
  border-top: 1px solid $color-border;
}

.newIssueDialog_spacer {
  flex: 1;
}

.newIssueDialog_hint {
  color: $color-fg-dim;
}

.newIssueDialog_missing {
  color: $color-amber;
}

// A phone's screen of its own (MB194): the top bar stays, what is under it scrolls.
.newIssueDialog_phone {
  flex: 1;
  height: 100%;
  background: $color-bg;

  .newIssueDialog_content {
    flex: 1;
    overflow-y: auto;
  }

  // Its way out under the text, as MB214 draws it: the text takes the line beside the icon.
  .newIssueDialog_banner {
    flex-wrap: wrap;
    margin: 0;
    padding: $spacing-12 $spacing-16;
    border-width: 0 0 1px;
    border-radius: 0;
  }

  .newIssueDialog_bannerText {
    flex-basis: calc(100% - #{$spacing-24});
  }

  .newIssueDialog_banner > button {
    margin-left: $spacing-24;
  }

  .newIssueDialog_waiting {
    margin: $spacing-10 $spacing-16;
  }
}

.newIssueDialog_phoneCreate {
  margin-right: $spacing-6;
}

.newIssueDialog_phoneRepository {
  margin: 0;
  padding: $spacing-8 $spacing-16;
  border-bottom: 1px solid $color-border;

  > div {
    align-items: center;
    min-height: $touch-target-size;
  }
}

.newIssueDialog_phoneRepositoryName {
  font-family: $font-family-mono;
}

.newIssueDialog_phoneChevron {
  width: 16px;
  height: 16px;
  margin-left: auto;
  color: $color-fg-dim;
}

.newIssueDialog_phoneSection {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  padding: $spacing-16;
  border-bottom: 1px solid $color-border;
}

// As large as the item it becomes is titled, and past the size iOS zooms into a field under; over the bare field's own
// size, hence the doubled class.
.newIssueDialog_phoneTitle.newIssueDialog_phoneTitle input {
  font-size: $font-size-phone-title;
  font-weight: $font-weight-semibold;
}

.newIssueDialog_phoneBody {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  padding: $spacing-16;

  textarea {
    font-size: $font-size-phone-input;
  }

  p {
    margin: 0;
    font-size: $font-size-sm;
  }
}
</style>
