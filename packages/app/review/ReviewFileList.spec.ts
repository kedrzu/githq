import { composeStories } from '@storybook/vue3-vite';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import * as stories from './ReviewFileList.stories.js';

const { Submodules } = composeStories(stories);

test('lists the folders, then the root, then the submodules under their header, a nested one followed by its folder', async () => {
    await Submodules.run();
    const list = page.getByRole('region', { name: 'Files' }).element();

    // The rows and the labels over them, top to bottom.
    const shown = [...list.querySelectorAll('button[title], li > div')].map(element =>
        element instanceof HTMLButtonElement ? element.title : `[${element.textContent.trim()}]`,
    );
    expect(shown).toEqual(['[src/api]', 'src/api/client.ts', 'README.md', '[Submodules]', 'nzyme', 'vendor/tokens']);

    await expect.element(page.getByTitle('vendor/tokens')).toHaveTextContent(/tokens.*vendor/u);
});
