import type { Translation } from '@nzyme/i18n-core';
import { assertValue } from '@nzyme/utils/assert.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
    Check,
    CircleCheck,
    CircleHelp,
    CircleX,
    Eye,
    GitMerge,
    GitPullRequestDraft,
    Hourglass,
    ListOrdered,
    Loader,
    PencilLine,
    Timer,
    X,
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
import { getGitHubColor } from '@/utils/getGitHubColor.js';

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

/** What a status draws: its icon and words in its tone. */
export interface ItemStatusLook {
    readonly icon: LucideIcon;
    readonly tone: 'accent' | 'danger' | 'dim' | 'done' | 'muted' | 'success' | 'warning';
    readonly text: string;
}

/** Where a pull request stands, in one line ("2 checks failing · changes requested"). */
export interface ItemStatusFact extends ItemStatusLook {
    /** Ready to merge: "Merge" follows where the viewer may merge it, else "Open on GitHub". */
    readonly readyToMerge: boolean;
    /** Its merge was refused: "Back to the merge" follows where the viewer may merge it (PM37). */
    readonly backToMerge?: boolean;
    /** The user's draft review takes the words (D28): a list showing no status still marks it (D21). */
    readonly draftReview?: boolean;
    /** The same on a phone's row, in a word or two each ("Changes", "Conflicts"; mobile D23, MB89). */
    readonly short?: readonly ItemShortFact[];
}

/** One short fact of a phone's row: an icon and a word or a count, with the full sentence for a screen reader. */
export interface ItemShortFact extends ItemStatusLook {
    readonly label: string;
}

/** The row field of the item's first project (D12) and how many more projects it is in. */
export interface ItemProjectFieldFact {
    /** `null` when the first project's row field is empty: the marker and "+N" alone. */
    readonly value: string | null;
    /** The value's colour, hex without `#`, which a phone's row draws as a dot in place of the icon (mobile D23). */
    readonly color: string | null;
    readonly title: string;
    readonly more: string | null;
}

/** The lines a pull request adds and removes. */
export interface ItemSizeFact {
    readonly additions: number;
    readonly deletions: number;
}

/** Where a pull request stands: its status and, apart from it, its checks. */
type PullRequestStandingFacts = Pick<ItemFactsViewModel, 'status' | 'checks' | 'shortChecks'>;

/** A closed pull request, or an issue: nothing of where it stands. */
const NO_STANDING: PullRequestStandingFacts = { status: null, checks: null, shortChecks: null };

/** The phases of an open pull request with no merge under way: its standing speaks for it. */
type StandingPhase = Exclude<PullRequestPhase, 'merged' | 'closed' | 'beingMerged' | 'inQueue' | 'autoMerge'>;

/** What a row and a card of an item show, worked out once for both. */
export interface ItemFactsViewModel {
    readonly kind: ItemKindFact;
    /**
     * `owner/name#123`, or `#123` in a repository's list or under an issue of the same repository: {@link repository}
     * and {@link number} together, as a card and an issue's row name it.
     */
    readonly reference: string;
    /** `#123`, `#…` while it is on its way to GitHub. */
    readonly number: string;
    /** `owner/name`, or `null` where the number alone names it: in its repository's list or under an issue of it. */
    readonly repository: string | null;
    readonly people: readonly ItemUser[];
    readonly age: string;
    readonly status: ItemStatusFact | null;
    /** "Checks passed", said before {@link status} unless a green status already says as much. */
    readonly checks: ItemStatusFact | null;
    /**
     * A phone's row says its checks as a count before its status' short facts ("✓ 12/12", "✕ 8/9", a spinner and
     * "3/9" while some run: mobile D23, MB89); `null` without checks and where what is under way says all there is.
     */
    readonly shortChecks: ItemShortFact | null;
    /** The same count whatever its phase, merged or merging too: all a nested line says of it (mobile D24). */
    readonly checksCount: ItemShortFact | null;
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
    const listRepository = makeRef(options.repository);
    const viewerLogin = makeRef(options.viewerLogin);
    const now = makeRef(options.now);
    const reviewRequested = makeRef(options.reviewRequested);
    const peopleShown = makeRef(options.people);
    const mergeRecord = makeRef(options.mergeRecord ?? null);

    const kind = computed(() => getKind(item.value));
    const number = computed(() => `#${isPendingItem(item.value) ? '…' : String(item.value.number)}`);
    const repository = computed(() => {
        const { nameWithOwner } = item.value.repository;
        return parent.value?.repository.nameWithOwner === nameWithOwner || listRepository.value === nameWithOwner
            ? null
            : nameWithOwner;
    });
    const reference = computed(() => `${repository.value ?? ''}${number.value}`);
    const people = computed(() =>
        getItemPeople({ item: item.value, shown: peopleShown.value, viewerLogin: viewerLogin.value }),
    );
    const age = computed(() => formatAge(Date.parse(item.value.updatedAt), now.value));
    const pullRequestFacts = computed((): PullRequestStandingFacts => {
        const listed = item.value;
        if (listed.kind !== 'pullRequest') {
            return NO_STANDING;
        }

        const standing = getPhaseFacts(listed, getPullRequestPhase(listed, { reviewRequested: reviewRequested.value }));

        // D28: until it's sent nothing else about it moves, and a draft outlives the pull request being closed. Only a
        // merge on its way goes first, for the moment it takes. The draft takes the words, not what can be done: `⇧M`
        // still merges.
        if (listed.pendingReview && !listed.merging) {
            const text = t(l.draftReview, { count: listed.pendingReview.commentCount });
            return {
                checks: null,
                status: {
                    readyToMerge: false,
                    ...standing.status,
                    icon: PencilLine,
                    tone: 'warning',
                    text,
                    draftReview: true,
                    short: [getShortFact({ icon: PencilLine, tone: 'warning', text }, l.shortDraftReview)],
                },
                shortChecks: getShortChecks(listed),
            };
        }

        return standing;
    });
    const status = computed(() => pullRequestFacts.value.status);
    const checks = computed(() => pullRequestFacts.value.checks);
    const shortChecks = computed(() => pullRequestFacts.value.shortChecks);
    const checksCount = computed(() => (item.value.kind === 'pullRequest' ? getShortChecks(item.value) : null));
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
            color: first.status ? getGitHubColor(first.status.color) : null,
            title: first.status
                ? t(l.projectField, { project: first.title, value: first.status.name })
                : formatList(projects.map(project => project.title)),
            more: others.length > 0 ? t(l.moreProjects, { count: others.length }) : null,
        };
    });

    return reactive<ItemFactsViewModel>({
        kind,
        reference,
        number,
        repository,
        people,
        age,
        status,
        checks,
        shortChecks,
        checksCount,
        size,
        projectField,
    });

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
    function getEndFacts(end: MergeEnd): PullRequestStandingFacts {
        const look = getMergeEndLook(end.kind);
        switch (end.kind) {
            case 'refused':
            case 'methodNotAllowed':
                return getStatusAlone(
                    { ...look, text: t(l.mergeRefused), readyToMerge: false, backToMerge: true },
                    l.shortRefused,
                );
            case 'headMoved': {
                const author = end.commit?.author;
                const text = author ? t(l.newCommitFrom, { author }) : t(l.newCommit);
                return getStatusAlone({ ...look, text, readyToMerge: false, backToMerge: true }, l.shortNewCommit);
            }
            case 'unknown':
                return getStatusAlone({ ...look, text: t(l.outcomeUnknown), readyToMerge: false }, l.shortSent);
            default:
                return assertNever(end);
        }
    }

    /** PM37: "In queue · 3rd · about 12 min"; GitHub saying it won't merge, in red. */
    function getQueueFacts(entry: PullRequestQueueEntry): PullRequestStandingFacts {
        const place = queueTexts.place(entry);
        if (entry.state === 'UNMERGEABLE') {
            return getStatusAlone(
                { icon: ListOrdered, tone: 'danger', text: t(l.inQueueWontMerge, { place }), readyToMerge: false },
                l.shortWontMerge,
            );
        }

        const about = queueTexts.estimate(entry);
        const text = about === null ? t(l.inQueue, { place }) : t(l.inQueueAbout, { place, about });
        return getStatusAlone({ icon: ListOrdered, tone: 'accent', text, readyToMerge: false }, l.shortInQueue);
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

    /** The facts of a pull request in its phase, worked out together so they cannot disagree. */
    function getPhaseFacts(pr: PullRequestItem, phase: PullRequestPhase): PullRequestStandingFacts {
        switch (phase) {
            case 'merged':
                return getStatusAlone(getMergedStatus(pr), l.shortMerged);
            case 'closed':
                return NO_STANDING;
            case 'beingMerged':
                return getStatusAlone(
                    { icon: Loader, tone: 'warning', text: t(l.beingMerged), readyToMerge: false },
                    l.shortMerging,
                );
            // GitHub's own state (merging D3).
            case 'inQueue':
                return getQueueFacts(assertValue(pr.mergeQueueEntry));
            case 'autoMerge':
                return getStatusAlone(getAutoMergeStatus(pr, assertValue(pr.autoMerge)), l.shortAutoMerge);
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

    /** What is under way with its merge says all there is, with nothing of its checks; a phone says it in a word. */
    function getStatusAlone(said: ItemStatusFact, short: Translation): PullRequestStandingFacts {
        return { status: { ...said, short: [getShortFact(said, short)] }, checks: null, shortChecks: null };
    }

    /** How the last merge of an open pull request ended, else its standing and its checks. */
    function getOpenFacts(pr: PullRequestItem, phase: StandingPhase): PullRequestStandingFacts {
        const end = getMergeEnd(mergeRecord.value, pr, null);
        if (end) {
            return getEndFacts(end);
        }

        const standing = getPullRequestStanding(pr);
        const counted = getShortChecks(pr);
        const said = getStandingStatus(standing, phase, counted !== null);
        // A green status already speaks for the checks.
        return {
            status: said,
            checks:
                standing.checksPassed && said?.tone !== 'success'
                    ? { icon: CircleCheck, tone: 'success', text: t(l.checksPassed), readyToMerge: false }
                    : null,
            shortChecks: counted,
        };
    }

    /** Its status by its standing; on a phone a word or two, what its checks' count already says left out. */
    function getStandingStatus(
        standing: PullRequestStanding,
        phase: StandingPhase,
        checksCounted: boolean,
    ): ItemStatusFact | null {
        switch (phase) {
            case 'needsAuthor': {
                const parts: string[] = [];
                const short: ItemShortFact[] = [];
                if (standing.checksFailing) {
                    parts.push(
                        standing.failingChecks > 0
                            ? t(l.checksFailing, { count: standing.failingChecks })
                            : t(l.checksFailingUncounted),
                    );
                    if (!checksCounted) {
                        short.push(
                            getShortFact(
                                { icon: X, tone: 'danger', text: t(l.checksFailingUncounted) },
                                l.shortFailing,
                            ),
                        );
                    }
                }

                if (standing.changesRequested) {
                    parts.push(t(l.changesRequested));
                    short.push(
                        getShortFact({ icon: CircleX, tone: 'danger', text: t(l.changesRequested) }, l.shortChanges),
                    );
                }

                if (standing.conflicts) {
                    parts.push(t(l.conflicts));
                    short.push(getShortFact({ icon: CircleX, tone: 'danger', text: t(l.conflicts) }, l.shortConflicts));
                }

                return { icon: CircleX, tone: 'danger', text: parts.join(' · '), readyToMerge: false, short };
            }
            case 'checksRunning':
                return withShort(
                    { icon: Loader, tone: 'warning', text: t(l.checksRunning), readyToMerge: false },
                    checksCounted ? null : l.shortRunning,
                );
            case 'approvedReady':
                return withShort(
                    { icon: CircleCheck, tone: 'success', text: t(l.approvedReadyToMerge), readyToMerge: true },
                    l.shortReady,
                );
            case 'readyWithoutReview':
                return withShort(
                    { icon: CircleCheck, tone: 'success', text: t(l.readyToMerge), readyToMerge: true },
                    l.shortReady,
                );
            case 'approved': {
                const text = standing.checksPassed ? t(l.approvedChecksPassed) : t(l.approved);
                return withShort({ icon: CircleCheck, tone: 'success', text, readyToMerge: false }, l.shortApproved);
            }
            case 'reviewRequested': {
                const text = t(l.yourReviewRequested);
                return {
                    icon: Eye,
                    tone: 'muted',
                    text,
                    readyToMerge: false,
                    short: [getShortFact({ icon: CircleHelp, tone: 'muted', text }, l.shortReview)],
                };
            }
            case 'draft':
                return withShort(
                    { icon: GitPullRequestDraft, tone: 'dim', text: t(l.draft), readyToMerge: false },
                    l.shortDraft,
                );
            case 'waitingForReview':
                return withShort(
                    { icon: Hourglass, tone: 'muted', text: t(l.waitingForReview), readyToMerge: false },
                    l.shortWaiting,
                );
            case 'none':
                return null;
            default:
                return assertNever(phase);
        }
    }

    /** The status with its one short word on a phone, in its icon and tone; none for `null`. */
    function withShort(said: ItemStatusFact, short: Translation | null): ItemStatusFact {
        return { ...said, short: short ? [getShortFact(said, short)] : [] };
    }

    /** The sentence's short word, in its icon and tone, the sentence said in full to a screen reader. */
    function getShortFact(sentence: ItemStatusLook, key: Translation): ItemShortFact {
        return { icon: sentence.icon, tone: sentence.tone, text: t(key), label: sentence.text };
    }

    /** "✓ 12/12" all passed, "✕ 8/9" any failed, a spinner and "3/9" while some run; nothing without checks. */
    function getShortChecks(pr: PullRequestItem): ItemShortFact | null {
        if (!pr.checks) {
            return null;
        }

        const { passing, failing, pending } = pr.checks;
        const total = passing + failing + pending;
        if (total === 0) {
            return null;
        }

        const text = t(l.checksCount, { passing, total });
        if (failing > 0) {
            return { icon: X, tone: 'danger', text, label: t(l.checksFailingCount, { failing, total }) };
        }

        if (pending > 0) {
            return { icon: Loader, tone: 'warning', text, label: t(l.checksRunningCount, { passing, pending, total }) };
        }

        return { icon: Check, tone: 'success', text, label: t(l.checksPassedCount, { passing, total }) };
    }
}
