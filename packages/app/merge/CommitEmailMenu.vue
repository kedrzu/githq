<!-- The merge panel's menu of commit addresses (`Merge / Email menu`, PM48, PM51), opened above the email line by its trigger or by the panel's `Y`: "Commit as", one row per address — GitHub's default marked so, with GitHub's mark, the one the merge resolves to marked with where it comes from — the one in use ticked, the cursor starting on it. `J`/`K` (and the arrows) move, `↵` or a click picks, Esc or a click outside closes with nothing changed. Below, for a tracked repository, the switch "Remember for this repository" (`⇧Y`, or Space on it), off each time it opens. A popover of its own rather than a reka menu: a menu's items can't hold the switch, and the cursor starts on the address in use, not the first. Its keys stay inside (`data-no-commands`), none reaching the panel under it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Check, Github, Mail } from 'lucide-vue-next';
import { computed, ref, useId, watch } from 'vue';

import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Kbd from '@/components/Kbd.vue';
import Popover from '@/components/Popover.vue';
import Switch from '@/components/Switch.vue';

import * as l from './CommitEmailMenu.loc.js';
import type { ResolvedCommitEmail } from './resolveCommitEmail.js';
import { useCommitEmailSource } from './useCommitEmailSource.js';

const props = defineProps<{
  /** The addresses, in the order the menu lists them (`getCommitEmails`). */
  emails: readonly string[];
  /** The address the merge commits with now: ticked, and where the cursor starts. */
  current: string;
  /** GitHub's default commit email (`viewerDefaultCommitEmail`). */
  githubDefault: string;
  /** The address the merge started on and where it comes from; marked with it unless it is GitHub's default. */
  resolved: ResolvedCommitEmail | null;
  /** The repository's owner, as the note of an owner's default names it. */
  owner: string;
  /** The repository is tracked: only then can the pick be remembered as its default. */
  rememberable: boolean;
}>();

const emit = defineEmits<{
  /** `↵` or a click: the address for this merge, and whether to remember it as the repository's default. */
  pick: [email: string, remember: boolean];
  /** Closed, about to give the focus back to the trigger; `preventDefault()` to put it elsewhere. */
  closeAutoFocus: [event: Event];
}>();

defineSlots<{
  /** The trigger: one button, which gets the popover's handlers and ARIA. */
  trigger(): unknown;
}>();

const open = defineModel<boolean>('open', { required: true });

const t = useTranslate();
const sourceNote = useCommitEmailSource();
const headingId = useId();
const rowIdPrefix = useId();
const cursor = ref(0);
const remember = ref(false);

const rows = computed(() =>
  props.emails.map((email, index) => ({
    email,
    id: `${rowIdPrefix}-${index}`,
    github: email === props.githubDefault,
    note: noteOf(email),
  })),
);

// Each opening starts on the address in use, with nothing remembered (PM51).
watch(
  open,
  opened => {
    if (opened) {
      cursor.value = Math.max(0, props.emails.indexOf(props.current));
      remember.value = false;
    }
  },
  { immediate: true },
);

function noteOf(email: string) {
  if (email === props.githubDefault) {
    return sourceNote('github', props.owner);
  }

  const resolved = props.resolved;
  return resolved && resolved.email === email ? sourceNote(resolved.source, props.owner) : null;
}

function pick(index: number) {
  const email = props.emails[index];
  if (email !== undefined) {
    emit('pick', email, props.rememberable && remember.value);
    open.value = false;
  }
}

function move(by: number) {
  cursor.value = Math.min(props.emails.length - 1, Math.max(0, cursor.value + by));
}

function onKeydown(event: KeyboardEvent) {
  // Escape is the popover's: it closes, nothing changed.
  if (event.key === 'Escape' || event.key === 'Tab') {
    return;
  }

  // The switch's Space is its own.
  if (
    matchesCommandKey(event, 'Space') &&
    event.target instanceof Element &&
    event.target.getAttribute('role') === 'switch'
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  if (matchesCommandKey(event, 'J') || matchesCommandKey(event, 'ArrowDown')) {
    move(1);
  } else if (matchesCommandKey(event, 'K') || matchesCommandKey(event, 'ArrowUp')) {
    move(-1);
  } else if (matchesCommandKey(event, 'Enter')) {
    pick(cursor.value);
  } else if (props.rememberable && matchesCommandKey(event, 'Shift+Y')) {
    remember.value = !remember.value;
  }
}
</script>

<template>
  <Popover
    v-model:open="open"
    :label="t(l.commitAs)"
    side="top"
    align="start"
    flush
    @close-auto-focus="emit('closeAutoFocus', $event)"
  >
    <template #trigger>
      <slot name="trigger" />
    </template>
    <div
      :class="css.commitEmailMenu"
      data-no-commands
      @keydown="onKeydown"
    >
      <div
        :id="headingId"
        :class="css.commitEmailMenu_heading"
      >
        {{ t(l.commitAs) }}
      </div>
      <div
        role="menu"
        tabindex="0"
        :class="css.commitEmailMenu_list"
        :aria-labelledby="headingId"
        :aria-activedescendant="rows[cursor]?.id"
      >
        <div
          v-for="(row, index) in rows"
          :id="row.id"
          :key="row.email"
          role="menuitemradio"
          :aria-checked="row.email === current"
          :class="[css.commitEmailMenu_row, index === cursor && css.commitEmailMenu_row_active]"
          @mousemove="cursor = index"
          @click="pick(index)"
        >
          <component
            :is="row.github ? Github : Mail"
            :class="css.commitEmailMenu_icon"
            aria-hidden="true"
          />
          <span :class="css.commitEmailMenu_address">{{ row.email }}</span>
          <span
            v-if="row.note"
            :class="css.commitEmailMenu_note"
            >{{ row.note }}</span
          >
          <Check
            v-if="row.email === current"
            :class="css.commitEmailMenu_check"
            aria-hidden="true"
          />
        </div>
      </div>
      <div
        v-if="rememberable"
        :class="css.commitEmailMenu_footer"
      >
        <Switch
          v-model="remember"
          :label="t(l.remember)"
          aria-keyshortcuts="Shift+Y"
        />
        <span
          :class="css.commitEmailMenu_remember"
          aria-hidden="true"
          >{{ t(l.remember) }}</span
        >
        <Kbd
          keys="Shift+Y"
          size="sm"
        />
      </div>
    </div>
  </Popover>
</template>

<style lang="scss" module="css">
.commitEmailMenu {
  display: flex;
  flex-direction: column;
  min-width: 300px;
  padding: $spacing-4;
}

.commitEmailMenu_heading {
  padding: $spacing-6 $spacing-8;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

// The cursor's row is the focus indicator (`aria-activedescendant`), as in reka's menus.
.commitEmailMenu_list {
  display: flex;
  flex-direction: column;
  outline: none;
}

.commitEmailMenu_row {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
  padding: $spacing-6 $spacing-8;
  font-size: $font-size-sm;
  white-space: nowrap;
  cursor: pointer;
  border-radius: $radius-md;
}

.commitEmailMenu_row_active {
  background: $color-bg-3;
}

.commitEmailMenu_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-2;
}

.commitEmailMenu_address {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg;
}

.commitEmailMenu_note {
  flex: 1;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.commitEmailMenu_check {
  flex: none;
  width: 14px;
  height: 14px;
  margin-left: auto;
  color: $color-accent;
}

.commitEmailMenu_footer {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-8;
  margin-top: $spacing-4;
  border-top: 1px solid $color-border;
}

.commitEmailMenu_remember {
  font-size: $font-size-sm;
  color: $color-fg-2;
}
</style>
