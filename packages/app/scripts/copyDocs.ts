import { cp, rm } from 'node:fs/promises';
import path from 'node:path';

// Runs after `nuxt generate` in the production and local builds (`package.json`): puts the documentation site
// (`packages/docs`, built by VitePress with base `/docs/`) into the output the Worker serves, as `docs/`, where it
// answers githq.dev/docs (`packages/worker/src/docs.ts`). The build script builds the docs first, through Nx. The
// desktop build never runs it: the desktop app has no docs of its own and opens githq.dev/docs in the browser.
// Usage: `bun scripts/copyDocs.ts <output folder>`, the folder relative to `packages/app` (`.output`, `.output-local`).

const DOCS_BUILD = path.join(import.meta.dirname, '../../docs/dist');

async function copyDocs(output: string) {
    const target = path.join(import.meta.dirname, '..', output, 'public/docs');
    await rm(target, { recursive: true, force: true });
    await cp(DOCS_BUILD, target, { recursive: true });
    console.info(`Docs copied into ${path.relative(process.cwd(), target)}.`);
}

if (import.meta.main) {
    const [output] = process.argv.slice(2);
    if (!output) {
        throw new Error('Usage: bun scripts/copyDocs.ts <output folder>');
    }
    await copyDocs(output);
}
