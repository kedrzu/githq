<!-- An organisation that hides its private data from githq (G5, D14): it restricts third-party apps and has not approved githq, so GitHub shows none of its private repositories and projects. Says that this is GitHub's rule and not a fault, and links to GitHub's page where the user requests approval — remembering the click, since githq cannot read whether a request is pending. `panel`: the whole explanation, with the steps (G5); `banner`: one line in the list of repositories (G2) or of projects (T22), pointing to the panel. On a phone (mobile MB136, MB137) `stacked` is the banner in the list of repositories — what it is, why, and the link under them — and `sheet` the panel, rising from below (`open`) with the steps and the request at its foot. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ArrowUpRight, ChevronRight, Lock } from 'lucide-vue-next';

import Button from '@/components/Button.vue';
import Dialog from '@/components/Dialog.vue';
import { Browser } from '@/services/Browser.js';
import { formatShortDate } from '@/utils/formatShortDate.js';

import * as l from './HiddenOrganizationNotice.loc.js';
import { getApprovalUrl } from './utils/getApprovalUrl.js';

defineProps<{
  organization: string;
  variant: 'banner' | 'panel' | 'sheet' | 'stacked';
  /** What the banner says can't be listed: the private repositories (G2), or the projects (T22). */
  subject?: 'repositories' | 'projects';
  /** How many public repositories GitHub still lists; `null` when it listed none of the organisation's. */
  publicCount?: number | null;
  /** When the user last opened GitHub's page to request approval (epoch ms), or `null`. */
  requestedAt?: number | null;
}>();

/** The sheet is up (`sheet`). */
const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  /** "Why, and how to fix", on the banner: the panel (on a phone, the sheet). */
  explain: [];
  /** The user opened GitHub's page to request approval. */
  requestApproval: [];
}>();

const t = useTranslate();
const browser = useService(Browser);

const approvalUrl = getApprovalUrl(browser.origin);
</script>

<template>
  <div
    v-if="variant === 'banner'"
    :class="css.hiddenOrganizationNotice_banner"
  >
    <Lock
      :class="css.hiddenOrganizationNotice_icon"
      aria-hidden="true"
    />
    <p :class="css.hiddenOrganizationNotice_bannerText">
      {{ t(subject === 'projects' ? l.bannerProjects : l.bannerText, { organization }) }}
      <template v-if="publicCount != null">{{ t(l.bannerPublic, { count: publicCount }) }}</template>
    </p>
    <Button
      variant="link"
      size="sm"
      :class="css.hiddenOrganizationNotice_explain"
      @click="emit('explain')"
    >
      {{ t(l.explain) }}
    </Button>
  </div>

  <div
    v-else-if="variant === 'stacked'"
    :class="css.hiddenOrganizationNotice_stacked"
  >
    <p :class="css.hiddenOrganizationNotice_stackedTitle">
      <Lock
        :class="css.hiddenOrganizationNotice_icon"
        aria-hidden="true"
      />
      {{ t(l.stackedTitle, { organization }) }}
    </p>
    <p :class="css.hiddenOrganizationNotice_stackedText">
      {{ t(l.stackedPublic, { count: publicCount ?? 0 }) }} {{ t(l.stackedNothingBroken) }}
    </p>
    <Button
      variant="link"
      :class="css.hiddenOrganizationNotice_stackedExplain"
      @click="emit('explain')"
    >
      {{ t(l.explainPhone) }}
      <ChevronRight
        :class="css.hiddenOrganizationNotice_chevron"
        aria-hidden="true"
      />
    </Button>
  </div>

  <Dialog
    v-else-if="variant === 'sheet'"
    v-model:open="open"
    edge="bottom"
    :title="t(l.title, { organization })"
  >
    <div :class="css.hiddenOrganizationNotice_sheet">
      <p :class="css.hiddenOrganizationNotice_detail">{{ t(l.detail, { organization }) }}</p>
      <ol
        :class="css.hiddenOrganizationNotice_steps"
        :aria-label="t(l.steps)"
      >
        <li>{{ t(l.step1) }}</li>
        <li>{{ t(l.step2, { organization }) }}</li>
        <li>{{ t(l.step3) }}</li>
      </ol>
    </div>
    <template #footer>
      <div :class="css.hiddenOrganizationNotice_sheetFoot">
        <Button
          variant="primary"
          size="lg"
          :link="approvalUrl"
          :icon="ArrowUpRight"
          target="_blank"
          @click="emit('requestApproval')"
        >
          {{ t(l.requestApproval) }}
        </Button>
        <span
          v-if="requestedAt != null"
          :class="css.hiddenOrganizationNotice_requested"
          >{{ t(l.requested, { date: formatShortDate(requestedAt) }) }}</span
        >
      </div>
    </template>
  </Dialog>

  <section
    v-else
    :class="css.hiddenOrganizationNotice_panel"
    :aria-label="t(l.title, { organization })"
  >
    <h2 :class="css.hiddenOrganizationNotice_title">
      <Lock
        :class="css.hiddenOrganizationNotice_icon"
        aria-hidden="true"
      />
      {{ t(l.title, { organization }) }}
    </h2>
    <p :class="css.hiddenOrganizationNotice_detail">{{ t(l.detail, { organization }) }}</p>
    <ol
      :class="css.hiddenOrganizationNotice_steps"
      :aria-label="t(l.steps)"
    >
      <li>{{ t(l.step1) }}</li>
      <li>{{ t(l.step2, { organization }) }}</li>
      <li>{{ t(l.step3) }}</li>
    </ol>
    <div :class="css.hiddenOrganizationNotice_actions">
      <Button
        variant="primary"
        size="lg"
        :link="approvalUrl"
        :icon="ArrowUpRight"
        target="_blank"
        @click="emit('requestApproval')"
      >
        {{ t(l.requestApproval) }}
      </Button>
      <span
        v-if="requestedAt != null"
        :class="css.hiddenOrganizationNotice_requested"
        >{{ t(l.requested, { date: formatShortDate(requestedAt) }) }}</span
      >
    </div>
  </section>
</template>

<style lang="scss" module="css">
.hiddenOrganizationNotice_banner {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  padding: $spacing-8 $spacing-12;
  margin-top: $spacing-4;
  font-size: $font-size-sm;
  color: $color-fg;
  background: rgba($color-amber, 0.08);
  border: 1px solid rgba($color-amber, 0.25);
  border-radius: $radius-lg;
}

.hiddenOrganizationNotice_bannerText {
  flex: 1;
  min-width: 0;
}

.hiddenOrganizationNotice_explain {
  flex: none;
  color: $color-amber;
}

.hiddenOrganizationNotice_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-amber;
}

.hiddenOrganizationNotice_stacked {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  align-items: flex-start;
  padding: $spacing-12 $spacing-16;
  background: rgba($color-amber, 0.08);
  border-block: 1px solid rgba($color-amber, 0.25);
}

.hiddenOrganizationNotice_stackedTitle {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  font-size: $font-size-lg;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.hiddenOrganizationNotice_stackedText {
  font-size: $font-size-sm;
  line-height: 1.5;
  color: $color-fg-2;
}

.hiddenOrganizationNotice_stackedExplain {
  min-height: $touch-target-size;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.hiddenOrganizationNotice_chevron {
  width: 14px;
  height: 14px;
  vertical-align: -2px;
  color: $color-fg-2;
}

.hiddenOrganizationNotice_sheet {
  display: flex;
  flex-direction: column;
  gap: $spacing-16;
  padding-bottom: $spacing-8;
}

.hiddenOrganizationNotice_sheetFoot {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-8;
  align-items: stretch;
}

.hiddenOrganizationNotice_panel {
  display: flex;
  flex-direction: column;
  gap: $spacing-16;
  padding: 20px 22px;
  background: rgba($color-amber, 0.05);
  border: 1px solid rgba($color-amber, 0.33);
  border-radius: $radius-xl;
}

.hiddenOrganizationNotice_title {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  font-size: 16px;
  font-weight: $font-weight-semibold;
  color: $color-fg;

  .hiddenOrganizationNotice_icon {
    width: 16px;
    height: 16px;
  }
}

.hiddenOrganizationNotice_detail {
  font-size: 13.5px;
  line-height: 21px;
  color: $color-fg-2;
}

.hiddenOrganizationNotice_steps {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding: 0;
  margin: 0;
  font-size: $font-size-md;
  color: $color-fg;
  list-style: none;
  counter-reset: step;

  li {
    display: flex;
    gap: $spacing-10;
    align-items: center;
    counter-increment: step;

    &::before {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      font-size: 11px;
      font-weight: $font-weight-semibold;
      color: $color-fg-2;
      content: counter(step);
      background: $color-bg-3;
      border-radius: 50%;
    }
  }
}

.hiddenOrganizationNotice_actions {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  padding-top: $spacing-4;
}

.hiddenOrganizationNotice_requested {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}
</style>
