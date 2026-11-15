import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

import type { CommandParts } from '@/commands/CommandTypes.js';

/**
 * The window width below which the app takes its phone layout (mobile D5). The desktop's sidebar, list and item panel
 * stop fitting below about 650 px; phones in portrait are 375–430 px, tablets in portrait and phones in landscape from
 * about 768 px keep the desktop.
 */
export const PHONE_MAX_WIDTH = 640;

/** What a list screen puts in the phone's command line: the part of the place it shows, with its count (mobile D17). */
export interface PhonePart {
    readonly label: string;
    /** `null` while still arriving, or for a part that has none. */
    readonly count: number | null;
    /** A project view changed on this device (mobile D49): the chip carries a dot. */
    readonly changed?: boolean;
    /** The place's parts, which the command line's menu lists first; read only as the menu draws. */
    readonly parts?: () => CommandParts;
}

/**
 * Whether the app is in its phone layout — the window narrower than {@link PHONE_MAX_WIDTH}, whatever the device
 * (mobile D5) — and what that layout carries between the screens and the shell: whether the places panel is open
 * (mobile D19) and the part the list screen shows, for the command line's chip (mobile D17). Resizing only changes
 * `active`; whether an address is handed off to github.com is decided by the route guard when it is navigated to. The
 * desktop app never takes the phone layout (mobile D6; its window is wider anyway).
 */
export type PhoneLayout = Resolved<typeof PhoneLayout>;
export const PhoneLayout = defineService({
    name: 'PhoneLayout',
    setup() {
        const query = getQuery();
        const activeRef = shallowRef(query?.matches ?? false);
        const placesOpenRef = shallowRef(false);
        const partRef = shallowRef<PhonePart | null>(null);

        query?.addEventListener('change', event => {
            activeRef.value = event.matches;
            if (!event.matches) {
                placesOpenRef.value = false;
            }
        });

        return {
            /** Whether the phone layout is on; reactive. */
            get active() {
                return activeRef.value;
            },
            /** Whether the places panel is open; reactive. */
            get placesOpen() {
                return placesOpenRef.value;
            },
            /** The part the list screen on view shows, for the command line; `null` off a list. Reactive. */
            get part() {
                return partRef.value;
            },
            setPlacesOpen,
            setPart,
        };

        function setPlacesOpen(open: boolean) {
            placesOpenRef.value = open;
        }

        function setPart(part: PhonePart | null) {
            partRef.value = part;
        }
    },
});

declare module 'vue-router' {
    interface RouteMeta {
        /**
         * In the phone layout the screen draws its top bar itself (`PhoneTopBar`: a list's with its options, an item's
         * with back), so the shell draws none.
         */
        ownTopBar?: boolean;
    }
}

function getQuery() {
    if (__DESKTOP__ || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return null;
    }

    return window.matchMedia(`(width < ${PHONE_MAX_WIDTH}px)`);
}
