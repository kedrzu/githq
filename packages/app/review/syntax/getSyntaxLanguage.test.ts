import { expect, test } from 'bun:test';

import { getSyntaxLanguage } from './getSyntaxLanguage.js';

test('goes by a well-known name before the extension, whatever the case or the folder', () => {
    expect(getSyntaxLanguage('docker/Dockerfile')).toBe('dockerfile');
    expect(getSyntaxLanguage('Makefile')).toBe('makefile');
    expect(getSyntaxLanguage('.env')).toBe('bash');
    expect(getSyntaxLanguage('src/App.VUE')).toBe('xml');
    expect(getSyntaxLanguage('a.b/c.test.ts')).toBe('typescript');
});

test('knows nothing of a file with an unknown extension or none', () => {
    expect(getSyntaxLanguage('assets/logo.xyz')).toBe(null);
    expect(getSyntaxLanguage('a.go/LICENSE')).toBe(null);
    expect(getSyntaxLanguage('constructor')).toBe(null);
    expect(getSyntaxLanguage('a.constructor')).toBe(null);
});
