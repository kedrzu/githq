import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './CommandMenu.stories.jsx';

const { OnOpenItem, OnOpenItemAsContributor, Typing, SeveralSelected, Closed } = composeStories(stories);

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
