<!-- The tabs beside a screen's title (`ListToolbar`'s `tabs`): a repository's sections, switched through a model, or a project's saved views, each a link — both drawn alike, one bordered group with the current tab filled and the counts dim (CH67, the List / Board switch's look). Each tab's tooltip says where it goes, with its key; a saved view's says under it when GitHub answers it or it was changed on this device (D14–D16). `compact`, when the header has no room for them side by side: one menu button showing the current tab (its icon, name, count and a chevron), opening a menu of every tab with its count and key, the current one checked, and when the caller steps through the tabs on `[` and `]` a hint saying so at its end (CH82, D17); a tab's key, `[` and `]` work there too, as the app's keys run nothing from inside a menu. -->
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
  /** Its key ("1"), for `aria-keyshortcuts`, its tooltip and the compact form's menu; the caller handles the key. */
  readonly keyshortcuts?: string;
  /** Its hint on hover and focus ("Go to Backlog"), its key after it. */
  readonly tooltip?: string;
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
      /** The compact form's hint for `previousTab` and `nextTab` ("Previous / next section"); the caller binds them. */
      readonly stepHint?: string;
    }
  | {
      readonly kind: 'links';
      /** The group's accessible name ("Saved views"). */
      readonly label: string;
      readonly links: readonly HeaderTabsLink[];
      /** The compact form's hint for `previousTab` and `nextTab` ("Previous / next view"); the caller binds them. */
      readonly stepHint?: string;
    };
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Check, ChevronDown, Cloud } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';

import { nextTab, previousTab } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';

import Button from './Button.vue';
import * as l from './HeaderTabs.loc.js';
import Kbd from './Kbd.vue';
import Menu from './Menu.vue';
import MenuItem from './MenuItem.vue';
import MenuLabel from './MenuLabel.vue';
import MenuSeparator from './MenuSeparator.vue';
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
const menuOpen = ref(false);

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
    keyshortcuts: link.keyshortcuts,
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

function pickByKey(event: KeyboardEvent) {
  const entry = findByKey(event);
  if (!entry) {
    return;
  }

  event.preventDefault();
  menuOpen.value = false;
  entry.pick();
}

/** The tab a key pressed in the compact form's menu picks: its own, or the one `[` or `]` steps to. */
function findByKey(event: KeyboardEvent) {
  const all = entries.value;
  const step = getStep(event);
  if (step === 0) {
    return all.find(candidate => candidate.keyshortcuts != null && matchesCommandKey(event, candidate.keyshortcuts));
  }

  const index = all.findIndex(candidate => candidate.current);
  return all[(index + step + all.length) % all.length];
}

/** Which way a key steps through the tabs: -1, 1, or 0 for none — or while the caller doesn't step them. */
function getStep(event: KeyboardEvent) {
  if (props.tabs.stepHint === undefined) {
    return 0;
  }

  if (matchesCommandKey(event, keyOf(previousTab))) {
    return -1;
  }

  return matchesCommandKey(event, keyOf(nextTab)) ? 1 : 0;
}
</script>

<template>
  <Menu
    v-if="compact"
    v-model:open="menuOpen"
    align="start"
    :label="tabs.label"
    @keydown="pickByKey"
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
    <template v-if="tabs.stepHint">
      <MenuSeparator />
      <!-- A hint, not an item: the cursor skips it and its keys pick no tab. -->
      <MenuLabel>
        <span :class="css.headerTabs_stepHint">
          <span :class="css.headerTabs_stepKeys">
            <Kbd :keys="keyOf(previousTab)" />
            <Kbd :keys="keyOf(nextTab)" />
          </span>
          {{ tabs.stepHint }}
        </span>
      </MenuLabel>
    </template>
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
      :text="link.tooltip"
      :kbd="link.keyshortcuts"
      :disabled="!link.tooltip"
    >
      <RouterLink
        :to="link.to"
        :class="css.headerTabs_link"
        :aria-current="link.current ? 'page' : undefined"
        :aria-keyshortcuts="link.keyshortcuts"
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
      <template
        v-if="link.answered || link.modified"
        #note
      >
        <span v-if="link.answered">{{ t(l.answeredNote) }}</span>
        <span v-if="link.modified">{{ t(l.modifiedNote) }}</span>
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

.headerTabs_stepHint {
  display: flex;
  gap: $spacing-8;
  align-items: center;
}

.headerTabs_stepKeys {
  display: flex;
  gap: $spacing-4;
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
