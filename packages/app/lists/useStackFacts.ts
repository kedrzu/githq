import type { Translation } from '@nzyme/i18n-core';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import type { LucideIcon } from 'lucide-vue-next';
import { computed } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { ItemLabel, ItemUser, PullRequestItem } from '@/store/ItemTypes.js';
import type {
    StackBlocker,
    StackDescription,
    StackHeldState,
    StackPullRequestPipKind,
} from '@/store/stacks/describeStack.js';
import type { StackShareState } from '@/store/stacks/describeStackShare.js';
import { formatAge } from '@/utils/formatAge.js';

import type { ListStack } from './ListTypes.js';
import * as l from './useStackFacts.loc.js';
import { getHeldReason } from './utils/getHeldReason.js';
import type { HeldReason } from './utils/getHeldReason.js';
import { getBlockerLook } from './utils/getBlockerLook.js';
import { getItemPeople } from './utils/getItemPeople.js';
import { getPullRequestLook } from './utils/getPullRequestLook.js';
import { getStackStateFact } from './utils/getStackStateFact.js';

/** The faces shown before "+N" (D15). */
const MAX_PEOPLE = 3;

/** Which stack's entry and how it is listed. */
export interface UseStackFactsOptions {
    readonly stack: MaybeRefOrGetter<ListStack>;
    /** Epoch ms the age is counted to. */
    readonly now: MaybeRefOrGetter<number>;
    /** Who the entry shows: who opened its pull requests (my work) or who they are assigned to. */
    readonly people: MaybeRefOrGetter<'assignees' | 'author'>;
    /** The signed-in user: with `people: 'author'`, their own pull requests show no face. */
    readonly viewerLogin: MaybeRefOrGetter<string | null>;
}

/** An icon in a colour: the state in words (SP14), a pull request's own state inside an expanded card. */
export interface StackLook {
    readonly icon: LucideIcon;
    readonly tone: 'danger' | 'dim' | 'done' | 'muted' | 'success' | 'warning';
}

/** The state in words, its icon and colour (SP14). */
export interface StackStateFact extends StackLook {
    readonly text: string;
}

/** The row field of its pull requests' first project (githq D12) as the entry shows it (D15). */
export interface StackProjectFieldFact {
    /** The value all of them share; `null` when they differ: "+N" alone. */
    readonly value: string | null;
    readonly title: string;
    readonly more: string | null;
}

/** One pull request of the entry as its expanded card lists it (SP26): in its own state. */
export interface StackMemberFact extends StackLook {
    readonly pullRequest: PullRequestItem;
}

/** What a stack's row and card show, worked out once for both. */
export interface StackFactsViewModel {
    /**
     * How many pull requests it holds: "4", "2 of 4" for a share (D16), "2 of 4 in githq" while incomplete, "1 of 4
     * matches" under a filter matching some of them (D3, SP25).
     */
    readonly count: string;
    /** A share's own pull requests, drawn in their state; `null` for the whole stack's entry. */
    readonly filled: ReadonlySet<string> | null;
    /** Up to three faces, and "+N" for the rest; `null` when none are left out. */
    readonly people: { readonly faces: readonly ItemUser[]; readonly more: string | null };
    readonly age: string;
    readonly state: StackStateFact;
    /** Their lines added and removed, summed. */
    readonly size: string;
    /** The labels all of them carry, and "+N" for the others any of them does (D15); `null` when there are none. */
    readonly labels: { readonly shared: readonly ItemLabel[]; readonly more: string | null };
    /** The milestone all share, "2 milestones" when they differ, `null` when some have none. */
    readonly milestone: string | null;
    readonly projectField: StackProjectFieldFact | null;
    /** Its pull requests in order, each in its own state. */
    readonly members: readonly StackMemberFact[];
}

/** What the held sentence counts and names. */
interface HeldTextParams {
    readonly ready: number;
    readonly open: number;
    readonly number: number;
}

/** What a share's held sentence names. */
interface ShareHeldTextParams {
    readonly number: number;
}

/** The stack's held sentence for each reason: "2 of 4 ready, #1206 is a draft" (SP14). */
const HELD_TEXTS: Readonly<Record<HeldReason, Translation<HeldTextParams>>> = {
    draft: l.heldByDraft,
    checks: l.heldByChecks,
    review: l.heldByReview,
    other: l.held,
};

/** A share's held sentence for each reason, without the stack's count: "#1206 is a draft" (SP24). */
const SHARE_HELD_TEXTS: Readonly<Record<HeldReason, Translation<ShareHeldTextParams>>> = {
    draft: l.shareHeldByDraft,
    checks: l.shareHeldByChecks,
    review: l.shareHeldByReview,
    other: l.shareHeld,
};

/**
 * What a row or a card of a stack's entry says about it (D14, D15, D16, SP14, SP24): how many pull requests it holds,
 * the people, the age, the state in words naming what holds it — a share's own, "Both ready", "#1206 blocks" — and what
 * its pull requests share; the same in a list and on a board.
 */
export function useStackFacts(options: UseStackFactsOptions): StackFactsViewModel {
    const t = useTranslate();
    const numbers = new Intl.NumberFormat(APP_LANGUAGE);
    const fieldList = new Intl.ListFormat(APP_LANGUAGE);

    const entry = makeRef(options.stack);
    const now = makeRef(options.now);
    const peopleShown = makeRef(options.people);
    const viewerLogin = makeRef(options.viewerLogin);

    const description = computed(() => entry.value.description);
    const count = computed(() => {
        const { held, size } = description.value;
        const { unmatched, pullRequests } = entry.value;
        if (unmatched && unmatched.size > 0) {
            const total = pullRequests.length;
            return t(l.matches, { count: total - unmatched.size, size: total });
        }

        if (entry.value.share) {
            return t(l.share, { count: entry.value.share.count, size });
        }

        return description.value.state.kind === 'incomplete' ? t(l.inGithq, { held, size }) : String(size);
    });
    const filled = computed(() => (entry.value.share ? new Set(entry.value.pullRequests.map(pr => pr.id)) : null));
    const people = computed(() => {
        const byLogin = new Map<string, ItemUser>();
        for (const pr of entry.value.pullRequests) {
            for (const user of getItemPeople({ item: pr, shown: peopleShown.value, viewerLogin: viewerLogin.value })) {
                byLogin.set(user.login, user);
            }
        }

        const all = [...byLogin.values()];
        return { faces: all.slice(0, MAX_PEOPLE), more: formatMore(all.length - MAX_PEOPLE) };
    });
    const age = computed(() => formatAge(Date.parse(description.value.updatedAt), now.value));
    const stateFact = computed(() => getStateFact(description.value, entry.value.share?.state ?? null));
    const size = computed(() => {
        let additions = 0;
        let deletions = 0;
        for (const pr of entry.value.pullRequests) {
            additions += pr.additions;
            deletions += pr.deletions;
        }

        return t(l.size, { additions: numbers.format(additions), deletions: numbers.format(deletions) });
    });
    // D15: the labels every pull request carries, then how many others any of them does.
    const labels = computed(() => {
        const [first, ...others] = entry.value.pullRequests;
        const shared: ItemLabel[] = (first?.labels ?? []).filter(label =>
            others.every(pr => pr.labels.some(other => other.name === label.name)),
        );
        const names = new Set(entry.value.pullRequests.flatMap(pr => pr.labels.map(label => label.name)));
        return { shared, more: formatMore(names.size - shared.length) };
    });
    // D15: the milestone when all share it, else how many there are among them.
    const milestone = computed(() => {
        const titles = new Set<string>();
        for (const pr of entry.value.pullRequests) {
            if (pr.milestone) {
                titles.add(pr.milestone.title);
            }
        }

        const [title] = titles;
        if (titles.size > 1) {
            return t(l.milestones, { count: titles.size });
        }

        return title !== undefined && entry.value.pullRequests.every(pr => pr.milestone) ? title : null;
    });
    // D15, as labels: the row field of the first project (githq D12) when every pull request has the same, else how
    // many values there are among them.
    const projectField = computed((): StackProjectFieldFact | null => {
        const values = new Map<string, string>();
        for (const pr of entry.value.pullRequests) {
            const [first] = pr.projects;
            if (first?.status) {
                const title = t(l.projectField, { project: first.title, value: first.status.name });
                values.set(title, first.status.name);
            }
        }

        const [shared] = values;
        if (!shared) {
            return null;
        }

        const [title, value] = shared;
        if (values.size === 1 && entry.value.pullRequests.every(pr => pr.projects[0]?.status)) {
            return { value, title, more: null };
        }

        return { value: null, title: fieldList.format(values.keys()), more: t(l.more, { count: values.size }) };
    });
    const members = computed(() => {
        const kinds = new Map<string, StackPullRequestPipKind>();
        for (const pip of description.value.pips) {
            if (pip.kind !== 'missing') {
                kinds.set(pip.pullRequest.id, pip.kind);
            }
        }

        return entry.value.pullRequests.map((pullRequest): StackMemberFact => ({
            pullRequest,
            ...getPullRequestLook(kinds.get(pullRequest.id) ?? 'waiting'),
        }));
    });

    return reactive<StackFactsViewModel>({
        count,
        filled,
        people,
        age,
        state: stateFact,
        size,
        labels,
        milestone,
        projectField,
        members,
    });

    /** "+N", or `null` when nothing is left out. */
    function formatMore(left: number): string | null {
        return left > 0 ? t(l.more, { count: left }) : null;
    }

    function getStateFact(stack: StackDescription, share: StackShareState | null): StackStateFact {
        const { state } = stack;
        const fact = share ? getShareStateFact(share) : getStackStateFact({ state, lang: APP_LANGUAGE, getHeldText });
        const open = state.kind !== 'merged' && state.kind !== 'closed' && state.kind !== 'incomplete';
        return open && stack.landed > 0
            ? { ...fact, text: t(l.landed, { count: stack.landed, state: fact.text }) }
            : fact;
    }

    /** A share's sentence (SP24): ready, or what holds it, named without the stack's count. */
    function getShareStateFact(share: StackShareState): StackStateFact {
        switch (share.kind) {
            case 'ready':
                return getStackStateFact({
                    state: { kind: 'ready', openCount: share.count },
                    lang: APP_LANGUAGE,
                    getHeldText,
                });
            case 'held':
                return { ...getBlockerLook(share.blocker.kind), text: getShareHeldText(share.blocker) };
            default:
                return assertNever(share);
        }
    }

    /** What holds a share, as {@link getHeldText} names it: "#1206 blocks", "#1216 checks running". */
    function getShareHeldText(blocker: StackBlocker): string {
        return t(SHARE_HELD_TEXTS[getHeldReason(blocker)], { number: blocker.number });
    }

    /** The held sentence names what holds the stack (SP14): "2 of 4 ready, #1216 checks running". */
    function getHeldText({ blocker, readyCount, openCount }: StackHeldState): string {
        return t(HELD_TEXTS[getHeldReason(blocker)], { ready: readyCount, open: openCount, number: blocker.number });
    }
}
