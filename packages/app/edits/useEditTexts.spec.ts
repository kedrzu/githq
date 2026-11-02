import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { createApp } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { matchText } from '@/testing/matchText.js';

import type { Edit } from './EditTypes.js';
import type { EditTexts } from './useEditTexts.js';
import { useEditTexts } from './useEditTexts.js';

test("stacked PRs SP7: the status bar names a stack's merge on its way by its repository and how many pull requests go", () => {
    const texts = mountEditTexts();

    expect(texts.sending([merge('mlaine/tasklet#17')])).toMatch(matchText('Merge on the way · mlaine/tasklet#17'));
    expect(texts.sending([merge('mlaine/tasklet#17'), merge('mlaine/tasklet#15'), merge('mlaine/tasklet#16')])).toMatch(
        matchText('Merge on the way · mlaine/tasklet, 3 pull requests'),
    );
    // Merges in two repositories are no stack's: counted as changes.
    expect(texts.sending([merge('mlaine/tasklet#17'), merge('fitloop/api#4')])).toMatch(
        matchText('Sending 2 changes · 2 items'),
    );
});

/** A merge of the pull request `reference` on its way. */
function merge(reference: string): Edit {
    return { itemId: `PR_${reference}`, reference, subject: { kind: 'merged' }, optimistic: { item: item => item } };
}

/** The edits' words, as a component of the app reads them. */
function mountEditTexts(): EditTexts {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    let texts: EditTexts | undefined;
    const app = createApp({
        setup: () => {
            texts = useEditTexts();
            return () => null;
        },
    });
    app.use(IocPlugin, { container });
    app.mount(document.createElement('div'));
    onTestFinished(() => app.unmount());
    if (!texts) {
        throw new Error('The texts were not read.');
    }

    return texts;
}
