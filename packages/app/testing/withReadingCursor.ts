import type { Decorator } from '@storybook/vue3-vite';
import { defineComponent, h, ref } from 'vue';

import { provideReadingCursor } from '@/reading/ReadingCursor.js';

/** A story with the reading cursor on the stop keyed so (`data-reading-stop`), as the item's view provides it. */
export function withReadingCursor(key: string): Decorator {
    return story => {
        const Story = story();
        return defineComponent({
            setup() {
                provideReadingCursor(ref({ key, offset: 0 }));
                return () => h(Story);
            },
        });
    };
}
