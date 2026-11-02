import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** A built file the browser loads: its path inside the output folder and its text. */
export interface BuiltFile {
    path: string;
    content: string;
}

/** The HTML, CSS, JavaScript and JSON files of a `nuxt generate` output folder; fails when there are none. */
export async function readBuiltFiles(folder: string): Promise<BuiltFile[]> {
    const files = (await readBuiltPaths(folder)).filter(file => /\.(?:css|html|js|json)$/.test(file));
    if (files.length === 0) {
        throw new Error(`No built files in ${folder}; run \`nuxt generate\` first`);
    }

    return await Promise.all(
        files.map(async file => ({ path: file, content: await readFile(path.join(folder, file), 'utf8') })),
    );
}

/** The path of every file in a `nuxt generate` output folder, images included. */
export async function readBuiltPaths(folder: string): Promise<string[]> {
    return await readdir(folder, { recursive: true });
}
