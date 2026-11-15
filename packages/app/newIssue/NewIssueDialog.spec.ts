import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import * as stories from './NewIssueDialog.stories.jsx';

const {
    QuickCapture,
    ChoosingRepository,
    IssueFormBody,
    Rejected,
    Archived,
    Templates,
    NotInRepository,
    Waiting,
    DetailsLoading,
    PhoneEmpty,
    PhoneChoosingRepository,
    PhoneTemplates,
    PhoneRejected,
} = composeStories(stories);

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

test('⌥A and Enter pressed before the repository’s details are in wait for them, and then assign and create', async () => {
    await DetailsLoading.run();

    await userEvent.keyboard('Typed fast{Alt>}a{/Alt}{Enter}');
    await expect
        .element(page.getByRole('button', { name: 'Create Working…', exact: true }))
        .toHaveAttribute('aria-busy', 'true');
    await expect.element(page.getByTestId('created')).toHaveTextContent('Nothing created');
    await expect.element(page.getByTestId('assignees')).toHaveTextContent('Nobody assigned');

    // A hidden button outside the modal, clicked from the DOM.
    document.querySelector<HTMLElement>('[tid="arrive"]')?.click();
    await expect.element(page.getByTestId('created')).toHaveTextContent('Created: Typed fast');
    await expect.element(page.getByTestId('assignees')).toHaveTextContent(SAMPLE_VIEWER.login);
    await expect.element(page.getByTestId('count')).toHaveTextContent('1');
});

test('⌘Enter pressed before the repository’s details are in creates another once they are', async () => {
    await DetailsLoading.run();

    await userEvent.keyboard('One of many{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect
        .element(page.getByRole('button', { name: 'Create another Working…', exact: true }))
        .toHaveAttribute('aria-busy', 'true');
    await expect.element(page.getByTestId('created')).toHaveTextContent('Nothing created');

    document.querySelector<HTMLElement>('[tid="arrive"]')?.click();
    await expect.element(page.getByTestId('created')).toHaveTextContent('Created, another: One of many');
    await expect.element(page.getByRole('textbox', { name: 'Title' })).toHaveValue('');
});

test('H2: with no repository the chooser comes first, the last used marked; Enter takes the first that takes an issue', async () => {
    await ChoosingRepository.run();

    await expect.element(page.getByRole('textbox', { name: 'Repository' })).toHaveFocus();
    await expect.element(page.getByRole('option', { name: /^skyline-labs\/api\s*last used/u })).toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: /skyline-labs\/api-v1/u })).toHaveAttribute('data-disabled');
    await userEvent.keyboard('{Enter}');

    await expect
        .element(page.getByRole('button', { name: /Repository: skyline-labs\/api\. Choose another/u }))
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

    await expect.element(page.getByText("skyline-labs/api-v1 won't take a new issue")).toBeInTheDocument();
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
        .toHaveTextContent('Not in skyline-labs/portal, so left out: needs-design, v9 — Someday, Epic.');
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

test('mobile D42: on a phone the form is a screen of its own; Create is dim until there is a title, then creates and closes', async () => {
    await PhoneEmpty.run();

    const dialog = page.getByRole('dialog', { name: 'New issue' });
    await expect.element(dialog).toBeInTheDocument();
    const box = dialog.element().getBoundingClientRect();
    expect({ top: box.top, left: box.left, width: box.width, height: box.height }).toEqual({
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
    });

    const create = page.getByRole('button', { name: 'Create', exact: true });
    await expect.element(create).toBeDisabled();
    await expect.element(page.getByRole('textbox', { name: 'Title' })).toHaveFocus();
    await userEvent.keyboard('Waitlist ignores paused memberships');
    await userEvent.click(create);

    await expect.element(page.getByTestId('created')).toHaveTextContent('Created: Waitlist ignores paused memberships');
    await expect.element(dialog).not.toBeInTheDocument();
});

test('mobile D42: × closes the form and keeps what was written', async () => {
    await PhoneEmpty.run();

    await userEvent.keyboard('Half a thought');
    await userEvent.click(page.getByRole('button', { name: 'Close, keeping what you wrote' }));

    await expect.element(page.getByRole('dialog', { name: 'New issue' })).not.toBeInTheDocument();
    await expect.element(page.getByTestId('kept')).toHaveTextContent('Half a thought');
    await expect.element(page.getByTestId('created')).toHaveTextContent('Nothing created');
});

test('mobile D42: Assign to me assigns, then says Assigned to me and takes it back', async () => {
    await PhoneEmpty.run();

    await userEvent.click(page.getByRole('button', { name: 'Assign to me' }));
    await expect.element(page.getByTestId('assignees')).toHaveTextContent(SAMPLE_VIEWER.login);
    const assigned = page.getByRole('button', { name: 'Assigned to me' });
    await expect.element(assigned).toHaveAttribute('aria-pressed', 'true');
    await expect.element(page.getByRole('button', { name: `Assignees: ${SAMPLE_VIEWER.login}` })).toBeInTheDocument();

    await userEvent.click(assigned);
    await expect.element(page.getByTestId('assignees')).toHaveTextContent('Nobody assigned');
    await expect.element(page.getByRole('button', { name: 'Assign to me' })).toBeInTheDocument();
});

test('mobile D45: tapping a row opens its menu at the bottom; what is picked there is set', async () => {
    await PhoneEmpty.run();

    await userEvent.click(page.getByRole('button', { name: 'Milestone: No milestone' }));
    const menu = page.getByRole('dialog', { name: 'Milestone' });
    await expect.element(menu).toHaveTextContent('New issue · skyline-labs/portal');
    await userEvent.click(menu.getByRole('option', { name: /v4\.2 — November/u }));

    await expect.element(menu).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Milestone: v4.2 — November' })).toBeInTheDocument();
});

test('mobile D43: on a phone, started outside a repository, the chooser rises first; choosing fills the Repository row', async () => {
    await PhoneChoosingRepository.run();

    const chooser = page.getByRole('dialog', { name: 'Repository' });
    // As every phone menu (mobile D45): the list holds the focus, no keyboard until the filter is tapped.
    await expect.element(chooser.getByRole('listbox', { name: 'Repository' })).toHaveFocus();
    await expect.element(chooser.getByRole('option', { name: /^skyline-labs\/api\s*last used/u })).toBeInTheDocument();
    await userEvent.click(chooser.getByRole('option', { name: /^skyline-labs\/api\s*last used/u }));

    await expect.element(chooser).not.toBeInTheDocument();
    await expect
        .element(page.getByRole('button', { name: /Repository: skyline-labs\/api\. Choose another/u }))
        .toBeInTheDocument();
    await expect.element(page.getByRole('textbox', { name: 'Title' })).toHaveFocus();
});

test('mobile D39: on a phone a repository’s templates rise as a menu at the bottom; a template picked is used', async () => {
    await PhoneTemplates.run();

    const menu = page.getByRole('dialog', { name: 'Template' });
    const list = menu.getByRole('listbox', { name: 'Issue templates' });
    await expect.element(list.getByRole('option', { name: /Bug report\s*form on GitHub/u })).toBeInTheDocument();
    await expect.element(list.getByRole('option', { name: /Blank issue/u })).toHaveAttribute('data-disabled');
    await userEvent.click(list.getByRole('option', { name: /Documentation/u }));

    await expect.element(page.getByTestId('template')).toHaveTextContent('docs.md');
    await expect.element(menu).not.toBeInTheDocument();
});

test('MB214: on a phone a creation GitHub refused shows why above the text it kept', async () => {
    await PhoneRejected.run();

    await expect.element(page.getByRole('alert')).toHaveTextContent(/Repository was archived so is read-only/u);
    await expect
        .element(page.getByRole('textbox', { name: 'Title' }))
        .toHaveValue('Retry webhook delivery after a 429');
    await expect
        .element(page.getByRole('textbox', { name: 'Description' }))
        .toHaveValue('Stripe answers 429 when we replay more than 25 events a second.');
});
