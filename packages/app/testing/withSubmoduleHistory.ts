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
 * history puts it back on its way. The lists expanded are kept for as long as the decorator, across mounts of the story,
 * as the service keeps them across the block's unmounting when it is scrolled away.
 */
export function withSubmoduleHistory(state: ReviewSubmoduleState): Decorator {
    const expanded = shallowRef<ReadonlySet<string>>(new Set());
    return story =>
        defineComponent({
            setup() {
                const held = shallowRef(state);
                const container = createContainer({ parent: useContainer() });
                container.set(ReviewSubmodules, {
                    load: () => {},
                    peek: () => held.value,
                    isExpanded: (change, list) => expanded.value.has(`${change.path}:${list}`),
                    expand: (change, list) => {
                        expanded.value = new Set(expanded.value).add(`${change.path}:${list}`);
                    },
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
