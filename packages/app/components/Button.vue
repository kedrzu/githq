<!-- A text button (which size and variant where: `docs/design/githq/buttons.md`) on nzyme's `useButton`: a `click` listener that returns a promise keeps it busy — spinner, `aria-busy`, further clicks ignored — until the promise settles; `type="submit"` submits the surrounding `Form` and is busy while it does. With `link` it is an anchor. An optional leading icon and a trailing keyboard hint (`Kbd`), not drawn where key hints are hidden (`KeyHintsContext`). -->
<script lang="ts">
import { useButton } from '@nzyme/vue-forms/components/useButton.js';
import { defineProp } from '@nzyme/vue-utils/defineProp.js';
import type { LucideIcon } from 'lucide-vue-next';

/**
 * - `primary`: accent fill, the screen's one main action ("Track these", "Create issue").
 * - `light`: light fill, the main action of a page with nothing else on it ("Sign in with GitHub").
 * - `secondary`: raised neutral fill with an outline, next to a primary ("Only my repositories").
 * - `outline`: outline only, quieter tools of a toolbar ("Group: Reason").
 * - `ghost`: no fill until hovered, toolbars and menus' triggers ("Filter").
 * - `link`: text only, inline in a sentence ("Why?") or a row's meta line ("Open on GitHub").
 * - `field`: looks like a text field, for a button that opens one ("Search… ⌘K" in the sidebar).
 * - `danger`: red outline, an action that deletes something ("Sign out and clear").
 * - `destructive`: red fill, the answer to a question that throws something away ("Discard" changes to a comment).
 */
export type ButtonVariant =
  | 'danger'
  | 'destructive'
  | 'field'
  | 'ghost'
  | 'light'
  | 'link'
  | 'outline'
  | 'primary'
  | 'secondary';

/**
 * 24 / 32 / 40 / 48 px tall (`docs/design/githq/buttons.md`): `sm` dense chrome a mouse rarely aims at (toolbars,
 * headers inside an item), `md` every place whose purpose is an action, `lg` a page's single call to action, `xl` the
 * landing page.
 */
export type ButtonSize = 'lg' | 'md' | 'sm' | 'xl';

/** nzyme's button props (`type`, `busy`, `disabled`, `link`, `noWait`) and the look. */
export const ButtonProps = {
  ...useButton.props,
  /** `secondary` when not given. */
  variant: defineProp<ButtonVariant>(),
  /** `md` when not given. */
  size: defineProp<ButtonSize>(),
  /** `accent`: the label in the accent colour, a text link that does something ("Show 4 more commits", "Log"). */
  tone: defineProp<'accent'>(),
  /** Leading icon, a lucide component. */
  icon: defineProp<LucideIcon>(),
  /** Keyboard hint after the label, in the app's notation (`Mod+Enter`). Only drawn: give the shortcut to `keyshortcuts` too. */
  kbd: defineProp<string>(),
  /** The keys that press it, as `aria-keyshortcuts` writes them (`formatAriaKeyShortcuts`). */
  keyshortcuts: defineProp<string>(),
  /** Shown but not possible yet: dimmed and announced as unavailable (`aria-disabled`), still focusable. */
  unavailable: defineProp<boolean>({ type: Boolean, default: false }),
  /** Fills its container's width, the content at the start and the hint at the end — a sidebar entry, a field. */
  block: defineProp<boolean>({ type: Boolean, default: false }),
};
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { injectContext } from '@nzyme/vue-utils/context.js';
import { LoaderCircle } from 'lucide-vue-next';
import { computed } from 'vue';

import * as l from './Button.loc.js';
import Kbd from './Kbd.vue';
import { KeyHintsContext } from './KeyHintsContext.js';

const props = defineProps(ButtonProps);
defineEmits(useButton.emits);
defineSlots<{ default?(): unknown }>();

const { Button, busy, disabled } = useButton();
const t = useTranslate();
const hints = injectContext(KeyHintsContext, { optional: true });

/** The hint drawn after the label: none where key hints are hidden, the button's end then padded as without one. */
const shownKbd = computed(() => (hints?.hidden ? null : props.kbd));
const variant = computed(() => props.variant ?? 'secondary');
const kbdTone = computed(() => {
  switch (variant.value) {
    case 'primary':
      return 'onFill';
    case 'light':
      return 'onLight';
    case 'destructive':
      return 'onDanger';
    default:
      return 'default';
  }
});
</script>

<template>
  <Button
    :class="[
      css.button,
      css[`button_${variant}`],
      css[`button_${size ?? 'md'}`],
      tone && css[`button_${tone}`],
      block && css.button_block,
      shownKbd && css.button_keyed,
      busy && css.button_busy,
      disabled && css.button_disabled,
    ]"
    :aria-busy="busy || undefined"
    :aria-disabled="(link && disabled) || unavailable || undefined"
    :aria-keyshortcuts="keyshortcuts ?? undefined"
    :data-button-size="size ?? 'md'"
    :data-button-variant="variant"
  >
    <!-- Hidden, not removed, while busy: the button keeps its width under the spinner. -->
    <span :class="css.button_content">
      <component
        :is="icon"
        v-if="icon"
        :class="[css.button_icon, css.button_leadIcon]"
        aria-hidden="true"
      />
      <slot />
      <Kbd
        v-if="shownKbd"
        :class="css.button_kbd"
        :tone="kbdTone"
        :size="size === 'sm' ? 'sm' : 'md'"
        :keys="shownKbd"
      />
    </span>
    <span
      v-if="busy"
      :class="css.button_spinner"
    >
      <LoaderCircle
        :class="[css.button_icon, css.button_spin]"
        aria-hidden="true"
      />
      <span :class="css.button_busyText">{{ t(l.busy) }}</span>
    </span>
  </Button>
</template>

<style lang="scss" module="css">
// Each size sets `--button-size-padding-block`, `--button-size-padding-inline`, `--button-size-radius` and
// `--button-icon-size`; the variants that draw differently (`ghost`, `link`, `field`) override them, and the rules here
// and `.button_keyed` consume them, so a joined control's hooks work at every size.
.button {
  @include focus-ring;

  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: var(--button-size-padding-block) var(--button-size-padding-inline);
  // A caller joining another control to its end sets `--button-padding-end`, `--button-radius` and drops its end
  // border with `--button-border-end-width: 0` (a split button's menu).
  padding-inline-end: var(--button-padding-end, var(--button-size-padding-inline));
  font-family: $font-family-sans;
  font-weight: $font-weight-medium;
  line-height: 18px;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  background: none;
  border: 1px solid transparent;
  border-inline-end-width: var(--button-border-end-width, 1px);
  border-radius: var(--button-radius, var(--button-size-radius));
}

.button_content {
  display: inline-flex;
  gap: $spacing-7;
  align-items: center;
  min-width: 0;

  .button_busy & {
    opacity: 0;
  }
}

.button_icon {
  flex: none;
  width: var(--button-icon-size);
  height: var(--button-icon-size);
}

// An icon passed in the label (a trailing chevron, the external-link mark) at the size's icon size, under any class of
// the caller's own (no specificity): lucide's own 24px would make the button taller.
:where(.button_content > svg) {
  flex: none;
  width: var(--button-icon-size);
  height: var(--button-icon-size);
}

// The leading icon, not the busy spinner: a caller tints it with `--button-icon-color` (the action's state colour).
.button_leadIcon {
  color: var(--button-icon-color, currentcolor);
}

.button_block {
  display: flex;
  width: 100%;
  justify-content: flex-start;
  text-align: left;

  .button_content {
    flex: 1;
  }

  .button_kbd {
    margin-left: auto;
  }
}

// 24px: 3 + 16 + 3 and the border.
.button_sm {
  --button-size-padding-block: 3px;
  --button-size-padding-inline: #{$spacing-7};
  --button-size-radius: #{$radius-md};
  --button-icon-size: 14px;

  font-size: $font-size-xs;
  line-height: 16px;

  .button_content {
    gap: $spacing-6;
  }
}

// 32px: 6 + 18 + 6 and the border.
.button_md {
  --button-size-padding-block: #{$spacing-6};
  --button-size-padding-inline: 11px;
  --button-size-radius: 7px;
  --button-icon-size: 16px;

  font-size: $font-size-md;
}

// 40px: 10 + 18 + 10 and the border.
.button_lg {
  --button-size-padding-block: #{$spacing-10};
  --button-size-padding-inline: 15px;
  --button-size-radius: 7px;
  --button-icon-size: 16px;

  font-size: $font-size-lg;
}

// 48px: 13 + 20 + 13 and the border.
.button_xl {
  --button-size-padding-block: 13px;
  --button-size-padding-inline: 21px;
  --button-size-radius: #{$radius-xl};
  --button-icon-size: 18px;

  font-size: 16px;
  line-height: 20px;

  .button_content {
    gap: $spacing-10;
  }
}

.button_primary {
  color: $color-on-light;
  background: $color-accent;

  &:hover {
    background: color-mix(in srgb, #{$color-accent} 88%, white);
  }
}

.button_light {
  color: $color-on-light;
  background: $color-button-light;

  &:hover {
    background: $color-button-light-hover;
  }
}

.button_secondary {
  color: $color-fg;
  background: $color-bg-3;
  border-color: $color-border-2;

  &:hover {
    background: $color-border;
  }
}

.button_outline {
  color: $color-fg-2;
  border-color: $color-border;

  &:hover {
    color: $color-fg;
    background: $color-bg-2;
  }
}

.button_danger {
  color: $color-red;
  background: rgba($color-red, 0.06);
  border-color: rgba($color-red, 0.45);

  &:hover {
    background: rgba($color-red, 0.14);
  }
}

.button_destructive {
  color: $color-on-emphasis;
  background: $color-red-emphasis;

  &:hover {
    background: color-mix(in srgb, #{$color-red-emphasis} 88%, black);
  }
}

.button_ghost {
  color: $color-fg-2;

  // Hovered, or its menu open.
  &:hover,
  &[aria-expanded='true'] {
    color: $color-fg;
    background: $color-bg-3;
  }

  // A narrower inline padding than the other variants'; the height is the size's.
  &.button_md {
    --button-size-padding-inline: #{$spacing-7};
  }
}

// Outside the size scale: the font and line of the text it sits in, no padding.
.button_link {
  --button-size-padding-block: 0;
  --button-size-padding-inline: 0;
  --button-size-radius: #{$radius-sm};

  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  color: $color-fg-2;
  border: none;

  &:hover {
    color: $color-fg;
  }
}

// The size's height; the inline padding and the look of a text field.
.button_field {
  --button-size-padding-inline: #{$spacing-8};
  --button-size-radius: #{$radius-md};

  font-size: $font-size-sm;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
  cursor: text;
  background: $color-bg;
  border-color: $color-border;

  .button_icon {
    color: $color-fg-3;
  }
}

.button_busy {
  cursor: progress;
}

// After the variants: the colour is the tone's, hovered too. Disabled, below, still dims it.
.button_accent {
  color: $color-accent;

  &:hover {
    color: $color-accent;
  }

  &.button_link:hover {
    text-decoration: underline;
  }
}

// Disabled, or shown but not possible yet (`unavailable`: `aria-disabled`, still focusable): no hover, dim.
.button_disabled,
.button[aria-disabled='true'] {
  cursor: default;

  &.button_primary,
  &.button_light,
  &.button_secondary {
    opacity: 0.5;
  }

  &.button_outline,
  &.button_ghost,
  &.button_link {
    color: $color-fg-dim;
    background: none;
  }

  &.button_primary:hover {
    background: $color-accent;
  }

  &.button_light:hover {
    background: $color-button-light;
  }

  &.button_secondary:hover {
    background: $color-bg-3;
  }
}

// With a key at its end, the key sits as far from the end as from the top and bottom: the hint is as tall as the
// label's line, so the end padding is the block padding. After `.button`, at every size and variant.
.button_keyed {
  padding-inline-end: var(--button-padding-end, var(--button-size-padding-block));
}

// Over the hidden content, centred in the button.
.button_spinner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.button_spin {
  animation: button-spin 0.8s linear infinite;
}

.button_busyText {
  @include visually-hidden;
}

@keyframes button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
