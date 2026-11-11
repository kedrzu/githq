import { assertValue } from '@nzyme/utils/assert.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
    CircleCheck,
    CircleX,
    Eye,
    GitMerge,
    GitPullRequestDraft,
    Hourglass,
    ListOrdered,
    Loader,
    PencilLine,
    Timer,
} from 'lucide-vue-next';
import { computed } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { getMergeEnd } from '@/merge/getMergeEnd.js';
import { getMergeEndLook } from '@/merge/getMergeEndLook.js';
import { useMergeMethodName } from '@/merge/useMergeMethodName.js';
import { useMergeQueueTexts } from '@/merge/useMergeQueueTexts.js';
import type { MergeEnd, MergeRecord } from '@/merge/MergeTypes.js';
import { getPullRequestPhase } from '@/store/getPullRequestPhase.js';
import type { PullRequestPhase } from '@/store/getPullRequestPhase.js';
import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import type { PullRequestStanding } from '@/store/getPullRequestStanding.js';
import { isPendingItem } from '@/store/isPendingItem.js';
import type {
    Item,
    ItemUser,
    PullRequestAutoMerge,
    PullRequestItem,
    PullRequestQueueEntry,
} from '@/store/ItemTypes.js';
import { formatAge } from '@/utils/formatAge.js';
import { formatList } from '@/utils/formatList.js';

import * as l from './useItemFacts.loc.js';
import { getItemPeople } from './utils/getItemPeople.js';
import { getItemKind } from './utils/getItemKind.js';

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

/** An issue's state read out, by the tone of its icon: closed as not planned is drawn as a draft is. */
const ISSUE_LABELS = {
    open: l.openIssue,
    done: l.closedIssue,
    draft: l.notPlannedIssue,
    closed: l.notPlannedIssue,
} as const;

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

/** The lines a pull request adds and removes. */
export interface ItemSizeFact {
    readonly additions: number;
    readonly deletions: number;
}

/** Where a pull request stands: its status and, apart from it, that its checks passed. */
type PullRequestStandingFacts = Pick<ItemFactsViewModel, 'status' | 'checks'>;

/** The phases of an open pull request with no merge under way: its standing speaks for it. */
type StandingPhase = Exclude<PullRequestPhase, 'merged' | 'closed' | 'beingMerged' | 'inQueue' | 'autoMerge'>;

/** What a row and a card of an item show, worked out once for both. */
export interface ItemFactsViewModel {
    readonly kind: ItemKindFact;
    /** `owner/name#123`, or `#123` in a repository's list or under an issue of the same repository. */
    readonly reference: string;
    readonly people: readonly ItemUser[];
    readonly age: string;
    readonly status: ItemStatusFact | null;
    /** "Checks passed", said before {@link status} unless a green status already says as much. */
    readonly checks: ItemStatusFact | null;
    /** A pull request's lines added and removed, nested under an issue or not; an issue and a draft have none. */
    readonly size: ItemSizeFact | null;
    readonly projectField: ItemProjectFieldFact | null;
}

/**
 * What a row or a card of an issue or a pull request says about it: its kind and state, its reference, people,
 * age, where a pull request stands and whether its checks passed, its size and the row field of its first project
 * (D12) — the same in a list and on a board.
 */
export function useItemFacts(options: UseItemFactsOptions): ItemFactsViewModel {
    const t = useTranslate();
    const queueTexts = useMergeQueueTexts();
    const getMethodName = useMergeMethodName();

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
    const pullRequestFacts = computed((): PullRequestStandingFacts => {
        const listed = item.value;
        if (listed.kind !== 'pullRequest') {
            return { status: null, checks: null };
        }

        const standing = getPhaseFacts(listed, getPullRequestPhase(listed, { reviewRequested: reviewRequested.value }));

        // D28: until it's sent nothing else about it moves, and a draft outlives the pull request being closed. Only a
        // merge on its way goes first, for the moment it takes. The draft takes the words, not what can be done: `⇧M`
        // still merges.
        if (listed.pendingReview && !listed.merging) {
            return {
                checks: null,
                status: {
                    readyToMerge: false,
                    ...standing.status,
                    icon: PencilLine,
                    tone: 'warning',
                    text: t(l.draftReview, { count: listed.pendingReview.commentCount }),
                },
            };
        }

        return standing;
    });
    const status = computed(() => pullRequestFacts.value.status);
    const checks = computed(() => pullRequestFacts.value.checks);
    const size = computed((): ItemSizeFact | null => {
        const listed = item.value;
        return listed.kind === 'pullRequest' ? { additions: listed.additions, deletions: listed.deletions } : null;
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
                : formatList(projects.map(project => project.title)),
            more: others.length > 0 ? t(l.moreProjects, { count: others.length }) : null,
        };
    });

    return reactive<ItemFactsViewModel>({ kind, reference, people, age, status, checks, size, projectField });

    function getKind(listed: Item): ItemKindFact {
        const look = getItemKind(listed);
        if (listed.kind === 'issue') {
            return { ...look, label: t(ISSUE_LABELS[look.tone]) };
        }

        // Its kind and state read out, by the tone of its icon.
        const key: `${ItemKindFact['tone']}PullRequest` = `${look.tone}PullRequest`;
        return { ...look, label: t(l[key]) };
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

    /** The two facts of a pull request in its phase, worked out together so they cannot disagree. */
    function getPhaseFacts(pr: PullRequestItem, phase: PullRequestPhase): PullRequestStandingFacts {
        switch (phase) {
            case 'merged':
                return { status: getMergedStatus(pr), checks: null };
            case 'closed':
                return { status: null, checks: null };
            // What is under way with its merge says all there is, with nothing of its checks.
            case 'beingMerged':
                return {
                    status: { icon: Loader, tone: 'warning', text: t(l.beingMerged), readyToMerge: false },
                    checks: null,
                };
            // GitHub's own state (merging D3).
            case 'inQueue':
                return { status: getQueueStatus(assertValue(pr.mergeQueueEntry)), checks: null };
            case 'autoMerge':
                return { status: getAutoMergeStatus(pr, assertValue(pr.autoMerge)), checks: null };
            case 'needsAuthor':
            case 'checksRunning':
            case 'approvedReady':
            case 'readyWithoutReview':
            case 'approved':
            case 'reviewRequested':
            case 'draft':
            case 'waitingForReview':
            case 'none':
                return getOpenFacts(pr, phase);
            default:
                return assertNever(phase);
        }
    }

    /** How the last merge of an open pull request ended, else its standing and that its checks passed. */
    function getOpenFacts(pr: PullRequestItem, phase: StandingPhase): PullRequestStandingFacts {
        // The ending says all there is, with nothing of its checks.
        const end = getMergeEnd(mergeRecord.value, pr, null);
        if (end) {
            return { status: getEndStatus(end), checks: null };
        }

        const standing = getPullRequestStanding(pr);
        const said = getStandingStatus(standing, phase);
        // A green status already speaks for the checks.
        return {
            status: said,
            checks:
                standing.checksPassed && said?.tone !== 'success'
                    ? { icon: CircleCheck, tone: 'success', text: t(l.checksPassed), readyToMerge: false }
                    : null,
        };
    }

    function getStandingStatus(standing: PullRequestStanding, phase: StandingPhase): ItemStatusFact | null {
        switch (phase) {
            case 'needsAuthor': {
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
            case 'checksRunning':
                return { icon: Loader, tone: 'warning', text: t(l.checksRunning), readyToMerge: false };
            case 'approvedReady':
                return { icon: CircleCheck, tone: 'success', text: t(l.approvedReadyToMerge), readyToMerge: true };
            case 'readyWithoutReview':
                return { icon: CircleCheck, tone: 'success', text: t(l.readyToMerge), readyToMerge: true };
            case 'approved': {
                const text = standing.checksPassed ? t(l.approvedChecksPassed) : t(l.approved);
                return { icon: CircleCheck, tone: 'success', text, readyToMerge: false };
            }
            case 'reviewRequested':
                return { icon: Eye, tone: 'muted', text: t(l.yourReviewRequested), readyToMerge: false };
            case 'draft':
                return { icon: GitPullRequestDraft, tone: 'dim', text: t(l.draft), readyToMerge: false };
            case 'waitingForReview':
                return { icon: Hourglass, tone: 'muted', text: t(l.waitingForReview), readyToMerge: false };
            case 'none':
                return null;
            default:
                return assertNever(phase);
        }
    }
}
