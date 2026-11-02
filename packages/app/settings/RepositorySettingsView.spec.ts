import { composeStories } from '@storybook/vue3';
import { beforeEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './RepositorySettingsView.stories.js';

const {
    Synced,
    Public,
    VisibilityNotKnown,
    Downloading,
    Refused,
    Hidden,
    WithPattern,
    MatchingNothing,
    AlertsOff,
    NotRead,
} = composeStories(stories);

const like = (pattern: string) => new RegExp(pattern.replaceAll(' ', '\\s'), 'u');
const alerts = () => page.getByRole('region', { name: 'Workflow alerts' });
const defaultRow = () => alerts().element().querySelector('[data-alert-key="default"]');
const patternRow = (pattern: string) => alerts().element().querySelector(`[data-alert-key="pattern:${pattern}"]`);
const others = () => page.getByRole('region', { name: 'Other branches and tags with recent runs, no alerts' });
const patternField = () => page.getByRole('textbox', { name: 'Branch or tag pattern' });

// As wide as Settings in a window: the section's controls sit beside its description.
beforeEach(async () => {
    await page.viewport(1280, 900);
});

test('the head names the repository, its visibility and that it is tracked, with Esc to go back', async () => {
    await Synced.run();

    await expect.element(page.getByRole('heading', { name: 'fitloop/webapp', level: 2 })).toBeVisible();
    await expect.element(page.getByText(/^private\s·\stracked$/u)).toBeVisible();
    await expect
        .element(page.getByRole('button', { name: 'Repositories' }))
        .toHaveAttribute('aria-keyshortcuts', 'Escape');
    await expect.element(page.getByText(/^Esc\s?Back$/u)).toBeVisible();

    await Public.run();
    await expect.element(page.getByText(/^public\s·\stracked$/u)).toBeVisible();

    // Nothing tells yet: neither.
    await VisibilityNotKnown.run();
    await expect.element(page.getByText(/^tracked$/u)).toBeVisible();
    await expect.element(page.getByText(/private|public/u)).not.toBeInTheDocument();
});

test('the arrow with "Repositories", and Esc, go back — Esc not while a field or a layer has it', async () => {
    const onBack = vi.fn();
    await Synced.run({ args: { ...Synced.args, onBack } });

    await userEvent.click(page.getByRole('button', { name: 'Repositories' }));
    expect(onBack).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    expect(onBack).toHaveBeenCalledTimes(2);

    // A field has the key.
    const field = document.createElement('input');
    document.body.append(field);
    field.focus();
    await userEvent.keyboard('{Escape}');
    expect(onBack).toHaveBeenCalledTimes(2);
    field.remove();

    // A layer is open (the command menu, a picker): Escape is its own.
    const layer = document.createElement('div');
    layer.dataset.layer = '';
    document.body.append(layer);
    await userEvent.keyboard('{Escape}');
    expect(onBack).toHaveBeenCalledTimes(2);
    layer.remove();
});

test('Tracking says it is tracked, how it stands and its open items in this browser; Untrack untracks', async () => {
    const onUntrack = vi.fn();
    await Synced.run({ args: { ...Synced.args, onUntrack } });

    await expect.element(page.getByRole('heading', { name: 'Tracking', level: 2 })).toBeVisible();
    await expect
        .element(
            page.getByText(
                /^Whether\sgithq\skeeps\sa\scopy\sof\sthis\srepository's\sissues,\spull\srequests\sand\sworkflows\.$/u,
            ),
        )
        .toBeVisible();
    await expect.element(page.getByText('Tracked', { exact: true })).toBeVisible();
    await expect.element(page.getByText(/synced\s14s\sago\s·\s142\sopen\sitems\sin\sthis\sbrowser/u)).toBeVisible();
    await expect
        .element(
            page.getByText(
                /^The\ssame\sas\sUntrack\son\sits\srow\sin\sRepositories,\sthen\sback\sto\sRepositories\.$/u,
            ),
        )
        .toBeVisible();

    await userEvent.click(page.getByRole('button', { name: 'Untrack' }));
    expect(onUntrack).toHaveBeenCalledOnce();
});

test('how it stands, as a row in Repositories says it', async () => {
    await Downloading.run();
    await expect.element(page.getByText(/downloading\s40\sof\s312\s·\s40\sopen\sitems/u)).toBeVisible();

    await VisibilityNotKnown.run();
    await expect.element(page.getByText(/waiting\s·\sno\sopen\sitems/u)).toBeVisible();

    await Refused.run();
    await expect.element(page.getByText(/GitHub\srefuses\sits\schanges/u)).toBeVisible();

    await Hidden.run();
    await expect.element(page.getByText(/Not\sshown\sto\sgithq/u)).toBeVisible();
});

test('Workflow alerts on the default: the default branch as GitHub names it, the workflows that run on it, its broken count; the other refs with recent runs, at most three', async () => {
    await Synced.run();

    await expect.element(page.getByRole('heading', { name: 'Workflow alerts', level: 2 })).toBeVisible();
    await expect
        .element(alerts())
        .toHaveTextContent(like('marks fitloop/webapp broken: a red marker in the sidebar and one more in the total'));
    await expect.element(page.getByRole('switch', { name: 'Default branch' })).toHaveAttribute('aria-checked', 'true');
    expect(defaultRow()?.textContent).toMatch(
        like(
            '^Default branch\\s*main\\s*as GitHub reports it\\s*Deploy, Probe, Test, and Dependabot Updates run on it\\s*1 broken$',
        ),
    );
    await expect
        .element(others())
        .toHaveTextContent(
            like(
                'staging\\s*Nightly e2e failed 5h ago\\s*v0.1.0-rc.3\\s*Release failed 6h ago\\s*v2-experiment\\s*Deploy passed 1d ago$',
            ),
        );
    await expect.element(patternField()).toBeVisible();
    expect(patternField().element().getAttribute('placeholder')).toMatch(
        like('^Add a branch or tag pattern, such as release/\\* or v\\*$'),
    );
    await expect.element(page.getByText('Matches: branches and tags githq has seen runs on')).toBeVisible();
});

test('W7: a pattern shows its matches, branches first, "+n" for the rest, what runs on them, an amber flag for a branch among tags, and its broken count', async () => {
    await WithPattern.run();

    expect(patternRow('v*')?.textContent).toMatch(
        like(
            '^v\\*\\s*v2-experiment\\s*v0.1.0-rc.3\\s*v0.1.0-rc.2\\s*\\+1\\s*1 branch, 3 tags · Deploy and Release run on them\\s*· v2-experiment is a branch.*1 broken$',
        ),
    );
    // What v* counts is no longer among the refs without alerts.
    await expect.element(others()).toHaveTextContent(like('staging.*chore/deploy-workflow\\s*Deploy passed 2d ago$'));
});

test('W8: a pattern matching nothing yet says so, with no count', async () => {
    await MatchingNothing.run();

    expect(patternRow('release/*')?.textContent).toMatch(
        like('^release/\\*\\s*No ref githq has seen a run on matches this yet. It counts from the first run on one.$'),
    );
});

test('W9: the default branch off and no patterns: dimmed, "· off", "No alerts from …", and main among the refs without alerts', async () => {
    await AlertsOff.run();

    await expect.element(page.getByRole('switch', { name: 'Default branch' })).toHaveAttribute('aria-checked', 'false');
    expect(defaultRow()?.textContent).toMatch(
        like(
            '^Default branch\\s*main\\s*as GitHub reports it · off\\s*Failures on main raise no alert. Deploy, Probe, Test, and Dependabot Updates run on it.$',
        ),
    );
    await expect.element(page.getByText('No alerts from fitloop/webapp')).toBeVisible();
    await expect.element(others()).toHaveTextContent(like('^.*main\\s*Deploy failed 2h ago'));
});

test('W10: not read yet: no matches and no counts, not zeros, and a notice saying so', async () => {
    await NotRead.run();

    expect(defaultRow()?.textContent).toMatch(like("^Default branch\\s*Its runs haven't been read yet.$"));
    expect(patternRow('v*')?.textContent).toMatch(like('^v\\*\\s*Matches show once githq has read the runs.$'));
    await expect.element(page.getByText(/githq\shasn't\sread\sthis\srepository's\sruns\syet/u)).toBeVisible();
    expect(alerts().element().textContent).not.toMatch(/\d+\sbroken/u);
    await expect.element(others()).not.toBeInTheDocument();
});

test('the keys: J/K move, Space switches the default branch, ⌫ removes a pattern at once; a click on the switch switches it too', async () => {
    const onWorkflowSettings = vi.fn();
    await WithPattern.run({ args: { ...WithPattern.args, onWorkflowSettings } });

    await userEvent.keyboard('j');
    expect(defaultRow()?.getAttribute('aria-current')).toBe('true');
    await expect.element(page.getByText(/Space\s?Switch/u)).toBeVisible();
    await userEvent.keyboard(' ');
    expect(onWorkflowSettings).toHaveBeenLastCalledWith({ defaultBranch: false, refs: ['v*'] });

    await userEvent.keyboard('j');
    expect(patternRow('v*')?.getAttribute('aria-current')).toBe('true');
    await expect.element(page.getByText(/Edit\s*.*Remove/u)).toBeVisible();
    await userEvent.keyboard('{Backspace}');
    expect(onWorkflowSettings).toHaveBeenLastCalledWith({ defaultBranch: true, refs: [] });

    await userEvent.click(page.getByRole('switch', { name: 'Default branch' }));
    expect(onWorkflowSettings).toHaveBeenLastCalledWith({ defaultBranch: false, refs: ['v*'] });
    expect(onWorkflowSettings).toHaveBeenCalledTimes(3);
});

test('W11: A opens the add field; the preview follows every key and says what turns broken; Enter adds, Esc throws it away', async () => {
    const onWorkflowSettings = vi.fn();
    await Synced.run({ args: { ...Synced.args, onWorkflowSettings } });

    await userEvent.keyboard('a');
    await expect.element(patternField()).toHaveFocus();
    // Nothing typed: Enter does nothing.
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('v');
    await expect.element(alerts()).toHaveTextContent(like('No ref githq has seen a run on matches this yet'));
    await userEvent.keyboard('*');
    await expect
        .element(alerts())
        .toHaveTextContent(
            like('Would alert on\\s*v2-experiment\\s*v0.1.0-rc.3\\s*v0.1.0-rc.2\\s*v0.1.0-rc.1\\s*1 branch, 3 tags'),
        );
    await expect.element(page.getByText('Release turns broken: it failed on v0.1.0-rc.3 6h ago')).toBeVisible();
    expect(onWorkflowSettings).not.toHaveBeenCalled();

    await userEvent.keyboard('{Enter}');
    expect(onWorkflowSettings).toHaveBeenCalledExactlyOnceWith({ defaultBranch: true, refs: ['v*'] });
    await expect.element(patternField()).toHaveValue('');
    await expect.element(patternField()).not.toHaveFocus();

    // Esc throws away what is typed; it never leaves the page.
    const onBack = vi.fn();
    await Synced.run({ args: { ...Synced.args, onWorkflowSettings, onBack } });
    await userEvent.click(patternField());
    await userEvent.keyboard('release/*{Escape}');
    await expect.element(patternField()).toHaveValue('');
    expect(onBack).not.toHaveBeenCalled();
    expect(onWorkflowSettings).toHaveBeenCalledOnce();
});

test('W11: a pattern already in the list says so, and Enter adds nothing', async () => {
    const onWorkflowSettings = vi.fn();
    await WithPattern.run({ args: { ...WithPattern.args, onWorkflowSettings } });

    await userEvent.click(patternField());
    await userEvent.keyboard('v*');
    await expect.element(page.getByText('Already in the list')).toBeVisible();
    await userEvent.keyboard('{Enter}');
    expect(onWorkflowSettings).not.toHaveBeenCalled();
});

test('W12: Enter edits a pattern in place, with the same preview naming what stops counting; Enter saves, Esc puts it back', async () => {
    const onWorkflowSettings = vi.fn();
    await WithPattern.run({ args: { ...WithPattern.args, onWorkflowSettings } });

    await userEvent.keyboard('jj{Enter}');
    const editor = page.getByRole('textbox', { name: 'Branch or tag pattern' }).first();
    await expect.element(editor).toHaveFocus();
    await expect.element(editor).toHaveValue('v*');
    await userEvent.keyboard('{Escape}');
    expect(patternRow('v*')).not.toBeNull();
    expect(onWorkflowSettings).not.toHaveBeenCalled();

    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('.*.*');
    await expect
        .element(alerts())
        .toHaveTextContent(
            like('Would alert on\\s*v0.1.0-rc.3\\s*v0.1.0-rc.2\\s*v0.1.0-rc.1\\s*3 tags · Release runs on them'),
        );
    await expect.element(page.getByText("Release stays broken, so the counters don't change")).toBeVisible();
    await expect.element(page.getByText('No longer counted: the branch v2-experiment')).toBeVisible();
    await userEvent.keyboard('{Enter}');
    expect(onWorkflowSettings).toHaveBeenCalledExactlyOnceWith({ defaultBranch: true, refs: ['v*.*.*'] });
});
