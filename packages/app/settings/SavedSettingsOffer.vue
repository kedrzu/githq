<!-- Settings saved to GitHub found on the first sign-in (settings-sync D3, G11), in place of choosing what to track: where they are, how many repositories and projects they track and their names, and the choice — "Load these" (`⌘↵`) or "No, I'll choose here". On a phone (`PhoneLayout.active`, mobile MB134) one column, each repository's owner dimmed before its name, the two answers across the screen at its bottom, where the thumb is, pinned under the note while the list scrolls. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { BookMarked, Lock, SquareKanban } from 'lucide-vue-next';
import { computed, ref, useId } from 'vue';

import { bindCommand } from '@/commands/bindCommand.js';
import { loadSavedSettings } from '@/commands/definitions/index.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { keyOf } from '@/commands/keyOf.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import * as l from './SavedSettingsOffer.loc.js';
import type { SettingsDocument } from './sync/SettingsDocument.js';

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
const phone = useService(PhoneLayout);
const titleId = useId();
const loading = ref(false);

const repositories = computed(() => props.document.repositories.filter(repository => repository.tracking));
const projects = computed(() => props.document.projects.filter(project => project.tracking));

useCommands(() => [
  bindCommand(loadSavedSettings, { section: 'view', menu: false, once: true, run: () => void loadOnce() }, t),
]);

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
    :class="[css.savedSettingsOffer, phone.active && css.savedSettingsOffer_phone]"
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
            <span v-if="phone.active"
              ><span :class="css.savedSettingsOffer_owner">{{ parseRepositoryName(saved.nameWithOwner).owner }}/</span
              ><span :class="css.savedSettingsOffer_name">{{
                parseRepositoryName(saved.nameWithOwner).name
              }}</span></span
            >
            <template v-else>{{ saved.nameWithOwner }}</template>
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
    <div :class="css.savedSettingsOffer_foot">
      <p :class="css.savedSettingsOffer_note">{{ t(l.note) }}</p>
      <div :class="css.savedSettingsOffer_actions">
        <Button
          variant="primary"
          :size="phone.active ? 'lg' : undefined"
          :kbd="keyOf(loadSavedSettings)"
          :keyshortcuts="formatAriaKeyShortcuts(keyOf(loadSavedSettings))"
          :busy="loading"
          @click="loadOnce"
        >
          {{ t(l.load) }}
        </Button>
        <Button
          :size="phone.active ? 'lg' : undefined"
          :disabled="loading"
          @click="emit('decline')"
        >
          {{ t(l.decline) }}
        </Button>
      </div>
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

// The note and the answers: on the computer they sit in the column like the rest.
.savedSettingsOffer_foot {
  display: contents;
}

.savedSettingsOffer_owner {
  color: $color-fg-dim;
}

.savedSettingsOffer_name {
  font-weight: $font-weight-medium;
}

// A phone (MB134): from the top, the list in one column, the answers pinned at the bottom.
.savedSettingsOffer_phone {
  justify-content: flex-start;
  width: auto;
  max-width: none;
  margin: 0;
  padding: 20px 0 0;

  .savedSettingsOffer_title,
  .savedSettingsOffer_detail {
    padding: 0 $spacing-16;
  }

  .savedSettingsOffer_title {
    font-size: 22px;
  }

  .savedSettingsOffer_detail {
    font-size: $font-size-md;
  }

  .savedSettingsOffer_saved {
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 0 $spacing-16;
    border: none;
  }

  .savedSettingsOffer_list {
    gap: $spacing-2;
  }

  .savedSettingsOffer_entry {
    min-height: 32px;
    font-size: $font-size-lg;
  }

  .savedSettingsOffer_foot {
    position: sticky;
    bottom: 0;
    display: flex;
    flex-direction: column;
    gap: $spacing-10;
    padding: $spacing-12 $spacing-16 calc(#{$spacing-12} + #{$phone-home-indicator-room});
    margin-top: auto;
    background: $color-bg-2;
    border-top: 1px solid $color-border;
  }

  .savedSettingsOffer_note {
    font-size: $font-size-xs;
  }

  .savedSettingsOffer_actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
