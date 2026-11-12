import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import { useContainer } from '@nzyme/vue-ioc/useContainer.js';
import type { Decorator } from '@storybook/vue3-vite';
import { defineComponent, h, shallowRef } from 'vue';

import { ReviewSubmodules } from '@/review/submodules/ReviewSubmodules.js';
import type { ReviewSubmoduleState } from '@/review/submodules/ReviewSubmodules.js';

/**
 * Content whose submodules' histories are as `state` says, with nothing asked of GitHub: `ReviewSubmodules` in a child
 * of the container around it, so what that one holds (a browser, `withGitHubLinks`'s) stays. Try again on a failed
 * history puts it back on its way.
 */
export function withSubmoduleHistory(state: ReviewSubmoduleState): Decorator {
    return story =>
        defineComponent({
            setup() {
                const held = shallowRef(state);
                const container = createContainer({ parent: useContainer() });
                container.set(ReviewSubmodules, {
                    load: () => {},
                    peek: () => held.value,
                    retry: () => {
                        if (held.value.kind === 'failed') {
                            held.value = { kind: 'loading' };
                        }
                    },
                });
                provideContainer(container);

                const content = story();
                return () => h(content);
            },
        });
}
