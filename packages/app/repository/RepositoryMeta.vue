<!-- Whether a repository is public or private, beside its title: a lock when private; nothing while it is not known. -->
<script lang="ts" setup>
import { Lock } from 'lucide-vue-next';

import { useRepositoryMeta } from './useRepositoryMeta.js';

const props = defineProps<{
  /** `null` while nothing of it is in the local copy to tell. */
  isPrivate: boolean | null;
}>();

const meta = useRepositoryMeta(() => props.isPrivate);
</script>

<template>
  <span :class="css.repositoryMeta">
    <Lock
      v-if="isPrivate"
      :class="css.repositoryMeta_icon"
      aria-hidden="true"
    />
    {{ meta }}
  </span>
</template>

<style lang="scss" module="css">
.repositoryMeta {
  display: inline-flex;
  gap: $spacing-5;
  align-items: center;
  font-size: $font-size-sm;
  color: $color-fg-dim;
  white-space: nowrap;
}

.repositoryMeta_icon {
  flex: none;
  width: 12px;
  height: 12px;
}
</style>
