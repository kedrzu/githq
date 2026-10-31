<!-- An opened issue or pull request (D9): the same view in a panel beside the list, a modal over it or a page of its own. The header names the item and holds the way through the list (`K`/`J`, "3 / 13"), the arrangement switch, GitHub (`O`) and close (`Esc`). A panel stacks everything in one column; a modal and a page give the properties, projects and reviewers a column at the side. A pull request leads with where it stands (`PullRequestMerge`), its reviews and checks. `R` puts the cursor in the comment box (⌘↵ posts); for a pull request `⇧O` opens its changed files on GitHub. With `editing`, what the user may change is changed here (M3): `A`, `L`, `M` open the pickers of assignees, labels and milestone, `S`, `P`, `I` those of the first project's status, priority and iteration, `⇧R` asks for reviews, and `⇧X` opens the state menu — close as completed or not planned, reopen, ready for review, back to draft. What the user may not change is shown but not offered (K1b). -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  AppWindow,
  CircleCheck,
  CircleCheckBig,
  CircleDot,
  CircleSlash,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  FileDiff,
  Github,
  Link,
  MessageSquare,
  SquareKanban,
  UserCheck,
  RotateCcw,
  Maximize2,
  PanelRight,
  X,
} from 'lucide-vue-next';
import { SplitterGroup, SplitterPanel } from 'reka-ui';
import { computed, ref, useTemplateRef } from 'vue';

import { formatCommandKey } from '@/commands/formatCommandKey.js';
import type { Command, CommandOption } from '@/commands/CommandTypes.js';
import { useCommands } from '@/commands/useCommands.js';
import { EDIT_KEYS, useEditCommands } from '@/commands/useEditCommands.js';
import type { StateOption } from '@/commands/useEditCommands.js';
import Avatar from '@/components/Avatar.vue';
import IconButton from '@/components/IconButton.vue';
import Kbd from '@/components/Kbd.vue';
import LabelPill from '@/components/LabelPill.vue';
import Menu from '@/components/Menu.vue';
import MenuItem from '@/components/MenuItem.vue';
import ResizeHandle from '@/components/ResizeHandle.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';
import StatePill from '@/components/StatePill.vue';
import type { StatePillTone } from '@/components/StatePill.vue';
import { usePanelWidth } from '@/components/usePanelWidth.js';
import type { EditRequest } from '@/edits/EditTypes.js';
import { usePickerOptions } from '@/edits/usePickerOptions.js';
import type { ItemDetail } from '@/store/ItemDetailTypes.js';
import type { Item } from '@/store/ItemTypes.js';
import { formatTimeAgo } from '@/utils/formatTimeAgo.js';
import { getGitHubColor } from '@/utils/getGitHubColor.js';
import { isEditableTarget } from '@/utils/isEditableTarget.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';
import { isScreenKey } from '@/utils/isScreenKey.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import GitHubHtml from './GitHubHtml.vue';
import ItemActivity from './ItemActivity.vue';
import ItemComposer from './ItemComposer.vue';
import type { ItemEditing } from './ItemEditing.js';
import ItemProjects from './ItemProjects.vue';
import ItemProperties from './ItemProperties.vue';
import { formatShortReference, ITEM_ARRANGEMENTS } from './itemRoutes.js';
import type { ItemArrangement, ItemReference } from './itemRoutes.js';
import * as l from './ItemView.loc.js';
import LinkedItems from './LinkedItems.vue';
import PullRequestChecks from './PullRequestChecks.vue';
import PullRequestMerge from './PullRequestMerge.vue';
import PullRequestReviews from './PullRequestReviews.vue';

const props = defineProps<{
  /** The item's row: what shows at once. */
  item: Item;
  /** Body, comments, checks, reviews and every project field; `null` while being read. */
  detail: ItemDetail | null;
  arrangement: ItemArrangement;
  /** Where the item is in the list it was opened from (1-based); `null` when it is not in one. */
  position?: { index: number; count: number } | null;
  /** The issues a pull request closes, those known. */
  closes?: readonly Item[];
  /** Epoch ms the ages are counted to. */
  now: number;
  /** Reads the comments not read yet. */
  loadAllComments: () => Promise<void>;
  /** What the user may change and the pickers offer; without it the view only shows. */
  editing?: ItemEditing | null;
}>();

const emit = defineEmits<{
  close: [];
  previous: [];
  next: [];
  arrange: [arrangement: ItemArrangement];
  /** A linked item was picked. */
  open: [reference: ItemReference];
  /** The user changed something. */
  edit: [request: EditRequest];
  /** "Add to project" opened: the projects to offer are wanted. */
  needProjects: [];
}>();

const ARRANGEMENT_ICONS: Readonly<Record<ItemArrangement, LucideIcon>> = {
  panel: PanelRight,
  modal: AppWindow,
  page: Maximize2,
};

/** What is typed into the comment box and not posted yet. */
const commentDraft = defineModel<string>('commentDraft', { default: '' });
const t = useTranslate();
const pickerOptions = usePickerOptions();
const editCommands = useEditCommands();
const composerRef = useTemplateRef<InstanceType<typeof ItemComposer>>('composer');
const propertiesRef = useTemplateRef<InstanceType<typeof ItemProperties>>('properties');
const projectsRef = useTemplateRef<InstanceType<typeof ItemProjects>>('projects');
const reviewsRef = useTemplateRef<InstanceType<typeof PullRequestReviews>>('reviews');
const stateMenuOpen = ref(false);

const split = computed(() => props.arrangement !== 'panel');
// The side column's width, resized by dragging its edge: one for the modal, one for the page.
const sideWidths = {
  modal: usePanelWidth({ key: 'itemSide.modal', default: 320, min: 260, max: 560 }),
  page: usePanelWidth({ key: 'itemSide.page', default: 360, min: 260, max: 560 }),
};
const sideWidth = computed(() => (props.arrangement === 'page' ? sideWidths.page : sideWidths.modal));

// `[main, side?]`: the main column's in percent, the side's in pixels.
function onColumnsLayout(sizes: number[]) {
  const side = sizes[1];
  if (side !== undefined) {
    sideWidth.value.current = side;
  }
}
const arrangementOptions = computed((): SegmentedTabsOption<ItemArrangement>[] => [
  { value: 'panel', label: t(l.panel), icon: ARRANGEMENT_ICONS.panel, iconOnly: true },
  { value: 'modal', label: t(l.modal), icon: ARRANGEMENT_ICONS.modal, iconOnly: true },
  { value: 'page', label: t(l.page), icon: ARRANGEMENT_ICONS.page, iconOnly: true },
]);
const arrangementModel = computed({
  get: () => props.arrangement,
  set: (value: ItemArrangement) => emit('arrange', value),
});

const pr = computed(() => (props.item.kind === 'pullRequest' ? props.item : null));
const issueDetail = computed(() => (props.detail?.kind === 'issue' ? props.detail : null));
const prDetail = computed(() => (props.detail?.kind === 'pullRequest' ? props.detail : null));
const issueType = computed(() => (props.item.kind === 'issue' ? props.item.issueType : null));

const state = computed((): { icon: LucideIcon; tone: StatePillTone; text: string } => {
  const { item } = props;
  if (item.kind === 'issue') {
    if (item.state === 'OPEN') {
      return { icon: CircleDot, tone: 'open', text: t(l.open) };
    }

    switch (item.stateReason) {
      case 'NOT_PLANNED':
        return { icon: CircleSlash, tone: 'draft', text: t(l.closedNotPlanned) };
      case 'DUPLICATE':
        return { icon: CircleSlash, tone: 'draft', text: t(l.closedDuplicate) };
      default:
        return { icon: CircleCheck, tone: 'done', text: t(l.closedCompleted) };
    }
  }

  if (item.merged) {
    return { icon: GitMerge, tone: 'done', text: t(l.merged) };
  }

  if (item.state !== 'OPEN') {
    return { icon: GitPullRequestClosed, tone: 'closed', text: t(l.closedUnmerged) };
  }

  return item.isDraft
    ? { icon: GitPullRequestDraft, tone: 'draft', text: t(l.draft) }
    : { icon: GitPullRequest, tone: 'open', text: t(l.open) };
});

const permissions = computed(() => props.editing?.permissions ?? null);
const reviewerOptions = computed(() =>
  permissions.value?.reviewers && props.editing?.metadata
    ? pickerOptions.assignees([props.editing.metadata], props.editing.viewerLogin)
    : null,
);
/** The state menu's entries the user may use, for the item as it is. */
const stateActions = computed(() => {
  const { item } = props;
  const actions: (StateOption & { icon: LucideIcon })[] = [];
  if (permissions.value?.state) {
    if (item.state === 'OPEN') {
      if (item.kind === 'issue') {
        actions.push(
          {
            key: 'completed',
            text: t(l.closeCompleted),
            icon: CircleCheckBig,
            request: { kind: 'close', reason: 'COMPLETED' },
          },
          {
            key: 'notPlanned',
            text: t(l.closeNotPlanned),
            icon: CircleSlash,
            request: { kind: 'close', reason: 'NOT_PLANNED' },
          },
        );
      } else {
        actions.push({
          key: 'close',
          text: t(l.closePullRequest),
          icon: GitPullRequestClosed,
          request: { kind: 'close', reason: 'COMPLETED' },
        });
      }
    } else if (!(item.kind === 'pullRequest' && item.merged)) {
      actions.push({ key: 'reopen', text: t(l.reopen), icon: RotateCcw, request: { kind: 'reopen' } });
    }
  }

  if (permissions.value?.draft && item.kind === 'pullRequest') {
    actions.push(
      item.isDraft
        ? { key: 'ready', text: t(l.readyForReview), icon: GitPullRequest, request: { kind: 'draft', draft: false } }
        : {
            key: 'draft',
            text: t(l.convertToDraft),
            icon: GitPullRequestDraft,
            request: { kind: 'draft', draft: true },
          },
    );
  }

  return actions;
});

const opened = computed(() => {
  const ago = formatTimeAgo(Date.parse(props.item.createdAt), props.now);
  const { author } = props.item;
  return { author, text: t(l.openedBy, { author: author?.login ?? t(l.deletedUser), ago }) };
});

/** The keys of the item's own actions; its edits' are `EDIT_KEYS`. */
const ITEM_KEYS = { openOnGitHub: 'O', openFiles: 'Shift+O' } as const;

// The item's actions: its edits (the inline pickers by their keys, their values in the command menu's submenus) and
// the rest — comment, reviews, GitHub, the link, the arrangement.
useCommands(
  () => [...getEditCommands(), ...getItemCommands()],
  () => ({
    kind: 'item',
    label: formatShortReference(props.item),
    title: props.item.title,
  }),
);

// Escape closes the item; `K`/`J` step through the list it was opened from (the list's own `j`/`k`, run first,
// move its selection instead, which the opened item follows).
onWindowEvent('keydown', event => {
  // An open picker or menu takes Escape for itself.
  if (event.key === 'Escape' && !event.defaultPrevented && !isLayerOpen()) {
    // A field gives the key up first: Escape in the comment box leaves it.
    const { target } = event;
    if (target instanceof HTMLElement && isEditableTarget(target)) {
      target.blur();
      return;
    }

    event.preventDefault();
    emit('close');
    return;
  }

  if (!isScreenKey(event)) {
    return;
  }

  switch (event.key) {
    case 'j':
      event.preventDefault();
      emit('next');
      return;
    case 'k':
      event.preventDefault();
      emit('previous');
  }
});

function getEditCommands(): Command[] {
  const { editing, item } = props;
  if (!editing) {
    return [];
  }

  return editCommands({
    section: 'item',
    items: [item],
    metadata: editing.metadata ? [editing.metadata] : [],
    loading: editing.metadata === null,
    viewerLogin: editing.viewerLogin,
    getPermissions: () => editing.permissions,
    places: (props.detail?.projects ?? []).filter(place => place.viewerCanUpdate),
    now: props.now,
    stateOptions: stateActions.value,
    stateTitle: getStateTitle(),
    edit: request => emit('edit', request),
    setField: (place, field, value) =>
      emit('edit', { kind: 'projectField', projectItemId: place.itemId, fieldId: field.id, value }),
    inline: {
      assignees: () => propertiesRef.value?.openPicker('assignees') ?? false,
      labels: () => propertiesRef.value?.openPicker('labels') ?? false,
      milestone: () => propertiesRef.value?.openPicker('milestone') ?? false,
      status: () => projectsRef.value?.openByRole('status') ?? false,
      priority: () => projectsRef.value?.openByRole('priority') ?? false,
      iteration: () => projectsRef.value?.openByRole('iteration') ?? false,
      state: () => {
        stateMenuOpen.value = true;
        return true;
      },
    },
  });
}

function getItemCommands(): Command[] {
  const { item, editing } = props;
  const commands: Command[] = [
    {
      id: 'item.comment',
      title: t(l.comment),
      section: 'item',
      key: EDIT_KEYS.comment,
      icon: MessageSquare,
      when: () => editing == null || permissions.value?.comment === true,
      run: () => composerRef.value?.focus(),
    },
  ];
  if (pr.value) {
    commands.push({
      id: 'item.reviewers',
      title: t(l.requestReviewers),
      section: 'item',
      key: EDIT_KEYS.reviewers,
      icon: UserCheck,
      menu: permissions.value?.reviewers === true,
      run: () => reviewsRef.value?.openPicker() === true || !permissions.value?.reviewers,
      options: () => ({ loading: reviewerOptions.value === null, options: getReviewerOptions() }),
    });
  }

  if (pr.value?.isDraft && permissions.value?.draft) {
    commands.push({
      id: 'item.ready',
      title: t(l.readyForReview),
      section: 'item',
      icon: GitPullRequest,
      run: () => emit('edit', { kind: 'draft', draft: false }),
    });
  }

  if (permissions.value?.addToProject) {
    commands.push({
      id: 'item.addToProject',
      title: t(l.addToProject),
      section: 'item',
      icon: SquareKanban,
      prepare: () => emit('needProjects'),
      options: () => ({ loading: editing?.viewerProjects == null, options: getProjectOptions() }),
    });
  }

  // Its own keys (`onWindowEvent` above), listed in the help sheet.
  commands.push(
    { id: 'item.next', title: t(l.next), section: 'item', key: 'J', menu: false },
    { id: 'item.previous', title: t(l.previous), section: 'item', key: 'K', menu: false },
    { id: 'item.close', title: t(l.close), section: 'item', key: 'Escape', menu: false },
  );

  commands.push(
    {
      id: 'item.openOnGitHub',
      title: t(l.openOnGitHub),
      section: 'item',
      key: ITEM_KEYS.openOnGitHub,
      icon: Github,
      run: () => openTab(item.url),
    },
    {
      id: 'item.openFiles',
      title: t(l.openFiles),
      section: 'item',
      key: ITEM_KEYS.openFiles,
      icon: FileDiff,
      when: () => pr.value !== null,
      run: () => openTab(`${item.url}/files`),
    },
    {
      id: 'item.copyLink',
      title: t(l.copyLink),
      section: 'item',
      icon: Link,
      run: () => void navigator.clipboard.writeText(item.url),
    },
    ...ITEM_ARRANGEMENTS.filter(arrangement => arrangement !== props.arrangement).map((arrangement): Command => ({
      id: `item.arrange.${arrangement}`,
      title: getArrangementTitle(arrangement),
      section: 'item',
      icon: ARRANGEMENT_ICONS[arrangement],
      run: () => emit('arrange', arrangement),
    })),
  );
  return commands;
}

function getArrangementTitle(arrangement: ItemArrangement) {
  switch (arrangement) {
    case 'panel':
      return t(l.openAsPanel);
    case 'modal':
      return t(l.openAsModal);
    case 'page':
      return t(l.openAsPage);
    default:
      return assertNever(arrangement);
  }
}

function getStateTitle() {
  const { item } = props;
  if (item.state !== 'OPEN') {
    return t(l.reopenCommand);
  }

  return item.kind === 'issue' ? t(l.closeIssueCommand) : t(l.closePullRequestCommand);
}

/** Who can still be asked: not the author, not someone asked already. */
function getReviewerOptions(): CommandOption[] {
  const asked = new Set(
    (prDetail.value?.reviewRequests ?? []).flatMap(request => (request.kind === 'user' ? [request.user.login] : [])),
  );
  return (reviewerOptions.value ?? [])
    .filter(option => option.value !== props.item.author?.login && !asked.has(option.value))
    .map(option => ({ ...option, pick: () => emit('edit', { kind: 'requestReviewers', logins: [option.value] }) }));
}

function getProjectOptions(): CommandOption[] {
  const inProjects = new Set(props.item.projects.map(project => project.projectId));
  return (props.editing?.viewerProjects ?? [])
    .filter(project => !project.closed && !inProjects.has(project.id))
    .map(project => ({
      value: project.id,
      label: project.title,
      detail: project.owner,
      pick: () => emit('edit', { kind: 'addToProject', project }),
    }));
}

function openTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <article
    :class="[css.itemView, css[`itemView_${arrangement}`]]"
    :aria-label="item.title"
  >
    <header :class="css.itemView_toolbar">
      <component
        :is="state.icon"
        :class="[css.itemView_kind, css[`itemView_kind_${state.tone}`]]"
        aria-hidden="true"
      />
      <span :class="css.itemView_repository">{{ item.repository.nameWithOwner }}</span>
      <span :class="css.itemView_number">#{{ item.number }}</span>
      <span :class="css.itemView_spacer" />
      <template v-if="position">
        <IconButton
          :label="t(l.previous)"
          kbd="K"
          aria-keyshortcuts="K"
          :disabled="position.index <= 1"
          @click="emit('previous')"
        >
          <Kbd>K</Kbd>
        </IconButton>
        <IconButton
          :label="t(l.next)"
          kbd="J"
          aria-keyshortcuts="J"
          :disabled="position.index >= position.count"
          @click="emit('next')"
        >
          <Kbd>J</Kbd>
        </IconButton>
        <span :class="css.itemView_position">{{
          t(l.position, { index: position.index, count: position.count })
        }}</span>
        <span
          :class="css.itemView_divider"
          aria-hidden="true"
        />
      </template>
      <SegmentedTabs
        v-model="arrangementModel"
        variant="boxed"
        :label="t(l.arrangement)"
        :options="arrangementOptions"
      />
      <Menu
        v-if="stateActions.length > 0"
        v-model:open="stateMenuOpen"
        align="end"
      >
        <template #trigger>
          <IconButton
            :icon="item.state === 'OPEN' ? CircleCheckBig : RotateCcw"
            :label="t(l.stateActions)"
            :kbd="formatCommandKey(EDIT_KEYS.state).join('')"
            :aria-keyshortcuts="EDIT_KEYS.state"
          />
        </template>
        <MenuItem
          v-for="action in stateActions"
          :key="action.key"
          :icon="action.icon"
          @select="emit('edit', action.request)"
        >
          {{ action.text }}
        </MenuItem>
      </Menu>
      <IconButton
        :icon="Github"
        :label="t(l.openOnGitHub)"
        :kbd="ITEM_KEYS.openOnGitHub"
        :link="item.url"
        target="_blank"
        rel="noopener noreferrer"
        :aria-keyshortcuts="ITEM_KEYS.openOnGitHub"
      />
      <IconButton
        :icon="X"
        :label="t(l.close)"
        kbd="Esc"
        aria-keyshortcuts="Escape"
        @click="emit('close')"
      />
    </header>

    <SplitterGroup
      direction="horizontal"
      :class="css.itemView_columns"
      @layout="onColumnsLayout"
    >
      <SplitterPanel
        id="item-main"
        :order="0"
        :min-size="40"
        :class="css.itemView_main"
      >
        <div :class="css.itemView_scroll">
          <div :class="css.itemView_heading">
            <h1 :class="css.itemView_title">{{ item.title }}</h1>
            <p :class="css.itemView_state">
              <StatePill
                :icon="state.icon"
                :tone="state.tone"
                >{{ state.text }}</StatePill
              >
              <LabelPill
                v-if="issueType"
                :name="issueType.name"
                :color="getGitHubColor(issueType.color)"
              />
              <Avatar
                v-if="opened.author"
                :name="opened.author.login"
                :src="opened.author.avatarUrl"
                size="xs"
                decorative
              />
              <span :class="css.itemView_opened">{{ opened.text }}</span>
            </p>
          </div>

          <PullRequestMerge
            v-if="pr"
            :pr="pr"
            :detail="prDetail"
          />

          <!-- One column: everything in reading order. -->
          <template v-if="!split">
            <template v-if="pr">
              <PullRequestReviews
                v-if="prDetail"
                ref="reviews"
                :detail="prDetail"
                :now="now"
                :reviewer-options="reviewerOptions"
                @request="emit('edit', { kind: 'requestReviewers', logins: $event })"
              />
              <PullRequestChecks
                v-if="prDetail"
                :detail="prDetail"
                :now="now"
              />
              <LinkedItems
                :title="t(l.closes)"
                :items="closes ?? []"
                :repository="item.repository.nameWithOwner"
                @open="emit('open', $event)"
              />
            </template>
            <ItemProperties
              ref="properties"
              :item="item"
              :detail="issueDetail"
              :editing="editing"
              @open="emit('open', $event)"
              @edit="emit('edit', $event)"
            />
            <ItemProjects
              ref="projects"
              :projects="item.projects"
              :detail-projects="detail?.projects"
              :now="now"
              :editable="editing != null"
              :can-add-to-project="permissions?.addToProject"
              :viewer-projects="editing?.viewerProjects"
              @edit="emit('edit', $event)"
              @need-projects="emit('needProjects')"
            />
          </template>
          <template v-else-if="pr">
            <PullRequestChecks
              v-if="prDetail"
              :detail="prDetail"
              :now="now"
            />
            <LinkedItems
              :title="t(l.closes)"
              :items="closes ?? []"
              :repository="item.repository.nameWithOwner"
              @open="emit('open', $event)"
            />
          </template>

          <template v-if="detail">
            <GitHubHtml
              v-if="detail.bodyHtml"
              :html="detail.bodyHtml"
            />
            <p
              v-else
              :class="css.itemView_note"
            >
              {{ t(l.noDescription) }}
            </p>
          </template>

          <ItemActivity
            :comments="detail?.comments ?? null"
            :now="now"
            :load-all="loadAllComments"
          />
        </div>
        <footer :class="css.itemView_composer">
          <ItemComposer
            ref="composer"
            v-model:text="commentDraft"
            :disabled="editing != null && !permissions?.comment"
            @submit="emit('edit', { kind: 'comment', body: $event })"
          />
        </footer>
      </SplitterPanel>

      <template v-if="split">
        <ResizeHandle
          :label="t(l.resizeSide)"
          @resized="sideWidth.save()"
        />
        <SplitterPanel
          id="item-side"
          :key="arrangement"
          as="aside"
          :order="1"
          size-unit="px"
          :default-size="sideWidth.stored"
          :min-size="sideWidth.min"
          :max-size="sideWidth.max"
          :style="sideWidth.style"
        >
          <div :class="css.itemView_side">
            <PullRequestReviews
              v-if="prDetail"
              ref="reviews"
              :detail="prDetail"
              :now="now"
              :reviewer-options="reviewerOptions"
              @request="emit('edit', { kind: 'requestReviewers', logins: $event })"
            />
            <ItemProperties
              ref="properties"
              :item="item"
              :detail="issueDetail"
              :editing="editing"
              @open="emit('open', $event)"
              @edit="emit('edit', $event)"
            />
            <ItemProjects
              ref="projects"
              :projects="item.projects"
              :detail-projects="detail?.projects"
              :now="now"
              :editable="editing != null"
              :can-add-to-project="permissions?.addToProject"
              :viewer-projects="editing?.viewerProjects"
              @edit="emit('edit', $event)"
              @need-projects="emit('needProjects')"
            />
          </div>
        </SplitterPanel>
      </template>
    </SplitterGroup>
  </article>
</template>

<style lang="scss" module="css">
.itemView {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: $color-fg;
  background: $color-bg-2;
}

.itemView_toolbar {
  display: flex;
  flex: none;
  gap: $spacing-10;
  align-items: center;
  height: $list-header-height;
  padding: 0 14px 0 $spacing-16;
  font-size: $font-size-sm;
  border-bottom: 1px solid $color-border;
}

.itemView_kind {
  flex: none;
  width: 14px;
  height: 14px;
}

.itemView_kind_open {
  color: $color-green;
}

.itemView_kind_done {
  color: $color-purple;
}

.itemView_kind_closed {
  color: $color-red;
}

.itemView_kind_draft {
  color: $color-fg-dim;
}

.itemView_repository {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg-2;
  white-space: nowrap;
}

.itemView_number {
  flex: none;
  font-family: $font-family-mono;
  color: $color-fg-dim;
}

.itemView_spacer {
  flex: 1;
}

.itemView_position {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  white-space: nowrap;
}

.itemView_divider {
  flex: none;
  width: 1px;
  height: 16px;
  background: $color-border-2;
}

.itemView_columns {
  flex: 1;
  min-height: 0;
}

.itemView_main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.itemView_scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  padding: 20px $spacing-24;
  overflow-y: auto;

  .itemView_modal &,
  .itemView_page & {
    padding: 32px 40px;
  }

  // Sections keep their height; the column scrolls instead.
  > * {
    flex: none;
  }
}

.itemView_heading {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
}

.itemView_title {
  font-size: 20px;
  font-weight: $font-weight-semibold;
  line-height: 26px;
}

.itemView_state {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-10;
  align-items: center;
}

.itemView_opened {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.itemView_note {
  font-size: $font-size-md;
  color: $color-fg-dim;
}

.itemView_composer {
  flex: none;
  padding: $spacing-12 $spacing-16;
  border-top: 1px solid $color-border;

  .itemView_modal &,
  .itemView_page & {
    padding: 0 40px 24px;
    border-top: none;
  }
}

.itemView_side {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  padding: 28px $spacing-24;
  overflow-y: auto;
  border-left: 1px solid $color-border;

  > * {
    flex: none;
  }
}
</style>
