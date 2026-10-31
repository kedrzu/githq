<!-- The account header of the sidebar: the signed-in user (avatar and login, or the avatar alone on the rail), opening a menu with "Account" (the account page, G9) and "Sign out". -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown, CircleUser, LogOut } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import { ACCOUNT_PATH } from '@/account/accountRoutes.js';
import type { Viewer } from '@/auth/AuthStore.js';
import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';
import Menu from '@/components/Menu.vue';
import MenuItem from '@/components/MenuItem.vue';
import MenuLabel from '@/components/MenuLabel.vue';

import * as l from './AccountMenu.loc.js';

defineProps<{
  viewer: Viewer;
  /** The rail: the avatar alone. */
  compact?: boolean;
}>();

const emit = defineEmits<{
  signOut: [];
}>();

const t = useTranslate();
const router = useRouter();
</script>

<template>
  <Menu>
    <template #trigger>
      <IconButton
        v-if="compact"
        size="md"
        :label="t(l.accountMenu, { login: viewer.login })"
      >
        <Avatar
          :name="viewer.login"
          :src="viewer.avatarUrl"
          size="md"
          decorative
        />
      </IconButton>
      <Button
        v-else
        variant="ghost"
        :class="css.accountMenu_trigger"
        :aria-label="t(l.accountMenu, { login: viewer.login })"
      >
        <Avatar
          :name="viewer.login"
          :src="viewer.avatarUrl"
          decorative
        />
        <span :class="css.accountMenu_login">{{ viewer.login }}</span>
        <ChevronDown
          :class="css.accountMenu_chevron"
          aria-hidden="true"
        />
      </Button>
    </template>
    <MenuLabel>{{ t(l.signedInAs, { login: viewer.login }) }}</MenuLabel>
    <MenuItem
      :icon="CircleUser"
      @select="router.push(ACCOUNT_PATH)"
    >
      {{ t(l.account) }}
    </MenuItem>
    <MenuItem
      :icon="LogOut"
      @select="emit('signOut')"
    >
      {{ t(l.signOut) }}
    </MenuItem>
  </Menu>
</template>

<style lang="scss" module="css">
// Shrinks with a long login, which then ends in "…".
.accountMenu_trigger {
  flex-shrink: 1;
  min-width: 0;
}

.accountMenu_login {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg;
}

.accountMenu_chevron {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}
</style>
