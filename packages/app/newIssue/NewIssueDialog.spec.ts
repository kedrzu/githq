import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './NewIssueDialog.stories.jsx';

const { QuickCapture, ChoosingRepository, IssueFormBody, Rejected, Archived, Templates, NotInRepository, Waiting } =
    composeStories(stories);

test('H1: the cursor is in the title; Enter creates and closes', async () => {
    await QuickCapture.run();

    const title = page.getByRole('textbox', { name: 'Title' });
    await expect.element(title).toHaveFocus();
    await userEvent.keyboard('Reminders skip DST{Enter}');

    await expect.element(page.getByTestId('created')).toHaveTextContent('Created: Reminders skip DST');
    await expect.element(page.getByRole('dialog', { name: 'New issue' })).not.toBeInTheDocument();
});

test('⌘Enter creates another: the capture stays, the title is cleared and keeps the cursor', async () => {
    await QuickCapture.run();

    await userEvent.keyboard('First one{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    await expect.element(page.getByTestId('created')).toHaveTextContent('Created, another: First one');
    const title = page.getByRole('textbox', { name: 'Title' });
    await expect.element(title).toHaveValue('');
    await expect.element(title).toHaveFocus();
});

test('Tab expands to the body; Escape collapses, then closes keeping what was written', async () => {
    await QuickCapture.run();

    await userEvent.keyboard('Half a thought{Tab}');
    const body = page.getByRole('textbox', { name: 'Description' });
    await expect.element(body).toHaveFocus();
    await userEvent.keyboard('more of it');
    // Enter in the body is a new line, not a create.
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByTestId('created')).toHaveTextContent('Nothing created');

    await userEvent.keyboard('{Escape}');
    await expect.element(body).not.toBeInTheDocument();
    await expect.element(page.getByRole('dialog', { name: 'New issue' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('dialog', { name: 'New issue' })).not.toBeInTheDocument();
    await expect.element(page.getByTestId('kept')).toHaveTextContent('Half a thought');
});

test('expanded, Enter in the title goes on to the body, and ⌘Enter creates once', async () => {
    await QuickCapture.run();

    await userEvent.keyboard('Once only{Tab}');
    await userEvent.click(page.getByRole('textbox', { name: 'Title' }));
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('textbox', { name: 'Description' })).toHaveFocus();

    await userEvent.click(page.getByRole('textbox', { name: 'Title' }));
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('created')).toHaveTextContent('Created: Once only');
    await expect.element(page.getByTestId('count')).toHaveTextContent('1');
});

test('H2: with no repository the chooser comes first; Enter takes the first that takes an issue', async () => {
    await ChoosingRepository.run();

    await expect.element(page.getByRole('textbox', { name: 'Repository' })).toHaveFocus();
    await expect.element(page.getByRole('option', { name: /sigma-clinic\/api-v1/u })).toHaveAttribute('data-disabled');
    await userEvent.keyboard('{Enter}');

    await expect
        .element(page.getByRole('button', { name: /Repository: sigma-clinic\/api\. Choose another/u }))
        .toBeInTheDocument();
    await expect.element(page.getByRole('textbox', { name: 'Title' })).toHaveFocus();
});

test('H8: an issue form names its required fields still empty, and is not created until they are filled', async () => {
    await IssueFormBody.run();

    await expect.element(page.getByText('Still required: What happened, Browser')).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: /^Create/u }).first()).toBeDisabled();
});

test('H9: a rejection shows why above the text it kept', async () => {
    await Rejected.run();

    await expect.element(page.getByRole('alert')).toHaveTextContent(/GitHub didn't create this issue/u);
    await expect.element(page.getByRole('alert')).toHaveTextContent(/Repository was archived so is read-only/u);
    await expect
        .element(page.getByRole('textbox', { name: 'Title' }))
        .toHaveValue('Reminders skip the first visit after a DST change');
    await expect
        .element(page.getByRole('textbox', { name: 'Description' }))
        .toHaveValue('Visits created before Oct 27 keep their reminder at the old offset.');
});

test('a repository that won’t take an issue says so before anything is typed; nothing can be created', async () => {
    await Archived.run();

    await expect.element(page.getByText("sigma-clinic/api-v1 won't take a new issue")).toBeInTheDocument();
    await userEvent.keyboard('Typed anyway{Enter}');
    await expect.element(page.getByTestId('created')).toHaveTextContent('Nothing created');
});

test('H7: a repository asking for a template offers it first; a form there continues on GitHub', async () => {
    await Templates.run();

    const list = page.getByRole('listbox', { name: 'Issue templates' });
    await expect.element(list.getByRole('option', { name: /Bug report\s*form on GitHub/u })).toBeInTheDocument();
    await expect.element(list.getByRole('option', { name: /Blank issue/u })).toHaveAttribute('data-disabled');

    await userEvent.click(list.getByRole('option', { name: /Bug report/u }));
    await expect.element(page.getByTestId('template')).toHaveTextContent('form bug_report.yml');
});

test('values the repository does not have are named before sending: they will be left out', async () => {
    await NotInRepository.run();

    await expect
        .element(page.getByRole('status'))
        .toHaveTextContent('Not in sigma-clinic/portal, so left out: needs-design, v9 — Someday, Epic.');
});

test('H9: refused issues wait beside the one being written; each can be restored or dropped', async () => {
    await Waiting.run();

    const waiting = page.getByRole('list', { name: 'Issues waiting to be restored' });
    await expect.element(waiting.getByRole('listitem')).toHaveLength(2);
    await expect.element(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Being written now');

    await userEvent.click(page.getByRole('button', { name: 'Restore “Export drops the timezone”' }));
    await expect.element(page.getByTestId('template')).toHaveTextContent('restore 2');
    await userEvent.click(page.getByRole('button', { name: 'Drop “Reminders skip DST”' }));
    await expect.element(page.getByTestId('template')).toHaveTextContent('discard 1');
});
