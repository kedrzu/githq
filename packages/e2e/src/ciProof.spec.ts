import { expect, test } from '@playwright/test';

test('temporary: a failing shard turns the checks red and uploads its results', async ({ page }) => {
    await page.goto('about:blank');
    expect(page.url()).toBe('never');
});
