<!-- A stack's pips (D6, D14, D16): one per pull request, first to last, each in its own state — a missing one hollow while the copy is incomplete. Beside an entry holding a share of the stack's open pull requests, or on a lone row's marker, only those of the entry or the row are drawn in their state: the stack's other open ones are hollow (SP24). The pip of the row's own pull request is tall (SP13), and so is that of the one opened over the list (D14). One with the viewer's draft review carries an amber dot (code review D28). Narrower beyond 12. Decoration: the words beside them say how the stack stands. -->
<script lang="ts" setup>
import { computed } from 'vue';

import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { StackPip } from '@/store/stacks/describeStack.js';

/** Beyond this many pull requests the pips narrow (D14). */
const MAX_WIDE_PIPS = 12;

const props = withDefaults(
  defineProps<{
    pips: readonly StackPip[];
    /** The ids of the open pull requests drawn in their state, the stack's other open ones hollow; `null` for all. */
    filled?: ReadonlySet<string> | null;
    /** The id of the pull request whose pip is tall. */
    current?: string | null;
  }>(),
  { filled: null, current: null },
);

/** How each pip is drawn. */
interface ShownPip {
  readonly kind: StackPip['kind'] | 'hollow';
  readonly tall: boolean;
  /** The viewer has a draft review on it (code review D28). */
  readonly draft: boolean;
}

const shown = computed(() =>
  props.pips.map((pip): ShownPip => {
    if (pip.kind === 'missing') {
      return { kind: 'missing', tall: false, draft: false };
    }

    const { filled } = props;
    const hollow = filled !== null && isOpenPullRequest(pip.pullRequest) && !filled.has(pip.pullRequest.id);
    return {
      kind: hollow ? 'hollow' : pip.kind,
      tall: pip.pullRequest.id === props.current,
      draft: pip.pullRequest.pendingReview !== null,
    };
  }),
);
const narrow = computed(() => props.pips.length > MAX_WIDE_PIPS);
</script>

<template>
  <span
    :class="[css.stackPips, narrow && css.stackPips_narrow]"
    aria-hidden="true"
  >
    <span
      v-for="(pip, index) in shown"
      :key="index"
      :class="[
        css.stackPips_pip,
        css[`stackPips_pip_${pip.kind}`],
        pip.tall && css.stackPips_pip_tall,
        pip.draft && css.stackPips_pip_withDraft,
      ]"
    />
  </span>
</template>

<style lang="scss" module="css">
.stackPips {
  display: inline-flex;
  flex: none;
  gap: $spacing-2;
  align-items: center;
}

.stackPips_pip {
  box-sizing: border-box;
  width: 8px;
  height: 4px;
  border: 1px solid transparent;
  border-radius: 2px;

  .stackPips_narrow & {
    width: 4px;
  }
}

.stackPips_pip_tall {
  height: 10px;
}

// Scaled from the amber dot on the stack bar's square (`Stack bar / Place · soft, draft`) to what a pip's height leaves.
.stackPips_pip_withDraft {
  position: relative;

  &::after {
    position: absolute;
    top: -3px;
    right: -2px;
    width: 5px;
    height: 5px;
    content: '';
    background: $color-amber;
    border-radius: 50%;
    box-shadow: 0 0 0 1px $color-bg;
  }
}

.stackPips_pip_merged {
  background: $color-purple;
}

.stackPips_pip_ready {
  background: $color-green;
}

.stackPips_pip_broken {
  background: $color-red;
}

.stackPips_pip_moving,
.stackPips_pip_merging {
  background: $color-amber;
}

.stackPips_pip_waiting {
  background: $color-fg-3;
}

.stackPips_pip_draft {
  border-color: $color-fg-3;
}

.stackPips_pip_closed {
  border-color: $color-red;
}

.stackPips_pip_missing,
.stackPips_pip_hollow {
  border-color: $color-border-2;
}
</style>
