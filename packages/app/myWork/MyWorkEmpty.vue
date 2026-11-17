<!-- What "my work", with all its groups shown, says when every group is in and a filter leaves nothing (K4, K5; first run and loading's `Empty / Nothing there`): a calm, good state that names what was checked, so "empty" can be trusted. With nothing at all, it offers the next useful steps — a new issue, the command menu to jump to a project (K4); with nothing needing the user, it points at the pull requests waiting on others, if any (K5). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import type { LucideIcon } from 'lucide-vue-next';
import { CircleCheckBig, Coffee, Hourglass, Search, SquarePen } from 'lucide-vue-next';
import { computed } from 'vue';

import { APP_KEYS, CommandRegistry } from '@/commands/CommandRegistry.js';
import * as definitions from '@/commands/definitions/index.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import Button from '@/components/Button.vue';
import NothingThere from '@/components/NothingThere.vue';

import type { MyWorkFilter } from './buildMyWork.js';
import * as l from './MyWorkEmpty.loc.js';

const props = defineProps<{
  filter: MyWorkFilter;
  /** How many of the user's pull requests wait on others — "Needs me" points there when there are any. */
  waitingCount: number;
  /** The key that switches to "Waiting on others" (`showFilter`'s). */
  waitingKey?: string;
  /** How many repositories the user tracks: "nothing" names them, or GitHub as a whole without any. */
  trackedCount: number;
}>();

const emit = defineEmits<{
  /** "Waiting on others" chosen from the pointer. */
  showWaiting: [];
}>();

const t = useTranslate();
const registry = useService(CommandRegistry);

/** "New issue" from the app's commands, when it can run here; with its key, should it have one. */
const newIssue = computed(() => registry.findById(`app.${definitions.newIssue.id}`));

const look = computed(
  (): { icon: LucideIcon; tone: 'good' | 'muted'; title: string; detail: string; fact?: string } => {
    switch (props.filter) {
      case 'all':
        return {
          icon: CircleCheckBig,
          tone: 'good',
          title: t(l.nothingTitle),
          detail:
            props.trackedCount > 0 ? t(l.nothingTrackedDetail, { count: props.trackedCount }) : t(l.nothingDetail),
          fact: t(l.nothingFact),
        };
      case 'needsMe':
        return { icon: Coffee, tone: 'good', title: t(l.nothingNeedsYouTitle), detail: t(l.nothingNeedsYouDetail) };
      case 'waitingOnOthers':
        return { icon: Hourglass, tone: 'muted', title: t(l.nothingWaitingTitle), detail: t(l.nothingWaitingDetail) };
      default:
        return assertNever(props.filter);
    }
  },
);
</script>

<template>
  <NothingThere
    place="screen"
    :icon="look.icon"
    :tone="look.tone"
    :title="look.title"
    :detail="look.detail"
    :fact="look.fact"
  >
    <template
      v-if="filter === 'all'"
      #action
    >
      <Button
        v-if="newIssue"
        variant="secondary"
        size="sm"
        :icon="SquarePen"
        :kbd="newIssue.key"
        :keyshortcuts="newIssue.key"
        @click="newIssue && registry.run(newIssue)"
      >
        {{ t(l.newIssue) }}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        :icon="Search"
        :kbd="APP_KEYS.commandMenu"
        :keyshortcuts="formatAriaKeyShortcuts(APP_KEYS.commandMenu)"
        @click="registry.openMenu()"
      >
        {{ t(l.jumpToProject) }}
      </Button>
    </template>
    <template
      v-else-if="filter === 'needsMe' && waitingCount > 0"
      #action
    >
      <Button
        variant="secondary"
        size="sm"
        :icon="Hourglass"
        :kbd="waitingKey"
        :keyshortcuts="waitingKey"
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
  </NothingThere>
</template>

<style lang="scss" module="css">
.myWorkEmpty_hint {
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}
</style>
