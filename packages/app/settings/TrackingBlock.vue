<!-- The Tracking section of a repository's or a project's settings (T16, T17): that it is tracked, how it stands (`TrackedRowNote.vue`: synced how long ago, downloading, not shown to githq or refused) and how many of its open items this browser holds; and Untrack, the same as on its row in Repositories or Projects (T20). On a phone (`phone`, mobile MB152, MB155) a group of rows — how many of its open items this phone holds, then "Stop tracking" the width of the column, saying under it what it deletes and that Undo brings it back (MB153). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { Check, HardDrive, LoaderCircle, TriangleAlert } from 'lucide-vue-next';
import { computed } from 'vue';

import Button from '@/components/Button.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import TrackedRowNote from '@/tracking/TrackedRowNote.vue';
import type { TrackedStatus } from '@/tracking/TrackingTypes.js';

import PhoneSettingsGroup from './PhoneSettingsGroup.vue';
import PhoneSettingsRow from './PhoneSettingsRow.vue';
import SettingsBlock from './SettingsBlock.vue';
import * as l from './TrackingBlock.loc.js';

const props = defineProps<{
  /** What is tracked, and so the section's words. */
  kind: 'repository' | 'project';
  status: TrackedStatus;
  /** What "synced 14s ago" is counted from. */
  now: number;
  /** Its open items in the local copy (`TrackedItems.getOpenCount`). */
  openCount: number;
  /** On a phone: a group of rows, Stop tracking the column's width. */
  phone?: boolean;
  /** What it is called, for a phone's note under Stop tracking: `owner/name`, a project's title. */
  name: string;
}>();

const emit = defineEmits<{
  untrack: [];
}>();

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);

const icon = computed(() => {
  switch (props.status.kind) {
    case 'downloading':
      return LoaderCircle;
    case 'hidden':
    case 'refused':
      return TriangleAlert;
    case 'read':
      return Check;
    default:
      return assertNever(props.status);
  }
});
</script>

<template>
  <PhoneSettingsGroup
    v-if="phone"
    :title="t(l.title)"
  >
    <PhoneSettingsRow
      :icon="HardDrive"
      :label="t(l.onThisPhone)"
      :value="t(l.openItemsPhone, { count: openCount, formatted: numbers.format(openCount) })"
    />
    <div :class="css.trackingBlock_phoneStop">
      <Button
        variant="danger"
        size="lg"
        :class="css.trackingBlock_phoneButton"
        @click="emit('untrack')"
      >
        {{ t(l.stopTracking) }}
      </Button>
      <p :class="css.trackingBlock_phoneNote">
        {{ t(kind === 'project' ? l.projectStopNote : l.repositoryStopNote, { name }) }}
      </p>
    </div>
  </PhoneSettingsGroup>
  <SettingsBlock
    v-else
    :title="t(l.title)"
    :description="t(kind === 'project' ? l.projectDescription : l.repositoryDescription)"
  >
    <div :class="css.trackingBlock">
      <p :class="css.trackingBlock_state">
        <component
          :is="icon"
          :class="[css.trackingBlock_icon, css[`trackingBlock_icon_${status.kind}`]]"
          aria-hidden="true"
        />
        <span :class="css.trackingBlock_tracked">{{ t(l.tracked) }}</span>
        <span :class="css.trackingBlock_note">
          <TrackedRowNote
            :status="status"
            :now="now"
          />
          · {{ t(l.openItems, { count: openCount, formatted: numbers.format(openCount) }) }}
        </span>
      </p>
      <div :class="css.trackingBlock_action">
        <Button
          variant="secondary"
          @click="emit('untrack')"
        >
          {{ t(l.untrack) }}
        </Button>
        <span :class="css.trackingBlock_note">
          {{ t(kind === 'project' ? l.projectUntrackNote : l.repositoryUntrackNote) }}
        </span>
      </div>
    </div>
  </SettingsBlock>
</template>

<style lang="scss" module="css">
.trackingBlock_phoneStop {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  padding: $spacing-8 $spacing-16 0;
}

.trackingBlock_phoneButton {
  width: 100%;
}

.trackingBlock_phoneNote {
  font-size: $font-size-md;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}

.trackingBlock {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.trackingBlock_state,
.trackingBlock_action {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8;
  align-items: center;
}

.trackingBlock_action {
  gap: 10px;
}

.trackingBlock_icon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-dim;
}

.trackingBlock_icon_read {
  color: $color-green;
}

.trackingBlock_icon_hidden,
.trackingBlock_icon_refused {
  color: $color-amber;
}

.trackingBlock_tracked {
  font-size: $font-size-md;
}

.trackingBlock_note {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}
</style>
