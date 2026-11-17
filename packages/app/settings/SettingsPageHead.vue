<!-- The head of a repository's or a project's settings (`Settings / Repository head`, T16, T17): "← Repositories › [icon] fitloop/webapp  private · tracked", and "Esc Back" at the end. The arrow and the section's name go back, and so does Escape (`back`, run by the registry) — unless it is someone else's: typed into a field, or closing a picker, a menu or the command menu. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowLeft, ChevronRight } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';

import { bindCommand } from '@/commands/bindCommand.js';
import { back } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import { useCommands } from '@/commands/useCommands.js';
import Kbd from '@/components/Kbd.vue';

import * as l from './SettingsPageHead.loc.js';

const props = defineProps<{
  /** The section of Settings it belongs to ("Repositories"). */
  parent: string;
  /** What it is (a lock for a private repository). */
  icon: LucideIcon;
  /** Its name (`owner/name`, a project's title). */
  title: string;
  /** What is said of it after its name ("private · tracked"). */
  meta: string;
}>();

const emit = defineEmits<{
  /** The arrow, the section's name or Escape. */
  back: [];
}>();

const t = useTranslate();

useCommands(() => [
  bindCommand(
    back,
    {
      place: 'settings',
      title: t(l.backTo, { parent: props.parent }),
      section: 'view',
      menu: false,
      run: () => emit('back'),
    },
    t,
  ),
]);
</script>

<template>
  <header :class="css.settingsPageHead">
    <button
      type="button"
      :class="css.settingsPageHead_back"
      :aria-keyshortcuts="keyOf(back)"
      @click="emit('back')"
    >
      <ArrowLeft
        :class="css.settingsPageHead_arrow"
        aria-hidden="true"
      />
      {{ parent }}
    </button>
    <ChevronRight
      :class="css.settingsPageHead_separator"
      aria-hidden="true"
    />
    <component
      :is="icon"
      :class="css.settingsPageHead_icon"
      aria-hidden="true"
    />
    <h2 :class="css.settingsPageHead_title">{{ title }}</h2>
    <span :class="css.settingsPageHead_meta">{{ meta }}</span>
    <span
      :class="css.settingsPageHead_hint"
      aria-hidden="true"
    >
      <Kbd :keys="keyOf(back)" />{{ t(l.back) }}
    </span>
  </header>
</template>

<style lang="scss" module="css">
.settingsPageHead {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
  padding-bottom: 20px;
}

.settingsPageHead_back {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  padding: 0;
  font-size: $font-size-md;
  color: $color-fg-dim;
  cursor: pointer;
  background: none;
  border: none;

  &:hover {
    color: $color-fg;
  }
}

.settingsPageHead_arrow,
.settingsPageHead_icon {
  flex: none;
  width: 14px;
  height: 14px;
}

.settingsPageHead_separator {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-dim;
}

.settingsPageHead_icon {
  color: $color-fg-2;
}

.settingsPageHead_title {
  overflow: hidden;
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settingsPageHead_meta {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.settingsPageHead_hint {
  display: flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  margin-left: auto;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}
</style>
