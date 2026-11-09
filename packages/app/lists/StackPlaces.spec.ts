import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page } from 'vitest/browser';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { sampleStackDescription, SYNC_ENGINE_STACK } from '@/testing/sampleStacks.js';

import StackPlaces from './StackPlaces.vue';

test('a square opened while the row stays mounted (`J`, `K` in the panel) is brought into view', async () => {
    const currentId = ref(SYNC_ENGINE_STACK[0]!.id);
    mount(() =>
        h('div', { style: 'display: flex; width: 160px; height: 36px' }, [
            h(StackPlaces, { pips: sampleStackDescription(SYNC_ENGINE_STACK).pips, currentId: currentId.value }),
        ]),
    );
    const places = page.getByRole('list').element();
    await expect.poll(() => places.scrollLeft).toBe(0);

    currentId.value = SYNC_ENGINE_STACK[9]!.id;
    await nextTick();

    const square = page.getByRole('button', { name: /^10: / }).element();
    await expect.element(square).toHaveAttribute('aria-current', 'true');
    expect(square.getBoundingClientRect().right).toBeLessThanOrEqual(places.getBoundingClientRect().right);
    expect(places.scrollLeft).toBeGreaterThan(0);
});

function mount(render: () => ReturnType<typeof h>) {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(defineComponent({ setup: () => render }));
    app.use(IocPlugin, { container });
    app.use(
        createRouter({
            history: createMemoryHistory(),
            routes: [{ path: '/:path(.*)*', component: defineComponent({ render: () => null }) }],
        }),
    );
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });
}
