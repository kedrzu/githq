import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import * as stories from './Sidebar.stories.js';

const { OnRepositoryIssues } = composeStories(stories);

test("a tracked repository's row is current on any of its lists, not only on its own address", async () => {
    await OnRepositoryIssues.run();

    await expect.element(page.getByRole('link', { name: /^kedrzu\/githq/ })).toHaveAttribute('aria-current', 'page');
    await expect.element(page.getByRole('link', { name: /^kedrzu\/skills/ })).not.toHaveAttribute('aria-current');
});
