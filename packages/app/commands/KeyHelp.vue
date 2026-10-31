<!-- The keyboard help (`?`): every action that has a key and can run here, by section — read from the same registry the keys and the command menu run from, so it never lists a key that does something else. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { VisuallyHidden } from 'reka-ui';
import { computed, useId } from 'vue';

import Dialog from '@/components/Dialog.vue';
import Kbd from '@/components/Kbd.vue';

import type { Command } from './CommandTypes.js';
import { COMMAND_SECTIONS } from './CommandTypes.js';
import { formatAriaKeyShortcuts } from './formatAriaKeyShortcuts.js';
import * as l from './KeyHelp.loc.js';

const props = defineProps<{
  /** The actions that can run now. */
  commands: readonly Command[];
}>();

const open = defineModel<boolean>('open', { default: false });

const t = useTranslate();
const id = useId();

const sections = computed(() =>
  COMMAND_SECTIONS.flatMap(section => {
    const keyed = props.commands.filter(command => command.section === section && command.key !== undefined);
    return keyed.length === 0 ? [] : [{ section, title: t(l[section]), commands: keyed }];
  }),
);
</script>

<template>
  <Dialog
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
          {{ entry.title }}
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
</style>
