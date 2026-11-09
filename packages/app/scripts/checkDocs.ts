import type { BuiltFile } from './readBuiltFiles.js';

/** Where the documentation site (`packages/docs`) lives in a web build's output, copied there by `copyDocs.ts`. */
const DOCS_FOLDER = 'docs/';

/** The pages the Worker cannot do without: the docs' first page at `/docs/` and the page every unknown `/docs/...` answers. */
const DOCS_PAGES = ['docs/index.html', 'docs/404.html'];

/** What is wrong with the docs in a web build's output (`paths`, all its files): empty when both pages are there. */
export function checkDocsPresent(paths: ReadonlySet<string>): string[] {
    return DOCS_PAGES.filter(page => !paths.has(page)).map(page => `${page} (the docs) is missing`);
}

/** What is wrong with the docs in the desktop build's output: any file of them at all. */
export function checkDocsAbsent(paths: readonly string[]): string[] {
    return paths.some(isDocsPath) ? [`${DOCS_FOLDER}: the desktop app has no docs of its own`] : [];
}

/**
 * The app's own files: the built files without the docs. The checks for markers of the app's code look at these only.
 * The docs are a separate VitePress build that imports none of the app's scripts (at most its styles), so the app's development or desktop
 * code cannot reach them, while their prose may well name what a marker spells (a desktop feature, say); and a marker
 * the app must carry must not be found in the docs instead.
 */
export function appFiles(files: readonly BuiltFile[]): BuiltFile[] {
    return files.filter(file => !isDocsPath(file.path));
}

function isDocsPath(path: string) {
    return path === 'docs' || path.startsWith(DOCS_FOLDER);
}
