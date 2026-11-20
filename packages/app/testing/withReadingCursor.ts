import type { Decorator } from '@storybook/vue3-vite';
import { defineComponent, h, ref } from 'vue';

import { provideReadingCursor } from '@/reading/ReadingCursor.js';

/**
 * A story with the reading cursor on the stop keyed so (`data-reading-stop`), as the item's view provides it. `path`
 * names the stops around it as the page would read them, its own key first, the outermost last (a code thread's
 * comment: `['<comment>', 'thread:<id>', '<review>']`); by default the stop alone.
 */
export function withReadingCursor(key: string, path: readonly string[] = [key]): Decorator {
    return story => {
        const Story = story();
        return defineComponent({
            setup() {
                provideReadingCursor(ref({ key, offset: 0, path }));
                return () => h(Story);
            },
        });
    };
}
