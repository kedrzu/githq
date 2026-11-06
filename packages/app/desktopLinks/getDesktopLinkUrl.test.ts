/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { getDesktopLinkUrl } from './getDesktopLinkUrl.js';

test('a screen\'s address becomes a githq link with its path, query and fragment, and "/" the bare scheme', () => {
    expect(getDesktopLinkUrl('/kedrzu/githq/pull/1?x=1#c')).toBe('githq://kedrzu/githq/pull/1?x=1#c');
    expect(getDesktopLinkUrl('/')).toBe('githq://');
    expect(getDesktopLinkUrl('/settings?tab=account')).toBe('githq://settings?tab=account');
});
