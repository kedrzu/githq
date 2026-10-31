import type { Container } from '@nzyme/ioc/Container.js';
import { Logger } from '@nzyme/logging/Logger.js';

import { TokenVault } from '@/auth/TokenVault.js';
import { Browser } from '@/services/Browser.js';

import { createDesktopTokenVault } from './DesktopTokenVault.js';
import { interceptExternalLinks, withExternalLinks } from './externalLinks.js';
import type { ExternalLinksOptions } from './externalLinks.js';
import { NativeBridge } from './NativeBridge.js';

/**
 * Prepares the app for the desktop app's window (`packages/desktop`) before any of its services start: the token
 * from the OS credential store, and pages outside the app opened in the system browser. The one way in for the
 * desktop code (`desktop/`): only the desktop build calls it (`__DESKTOP__`, `plugins/iocPlugin.ts`), so the web
 * builds drop it with everything it imports.
 */
export async function installDesktop(container: Container) {
    // Throws outside the desktop app, before anything starts.
    const bridge = container.resolve(NativeBridge);
    const logger = container.resolve(Logger);

    // Read before the session starts: it reads its token at once, to open straight into the app.
    const stored = await bridge.loadToken();
    container.set(TokenVault, createDesktopTokenVault({ bridge, stored, logger }));

    const external: ExternalLinksOptions = {
        appUrl: window.location.href,
        open: url => {
            bridge.openExternal(url).catch((error: unknown) => {
                logger.warn('Could not open a page in the browser', { error });
            });
        },
    };
    container.set(Browser, withExternalLinks(container.resolve(Browser), external));
    interceptExternalLinks(document, external);
}
