<!-- The tabs beside a screen's title (`ListToolbar`'s `tabs`): a repository's sections, switched through a model, or a project's saved views, each a link — both drawn alike, one bordered group with the current tab filled and the counts dim (CH67, the List / Board switch's look). A section's tooltip says where it goes, with its key; a saved view's only when GitHub answers it or it was changed on this device. `compact`, when the header has no room for them side by side: one menu button showing the current tab (its icon, name, count and a chevron), opening a menu of every tab with its count and key, the current one checked. -->
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
  /** Its key ("1"), for `aria-keyshortcuts`, its tooltip and the compact form's menu; the caller handles the key. */
  readonly keyshortcuts?: string;
  /** Its hint on hover and focus ("Go to issues"), its key after it. */
  readonly tooltip?: string;
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
import Tooltip from './Tooltip.vue';

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
/** The compact button's name: the group's, then what it shows ("Sections: Pull requests 15"). */
const compactLabel = computed(() => {
  const shown = current.value;
  if (!shown) {
    return props.tabs.label;
  }

  const tab = shown.count == null ? shown.label : `${shown.label} ${shown.count}`;
  return t(l.compactLabel, { group: props.tabs.label, tab });
});
/** The side-by-side form of a model's tabs: their names, counts, keys and tooltips, no icons. */
const segments = computed((): SegmentedTabsOption<string>[] =>
  props.tabs.kind === 'model'
    ? props.tabs.options.map(option => ({
        value: option.value,
        label: option.label,
        count: option.count,
        keyshortcuts: option.keyshortcuts,
        tooltip: option.tooltip,
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
        :aria-label="compactLabel"
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
    variant="boxed"
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
    <Tooltip
      v-for="link in tabs.links"
      :key="link.key"
      :disabled="!link.answered && !link.modified"
    >
      <RouterLink
        :to="link.to"
        :class="css.headerTabs_link"
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
      <template #content>
        <span v-if="link.answered">{{ t(l.answeredHint) }}</span>
        <span v-if="link.modified">{{ t(l.modifiedHint) }}</span>
      </template>
    </Tooltip>
  </nav>
</template>

<style lang="scss" module="css">
.headerTabs {
  margin-left: $spacing-8;
}

.headerTabs_links {
  @include segmented-box;

  display: flex;
  flex: none;
  align-items: center;
}

.headerTabs_link {
  @include segmented-box-item;

  &[aria-current='page'] {
    @include segmented-box-item-current;
  }
}

.headerTabs_cloud {
  width: 13px;
  height: 13px;
  color: $color-amber;
}

.headerTabs_dot {
  width: 6px;
  height: 6px;
  background: $color-accent;
  border-radius: 50%;
}

.headerTabs_count {
  @include segmented-count;
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
