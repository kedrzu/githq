import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { useRoute } from 'vue-router';

import { bindCommand } from '@/commands/bindCommand.js';
import type { Command } from '@/commands/CommandTypes.js';
import { openInDesktop } from '@/commands/definitions/index.js';
import { Browser } from '@/services/Browser.js';

import { getDesktopLinkUrl } from './getDesktopLinkUrl.js';

/**
 * "Open in desktop app" (web builds only): opens the screen in the githq desktop app, whether or not this browser opted
 * in to doing it for every link.
 */
export function useOpenInDesktopCommand(): () => Command {
    const t = useTranslate();
    const browser = useService(Browser);
    const route = useRoute();

    return () =>
        bindCommand(
            openInDesktop,
            { section: 'app', run: () => browser.navigate(getDesktopLinkUrl(route.fullPath)) },
            t,
        );
}
