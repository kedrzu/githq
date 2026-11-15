import { defineContext } from '@nzyme/vue-utils/context.js';

/** The choice of a `MenuRadioGroup` in a phone's menu at the bottom (`MenuSheet`), for its `MenuRadioItem`s. */
export interface MenuRadioContext {
    /** The value chosen; reactive. */
    readonly value: string;
    choose(value: string): void;
}

export const MenuRadioContext = defineContext<MenuRadioContext>('MenuRadioContext');
