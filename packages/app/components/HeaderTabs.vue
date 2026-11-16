<!-- The tabs beside a screen's title (`ListToolbar`'s `tabs`): a repository's sections, switched through a model, or a project's saved views, each a link. `compact`, when the header has no room for them side by side: one menu button showing the current tab (its icon, name, count and a chevron), opening a menu of every tab with its count and key, the current one checked. -->
<script lang="ts">
import type { LucideIcon } from 'lucide-vue-next';
import type { RouteLocationRaw } from 'vue-router';

/** A tab switched through a model (a repository's section). */
export interface HeaderTabsOption {
  readonly value: string;
  readonly label: string;
  /** Shown on the compact form's button and in its menu. */
  readonly icon?: LucideIcon;
  /** How many it holds, dim after the label; `–` while that is not known yet. */
  readonly count?: number | string;
  /** Its key ("1"), for `aria-keyshortcuts` and the compact form's menu; the caller handles the key. */
  readonly keyshortcuts?: string;
}

/** A tab that is a link (a project's saved view). */
export interface HeaderTabsLink {
  /** Unique among the tabs. */
  readonly key: string;
  readonly label: string;
  readonly to: RouteLocationRaw;
  /** It is the one shown. */
  readonly current: boolean;
  /** Its filter is answered by GitHub: a cloud (K6). */
  readonly answered?: boolean;
  /** Changed on this device: a dot (D13). */
  readonly modified?: boolean;
}

/** The tabs a header shows, by how one is chosen. */
export type HeaderTabsSet =
  | {
      readonly kind: 'model';
      /** The group's accessible name ("Sections"). */
      readonly label: string;
      readonly options: readonly HeaderTabsOption[];
      readonly value: string;
      readonly choose: (value: string) => void;
    }
  | {
      readonly kind: 'links';
      /** The group's accessible name ("Saved views"). */
      readonly label: string;
      readonly links: readonly HeaderTabsLink[];
    };
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Check, ChevronDown, Cloud } from 'lucide-vue-next';
import { computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';

import Button from './Button.vue';
import * as l from './HeaderTabs.loc.js';
import Menu from './Menu.vue';
import MenuItem from './MenuItem.vue';
import SegmentedTabs from './SegmentedTabs.vue';
import type { SegmentedTabsOption } from './SegmentedTabs.vue';

const props = withDefaults(
  defineProps<{
    tabs: HeaderTabsSet;
    /** One menu button instead of the tabs side by side. */
    compact?: boolean;
  }>(),
  { compact: false },
);

const t = useTranslate();
const router = useRouter();

/** Every tab alike, for the compact form. */
const entries = computed(() => {
  const tabs = props.tabs;
  if (tabs.kind === 'model') {
    return tabs.options.map(option => ({
      key: option.value,
      label: option.label,
      icon: option.icon,
      count: option.count,
      keyshortcuts: option.keyshortcuts,
      current: option.value === tabs.value,
      pick: () => tabs.choose(option.value),
    }));
  }

  return tabs.links.map(link => ({
    key: link.key,
    label: link.label,
    icon: link.answered ? Cloud : undefined,
    count: undefined,
    keyshortcuts: undefined,
    current: link.current,
    pick: () => void router.push(link.to),
  }));
});
const current = computed(() => entries.value.find(entry => entry.current));
/** The side-by-side form of a model's tabs: their names, counts and keys, no icons. */
const segments = computed((): SegmentedTabsOption<string>[] =>
  props.tabs.kind === 'model'
    ? props.tabs.options.map(option => ({
        value: option.value,
        label: option.label,
        count: option.count,
        keyshortcuts: option.keyshortcuts,
      }))
    : [],
);
</script>

<template>
  <Menu
    v-if="compact"
    align="start"
    :label="tabs.label"
  >
    <template #trigger>
      <Button
        variant="outline"
        size="sm"
        :icon="current?.icon"
      >
        {{ current?.label ?? tabs.label }}
        <span
          v-if="current?.count != null"
          :class="css.headerTabs_count"
          >{{ current.count }}</span
        >
        <ChevronDown
          :class="css.headerTabs_chevron"
          aria-hidden="true"
        />
      </Button>
    </template>
    <MenuItem
      v-for="entry in entries"
      :key="entry.key"
      :icon="entry.icon"
      :detail="entry.count == null ? undefined : String(entry.count)"
      detail-mono
      :shortcut="entry.keyshortcuts"
      :aria-current="entry.current ? 'true' : undefined"
      @select="entry.pick()"
    >
      {{ entry.label }}
      <template
        v-if="entry.current"
        #status
      >
        <Check
          :class="css.headerTabs_check"
          aria-hidden="true"
        />
      </template>
    </MenuItem>
  </Menu>
  <SegmentedTabs
    v-else-if="tabs.kind === 'model'"
    :class="css.headerTabs"
    :model-value="tabs.value"
    :label="tabs.label"
    :options="segments"
    @update:model-value="tabs.choose"
  />
  <nav
    v-else
    :class="[css.headerTabs, css.headerTabs_links]"
    :aria-label="tabs.label"
  >
    <RouterLink
      v-for="link in tabs.links"
      :key="link.key"
      :to="link.to"
      :class="[css.headerTabs_link, link.current && css.headerTabs_link_current]"
      :aria-current="link.current ? 'page' : undefined"
    >
      <Cloud
        v-if="link.answered"
        :class="css.headerTabs_cloud"
        role="img"
        :aria-label="t(l.answeredByGitHub)"
      />
      {{ link.label }}
      <span
        v-if="link.modified"
        :class="css.headerTabs_dot"
        role="img"
        :aria-label="t(l.modifiedLocally)"
      />
    </RouterLink>
  </nav>
</template>

<style lang="scss" module="css">
.headerTabs {
  padding-left: $spacing-8;
}

.headerTabs_links {
  display: flex;
  flex: none;
  gap: 2px;
  align-items: center;
}

.headerTabs_link {
  @include focus-ring;

  display: inline-flex;
  flex: none;
  gap: 6px;
  align-items: center;
  height: 26px;
  padding: 0 $spacing-10;
  font-size: $font-size-sm;
  color: $color-fg-2;
  text-decoration: none;
  white-space: nowrap;
  border-radius: $radius-md;

  &:hover {
    color: $color-fg;
    background: $color-bg-2;
  }
}

.headerTabs_link_current {
  font-weight: $font-weight-medium;
  color: $color-fg;
  background: $color-bg-3;
}

.headerTabs_cloud {
  width: 13px;
  height: 13px;
  color: $color-purple;
}

.headerTabs_dot {
  width: 6px;
  height: 6px;
  background: $color-accent;
  border-radius: 50%;
}

.headerTabs_count {
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.headerTabs_chevron {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-dim;
}

.headerTabs_check {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-2;
}
</style>
