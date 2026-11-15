import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';

import { matchText } from '@/testing/matchText.js';
import { D1_ITEMS, SAMPLE_NOW, sampleUser } from '@/testing/sampleMyWork.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';
import { withPhoneLayout } from '@/testing/withPhoneLayout.js';

import { ITEM_PROPERTIES } from './ItemProperty.js';
import ItemRow from './ItemRow.vue';

const GREEN = D1_ITEMS.find(item => item.id === 'PR_477');
if (GREEN?.kind !== 'pullRequest') {
    throw new Error('The sample work needs the pull request PR_477.');
}

const NESTED = D1_ITEMS.find(item => item.id === 'PR_1205');
const CLOSED_BY_IT = D1_ITEMS.find(item => item.id === 'I_1187');
if (!NESTED || !CLOSED_BY_IT) {
    throw new Error('The sample work needs the pull request PR_1205 and the issue I_1187 it closes.');
}

const REVIEW_ASKED = findItem('PR_482');
const FAILING = findItem('PR_15');
const DRAFT = findItem('PR_94');
const UNTRACKED = findItem('PR_18842');

/** A phone's width (mobile D5): an iPhone's 390 px. */
const atPhoneWidth: Decorator = () => ({ template: '<div style="width: 390px"><story /></div>' });

/** The phone's row (mobile D23). */
const onPhone = [withPhoneLayout(true), atPhoneWidth];

const meta = {
    component: ItemRow,
    args: { item: GREEN, properties: ITEM_PROPERTIES, now: SAMPLE_NOW, viewerLogin: SAMPLE_VIEWER.login },
    decorators: [withPhoneLayout(false)],
} satisfies Meta<typeof ItemRow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** GitHub would merge it with no review decision and no review asked: followed by "Open on GitHub" or "Merge". */
export const ReadyToMerge: Story = {
    args: { item: { ...GREEN, reviewDecision: null, reviewRequests: [] } },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByText('ready to merge')).toBeVisible();
        await expect(canvas.getByRole('link', { name: /GitHub/ })).toBeVisible();
    },
};

/** "Checks passed" first, then the status: green checks that do not make it ready. */
export const ChecksPassedWaiting: Story = {
    args: { item: { ...GREEN, reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BLOCKED' } },
    play: async ({ canvasElement }) => {
        await expect(canvasElement).toHaveTextContent(/checks passed.*waiting for review/);
    },
};

/** Under the issue it closes, of the same repository: indented, its number after the title, line two from its status. */
export const NestedUnderIssue: Story = {
    args: { item: NESTED, parent: CLOSED_BY_IT },
};

/**
 * Mobile D23, an issue: its title on two lines; under it its tracked repository without the owner, the row field with
 * its colour and "+1" for the other project, the label as a dot, and at the end one avatar and the age.
 */
export const PhoneIssue: Story = {
    args: {
        item: {
            ...CLOSED_BY_IT,
            title: 'Calendar shows wrong timezone for recurring bookings in every studio east of Greenwich',
            labels: [...CLOSED_BY_IT.labels, { name: 'calendar', color: 'd6a23a' }],
        },
        repositoryTracked: true,
    },
    decorators: onPhone,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByText('portal#1187')).toBeVisible();
        await expect(canvas.getByRole('img', { name: 'Labels: bug and calendar' })).toBeVisible();
        await expectWithinRow(canvasElement, canvas.getByText('20m'));
    },
};

/** Mobile D23, MB89, a pull request asking for the user's review: "✓ 4/4", "Review", its author's avatar. */
export const PhoneReviewRequested: Story = {
    args: { item: REVIEW_ASKED, reviewRequested: true, repositoryTracked: true },
    decorators: onPhone,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByText('api#482')).toBeVisible();
        await expectWithinRow(canvasElement, canvas.getByRole('img', { name: matchText('4 of 4 checks passed') }));
        await expectWithinRow(canvasElement, canvas.getByRole('img', { name: matchText('your review requested') }));
        await expect(canvas.getByText('Review')).toBeVisible();
        await expectWithinRow(canvasElement, canvas.getByRole('img', { name: 'olam' }));
    },
};

/** Mobile D23, MB89: failing checks in red, "✕ 5/7", and "Changes" — whole beside an avatar and the age. */
export const PhoneChecksFailing: Story = {
    args: { item: { ...FAILING, author: sampleUser('olam', '#7fb3d5') }, repositoryTracked: true },
    decorators: onPhone,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expectWithinRow(canvasElement, canvas.getByRole('img', { name: matchText('2 of 7 checks failing') }));
        await expectWithinRow(canvasElement, canvas.getByRole('img', { name: matchText('changes requested') }));
        await expect(canvas.getByText('5/7')).toBeVisible();
    },
};

/** Mobile D23: a draft pull request says Draft. */
export const PhoneDraft: Story = {
    args: { item: DRAFT, repositoryTracked: true },
    decorators: onPhone,
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('Draft')).toBeVisible();
    },
};

/** Mobile D24: under the issue it closes, one line — an arrow, its number, its title as far as it fits, its checks. */
export const PhoneNested: Story = {
    args: { item: NESTED, parent: CLOSED_BY_IT, repositoryTracked: true },
    decorators: onPhone,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const number = canvas.getByText('#1205');
        const title = canvas.getByText(NESTED.title);
        await expect(Math.abs(number.getBoundingClientRect().top - title.getBoundingClientRect().top)).toBeLessThan(2);
        await expectWithinRow(
            canvasElement,
            canvas.getByRole('img', { name: matchText('3 of 9 checks passed, 6 running') }),
        );
    },
};

/** Mobile D23: a repository not tracked keeps its owner. */
export const PhoneUntracked: Story = {
    args: { item: UNTRACKED },
    decorators: onPhone,
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('vitejs/vite#18842')).toBeVisible();
    },
};

function findItem(id: string) {
    const found = D1_ITEMS.find(item => item.id === id);
    if (!found) {
        throw new Error(`The sample work needs ${id}.`);
    }

    return found;
}

/** Drawn whole: not clipped by the facts of line two it sits in (they hide what overflows), nor by the row. */
async function expectWithinRow(canvasElement: HTMLElement, element: HTMLElement) {
    const box = element.closest('[class*="itemRow_facts"]') ?? canvasElement.querySelector('[class*="itemRow"]');
    if (!box) {
        throw new Error('No row drawn.');
    }

    await expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(box.getBoundingClientRect().right);
    await expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
}
