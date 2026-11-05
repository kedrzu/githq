<!-- The landing page's first section under the hero (githq.pen "Landing — githq.dev", Section 1): the "one place" promise — reviews, pull requests with their checks, workflows failing on main and assigned issues from every repository in one list —, the screenshot first. The navigation's and the footer's "Features" land here. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleDot, Eye, GitPullRequest, OctagonX } from 'lucide-vue-next';

import * as l from './LandingOnePlace.loc.js';
import LandingFeature from './LandingFeature.vue';
import { LandingSectionId } from './landingLinks.js';

const t = useTranslate();
</script>

<template>
  <LandingFeature
    :id="LandingSectionId.features"
    number="01"
    :kicker="t(l.kicker)"
    :title="t(l.title)"
    :body="t(l.body)"
    :points="[
      { icon: Eye, text: t(l.reviews) },
      { icon: GitPullRequest, text: t(l.pullRequests) },
      { icon: OctagonX, text: t(l.workflows) },
      { icon: CircleDot, text: t(l.issues) },
    ]"
    image="/landing/one-place.webp"
    :image-alt="t(l.alt)"
    flip
  />
</template>
