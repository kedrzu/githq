import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
    CircleCheck,
    CircleDashed,
    CircleX,
    Eye,
    GitCompareArrows,
    GitMerge,
    GitPullRequestClosed,
    GitPullRequestDraft,
    Hourglass,
    Loader,
} from 'lucide-vue-next';
import { computed } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { ItemLabel, ItemUser, PullRequestItem } from '@/store/ItemTypes.js';
import type { StackBlocker, StackDescription, StackPullRequestPipKind } from '@/store/stacks/describeStack.js';
import type { StackShareState } from '@/store/stacks/describeStackShare.js';
import { formatAge } from '@/utils/formatAge.js';

import type { ListStack } from './ListTypes.js';
import * as l from './useStackFacts.loc.js';
import { getItemPeople } from './utils/getItemPeople.js';

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
        const fact = share ? getShareStateFact(share) : getOpenStateFact(stack);
        const { state } = stack;
        const open = state.kind !== 'merged' && state.kind !== 'closed' && state.kind !== 'incomplete';
        return open && stack.landed > 0
            ? { ...fact, text: t(l.landed, { count: stack.landed, state: fact.text }) }
            : fact;
    }

    function getOpenStateFact({ state }: StackDescription): StackStateFact {
        switch (state.kind) {
            case 'ready':
                return getReadyFact(state.openCount);
            case 'held': {
                const { blocker, readyCount, openCount } = state;
                const params = { ready: readyCount, open: openCount, number: blocker.number };
                return { ...getBlockerLook(blocker.kind), text: getHeldText(blocker, params) };
            }
            case 'needsRebase':
                return { icon: GitCompareArrows, tone: 'warning', text: t(l.needsRebase) };
            case 'closedInside':
                return {
                    icon: GitPullRequestClosed,
                    tone: 'danger',
                    text: t(l.closedInside, { number: state.closedNumber, stuck: state.stuckCount }),
                };
            case 'closed':
                return { icon: GitPullRequestClosed, tone: 'dim', text: t(l.closed) };
            case 'incomplete':
                return { icon: CircleDashed, tone: 'dim', text: t(l.incomplete) };
            case 'merged':
                return { icon: GitMerge, tone: 'done', text: t(l.merged) };
            case 'reviewRequested':
                return {
                    icon: Eye,
                    tone: 'muted',
                    text: t(l.reviewRequested, {
                        requested: state.requestedCount,
                        open: state.openCount,
                        ready: state.readyCount,
                    }),
                };
            default:
                return assertNever(state);
        }
    }

    /** A share's sentence (SP24): ready, or what holds it, named without the stack's count. */
    function getShareStateFact(share: StackShareState): StackStateFact {
        switch (share.kind) {
            case 'ready':
                return getReadyFact(share.count);
            case 'held':
                return { ...getBlockerLook(share.blocker.kind), text: getShareHeldText(share.blocker) };
            default:
                return assertNever(share);
        }
    }

    /** "Both ready" for two (SP24), "All 3 ready" for more. */
    function getReadyFact(readyCount: number): StackStateFact {
        const text = readyCount === 2 ? t(l.bothReady) : t(l.ready, { count: readyCount });
        return { icon: CircleCheck, tone: 'success', text };
    }

    /** What holds a share, as {@link getHeldText} names it: "#1206 blocks", "#1216 checks running". */
    function getShareHeldText(blocker: StackBlocker): string {
        const params = { number: blocker.number };
        switch (blocker.kind) {
            case 'draft':
                return t(l.shareHeldByDraft, params);
            case 'moving':
                return t(l.shareHeldByChecks, params);
            case 'waiting':
                return blocker.waitingForReview ? t(l.shareHeldByReview, params) : t(l.shareHeld, params);
            case 'broken':
            case 'ready':
            case 'merged':
            case 'closed':
                return t(l.shareHeld, params);
            default:
                return assertNever(blocker.kind);
        }
    }

    /** The held sentence names what holds the stack (SP14): "#1216 checks running", "#97 waiting for review". */
    function getHeldText(blocker: StackBlocker, params: HeldTextParams): string {
        switch (blocker.kind) {
            case 'draft':
                return t(l.heldByDraft, params);
            case 'moving':
                return t(l.heldByChecks, params);
            case 'waiting':
                return blocker.waitingForReview ? t(l.heldByReview, params) : t(l.held, params);
            case 'broken':
            case 'ready':
            case 'merged':
            case 'closed':
                return t(l.held, params);
            default:
                return assertNever(blocker.kind);
        }
    }
}

/** A held stack reads in the colour of what holds it (SP14): red when broken, amber when moving, grey otherwise. */
function getBlockerLook(kind: StackPullRequestPipKind): StackLook {
    switch (kind) {
        case 'broken':
            return { icon: CircleX, tone: 'danger' };
        case 'moving':
            return { icon: Loader, tone: 'warning' };
        case 'draft':
            return { icon: GitPullRequestDraft, tone: 'dim' };
        case 'waiting':
        case 'ready':
        case 'merged':
        case 'closed':
            return { icon: Hourglass, tone: 'muted' };
        default:
            return assertNever(kind);
    }
}

/** A pull request in its own state, as its pip draws it (D6): the icon and colour its line in an expanded card shows. */
function getPullRequestLook(kind: StackPullRequestPipKind): StackLook {
    switch (kind) {
        case 'ready':
            return { icon: CircleCheck, tone: 'success' };
        case 'merged':
            return { icon: GitMerge, tone: 'done' };
        case 'closed':
            return { icon: GitPullRequestClosed, tone: 'danger' };
        case 'broken':
        case 'moving':
        case 'draft':
        case 'waiting':
            return getBlockerLook(kind);
        default:
            return assertNever(kind);
    }
}
