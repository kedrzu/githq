<!-- A draft issue of a project, opened (D4): its title, its body as written, its assignees and the project's fields of it. Read-only in this version — the body is shown as the markdown it was written in; editing a draft, and turning it into an issue, happen on GitHub for now. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowUpRight } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import Dialog from '@/components/Dialog.vue';

import { describeProjectFieldValue } from './describeProjectFieldValue.js';
import * as l from './ProjectDraftDialog.loc.js';
import type { Project, ProjectItem } from './ProjectTypes.js';

const props = defineProps<{
  project: Project;
  /** The draft's project item; the dialog is open while there is one. */
  item: ProjectItem | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const t = useTranslate();

const open = computed({
  get: () => props.item !== null,
  set: value => {
    if (!value) {
      emit('close');
    }
  },
});
const values = computed(() =>
  props.project.fields.flatMap(field => {
    const value = props.item?.values[field.id];
    const text = value ? describeProjectFieldValue(value) : null;
    return text ? [{ field: field.name, text }] : [];
  }),
);
</script>

<template>
  <Dialog
    v-model:open="open"
    :title="item?.draft?.title ?? ''"
    :description="t(l.description, { project: project.title })"
    :width="640"
  >
    <dl
      v-if="item"
      :class="css.projectDraftDialog_fields"
    >
      <template v-if="(item.draft?.assignees.length ?? 0) > 0">
        <dt>{{ t(l.assignees) }}</dt>
        <dd :class="css.projectDraftDialog_people">
          <span
            v-for="person in item.draft?.assignees ?? []"
            :key="person.login"
            :class="css.projectDraftDialog_person"
          >
            <Avatar
              :name="person.login"
              :src="person.avatarUrl"
              size="xs"
              decorative
            />
            {{ person.login }}
          </span>
        </dd>
      </template>
      <template
        v-for="value in values"
        :key="value.field"
      >
        <dt>{{ value.field }}</dt>
        <dd>{{ value.text }}</dd>
      </template>
    </dl>
    <p
      v-if="item?.draft?.body"
      :class="css.projectDraftDialog_body"
    >
      {{ item.draft.body }}
    </p>
    <p
      v-else
      :class="css.projectDraftDialog_noBody"
    >
      {{ t(l.noBody) }}
    </p>
    <template #footer>
      <span :class="css.projectDraftDialog_note">{{ t(l.readOnly) }}</span>
      <Button
        variant="ghost"
        size="sm"
        :icon="ArrowUpRight"
        :link="project.url"
        target="_blank"
      >
        {{ t(l.openProject) }}
      </Button>
    </template>
  </Dialog>
</template>

<style lang="scss" module="css">
.projectDraftDialog_fields {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: $spacing-8 $spacing-16;
  margin: 0 0 $spacing-16;
  font-size: $font-size-sm;

  dt {
    color: $color-fg-dim;
  }

  dd {
    margin: 0;
    color: $color-fg;
  }
}

.projectDraftDialog_people {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-10;
}

.projectDraftDialog_person {
  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
}

.projectDraftDialog_body {
  font-size: $font-size-md;
  line-height: $line-height-normal;
  color: $color-fg-2;
  white-space: pre-wrap;
}

.projectDraftDialog_noBody {
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.projectDraftDialog_note {
  flex: 1;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}
</style>
