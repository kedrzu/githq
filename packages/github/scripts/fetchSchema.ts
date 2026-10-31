/**
 * Downloads GitHub's public GraphQL schema (SDL, as published for the docs) to `src/schema.graphql`.
 * GitHub publishes the SDL itself, so there is no introspection and no token needed. `codegen.yml`
 * reads the committed file: run this to refresh the schema, then `bun run codegen` to regenerate the SDK.
 *
 * Run with: `bun run schema`
 */
import { writeFile } from 'node:fs/promises';

const SCHEMA_URL = 'https://docs.github.com/public/fpt/schema.docs.graphql';
const OUTPUT_PATH = new URL('../src/schema.graphql', import.meta.url);

const response = await fetch(SCHEMA_URL);

if (!response.ok) {
    throw new Error(`Schema fetch failed: ${response.status} ${response.statusText}`);
}

await writeFile(OUTPUT_PATH, await response.text());

console.log(`Schema written to ${OUTPUT_PATH.pathname}`);
