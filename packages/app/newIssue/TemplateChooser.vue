<!-- A repository's issue templates offered before the body (H7): markdown templates fill the title, body and what they set; an issue form becomes a pre-filled body where the user can push (H8), and continues on GitHub's own form where they can't (D14) — GitHub applies its labels and checks its fields only there. "Blank issue" is last, or says the repository turned it off. ↑/↓ and Enter; Escape goes back. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ExternalLink, FileText } from 'lucide-vue-next';
import type { AcceptableValue } from 'reka-ui';
import { computed } from 'vue';

import FilterList from '@/components/FilterList.vue';
import type { FilterListGroup, FilterListRow } from '@/components/FilterList.vue';
import Kbd from '@/components/Kbd.vue';

import type { IssueTemplate } from './IssueTemplateStore.js';
import * as l from './TemplateChooser.loc.js';

/** A line of the list: a template, or "Blank issue" (`template: null`). */
interface TemplateRow extends FilterListRow {
  readonly template: IssueTemplate | null;
  readonly name: string;
  readonly about: string | null;
  /** A form continued on GitHub's own page (D14). */
  readonly handOff: boolean;
}

const props = defineProps<{
  /** `owner/name`. */
  repository: string;
  templates: readonly IssueTemplate[];
  blankIssuesEnabled: boolean;
  /** Whether a form can be filled here (H8) or continues on GitHub (D14). */
  canPush: boolean;
}>();

const emit = defineEmits<{
  use: [template: IssueTemplate];
  blank: [];
  back: [];
}>();

/** The value of the "Blank issue" row, which no template file takes. */
const BLANK = '\u0000blank';

const t = useTranslate();

const rows = computed(() =>
  props.templates.map((template): TemplateRow =>
    template.kind === 'form'
      ? {
          value: template.form.filename,
          template,
          name: template.form.name,
          about: template.form.description,
          handOff: !props.canPush,
        }
      : { value: template.filename, template, name: template.name, about: template.about, handOff: false },
  ),
);
const groups = computed((): FilterListGroup<TemplateRow>[] => [
  {
    key: 'templates',
    heading: null,
    rows: [
      ...rows.value,
      {
        value: BLANK,
        template: null,
        name: t(l.blank),
        about: props.blankIssuesEnabled ? null : t(l.blankOff, { repository: props.repository }),
        handOff: false,
        disabled: !props.blankIssuesEnabled,
      },
    ],
  },
]);

function pick(value: AcceptableValue | AcceptableValue[]) {
  if (value === BLANK) {
    emit('blank');
    return;
  }

  const row = rows.value.find(candidate => candidate.value === value);
  if (row?.template) {
    emit('use', row.template);
  }
}
</script>

<template>
  <FilterList
    :model-value="null"
    :class="css.templateChooser"
    :label="t(l.label)"
    :groups="groups"
    :filterable="false"
    :hints="[
      { keys: 'Enter', label: t(l.useTemplate) },
      { keys: 'Escape', label: t(l.back) },
    ]"
    back-on-escape
    @update:model-value="pick"
    @back="emit('back')"
  >
    <template #header>
      <div :class="css.templateChooser_head">
        <span :class="css.templateChooser_title">{{
          blankIssuesEnabled ? t(l.offers, { repository }) : t(l.asks, { repository })
        }}</span>
        <span
          v-if="!canPush && rows.some(row => row.handOff)"
          :class="css.templateChooser_note"
          >{{ t(l.formsOnGitHub) }}</span
        >
      </div>
    </template>
    <template #row="{ row, highlighted }">
      <component
        :is="row.handOff ? ExternalLink : FileText"
        :class="css.templateChooser_icon"
        aria-hidden="true"
      />
      <span :class="css.templateChooser_name">{{ row.name }}</span>
      <span
        v-if="row.template"
        :class="css.templateChooser_badge"
        >{{ row.template.kind === 'markdown' ? t(l.markdown) : row.handOff ? t(l.formOnGitHub) : t(l.form) }}</span
      >
      <span
        v-if="row.about"
        :class="css.templateChooser_about"
        >{{ row.about }}</span
      >
      <span :class="css.templateChooser_spacer" />
      <template v-if="highlighted && row.template">
        <span
          v-if="row.handOff"
          :class="css.templateChooser_about"
          >{{ t(l.continueOnGitHub) }}</span
        >
        <Kbd keys="Enter" />
      </template>
    </template>
    <template #footerEnd>
      <span>{{ t(l.fromGitHub) }}</span>
    </template>
  </FilterList>
</template>

<style lang="scss" module="css">
.templateChooser {
  border-top: 1px solid $color-border;
}

.templateChooser_head {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: $spacing-10 14px $spacing-4;
}

.templateChooser_title {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
}

.templateChooser_note {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.templateChooser_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-2;
}

.templateChooser_name {
  flex: none;
}

.templateChooser_badge {
  flex: none;
  padding: 0 $spacing-6;
  font-size: $font-size-2xs;
  color: $color-fg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-sm;
}

.templateChooser_about {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-sm;
  color: $color-fg-dim;
  white-space: nowrap;
}

.templateChooser_spacer {
  flex: 1;
}
</style>
