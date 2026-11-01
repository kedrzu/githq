<!-- The landing page's comparison (githq.pen "Landing — githq.dev", Comparison): githq against github.com and a dedicated tracker — next to the code, instant, keyboard, every repository at once, nothing to sync, the price —, a table with githq's column lit. Every mark has its word for screen readers. -->
<script lang="ts" setup>
import type { Translation } from '@nzyme/i18n-core';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Check, Minus } from 'lucide-vue-next';
import { useId, useTemplateRef } from 'vue';

import Wordmark from '@/components/Wordmark.vue';

import * as l from './LandingComparison.loc.js';
import LandingSectionTitle from './LandingSectionTitle.vue';
import { useReveal } from './useReveal.js';

/** What a cell of the table says: a check, a dash, "Partly" or a word of its own (a price). */
type Mark = 'no' | 'partly' | 'yes' | Translation;

/** A row of the table: what is compared, and the marks of github.com, a dedicated tracker and githq, in that order. */
interface ComparisonRow {
  label: Translation;
  marks: [Mark, Mark, Mark];
}

const t = useTranslate();
const headingId = useId();
const reveal = useReveal(useTemplateRef<HTMLElement>('section'));

const rows: ComparisonRow[] = [
  { label: l.nextToCode, marks: ['yes', 'no', 'yes'] },
  { label: l.instant, marks: ['no', 'yes', 'yes'] },
  { label: l.keyboard, marks: ['partly', 'yes', 'yes'] },
  { label: l.allRepositories, marks: ['partly', 'yes', 'yes'] },
  { label: l.nothingToSync, marks: ['yes', 'no', 'yes'] },
  { label: l.price, marks: [l.free, l.perSeat, l.free] },
];
</script>

<template>
  <section
    ref="section"
    :class="css.landingComparison"
    :aria-labelledby="headingId"
    :data-reveal="reveal"
  >
    <LandingSectionTitle
      :class="css.landingComparison_title"
      :eyebrow="t(l.eyebrow)"
      :lines="[t(l.titleLine1), t(l.titleLine2)]"
      :heading-id="headingId"
    />

    <table
      :class="css.landingComparison_table"
      :aria-labelledby="headingId"
    >
      <thead>
        <tr>
          <td :class="css.landingComparison_corner" />
          <th
            scope="col"
            :class="css.landingComparison_column"
          >
            {{ t(l.github) }}
          </th>
          <th
            scope="col"
            :class="css.landingComparison_column"
          >
            {{ t(l.tracker) }}
          </th>
          <th
            scope="col"
            :class="[css.landingComparison_column, css.landingComparison_githq]"
          >
            <Wordmark />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, rowIndex) in rows"
          :key="rowIndex"
        >
          <th
            scope="row"
            :class="css.landingComparison_label"
          >
            {{ t(row.label) }}
          </th>
          <td
            v-for="(mark, index) in row.marks"
            :key="index"
            :class="[css.landingComparison_cell, index === 2 && css.landingComparison_githq]"
          >
            <template v-if="mark === 'yes'">
              <Check
                :class="[css.landingComparison_icon, css.landingComparison_yes]"
                aria-hidden="true"
              />
              <span :class="css.landingComparison_hidden">{{ t(l.yes) }}</span>
            </template>
            <template v-else-if="mark === 'no'">
              <Minus
                :class="[css.landingComparison_icon, css.landingComparison_no]"
                aria-hidden="true"
              />
              <span :class="css.landingComparison_hidden">{{ t(l.no) }}</span>
            </template>
            <span
              v-else-if="mark === 'partly'"
              :class="css.landingComparison_partly"
              >{{ t(l.partly) }}</span
            >
            <span
              v-else
              :class="css.landingComparison_value"
              >{{ t(mark) }}</span
            >
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style lang="scss" module="css">
.landingComparison {
  @include landing-gutter;

  display: flex;
  flex-direction: column;
  gap: 56px;
  padding-block: 120px;
  border-top: 1px solid $color-border;

  @include landing-mobile {
    gap: 32px;
    padding-block: 64px;
  }
}

.landingComparison_title {
  @include landing-reveal;
}

// The design's 480 for the labels and 240 for each column at 1440; 74 for a column on a phone.
.landingComparison_table {
  @include landing-reveal($landing-reveal-stagger);

  width: 100%;
  table-layout: fixed;
  border-spacing: 0;
  border-collapse: separate;
  border: 1px solid $color-border;
  border-radius: $radius-landing-visual;

  // Low enough for the cells' own classes to win.
  :where(th, td) {
    padding: 0;
    font-weight: $font-weight-normal;
    text-align: center;
    vertical-align: middle;
  }

  thead tr > * {
    height: 64px;
    background: $color-bg-2;
    border-bottom: 1px solid $color-border;
  }

  thead tr > :first-child {
    border-top-left-radius: $radius-landing-visual;
  }

  thead tr > :last-child {
    border-top-right-radius: $radius-landing-visual;
  }

  tbody tr > * {
    height: 60px;
  }

  tbody tr + tr > * {
    border-top: 1px solid $color-border;
  }

  tbody tr:last-child > :last-child {
    border-bottom-right-radius: $radius-landing-visual;
  }

  @include landing-mobile {
    tbody tr > * {
      height: 76px;
    }

    tbody tr:last-child > * {
      height: 56px;
    }
  }
}

.landingComparison_corner {
  width: 40%;

  @include landing-mobile {
    width: auto;
  }
}

.landingComparison_column {
  width: 20%;
  padding-inline: $spacing-2;
  font-size: $font-size-xl;
  color: $color-fg-2;

  font-weight: $font-weight-medium;
  @include landing-mobile {
    width: 74px;
    font-size: $font-size-2xs;
    line-height: 1.25;
  }
}

.landingComparison_label {
  padding-inline: 28px;
  font-size: 16px;
  color: $color-fg;

  text-align: left;

  @include landing-mobile {
    padding-inline: $spacing-16 $spacing-8;
    font-size: $font-size-lg;
    line-height: 1.35;
  }
}

// githq's column: the header a little more lit than its cells.
.landingComparison_githq {
  background: rgba($color-accent, 0.06);

  .landingComparison_table thead & {
    background: rgba($color-accent, 0.1);
  }
}

.landingComparison_icon {
  display: block;
  width: 18px;
  height: 18px;
  margin-inline: auto;

  @include landing-mobile {
    width: 16px;
    height: 16px;
  }
}

.landingComparison_yes {
  color: $color-fg-2;

  .landingComparison_githq & {
    color: $color-accent;
  }
}

.landingComparison_no {
  color: $color-fg-3;
}

.landingComparison_hidden {
  @include visually-hidden;
}

// The design's `$color-fg-3`, a step up to pass AA.
.landingComparison_partly {
  font-size: $font-size-lg;
  color: $color-fg-dim;

  @include landing-mobile {
    font-size: $font-size-2xs;
  }
}

.landingComparison_value {
  font-size: $font-size-xl;
  color: $color-fg-2;

  .landingComparison_githq & {
    font-weight: $font-weight-semibold;
    color: $color-fg;
  }

  @include landing-mobile {
    font-size: $font-size-2xs;
  }
}
</style>
