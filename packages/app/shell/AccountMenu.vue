<!-- The signed-in user at the very bottom of the sidebar (avatar and login, or the avatar alone on the rail), opening a menu — upwards, or to the right on the rail — with who is signed in, "Settings" with its key and "Sign out". While syncing the settings stopped (settings-sync T9, T10) an amber dot sits on the avatar, and "Settings" says "Syncing stopped", shows no key (`,` opens plain Settings) and opens straight on Saving to GitHub. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronUp, LogOut, Settings } from 'lucide-vue-next';
import { computed } from 'vue';
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
import { getSettingsPath, SETTINGS_PATH } from '@/settings/settingsRoutes.js';

import * as l from './AccountMenu.loc.js';

const props = defineProps<{
  viewer: Viewer;
  /** The rail: the avatar alone. */
  compact?: boolean;
  /** Syncing the settings stopped: the dot on the avatar, and Settings leads to why. */
  settingsSyncStopped?: boolean;
}>();

const emit = defineEmits<{
  signOut: [];
}>();

const t = useTranslate();
const router = useRouter();

const label = computed(() =>
  props.settingsSyncStopped
    ? t(l.accountMenuSyncStopped, { login: props.viewer.login })
    : t(l.accountMenu, { login: props.viewer.login }),
);

function openSettings() {
  void router.push(props.settingsSyncStopped ? getSettingsPath('saving') : SETTINGS_PATH);
}
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
        :label="label"
      >
        <span :class="css.accountMenu_avatar">
          <Avatar
            :name="viewer.login"
            :src="viewer.avatarUrl"
            size="md"
            decorative
          />
          <span
            v-if="settingsSyncStopped"
            :class="css.accountMenu_stopped"
          />
        </span>
      </IconButton>
      <Button
        v-else
        variant="ghost"
        block
        :class="css.accountMenu_trigger"
        :aria-label="label"
      >
        <span :class="css.accountMenu_avatar">
          <Avatar
            :name="viewer.login"
            :src="viewer.avatarUrl"
            decorative
          />
          <span
            v-if="settingsSyncStopped"
            :class="css.accountMenu_stopped"
          />
        </span>
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
        :shortcut="settingsSyncStopped ? undefined : APP_KEYS.settings"
        @select="openSettings"
      >
        {{ t(l.settings) }}
        <template
          v-if="settingsSyncStopped"
          #status
        >
          <span
            :class="css.accountMenu_statusDot"
            aria-hidden="true"
          />
          <span :class="css.accountMenu_status">{{ t(l.syncStopped) }}</span>
        </template>
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

.accountMenu_avatar {
  position: relative;
  display: flex;
  flex: none;
}

// On the avatar's corner, ringed in the sidebar's colour.
.accountMenu_stopped {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 8px;
  height: 8px;
  background: $color-amber;
  border-radius: 50%;
  box-shadow: 0 0 0 1.5px $color-bg-2;
}

.accountMenu_statusDot {
  flex: none;
  width: 6px;
  height: 6px;
  background: $color-amber;
  border-radius: 50%;
}

.accountMenu_status {
  color: $color-amber;
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
