<!-- The Code review section of Settings (code-review D17, D34, CR77): how a comment goes out while no draft is open, as two cards (`ChoiceCards`). The change applies at once; where it is saved shows in the status bar. On a phone (`phone`, mobile D30, MB159) the same choice as plain rows under Comments, its text saying where code review is — the setting is the user's, synced with the rest, though a phone has no code review yet. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed, useId } from 'vue';

import { formatCommandKey } from '@/commands/formatCommandKey.js';
import ChoiceCards from '@/components/ChoiceCards.vue';
import type { ChoiceCardsOption } from '@/components/ChoiceCards.vue';
import { COMMENT_BOX_KEYS } from '@/review/writing/ReviewCommentBox.vue';

import * as l from './CodeReviewView.loc.js';
import PhoneSettingsGroup from './PhoneSettingsGroup.vue';
import type { ReviewCommentChoice } from './sync/SettingsDocument.js';

defineProps<{
  /** In a phone's Settings: plain rows in one column. */
  phone?: boolean;
}>();

const model = defineModel<ReviewCommentChoice>({ required: true });

const t = useTranslate();
const id = useId();

const options = computed((): ChoiceCardsOption<ReviewCommentChoice>[] => [
  { value: 'single', label: t(l.single), detail: t(l.singleDetail) },
  { value: 'draft', label: t(l.draft), detail: t(l.draftDetail) },
]);
</script>

<template>
  <PhoneSettingsGroup
    v-if="phone"
    v-slot="{ titleId }"
    :title="t(l.commentsTitle)"
    :description="t(l.commentsDescriptionPhone)"
  >
    <ChoiceCards
      v-model="model"
      touch
      :labelledby="titleId"
      :options="options"
    />
  </PhoneSettingsGroup>
  <div
    v-else
    :class="css.codeReviewView"
    data-route-scroll="settings-code-review"
  >
    <section :class="css.codeReviewView_column">
      <h3
        :id="`${id}-title`"
        :class="css.codeReviewView_title"
      >
        {{ t(l.commentsTitle) }}
      </h3>
      <p :class="css.codeReviewView_description">
        {{
          t(l.commentsDescription, {
            first: formatCommandKey(COMMENT_BOX_KEYS.sendFirst),
            second: formatCommandKey(COMMENT_BOX_KEYS.sendSecond),
          })
        }}
      </p>
      <ChoiceCards
        v-model="model"
        rows
        :labelledby="`${id}-title`"
        :options="options"
      />
    </section>
  </div>
</template>

<style lang="scss" module="css">
.codeReviewView {
  @include settings-screen;

  padding-block: 28px;
}

.codeReviewView_column {
  @include settings-screen-column;

  gap: $spacing-12;
  max-width: 560px;
}

.codeReviewView_title {
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
}

.codeReviewView_description {
  font-size: $font-size-sm;
  line-height: $line-height-normal;
  color: $color-fg-2;
}
</style>
