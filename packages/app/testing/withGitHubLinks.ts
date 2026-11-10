import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import type { Decorator } from '@storybook/vue3-vite';
import { defineComponent, h, provide, ref } from 'vue';
import { createMemoryHistory, createRouter, routerKey } from 'vue-router';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { ItemLinkContext } from '@/item/ItemLinkContext.js';
import { ITEM_PAGE_PATHS } from '@/item/itemRoutes.js';
import { Browser } from '@/services/Browser.js';
import { REPOSITORY_PATH } from '@/tracking/trackingRoutes.js';

/** What {@link withGitHubLinks} sets up. */
export interface WithGitHubLinksOptions {
    /** An opened item around the content (`ItemLinkContext`), saying which item it was asked to open. */
    readonly inItem?: boolean;
}

/**
 * Content with links to github.com, in a world where they can open: a router of githq's item and repository
 * screens (`meta.gitHubScreen`, as `app/router.options.ts` has them; any other address is GitHub's), and a browser
 * whose new tabs only get counted. Under the content one line each says where the app went (`tid="at"`), what opened
 * on GitHub (`tid="on-github"`) and, in an item, the item it opened (`tid="opened"`).
 */
export function withGitHubLinks(options: WithGitHubLinksOptions = {}): Decorator {
    return story =>
        defineComponent({
            setup() {
                const empty = defineComponent({ render: () => null });
                const router = createRouter({
                    history: createMemoryHistory(),
                    routes: [
                        ...ITEM_PAGE_PATHS.map(path => ({
                            path,
                            component: empty,
                            meta: { itemPage: true, gitHubScreen: true },
                        })),
                        { path: REPOSITORY_PATH, name: 'repository', component: empty, meta: { gitHubScreen: true } },
                        { path: '/:path(.*)*', component: empty },
                    ],
                });
                provide(routerKey, router);

                const onGitHub = ref('nothing');
                const container = createContainer();
                container.set(LanguageContext, () => APP_LANGUAGE);
                container.set(Browser, {
                    ...createContainer().resolve(Browser),
                    openInNewTab: url => (onGitHub.value = url),
                });
                provideContainer(container);

                const opened = ref('nothing');
                if (options.inItem) {
                    provideContext(ItemLinkContext, {
                        open: reference => (opened.value = `${reference.owner}/${reference.name}#${reference.number}`),
                    });
                }

                // Once: a new component each render would remount the content at every line that changes under it.
                const content = story();
                return () =>
                    h('div', [
                        h(content),
                        h('p', { tid: 'at' }, `At: ${router.currentRoute.value.fullPath}`),
                        h('p', { tid: 'on-github' }, `On GitHub: ${onGitHub.value}`),
                        options.inItem ? h('p', { tid: 'opened' }, `Opened: ${opened.value}`) : null,
                    ]);
            },
        });
}
