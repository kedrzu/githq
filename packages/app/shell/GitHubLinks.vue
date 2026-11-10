<!-- Content whose links to github.com open in githq: a link marked `data-githq-link` (its `href` the app's path) opens in the app on a click — an item through the opened item when there is one (`ItemLinkContext`), so it opens there — and right-clicking it, or the context-menu key on it, opens a menu with "Open" and "Open on GitHub". Anywhere else in the content — text, a link that stays GitHub's — right-click is the browser's own menu, never an app menu around it. On the web a click with a modifier or the middle button is the browser's (a new tab of githq's address); in the desktop app any click opens it here. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { injectContext } from '@nzyme/vue-utils/context.js';
import { ArrowUpRight, Github } from 'lucide-vue-next';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import ContextMenu from '@/components/ContextMenu.vue';
import MenuItem from '@/components/MenuItem.vue';
import { ItemLinkContext } from '@/item/ItemLinkContext.js';
import { Browser } from '@/services/Browser.js';
import { getGitHubUrl } from '@/tracking/trackingRoutes.js';

import { getGitHubLinkTarget, GITHQ_LINK_ATTRIBUTE } from './gitHubLinks.js';
import * as l from './GitHubLinks.loc.js';

defineSlots<{
  /** The content; its links marked `data-githq-link` open in githq. */
  default(): unknown;
}>();

const t = useTranslate();
const router = useRouter();
const browser = useService(Browser);
/** The opened item's: an item linked opens there. */
const items = injectContext(ItemLinkContext, { optional: true });

/** The app's path of the link right-clicked, while the menu may open or is open for it. */
const menuPath = ref<string | null>(null);
const menuOpen = ref(false);

/** The githq link the event happened on, by its app path; `null` anywhere else. */
function findPath(event: Event) {
  const link = event.target instanceof Element ? event.target.closest(`a[${GITHQ_LINK_ATTRIBUTE}]`) : null;
  return link && event.currentTarget instanceof Element && event.currentTarget.contains(link)
    ? link.getAttribute('href')
    : null;
}

/**
 * Before the menu's trigger sees it: on a githq link the menu opens for it; anywhere else the event stops here, so
 * no app menu opens and the browser shows its own.
 */
function onContextMenu(event: MouseEvent) {
  const path = findPath(event);
  if (path === null) {
    event.stopPropagation();
    return;
  }

  menuPath.value = path;
}

function onClick(event: MouseEvent) {
  // The secondary button is the menu's. On the web a modified or middle click is the browser's (githq's address in a
  // new tab or window); the desktop app has no tabs, so there every click opens it here.
  const modified = event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
  if (event.button === 2 || (!__DESKTOP__ && modified)) {
    return;
  }

  const path = findPath(event);
  if (path === null) {
    return;
  }

  event.preventDefault();
  open(path);
}

/** Opens the app's `path`: an item through the opened item when there is one, anything else at its address. */
function open(path: string) {
  // Marked, it is githq's: whether its repository is tracked was asked when it was.
  const item = getGitHubLinkTarget(getGitHubUrl(path), { router, isTracked: () => true })?.item;
  if (item && items) {
    items.open(item);
    return;
  }

  void router.push(path);
}

/**
 * The menu opens only for a link just right-clicked: a long press elsewhere (reka's, on touch) has none and opens
 * nothing. Closed, it forgets the link.
 */
function onMenuOpen(opening: boolean) {
  menuOpen.value = opening && menuPath.value !== null;
  if (!opening) {
    menuPath.value = null;
  }
}

function openMenuPath() {
  if (menuPath.value !== null) {
    open(menuPath.value);
  }
}

function openMenuPathOnGitHub() {
  if (menuPath.value !== null) {
    browser.openInNewTab(getGitHubUrl(menuPath.value));
  }
}
</script>

<template>
  <!-- Two elements: the trigger's own listener runs whatever the trigger does, only one around it can stop the event. -->
  <div
    @contextmenu.capture="onContextMenu"
    @click="onClick"
    @auxclick="onClick"
  >
    <ContextMenu
      :open="menuOpen"
      @update:open="onMenuOpen"
    >
      <div>
        <slot />
      </div>
      <template #content>
        <MenuItem
          :icon="ArrowUpRight"
          @select="openMenuPath"
        >
          {{ t(l.open) }}
        </MenuItem>
        <MenuItem
          :icon="Github"
          @select="openMenuPathOnGitHub"
        >
          {{ t(l.openOnGitHub) }}
        </MenuItem>
      </template>
    </ContextMenu>
  </div>
</template>
