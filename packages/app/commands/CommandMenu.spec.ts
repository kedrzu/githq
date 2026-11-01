import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Locator } from 'vitest/browser';

import * as stories from './CommandMenu.stories.jsx';

const { OnOpenItem, OnOpenItemAsContributor, Typing, SeveralSelected, Closed, MatchInHiddenWord } =
    composeStories(stories);

/** The texts a line draws marked, in order. */
function getMarks(row: Locator) {
    return Array.from(row.element().querySelectorAll('mark'), mark => mark.textContent);
}

test("E1/E2: Enter opens an action's submenu — both projects' status — and picking sets that project's field", async () => {
    await OnOpenItem.run();

    const menu = page.getByRole('listbox', { name: 'Command menu' });
    await expect
        .element(menu.getByRole('option', { name: /Set status… In progress · Platform Q4/u }))
        .toBeInTheDocument();
    await expect.element(page.getByRole('textbox', { name: 'Type a command or search…' })).toHaveFocus();

    // The first line is the item's first action; Enter opens its submenu.
    await userEvent.keyboard('{Enter}');
    const submenu = page.getByRole('listbox', { name: 'Assign to…' });
    await expect.element(submenu).toBeInTheDocument();
    await userEvent.keyboard('{Backspace}');

    await userEvent.keyboard('set stat');
    await userEvent.keyboard('{Tab}');
    const statuses = page.getByRole('listbox', { name: 'Set status…' });
    await expect.element(statuses.getByRole('group', { name: 'Platform Q4' })).toBeInTheDocument();
    await expect.element(statuses.getByRole('group', { name: 'Bug triage' })).toBeInTheDocument();

    await userEvent.click(statuses.getByRole('group', { name: 'Bug triage' }).getByRole('option', { name: 'Done' }));
    await expect
        .element(page.getByTestId('asked'))
        .toHaveTextContent(
            '{"kind":"projectField","projectItemId":"PVTI_Bug triage","fieldId":"status","value":{"kind":"singleSelect","optionId":"status-done"}}',
        );
    await expect.element(menu).not.toBeInTheDocument();
});

test('E4 deep match: typing a value offers it directly, Enter sets it', async () => {
    await OnOpenItem.run();

    await userEvent.keyboard('in rev');
    const first = page.getByRole('option').first();
    await expect.element(first).toHaveTextContent(/Set status → In review\s*Platform Q4/u);
    await userEvent.keyboard('{Enter}');

    await expect
        .element(page.getByTestId('asked'))
        .toHaveTextContent(
            '{"kind":"projectField","projectItemId":"PVTI_Platform Q4","fieldId":"status","value":{"kind":"singleSelect","optionId":"status-review"}}',
        );
});

test('Escape steps back out of a submenu, then closes; ⌫ in the empty field takes the item out', async () => {
    await OnOpenItem.run();

    await userEvent.keyboard('label{ArrowRight}');
    await expect.element(page.getByRole('listbox', { name: 'Add or remove labels…' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('listbox', { name: 'Command menu' })).toBeInTheDocument();

    await userEvent.keyboard('{Backspace}');
    await expect.element(page.getByRole('option', { name: /Set status/u })).not.toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: /Collapse sidebar/u })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('listbox', { name: 'Command menu' })).not.toBeInTheDocument();
});

test("K1b: what a contributor can't edit is not offered — no labels, no assignees, no milestone", async () => {
    await OnOpenItemAsContributor.run();

    await expect.element(page.getByRole('option', { name: /Comment/u })).toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: /labels/u })).not.toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: /Assign to/u })).not.toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: /milestone/u })).not.toBeInTheDocument();
});

test('E4: the selection\'s actions say "2 of 3 editable"; its key runs the same action the menu shows it with', async () => {
    await SeveralSelected.run();

    await expect
        .element(page.getByRole('option', { name: /Add or remove labels… 2 of 3 editable/u }))
        .toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: /Set status…/u })).toHaveTextContent('S');
    await userEvent.keyboard('{Escape}');

    // S has no picker of its own here: it opens the menu at its submenu, the projects' statuses.
    await userEvent.keyboard('s');
    const statuses = page.getByRole('listbox', { name: 'Set status…' });
    await userEvent.click(statuses.getByRole('option', { name: 'In review' }));
    await expect
        .element(page.getByTestId('asked'))
        .toHaveTextContent(
            '{"kind":"projectFieldInProject","projectId":"PVT_Platform Q4","fieldId":"status","value":{"kind":"singleSelect","optionId":"status-review"}}',
        );
});

test('⌘K opens the menu; a single key typed in it is text, not its action', async () => {
    await Closed.run();

    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}');
    await expect.element(page.getByRole('textbox', { name: 'Type a command or search…' })).toHaveFocus();
    await userEvent.keyboard('[[');
    await expect.element(page.getByRole('textbox', { name: 'Type a command or search…' })).toHaveValue('[');
    await expect.element(page.getByTestId('sidebar')).toHaveTextContent('expanded');
});

test('E3: places and items from the local copy by name and number; an untracked owner/name opens its repository', async () => {
    await Typing.run();

    await userEvent.keyboard('plat');
    await expect.element(page.getByRole('group', { name: 'Projects' }).getByRole('option')).toHaveLength(2);

    await userEvent.clear(page.getByRole('textbox', { name: 'Type a command or search…' }));
    await userEvent.keyboard('portal#1187{Enter}');
    await expect.element(page.getByTestId('went')).toHaveTextContent('sigma-clinic/portal#1187');

    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}sigma-clinic/platform-infra');
    await expect
        .element(page.getByRole('option', { name: /sigma-clinic\/platform-infra not tracked/u }))
        .toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByTestId('went')).toHaveTextContent('/sigma-clinic/platform-infra');
});

test('E5: nothing typed draws no marks', async () => {
    await OnOpenItem.run();

    await expect.element(page.getByRole('option', { name: /Set status/u }).first()).toBeInTheDocument();
    expect(document.querySelectorAll('mark')).toHaveLength(0);
});

test("E5: the letters typed are marked in a title, a detail and a reference, and the line's name stays", async () => {
    await Typing.run();
    const field = page.getByRole('textbox', { name: 'Type a command or search…' });

    await userEvent.keyboard('plat');
    const inTitle = page.getByRole('option', { name: 'Platform Q4 sigma-clinic', exact: true });
    await expect.element(inTitle).toBeInTheDocument();
    expect(getMarks(inTitle)).toEqual(['Plat']);

    // A project's owner is its detail: marked where it stands, no separate word.
    await userEvent.clear(field);
    await userEvent.keyboard('sigma');
    const inDetail = page.getByRole('option', { name: 'Platform Q4 sigma-clinic', exact: true });
    await expect.element(inDetail).toBeInTheDocument();
    expect(getMarks(inDetail)).toEqual(['sigma']);

    await userEvent.clear(field);
    await userEvent.keyboard('portal#1187');
    const inReference = page.getByRole('option', {
        name: 'Calendar shows wrong timezone for recurring visits portal#1187',
        exact: true,
    });
    await expect.element(inReference).toBeInTheDocument();
    expect(getMarks(inReference)).toEqual(['1187']);
});

test('E5: a line found by a word it does not show shows that word after its title, marked', async () => {
    await MatchInHiddenWord.run();

    const row = page.getByRole('option', { name: /^Assign to…/u });
    await expect.element(row).toHaveTextContent(/^Assign to…\s*assignees/iu);
    expect(getMarks(row)).toEqual(['assignees']);
});

test('E5: a found option marks its value, not the action leading it; a submenu marks its options', async () => {
    await OnOpenItem.run();

    await userEvent.keyboard('in rev');
    const found = page.getByRole('option').first();
    await expect.element(found).toHaveTextContent(/Set status → In review\s*Platform Q4/u);
    expect(getMarks(found)).toEqual(['In', 'rev']);

    await userEvent.clear(page.getByRole('textbox', { name: 'Type a command or search…' }));
    await userEvent.keyboard('set stat{Tab}rev');
    const statuses = page.getByRole('listbox', { name: 'Set status…' });
    const option = statuses
        .getByRole('group', { name: 'Platform Q4' })
        .getByRole('option', { name: 'In review', exact: true });
    await expect.element(option).toBeInTheDocument();
    expect(getMarks(option)).toEqual(['rev']);
});

test('E5: a submenu option found by its detail marks the detail', async () => {
    await OnOpenItem.run();

    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('listbox', { name: 'Assign to…' })).toBeInTheDocument();
    await userEvent.keyboard('you');
    const option = page.getByRole('option', { name: /^kedrzu you/u });
    await expect.element(option).toBeInTheDocument();
    expect(getMarks(option)).toEqual(['you']);
});

test('typing finds an item with a typo, words in another order and without diacritics', async () => {
    await Typing.run();
    const field = page.getByRole('textbox', { name: 'Type a command or search…' });

    await userEvent.keyboard('reactivty');
    await expect.element(page.getByRole('option', { name: /Keep reactivity when the sidebar/u })).toBeInTheDocument();

    await userEvent.clear(field);
    await userEvent.keyboard('webhook retry');
    const reordered = page.getByRole('option', { name: /^Retry Stripe webhook delivery on 5xx/u });
    await expect.element(reordered).toBeInTheDocument();
    expect(getMarks(reordered)).toEqual(['Retry', 'webhook']);

    await userEvent.clear(field);
    await userEvent.keyboard('zolty');
    const folded = page.getByRole('option', { name: /^Żółty label is unreadable/u });
    await expect.element(folded).toBeInTheDocument();
    expect(getMarks(folded)).toEqual(['Żółty']);
});

test('E5: above 5 words a line is still found, unmarked', async () => {
    await Typing.run();

    await userEvent.keyboard('retry stripe webhook delivery on 5xx');
    const row = page.getByRole('option', { name: /^Retry Stripe webhook delivery on 5xx/u });
    await expect.element(row).toBeInTheDocument();
    expect(getMarks(row)).toEqual([]);
});
