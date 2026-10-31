/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { parseRepositoryName } from './parseRepositoryName.js';

test('`owner/name` gives its owner and name; whatever follows the first slash is the name', () => {
    expect(parseRepositoryName('acme/web')).toEqual({ owner: 'acme', name: 'web' });
    expect(parseRepositoryName('acme/web#12')).toEqual({ owner: 'acme', name: 'web#12' });
    expect(parseRepositoryName('acme')).toEqual({ owner: 'acme', name: '' });
});
