import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

import { E2E_DESKTOP_PORT } from '../localApp.js';

// Serves the desktop app's build (`packages/app/.output-desktop/public`) for the `desktop` e2e project, as the desktop
// app's window loads it: a file when there is one, `index.html` for any other path (a deep link). Nothing else — the
// desktop app has no Worker, so `/api/*` is a path like any other. Run by `playwright.config.ts`.

const ROOT = path.join(import.meta.dirname, '../../../app/.output-desktop/public');

const HTML = 'text/html; charset=utf-8';

/** The `content-type` of the build's files, by extension; anything else is sent as bytes. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
    '.html': HTML,
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

const server = createServer((request, response) => void respond(request, response));
server.listen(E2E_DESKTOP_PORT, 'localhost');

/** Answers with the build's file at the request's path, or `index.html` when there is none. */
async function respond(request: IncomingMessage, response: ServerResponse) {
    const { type, body } = await readAnswer(request.url ?? '/');
    response.writeHead(200, { 'content-type': type });
    response.end(body);
}

async function readAnswer(url: string) {
    const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
    const file = path.join(ROOT, pathname);
    const inside = file.startsWith(`${ROOT}${path.sep}`);
    const body = inside ? await readFile(file).catch(() => null) : null;
    if (body) {
        return { type: CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream', body };
    }

    return { type: HTML, body: await readFile(path.join(ROOT, 'index.html')) };
}
