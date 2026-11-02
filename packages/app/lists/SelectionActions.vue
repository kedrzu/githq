<!-- What can be done to the items selected together in a list (E2, `x`) — with stacks' entries among them, it says how many pull requests and how many entries and rows they span (D20, SP28): assign (`A`), label (`L`), set the milestone (`M`) and close (`⇧X`) all of them at once, and clear the selection (Esc). Each action changes only the items the user may change that way — the picker says "2 of 3 editable" — and the others are reported with whatever GitHub refused (K2). A label or a person some of the items have shows half-chosen. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { CircleCheckBig, CircleSlash, Milestone, Tag, UserPlus, X } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import { AuthStore } from '@/auth/AuthStore.js';
import { useCommands } from '@/commands/useCommands.js';
import { EDIT_KEYS, useEditCommands } from '@/commands/useEditCommands.js';
import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';
import Menu from '@/components/Menu.vue';
import MenuItem from '@/components/MenuItem.vue';
import type { PickerChange } from '@/components/Picker.vue';
import Picker from '@/components/Picker.vue';
import type { EditRequest } from '@/edits/EditTypes.js';
import type { EditPermissions } from '@/edits/getEditPermissions.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { usePickerOptions } from '@/edits/usePickerOptions.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';
import { Clock } from '@/services/Clock.js';
import type { ItemDetailProject } from '@/store/ItemDetailTypes.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item } from '@/store/ItemTypes.js';

import type { SelectionSpan } from './getSelectionSpan.js';
import * as l from './SelectionActions.loc.js';

const props = defineProps<{
  /** The items selected together. */
  ids: readonly string[];
  /** The stacks' entries and rows they span in the list; without an entry the count stands alone ("3 selected"). */
  span?: SelectionSpan | null;
}>();

const emit = defineEmits<{
  /** Esc or "Clear": the selection empties. */
  clear: [];
}>();

type SelectionPicker = 'assignees' | 'labels' | 'milestone';

const t = useTranslate();
const auth = useService(AuthStore);
const items = useService(ItemStore);
const repositories = useService(RepositoryStore);
const editor = useService(ItemEditor);
const options = usePickerOptions();
const editCommands = useEditCommands();
const clock = useService(Clock);
const opened = ref<SelectionPicker | null>(null);
const closeMenuOpen = ref(false);

const selected = computed(() => props.ids.flatMap(id => items.get(id) ?? []));
/** Every item selected is a pull request: the count names them, as edits apply to them (D20). */
const allPullRequests = computed(
  () => selected.value.length === props.ids.length && selected.value.every(item => item.kind === 'pullRequest'),
);
const chip = computed(() => t(allPullRequests.value ? l.pullRequests : l.items, { count: props.ids.length }));
/** "9 pull requests selected, in 3 entries and 1 row" (SP28), or "3 selected" with no stack's entry among them. */
const countText = computed(() => {
  const span = props.span;
  const count = props.ids.length;
  if (!span || span.entries === 0) {
    return t(l.selected, { count });
  }

  const selectedText = t(allPullRequests.value ? l.pullRequestsSelected : l.itemsSelected, { count });
  const entries = t(l.entries, { count: span.entries });
  return span.rows > 0
    ? t(l.selectedInEntriesAndRows, { selected: selectedText, entries, rows: t(l.rows, { count: span.rows }) })
    : t(l.selectedInEntries, { selected: selectedText, entries });
});
/** The repositories of the selection, each once (`owner/name`). */
const repositoryNames = computed(() => [...new Set(selected.value.map(item => item.repository.nameWithOwner))]);
const metadata = computed(() => repositoryNames.value.flatMap(name => repositories.get(name) ?? []));
const loadingNote = computed(() => (metadata.value.length < repositoryNames.value.length ? t(l.loading) : undefined));
const canClose = computed(() =>
  selected.value.some(item => item.state === 'OPEN' && editor.getPermissions(item).state),
);
const labels = computed(() => split(item => item.labels.map(label => label.name)));
const assignees = computed(() => split(item => item.assignees.map(user => user.login)));
const milestones = computed(() => split(item => (item.milestone ? [item.milestone.title] : [])));
/** The projects of the selection the user may write to, each once. */
const places = computed(() => {
  const byProject = new Map<string, ItemDetailProject>();
  for (const item of selected.value) {
    for (const place of editor.getPlaces(item)) {
      if (place.viewerCanUpdate && !byProject.has(place.projectId)) {
        byProject.set(place.projectId, place);
      }
    }
  }

  return [...byProject.values()];
});

// What the pickers offer, read for every repository of the selection.
watch(
  () => repositoryNames.value.join(' '),
  names => {
    for (const name of names.split(' ').filter(Boolean)) {
      void repositories.ensure(name);
    }
  },
  { immediate: true },
);

// The selection's actions (E4): A/L/M and ⇧X open the toolbar's pickers and menu — before an opened item's,
// which yield to them (the registry's section order) — and the command menu offers their values and the projects'
// status, priority and iteration, made on every item that may take them.
useCommands(
  () =>
    editCommands({
      section: 'selection',
      items: selected.value,
      metadata: metadata.value,
      loading: metadata.value.length < repositoryNames.value.length,
      viewerLogin: auth.viewer?.login ?? '',
      getPermissions: item => editor.getPermissions(item),
      places: places.value,
      now: clock.now(),
      stateOptions: canClose.value
        ? [
            { key: 'completed', text: t(l.closeCompleted), request: { kind: 'close', reason: 'COMPLETED' } },
            { key: 'notPlanned', text: t(l.closeNotPlanned), request: { kind: 'close', reason: 'NOT_PLANNED' } },
          ]
        : [],
      stateTitle: t(l.closeCommand, { count: props.ids.length }),
      edit: apply,
      setField: (place, field, value) =>
        apply({ kind: 'projectFieldInProject', projectId: place.projectId, fieldId: field.id, value }),
      inline: {
        assignees: () => open('assignees'),
        labels: () => open('labels'),
        milestone: () => open('milestone'),
        state: () => {
          closeMenuOpen.value = true;
          return true;
        },
      },
    }),
  () => ({
    kind: 'selection',
    label: chip.value,
    title: chip.value,
  }),
);

function open(picker: SelectionPicker) {
  opened.value = picker;
  return true;
}

function setOpen(picker: SelectionPicker, isOpen: boolean) {
  if (isOpen) {
    opened.value = picker;
  } else if (opened.value === picker) {
    opened.value = null;
  }
}

/** "2 of 3 editable" when some of the items can't be changed that way. */
function editableNote(permission: keyof EditPermissions) {
  const editable = selected.value.filter(item => editor.getPermissions(item)[permission]).length;
  return editable < selected.value.length
    ? t(l.editable, { editable, total: selected.value.length })
    : loadingNote.value;
}

/** The values all the items have, and those only some of them have. */
function split(valuesOf: (item: Item) => readonly string[]) {
  const counts = new Map<string, number>();
  for (const item of selected.value) {
    for (const value of new Set(valuesOf(item))) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  const all: string[] = [];
  const some: string[] = [];
  for (const [value, count] of counts) {
    (count === selected.value.length ? all : some).push(value);
  }

  return { all, some };
}

function apply(request: EditRequest) {
  void editor.edit(props.ids, request);
}

function applyChange(kind: 'assignees' | 'labels', change: PickerChange) {
  apply({ kind, add: change.added, remove: change.removed });
}

function optionsOf(repositoriesMetadata: readonly RepositoryMetadata[], picker: SelectionPicker) {
  switch (picker) {
    case 'assignees':
      return options.assignees(repositoriesMetadata, auth.viewer?.login ?? '');
    case 'labels':
      return options.labels(repositoriesMetadata);
    case 'milestone':
      return options.milestones(repositoriesMetadata);
    default:
      return assertNever(picker);
  }
}
</script>

<template>
  <div
    :class="css.selectionActions"
    role="toolbar"
    :aria-label="t(l.actions)"
  >
    <span :class="css.selectionActions_count">{{ countText }}</span>
    <Picker
      :open="opened === 'assignees'"
      :label="t(l.assignees)"
      :options="optionsOf(metadata, 'assignees')"
      :selected="assignees.all"
      :mixed="assignees.some"
      :placeholder="t(l.filterAssignees)"
      :note="editableNote('assignees')"
      multiple
      @update:open="setOpen('assignees', $event)"
      @apply="applyChange('assignees', $event)"
    >
      <template #trigger>
        <Button
          variant="ghost"
          size="sm"
          :icon="UserPlus"
          :kbd="EDIT_KEYS.assignees"
          :aria-keyshortcuts="EDIT_KEYS.assignees"
        >
          {{ t(l.assign) }}
        </Button>
      </template>
    </Picker>
    <Picker
      :open="opened === 'labels'"
      :label="t(l.labels)"
      :options="optionsOf(metadata, 'labels')"
      :selected="labels.all"
      :mixed="labels.some"
      :placeholder="t(l.filterLabels)"
      :note="editableNote('labels')"
      multiple
      @update:open="setOpen('labels', $event)"
      @apply="applyChange('labels', $event)"
    >
      <template #trigger>
        <Button
          variant="ghost"
          size="sm"
          :icon="Tag"
          :kbd="EDIT_KEYS.labels"
          :aria-keyshortcuts="EDIT_KEYS.labels"
        >
          {{ t(l.label) }}
        </Button>
      </template>
    </Picker>
    <Picker
      :open="opened === 'milestone'"
      :label="t(l.milestone)"
      :options="optionsOf(metadata, 'milestone')"
      :selected="milestones.all"
      :none-label="t(l.noMilestone)"
      :note="editableNote('milestone')"
      @update:open="setOpen('milestone', $event)"
      @pick="apply({ kind: 'milestone', title: $event })"
    >
      <template #trigger>
        <Button
          variant="ghost"
          size="sm"
          :icon="Milestone"
          :kbd="EDIT_KEYS.milestone"
          :aria-keyshortcuts="EDIT_KEYS.milestone"
        >
          {{ t(l.milestone) }}
        </Button>
      </template>
    </Picker>
    <Menu
      v-if="canClose"
      v-model:open="closeMenuOpen"
    >
      <template #trigger>
        <Button
          variant="ghost"
          size="sm"
          :icon="CircleCheckBig"
          :kbd="EDIT_KEYS.state"
          :aria-keyshortcuts="EDIT_KEYS.state"
        >
          {{ t(l.close) }}
        </Button>
      </template>
      <MenuItem
        :icon="CircleCheckBig"
        @select="apply({ kind: 'close', reason: 'COMPLETED' })"
      >
        {{ t(l.closeCompleted) }}
      </MenuItem>
      <MenuItem
        :icon="CircleSlash"
        @select="apply({ kind: 'close', reason: 'NOT_PLANNED' })"
      >
        {{ t(l.closeNotPlanned) }}
      </MenuItem>
    </Menu>
    <IconButton
      :icon="X"
      :label="t(l.clear)"
      kbd="Escape"
      size="sm"
      @click="emit('clear')"
    />
  </div>
</template>

<style lang="scss" module="css">
.selectionActions {
  display: flex;
  gap: $spacing-4;
  align-items: center;
  padding: 2px $spacing-4 2px $spacing-10;
  margin-left: $spacing-8;
  background: rgba($color-accent, 0.1);
  border: 1px solid rgba($color-accent, 0.35);
  border-radius: $radius-lg;
}

.selectionActions_count {
  margin-right: $spacing-4;
  font-size: $font-size-sm;
  color: $color-fg;
  white-space: nowrap;
}
</style>
