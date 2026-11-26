/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';
import { shallowRef } from 'vue';

import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { ItemStore } from '@/store/ItemStore.js';
import { createFixedPhoneLayout } from '@/testing/createFixedPhoneLayout.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { uniqueLogin } from '@/testing/uniqueLogin.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { PHONE_TYPOGRAPHY, TypographyStore } from './TypographyStore.js';
import { READING_FONTS } from './typographyCatalog.js';

test('the desktop layout draws the settings’ typography as the user changes it, the phone layout always the fixed one', async () => {
    const phone = shallowRef(false);
    const session = createTestSession({ login: uniqueLogin(), answer: () => undefined });
    setIndexedDbPersistence(session.container);
    session.container.set(PhoneLayout, createFixedPhoneLayout(phone));
    session.container.resolve(ItemStore);
    const tracking = session.container.resolve(TrackingStore);
    await tracking.ready();
    const typography = session.container.resolve(TypographyStore);
    let changes = 0;
    tracking.onLocalChange(() => changes++);

    tracking.setTypographyPreset('spaced');
    tracking.setTypography({ role: 'reading', font: 'literata', size: 16 });
    expect(changes).toBe(2);
    expect(typography.applied.reading).toEqual({ font: READING_FONTS[5]!, size: 16, lineHeight: 1.65 });
    expect(typography.applied.code).toMatchObject({ size: 13, lineHeight: 22 });

    // Unchanged: nothing is written, so nothing is synced.
    tracking.setTypography({ role: 'reading', font: 'literata', size: 16 });
    expect(changes).toBe(2);

    phone.value = true;
    expect(typography.applied).toEqual(PHONE_TYPOGRAPHY);

    phone.value = false;
    expect(typography.applied.reading.size).toBe(16);
});
