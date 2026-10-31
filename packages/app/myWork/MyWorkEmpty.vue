<!-- What "my work" says when a filter leaves nothing (K4, K5): a calm, good state that names what was checked, so "empty" can be trusted. With nothing at all, it offers the next useful keys — a new issue, the command menu to jump to a project (K4); with nothing needing the user, it points at the pull requests waiting on others, if any (K5). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import type { LucideIcon } from 'lucide-vue-next';
import { CircleCheckBig, Coffee, Hourglass, Search, SquarePen } from 'lucide-vue-next';
import { computed } from 'vue';

import { APP_KEYS, CommandRegistry, NEW_ISSUE_KEY } from '@/commands/CommandRegistry.js';
import { formatCommandKey } from '@/commands/formatCommandKey.js';
import Button from '@/components/Button.vue';
import EmptyState from '@/components/EmptyState.vue';

import type { MyWorkFilter } from './buildMyWork.js';
import * as l from './MyWorkEmpty.loc.js';

const props = defineProps<{
  filter: MyWorkFilter;
  /** How many of the user's pull requests wait on others — "Needs me" points there when there are any. */
  waitingCount: number;
  /** The key that switches to "Waiting on others". */
  waitingKey: string;
  /** How many repositories the user tracks: "nothing" names them, or GitHub as a whole without any. */
  trackedCount: number;
}>();

const emit = defineEmits<{
  /** "Waiting on others" chosen from the pointer. */
  showWaiting: [];
}>();

const t = useTranslate();
const registry = useService(CommandRegistry);

/** "New issue" from the app's commands, when it can run here. */
const newIssue = computed(() => registry.commands.find(command => command.key === NEW_ISSUE_KEY) ?? null);

const look = computed((): { icon: LucideIcon; tone: 'good' | 'calm'; title: string; detail: string } => {
  switch (props.filter) {
    case 'all':
      return {
        icon: CircleCheckBig,
        tone: 'good',
        title: t(l.nothingTitle),
        detail: props.trackedCount > 0 ? t(l.nothingTrackedDetail, { count: props.trackedCount }) : t(l.nothingDetail),
      };
    case 'needsMe':
      return { icon: Coffee, tone: 'calm', title: t(l.nothingNeedsYouTitle), detail: t(l.nothingNeedsYouDetail) };
    case 'waitingOnOthers':
      return { icon: Hourglass, tone: 'calm', title: t(l.nothingWaitingTitle), detail: t(l.nothingWaitingDetail) };
    default:
      return assertNever(props.filter);
  }
});
</script>

<template>
  <EmptyState
    :icon="look.icon"
    :tone="look.tone"
    :title="look.title"
    :detail="look.detail"
  >
    <template
      v-if="filter === 'all'"
      #action
    >
      <div :class="css.myWorkEmpty_keys">
        <Button
          v-if="newIssue"
          variant="ghost"
          size="sm"
          :icon="SquarePen"
          :kbd="formatCommandKey(NEW_ISSUE_KEY).join('')"
          :aria-keyshortcuts="NEW_ISSUE_KEY"
          @click="newIssue && registry.run(newIssue)"
        >
          {{ t(l.newIssue) }}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          :icon="Search"
          :kbd="formatCommandKey(APP_KEYS.commandMenu).join('')"
          :aria-keyshortcuts="APP_KEYS.commandMenu"
          @click="registry.openMenu()"
        >
          {{ t(l.jumpToProject) }}
        </Button>
      </div>
    </template>
    <template
      v-else-if="filter === 'needsMe' && waitingCount > 0"
      #action
    >
      <Button
        variant="outline"
        :icon="Hourglass"
        :kbd="waitingKey"
        :aria-keyshortcuts="waitingKey"
        @click="emit('showWaiting')"
      >
        {{ t(l.pullRequestsWaiting, { count: waitingCount }) }}
        <span
          :class="css.myWorkEmpty_hint"
          aria-hidden="true"
          >{{ t(l.waitingOnOthers) }}</span
        >
      </Button>
    </template>
  </EmptyState>
</template>

<style lang="scss" module="css">
.myWorkEmpty_keys {
  display: flex;
  gap: $spacing-8;
}

.myWorkEmpty_hint {
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}
</style>
