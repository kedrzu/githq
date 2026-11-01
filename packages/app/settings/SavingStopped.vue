<!-- Syncing the settings stopped (settings-sync D12, T7, T8), in Settings and on the first sign-in: why, in plain words, that githq goes on from what this device has, "Try again" (`R`), and where the fix is on GitHub the way straight to it — for a newer githq, Reload. -->
<script lang="ts" setup>
import { SETTINGS_FILE_PATH } from '@githq/github/settings/readSettingsFile.js';
import { SETTINGS_REPOSITORY_NAME } from '@githq/github/settings/getSettingsRepository.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowUpRight, RefreshCw, TriangleAlert } from 'lucide-vue-next';
import { computed, ref, useId } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';

import type { StoppedReason } from './sync/SettingsSaving.js';
import * as l from './SavingStopped.loc.js';

/** The key of "Try again". */
const RETRY_KEY = 'R';

const props = defineProps<{
  reason: StoppedReason;
  /** The signed-in user's login: the settings repository's owner. */
  login: string;
  /** Tries again; the button is busy until it settles. */
  retry: () => Promise<unknown>;
}>();

const emit = defineEmits<{
  /** The file comes from a newer githq: load this page again. */
  reload: [];
}>();

const t = useTranslate();
const titleId = useId();
const retrying = ref(false);

const repository = computed(() => `${props.login}/${SETTINGS_REPOSITORY_NAME}`);
const repositoryUrl = computed(() => `https://github.com/${repository.value}`);

const sentence = computed(() => {
  const { reason } = props;
  switch (reason.kind) {
    case 'deleted':
      return t(l.deleted, { repository: repository.value });
    case 'foreign':
      return t(l.foreign);
    case 'public':
      return t(l.public, { repository: repository.value });
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

// Where the fix is on GitHub, the page it is on; none where there is nothing to open (T8).
const link = computed(() => {
  switch (props.reason.kind) {
    case 'foreign':
      return { label: t(l.openRepository), url: repositoryUrl.value };
    case 'public':
      return { label: t(l.openSettings), url: `${repositoryUrl.value}/settings` };
    case 'unreadable':
      return { label: t(l.openFile), url: `${repositoryUrl.value}/blob/HEAD/${SETTINGS_FILE_PATH}` };
    default:
      return null;
  }
});

useCommands(() => [
  {
    id: 'settings.saving.retry',
    title: t(l.tryAgain),
    section: 'view',
    key: RETRY_KEY,
    run: () => void tryAgain(),
  },
]);

async function tryAgain() {
  if (retrying.value) {
    return;
  }

  retrying.value = true;
  try {
    await props.retry();
  } finally {
    retrying.value = false;
  }
}
</script>

<template>
  <section
    :class="css.savingStopped"
    :aria-labelledby="titleId"
  >
    <h2
      :id="titleId"
      :class="css.savingStopped_title"
    >
      <TriangleAlert
        :class="css.savingStopped_icon"
        aria-hidden="true"
      />
      {{ t(l.title) }}
    </h2>
    <p :class="css.savingStopped_reason">{{ sentence }}</p>
    <p :class="css.savingStopped_keeps">{{ t(l.keepsWorking) }}</p>
    <div :class="css.savingStopped_actions">
      <Button
        :icon="RefreshCw"
        :kbd="RETRY_KEY"
        :aria-keyshortcuts="RETRY_KEY"
        :busy="retrying"
        @click="tryAgain"
      >
        {{ t(l.tryAgain) }}
      </Button>
      <Button
        v-if="link"
        :icon="ArrowUpRight"
        :link="link.url"
        target="_blank"
      >
        {{ link.label }}
      </Button>
      <Button
        v-else-if="reason.kind === 'newer'"
        :icon="ArrowUpRight"
        @click="emit('reload')"
      >
        {{ t(l.reload) }}
      </Button>
    </div>
  </section>
</template>

<style lang="scss" module="css">
.savingStopped {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding: 14px $spacing-16;
  background: rgba($color-amber, 0.05);
  border: 1px solid rgba($color-amber, 0.25);
  border-radius: $radius-lg;
}

.savingStopped_title {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  font-size: 13.5px;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.savingStopped_icon {
  flex: none;
  width: 15px;
  height: 15px;
  color: $color-amber;
}

.savingStopped_reason {
  font-size: $font-size-md;
  line-height: 1.5;
  color: $color-fg;
}

.savingStopped_keeps {
  font-size: $font-size-sm;
  line-height: 1.5;
  color: $color-fg-2;
}

.savingStopped_actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8;
  align-items: center;
  padding-top: $spacing-2;
}
</style>
