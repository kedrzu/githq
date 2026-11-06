import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { AppWindow } from 'lucide-vue-next';
import { useRoute } from 'vue-router';

import type { Command } from '@/commands/CommandTypes.js';
import { Browser } from '@/services/Browser.js';

import { getDesktopLinkUrl } from './getDesktopLinkUrl.js';
import * as l from './useOpenInDesktopCommand.loc.js';

/**
 * "Open in desktop app" (web builds only): opens the screen in the githq desktop app, whether or not this browser opted
 * in to doing it for every link.
 */
export function useOpenInDesktopCommand(): () => Command {
    const t = useTranslate();
    const browser = useService(Browser);
    const route = useRoute();

    return () => ({
        id: 'app.openInDesktop',
        title: t(l.title),
        section: 'app',
        icon: AppWindow,
        run: () => browser.navigate(getDesktopLinkUrl(route.fullPath)),
    });
}
