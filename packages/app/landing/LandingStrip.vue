<!-- The landing page's "built on GitHub" strip (githq.pen "Landing — githq.dev", Built on GitHub strip): the GitHub concepts githq works with — issues, pull requests, projects, labels, milestones, iterations, assignees — under one line that says they are all there is. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleDot, GitPullRequest, Milestone, Repeat, SquareKanban, Tag, Users } from 'lucide-vue-next';

import * as l from './LandingStrip.loc.js';

const t = useTranslate();

const concepts = [
  { icon: CircleDot, label: l.issues },
  { icon: GitPullRequest, label: l.pullRequests },
  { icon: SquareKanban, label: l.projects },
  { icon: Tag, label: l.labels },
  { icon: Milestone, label: l.milestones },
  { icon: Repeat, label: l.iterations },
  { icon: Users, label: l.assignees },
];
</script>

<template>
  <section :class="css.landingStrip">
    <h2 :class="css.landingStrip_title">{{ t(l.title) }}</h2>
    <ul :class="css.landingStrip_concepts">
      <li
        v-for="(concept, index) in concepts"
        :key="index"
        :class="css.landingStrip_concept"
      >
        <component
          :is="concept.icon"
          :class="css.landingStrip_icon"
          aria-hidden="true"
        />
        {{ t(concept.label) }}
      </li>
    </ul>
  </section>
</template>

<style lang="scss" module="css">
.landingStrip {
  @include landing-gutter;

  display: flex;
  flex-direction: column;
  gap: 28px;
  align-items: center;
  padding-block: 72px 80px;

  @include landing-mobile {
    gap: 22px;
    padding-block: 48px 56px;
  }
}

.landingStrip_title {
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.landingStrip_concepts {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-16 56px;
  justify-content: center;
  padding: 0;
  margin: 0;
  list-style: none;

  @include landing-narrow {
    column-gap: 22px;
  }
}

.landingStrip_concept {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  font-family: $font-family-brand;
  font-size: 18px;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
}

.landingStrip_icon {
  flex: none;
  width: 20px;
  height: 20px;
}
</style>
