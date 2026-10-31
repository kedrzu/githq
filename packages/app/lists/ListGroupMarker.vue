<!-- What a list group's header or a board column's head shows before its name: a colour dot (a label, an option, an issue type), a person's avatar, or an icon. Decoration: the name says it all. -->
<script lang="ts" setup>
import Avatar from '@/components/Avatar.vue';

import type { ListGroupMarker } from './ListTypes.js';

defineProps<{
  marker: ListGroupMarker;
}>();
</script>

<template>
  <span
    v-if="marker.kind === 'color'"
    :class="css.listGroupMarker_dot"
    :style="{ background: `#${marker.color}` }"
    aria-hidden="true"
  />
  <Avatar
    v-else-if="marker.kind === 'avatar'"
    :name="marker.name"
    :src="marker.src"
    size="xs"
    decorative
  />
  <component
    :is="marker.icon"
    v-else
    :class="css.listGroupMarker_icon"
    aria-hidden="true"
  />
</template>

<style lang="scss" module="css">
.listGroupMarker_dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.listGroupMarker_icon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}
</style>
