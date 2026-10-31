<!-- An action with a second step, as an entry of an item menu (L1–L4, M1–M2): hovering it, → or Enter opens its options beside it — people with their pictures, labels with their colours, the values set now checked, those only some of the selected items have half-checked. A long list has a filter at the top, and typing goes into it. A quiet line under the options says what is left out ("2 of 3 editable"). Picking one makes it and closes the menu; an action picking several keeps it open. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Check, Info, Loader, Minus, Search } from 'lucide-vue-next';
import { DropdownMenuCheckboxItem, DropdownMenuItem } from 'reka-ui';
import { computed, ref, useTemplateRef, watch } from 'vue';

import Avatar from '@/components/Avatar.vue';
import MenuSub from '@/components/MenuSub.vue';

import { filterCommandOptions } from './buildCommandMenu.js';
import * as l from './CommandSubmenu.loc.js';
import type { Command, CommandOption } from './CommandTypes.js';

const props = defineProps<{
  /** An action with `options`. */
  command: Command;
  /** Open as it is shown: its key opened the menu at it. */
  startOpen?: boolean;
}>();

/** From this many options on, a filter field heads the list. */
const FILTER_FROM = 8;

const t = useTranslate();
const open = ref(props.startOpen);
const query = ref('');
const filterRef = useTemplateRef<HTMLInputElement>('filter');

// What it offers is read only while it is open: a repository's people and labels can be many.
const offered = computed(() => (open.value ? (props.command.options?.() ?? null) : null));
const filtered = computed(() => filterCommandOptions(query.value, offered.value?.options ?? []));
// The chevron says there is more: the command menu's "Assign to…" is "Assign to ›" here.
const title = computed(() => props.command.title.replace(/…$/u, ''));
const filterable = computed(() => (offered.value?.options.length ?? 0) >= FILTER_FROM);

watch(
  open,
  isOpen => {
    query.value = '';
    if (isOpen) {
      props.command.prepare?.();
    }
  },
  { immediate: true },
);

/** A letter typed over the options goes into the filter, not to the menu's jump-to-item. */
function typeIntoFilter(event: KeyboardEvent) {
  const filter = filterRef.value;
  if (!filter || event.target === filter || event.key.length !== 1 || event.metaKey || event.ctrlKey) {
    return;
  }

  event.stopPropagation();
  filter.focus();
}

function pick(event: Event, option: CommandOption) {
  option.pick();
  if (offered.value?.several) {
    event.preventDefault();
  }
}

function isChoice(option: CommandOption) {
  return option.chosen !== undefined || option.mixed !== undefined;
}
</script>

<template>
  <MenuSub
    v-model:open="open"
    :icon="command.icon"
    :detail="command.detail"
    :shortcut="command.key"
  >
    {{ title }}
    <template #content>
      <div
        :class="css.commandSubmenu"
        @keydown.capture="typeIntoFilter"
      >
        <label
          v-if="filterable"
          :class="css.commandSubmenu_filter"
        >
          <Search
            :class="css.commandSubmenu_filterIcon"
            aria-hidden="true"
          />
          <input
            ref="filter"
            v-model="query"
            :class="css.commandSubmenu_filterInput"
            :placeholder="t(l.filter)"
            :aria-label="t(l.filterLabel, { action: command.title })"
          />
        </label>
        <div :class="css.commandSubmenu_options">
          <template
            v-for="option in filtered"
            :key="option.value"
          >
            <component
              :is="isChoice(option) ? DropdownMenuCheckboxItem : DropdownMenuItem"
              :class="css.commandSubmenu_option"
              :model-value="isChoice(option) ? (option.mixed ? 'indeterminate' : option.chosen === true) : undefined"
              :text-value="option.label"
              @select="pick($event, option)"
            >
              <span
                v-if="isChoice(option)"
                :class="[css.commandSubmenu_box, (option.chosen || option.mixed) && css.commandSubmenu_box_on]"
                aria-hidden="true"
              >
                <Check v-if="option.chosen" />
                <Minus v-else-if="option.mixed" />
              </span>
              <component
                :is="option.icon"
                v-if="option.icon"
                :class="css.commandSubmenu_icon"
                aria-hidden="true"
              />
              <span
                v-if="option.color"
                :class="css.commandSubmenu_dot"
                :style="{ background: `#${option.color}` }"
                aria-hidden="true"
              />
              <Avatar
                v-if="option.avatarUrl"
                :name="option.label"
                :src="option.avatarUrl"
                size="xs"
                decorative
              />
              <span :class="css.commandSubmenu_label">{{ option.label }}</span>
              <span
                v-if="option.detail || option.group"
                :class="css.commandSubmenu_detail"
                >{{ [option.group, option.detail].filter(Boolean).join(' · ') }}</span
              >
            </component>
          </template>
          <p
            v-if="offered?.loading && filtered.length === 0"
            :class="css.commandSubmenu_note"
          >
            <Loader
              :class="css.commandSubmenu_noteIcon"
              aria-hidden="true"
            />
            {{ t(l.loading) }}
          </p>
          <p
            v-else-if="filtered.length === 0"
            :class="css.commandSubmenu_note"
          >
            {{ query ? t(l.noMatch) : t(l.nothing) }}
          </p>
        </div>
        <p
          v-if="offered?.note"
          :class="[css.commandSubmenu_note, css.commandSubmenu_note_footer]"
        >
          <Info
            :class="css.commandSubmenu_noteIcon"
            aria-hidden="true"
          />
          {{ offered.note }}
        </p>
      </div>
    </template>
  </MenuSub>
</template>

<style lang="scss" module="css">
.commandSubmenu {
  display: flex;
  flex-direction: column;
}

.commandSubmenu_filter {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-6 $spacing-8;
  margin: (-$spacing-4) (-$spacing-4) $spacing-4;
  border-bottom: 1px solid $color-border-2;
}

.commandSubmenu_filterIcon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-dim;
}

.commandSubmenu_filterInput {
  flex: 1;
  min-width: 0;
  font: inherit;
  color: $color-fg;
  background: none;
  border: none;
  outline: none;

  &::placeholder {
    color: $color-fg-dim;
  }
}

.commandSubmenu_options {
  max-height: 320px;
  overflow-y: auto;
}

.commandSubmenu_option {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-6 $spacing-8;
  cursor: pointer;
  border-radius: $radius-md;
  outline: none;

  &[data-highlighted] {
    background: $color-bg-3;
  }
}

.commandSubmenu_box {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 1px solid $color-border-2;
  border-radius: $radius-sm;

  svg {
    width: 11px;
    height: 11px;
  }
}

.commandSubmenu_box_on {
  color: $color-on-light;
  background: $color-accent;
  border-color: $color-accent;
}

.commandSubmenu_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-2;
}

.commandSubmenu_dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.commandSubmenu_label {
  flex: none;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commandSubmenu_detail {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  white-space: nowrap;
}

.commandSubmenu_note {
  display: flex;
  gap: $spacing-8;
  align-items: flex-start;
  max-width: 280px;
  padding: $spacing-6 $spacing-8;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.commandSubmenu_note_footer {
  padding-top: $spacing-8;
  margin: $spacing-4 (-$spacing-4) 0;
  border-top: 1px solid $color-border-2;
}

.commandSubmenu_noteIcon {
  flex: none;
  width: 13px;
  height: 13px;
  margin-top: 1px;
}
</style>
