import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { D1_ISSUE_DETAIL } from '@/testing/sampleItemDetails.js';

import * as stories from './ItemView.stories.js';

const { ContributorView, IssueInPanel, IssueSplit, LoadingComments } = composeStories(stories);

test("the body and comments show GitHub's rendering only, never the markdown as HTML; their links leave for a new tab; a comment on its way shows as the text typed", async () => {
    await IssueInPanel.run({
        args: {
            ...IssueInPanel.args,
            detail: {
                ...D1_ISSUE_DETAIL,
                // Markdown may hold raw HTML: rendering `body` would put it on the page unsanitized.
                body: '<img src="x" data-from="markdown"><b data-from="markdown">raw</b>',
                bodyHtml:
                    '<p>Rendered by <a href="https://github.com/octocat">GitHub</a> <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="screenshot"></p>',
                comments: {
                    ...D1_ISSUE_DETAIL.comments,
                    nodes: [
                        {
                            ...D1_ISSUE_DETAIL.comments.nodes[0]!,
                            bodyHtml: '<p>See <a href="https://example.com/doc">the doc</a></p>',
                        },
                        {
                            ...D1_ISSUE_DETAIL.comments.nodes[0]!,
                            id: 'pending:1',
                            bodyHtml: '',
                            pendingBody: 'Fixed in <i data-from="pending">#12</i>\nthanks',
                        },
                    ],
                },
            },
        },
    });

    await expect.element(page.getByText('Rendered by')).toBeInTheDocument();
    expect(document.querySelector('[data-from="markdown"]')).toBeNull();
    expect(document.body.textContent).not.toContain('raw');
    await expect.element(page.getByRole('img', { name: 'screenshot' })).toBeInTheDocument();
    await expect.element(page.getByText('Fixed in <i data-from="pending">#12</i>')).toBeInTheDocument();
    expect(document.querySelector('[data-from="pending"]')).toBeNull();

    for (const name of ['GitHub', 'the doc']) {
        const link = page.getByRole('link', { name, exact: true });
        await expect.element(link).toHaveAttribute('target', '_blank');
        await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
});

test('J/K step through the list, Esc closes, R puts the cursor in the comment box and Esc there leaves it without closing', async () => {
    await IssueSplit.run();
    const { onNext, onPrevious, onClose } = IssueSplit.args;

    await userEvent.keyboard('jk');
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('r');
    const box = page.getByRole('textbox', { name: 'Comment' });
    await expect.element(box).toHaveFocus();
    // Typed into the box, the keys are text, not shortcuts.
    await userEvent.keyboard('jk');
    await expect.element(box).toHaveValue('jk');
    expect(onNext).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    await expect.element(box).not.toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
});

test('the arrangement switch asks for another arrangement', async () => {
    await IssueSplit.run();

    await userEvent.click(page.getByRole('group', { name: 'Arrangement' }).getByRole('button', { name: 'Panel' }));
    expect(IssueSplit.args.onArrange).toHaveBeenCalledWith('panel');
});

test('"Show all" reads the comments not read yet, then shows every one', async () => {
    await IssueInPanel.run();

    await userEvent.click(page.getByRole('button', { name: 'Show all 4' }));
    expect(IssueInPanel.args.loadAllComments).toHaveBeenCalledTimes(1);
});

test('opened before its detail arrives: the row shows at once and the comments say they are loading', async () => {
    await LoadingComments.run();

    await expect
        .element(page.getByRole('heading', { name: 'Calendar shows wrong timezone for recurring visits' }))
        .toBeInTheDocument();
    await expect.element(page.getByText('Loading comments…')).toBeInTheDocument();
    await expect.element(page.getByText('In progress')).toBeInTheDocument();
});

test('L opens the labels picker; what was toggled is asked for when it closes', async () => {
    await IssueInPanel.run();

    await userEvent.keyboard('l');
    await expect.element(page.getByRole('textbox', { name: 'Filter labels…' })).toHaveFocus();
    await userEvent.keyboard('regr{Enter}{Escape}');

    expect(IssueInPanel.args.onEdit).toHaveBeenCalledWith({ kind: 'labels', add: ['regression'], remove: [] });
    // Escape closed the picker, not the item.
    expect(IssueInPanel.args.onClose).not.toHaveBeenCalled();
});

test("M sets the milestone, S the first project's status", async () => {
    await IssueSplit.run();
    const { onEdit } = IssueSplit.args;

    await userEvent.keyboard('m');
    await userEvent.click(page.getByRole('option', { name: /v4.3/ }));
    expect(onEdit).toHaveBeenCalledWith({ kind: 'milestone', title: 'v4.3 — December' });

    await userEvent.keyboard('s');
    await userEvent.click(page.getByRole('option', { name: 'Done' }));
    expect(onEdit).toHaveBeenLastCalledWith({
        kind: 'projectField',
        projectItemId: 'PVTI_Platform Q4',
        fieldId: 'status',
        value: { kind: 'singleSelect', optionId: 'status-done' },
    });
});

test("a project's number field is edited in its field: Enter sets what was typed, an emptied one clears it", async () => {
    await IssueSplit.run();
    const { onEdit } = IssueSplit.args;
    const target = { kind: 'projectField', projectItemId: 'PVTI_Platform Q4', fieldId: 'estimate' };

    await userEvent.click(page.getByRole('button', { name: 'Estimate: 3' }));
    const estimate = page.getByRole('spinbutton', { name: 'Estimate' });
    await expect.element(estimate).toHaveValue(3);
    await userEvent.fill(estimate, '5');
    await userEvent.keyboard('{Enter}');
    expect(onEdit).toHaveBeenLastCalledWith({ ...target, value: { kind: 'number', number: 5 } });

    await userEvent.click(page.getByRole('button', { name: 'Estimate: 3' }));
    await userEvent.clear(page.getByRole('spinbutton', { name: 'Estimate' }));
    await userEvent.keyboard('{Enter}');
    expect(onEdit).toHaveBeenLastCalledWith({ ...target, value: null });
});

test('⇧X opens the state menu: close as not planned', async () => {
    await IssueInPanel.run();

    await userEvent.keyboard('{Shift>}X{/Shift}');
    await userEvent.click(page.getByRole('menuitem', { name: 'Close as not planned' }));

    expect(IssueInPanel.args.onEdit).toHaveBeenCalledWith({ kind: 'close', reason: 'NOT_PLANNED' });
});

test('⌘↵ posts the comment typed and empties the box', async () => {
    await IssueInPanel.run();

    await userEvent.keyboard('r');
    await userEvent.keyboard('Looks good{Meta>}{Enter}{/Meta}');

    expect(IssueInPanel.args.onEdit).toHaveBeenCalledWith({ kind: 'comment', body: 'Looks good' });
    await expect.element(page.getByRole('textbox', { name: 'Comment' })).toHaveValue('');
});

test("K1b: edits a contributor can't make are not offered — no keys, no pickers, one line says why", async () => {
    await ContributorView.run();

    await expect.element(page.getByRole('note')).toHaveTextContent("set by sigma-clinic/portal's maintainers");
    await expect.element(page.getByRole('button', { name: /^Labels:/ })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Close or reopen' })).not.toBeInTheDocument();

    await userEvent.keyboard('l');
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
    expect(ContributorView.args.onEdit).not.toHaveBeenCalled();
});
