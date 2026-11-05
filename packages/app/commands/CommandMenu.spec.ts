import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Locator } from 'vitest/browser';

import * as stories from './CommandMenu.stories.jsx';

const {
    OnOpenItem,
    OnOpenItemInRepository,
    OnOpenItemAsContributor,
    Typing,
    SeveralSelected,
    Closed,
    MatchInHiddenWord,
    SearchBeforeTyping,
    SearchResults,
    SearchAsking,
    SearchNothingFound,
} = composeStories(stories);

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

test('← in the empty field of a submenu steps back; with text it only moves the caret, and at the top level it keeps the chip', async () => {
    await OnOpenItem.run();

    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(page.getByRole('option', { name: /Set status/u })).toBeInTheDocument();

    await userEvent.keyboard('label{ArrowRight}');
    const labels = page.getByRole('listbox', { name: 'Add or remove labels…' });
    await expect.element(labels).toBeInTheDocument();
    await userEvent.keyboard('bug{ArrowLeft}');
    await expect.element(labels).toBeInTheDocument();
    await userEvent.keyboard('X');
    await expect.element(page.getByRole('textbox')).toHaveValue('buXg');

    await userEvent.clear(page.getByRole('textbox'));
    await expect.element(page.getByRole('textbox')).toHaveValue('');
    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(labels).not.toBeInTheDocument();
    await expect.element(page.getByRole('listbox', { name: 'Command menu' })).toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: /Set status/u })).toBeInTheDocument();
});

test('⌫ in the empty field takes out the item, then the repository with its group', async () => {
    await OnOpenItemInRepository.run();

    const menu = page.getByRole('listbox', { name: 'Command menu' });
    const repositoryGroup = menu.getByRole('group', { name: 'skyline-labs/portal' });
    await expect.element(menu.getByText('portal#1187', { exact: true })).toBeInTheDocument();
    await expect.element(repositoryGroup.getByRole('option', { name: /Pull requests/u })).toBeInTheDocument();

    await userEvent.keyboard('{Backspace}');
    await expect.element(page.getByRole('option', { name: /Set status/u })).not.toBeInTheDocument();
    await expect.element(menu.getByText('portal#1187', { exact: true })).not.toBeInTheDocument();
    await expect.element(menu.getByText('skyline-labs/portal', { exact: true }).first()).toBeInTheDocument();
    await expect.element(repositoryGroup).toBeInTheDocument();

    await userEvent.keyboard('{Backspace}');
    await expect.element(repositoryGroup).not.toBeInTheDocument();
    await expect.element(page.getByText('Remove context')).not.toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: /Collapse sidebar/u })).toBeInTheDocument();
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
    await expect.element(page.getByTestId('went')).toHaveTextContent('skyline-labs/portal#1187');

    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}skyline-labs/platform-infra');
    await expect
        .element(page.getByRole('option', { name: /skyline-labs\/platform-infra not tracked/u }))
        .toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByTestId('went')).toHaveTextContent('/skyline-labs/platform-infra');
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
    const inTitle = page.getByRole('option', { name: 'Platform Q4 skyline-labs', exact: true });
    await expect.element(inTitle).toBeInTheDocument();
    expect(getMarks(inTitle)).toEqual(['Plat']);

    // A project's owner is its detail: marked where it stands, no separate word.
    await userEvent.clear(field);
    await userEvent.keyboard('skyline');
    const inDetail = page.getByRole('option', { name: 'Platform Q4 skyline-labs', exact: true });
    await expect.element(inDetail).toBeInTheDocument();
    expect(getMarks(inDetail)).toEqual(['skyline']);

    await userEvent.clear(field);
    await userEvent.keyboard('portal#1187');
    const inReference = page.getByRole('option', {
        name: 'Calendar shows wrong timezone for recurring bookings portal#1187',
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

test('E7: before typing the search says to type, not that nothing matches, and offers nothing to open', async () => {
    await SearchBeforeTyping.run();

    await expect.element(page.getByRole('textbox', { name: 'Search GitHub for a repository…' })).toHaveFocus();
    await expect.element(page.getByText('Type at least two characters')).toBeInTheDocument();
    await expect.element(page.getByText('Nothing matches')).not.toBeInTheDocument();
    await expect.element(page.getByText('Repositories on GitHub')).not.toBeInTheDocument();

    // One character is still too short.
    await userEvent.keyboard('v');
    await expect.element(page.getByText('Type at least two characters')).toBeInTheDocument();
    await expect.element(page.getByText('Asking GitHub…')).not.toBeInTheDocument();
});

test('E8: what GitHub answered is listed unfiltered and unmarked, though the typed letters are not in it', async () => {
    await SearchResults.run();

    const billing = page.getByRole('option', { name: /fitloop\/vite-plugin-billing/u });
    await expect.element(billing).toHaveTextContent(/Billing pages as a Vite plugin\s*private/u);
    await expect.element(page.getByRole('group', { name: 'Repositories on GitHub' })).toBeInTheDocument();

    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}org:vitejs');
    await expect.element(page.getByText('Asking GitHub…')).toBeInTheDocument();
    const answered = page.getByRole('option', { name: /^vitejs\/vite/u });
    await expect.element(answered).toBeInTheDocument();
    expect(page.getByRole('option').elements()).toHaveLength(3);
    expect(document.querySelectorAll('mark')).toHaveLength(0);
});

test('E9: asking says so under the heading', async () => {
    await SearchAsking.run();

    await expect.element(page.getByText('Asking GitHub…')).toBeInTheDocument();
    await expect.element(page.getByText('Repositories on GitHub')).toBeInTheDocument();
});

test('E10: nothing found says what was asked, not that nothing matches', async () => {
    await SearchNothingFound.run();

    await expect.element(page.getByText('Nothing on GitHub matches "vitee"')).toBeInTheDocument();
    await expect.element(page.getByText('Nothing matches', { exact: true })).not.toBeInTheDocument();
});

test("another action's submenu still filters what it offers", async () => {
    await OnOpenItem.run();

    await userEvent.keyboard('set stat{Tab}zzzz');
    await expect.element(page.getByText('Nothing matches')).toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: 'In review' })).not.toBeInTheDocument();
});

test('↑ on the first line wraps to the last, in the menu and in a submenu', async () => {
    await OnOpenItem.run();

    const menu = page.getByRole('listbox', { name: 'Command menu' });
    const lines = menu.getByRole('option');
    await userEvent.keyboard('{ArrowUp}');
    await expect.element(lines.last()).toHaveAttribute('data-highlighted');
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(lines.first()).toHaveAttribute('data-highlighted');

    await userEvent.keyboard('label{ArrowRight}');
    const options = page.getByRole('listbox', { name: 'Add or remove labels…' }).getByRole('option');
    await expect.element(options.first()).toHaveAttribute('data-highlighted');
    await userEvent.keyboard('{ArrowUp}');
    await expect.element(options.last()).toHaveAttribute('data-highlighted');
});
