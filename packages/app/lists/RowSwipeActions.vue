<!-- What a list row reveals at its right end when swiped left on a phone (mobile D27, MB114): Status, Assign and Close, as tiles the row's height (`RowSwipeTile`), each opening that property's menu at the bottom, as tapping it on the item does (D45). They are the row's context menu's own actions (`useItemCommands`, `getItemMenuSections`), offered where those are: Status a picker of the item's projects' status — only while it is in one the user may write to —, Assign the assignees picker, applied together as it closes, through the edit engine as on the item; Close, for an issue, the menu of its reasons, for a pull request closing it at once, and on a closed item Reopen. `done` once a menu closed or the action ran: the row slides back. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { CircleCheck, CircleDashed, RotateCcw, UserRound } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import type { Command, CommandOptions } from '@/commands/CommandTypes.js';
import MenuItem from '@/components/MenuItem.vue';
import MenuSheet from '@/components/MenuSheet.vue';
import type { PickerChange } from '@/components/Picker.vue';
import Picker from '@/components/Picker.vue';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { getItemMenuSections } from '@/item/getItemMenuSections.js';

import * as l from './RowSwipeActions.loc.js';
import RowSwipeTile from './RowSwipeTile.vue';
import { useItemCommands } from './useItemCommands.js';

const props = defineProps<{
  /** The one item of the row. */
  ids: readonly string[];
}>();

const emit = defineEmits<{
  /** A menu closed or the action ran: the row slides back. */
  done: [];
}>();

/** A tile's menu. */
type RowSwipeMenu = 'assignees' | 'state' | 'status';

const t = useTranslate();
const editor = useService(ItemEditor);
const { one, getEditCommands } = useItemCommands({
  ids: () => props.ids,
  section: () => 'item',
  // None of the three opens the item.
  open: () => undefined,
});
const opened = ref<RowSwipeMenu | null>(null);

/** The context menu's actions, by their name after the section (`item.status` → `status`). */
const actions = computed(() => {
  const byName = new Map<string, Command>();
  for (const command of getItemMenuSections(getEditCommands(), one.value?.kind ?? 'issue').flat()) {
    byName.set(command.id.slice(command.id.indexOf('.') + 1), command);
  }

  return byName;
});
const status = computed(() => actions.value.get('status') ?? null);
const assignees = computed(() => actions.value.get('assignees') ?? null);
const state = computed(() => actions.value.get('state') ?? null);
/** Under a menu's name (MB74): what it edits. */
const reference = computed(() => (one.value ? `${one.value.repository.nameWithOwner}#${one.value.number}` : ''));
const statusOffered = computed(() => status.value?.options?.() ?? null);
const assigneesOffered = computed(() => assignees.value?.options?.() ?? null);
const stateOffered = computed(() => state.value?.options?.() ?? null);
const closed = computed(() => one.value != null && one.value.state !== 'OPEN');

function setOpen(menu: RowSwipeMenu, open: boolean) {
  if (open) {
    opened.value = menu;
    actions.value.get(menu)?.prepare?.();
  } else if (opened.value === menu) {
    opened.value = null;
    emit('done');
  }
}

function getChosen(offered: CommandOptions | null) {
  return offered?.options.filter(option => option.chosen).map(option => option.value) ?? [];
}

function getMixed(offered: CommandOptions | null) {
  return offered?.options.filter(option => option.mixed).map(option => option.value) ?? [];
}

function getNote(offered: CommandOptions | null) {
  return offered?.note ?? (offered?.loading ? t(l.loading) : undefined);
}

function pickStatus(value: string | null) {
  statusOffered.value?.options.find(option => option.value === value)?.pick();
}

/** As the item's assignees picker: what was added and removed, in one edit. */
function applyAssignees(change: PickerChange) {
  void editor.edit(props.ids, { kind: 'assignees', add: change.added, remove: change.removed });
}

/** A pull request's close, or a reopen: nothing to choose between, it runs. */
function runState() {
  state.value?.run?.();
  emit('done');
}
</script>

<template>
  <div
    :class="css.rowSwipeActions"
    data-row-swipe-actions
    @click.stop
  >
    <Picker
      v-if="status"
      :open="opened === 'status'"
      :label="t(l.status)"
      :context="reference"
      :options="statusOffered?.options ?? []"
      :selected="getChosen(statusOffered)"
      :note="getNote(statusOffered)"
      @update:open="setOpen('status', $event)"
      @pick="pickStatus"
    >
      <template #trigger>
        <RowSwipeTile
          :icon="CircleDashed"
          tone="quiet"
        >
          {{ t(l.status) }}
        </RowSwipeTile>
      </template>
    </Picker>
    <Picker
      v-if="assignees"
      :open="opened === 'assignees'"
      :label="t(l.assignees)"
      :context="reference"
      :options="assigneesOffered?.options ?? []"
      :selected="getChosen(assigneesOffered)"
      :mixed="getMixed(assigneesOffered)"
      :placeholder="t(l.filterAssignees)"
      :note="getNote(assigneesOffered)"
      multiple
      @update:open="setOpen('assignees', $event)"
      @apply="applyAssignees"
    >
      <template #trigger>
        <RowSwipeTile
          :icon="UserRound"
          tone="blue"
        >
          {{ t(l.assign) }}
        </RowSwipeTile>
      </template>
    </Picker>
    <MenuSheet
      v-if="state && stateOffered"
      :open="opened === 'state'"
      :title="state.title"
      :context="reference"
      @update:open="setOpen('state', $event)"
    >
      <template #trigger>
        <RowSwipeTile
          :icon="CircleCheck"
          tone="violet"
        >
          {{ t(l.close) }}
        </RowSwipeTile>
      </template>
      <MenuItem
        v-for="option in stateOffered.options"
        :key="option.value"
        :icon="option.icon"
        @select="option.pick()"
      >
        {{ option.label }}
      </MenuItem>
    </MenuSheet>
    <RowSwipeTile
      v-else-if="state"
      :icon="closed ? RotateCcw : CircleCheck"
      tone="violet"
      @click="runState"
    >
      {{ closed ? t(l.reopen) : t(l.close) }}
    </RowSwipeTile>
  </div>
</template>

<style lang="scss" module="css">
.rowSwipeActions {
  display: flex;
  align-items: stretch;
}
</style>
