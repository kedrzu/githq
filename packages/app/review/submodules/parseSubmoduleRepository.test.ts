import { expect, test } from 'bun:test';

import { parseSubmoduleRepository } from './parseSubmoduleRepository.js';

test('reads the repository from an https, an SSH and an scp-like URL on github.com', () => {
    const urls = [
        'https://github.com/kedrzu/nzyme',
        'https://github.com/kedrzu/nzyme.git',
        'https://github.com/kedrzu/nzyme/',
        'http://www.github.com/kedrzu/nzyme.git',
        'git@github.com:kedrzu/nzyme.git',
        'git@github.com:kedrzu/nzyme',
        'ssh://git@github.com/kedrzu/nzyme.git',
        ' https://github.com/kedrzu/nzyme.git\n',
    ];

    for (const url of urls) {
        expect(parseSubmoduleRepository(url, 'acme/web')).toBe('kedrzu/nzyme');
    }
});

test("resolves a relative URL against the parent's repository, as git does against its remote", () => {
    expect(parseSubmoduleRepository('../nzyme.git', 'acme/web')).toBe('acme/nzyme');
    expect(parseSubmoduleRepository('../nzyme', 'acme/web')).toBe('acme/nzyme');
    expect(parseSubmoduleRepository('../../kedrzu/nzyme.git', 'acme/web')).toBe('kedrzu/nzyme');
});

test('a URL that names no repository on github.com is none', () => {
    const urls = [
        'https://gitlab.com/kedrzu/nzyme.git',
        'git@gitlab.com:kedrzu/nzyme.git',
        'https://github.com.evil.test/kedrzu/nzyme.git',
        'https://github.com/kedrzu',
        'https://github.com/kedrzu/nzyme/tree/main',
        'https://github.com/kedrzu/.git',
        './nzyme',
        '../../../nzyme.git',
        '/srv/git/nzyme.git',
        '',
    ];

    for (const url of urls) {
        expect(parseSubmoduleRepository(url, 'acme/web')).toBeNull();
    }
});
