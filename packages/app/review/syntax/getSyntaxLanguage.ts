import { getFileName } from '../utils/getFileName.js';

/** The languages code is coloured in, each the grammar {@link getSyntaxLanguage} leads to. */
export type SyntaxLanguage =
    | 'bash'
    | 'c'
    | 'cpp'
    | 'csharp'
    | 'css'
    | 'diff'
    | 'dockerfile'
    | 'go'
    | 'ini'
    | 'java'
    | 'json'
    | 'kotlin'
    | 'lua'
    | 'makefile'
    | 'markdown'
    | 'php'
    | 'python'
    | 'ruby'
    | 'rust'
    | 'scss'
    | 'sql'
    | 'swift'
    | 'typescript'
    | 'xml'
    | 'yaml';

const BY_EXTENSION = new Map<string, SyntaxLanguage>(
    Object.entries({
        bash: 'bash',
        c: 'c',
        cc: 'cpp',
        cjs: 'typescript',
        conf: 'ini',
        cpp: 'cpp',
        cs: 'csharp',
        css: 'css',
        cts: 'typescript',
        cxx: 'cpp',
        diff: 'diff',
        go: 'go',
        h: 'c',
        hpp: 'cpp',
        htm: 'xml',
        html: 'xml',
        ini: 'ini',
        java: 'java',
        js: 'typescript',
        json: 'json',
        json5: 'json',
        jsonc: 'json',
        jsx: 'typescript',
        kt: 'kotlin',
        kts: 'kotlin',
        lua: 'lua',
        markdown: 'markdown',
        md: 'markdown',
        mdx: 'markdown',
        mjs: 'typescript',
        mk: 'makefile',
        mts: 'typescript',
        patch: 'diff',
        php: 'php',
        py: 'python',
        rake: 'ruby',
        rb: 'ruby',
        rs: 'rust',
        scss: 'scss',
        sh: 'bash',
        sql: 'sql',
        svelte: 'xml',
        svg: 'xml',
        swift: 'swift',
        toml: 'ini',
        ts: 'typescript',
        tsx: 'typescript',
        vue: 'xml',
        xml: 'xml',
        yaml: 'yaml',
        yml: 'yaml',
        zsh: 'bash',
    }),
);

const BY_NAME = new Map<string, SyntaxLanguage>(
    Object.entries({
        '.bashrc': 'bash',
        '.editorconfig': 'ini',
        '.env': 'bash',
        '.gitconfig': 'ini',
        '.npmrc': 'ini',
        '.zshrc': 'bash',
        brewfile: 'ruby',
        containerfile: 'dockerfile',
        dockerfile: 'dockerfile',
        gemfile: 'ruby',
        makefile: 'makefile',
        rakefile: 'ruby',
    }),
);

/**
 * The language of a file from its name: a well-known name, then the extension; `null` when none is known, which shows
 * as plain text.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getSyntaxLanguage(path: string): SyntaxLanguage | null {
    const name = getFileName(path).toLowerCase();
    const dot = name.lastIndexOf('.');
    return BY_NAME.get(name) ?? (dot === -1 ? undefined : BY_EXTENSION.get(name.slice(dot + 1))) ?? null;
}
