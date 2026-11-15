import { defineContext } from '@nzyme/vue-utils/context.js';

/**
 * Whether key hints are drawn in a part of the app: provided by a screen that shows none in some layout — an opened item
 * or the toasts on a phone (mobile D52) — so every `Kbd` inside it, a button's, a property's, a tooltip's or a menu's, draws nothing
 * there, and a screen elsewhere (a hint line "Esc Collapse") keeps its keys. `aria-keyshortcuts` still names them.
 */
export interface KeyHintsContext {
    /** No key hint is drawn; reactive. */
    readonly hidden: boolean;
}

export const KeyHintsContext = defineContext<KeyHintsContext>('KeyHintsContext');
