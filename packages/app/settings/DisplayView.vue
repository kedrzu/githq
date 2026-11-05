<!-- The Display section of Settings (git-client D22, CH43): the repository layout of D14 as two cards (`ChoiceCards`), each with a sketch of it. The change applies at once; where it is saved shows in the status bar. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed, useId } from 'vue';

import ChoiceCards from '@/components/ChoiceCards.vue';
import type { ChoiceCardsOption } from '@/components/ChoiceCards.vue';

import * as l from './DisplayView.loc.js';
import type { RepositoryLayout } from './sync/SettingsDocument.js';

/** The list's rows in a sketch, by how far each reaches; the first is the one selected. */
const SKETCH_LINES = ['70%', '50%', '45%', '72%', '60%', '50%', '75%', '55%'];

/** The rows of a sketch's column: its sections. */
const SKETCH_SECTIONS = 4;

/** The tabs of a sketch's top line, after the one selected. */
const SKETCH_TABS = 2;

const model = defineModel<RepositoryLayout>({ required: true });

const t = useTranslate();
const id = useId();

const options = computed((): ChoiceCardsOption<RepositoryLayout>[] => [
  { value: 'tabs', label: t(l.tabs), detail: t(l.tabsDetail) },
  { value: 'column', label: t(l.column), detail: t(l.columnDetail) },
]);
</script>

<template>
  <div :class="css.displayView">
    <section :class="css.displayView_column">
      <h2
        :id="`${id}-title`"
        :class="css.displayView_title"
      >
        {{ t(l.layoutTitle) }}
      </h2>
      <p :class="css.displayView_description">{{ t(l.layoutDescription) }}</p>
      <ChoiceCards
        v-model="model"
        :labelledby="`${id}-title`"
        :options="options"
        :class="css.displayView_options"
      >
        <template #default="{ option }">
          <span
            :class="css.displayView_sketch"
            aria-hidden="true"
          >
            <span :class="css.displayView_sketchSidebar" />
            <span
              v-if="option.value === 'column'"
              :class="css.displayView_sketchColumn"
            >
              <span
                v-for="section in SKETCH_SECTIONS"
                :key="section"
                :class="[css.displayView_sketchSection, section === 1 && css.displayView_sketchSection_selected]"
              />
            </span>
            <span :class="css.displayView_sketchMain">
              <span :class="css.displayView_sketchHead">
                <span :class="css.displayView_sketchName" />
                <template v-if="option.value === 'tabs'">
                  <span :class="[css.displayView_sketchTab, css.displayView_sketchTab_selected]" />
                  <span
                    v-for="tab in SKETCH_TABS"
                    :key="tab"
                    :class="css.displayView_sketchTab"
                  />
                </template>
              </span>
              <span :class="css.displayView_sketchLines">
                <span
                  v-for="(width, index) in SKETCH_LINES"
                  :key="index"
                  :class="[css.displayView_sketchLine, index === 0 && css.displayView_sketchLine_selected]"
                  :style="{ width }"
                />
              </span>
            </span>
          </span>
        </template>
      </ChoiceCards>
    </section>
  </div>
</template>

<style lang="scss" module="css">
.displayView {
  @include settings-screen;

  padding-block: 28px;
}

.displayView_column {
  @include settings-screen-column;

  max-width: 560px;
}

.displayView_title {
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;
}

.displayView_description {
  margin-top: $spacing-8;
  font-size: $font-size-sm;
  line-height: $line-height-normal;
  color: $color-fg-2;
}

.displayView_options {
  margin-top: $spacing-16;
}

.displayView_sketch {
  display: flex;
  height: 132px;
  overflow: hidden;
  background: $color-bg;
  border: 1px solid $color-border;
  border-radius: $radius-md;
}

.displayView_sketchSidebar {
  flex: none;
  width: 44px;
  background: $color-bg-2;
  border-right: 1px solid $color-border;
}

.displayView_sketchColumn {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: $spacing-4;
  width: 58px;
  padding: $spacing-10 $spacing-6;
  background: $color-bg-3;
  border-right: 1px solid $color-border;
}

.displayView_sketchSection {
  height: 8px;
  background: $color-border-2;
  border-radius: 2px;
}

.displayView_sketchSection_selected {
  background: rgba($color-accent, 0.5);
}

.displayView_sketchMain {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.displayView_sketchHead {
  display: flex;
  flex: none;
  gap: $spacing-4;
  align-items: center;
  height: 22px;
  padding: 0 $spacing-8;
  border-bottom: 1px solid $color-border;
}

.displayView_sketchName {
  width: 30px;
  height: 4px;
  background: $color-fg-3;
  border-radius: 2px;
}

.displayView_sketchTab {
  width: 22px;
  height: 9px;
  background: $color-bg-3;
  border-radius: 3px;
}

.displayView_sketchTab_selected {
  background: rgba($color-accent, 0.2);
  border: 1px solid $color-accent;
}

.displayView_sketchLines {
  display: flex;
  flex-direction: column;
  gap: $spacing-7;
  padding: $spacing-10 $spacing-8;
}

.displayView_sketchLine {
  height: 3px;
  background: $color-border-2;
  border-radius: 2px;
}

.displayView_sketchLine_selected {
  background: rgba($color-accent, 0.6);
}
</style>
