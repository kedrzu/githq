<!-- A repository the tracking screens offer (G2, G4, G5, T18): its checkbox, named "owner/**name**" with public or private, and what tells whether the user cares — how many issues and pull requests are open, and how recently it saw a push. An archived one says it is read-only. In the picker (T18) a tracked one shows a grey, fixed tick and "tracked" instead of its activity; one GitHub's lists have not given shows only what is known of it — no tag when its privacy is unknown, no open count. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { BookMarked, Lock } from 'lucide-vue-next';
import { computed } from 'vue';

import Checkbox from '@/components/Checkbox.vue';
import { formatAge } from '@/utils/formatAge.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import * as l from './CandidateRepositoryRow.loc.js';
import type { CandidateRepository, TrackedRepositoryEntry } from './TrackingTypes.js';

/** A push within this long reads as recent activity, brighter. */
const RECENT_MS = 7 * 24 * 60 * 60_000;

const props = defineProps<{
  /** Offered by GitHub's lists, or (the picker) tracked yet not among what they gave so far. */
  repository: CandidateRepository | TrackedRepositoryEntry;
  now: number;
  /** The picker: already tracked, so its tick is fixed and it can't be picked. */
  tracked?: boolean;
}>();

const selected = defineModel<boolean>({ required: true });

const t = useTranslate();

const parts = computed(() => parseRepositoryName(props.repository.nameWithOwner));
const candidate = computed(() => ('openIssues' in props.repository ? props.repository : null));
const pushedAt = computed(() => (candidate.value?.pushedAt == null ? null : Date.parse(candidate.value.pushedAt)));
</script>

<template>
  <div
    :class="[css.candidateRepositoryRow, tracked && css.candidateRepositoryRow_tracked]"
    data-tracking-row
  >
    <Checkbox
      :model-value="tracked || selected"
      :readonly="tracked"
      :class="css.candidateRepositoryRow_label"
      @update:model-value="selected = $event"
    >
      <span :class="css.candidateRepositoryRow_name">
        <component
          :is="repository.isPrivate === true ? Lock : BookMarked"
          :class="css.candidateRepositoryRow_icon"
          aria-hidden="true"
        />
        <span :class="css.candidateRepositoryRow_text">
          <span :class="css.candidateRepositoryRow_owner">{{ parts.owner }}/</span
          ><span :class="css.candidateRepositoryRow_repo">{{ parts.name }}</span>
        </span>
        <span
          v-if="repository.isPrivate !== null"
          :class="css.candidateRepositoryRow_pill"
          >{{ t(repository.isPrivate ? l.private : l.public) }}</span
        >
        <span
          v-if="candidate?.isArchived"
          :class="css.candidateRepositoryRow_meta"
          >{{ t(l.archived) }}</span
        >
      </span>
    </Checkbox>
    <span
      v-if="candidate"
      :class="css.candidateRepositoryRow_meta"
      >{{ t(l.open, { count: candidate.openIssues + candidate.openPullRequests }) }}</span
    >
    <span
      v-if="tracked"
      :class="css.candidateRepositoryRow_active"
      >{{ t(l.tracked) }}</span
    >
    <span
      v-else-if="candidate"
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
  min-width: 110px;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-align: right;
  white-space: nowrap;
}

.candidateRepositoryRow_active_recent {
  color: $color-fg-2;
}

// A fixed tick, grey rather than the readonly checkbox's dimmed accent, with the row's name quieter.
.candidateRepositoryRow.candidateRepositoryRow_tracked {
  [role='checkbox'] {
    color: $color-fg-3;
    background: $color-bg-3;
    border-color: $color-border-2;
    opacity: 1;
  }

  .candidateRepositoryRow_repo {
    color: $color-fg-2;
  }
}
</style>
