import type { Language } from '@nzyme/i18n/Language.js';
import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { defineService } from '@nzyme/ioc/Service.js';

/** The language of the app's texts: githq speaks English only. */
export const APP_LANGUAGE: Language = 'en';

/** Language of the app's texts: always {@link APP_LANGUAGE}. */
export const AppLanguageContext = defineService({
    name: 'AppLanguageContext',
    implements: LanguageContext,
    setup() {
        return () => APP_LANGUAGE;
    },
});
