import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { onScopeDispose, shallowRef } from 'vue';

/** The part of the window the user sees, for what is pinned above a phone's on-screen keyboard. */
export interface VisualViewportViewModel {
    /** How far the seen part's bottom is above the window's (the keyboard's height while it is up), in pixels. */
    readonly bottomInset: number;
    /** The seen part's height, in pixels: the window's less the keyboard. */
    readonly height: number;
}

/**
 * The visual viewport, followed while the calling component lives: what a phone's on-screen keyboard leaves of the
 * window. The keyboard shrinks only the visual viewport — iOS Safari always, Chrome on Android by default
 * (`interactive-widget=resizes-visual`) — and the layout viewport, which `position: fixed` follows, stays the window's,
 * so what is pinned to the bottom sits `bottomInset` up to stay above the keyboard. Safari also pans the visual
 * viewport to the focused field (`offsetTop`), which the inset takes in. Without the API, nothing is covered.
 * @util
 */
export function useVisualViewport(): VisualViewportViewModel {
    const viewport = window.visualViewport;
    const bottomInset = shallowRef(0);
    const height = shallowRef(window.innerHeight);

    measure();
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    onScopeDispose(() => {
        viewport?.removeEventListener('resize', measure);
        viewport?.removeEventListener('scroll', measure);
    });

    return reactive<VisualViewportViewModel>({ bottomInset, height });

    function measure() {
        if (!viewport) {
            return;
        }

        bottomInset.value = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
        height.value = Math.round(viewport.height);
    }
}
