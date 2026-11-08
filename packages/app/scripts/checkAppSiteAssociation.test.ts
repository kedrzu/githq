import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { checkAppSiteAssociation } from './checkAppSiteAssociation.js';

const APP_ID = '36227N57ZP.dev.githq.desktop';

function file(components: readonly object[], appId = APP_ID) {
    return JSON.stringify({ applinks: { details: [{ appIDs: [appId], components }] } });
}

describe('checkAppSiteAssociation', () => {
    test('the file we serve passes', async () => {
        const content = await readFile(
            path.join(import.meta.dirname, '../public/.well-known/apple-app-site-association'),
            'utf8',
        );

        expect(checkAppSiteAssociation(content, ['favicon.svg', 'robots.txt', '_nuxt/entry.js'])).toEqual([]);
    });

    test('claiming everything takes the landing page, sign-in and the static files away from the browser', () => {
        const problems = checkAppSiteAssociation(file([{ '/': '/*' }]), ['new-file.png']);

        expect(problems).toContain('apple-app-site-association: claims /, which must stay in the browser');
        expect(problems).toContain('apple-app-site-association: claims /login, which must stay in the browser');
        expect(problems).toContain('apple-app-site-association: claims /new-file.png, which must stay in the browser');
    });

    test('excluding every path with a dot gives away a repository with a dot in its name', () => {
        const problems = checkAppSiteAssociation(file([{ '/': '/*.*', exclude: true }, { '/': '/*' }]), []);

        expect(problems).toContain('apple-app-site-association: does not claim /vercel/next.js/pull/7');
    });

    test('another app, or not JSON, is reported', () => {
        expect(checkAppSiteAssociation(file([], 'ABC.other.app'), [])).toContain(
            `apple-app-site-association: does not name ${APP_ID}`,
        );
        expect(checkAppSiteAssociation('not json', [])).toEqual([
            'apple-app-site-association: not the JSON Apple reads',
        ]);
    });
});
