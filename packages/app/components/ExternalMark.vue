<!-- The ↗ after a link that leaves githq for github.com on a phone (mobile D11): one to an address the phone layout doesn't show — a commit, a pull request's changed files, an Actions run — handed off when tapped (D3), so it says so before. Drawn only in the phone layout (`PhoneLayout.active`); its accessible name joins the link's ("Review files, opens on github.com"). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ArrowUpRight } from 'lucide-vue-next';

import { PhoneLayout } from '@/shell/PhoneLayout.js';

import * as l from './ExternalMark.loc.js';

const t = useTranslate();
const phone = useService(PhoneLayout);
</script>

<template>
  <span
    v-if="phone.active"
    :class="css.externalMark"
  >
    <ArrowUpRight
      :class="css.externalMark_icon"
      aria-hidden="true"
    />
    <!-- Hidden out of the flow, so a screen reader reads it apart from the link's words: "a3f91c2 opens on github.com". -->
    <span :class="css.externalMark_label">{{ t(l.label) }}</span>
  </span>
</template>

<style lang="scss" module="css">
.externalMark {
  flex: none;
}

// As tall as the text, a little apart from it, in the link's own colour.
.externalMark_icon {
  width: 1em;
  height: 1em;
  margin-left: 0.15em;
  vertical-align: -0.125em;
}

.externalMark_label {
  @include visually-hidden;
}
</style>
