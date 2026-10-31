<!-- An opened item's own properties (D1, F1): assignees, labels and milestone — and an issue's type — then for an issue how far its sub-issues are, its parent, and what it is blocked by or blocking, when it has them. Where the user may change them (`editing`), a value opens its picker, and `A`, `L`, `M` are drawn as its keys (the item view handles them through `openPicker`); where they may not, the values are plain and one quiet line under them says why (K1b) — it stands out for a moment when such a key is pressed anyway. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Lock, Milestone } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import { EDIT_KEYS } from '@/commands/useEditCommands.js';
import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import LabelPill from '@/components/LabelPill.vue';
import type { PickerChange } from '@/components/Picker.vue';
import Picker from '@/components/Picker.vue';
import PropertyRow from '@/components/PropertyRow.vue';
import PropertyValueButton from '@/components/PropertyValueButton.vue';
import type { EditRequest } from '@/edits/EditTypes.js';
import { usePickerOptions } from '@/edits/usePickerOptions.js';
import type { IssueDetail, LinkedIssue, LinkedIssues } from '@/store/ItemDetailTypes.js';
import type { Item } from '@/store/ItemTypes.js';
import { getGitHubColor } from '@/utils/getGitHubColor.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import type { ItemEditing } from './ItemEditing.js';
import type { ItemReference } from './itemRoutes.js';
import * as l from './ItemProperties.loc.js';

const props = defineProps<{
  item: Item;
  /** An issue's links come with its detail. */
  detail?: IssueDetail | null;
  /** What may be edited, and what the pickers offer; without it nothing is. */
  editing?: ItemEditing | null;
}>();

const emit = defineEmits<{
  /** A linked issue was picked. */
  open: [reference: ItemReference];
  /** A property was changed. */
  edit: [request: EditRequest];
}>();

/** A property with a picker. */
export type ItemPropertyPicker = 'assignees' | 'issueType' | 'labels' | 'milestone';

const t = useTranslate();
const options = usePickerOptions();
const opened = ref<ItemPropertyPicker | null>(null);
/** Pressed a key of an edit the user can't make: the line saying why stands out for a moment. */
const hinted = ref(false);
let hintTimer: ReturnType<typeof setTimeout> | null = null;

const permissions = computed(() => props.editing?.permissions ?? null);
const repositories = computed(() => (props.editing?.metadata ? [props.editing.metadata] : []));
const issueType = computed(() => (props.item.kind === 'issue' ? props.item.issueType : null));
/** The type row: on an issue that has one, or whose repository offers them to someone who may set them. */
const showIssueType = computed(
  () =>
    props.item.kind === 'issue' &&
    (issueType.value !== null ||
      (permissions.value?.issueType === true && (props.editing?.metadata?.issueTypes.length ?? 0) > 0)),
);
/** K1b: the user can't set labels, assignees and milestone here; one quiet line says why. */
const restricted = computed(() => props.editing != null && !props.editing.permissions.labels);
const loadingNote = computed(() => (props.editing?.metadata ? undefined : t(l.loading)));

const subIssues = computed(() =>
  props.item.kind === 'issue' && props.item.subIssues.total > 0 ? props.item.subIssues : null,
);
const links = computed(() => {
  const { detail } = props;
  if (!detail) {
    return [];
  }

  const result: { key: string; label: string; issues: LinkedIssues }[] = [];
  if (detail.blockedBy.totalCount > 0) {
    result.push({ key: 'blockedBy', label: t(l.blockedBy), issues: detail.blockedBy });
  }

  if (detail.blocking.totalCount > 0) {
    result.push({ key: 'blocking', label: t(l.blocking), issues: detail.blocking });
  }

  return result;
});

defineExpose({
  /** Opens the property's picker; `false` when the user can't edit it (the line saying why stands out). */
  openPicker,
});

function openPicker(picker: ItemPropertyPicker) {
  if (!permissions.value?.[picker]) {
    if (props.editing) {
      hint();
    }

    return false;
  }

  opened.value = picker;
  return true;
}

function setOpen(picker: ItemPropertyPicker, isOpen: boolean) {
  if (isOpen) {
    opened.value = picker;
  } else if (opened.value === picker) {
    opened.value = null;
  }
}

function hint() {
  hinted.value = true;
  if (hintTimer !== null) {
    clearTimeout(hintTimer);
  }

  hintTimer = setTimeout(() => {
    hinted.value = false;
  }, 2500);
}

function applyLabels(change: PickerChange) {
  emit('edit', { kind: 'labels', add: change.added, remove: change.removed });
}

function applyAssignees(change: PickerChange) {
  emit('edit', { kind: 'assignees', add: change.added, remove: change.removed });
}

function referenceText(issue: LinkedIssue) {
  return issue.repository === props.item.repository.nameWithOwner
    ? `#${issue.number}`
    : `${issue.repository}#${issue.number}`;
}

function open(issue: LinkedIssue) {
  emit('open', { ...parseRepositoryName(issue.repository), number: issue.number });
}
</script>

<template>
  <dl
    :class="css.itemProperties"
    :aria-label="t(l.properties)"
  >
    <PropertyRow
      :label="t(l.assignees)"
      :kbd="permissions?.assignees ? EDIT_KEYS.assignees : undefined"
    >
      <Picker
        v-if="permissions?.assignees"
        :open="opened === 'assignees'"
        :label="t(l.assignees)"
        :options="options.assignees(repositories, editing?.viewerLogin ?? '')"
        :selected="item.assignees.map(user => user.login)"
        :placeholder="t(l.filterAssignees)"
        :note="loadingNote"
        multiple
        @update:open="setOpen('assignees', $event)"
        @apply="applyAssignees"
      >
        <template #trigger>
          <PropertyValueButton
            :aria-label="
              t(l.valueLabel, {
                property: t(l.assignees),
                value: item.assignees.map(user => user.login).join(', ') || t(l.noOne),
              })
            "
            :aria-keyshortcuts="EDIT_KEYS.assignees"
          >
            <template v-if="item.assignees.length > 0">
              <span
                v-for="assignee in item.assignees"
                :key="assignee.login"
                :class="css.itemProperties_user"
              >
                <Avatar
                  :name="assignee.login"
                  :src="assignee.avatarUrl"
                  size="sm"
                  decorative
                />
                {{ assignee.login }}
              </span>
            </template>
            <span
              v-else
              :class="css.itemProperties_empty"
              >{{ t(l.noOne) }}</span
            >
          </PropertyValueButton>
        </template>
      </Picker>
      <template v-else>
        <span
          v-for="assignee in item.assignees"
          :key="assignee.login"
          :class="css.itemProperties_user"
        >
          <Avatar
            :name="assignee.login"
            :src="assignee.avatarUrl"
            size="sm"
            decorative
          />
          {{ assignee.login }}
        </span>
        <span
          v-if="item.assignees.length === 0"
          :class="css.itemProperties_empty"
          >{{ t(l.noOne) }}</span
        >
      </template>
    </PropertyRow>
    <PropertyRow
      :label="t(l.labels)"
      :kbd="permissions?.labels ? EDIT_KEYS.labels : undefined"
    >
      <Picker
        v-if="permissions?.labels"
        :open="opened === 'labels'"
        :label="t(l.labels)"
        :options="options.labels(repositories)"
        :selected="item.labels.map(label => label.name)"
        :placeholder="t(l.filterLabels)"
        :note="loadingNote"
        multiple
        @update:open="setOpen('labels', $event)"
        @apply="applyLabels"
      >
        <template #trigger>
          <PropertyValueButton
            :aria-label="
              t(l.valueLabel, {
                property: t(l.labels),
                value: item.labels.map(label => label.name).join(', ') || t(l.none),
              })
            "
            :aria-keyshortcuts="EDIT_KEYS.labels"
          >
            <template v-if="item.labels.length > 0">
              <LabelPill
                v-for="label in item.labels"
                :key="label.name"
                :name="label.name"
                :color="label.color"
              />
            </template>
            <span
              v-else
              :class="css.itemProperties_empty"
              >{{ t(l.none) }}</span
            >
          </PropertyValueButton>
        </template>
      </Picker>
      <template v-else>
        <LabelPill
          v-for="label in item.labels"
          :key="label.name"
          :name="label.name"
          :color="label.color"
        />
        <span
          v-if="item.labels.length === 0"
          :class="css.itemProperties_empty"
          >{{ t(l.none) }}</span
        >
      </template>
    </PropertyRow>
    <PropertyRow
      :label="t(l.milestone)"
      :kbd="permissions?.milestone ? EDIT_KEYS.milestone : undefined"
    >
      <Picker
        v-if="permissions?.milestone"
        :open="opened === 'milestone'"
        :label="t(l.milestone)"
        :options="options.milestones(repositories)"
        :selected="item.milestone ? [item.milestone.title] : []"
        :placeholder="t(l.filterMilestones)"
        :none-label="t(l.noMilestone)"
        :note="loadingNote"
        @update:open="setOpen('milestone', $event)"
        @pick="emit('edit', { kind: 'milestone', title: $event })"
      >
        <template #trigger>
          <PropertyValueButton
            :aria-label="t(l.valueLabel, { property: t(l.milestone), value: item.milestone?.title ?? t(l.none) })"
            :aria-keyshortcuts="EDIT_KEYS.milestone"
          >
            <span
              v-if="item.milestone"
              :class="css.itemProperties_user"
            >
              <Milestone
                :class="css.itemProperties_icon"
                aria-hidden="true"
              />
              {{ item.milestone.title }}
            </span>
            <span
              v-else
              :class="css.itemProperties_empty"
              >{{ t(l.none) }}</span
            >
          </PropertyValueButton>
        </template>
      </Picker>
      <template v-else>
        <span
          v-if="item.milestone"
          :class="css.itemProperties_user"
        >
          <Milestone
            :class="css.itemProperties_icon"
            aria-hidden="true"
          />
          {{ item.milestone.title }}
        </span>
        <span
          v-else
          :class="css.itemProperties_empty"
          >{{ t(l.none) }}</span
        >
      </template>
    </PropertyRow>
    <PropertyRow
      v-if="showIssueType"
      :label="t(l.type)"
    >
      <Picker
        v-if="permissions?.issueType"
        :open="opened === 'issueType'"
        :label="t(l.type)"
        :options="options.issueTypes(repositories)"
        :selected="issueType ? [issueType.name] : []"
        :none-label="t(l.noType)"
        @update:open="setOpen('issueType', $event)"
        @pick="emit('edit', { kind: 'issueType', name: $event })"
      >
        <template #trigger>
          <PropertyValueButton
            :aria-label="t(l.valueLabel, { property: t(l.type), value: issueType?.name ?? t(l.none) })"
          >
            <LabelPill
              v-if="issueType"
              :name="issueType.name"
              :color="getGitHubColor(issueType.color)"
            />
            <span
              v-else
              :class="css.itemProperties_empty"
              >{{ t(l.none) }}</span
            >
          </PropertyValueButton>
        </template>
      </Picker>
      <LabelPill
        v-else-if="issueType"
        :name="issueType.name"
        :color="getGitHubColor(issueType.color)"
      />
    </PropertyRow>
    <PropertyRow
      v-if="subIssues"
      :label="t(l.subIssues)"
    >
      <span
        :class="css.itemProperties_progress"
        aria-hidden="true"
      >
        <span
          :class="css.itemProperties_progressDone"
          :style="{ width: `${(subIssues.completed / subIssues.total) * 100}%` }"
        />
      </span>
      <span :class="css.itemProperties_dim">{{
        t(l.subIssuesDone, { completed: subIssues.completed, total: subIssues.total })
      }}</span>
    </PropertyRow>
    <PropertyRow
      v-if="detail?.parent"
      :label="t(l.parent)"
    >
      <Button
        variant="link"
        @click="open(detail.parent)"
      >
        <span :class="css.itemProperties_reference">{{ referenceText(detail.parent) }}</span>
        {{ detail.parent.title }}
      </Button>
    </PropertyRow>
    <PropertyRow
      v-for="link in links"
      :key="link.key"
      :label="link.label"
    >
      <span :class="css.itemProperties_links">
        <Button
          v-for="issue in link.issues.nodes"
          :key="issue.id"
          variant="link"
          @click="open(issue)"
        >
          <span :class="css.itemProperties_reference">{{ referenceText(issue) }}</span>
          {{ issue.title }}
        </Button>
        <span
          v-if="link.issues.totalCount > link.issues.nodes.length"
          :class="css.itemProperties_dim"
          >{{ t(l.more, { count: link.issues.totalCount - link.issues.nodes.length }) }}</span
        >
      </span>
    </PropertyRow>
  </dl>
  <p
    v-if="restricted"
    :class="[css.itemProperties_restricted, hinted && css.itemProperties_restricted_hinted]"
    role="note"
  >
    <Lock
      :class="css.itemProperties_icon"
      aria-hidden="true"
    />
    {{ t(l.restricted, { repository: item.repository.nameWithOwner }) }}
  </p>
</template>

<style lang="scss" module="css">
.itemProperties_restricted {
  display: flex;
  gap: $spacing-6;
  align-items: flex-start;
  margin-top: -$spacing-8;
  font-size: $font-size-xs;
  line-height: 17px;
  color: $color-fg-dim;
  transition: color 0.2s;
}

.itemProperties_restricted_hinted {
  color: $color-fg;
}

.itemProperties {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin: 0;
}

.itemProperties_user {
  display: inline-flex;
  gap: $spacing-8;
  align-items: center;
}

.itemProperties_icon {
  width: 13px;
  height: 13px;
  color: $color-fg-2;
}

.itemProperties_empty,
.itemProperties_dim {
  color: $color-fg-dim;
}

.itemProperties_progress {
  position: relative;
  width: 56px;
  height: 4px;
  overflow: hidden;
  background: $color-bg-3;
  border-radius: 2px;
}

.itemProperties_progressDone {
  position: absolute;
  inset: 0 auto 0 0;
  background: $color-purple;
  border-radius: 2px;
}

.itemProperties_links {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
}

.itemProperties_reference {
  font-family: $font-family-mono;
  color: $color-fg-dim;
}
</style>
