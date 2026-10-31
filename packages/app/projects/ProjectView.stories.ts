import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import {
    SAMPLE_EMPTY_PROJECT,
    SAMPLE_PROJECT,
    SAMPLE_PROJECT_ENTRIES,
    SAMPLE_PROJECT_WITHOUT_SELECT,
    SAMPLE_VIEW_BLOCKED,
    SAMPLE_VIEW_BOARD,
    SAMPLE_VIEW_DOCS,
    SAMPLE_VIEW_NEXT,
    SAMPLE_VIEW_ROADMAP,
    SAMPLE_VIEW_SPRINT,
} from '@/testing/sampleProject.js';
import { sampleProjectView } from '@/testing/sampleProjectView.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import ProjectView from './ProjectView.vue';

const meta = {
    component: ProjectView,
    args: {
        ...sampleProjectView({ project: SAMPLE_PROJECT, view: SAMPLE_VIEW_SPRINT, entries: SAMPLE_PROJECT_ENTRIES }),
        rowFieldId: 'F_status',
        viewerLogin: SAMPLE_VIEWER.login,
        now: SAMPLE_NOW,
        selectedId: null,
        'onUpdate:options': fn(),
        'onUpdate:selectedId': fn(),
        'onUpdate:rowFieldId': fn(),
        onReset: fn(),
        onMove: fn(),
        onAddDraft: fn(),
    },
    // As tall as the window, like in the app.
    render: args => ({
        components: { ProjectView },
        setup: () => ({ args }),
        template: '<div style="display: flex; height: 100vh"><ProjectView v-bind="args" /></div>',
    }),
} satisfies Meta<typeof ProjectView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** D4: "Current sprint" as a list by Status, by Priority; a draft issue among the items. */
export const List: Story = { args: { selectedId: 'I_470' } };

/** D5: "Board", a column per Status; items move between columns, a draft is written at the bottom of one. */
export const Board: Story = {
    args: {
        ...sampleProjectView({ project: SAMPLE_PROJECT, view: SAMPLE_VIEW_BOARD, entries: SAMPLE_PROJECT_ENTRIES }),
        selectedId: 'I_1187',
        canMove: () => true,
    },
};

/** D13: the tab changed on this device — grouped by Priority — is marked, with a way back to GitHub's version. */
export const ModifiedLocally: Story = {
    args: sampleProjectView({
        project: SAMPLE_PROJECT,
        view: SAMPLE_VIEW_SPRINT,
        entries: SAMPLE_PROJECT_ENTRIES,
        options: {
            ...sampleProjectView({ project: SAMPLE_PROJECT, view: SAMPLE_VIEW_SPRINT, entries: [] }).options,
            grouping: 'field:F_priority',
        },
        modifiedViews: [1],
    }),
};

/** K6: GitHub answered a view githq can't evaluate; the tab and the term say so. */
export const AnsweredByGitHub: Story = {
    args: sampleProjectView({
        project: SAMPLE_PROJECT,
        view: SAMPLE_VIEW_NEXT,
        entries: SAMPLE_PROJECT_ENTRIES,
        answered: new Set(['PVTI_I_455', 'PVTI_I_1210']),
    }),
};

/** K6 before GitHub answered: the view waits — it never shows the unfiltered items. */
export const AskingGitHub: Story = {
    args: sampleProjectView({ project: SAMPLE_PROJECT, view: SAMPLE_VIEW_NEXT, entries: SAMPLE_PROJECT_ENTRIES }),
};

/** K9: nothing matches the view right now; its filter as GitHub defines it. */
export const EmptyView: Story = {
    args: sampleProjectView({ project: SAMPLE_PROJECT, view: SAMPLE_VIEW_BLOCKED, entries: SAMPLE_PROJECT_ENTRIES }),
};

/** K7: no single select to make columns of — the board is unavailable, the display options say why. */
export const NoSingleSelect: Story = {
    args: {
        ...sampleProjectView({ project: SAMPLE_PROJECT_WITHOUT_SELECT, view: SAMPLE_VIEW_DOCS, entries: [] }),
        itemCount: 0,
        rowFieldId: null,
    },
};

/** K8: a new project with nothing in it yet; a draft can be written straight in. */
export const EmptyProject: Story = {
    args: {
        ...sampleProjectView({
            project: SAMPLE_EMPTY_PROJECT,
            view: SAMPLE_EMPTY_PROJECT.views[0] ?? null,
            entries: [],
        }),
        rowFieldId: 'F_status',
    },
};

/** A roadmap on GitHub, shown as a list. */
export const Roadmap: Story = {
    args: sampleProjectView({ project: SAMPLE_PROJECT, view: SAMPLE_VIEW_ROADMAP, entries: SAMPLE_PROJECT_ENTRIES }),
};
