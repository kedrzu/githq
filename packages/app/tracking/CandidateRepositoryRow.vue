<!-- A repository the tracking screens offer (G2, G4, G5): its checkbox, named "owner/**name**" with public or private, and what tells whether the user cares — how many issues and pull requests are open, and how recently it saw a push. An archived one says it is read-only. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { BookMarked, Lock } from 'lucide-vue-next';
import { computed } from 'vue';

import Checkbox from '@/components/Checkbox.vue';
import { formatAge } from '@/utils/formatAge.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import * as l from './CandidateRepositoryRow.loc.js';
import type { CandidateRepository } from './TrackingTypes.js';

/** A push within this long reads as recent activity, brighter. */
const RECENT_MS = 7 * 24 * 60 * 60_000;

const props = defineProps<{
  repository: CandidateRepository;
  now: number;
}>();

const selected = defineModel<boolean>({ required: true });

const t = useTranslate();

const parts = computed(() => parseRepositoryName(props.repository.nameWithOwner));
const pushedAt = computed(() => (props.repository.pushedAt === null ? null : Date.parse(props.repository.pushedAt)));
</script>

<template>
  <div
    :class="css.candidateRepositoryRow"
    data-tracking-row
  >
    <Checkbox
      v-model="selected"
      :class="css.candidateRepositoryRow_label"
    >
      <span :class="css.candidateRepositoryRow_name">
        <component
          :is="repository.isPrivate ? Lock : BookMarked"
          :class="css.candidateRepositoryRow_icon"
          aria-hidden="true"
        />
        <span :class="css.candidateRepositoryRow_text">
          <span :class="css.candidateRepositoryRow_owner">{{ parts.owner }}/</span
          ><span :class="css.candidateRepositoryRow_repo">{{ parts.name }}</span>
        </span>
        <span :class="css.candidateRepositoryRow_pill">{{ t(repository.isPrivate ? l.private : l.public) }}</span>
        <span
          v-if="repository.isArchived"
          :class="css.candidateRepositoryRow_meta"
          >{{ t(l.archived) }}</span
        >
      </span>
    </Checkbox>
    <span :class="css.candidateRepositoryRow_meta">{{
      t(l.open, { count: repository.openIssues + repository.openPullRequests })
    }}</span>
    <span
      :class="[
        css.candidateRepositoryRow_active,
        pushedAt !== null && now - pushedAt < RECENT_MS && css.candidateRepositoryRow_active_recent,
      ]"
      >{{ pushedAt === null ? t(l.neverPushed) : t(l.active, { age: formatAge(pushedAt, now) }) }}</span
    >
  </div>
</template>

<style lang="scss" module="css">
.candidateRepositoryRow {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  min-height: 32px;
  padding: 0 $spacing-12;
  line-height: 18px;
  border-radius: $radius-md;

  &:hover {
    background: $color-bg-2;
  }

  &:focus-within {
    background: $color-sel;
  }
}

.candidateRepositoryRow_label {
  flex: 1;
  min-width: 0;
  padding: 7px 0;
}

.candidateRepositoryRow_name {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  min-width: 0;
}

.candidateRepositoryRow_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.candidateRepositoryRow_text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidateRepositoryRow_owner {
  color: $color-fg-dim;
}

.candidateRepositoryRow_repo {
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.candidateRepositoryRow_pill {
  flex: none;
  padding: 0 $spacing-6;
  font-size: 11px;
  line-height: 13px;
  color: $color-fg-dim;
  border: 1px solid $color-border-2;
  border-radius: $radius-sm;
}

.candidateRepositoryRow_meta {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  white-space: nowrap;
}

.candidateRepositoryRow_active {
  flex: none;
  width: 110px;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-align: right;
  white-space: nowrap;
}

.candidateRepositoryRow_active_recent {
  color: $color-fg-2;
}
</style>
