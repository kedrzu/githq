<!-- What a screen, a list's group or a board column says when GitHub won't show its data or can't be reached (first run and loading D6, D8, D12, D18, `Empty / Can't be read · screen | group | column`, ES25): one pattern, its cause picking an amber icon, the status bar's own words for the title, a line and the one action the cause allows — offline and paused resolve by themselves, so they offer none; GitHub failing offers "Try again" (R), hidden or gone — or refusing a tracked copy's changes, told alike — "Open on GitHub" (O). In a group or a column one short line, the header saying what it is; the keys are a screen's only, as a list may have several groups. What it says of a `thing` that is many reads as many (`plural`): "before the commits were read. They come in by themselves at 14:20." (ES22). -->
<script lang="ts">
/** The key of "Try again" (D18), as where settings saving stopped. */
const RETRY_KEY = 'R';

/** The key of "Open on GitHub" (D18). */
const OPEN_KEY = 'O';
</script>

<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import type { LucideIcon } from 'lucide-vue-next';
import { CloudOff, EyeOff, Github, Pause, RotateCw, TriangleAlert } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import type { Command } from '@/commands/CommandTypes.js';
import { useCommands } from '@/commands/useCommands.js';
import { Browser } from '@/services/Browser.js';
import { formatTime } from '@/utils/formatTime.js';

import Button from './Button.vue';
import type { CantBeReadCause } from './CantBeReadCause.js';
import * as l from './CantBeRead.loc.js';
import EmptyState from './EmptyState.vue';

const props = defineProps<{
  place: 'screen' | 'group' | 'column';
  cause: CantBeReadCause;
  /** What hasn't been read, as it reads inside a sentence: "fitloop/webapp's issues", "your work". */
  thing: string;
  /** `thing` is many: "the commits". */
  plural?: boolean;
}>();

const t = useTranslate();
const browser = useService(Browser);
const retrying = ref(false);

const look = computed((): { icon: LucideIcon; title: string; detail: string; note: string } => {
  const { cause, thing, plural } = props;
  switch (cause.kind) {
    case 'offline':
      return {
        icon: CloudOff,
        title: t(l.offlineTitle),
        detail: t(plural ? l.offlineLinePlural : l.offlineLine, { thing }),
        note: t(l.offlineNote),
      };
    case 'paused': {
      const time = formatTime(cause.until);
      return {
        icon: Pause,
        title: t(l.pausedTitle, { time }),
        detail: t(plural ? l.pausedLinePlural : l.pausedLine, { thing, time }),
        note: t(l.pausedNote, { time }),
      };
    }
    case 'failing':
      return {
        icon: TriangleAlert,
        title: t(l.failingTitle),
        detail: t(l.failingLine, { thing }),
        note: t(l.failingNote),
      };
    case 'hidden':
    case 'refused':
      return {
        icon: EyeOff,
        title: t(l.hiddenTitle, { thing }),
        detail: t(l.hiddenLine),
        note: t(l.hiddenNote),
      };
    default:
      return assertNever(cause);
  }
});

const onScreen = computed(() => props.place === 'screen');

useCommands((): Command[] => {
  const { cause } = props;
  if (!onScreen.value) {
    return [];
  }

  switch (cause.kind) {
    case 'failing':
      return [{ id: 'empty.retry', title: t(l.tryAgain), section: 'view', key: RETRY_KEY, run: () => void tryAgain() }];
    case 'hidden':
    case 'refused':
      return [
        {
          id: 'empty.openOnGitHub',
          title: t(l.openOnGitHub),
          section: 'view',
          key: OPEN_KEY,
          icon: Github,
          run: () => browser.openInNewTab(cause.url),
        },
      ];
    default:
      return [];
  }
});

async function tryAgain() {
  if (props.cause.kind !== 'failing' || retrying.value) {
    return;
  }

  retrying.value = true;
  try {
    await props.cause.retry();
  } finally {
    retrying.value = false;
  }
}
</script>

<template>
  <EmptyState
    :place="place"
    :icon="look.icon"
    tone="warning"
    :title="onScreen ? look.title : look.note"
    :detail="look.detail"
  >
    <template
      v-if="cause.kind !== 'offline' && cause.kind !== 'paused'"
      #action
    >
      <Button
        v-if="cause.kind === 'failing'"
        :variant="onScreen ? 'secondary' : 'outline'"
        :size="onScreen ? 'md' : 'sm'"
        :icon="onScreen ? RotateCw : undefined"
        :kbd="onScreen ? RETRY_KEY : undefined"
        :aria-keyshortcuts="onScreen ? RETRY_KEY : undefined"
        :busy="retrying"
        @click="tryAgain"
      >
        {{ t(l.tryAgain) }}
      </Button>
      <Button
        v-else
        :variant="onScreen ? 'secondary' : 'outline'"
        :size="onScreen ? 'md' : 'sm'"
        :icon="onScreen ? Github : undefined"
        :kbd="onScreen ? OPEN_KEY : undefined"
        :aria-keyshortcuts="onScreen ? OPEN_KEY : undefined"
        :link="cause.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t(l.openOnGitHub) }}
      </Button>
    </template>
  </EmptyState>
</template>
