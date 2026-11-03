import { assertNever } from '@nzyme/utils/assertNever.js';
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
    GitPullRequestDraft,
    Hourglass,
    ListOrdered,
    Loader,
    Timer,
} from 'lucide-vue-next';
import { computed } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { getMergeEnd } from '@/merge/getMergeEnd.js';
import { getMergeEndLook } from '@/merge/getMergeEndLook.js';
import { useMergeMethodName } from '@/merge/useMergeMethodName.js';
import { useMergeQueueTexts } from '@/merge/useMergeQueueTexts.js';
import type { MergeEnd, MergeRecord } from '@/merge/MergeTypes.js';
import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import { isPendingItem } from '@/store/isPendingItem.js';
import type {
    Item,
    ItemUser,
    PullRequestAutoMerge,
    PullRequestItem,
    PullRequestQueueEntry,
} from '@/store/ItemTypes.js';
import { formatAge } from '@/utils/formatAge.js';

import * as l from './useItemFacts.loc.js';
import { getItemPeople } from './utils/getItemPeople.js';
import { getPullRequestKind } from './utils/getPullRequestKind.js';

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
    /** What this session knows of the pull request's last merge that did not end merged, while it speaks for it (D15). */
    readonly mergeRecord?: MaybeRefOrGetter<MergeRecord | null>;
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
    readonly tone: 'accent' | 'danger' | 'dim' | 'done' | 'muted' | 'success' | 'warning';
    readonly text: string;
    /** Ready to merge: "Merge" follows where the viewer may merge it, else "Open on GitHub". */
    readonly readyToMerge: boolean;
    /** Its merge was refused: "Back to the merge" follows where the viewer may merge it (PM37). */
    readonly backToMerge?: boolean;
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
    const queueTexts = useMergeQueueTexts();
    const getMethodName = useMergeMethodName();
    const numbers = new Intl.NumberFormat(APP_LANGUAGE);
    const projectList = new Intl.ListFormat(APP_LANGUAGE);

    const item = makeRef(options.item);
    const parent = makeRef(options.parent);
    const repository = makeRef(options.repository);
    const viewerLogin = makeRef(options.viewerLogin);
    const now = makeRef(options.now);
    const reviewRequested = makeRef(options.reviewRequested);
    const peopleShown = makeRef(options.people);
    const mergeRecord = makeRef(options.mergeRecord ?? null);

    const kind = computed(() => getKind(item.value));
    const reference = computed(() => {
        const listed = item.value;
        const { nameWithOwner } = listed.repository;
        const number = isPendingItem(listed) ? '…' : String(listed.number);
        return parent.value?.repository.nameWithOwner === nameWithOwner || repository.value === nameWithOwner
            ? `#${number}`
            : `${nameWithOwner}#${number}`;
    });
    const people = computed(() =>
        getItemPeople({ item: item.value, shown: peopleShown.value, viewerLogin: viewerLogin.value }),
    );
    const age = computed(() => formatAge(Date.parse(item.value.updatedAt), now.value));
    const status = computed(() => {
        const listed = item.value;
        if (listed.kind !== 'pullRequest') {
            return null;
        }

        if (listed.merged) {
            return getMergedStatus(listed);
        }

        return listed.state === 'OPEN' ? getStatus(listed) : null;
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

        const pullRequestKind = getPullRequestKind(listed);
        // Its kind and state read out, by the tone of its icon.
        const key: `${ItemKindFact['tone']}PullRequest` = `${pullRequestKind.tone}PullRequest`;
        return { ...pullRequestKind, label: t(l[key]) };
    }

    /** PM37: "Merged · 2m"; without GitHub's time of the merge, merged alone. */
    function getMergedStatus(pr: PullRequestItem): ItemStatusFact {
        const at = pr.closedAt;
        return {
            icon: GitMerge,
            tone: 'done',
            text: at === null ? t(l.merged) : t(l.mergedAgo, { age: formatAge(Date.parse(at), now.value) }),
            readyToMerge: false,
        };
    }

    /** PM37: how the last merge of it ended when it did not merge — refused, a new commit, or not known yet. */
    function getEndStatus(end: MergeEnd): ItemStatusFact {
        const look = getMergeEndLook(end.kind);
        switch (end.kind) {
            case 'refused':
            case 'methodNotAllowed':
                return { ...look, text: t(l.mergeRefused), readyToMerge: false, backToMerge: true };
            case 'headMoved': {
                const author = end.commit?.author;
                const text = author ? t(l.newCommitFrom, { author }) : t(l.newCommit);
                return { ...look, text, readyToMerge: false, backToMerge: true };
            }
            case 'unknown':
                return { ...look, text: t(l.outcomeUnknown), readyToMerge: false };
            default:
                return assertNever(end);
        }
    }

    /** PM37: "In queue · 3rd · about 12 min"; GitHub saying it won't merge, in red. */
    function getQueueStatus(entry: PullRequestQueueEntry): ItemStatusFact {
        const place = queueTexts.place(entry);
        if (entry.state === 'UNMERGEABLE') {
            return { icon: ListOrdered, tone: 'danger', text: t(l.inQueueWontMerge, { place }), readyToMerge: false };
        }

        const about = queueTexts.estimate(entry);
        const text = about === null ? t(l.inQueue, { place }) : t(l.inQueueAbout, { place, about });
        return { icon: ListOrdered, tone: 'accent', text, readyToMerge: false };
    }

    /** PM37: "Auto-merge on · squash · waiting for checks", or for whichever else it waits. */
    function getAutoMergeStatus(pr: PullRequestItem, autoMerge: PullRequestAutoMerge): ItemStatusFact {
        const method = getMethodName(autoMerge.mergeMethod);
        const standing = getPullRequestStanding(pr);
        let text = t(l.autoMergeOn, { method });
        if (standing.checksRunning) {
            text = t(l.autoMergeWaitingForChecks, { method });
        } else if (standing.waitingForReview) {
            text = t(l.autoMergeWaitingForReview, { method });
        }

        return { icon: Timer, tone: 'accent', text, readyToMerge: false };
    }

    function getStatus(pr: PullRequestItem): ItemStatusFact | null {
        // Merged once GitHub says so (merging D3): until then it stays open, being merged.
        if (pr.merging) {
            return { icon: Loader, tone: 'warning', text: t(l.beingMerged), readyToMerge: false };
        }

        // GitHub's own state (merging D3).
        if (pr.mergeQueueEntry) {
            return getQueueStatus(pr.mergeQueueEntry);
        }

        if (pr.autoMerge) {
            return getAutoMergeStatus(pr, pr.autoMerge);
        }

        const end = getMergeEnd(mergeRecord.value, pr, null);
        if (end) {
            return getEndStatus(end);
        }

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

            return { icon: CircleX, tone: 'danger', text: parts.join(' · '), readyToMerge: false };
        }

        if (standing.checksRunning) {
            return { icon: Loader, tone: 'warning', text: t(l.checksRunning), readyToMerge: false };
        }

        if (standing.readyToMerge) {
            return { icon: CircleCheck, tone: 'success', text: t(l.approvedReadyToMerge), readyToMerge: true };
        }

        if (standing.approved) {
            return { icon: CircleCheck, tone: 'success', text: t(l.approved), readyToMerge: false };
        }

        if (reviewRequested.value) {
            return { icon: Eye, tone: 'muted', text: t(l.yourReviewRequested), readyToMerge: false };
        }

        if (pr.isDraft) {
            return { icon: GitPullRequestDraft, tone: 'dim', text: t(l.draft), readyToMerge: false };
        }

        if (standing.waitingForReview) {
            return { icon: Hourglass, tone: 'muted', text: t(l.waitingForReview), readyToMerge: false };
        }

        return null;
    }
}
