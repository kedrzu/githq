<!-- The Typography section of Settings › Display (T28–T30), desktop only: a heading and what it does, the preset (`Settings / Preset control`, a boxed `SegmentedTabs`: Compact · Default · Spaced · Custom — Custom dimmed and not choosable, chosen once a size or line height is hand-made) and a `TypographyCard` per role. Reading and Code: a `FontSelect` and steppers for the size and the line height; Interface: a font alone. Each card's sample sets the role's custom properties from `typography`, so it shows the choice whether or not the app draws with it yet. -->
<script lang="ts">
import type { DiffUnifiedRow } from '@/review/diff/buildDiffRows.js';
import type { FileDiff } from '@/review/diff/computeFileDiff.js';

/** Code's sample, three lines of a diff (`Diff / Row · unified`): one kept, one deleted, one added, at lines 41–42. */
const DIFF_SAMPLE_KEPT = 'const items = await this.pending.all()';

// The rows read a line by its number, so lines 1–40 are there, empty.
const DIFF_SAMPLE_LEADING = Array.from({ length: 40 }, () => '');

const DIFF_SAMPLE: FileDiff = {
  before: [...DIFF_SAMPLE_LEADING, DIFF_SAMPLE_KEPT, 'for (const item of items) await this.send(item)'],
  after: [...DIFF_SAMPLE_LEADING, DIFF_SAMPLE_KEPT, 'await this.sendInBatches(items, { size: 50 })'],
  blocks: [],
  carriageReturns: { before: new Set(), after: new Set() },
};

const DIFF_SAMPLE_ROWS: readonly DiffUnifiedRow[] = [
  { kind: 'line', layout: 'unified', key: 'kept', oldLine: 41, newLine: 41, sign: ' ' },
  { kind: 'line', layout: 'unified', key: 'deleted', oldLine: 42, newLine: null, sign: '-' },
  { kind: 'line', layout: 'unified', key: 'added', oldLine: null, newLine: 42, sign: '+' },
];
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed, useId } from 'vue';

import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import DiffRowUnified from '@/review/DiffRowUnified.vue';
import type { TypographyRoleChange, TypographySettings } from '@/typography/readTypography.js';
import type { TypographyPreset } from '@/typography/typographyCatalog.js';
import { CODE_FONTS, INTERFACE_FONTS, READING_FONTS, TYPOGRAPHY_RANGES } from '@/typography/typographyCatalog.js';

import FontSelect from './FontSelect.vue';
import SettingsStepper from './SettingsStepper.vue';
import * as l from './TypographyBlock.loc.js';
import TypographyCard from './TypographyCard.vue';

const props = defineProps<{
  typography: TypographySettings;
}>();

const emit = defineEmits<{
  /** A preset chosen: its sizes and line heights replace the hand-made ones; the fonts stay. */
  preset: [preset: TypographyPreset];
  /** A role's font, size or line height changed by hand. */
  change: [change: TypographyRoleChange];
}>();

const t = useTranslate();
const titleId = useId();

const presetOptions = computed((): SegmentedTabsOption<TypographyPreset | 'custom'>[] => [
  { value: 'compact', label: t(l.compact) },
  { value: 'default', label: t(l.default) },
  { value: 'spaced', label: t(l.spaced) },
  // Not chosen by itself: it is what hand-made values make, and stays choosable only as the current choice.
  { value: 'custom', label: t(l.custom), disabled: props.typography.preset !== 'custom' },
]);

const preset = computed({
  get: () => props.typography.preset,
  set: value => {
    if (value !== 'custom') {
      emit('preset', value);
    }
  },
});

const readingSampleStyle = computed(() => ({
  '--font-family-reading': props.typography.reading.font.stack,
  '--font-size-reading': `${props.typography.reading.size}px`,
  '--line-height-reading': String(props.typography.reading.lineHeight),
}));

const codeSampleStyle = computed(() => ({
  '--font-family-code': props.typography.code.font.stack,
  '--font-size-code': `${props.typography.code.size}px`,
  '--line-height-code': `${props.typography.code.lineHeight}px`,
}));

const interfaceSampleStyle = computed(() => ({
  '--font-family-interface': props.typography.interface.font.stack,
}));
</script>

<template>
  <section
    :class="css.typographyBlock"
    :aria-labelledby="titleId"
  >
    <h2
      :id="titleId"
      :class="css.typographyBlock_title"
    >
      {{ t(l.title) }}
    </h2>
    <p :class="css.typographyBlock_description">{{ t(l.description) }}</p>
    <SegmentedTabs
      v-model="preset"
      :class="css.typographyBlock_presets"
      :options="presetOptions"
      :label="t(l.preset)"
      variant="boxed"
    />
    <div :class="css.typographyBlock_cards">
      <TypographyCard
        :title="t(l.readingTitle)"
        :description="t(l.readingDescription)"
      >
        <template #controls>
          <FontSelect
            :model-value="typography.reading.font.id"
            :label="t(l.font)"
            :menu-label="t(l.readingFont)"
            :fonts="READING_FONTS"
            :system-hint="t(l.systemSans)"
            @update:model-value="emit('change', { role: 'reading', font: $event })"
          />
          <SettingsStepper
            :model-value="typography.reading.size"
            :label="t(l.size)"
            :range="TYPOGRAPHY_RANGES.reading.size"
            :unit="t(l.pixels)"
            @update:model-value="emit('change', { role: 'reading', size: $event })"
          />
          <SettingsStepper
            :model-value="typography.reading.lineHeight"
            :label="t(l.lineHeight)"
            :range="TYPOGRAPHY_RANGES.reading.lineHeight"
            @update:model-value="emit('change', { role: 'reading', lineHeight: $event })"
          />
        </template>
        <template #sample>
          <p
            :class="css.typographyBlock_reading"
            :style="readingSampleStyle"
          >
            {{ t(l.readingSample) }}
          </p>
        </template>
      </TypographyCard>
      <TypographyCard
        :title="t(l.codeTitle)"
        :description="t(l.codeDescription)"
      >
        <template #controls>
          <FontSelect
            :model-value="typography.code.font.id"
            :label="t(l.font)"
            :menu-label="t(l.codeFont)"
            :fonts="CODE_FONTS"
            :system-hint="t(l.systemMono)"
            @update:model-value="emit('change', { role: 'code', font: $event })"
          />
          <SettingsStepper
            :model-value="typography.code.size"
            :label="t(l.size)"
            :range="TYPOGRAPHY_RANGES.code.size"
            :unit="t(l.pixels)"
            @update:model-value="emit('change', { role: 'code', size: $event })"
          />
          <SettingsStepper
            :model-value="typography.code.lineHeight"
            :label="t(l.lineHeight)"
            :range="TYPOGRAPHY_RANGES.code.lineHeight"
            :unit="t(l.pixels)"
            @update:model-value="emit('change', { role: 'code', lineHeight: $event })"
          />
        </template>
        <template #sample>
          <!-- The diff's own rows; inert, as their line numbers would start a comment. -->
          <div
            :class="css.typographyBlock_code"
            :style="codeSampleStyle"
            inert
          >
            <DiffRowUnified
              v-for="row in DIFF_SAMPLE_ROWS"
              :key="row.key"
              :line="row"
              :diff="DIFF_SAMPLE"
              :syntax="null"
              :commented="[]"
            />
          </div>
        </template>
      </TypographyCard>
      <TypographyCard
        :title="t(l.interfaceTitle)"
        :description="t(l.interfaceDescription)"
      >
        <template #controls>
          <FontSelect
            :model-value="typography.interface.font.id"
            :label="t(l.font)"
            :menu-label="t(l.interfaceFont)"
            :fonts="INTERFACE_FONTS"
            :system-hint="t(l.systemSans)"
            @update:model-value="emit('change', { role: 'interface', font: $event })"
          />
        </template>
        <template #sample>
          <p
            :class="css.typographyBlock_interface"
            :style="interfaceSampleStyle"
          >
            {{ t(l.interfaceSample) }}
            <span :class="css.typographyBlock_number">{{ t(l.interfaceSampleNumber) }}</span>
          </p>
        </template>
      </TypographyCard>
    </div>
  </section>
</template>

<style lang="scss" module="css">
.typographyBlock {
  display: flex;
  flex-direction: column;
}

.typographyBlock_title {
  font-size: $font-size-lg;
  font-weight: $font-weight-medium;
}

.typographyBlock_description {
  margin-top: $spacing-8;
  font-size: $font-size-sm;
  line-height: $line-height-normal;
  color: $color-fg-2;
}

.typographyBlock_presets {
  align-self: flex-start;
  margin-top: $spacing-14;
}

.typographyBlock_cards {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  margin-top: $spacing-12;
}

.typographyBlock_reading {
  font-family: $font-family-reading;
  font-size: $font-size-reading;
  line-height: $line-height-reading;
  color: $color-fg;
}

.typographyBlock_code {
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: $font-size-code;
  line-height: $line-height-code;
}

.typographyBlock_interface {
  font-family: $font-family-sans;
  font-size: $font-size-row-title;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.typographyBlock_number {
  margin-left: $spacing-6;
  font-weight: normal;
  color: $color-fg-dim;
}
</style>
