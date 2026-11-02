<!-- The header of an owner's group in Settings' Repositories and Projects (G8, T17 `r7z5p0`): a person or a building, the owner, and how the user stands to it with how many of its are tracked ("your repositories · 12 of 12 tracked", "organisation · 2 of 312 tracked", "not a member · 1 tracked") — of how many only once GitHub's lists are read. "Track more" opens the picker on that owner; there is none when nothing of it is left to track or GitHub doesn't list it to the user. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { Building2, User } from 'lucide-vue-next';
import { computed } from 'vue';

import Button from '@/components/Button.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import * as l from './TrackedOwnerHeader.loc.js';
import type { TrackedOwnerGroup } from './utils/groupTrackedByOwner.js';

const props = defineProps<{
  group: TrackedOwnerGroup<unknown>;
  /** What is listed, and so the words: "your repositories", "your projects". */
  kind: 'repositories' | 'projects';
}>();

const emit = defineEmits<{
  trackMore: [];
}>();

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);

const meta = computed(() => {
  const { relation, rows, total } = props.group;
  const tracked = numbers.format(rows.length);
  const count = total === null ? t(l.tracked, { tracked }) : t(l.trackedOf, { tracked, total: numbers.format(total) });
  const standing = getStanding();
  return standing === null ? count : `${standing} · ${count}`;
});

function getStanding() {
  switch (props.group.relation) {
    case 'own':
      return t(props.kind === 'projects' ? l.ownProjects : l.ownRepositories);
    case 'organization':
      return t(l.organization);
    case 'notMember':
      return t(l.notMember);
    case 'unknown':
      return null;
    default:
      return assertNever(props.group.relation);
  }
}
</script>

<template>
  <div :class="css.trackedOwnerHeader">
    <component
      :is="group.ownerKind === 'user' ? User : Building2"
      :class="css.trackedOwnerHeader_icon"
      aria-hidden="true"
    />
    <h3 :class="css.trackedOwnerHeader_owner">{{ group.login }}</h3>
    <span :class="css.trackedOwnerHeader_meta">{{ meta }}</span>
    <Button
      v-if="group.canTrackMore"
      variant="outline"
      size="sm"
      :class="css.trackedOwnerHeader_more"
      @click="emit('trackMore')"
    >
      {{ t(l.trackMore) }}
    </Button>
  </div>
</template>

<style lang="scss" module="css">
.trackedOwnerHeader {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-height: 32px;
  padding: 0 $spacing-12;
}

.trackedOwnerHeader_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.trackedOwnerHeader_owner {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $color-fg-2;
}

.trackedOwnerHeader_meta {
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trackedOwnerHeader_more {
  margin-left: auto;
}
</style>
