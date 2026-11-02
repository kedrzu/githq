<!-- The landing page's third section under the hero (githq.pen "LP1 · All your repositories, no separate tracker", Section 3): why it matters now — even solo, you hand out issues to agents and work through the pull requests they send back —, the screenshot second. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Bot, CircleDot, GitMerge } from 'lucide-vue-next';

import LandingFeature from './LandingFeature.vue';
import * as l from './LandingWhyNow.loc.js';

const t = useTranslate();
</script>

<template>
  <LandingFeature
    number="03"
    :kicker="t(l.kicker)"
    :title="t(l.title)"
    :body="t(l.body)"
    :points="[
      { icon: CircleDot, text: t(l.handOut) },
      { icon: Bot, text: t(l.sentBack) },
      { icon: GitMerge, text: t(l.merge) },
    ]"
    image="/landing/agents.webp"
    :image-alt="t(l.alt)"
  />
</template>
