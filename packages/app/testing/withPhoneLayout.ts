import { useContainer } from '@nzyme/vue-ioc/useContainer.js';
import type { Decorator } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import { PhoneLayout } from '@/shell/PhoneLayout.js';

import { createFixedPhoneLayout } from './createFixedPhoneLayout.js';

/**
 * A story in the phone layout or out of it, whatever the width it is drawn at (`createFixedPhoneLayout`). A story's own
 * decorator wins over its meta's.
 */
export function withPhoneLayout(active: boolean): Decorator {
    return story => {
        const Story = story();
        return defineComponent({
            setup() {
                useContainer().set(PhoneLayout, createFixedPhoneLayout(active));
                return () => h(Story);
            },
        });
    };
}
