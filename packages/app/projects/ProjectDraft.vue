<!-- A draft issue of a project as its row or card shows it (D4, D5): no repository or number, a "Draft" marker in their place, its title, its assignees and the values of the fields the view shows. One still on its way to GitHub says so. The list draws the row or card, its selection and its handlers. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Check, FilePen } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import type { ProjectField } from '@/store/ItemDetailTypes.js';

import * as l from './ProjectDraft.loc.js';
import ProjectEntryFields from './ProjectEntryFields.vue';
import type { ProjectItem } from './ProjectTypes.js';

const props = withDefaults(
  defineProps<{
    item: ProjectItem;
    /** The fields its values are shown of. */
    fields: readonly ProjectField[];
    layout: 'card' | 'row';
    /** Show its assignees. */
    people?: boolean;
    /** In the selection several items are edited together in (`x`). */
    checked?: boolean;
  }>(),
  { people: true, checked: false },
);

const t = useTranslate();
const pending = computed(() => props.item.itemId.startsWith('pending:'));
</script>

<template>
  <div :class="[css.projectDraft, css[`projectDraft_${layout}`]]">
    <Check
      v-if="checked"
      :class="css.projectDraft_check"
      role="img"
      :aria-label="t(l.inSelection)"
    />
    <FilePen
      v-else
      :class="css.projectDraft_icon"
      role="img"
      :aria-label="t(l.draftIssue)"
    />
    <span
      v-if="layout === 'card'"
      :class="css.projectDraft_marker"
      >{{ t(l.draft) }}</span
    >
    <span :class="css.projectDraft_title">{{ item.draft?.title }}</span>
    <span :class="css.projectDraft_people">
      <template v-if="people">
        <Avatar
          v-for="person in item.draft?.assignees ?? []"
          :key="person.login"
          :name="person.login"
          :src="person.avatarUrl"
          size="xs"
        />
      </template>
    </span>
    <div :class="css.projectDraft_meta">
      <span
        v-if="layout === 'row'"
        :class="css.projectDraft_marker"
        >{{ t(l.draft) }}</span
      >
      <span
        v-if="pending"
        :class="css.projectDraft_pending"
        >{{ t(l.adding) }}</span
      >
      <ProjectEntryFields
        :items="[item]"
        :fields="fields"
      />
    </div>
  </div>
</template>

<style lang="scss" module="css">
// A row: the icon, then the title and the people, the marker and the values under them. A card: the icon, the
// marker and the people, the title under them, then the values.
.projectDraft {
  display: grid;
  gap: 5px $spacing-10;
  align-items: center;
  font-size: $font-size-2xs;
  line-height: 16px;
}

.projectDraft_row {
  grid-template-areas:
    'icon title people'
    '. meta meta';
  grid-template-columns: 15px minmax(0, 1fr) auto;
  padding: 7px $spacing-16;
}

.projectDraft_card {
  grid-template-areas:
    'icon marker people'
    'title title title'
    'meta meta meta';
  grid-template-columns: 15px minmax(0, 1fr) auto;
  gap: $spacing-8;
  padding: $spacing-10 $spacing-12;
}

.projectDraft_icon,
.projectDraft_check {
  grid-area: icon;
  width: 15px;
  height: 15px;
  color: $color-fg-dim;
}

.projectDraft_check {
  padding: 2px;
  color: $color-on-light;
  background: $color-accent;
  border-radius: $radius-sm;
}

.projectDraft_marker {
  font-family: $font-family-mono;
  color: $color-fg-dim;

  .projectDraft_card & {
    grid-area: marker;
  }
}

.projectDraft_title {
  grid-area: title;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13.5px;
  font-weight: $font-weight-medium;
  line-height: 18px;
  color: $color-fg;
  white-space: nowrap;

  .projectDraft_card & {
    white-space: normal;
  }
}

.projectDraft_people {
  display: inline-flex;
  grid-area: people;
  gap: 2px;
}

.projectDraft_meta {
  display: flex;
  grid-area: meta;
  flex-wrap: wrap;
  gap: $spacing-10;
  align-items: center;

  &:empty {
    display: none;
  }
}

.projectDraft_pending {
  color: $color-fg-dim;
}
</style>
