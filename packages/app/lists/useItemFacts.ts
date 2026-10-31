import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
    CircleCheck,
    CircleDot,
    CircleSlash,
    CircleX,
    Eye,
    GitMerge,
    GitPullRequest,
    GitPullRequestClosed,
    GitPullRequestDraft,
    Hourglass,
    Loader,
} from 'lucide-vue-next';
import { computed } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import { isPendingItem } from '@/store/isPendingItem.js';
import type { Item, ItemUser, PullRequestItem } from '@/store/ItemTypes.js';
import { formatAge } from '@/utils/formatAge.js';

import * as l from './useItemFacts.loc.js';

/** Which item and how it is listed. */
export interface UseItemFactsOptions {
    readonly item: MaybeRefOrGetter<Item>;
    /** The issue a pull request is nested under: its number alone names it when they share a repository. */
    readonly parent: MaybeRefOrGetter<Item | null | undefined>;
    /** The repository the whole list is of: its items are named by number alone. */
    readonly repository: MaybeRefOrGetter<string | null | undefined>;
    /** The signed-in user: their own items show no author. */
    readonly viewerLogin: MaybeRefOrGetter<string>;
    /** Epoch ms the age is counted to. */
    readonly now: MaybeRefOrGetter<number>;
    /** The item is listed because the user's review is asked: an open pull request with nothing else to say says so. */
    readonly reviewRequested: MaybeRefOrGetter<boolean>;
    /** The people shown: who opened it (my work, where it is the user's own work), or who it is assigned to. */
    readonly people: MaybeRefOrGetter<'assignees' | 'author'>;
}

/** The kind and state of an item, as its icon. */
export interface ItemKindFact {
    readonly icon: LucideIcon;
    readonly label: string;
    readonly tone: 'closed' | 'done' | 'draft' | 'open';
}

/** Where a pull request stands, in one line ("2 checks failing · changes requested"). */
export interface ItemStatusFact {
    readonly icon: LucideIcon;
    readonly tone: 'danger' | 'dim' | 'muted' | 'success' | 'warning';
    readonly text: string;
    /** Ready to merge: "Open on GitHub" follows — githq does not merge. */
    readonly openOnGitHub: boolean;
}

/** The row field of the item's first project (D12) and how many more projects it is in. */
export interface ItemProjectFieldFact {
    /** `null` when the first project's row field is empty: the marker and "+N" alone. */
    readonly value: string | null;
    readonly title: string;
    readonly more: string | null;
}

/** What a row and a card of an item show, worked out once for both. */
export interface ItemFactsViewModel {
    readonly kind: ItemKindFact;
    /** `owner/name#123`, or `#123` in a repository's list or under an issue of the same repository. */
    readonly reference: string;
    readonly people: readonly ItemUser[];
    readonly age: string;
    readonly status: ItemStatusFact | null;
    /** A pull request's lines added and removed; not for one nested under an issue. */
    readonly size: string | null;
    readonly projectField: ItemProjectFieldFact | null;
}

/**
 * What a row or a card of an issue or a pull request says about it: its kind and state, its reference, people,
 * age, where a pull request stands, its size and the row field of its first project (D12) — the same in a list
 * and on a board.
 */
export function useItemFacts(options: UseItemFactsOptions): ItemFactsViewModel {
    const t = useTranslate();
    const numbers = new Intl.NumberFormat(APP_LANGUAGE);
    const projectList = new Intl.ListFormat(APP_LANGUAGE);

    const item = makeRef(options.item);
    const parent = makeRef(options.parent);
    const repository = makeRef(options.repository);
    const viewerLogin = makeRef(options.viewerLogin);
    const now = makeRef(options.now);
    const reviewRequested = makeRef(options.reviewRequested);
    const peopleShown = makeRef(options.people);

    const kind = computed(() => getKind(item.value));
    const reference = computed(() => {
        const listed = item.value;
        const { nameWithOwner } = listed.repository;
        const number = isPendingItem(listed) ? '…' : String(listed.number);
        return parent.value?.repository.nameWithOwner === nameWithOwner || repository.value === nameWithOwner
            ? `#${number}`
            : `${nameWithOwner}#${number}`;
    });
    const people = computed((): readonly ItemUser[] => {
        const listed = item.value;
        if (peopleShown.value === 'assignees') {
            return listed.assignees;
        }

        return listed.author && listed.author.login !== viewerLogin.value ? [listed.author] : [];
    });
    const age = computed(() => formatAge(Date.parse(item.value.updatedAt), now.value));
    const status = computed(() => {
        const listed = item.value;
        return listed.kind === 'pullRequest' && listed.state === 'OPEN' ? getStatus(listed) : null;
    });
    const size = computed(() => {
        const listed = item.value;
        return listed.kind === 'pullRequest' && !parent.value
            ? t(l.size, { additions: numbers.format(listed.additions), deletions: numbers.format(listed.deletions) })
            : null;
    });
    // D12: the row field of the first project — nothing of it when empty — and how many more projects it is in; the
    // marker stays for "+N" alone. The item comes with its projects in the sidebar's order and each tracked one's row
    // field as its `status` (`ProjectStore.withRowFields`).
    const projectField = computed((): ItemProjectFieldFact | null => {
        const { projects } = item.value;
        const [first, ...others] = projects;
        if (!first || (!first.status && others.length === 0)) {
            return null;
        }

        return {
            value: first.status?.name ?? null,
            title: first.status
                ? t(l.projectField, { project: first.title, value: first.status.name })
                : projectList.format(projects.map(project => project.title)),
            more: others.length > 0 ? t(l.moreProjects, { count: others.length }) : null,
        };
    });

    return reactive<ItemFactsViewModel>({ kind, reference, people, age, status, size, projectField });

    function getKind(listed: Item): ItemKindFact {
        if (listed.kind === 'issue') {
            if (listed.state === 'OPEN') {
                return { icon: CircleDot, label: t(l.openIssue), tone: 'open' };
            }

            return listed.stateReason === 'COMPLETED' || listed.stateReason === null
                ? { icon: CircleCheck, label: t(l.closedIssue), tone: 'done' }
                : { icon: CircleSlash, label: t(l.notPlannedIssue), tone: 'draft' };
        }

        if (listed.merged) {
            return { icon: GitMerge, label: t(l.mergedPullRequest), tone: 'done' };
        }

        if (listed.state !== 'OPEN') {
            return { icon: GitPullRequestClosed, label: t(l.closedPullRequest), tone: 'closed' };
        }

        return listed.isDraft
            ? { icon: GitPullRequestDraft, label: t(l.draftPullRequest), tone: 'draft' }
            : { icon: GitPullRequest, label: t(l.openPullRequest), tone: 'open' };
    }

    function getStatus(pr: PullRequestItem): ItemStatusFact | null {
        const standing = getPullRequestStanding(pr);
        if (standing.needsAuthor) {
            const parts: string[] = [];
            if (standing.checksFailing) {
                parts.push(
                    standing.failingChecks > 0
                        ? t(l.checksFailing, { count: standing.failingChecks })
                        : t(l.checksFailingUncounted),
                );
            }

            if (standing.changesRequested) {
                parts.push(t(l.changesRequested));
            }

            if (standing.conflicts) {
                parts.push(t(l.conflicts));
            }

            return { icon: CircleX, tone: 'danger', text: parts.join(' · '), openOnGitHub: false };
        }

        if (standing.checksRunning) {
            return { icon: Loader, tone: 'warning', text: t(l.checksRunning), openOnGitHub: false };
        }

        if (standing.readyToMerge) {
            return { icon: CircleCheck, tone: 'success', text: t(l.approvedReadyToMerge), openOnGitHub: true };
        }

        if (standing.approved) {
            return { icon: CircleCheck, tone: 'success', text: t(l.approved), openOnGitHub: false };
        }

        if (reviewRequested.value) {
            return { icon: Eye, tone: 'muted', text: t(l.yourReviewRequested), openOnGitHub: false };
        }

        if (pr.isDraft) {
            return { icon: GitPullRequestDraft, tone: 'dim', text: t(l.draft), openOnGitHub: false };
        }

        if (standing.waitingForReview) {
            return { icon: Hourglass, tone: 'muted', text: t(l.waitingForReview), openOnGitHub: false };
        }

        return null;
    }
}
