<!-- A GitHub user's round picture (reka-ui's `Avatar`), with their initials while it loads or when it can't. Named by the login and titled with it on hover, unless `decorative` because the login is written next to it. -->
<script lang="ts" setup>
import { AvatarFallback, AvatarImage, AvatarRoot } from 'reka-ui';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** The login: the name, and where the initials come from. */
    name: string;
    src?: string | null;
    /** `xs` 16px (a row), `sm` 20px (the account), `md` 22px (the rail), `lg` 40px (the Account section of Settings); `sm` when not given. */
    size?: 'lg' | 'md' | 'sm' | 'xs';
    /** The name is shown beside it: the picture is left out of the accessibility tree. */
    decorative?: boolean;
  }>(),
  { src: null, size: 'sm' },
);

// "kedrzu" → "KE", "sigma-clinic" → "SC".
const initials = computed(() => {
  const words = props.name.split(/[\s_.-]+/u).filter(Boolean);
  const [first, second] = words;
  const letters = second ? `${first?.[0] ?? ''}${second[0] ?? ''}` : props.name.slice(0, 2);
  return letters.toUpperCase();
});
</script>

<template>
  <AvatarRoot
    :class="[css.avatar, css[`avatar_${size}`]]"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : name"
    :aria-hidden="decorative || undefined"
    :title="decorative ? undefined : name"
  >
    <AvatarImage
      v-if="src"
      :class="css.avatar_image"
      :src="src"
      alt=""
    />
    <!-- Drawn by CSS, not text: a button holding the avatar is named by its label alone. -->
    <AvatarFallback
      :class="css.avatar_initials"
      :data-initials="initials"
      :delay-ms="src ? 300 : undefined"
    />
  </AvatarRoot>
</template>

<style lang="scss" module="css">
.avatar {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  vertical-align: middle;
  user-select: none;
  background: $color-bg-3;
  border-radius: 50%;
}

.avatar_xs {
  width: 16px;
  height: 16px;
  font-size: 7px;
}

.avatar_sm {
  width: 20px;
  height: 20px;
  font-size: 8px;
}

.avatar_md {
  width: 22px;
  height: 22px;
  font-size: 8.5px;
}

.avatar_lg {
  width: 40px;
  height: 40px;
  font-size: 15px;
}

.avatar_image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar_initials::after {
  content: attr(data-initials);
  font-family: $font-family-mono;
  font-weight: 700;
  line-height: 1;
  color: $color-fg-2;
}
</style>
