import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './MergePanel.stories.js';

const { BeingMerged, BeingRead, MergedMeanwhile, MethodGone, NotAllowed, Ready, Refused, RequiredFailed } =
    composeStories(stories);

test('PM8: ⌘↵ merges before the read arrives, with no commit text — GitHub writes its default (D6)', async () => {
    await BeingRead.run();

    await expect.element(panel()).toHaveTextContent('Reading');
    await expect.element(panel()).toHaveTextContent("GitHub's proposed message is on its way");
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    await expect.element(page.getByTestId('sent')).toHaveTextContent('{"method":"SQUASH"}');
    await expect.element(panel()).not.toBeInTheDocument();
});

test('PM3d: E edits; Esc leaves the field keeping the edit, a second Esc closes; only the edited title is sent', async () => {
    await Ready.run();

    await userEvent.keyboard('e');
    const title = page.getByRole('textbox', { name: 'Commit title' });
    await expect.element(title).toHaveFocus();
    await userEvent.clear(title);
    await userEvent.type(title, 'Retry Stripe webhooks with a dead letter table');

    await userEvent.keyboard('{Escape}');
    await expect.element(title).not.toBeInTheDocument();
    await expect.element(panel()).toHaveTextContent('Retry Stripe webhooks with a dead letter table');
    await expect.element(panel()).toHaveTextContent('Edited');
    // The keys stay the panel's, out of the screen's reach below.
    expect(document.activeElement?.closest('[data-no-commands]')).not.toBeNull();
    expect(document.querySelector('[data-layer]')).not.toBeNull();

    await userEvent.keyboard('{Escape}');
    await expect.element(panel()).not.toBeInTheDocument();
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test('⌘↵ from the editor sends the edited title and leaves the untouched message to GitHub', async () => {
    await Ready.run();

    await userEvent.keyboard('e');
    await userEvent.type(page.getByRole('textbox', { name: 'Commit title' }), ', with a dead letter table');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    await expect
        .element(page.getByTestId('sent'))
        .toHaveTextContent(
            '{"method":"SQUASH","title":"Retry Stripe webhook delivery on 5xx (#477), with a dead letter table"}',
        );
});

test('1 2 3 switch the method, and the primary follows it', async () => {
    await Ready.run();

    await userEvent.keyboard('2');
    await expect.element(page.getByRole('button', { name: /^Merge commit/u })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(panel()).toHaveTextContent('Merge pull request #477 from fitloop/retry-stripe-5xx');

    await userEvent.keyboard('3');
    await expect.element(panel()).toHaveTextContent('one by one, with their own messages');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('{"method":"REBASE"}');
});

test('PM9: a method the read takes away is never left chosen — the default takes over, said once', async () => {
    await MethodGone.run();

    await expect.element(panel()).toHaveTextContent('Merge commit');
    document.querySelector<HTMLElement>('[tid="arrive"]')?.click();

    await expect.element(panel()).toHaveTextContent("Merge commit is gone: a ruleset on main doesn't allow it");
    await expect
        .element(page.getByRole('button', { name: 'Squash', exact: true }))
        .toHaveAttribute('aria-pressed', 'true');
    await expect.element(page.getByRole('button', { name: /^Merge commit/u })).not.toBeInTheDocument();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('{"method":"SQUASH"}');
});

test('PM25: refused at once, the panel stays with the edited text and GitHub’s reason; ⌘↵ tries again', async () => {
    await Refused.run();

    await userEvent.keyboard('e');
    await userEvent.type(page.getByRole('textbox', { name: 'Commit title' }), ' now');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    await expect.element(page.getByRole('alert')).toHaveTextContent('Repository rule violations found');
    await expect.element(panel()).toHaveTextContent('GitHub refused the merge');
    await expect
        .element(page.getByRole('textbox', { name: 'Commit title' }))
        .toHaveValue('Retry Stripe webhook delivery on 5xx (#477) now');
    await expect.element(page.getByRole('button', { name: /Try again/u })).toBeEnabled();
});

test('PM4a: a required check that failed holds the merge — tagged and first, and ⌘↵ does nothing', async () => {
    await RequiredFailed.run();

    await expect.element(panel()).toHaveTextContent("Can't merge yetA required check failed");
    const rows = page.getByRole('listitem').elements();
    expect(rows.map(row => row.textContent)).toEqual([
        expect.stringMatching(/^ci \/ test \(node 20\)Required/u),
        expect.stringMatching(/^Vercel \/ preview.*doesn't stop the merge/u),
    ]);

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');

    await userEvent.keyboard('c');
    await expect.element(panel()).toHaveTextContent('Required · 5');
    await expect.element(panel()).toHaveTextContent('Others · 4');
});

test('PM24: reopened while being merged, it says so and offers nothing to repeat', async () => {
    await BeingMerged.run();

    await expect.element(panel()).toHaveTextContent('Being merged');
    // The method it was sent with, from the merge on its way; the commit text sent is not kept.
    await expect.element(panel()).toHaveTextContent('MethodSquash');
    await expect.element(panel()).not.toHaveTextContent('Commit');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
    expect(page.getByRole('button', { name: /merge/iu }).elements()).toEqual([]);
});

test('found merged meanwhile, the primary says merged — not that the viewer cannot merge here; without write access it does', async () => {
    await MergedMeanwhile.run();

    await expect.element(page.getByRole('button', { name: 'Merged' })).toBeDisabled();
    await expect.element(panel()).not.toHaveTextContent("You can't merge in this repository");
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test('without write access the primary says the viewer cannot merge in this repository', async () => {
    await NotAllowed.run();

    await expect.element(page.getByRole('button', { name: "You can't merge in this repository" })).toBeDisabled();
});

function panel() {
    return page.getByRole('dialog', { name: 'Merge fitloop/api#477' });
}
