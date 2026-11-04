<!-- The keyboard help (`?`): every action that has a key and can run here, by section and, where a screen groups its own, by its groups (CR29) — read from the same registry the keys and the command menu run from, so it never lists a key that does something else: of actions on one key only the one that runs shows. -->
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
  COMMAND_SECTIONS.flatMap(section => {
    const inSection = listed.value.filter(command => command.section === section);
    const groups = new Set(inSection.map(command => command.keyGroup ?? null));
    return [...groups].map(group => ({
      key: `${section}-${group ?? ''}`,
      title: group ?? t(l[section]),
      commands: inSection.filter(command => (command.keyGroup ?? null) === group),
    }));
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
        :key="entry.key"
        :class="css.keyHelp_section"
        :aria-labelledby="`${id}-${entry.key}`"
      >
        <h3
          :id="`${id}-${entry.key}`"
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
