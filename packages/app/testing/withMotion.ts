import type { Decorator } from '@storybook/vue3-vite';
import { defineComponent, h, onBeforeUnmount } from 'vue';

/**
 * A story with the app's short animations on, as the shell turns them on (`data-motion` on `<html>`, the `motion`
 * mixin), while it is on the page: without it, as in any story, nothing moves.
 */
export const withMotion: Decorator = story => {
    const Story = story();
    return defineComponent({
        setup: () => {
            const root = document.documentElement;
            root.dataset.motion = 'on';
            onBeforeUnmount(() => delete root.dataset.motion);
            return () => h(Story);
        },
    });
};
