<!-- What a screen, a list's group or a board column says when GitHub won't show its data or can't be reached (first run and loading D6, D8, D12, D18, `Empty / Can't be read · screen | group | column`, ES25): one pattern, its cause picking an amber icon, the status bar's own words for the title, a line and the one action the cause allows — offline and paused resolve by themselves, so they offer none, and on a screen say why in a mono chip (`api.github.com → unreachable`, `retry after 14:20`); GitHub failing offers "Try again" (Enter, `tryAgain`), hidden or gone, or GitHub refusing to list a tracked copy's changes — in words of its own, close to the status bar's, as the repository is shown — "Open on GitHub" (O). In a group or a column one short line, the header saying what it is; the keys are a screen's only, as a list may have several groups. What it says of a `thing` that is many reads as many (`plural`): "before the commits were read. They come in by themselves at 14:20." (ES22). -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import type { LucideIcon } from 'lucide-vue-next';
import { CloudOff, EyeOff, Github, Pause, RotateCw, TriangleAlert } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import { bindCommand } from '@/commands/bindCommand.js';
import type { BoundCommand } from '@/commands/CommandTypes.js';
import { openOnGitHub, tryAgain as tryAgainCommand } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
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

const look = computed((): { icon: LucideIcon; title: string; detail: string; note: string; fact?: string } => {
  const { cause, thing, plural } = props;
  switch (cause.kind) {
    case 'offline':
      return {
        icon: CloudOff,
        title: t(l.offlineTitle),
        detail: t(plural ? l.offlineLinePlural : l.offlineLine, { thing }),
        note: t(l.offlineNote),
        fact: t(l.offlineFact),
      };
    case 'paused': {
      const time = formatTime(cause.until);
      return {
        icon: Pause,
        title: t(l.pausedTitle, { time }),
        detail: t(plural ? l.pausedLinePlural : l.pausedLine, { thing, time }),
        note: t(l.pausedNote, { time }),
        fact: t(l.pausedFact, { time }),
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
      return {
        icon: EyeOff,
        title: t(l.hiddenTitle, { thing }),
        detail: t(l.hiddenLine),
        note: t(l.hiddenNote),
      };
    case 'refused':
      return {
        icon: EyeOff,
        title: t(l.refusedTitle, { thing }),
        detail: t(l.refusedLine, { thing }),
        note: t(l.refusedNote),
      };
    default:
      return assertNever(cause);
  }
});

const onScreen = computed(() => props.place === 'screen');

useCommands((): BoundCommand[] => {
  const { cause } = props;
  if (!onScreen.value) {
    return [];
  }

  switch (cause.kind) {
    case 'failing':
      // The screen's: an item opened beside it keeps the keyboard, its Enter the item's (commands D13).
      return [bindCommand(tryAgainCommand, { place: 'cantBeRead', section: 'view', run: () => void tryAgain() }, t)];
    case 'hidden':
    case 'refused':
      return [
        bindCommand(
          openOnGitHub,
          { place: 'cantBeRead', section: 'view', run: () => browser.openInNewTab(cause.url) },
          t,
        ),
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
    :fact="look.fact"
  >
    <template
      v-if="cause.kind !== 'offline' && cause.kind !== 'paused'"
      #action
    >
      <Button
        v-if="cause.kind === 'failing'"
        :variant="onScreen ? 'secondary' : 'outline'"
        size="sm"
        :icon="onScreen ? RotateCw : undefined"
        :kbd="onScreen ? keyOf(tryAgainCommand) : undefined"
        :keyshortcuts="onScreen ? keyOf(tryAgainCommand) : undefined"
        :busy="retrying"
        @click="tryAgain"
      >
        {{ t(l.tryAgain) }}
      </Button>
      <Button
        v-else
        :variant="onScreen ? 'secondary' : 'outline'"
        size="sm"
        :icon="onScreen ? Github : undefined"
        :kbd="onScreen ? keyOf(openOnGitHub) : undefined"
        :keyshortcuts="onScreen ? keyOf(openOnGitHub) : undefined"
        :link="cause.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t(openOnGitHub.title) }}
      </Button>
    </template>
  </EmptyState>
</template>
