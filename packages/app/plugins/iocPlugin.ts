import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { defineNuxtPlugin } from 'nuxt/app';

import { installDesktop } from '@/desktop/installDesktop.js';
import { AppLanguageContext } from '@/i18n/AppLanguageContext.js';
import { ProjectPersistence } from '@/projects/ProjectPersistence.js';
import { ProjectViewAnswers } from '@/projects/ProjectViewAnswers.js';
import { RepositoryPersistence } from '@/repos/RepositoryPersistence.js';
import { createIndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import { ItemDetailPersistence } from '@/store/ItemDetailPersistence.js';
import { ItemPersistence } from '@/store/ItemPersistence.js';
import { ItemStore } from '@/store/ItemStore.js';
import { DetailPrefetch } from '@/sync/DetailPrefetch.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import { TrackingPersistence } from '@/tracking/TrackingPersistence.js';

/** Creates the app's IoC container and registers the services every screen relies on. */
export default defineNuxtPlugin({
    name: 'ioc-plugin',
    setup(nuxtApp) {
        const container = createContainer();
        nuxtApp.vueApp.use(IocPlugin, { container });

        // The desktop app's code, in the desktop build only (`__DESKTOP__`); the web builds drop it.
        if (__DESKTOP__) {
            installDesktop();
        }

        container.register(AppLanguageContext);
        // One local copy per user, its parts kept through one connection.
        const persistence = createIndexedDbPersistence();
        container.set(ItemPersistence, persistence);
        container.set(ItemDetailPersistence, persistence);
        container.set(RepositoryPersistence, persistence);
        container.set(TrackingPersistence, persistence);
        container.set(ProjectPersistence, persistence);
        // Started now rather than by the first list: the signed-in user's copy starts loading at once, and it is
        // there to delete when they sign out from a screen that never showed it.
        container.resolve(ItemStore);
        // Polls GitHub while a user is signed in, their copy is loaded and this tab is the one syncing it; stops by
        // itself when they sign out or another tab takes over.
        container.resolve(SyncEngine);
        // Reads ahead the details of "my work" after each poll.
        container.resolve(DetailPrefetch);
        // Answers the saved views GitHub filters, shown in this tab or — while it syncs — in another.
        container.resolve(ProjectViewAnswers);
    },
});
