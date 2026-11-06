import { assert } from '@nzyme/utils/assert.js';
import { inject, provide, ref } from 'vue';
import type { InjectionKey } from 'vue';

/**
 * The open toasts of one `Toaster`, in the order they opened. The newest is drawn at the bottom and is the only one
 * whose keys work and show; when it closes, the one before it takes them.
 */
export interface ToasterStack {
    /** Puts a toast that just opened on top; returns its arrival, which only grows. */
    add(): number;
    /** Takes out a toast that closed or went away. */
    remove(arrival: number): void;
    /** Whether the toast of this arrival is the newest open one. Reactive. */
    isNewest(arrival: number): boolean;
}

const ToasterStackKey: InjectionKey<ToasterStack> = Symbol('ToasterStack');

/** Gives the `Toaster`'s toasts their stack. */
export function provideToasterStack(): void {
    const open = ref<number[]>([]);
    let last = 0;

    provide(ToasterStackKey, {
        add() {
            last++;
            open.value = [...open.value, last];
            return last;
        },
        remove(arrival) {
            open.value = open.value.filter(item => item !== arrival);
        },
        isNewest(arrival) {
            return open.value.at(-1) === arrival;
        },
    });
}

/** The stack of the `Toaster` a `Toast` is in; a toast outside one is a mistake. */
export function injectToasterStack(): ToasterStack {
    const stack = inject(ToasterStackKey, null);
    assert(stack, 'A Toast must be inside a Toaster.');
    return stack;
}
