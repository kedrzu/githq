<!-- The signed-in user at the very bottom of the sidebar (avatar and login, or the avatar alone on the rail), opening a menu — upwards, or to the right on the rail — with who is signed in, "Settings" with its key and "Sign out". -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronUp, LogOut, Settings } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import type { Viewer } from '@/auth/AuthStore.js';
import { APP_KEYS } from '@/commands/CommandRegistry.js';
import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';
import Menu from '@/components/Menu.vue';
import MenuItem from '@/components/MenuItem.vue';
import MenuLabel from '@/components/MenuLabel.vue';
import MenuSeparator from '@/components/MenuSeparator.vue';
import { SETTINGS_PATH } from '@/settings/settingsRoutes.js';

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
  <Menu
    :side="compact ? 'right' : 'top'"
    :align="compact ? 'end' : 'start'"
  >
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
        block
        :class="css.accountMenu_trigger"
        :aria-label="t(l.accountMenu, { login: viewer.login })"
      >
        <Avatar
          :name="viewer.login"
          :src="viewer.avatarUrl"
          decorative
        />
        <span :class="css.accountMenu_login">{{ viewer.login }}</span>
        <ChevronUp
          :class="css.accountMenu_chevron"
          aria-hidden="true"
        />
      </Button>
    </template>
    <div :class="compact ? css.accountMenu_items_compact : css.accountMenu_items">
      <MenuLabel>{{ t(l.signedInAs, { login: viewer.login }) }}</MenuLabel>
      <MenuItem
        :icon="Settings"
        :shortcut="APP_KEYS.settings"
        @select="router.push(SETTINGS_PATH)"
      >
        {{ t(l.settings) }}
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        :icon="LogOut"
        @select="emit('signOut')"
      >
        {{ t(l.signOut) }}
      </MenuItem>
    </div>
  </Menu>
</template>

<style lang="scss" module="css">
// The whole row, its avatar in line with the rows above; a long login ends in "…".
.accountMenu_trigger {
  padding: 5px 7px;
}

// As wide as the row it opens from, less the menu's padding and border.
.accountMenu_items {
  min-width: calc(var(--reka-dropdown-menu-trigger-width) - 10px);
}

.accountMenu_items_compact {
  min-width: 230px;
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
