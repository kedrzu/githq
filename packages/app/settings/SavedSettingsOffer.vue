<!-- Settings saved to GitHub found on the first sign-in (settings-sync D3, G11), in place of choosing what to track: where they are, how many repositories and projects they track and their names, and the choice — "Load these" (`⌘↵`) or "No, I'll choose here". -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { BookMarked, Lock, SquareKanban } from 'lucide-vue-next';
import { computed, ref, useId } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Button from '@/components/Button.vue';

import * as l from './SavedSettingsOffer.loc.js';
import type { SettingsDocument } from './sync/SettingsDocument.js';

/** The key of "Load these". */
const LOAD_KEY = 'Mod+Enter';

const props = defineProps<{
  /** The settings repository, `owner/githq-settings`. */
  repository: string;
  document: SettingsDocument;
  /** The repositories known to be private (`owner/name`), drawn with a lock. */
  privateRepositories: ReadonlySet<string>;
  /** "Load these": loads the settings and turns saving on; busy until it settles. */
  load: () => Promise<unknown>;
}>();

const emit = defineEmits<{
  /** "No, I'll choose here". */
  decline: [];
}>();

const t = useTranslate();
const titleId = useId();
const loading = ref(false);

const repositories = computed(() => props.document.repositories.filter(repository => repository.tracking));
const projects = computed(() => props.document.projects.filter(project => project.tracking));

onWindowEvent('keydown', event => {
  if (!event.defaultPrevented && matchesCommandKey(event, LOAD_KEY)) {
    event.preventDefault();
    void loadOnce();
  }
});

async function loadOnce() {
  if (loading.value) {
    return;
  }

  loading.value = true;
  try {
    await props.load();
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section
    :class="css.savedSettingsOffer"
    :aria-labelledby="titleId"
  >
    <h1
      :id="titleId"
      :class="css.savedSettingsOffer_title"
    >
      {{ t(l.title) }}
    </h1>
    <p :class="css.savedSettingsOffer_detail">{{ t(l.detail, { repository }) }}</p>
    <div :class="css.savedSettingsOffer_saved">
      <section
        v-if="repositories.length > 0"
        :class="css.savedSettingsOffer_column"
      >
        <h2 :class="css.savedSettingsOffer_heading">{{ t(l.repositories, { count: repositories.length }) }}</h2>
        <ul :class="css.savedSettingsOffer_list">
          <li
            v-for="saved in repositories"
            :key="saved.nameWithOwner"
            :class="css.savedSettingsOffer_entry"
          >
            <component
              :is="privateRepositories.has(saved.nameWithOwner) ? Lock : BookMarked"
              :class="css.savedSettingsOffer_icon"
              aria-hidden="true"
            />
            {{ saved.nameWithOwner }}
          </li>
        </ul>
      </section>
      <section
        v-if="projects.length > 0"
        :class="css.savedSettingsOffer_column"
      >
        <h2 :class="css.savedSettingsOffer_heading">{{ t(l.projects, { count: projects.length }) }}</h2>
        <ul :class="css.savedSettingsOffer_list">
          <li
            v-for="saved in projects"
            :key="saved.id"
            :class="css.savedSettingsOffer_entry"
          >
            <SquareKanban
              :class="css.savedSettingsOffer_icon"
              aria-hidden="true"
            />
            {{ saved.title }}
          </li>
        </ul>
      </section>
      <p
        v-if="repositories.length === 0 && projects.length === 0"
        :class="css.savedSettingsOffer_nothing"
      >
        {{ t(l.nothing) }}
      </p>
    </div>
    <p :class="css.savedSettingsOffer_note">{{ t(l.note) }}</p>
    <div :class="css.savedSettingsOffer_actions">
      <Button
        variant="primary"
        :kbd="LOAD_KEY"
        :aria-keyshortcuts="formatAriaKeyShortcuts(LOAD_KEY)"
        :busy="loading"
        @click="loadOnce"
      >
        {{ t(l.load) }}
      </Button>
      <Button
        :disabled="loading"
        @click="emit('decline')"
      >
        {{ t(l.decline) }}
      </Button>
    </div>
  </section>
</template>

<style lang="scss" module="css">
.savedSettingsOffer {
  display: flex;
  flex-direction: column;
  gap: $spacing-16;
  justify-content: center;
  width: 640px;
  max-width: calc(100% - 48px);
  min-height: 100%;
  margin: 0 auto;
  padding: 80px 0;
}

.savedSettingsOffer_title {
  font-size: 22px;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.savedSettingsOffer_detail {
  margin-top: -$spacing-6;
  font-size: $font-size-lg;
  line-height: 21px;
  color: $color-fg-2;
}

.savedSettingsOffer_saved {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-16;
  padding: 14px $spacing-16;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
}

.savedSettingsOffer_column {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  min-width: 0;
}

.savedSettingsOffer_heading {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $color-fg-2;
}

.savedSettingsOffer_list {
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
  flex-direction: column;
  gap: $spacing-6;
}

.savedSettingsOffer_entry {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
  font-size: $font-size-md;
  color: $color-fg;
}

.savedSettingsOffer_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.savedSettingsOffer_nothing {
  grid-column: 1 / -1;
  font-size: $font-size-md;
  color: $color-fg-2;
}

.savedSettingsOffer_note {
  font-size: $font-size-sm;
  line-height: 1.5;
  color: $color-fg-dim;
}

.savedSettingsOffer_actions {
  display: flex;
  gap: $spacing-10;
}
</style>
