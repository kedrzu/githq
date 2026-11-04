<!-- The Changelog section of Settings, wired to GitHub through `ChangelogStore`, in the desktop app only (`SettingsPage.vue`): opening it is what reads, and opening it again after a failure reads again. What it shows is worked out here, from what was read and which build runs (`buildChangelog.ts`, desktop releases D17). -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, watch } from 'vue';

import { AppUpdate } from '@/services/AppUpdate.js';
import { Browser } from '@/services/Browser.js';

import { buildChangelog, getCommitsUrl } from './buildChangelog.js';
import { ChangelogStore } from './ChangelogStore.js';
import ChangelogView from './ChangelogView.vue';
import type { ChangelogContent } from './ChangelogView.vue';

const update = useService(AppUpdate);
const changelog = useService(ChangelogStore);
const browser = useService(Browser);

// Before the native side's first answer the build isn't known yet.
watch(
  () => update.state,
  (state, before) => {
    if (state && !before) {
      changelog.open(state);
    }
  },
  { immediate: true },
);

const content = computed((): ChangelogContent => {
  const { read } = changelog;
  if (read.kind !== 'loaded') {
    return { kind: read.kind === 'idle' ? 'loading' : read.kind };
  }

  const version = update.state?.version ?? '';
  const versions = buildChangelog({ ...read.answer, version, previousVersion: update.previousVersion });
  return versions.length > 0
    ? { kind: 'versions', versions }
    : // Before the first Stable the builds are numbered after it (D4).
      { kind: 'none', firstVersion: version.split('-', 1).join('') };
});

const commitsUrl = computed(() => (update.state ? getCommitsUrl(update.state.version, update.state.commit) : null));
</script>

<template>
  <ChangelogView
    v-if="update.state"
    :content="content"
    :commits-url="commitsUrl"
    @open-on-git-hub="browser.openInNewTab($event)"
  />
</template>
