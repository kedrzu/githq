<!-- The keyboard help (`?`): every action that has a key and can run here, by section — read from the same registry the keys and the command menu run from, so it never lists a key that does something else: of actions on one key only the one that runs shows. A screen with more keys than that holds gives its own sheet instead (`sheet`, CR29): columns of rows that speak of a key pair, whatever can run at the moment, and a row of others along the bottom. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { VisuallyHidden } from 'reka-ui';
import { computed, useId } from 'vue';

import Dialog from '@/components/Dialog.vue';
import Kbd from '@/components/Kbd.vue';

import type { Command, CommandKeySheet } from './CommandTypes.js';
import { COMMAND_SECTIONS } from './CommandTypes.js';
import { formatAriaKeyShortcuts } from './formatAriaKeyShortcuts.js';
import * as l from './KeyHelp.loc.js';

const props = defineProps<{
  /** The actions that can run now. */
  commands: readonly Command[];
  /** The screen's own sheet, shown instead of them. */
  sheet?: CommandKeySheet | null;
}>();

const open = defineModel<boolean>('open', { default: false });

const t = useTranslate();
const id = useId();

/** Actions that run by their key, on a key an earlier one has, never get it. Those only listed are their component's own. */
const listed = computed(() => {
  const taken = new Set<string>();
  return COMMAND_SECTIONS.flatMap(section =>
    props.commands.filter(command => {
      if (command.section !== section || command.key === undefined) {
        return false;
      }

      if (!command.run && !command.options) {
        return true;
      }

      const free = !taken.has(command.key);
      taken.add(command.key);
      return free;
    }),
  );
});
const sections = computed(() =>
  COMMAND_SECTIONS.map(section => ({
    section,
    commands: listed.value.filter(command => command.section === section),
  })).filter(({ commands }) => commands.length > 0),
);
</script>

<template>
  <Dialog
    v-if="sheet"
    v-model:open="open"
    :title="sheet.title"
    :width="840"
    bare
    fit-content
  >
    <div
      :class="css.keyHelp_sheet"
      tabindex="0"
      data-layer
    >
      <header :class="css.keyHelp_sheetHead">
        <span
          :class="css.keyHelp_sheetTitle"
          aria-hidden="true"
          >{{ sheet.title }}</span
        >
        <Kbd keys="Escape" />
      </header>
      <div :class="css.keyHelp_columns">
        <section
          v-for="(column, index) in sheet.columns"
          :key="column.title"
          :aria-labelledby="`${id}-${index}`"
        >
          <h3
            :id="`${id}-${index}`"
            :class="css.keyHelp_columnTitle"
          >
            {{ column.title }}
          </h3>
          <dl :class="css.keyHelp_rows">
            <div
              v-for="row in column.rows"
              :key="row.label"
              :class="css.keyHelp_keyRow"
            >
              <dt :class="css.keyHelp_label">{{ row.label }}</dt>
              <dd :class="css.keyHelp_rowKeys">
                <template
                  v-for="key in row.keys"
                  :key="key"
                >
                  <VisuallyHidden>{{ formatAriaKeyShortcuts(key) }}</VisuallyHidden>
                  <Kbd :keys="key" />
                </template>
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <dl :class="css.keyHelp_footer">
        <div
          v-for="row in sheet.footer"
          :key="row.label"
          :class="css.keyHelp_footerRow"
        >
          <dt :class="css.keyHelp_label">{{ row.label }}</dt>
          <dd :class="css.keyHelp_footerKeys">
            <template
              v-for="key in row.keys"
              :key="key"
            >
              <VisuallyHidden>{{ formatAriaKeyShortcuts(key) }}</VisuallyHidden>
              <Kbd :keys="key" />
            </template>
          </dd>
        </div>
      </dl>
    </div>
  </Dialog>
  <Dialog
    v-else
    v-model:open="open"
    :title="t(l.title)"
    :width="560"
  >
    <!-- Focused as it opens (a list to scroll with the keys), not the close button, whose tooltip would take the first Escape. -->
    <div
      :class="css.keyHelp"
      tabindex="0"
      data-layer
    >
      <section
        v-for="entry in sections"
        :key="entry.section"
        :class="css.keyHelp_section"
        :aria-labelledby="`${id}-${entry.section}`"
      >
        <h3
          :id="`${id}-${entry.section}`"
          :class="css.keyHelp_heading"
        >
          {{ t(l[entry.section]) }}
        </h3>
        <dl :class="css.keyHelp_list">
          <div
            v-for="command in entry.commands"
            :key="command.id"
            :class="css.keyHelp_row"
          >
            <dt :class="css.keyHelp_title">{{ command.title }}</dt>
            <dd :class="css.keyHelp_keys">
              <template
                v-for="(key, keyIndex) in [command.key ?? '', ...(command.otherKeys ?? [])]"
                :key="key"
              >
                <span
                  v-if="keyIndex > 0"
                  :class="css.keyHelp_or"
                  aria-hidden="true"
                  >/</span
                >
                <VisuallyHidden>{{ formatAriaKeyShortcuts(key) }}</VisuallyHidden>
                <Kbd
                  v-for="(part, index) in key.split('+')"
                  :key="index"
                  :keys="part"
                />
              </template>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </Dialog>
</template>

<style lang="scss" module="css">
.keyHelp {
  display: flex;
  // Focused only to take the keys (and Escape) off the close button; nothing in it is chosen.
  outline: none;
  flex-direction: column;
  gap: $spacing-16;
}

.keyHelp_heading {
  padding-bottom: $spacing-6;
  font-size: $font-size-xs;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}

.keyHelp_list {
  display: flex;
  flex-direction: column;
  margin: 0;
}

.keyHelp_row {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  font-size: $font-size-md;
  border-bottom: 1px solid $color-border;
}

.keyHelp_or {
  color: $color-fg-dim;
}

.keyHelp_keys {
  display: flex;
  margin: 0;
  gap: $spacing-4;
}

.keyHelp_sheet {
  display: flex;
  flex-direction: column;
  min-height: 0;
  outline: none;
}

.keyHelp_sheetHead {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  justify-content: space-between;
  padding: 14px $spacing-16;
  border-bottom: 1px solid $color-border;
}

.keyHelp_sheetTitle {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.keyHelp_columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 28px;
  padding: $spacing-16 $spacing-16 18px;
  overflow-y: auto;
}

.keyHelp_columnTitle {
  margin: 0 0 9px;
  font-size: $font-size-2xs;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}

.keyHelp_rows {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin: 0;
}

.keyHelp_keyRow,
.keyHelp_footerRow {
  display: flex;
  align-items: center;
}

.keyHelp_keyRow {
  min-height: 16px;
}

.keyHelp_label {
  font-size: $font-size-xs;
  color: $color-fg-2;
}

// A term comes first in the page, for a screen reader; the sheet draws the keys first.
.keyHelp_rowKeys,
.keyHelp_footerKeys {
  display: flex;
  flex: none;
  gap: 3px;
  order: -1;
  margin: 0;
}

.keyHelp_rowKeys {
  width: 78px;
}

.keyHelp_footer {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-6 18px;
  margin: 0;
  padding: $spacing-10 $spacing-16;
  border-top: 1px solid $color-border;
}

.keyHelp_footerKeys {
  margin-right: $spacing-6;
}
</style>
