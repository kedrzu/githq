import { defineContext } from '@nzyme/vue-utils/context.js';
import type { FunctionalComponent } from 'vue';

/** A submenu drilled into on a phone: what replaces the menu's entries until the way back. */
export interface MenuSheetLevel {
    /** Its name, drawn in the sheet's head (the submenu entry's text). */
    readonly heading: FunctionalComponent;
    /** Its entries. */
    readonly content: FunctionalComponent;
    /** The entry that opened it, which takes the focus again on the way back. */
    readonly entry: HTMLElement | null;
    /** Left: stepped back from, or the sheet closed. */
    leave(): void;
}

/**
 * A menu's entries shown on a phone, in a menu at the bottom (`MenuSheet`, mobile D45). Provided by the sheet; an entry
 * (`MenuItem`, `MenuSub`, …) that finds it draws itself as the sheet's row instead of reka-ui's menu item, so the
 * caller's entries stay one list for both.
 */
export interface MenuSheetContext {
    /** An entry was picked: the sheet closes. */
    close(): void;
    /** A submenu's entry was tapped: its entries replace the sheet's. */
    drill(level: MenuSheetLevel): void;
}

export const MenuSheetContext = defineContext<MenuSheetContext>('MenuSheetContext');
