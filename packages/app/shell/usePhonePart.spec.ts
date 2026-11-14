import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { createApp, defineComponent, h, nextTick, shallowRef } from 'vue';

import { createFixedPhoneLayout } from '@/testing/createFixedPhoneLayout.js';

import type { PhonePart } from './PhoneLayout.js';
import { PhoneLayout } from './PhoneLayout.js';
import { usePhonePart } from './usePhonePart.js';

test('the next list puts its part in before the last one goes, and the last one going leaves it there', async () => {
    const { phone, shown } = mount(true);
    expect(phone.part).toEqual({ label: 'Issues', count: 142 });

    shown.value = 'both';
    await nextTick();
    expect(phone.part).toEqual({ label: 'My work', count: 12 });

    shown.value = 'myWork';
    await nextTick();
    expect(phone.part).toEqual({ label: 'My work', count: 12 });

    shown.value = 'none';
    await nextTick();
    expect(phone.part).toBeNull();
});

test('off the phone layout no part is put in', () => {
    const { phone } = mount(false);
    expect(phone.part).toBeNull();
});

function mount(active: boolean) {
    const container = createContainer();
    const phone = createFixedPhoneLayout(active);
    container.set(PhoneLayout, phone);
    const shown = shallowRef<'both' | 'issues' | 'myWork' | 'none'>('issues');
    const Issues = list({ label: 'Issues', count: 142 });
    const MyWork = list({ label: 'My work', count: 12 });

    const host = document.createElement('div');
    document.body.append(host);
    // In the order a route change mounts them: the next screen before the last one leaves.
    const app = createApp({
        setup: () => () => [
            shown.value === 'issues' || shown.value === 'both' ? h(Issues) : null,
            shown.value === 'myWork' || shown.value === 'both' ? h(MyWork) : null,
        ],
    });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return { phone, shown };
}

function list(part: PhonePart) {
    return defineComponent({
        setup() {
            usePhonePart(() => part);
            return () => h('div', part.label);
        },
    });
}
