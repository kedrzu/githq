<!-- Why saving isn't offered on the first sign-in (settings-sync G13, G14), in one line where the choice would be: the saved settings were declined (G11), or the settings repository can't be used, in the words of T8. Nothing was written; Settings takes it from there. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Info, TriangleAlert } from 'lucide-vue-next';
import { computed } from 'vue';

import * as l from './SavedSettingsNotLoaded.loc.js';
import type { StoppedReason } from './sync/SettingsSaving.js';

const props = defineProps<{
  /** Why the settings repository can't be used; `null`: the user declined the settings found in it. */
  reason: StoppedReason | null;
  /** The settings repository, `owner/githq-settings`. */
  repository: string;
}>();

const t = useTranslate();

const sentence = computed(() => {
  const { reason, repository } = props;
  if (!reason) {
    return t(l.declined);
  }

  switch (reason.kind) {
    case 'deleted':
      return t(l.deleted, { repository });
    case 'foreign':
      return t(l.foreign);
    case 'public':
      return t(l.public, { repository });
    case 'unreadable':
      return t(l.unreadable);
    case 'newer':
      return t(l.newer);
    case 'refused':
      return t(l.refused, { message: reason.message });
    default:
      return assertNever(reason);
  }
});
</script>

<template>
  <p :class="css.savedSettingsNotLoaded">
    <TriangleAlert
      v-if="reason"
      :class="[css.savedSettingsNotLoaded_icon, css.savedSettingsNotLoaded_icon_warning]"
      aria-hidden="true"
    />
    <Info
      v-else
      :class="css.savedSettingsNotLoaded_icon"
      aria-hidden="true"
    />
    {{ sentence }}
  </p>
</template>

<style lang="scss" module="css">
.savedSettingsNotLoaded {
  display: flex;
  gap: 10px;
  align-items: baseline;
  font-size: $font-size-sm;
  line-height: 1.5;
  color: $color-fg-2;
}

.savedSettingsNotLoaded_icon {
  position: relative;
  top: 2px;
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.savedSettingsNotLoaded_icon_warning {
  color: $color-amber;
}
</style>
