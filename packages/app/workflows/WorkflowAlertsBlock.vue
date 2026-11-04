<!-- The Workflow alerts section of a repository's settings (actions T16, W7–W12, D5, D13, D14), a `SettingsBlock` with its card (`Workflow alerts / Card`): the default branch, as GitHub names it, with its switch; the patterns, each with what it matches of the refs githq has seen runs on and how many workflows are broken there; the add field, which turns into the editor; "No alerts from …" when nothing raises any; up to three other refs with recent runs that raise none; and, before the first read, that nothing can be matched yet. Each change is asked for as it is made (`change`), nothing while the user only looks. Keys while it is shown and no layer is open, never from a field: J/K and ↓/↑ move between the default branch and the patterns, Space switches the default branch, Enter edits a pattern in place and ⌫ removes it at once, A goes to the add field; in the editor Enter saves and Esc cancels — on the add field left empty, reached by the page's address, Esc goes back where the user came from (W13) —, and the list's key hints leave while it has the keys. Focused itself (`#workflow-alerts`), it selects the default branch. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { BellOff, LoaderCircle, Pencil, X } from 'lucide-vue-next';
import { computed, nextTick, ref, useTemplateRef } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import IconButton from '@/components/IconButton.vue';
import Kbd from '@/components/Kbd.vue';
import Switch from '@/components/Switch.vue';
import SettingsBlock from '@/settings/SettingsBlock.vue';
import { REPOSITORY_SETTINGS_SECTIONS } from '@/tracking/trackingRoutes.js';
import { formatList } from '@/utils/formatList.js';
import { isActivatableTarget } from '@/utils/isActivatableTarget.js';
import { isScreenKey } from '@/utils/isScreenKey.js';
import { useRowSelection } from '@/utils/useRowSelection.js';

import { buildWorkflowAlerts, previewPatternEdit } from './buildWorkflowAlerts.js';
import type { WorkflowAlertsOtherRef } from './buildWorkflowAlerts.js';
import { useDescribeAgo } from './useDescribeAgo.js';
import * as l from './WorkflowAlertsBlock.loc.js';
import WorkflowPatternChip from './WorkflowPatternChip.vue';
import WorkflowPatternEditor from './WorkflowPatternEditor.vue';
import WorkflowPatternMatches from './WorkflowPatternMatches.vue';
import WorkflowRefChip from './WorkflowRefChip.vue';
import type { RepositoryWorkflows, WorkflowRefSettings } from './WorkflowTypes.js';

/** How many chips a pattern's row shows before "+n": its count takes the rest of the line. */
const CHIP_LIMIT = 3;
const DEFAULT_KEY = 'default';

const props = defineProps<{
  /** `owner/name`. */
  nameWithOwner: string;
  /** What is stored of its workflows; `undefined` before the first read. */
  stored: RepositoryWorkflows | undefined;
  /** The settings in force. */
  settings: WorkflowRefSettings;
  /** Epoch ms the ages are counted to. */
  now: number;
  /** The page was opened on the add field by its address (W13). */
  openedOnAddField?: boolean;
}>();

const emit = defineEmits<{
  /** The settings as the user just changed them: the caller saves them. */
  change: [settings: WorkflowRefSettings];
  /** Esc on the add field the page was opened on, nothing typed: the caller goes back. */
  back: [];
}>();

/** A row the keys move through: the default branch, or a pattern. */
type AlertRow = { readonly kind: 'default'; readonly key: string } | PatternRow;

interface PatternRow {
  readonly kind: 'pattern';
  readonly key: string;
  readonly pattern: string;
}

const t = useTranslate();
const describeAgo = useDescribeAgo();
const root = useTemplateRef('root');
const addField = useTemplateRef('addField');

/** What the add field holds. */
const added = ref('');
/** The pattern edited in place, and what it is changed to; `null` with none. */
const editing = ref<{ readonly pattern: string; value: string } | null>(null);
/** Esc on the empty add field goes back: only for the visit it was opened on, until something is typed there. */
let backOnEscape = props.openedOnAddField;

const alerts = computed(() => buildWorkflowAlerts({ stored: props.stored, settings: props.settings, now: props.now }));
const rows = computed((): AlertRow[] => [
  { kind: 'default', key: DEFAULT_KEY },
  ...alerts.value.patterns.map(({ pattern }): AlertRow => ({ kind: 'pattern', key: getPatternKey(pattern), pattern })),
]);
const selection = useRowSelection({
  rows,
  getKey: row => row.key,
  root,
  keyAttribute: 'data-alert-key',
  open: row => {
    if (row.kind === 'pattern') {
      startEditing(row.pattern);
    }
  },
});
const addPreview = computed(() =>
  previewPatternEdit({ stored: props.stored, settings: props.settings, index: null, value: added.value }),
);
/** The index of the pattern edited; `null` with none, or once it is gone from the settings (another tab). */
const editedIndex = computed(() => {
  const index = editing.value ? props.settings.refs.indexOf(editing.value.pattern) : -1;
  return index === -1 ? null : index;
});
const editPreview = computed(() =>
  previewPatternEdit({
    stored: props.stored,
    settings: props.settings,
    index: editedIndex.value,
    value: editing.value?.value ?? '',
  }),
);
const defaultDetail = computed(() => {
  const { defaultBranch, read } = alerts.value;
  const count = defaultBranch.workflows.length;
  const names = formatList(defaultBranch.workflows);
  if (!defaultBranch.on) {
    if (defaultBranch.name === null) {
      return t(l.offNotRead);
    }

    return count > 0
      ? t(l.offWithRuns, { count, name: defaultBranch.name, names })
      : t(l.offNoRuns, { name: defaultBranch.name });
  }

  if (!read) {
    return t(l.notReadYet);
  }

  return count > 0 ? t(l.runsOnIt, { count, names }) : t(l.noRunsSeen);
});
/** A field has the keys: Enter saves there, and ⌫ deletes a character. */
const fieldActive = computed((): boolean => editedIndex.value !== null || addField.value?.active === true);
const hints = computed(() => {
  const row = selection.selectedRow;
  const actions =
    row?.kind === 'pattern'
      ? [
          { keys: 'Enter', label: t(l.edit) },
          { keys: 'Backspace', label: t(l.remove) },
        ]
      : [{ keys: 'Space', label: t(l.switch) }];
  return [...actions, { keys: 'A', label: t(l.add) }];
});

useCommands(() => [
  { id: 'workflowAlerts.next', title: t(l.next), section: 'view', key: 'J', otherKeys: ['ArrowDown'], menu: false },
  {
    id: 'workflowAlerts.previous',
    title: t(l.previous),
    section: 'view',
    key: 'K',
    otherKeys: ['ArrowUp'],
    menu: false,
  },
  // Space, Enter and ⌫ are run below, never from a button, which does what it says.
  { id: 'workflowAlerts.switch', title: t(l.switchDefault), section: 'view', key: 'Space', menu: false },
  { id: 'workflowAlerts.edit', title: t(l.editSelected), section: 'view', key: 'Enter', menu: false },
  { id: 'workflowAlerts.remove', title: t(l.removeSelected), section: 'view', key: 'Backspace', menu: false },
  { id: 'workflowAlerts.add', title: t(l.addPattern), section: 'view', key: 'A', run: () => addField.value?.focus() },
]);

onWindowEvent('keydown', event => {
  const row = selection.selectedRow;
  if (!row || !isScreenKey(event) || isActivatableTarget(event.target)) {
    return;
  }

  if (event.key === ' ' && row.kind === 'default') {
    event.preventDefault();
    switchDefaultBranch(!props.settings.defaultBranch);
  } else if (event.key === 'Backspace' && row.kind === 'pattern') {
    event.preventDefault();
    remove(row.pattern);
  }
});

function getPatternKey(pattern: string) {
  return `pattern:${pattern}`;
}

function switchDefaultBranch(on: boolean) {
  emit('change', { defaultBranch: on, refs: props.settings.refs });
}

function remove(pattern: string) {
  emit('change', { defaultBranch: props.settings.defaultBranch, refs: props.settings.refs.filter(p => p !== pattern) });
}

function startEditing(pattern: string) {
  selection.select(getPatternKey(pattern));
  editing.value = { pattern, value: pattern };
}

/** Enter in the add field: a new pattern, the cursor on its row. Nothing typed, or one listed: nothing. */
function saveAdded() {
  const preview = addPreview.value;
  if (preview.kind !== 'preview') {
    return;
  }

  emit('change', preview.settings);
  selection.select(getPatternKey(added.value.trim()));
  added.value = '';
  backOnEscape = false;
  leaveField();
}

function cancelAdding() {
  if (backOnEscape && added.value === '') {
    emit('back');
    return;
  }

  added.value = '';
  backOnEscape = false;
  leaveField();
}

/** Enter in the editor: the pattern changed in place; unchanged, it only closes. */
function saveEdited() {
  const current = editing.value;
  const preview = editPreview.value;
  if (!current || preview.kind !== 'preview') {
    return;
  }

  const pattern = current.value.trim();
  if (pattern !== current.pattern) {
    emit('change', preview.settings);
  }

  selection.select(getPatternKey(pattern));
  stopEditing();
}

function stopEditing() {
  editing.value = null;
  leaveField();
}

/** Out of a field, the keys are the card's again. */
function leaveField() {
  void nextTick(() => root.value?.focus({ preventScroll: true }));
}

/** Focused itself, from its address: on the default branch. */
function onFocus(event: FocusEvent) {
  if (event.target === event.currentTarget && selection.selectedKey === null) {
    selection.select(DEFAULT_KEY);
  }
}

function describeOther(entry: WorkflowAlertsOtherRef) {
  const { workflow, verdict, at } = entry.latest;
  const params = { workflow, when: describeAgo(at, props.now) };
  switch (verdict) {
    case 'failed':
      return t(l.otherFailed, params);
    case 'passed':
      return t(l.otherPassed, params);
    default:
      return t(l.otherRan, params);
  }
}

function onPatternClick(event: MouseEvent, pattern: string) {
  if (!isActivatableTarget(event.target)) {
    selection.select(getPatternKey(pattern));
  }
}
</script>

<template>
  <SettingsBlock
    :id="REPOSITORY_SETTINGS_SECTIONS.workflowAlerts"
    :class="css.workflowAlertsBlock"
    :title="t(l.title)"
    :description="t(l.description, { name: nameWithOwner })"
    tabindex="-1"
    @focus="onFocus"
  >
    <div
      ref="root"
      :class="css.workflowAlertsBlock_card"
      tabindex="-1"
    >
      <div
        :class="[
          css.workflowAlertsBlock_row,
          selection.selectedKey === DEFAULT_KEY && css.workflowAlertsBlock_selected,
        ]"
        :data-alert-key="DEFAULT_KEY"
        :aria-current="selection.selectedKey === DEFAULT_KEY ? 'true' : undefined"
        @click="selection.select(DEFAULT_KEY)"
      >
        <span :class="css.workflowAlertsBlock_switch">
          <Switch
            :model-value="settings.defaultBranch"
            :label="t(l.defaultBranch)"
            aria-keyshortcuts="Space"
            @update:model-value="switchDefaultBranch"
          />
        </span>
        <div :class="css.workflowAlertsBlock_text">
          <p :class="css.workflowAlertsBlock_line">
            <span
              :class="[css.workflowAlertsBlock_label, !settings.defaultBranch && css.workflowAlertsBlock_label_off]"
            >
              {{ t(l.defaultBranch) }}
            </span>
            <template v-if="alerts.defaultBranch.name !== null">
              <WorkflowRefChip
                :name="alerts.defaultBranch.name"
                kind="branch"
              />
              <span :class="css.workflowAlertsBlock_note">{{
                settings.defaultBranch ? t(l.asGitHubReports) : `${t(l.asGitHubReports)} ${t(l.off)}`
              }}</span>
            </template>
            <span
              v-else-if="!settings.defaultBranch"
              :class="css.workflowAlertsBlock_note"
              >{{ t(l.off) }}</span
            >
          </p>
          <p :class="css.workflowAlertsBlock_detail">{{ defaultDetail }}</p>
        </div>
        <span :class="css.workflowAlertsBlock_count">
          <template v-if="alerts.defaultBranch.brokenCount">
            <span
              :class="css.workflowAlertsBlock_marker"
              aria-hidden="true"
            />
            {{ t(l.brokenCount, { count: alerts.defaultBranch.brokenCount }) }}
          </template>
        </span>
      </div>

      <template
        v-for="(entry, index) in alerts.patterns"
        :key="entry.pattern"
      >
        <WorkflowPatternEditor
          v-if="editing && editedIndex === index"
          v-model="editing.value"
          mode="edit"
          :preview="editPreview"
          :read="alerts.read"
          :now="now"
          @save="saveEdited"
          @cancel="stopEditing"
        />
        <div
          v-else
          :class="[
            css.workflowAlertsBlock_row,
            css.workflowAlertsBlock_pattern,
            selection.selectedKey === getPatternKey(entry.pattern) && css.workflowAlertsBlock_selected,
          ]"
          :data-alert-key="getPatternKey(entry.pattern)"
          :aria-current="selection.selectedKey === getPatternKey(entry.pattern) ? 'true' : undefined"
          @click="onPatternClick($event, entry.pattern)"
        >
          <span :class="css.workflowAlertsBlock_indent" />
          <WorkflowPatternMatches
            :class="css.workflowAlertsBlock_text"
            :matches="entry.matches"
            :read="alerts.read"
            :limit="CHIP_LIMIT"
          >
            <template #lead>
              <WorkflowPatternChip :pattern="entry.pattern" />
            </template>
          </WorkflowPatternMatches>
          <span :class="css.workflowAlertsBlock_actions">
            <IconButton
              :icon="Pencil"
              :label="t(l.editPattern, { pattern: entry.pattern })"
              kbd="Enter"
              @click="startEditing(entry.pattern)"
            />
            <IconButton
              :icon="X"
              :label="t(l.removePattern, { pattern: entry.pattern })"
              kbd="Backspace"
              @click="remove(entry.pattern)"
            />
          </span>
          <span :class="css.workflowAlertsBlock_count">
            <template v-if="entry.brokenCount">
              <span
                :class="css.workflowAlertsBlock_marker"
                aria-hidden="true"
              />
              {{ t(l.brokenCount, { count: entry.brokenCount }) }}
            </template>
          </span>
        </div>
      </template>

      <WorkflowPatternEditor
        ref="addField"
        v-model="added"
        mode="add"
        :input-id="REPOSITORY_SETTINGS_SECTIONS.workflowAlertsAdd"
        :preview="addPreview"
        :read="alerts.read"
        :now="now"
        @save="saveAdded"
        @cancel="cancelAdding"
      />

      <div
        v-if="alerts.alertsOff"
        :class="css.workflowAlertsBlock_nothing"
      >
        <BellOff
          :class="css.workflowAlertsBlock_nothingIcon"
          aria-hidden="true"
        />
        <div :class="css.workflowAlertsBlock_text">
          <p :class="css.workflowAlertsBlock_nothingTitle">{{ t(l.nothingTitle, { name: nameWithOwner }) }}</p>
          <p :class="css.workflowAlertsBlock_nothingText">{{ t(l.nothingText) }}</p>
        </div>
      </div>

      <section
        v-if="alerts.otherRefs.length > 0"
        :class="css.workflowAlertsBlock_others"
        :aria-label="t(l.otherHeading)"
      >
        <h3 :class="css.workflowAlertsBlock_othersHeading">{{ t(l.otherHeading) }}</h3>
        <p
          v-for="entry in alerts.otherRefs"
          :key="entry.ref.name"
          :class="css.workflowAlertsBlock_other"
        >
          <span :class="css.workflowAlertsBlock_otherRef">
            <WorkflowRefChip
              :name="entry.ref.name"
              :kind="entry.ref.kind"
            />
          </span>
          <span
            v-if="entry.latest.verdict === 'failed'"
            :class="css.workflowAlertsBlock_quietMarker"
            aria-hidden="true"
          />
          {{ describeOther(entry) }}
        </p>
      </section>

      <p
        v-if="!alerts.read"
        :class="css.workflowAlertsBlock_notRead"
      >
        <LoaderCircle
          :class="css.workflowAlertsBlock_notReadIcon"
          aria-hidden="true"
        />
        {{ t(l.notRead) }}
      </p>

      <footer
        :class="css.workflowAlertsBlock_footer"
        aria-hidden="true"
      >
        <template v-if="!fieldActive">
          <span :class="css.workflowAlertsBlock_hint"><Kbd keys="J" /><Kbd keys="K" />{{ t(l.move) }}</span>
          <span
            v-for="hint in hints"
            :key="hint.keys"
            :class="css.workflowAlertsBlock_hint"
            ><Kbd :keys="hint.keys" />{{ hint.label }}</span
          >
        </template>
        <span :class="css.workflowAlertsBlock_footerNote">{{ t(l.matchesNote) }}</span>
      </footer>
    </div>
  </SettingsBlock>
</template>

<style lang="scss" module="css">
.workflowAlertsBlock {
  outline: none;
  scroll-margin-top: $spacing-24;
}

.workflowAlertsBlock_card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  outline: none;
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-xl;
}

.workflowAlertsBlock_row {
  display: flex;
  gap: $spacing-12;
  align-items: flex-start;
  padding: 11px $spacing-16;
  cursor: default;
}

.workflowAlertsBlock_pattern {
  border-top: 1px solid $color-border;
}

.workflowAlertsBlock_selected {
  background: $color-sel;
}

.workflowAlertsBlock_switch {
  display: flex;
  flex: none;
  padding-top: 1px;
}

.workflowAlertsBlock_indent {
  flex: none;
  width: 28px;
}

.workflowAlertsBlock_text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-4;
  min-width: 0;
}

.workflowAlertsBlock_line {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8;
  align-items: center;
}

.workflowAlertsBlock_label {
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.workflowAlertsBlock_label_off {
  color: $color-fg-2;
}

.workflowAlertsBlock_note,
.workflowAlertsBlock_detail {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.workflowAlertsBlock_actions {
  display: flex;
  flex: none;
  gap: $spacing-2;
  visibility: hidden;

  .workflowAlertsBlock_row:hover &,
  .workflowAlertsBlock_selected &,
  &:focus-within {
    visibility: visible;
  }
}

.workflowAlertsBlock_count {
  display: flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  justify-content: flex-end;
  width: 64px;
  padding-top: $spacing-2;
  font-size: $font-size-xs;
  color: $color-fg-2;
  white-space: nowrap;
}

.workflowAlertsBlock_marker,
.workflowAlertsBlock_quietMarker {
  @include workflow-broken-marker;
}

.workflowAlertsBlock_quietMarker {
  background: $color-red-quiet;
}

.workflowAlertsBlock_nothing {
  display: flex;
  gap: $spacing-12;
  padding: $spacing-12 $spacing-16;
  border-top: 1px solid $color-border;
}

.workflowAlertsBlock_nothingIcon {
  flex: none;
  width: 16px;
  height: 16px;
  color: $color-fg-2;
}

.workflowAlertsBlock_nothingTitle {
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
}

.workflowAlertsBlock_nothingText {
  font-size: $font-size-xs;
  line-height: $line-height-normal;
  color: $color-fg-2;
}

.workflowAlertsBlock_others {
  display: flex;
  flex-direction: column;
  gap: $spacing-7;
  padding: $spacing-10 $spacing-16 $spacing-12;
  border-top: 1px solid $color-border;
}

.workflowAlertsBlock_othersHeading {
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-fg-dim;
}

.workflowAlertsBlock_other {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.workflowAlertsBlock_otherRef {
  display: flex;
  flex: none;
  width: 180px;
  min-width: 0;
}

.workflowAlertsBlock_notRead {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  padding: $spacing-10 $spacing-16 $spacing-12;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  border-top: 1px solid $color-border;
}

.workflowAlertsBlock_notReadIcon {
  flex: none;
  width: 13px;
  height: 13px;
}

.workflowAlertsBlock_footer {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-14;
  align-items: center;
  padding: $spacing-8 $spacing-14;
  background: $color-bg;
  border-top: 1px solid $color-border;
}

.workflowAlertsBlock_hint {
  display: inline-flex;
  gap: $spacing-5;
  align-items: center;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.workflowAlertsBlock_footerNote {
  margin-left: auto;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}
</style>
