<!-- The merge panel (PM1a–PM32a, merging D6, D7, D11–D13): its own surface over any screen, 640 wide and centred, that answers "can I merge this now, and how will it land?". The verdict, the checks (`MergeChecks`), the method — only those the repository and the base branch allow, `1 2 3` — and the commit text GitHub proposes for it: a title and three lines, `E` to edit (Esc leaves the field keeping the edit, a second Esc closes). The read arriving moves nothing but the commit row (PM8): until then the methods are the repository's settings' (the read may narrow them, PM9), the checks' chevron and `C` are in place but inactive; only the commit's message, which may be empty, waits — a loader beside its title, then the message opening below it (`Reveal`) if there is one. What holds the merge besides the checks — reviews, conflicts, a branch behind — or is not known yet shows in a line above them. `⌘↵` is always the way forward of the state, from the verdict the opened item's standing shares (D12, PM38): it merges at once, before the panel's read arrives too, and while GitHub is still working out whether it merges (PM22): unedited text is then GitHub's default, and only edited text is ever sent. A draft is marked ready first (PM21); a branch behind one that must be up to date is updated (PM20), the panel saying so until GitHub answered and the panel read it again; conflicts leave for GitHub's editor (PM19); with no way forward the primary is off and says why (PM13). When the read takes the chosen method away, the panel moves to the default and says so once. While the merge is sent it stays as it was, its primary busy, until GitHub answers. Being merged, it says so and offers nothing to repeat; merged, how it landed and nothing to do (PM26); refused, it stays with the text and GitHub's reason in its own words, and ⌘↵ tries again (PM25, PM31) — with no answer at all, that the outcome is not known. What the session knows of the last merge that did not end merged (`MergeRecord`) decides the rest: a head that moved since says nothing merged and names the new commit (`D`), the primary going by its state (PM27); a method the rules, read late, don't allow leaves the panel on one they do, the edit kept as its text (PM28); no answer in time is grey, neither merged nor failed, with no second merge and GitHub a key away (`O`, PM29). Opened again with such a record, it starts on the method and the edited text that merge was sent with (D15). Open for a stack with two or more going, `C` shows one member's checks, saying whose: the one holding the rest, else the first open one (`StackMergeView.checks`). The keys are the panel's only while it is open: nothing reaches the screen below (`data-layer`, `data-no-commands`, focus kept inside). Not met, where auto-merge may wait for it, `⌘↵` turns it on with the method and text chosen now (PM10); on, it says who and how, the text fixed, and `⌘↵` turns it off (PM11). On a merge queue's branch the method and the text are the queue's, `⌘↵` adds it to the queue as a merge and `⇧⌘↵` jumps it (PM14); in the queue it says where, with no primary and `⇧Q` to take it out (PM15, PM16). Past what isn't met, for a viewer GitHub says may: a line of its own above the footer lists it, and `⌥⌘↵` alone merges — never `⌘↵` (D12, PM12a) — in a stack only its first open pull request (SP55). A commit email to choose, where GitHub offers one, is a line of its own: `Y` moves to the next (PM6). A stack on a merge queue's branch reads ready for the queue, with no method or text to choose, and enters as one group (SP53); in the queue each one says its own position, the verdict the first one's, and thrown out it says which one and offers to add it again (SP54). -->
<script lang="ts" setup>
import type { PullRequestMergeMethod } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { Reveal } from '@nzyme/vue/components/Reveal.jsx';
import type { LucideIcon } from 'lucide-vue-next';
import {
  ArrowRight,
  ArrowUpRight,
  CircleCheck,
  CircleDashed,
  CircleOff,
  CircleX,
  Eye,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequestArrow,
  Hourglass,
  Info,
  Layers,
  ListOrdered,
  ListPlus,
  Loader,
  LoaderCircle,
  Lock,
  MessageSquareWarning,
  RefreshCw,
  ShieldAlert,
  Timer,
} from 'lucide-vue-next';
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Button from '@/components/Button.vue';
import Dialog from '@/components/Dialog.vue';
import Kbd from '@/components/Kbd.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';
import TextArea from '@/components/TextArea.vue';
import TextField from '@/components/TextField.vue';
import type { EditFailureReason } from '@/edits/EditTypes.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import PullRequestVerdictLine from '@/item/PullRequestVerdictLine.vue';
import { useCheckTexts } from '@/item/useCheckTexts.js';
import { usePullRequestConditions } from '@/item/usePullRequestConditions.js';
import type { PullRequestCondition } from '@/item/usePullRequestConditions.js';
import { usePullRequestVerdict } from '@/item/usePullRequestVerdict.js';
import type { PullRequestVerdict } from '@/item/usePullRequestVerdict.js';
import { getHeldByText } from '@/lists/utils/getHeldByText.js';
import { getPullRequestKind } from '@/lists/utils/getPullRequestKind.js';
import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import { isMergeabilityUnknown } from '@/store/isMergeabilityUnknown.js';
import { isMergedPullRequest } from '@/store/isMergedPullRequest.js';
import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import { capitalize } from '@/utils/capitalize.js';
import { formatTimeAgo } from '@/utils/formatTimeAgo.js';
import { Browser } from '@/services/Browser.js';
import { getApprovalUrl } from '@/tracking/utils/getApprovalUrl.js';
import { isEditableTarget } from '@/utils/isEditableTarget.js';

import { countMergeChecks } from './countMergeChecks.js';
import { MERGE_TIME_LIMIT_MS } from './createMergeEdits.js';
import { getConflictEditorUrl } from './getConflictEditorUrl.js';
import { getAttentionChecks } from './getAttentionChecks.js';
import { getBypassSkips } from './getBypassSkips.js';
import { getCommitEmails } from './getCommitEmails.js';
import type { ViewerCommitEmails } from './getCommitEmails.js';
import { getMergeEnd } from './getMergeEnd.js';
import { getMergeEndLook } from './getMergeEndLook.js';
import { getMergeMethods } from './getMergeMethods.js';
import type { MergeSettings } from './getMergeMethods.js';
import { getReasonTitle } from './getReasonTitle.js';
import { isAutoMergeAllowed } from './isAutoMergeAllowed.js';
import MergeChecks from './MergeChecks.vue';
import MergeCondition from './MergeCondition.vue';
import * as l from './MergePanel.loc.js';
import type {
  MergeCommitText,
  MergeOptions,
  MergeRecord,
  MergeStep,
  MergeSubmission,
  SentMerge,
} from './MergeTypes.js';
import { getStackMergeRows } from './stack/getStackMergeRows.js';
import { isWholeRangeBlocked } from './stack/isWholeRangeBlocked.js';
import StackMergeMembers from './stack/StackMergeMembers.vue';
import type { StackMerge, StackMergeView } from './stack/StackMergeTypes.js';
import { useMergeMethodName } from './useMergeMethodName.js';
import { useMergeQueueTexts } from './useMergeQueueTexts.js';

const props = defineProps<{
  pr: PullRequestItem;
  /** The repository's merge settings; `null` until its metadata is known. */
  settings: MergeSettings | null;
  /** The panel's read (rulesets, proposed texts, checks); `null` until it arrives, or when it could not be read. */
  options: MergeOptions | null;
  /** The read is on its way. */
  reading: boolean;
  /**
   * The viewer may merge it, as far as their role and its place go (`EditPermissions.mergePanel`): open, by WRITE and
   * above. Being merged it still is; what may be sent the panel works out itself.
   */
  allowed: boolean;
  /**
   * A merge is sent and GitHub has not answered yet: the panel stays as it was, its primary busy, until GitHub accepts
   * (it leaves) or refuses (it stays, saying why) — PM32a.
   */
  sending: boolean;
  /**
   * What this session knows of the pull request's last merge that did not end merged, while it speaks for it: refused
   * (PM25, PM31) — for a moved head (PM27) or a method the rules don't allow (PM28), as the panel tells
   * (`getMergeEnd`) — or no answer (PM29). In a stack, of the range's top, or of the range's first: sent alone, or taken
   * by a stack's merge (stacked PRs D11). `null` for none, and while a merge is sent.
   */
  record: MergeRecord | null;
  /** The pull request {@link record} is of, as it is told apart by its head: `pr` when none is given. */
  recordOf?: PullRequestItem | null;
  /**
   * The method and text this session's last merge of it that did not end merged was sent with: a panel opened starts
   * on them (D15). `null` for none.
   */
  sent: SentMerge | null;
  /** GitHub said at once the merge sent from this panel merged: it was merged already (PM30). */
  alreadyMerged: boolean;
  /**
   * The step towards the merge asked for from the panel — marking it ready, updating its branch — until GitHub
   * answered and the panel's read came back: the primary stays that step's, busy, meanwhile.
   */
  advancing: MergeStep | null;
  /** Epoch ms a running check's time is counted to. */
  now: number;
  /**
   * Open for a stack (stacked PRs D11): `pr` is its first open pull request — what lands alone when one is going
   * (D18) — and this the stack's merge: its list, the line, and what the panel says where the stack speaks for the
   * range. None outside a stack. While a merge is sent, as the stack was before it: none being merged yet (PM32a).
   */
  stack?: StackMergeView | null;
  /** The addresses GitHub says the viewer may commit a merge with; `null` until the repository's metadata is known. */
  emails?: ViewerCommitEmails | null;
  /** Who is signed in: a squash takes an email only from the pull request's author (D4). */
  viewerLogin?: string | null;
}>();

const emit = defineEmits<{
  /** `⌘↵` or the primary: merge as shown. */
  merge: [submission: MergeSubmission];
  /** `⌘↵` or the primary where it can't merge yet: the step towards the merge (merging D12); or a step with a key of its own. */
  step: [step: Exclude<MergeStep, 'enableAutoMerge'>];
  /** `⌘↵` or the primary where auto-merge may wait for what isn't met: on, with the method and text as shown (PM10). */
  enableAutoMerge: [submission: MergeSubmission];
  /** `⌥⌘↵` or its button: past what isn't met, the pull request `pr` alone (D12, PM12a, SP55). */
  bypass: [submission: MergeSubmission];
  /** A link's key (`D`, `O`): opens the page on github.com in a new tab. */
  visit: [url: string];
  /** `↑` or `↓` in a stack: the line moves one open pull request earlier or later (stacked PRs D18). */
  move: [direction: 'earlier' | 'later'];
}>();

const open = defineModel<boolean>('open', { required: true });
/** The full list of the checks is open: a stack's host reads them only then, when they are another member's. */
const checksOpen = defineModel<boolean>('checksOpen', { default: false });

/** The methods that make a commit of their own, with a text GitHub proposes. */
type CommitMethod = Exclude<PullRequestMergeMethod, 'REBASE'>;

type PanelVerdictKind = 'blocked' | 'merged' | 'merging' | 'newCommit' | 'ready' | 'refused' | 'unknown';

interface PanelVerdict extends PullRequestVerdict {
  readonly kind: PanelVerdictKind;
}

/** A condition of the merge shown above the checks, where it holds the merge or is not known (PM13, PM19–PM22). */
interface ConditionLine extends PullRequestCondition {
  readonly label: string;
}

/** How the primary looks when it takes a step towards the merge in the panel. */
interface StepButton {
  readonly label: string;
  readonly icon: LucideIcon;
}

/** A band under the verdict: GitHub's reason for a refusal, what to do about it, and a link to github.com. */
interface Band {
  readonly tone: 'danger' | 'muted' | 'warning';
  readonly icon: LucideIcon;
  readonly title: string;
  readonly text: string | null;
  readonly link: BandLink | null;
}

/** A link out of the panel, with a key of its own. */
interface BandLink {
  readonly label: string;
  readonly url: string;
  readonly key: string;
}

/** What `⌘↵` does where the stack speaks for its range. */
type StackForward =
  | { readonly kind: 'merge' }
  | { readonly kind: 'addAgain' }
  | { readonly kind: 'visit'; readonly url: string; readonly label: string }
  | { readonly kind: 'markReady'; readonly number: number }
  | { readonly kind: 'close' }
  | { readonly kind: 'none'; readonly label: string };

/**
 * What the panel says of a stack's range where the stack speaks for it, rather than its first open pull request
 * going alone (D18): the verdict, a band beneath it, and the way forward.
 */
interface StackSays {
  readonly verdict: PanelVerdict;
  readonly band: Band | null;
  readonly forward: StackForward;
}

/** The method the panel was on when the read took it away (PM9). */
interface MethodNotice {
  readonly from: PullRequestMergeMethod;
  readonly to: PullRequestMergeMethod | null;
}

const PEEK_LINES = 3;
/** Under a minute, a merge happened "just now" (PM26). */
const JUST_NOW_MS = 60_000;
/** How much of a commit's sha names it (PM26). */
const SHORT_SHA_LENGTH = 7;

const t = useTranslate();
const browser = useService(Browser);
const root = useTemplateRef<HTMLElement>('root');
const titleField = useTemplateRef<InstanceType<typeof TextField>>('titleField');
// While the merge is sent, the panel stays as it was (PM32a): being merged is drawn elsewhere from the first moment.
const shownPr = computed(() => (props.sending ? { ...props.pr, merging: undefined } : props.pr));
const counts = computed(() => (props.options ? countMergeChecks(props.options.checks) : null));
const autoMergeAllowed = computed(() => isAutoMergeAllowed(props.settings, props.options?.viewerCanEnableAutoMerge));
const standing = usePullRequestVerdict({ pr: shownPr, checks: counts, autoMergeAllowed });
const queueTexts = useMergeQueueTexts();
const getMethodName = useMergeMethodName();
const checkTexts = useCheckTexts();
const prConditions = usePullRequestConditions(shownPr);

const offered = computed(() =>
  props.settings
    ? getMergeMethods({
        settings: props.settings,
        rules: props.options,
        isMergeQueueEnabled: props.pr.isMergeQueueEnabled,
      })
    : null,
);
const methods = computed(() => offered.value?.methods ?? []);
const methodOptions = computed((): SegmentedTabsOption<PullRequestMergeMethod>[] =>
  methods.value.map((choice, index) => ({ value: choice, label: methodName(choice), keyshortcuts: String(index + 1) })),
);
const method = ref<PullRequestMergeMethod | null>(initialMethod());
const notice = ref<MethodNotice | null>(null);
/** The commit texts the user edited, per method: the text follows the method. */
const edited = ref<Partial<Record<CommitMethod, MergeCommitText>>>(initialEdits());
const editing = ref(false);
/** `E` pressed while the proposal was on its way: the editor opens once it is in (PM8). */
const editWhenRead = ref(false);
/** The email chosen; `null` for the viewer's default. */
const chosenEmail = ref<string | null>(props.sent?.request.authorEmail ?? null);
/** What is being sent is the merge past the rules: its own button is busy, and the primary stays as it was. */
const bypassing = ref(false);

const merging = computed(() => shownPr.value.merging !== undefined);
/** Its place in the merge queue, outside a stack: a stack in a queue is told by the stack (SP54). */
const queueEntry = computed(() => (props.stack ? null : shownPr.value.mergeQueueEntry));
/** The auto-merge turned on for it, with one pull request going. */
const autoMerge = computed(() => (several.value ? null : shownPr.value.autoMerge));
/** The text is fixed: GitHub holds the one chosen when auto-merge went on (PM11), or the queue writes it (PM14). */
const textFixed = computed(() => autoMerge.value !== null || props.pr.isMergeQueueEnabled);
/** How the last merge that did not end merged reads now: refused, a new commit, a method gone, or not known. */
const end = computed(() => getMergeEnd(props.record, endPr.value, props.options));
const endPr = computed(() => props.recordOf ?? props.pr);
/** No answer (PM29): the merge may still land, so nothing is offered to send it again. */
const outcomeUnknown = computed(() => end.value?.kind === 'unknown');
/** Refused for what still holds, the same range going: the same merge again. A moved head, a method gone or another range make it another merge. */
const triesAgain = computed(
  () => end.value?.kind === 'refused' && (end.value.sent.going?.length ?? 1) === (props.stack?.merge.going.length ?? 1),
);
const hasAttention = computed(() => props.options !== null && getAttentionChecks(props.options.checks).length > 0);

/** Two or more going with a stack's merge: no commit text, and none sent (stacked PRs D11). */
const several = computed(() => (props.stack?.merge.going.length ?? 0) > 1);
/** No answer of a stack's merge of two or more: the panel says nothing of the range, and nothing moves (D11, PM29). */
const stackOutcomeUnknown = computed(() => outcomeUnknown.value && end.value?.sent.going !== undefined);
/** A stack on a merge queue's branch: the queue has the method and the text, whoever is going (SP53). */
const queueStack = computed(() => Boolean(props.stack) && props.pr.isMergeQueueEnabled);
/** No commit text shows: each lands under its own title, or the queue writes them (stacked PRs D11, SP53). */
const noCommitText = computed(() => several.value || queueStack.value);
/** Where it stands in a queue, or thrown out of it (SP54). */
const stackQueue = computed(() => props.stack?.merge.queue ?? null);
/** The footer has its Close button and nothing else: the stack says it doesn't know how its merge ended (SP60). */
const stackFooterBare = computed(() => stackSays.value?.verdict.kind === 'unknown');
/**
 * In the queue, the one thing left to do here is to leave it (PM15). A stack leaves whole, whichever one the editor
 * sends it to (stacked PRs D11, SP54).
 */
const canTakeOut = computed(
  () => queueEntry.value !== null || (stackQueue.value?.kind === 'in' && verdict.value.kind !== 'merging'),
);
const stackRows = computed(() =>
  props.stack ? getStackMergeRows({ merge: props.stack.merge, outcomeUnknown: stackOutcomeUnknown.value }) : [],
);
/**
 * Where a stack's merge that did not end merged stopped, some of those going having landed: never told by assumption
 * but by what the copy read after it holds (D11). `null` while that read is on its way, and with none landed.
 */
const stackStop = computed(() => {
  const ended = end.value;
  const going = ended?.sent.going;
  if (!props.stack || !going || ended?.kind === 'unknown') {
    return null;
  }

  const sent = props.stack.merge.members.flatMap(pip =>
    pip.kind !== 'missing' && going.includes(pip.pullRequest.id) ? [pip.pullRequest] : [],
  );
  const landed = sent.filter(isMergedPullRequest).length;
  const at = sent.find(pr => !isMergedPullRequest(pr));
  return landed > 0 && at ? { at, landed } : null;
});
/** The stack's members being merged; the host gives none while the merge is sent (PM32a). */
const stackMerging = computed(() => props.stack?.merge.open.filter(pr => pr.merging !== undefined) ?? []);
const stackSays = computed((): StackSays | null => (props.stack ? getStackSays(props.stack) : null));
/** The line after the last one going, while later ones stay open (SP41, SP45); none otherwise. */
const stackLine = computed((): 'held' | 'stops' | null => {
  const view = props.stack;
  const merge = view?.merge;
  if (
    !merge ||
    merge.queue ||
    stackOutcomeUnknown.value ||
    stackMerging.value.length > 0 ||
    merge.going.length >= merge.open.length
  ) {
    return null;
  }

  if (isWholeRangeBlocked(merge)) {
    return null;
  }

  return merge.holder && merge.going.length === merge.canLand ? 'held' : 'stops';
});
const canMoveLine = computed(() => {
  const merge = props.stack?.merge;
  return (
    merge !== undefined &&
    merge.queue === null &&
    !stackOutcomeUnknown.value &&
    merge.open.length > 1 &&
    stackMerging.value.length === 0 &&
    !props.sending &&
    !editing.value
  );
});
/** "Stop earlier" where no line shows `↑` `↓` of its own, the merge the way forward or coming back by itself (SP40, SP58). */
const showStopEarlier = computed(
  () =>
    canMoveLine.value &&
    !stackLine.value &&
    (stackSays.value?.forward.kind === 'merge' || props.stack?.merge.freshChecks === true),
);
/** A draft holds the rest while those before it can land (SP49): marking it ready is right there. */
const stackDraft = computed(() => {
  const merge = props.stack?.merge;
  return merge && !merge.block && merge.holder?.kind === 'draft' && !end.value ? merge.holder.number : null;
});

/**
 * Whose checks `C` shows with two or more going (D11: not those of a range): none where they would not help — a range
 * nothing of which can land, the checks running again anyway (SP46, SP50, SP58).
 */
const stackChecks = computed(() => {
  const view = props.stack;
  if (!view || view.merge.freshChecks || view.merge.queue) {
    return null;
  }

  return isWholeRangeBlocked(view.merge) ? null : view.checks;
});

/** Adding to a merge queue is a merge, as far as the panel goes: GitHub puts it there (PM14). */
const forwardMerges = computed(() => standing.forward === 'merge' || standing.forward === 'enqueue');
/** Merging is the way forward: ⌘↵ merges (D6, D12). */
const mergesNow = computed(() => {
  if (stackSays.value) {
    const { kind } = stackSays.value.forward;
    return kind === 'merge' || kind === 'addAgain';
  }

  return !merging.value && !outcomeUnknown.value && forwardMerges.value;
});
/**
 * The step ⌘↵ takes instead of merging: the one asked for until it is done, else the way forward where it can't
 * merge yet (D12). `null` where it merges, or nothing is left to do.
 */
const step = computed((): MergeStep | null => {
  if (props.advancing) {
    return props.advancing;
  }

  if (stackSays.value) {
    return stackSays.value.forward.kind === 'markReady' ? 'markReady' : null;
  }

  const forward = merging.value || outcomeUnknown.value ? null : standing.forward;
  return forward === 'merge' || forward === 'enqueue' ? null : forward;
});
/**
 * Where the way forward ends in a merge — not for a draft or conflicts (PM19, PM21) — or auto-merge is on, the merge on
 * its way (PM11): the method and the text show.
 */
const leadsToMerge = computed(
  () =>
    mergesNow.value ||
    step.value === 'updateBranch' ||
    step.value === 'enableAutoMerge' ||
    step.value === 'disableAutoMerge',
);
/** Jumping the queue: only where adding to it is the way forward, by its own chord (D12, PM14). */
const canJump = computed(
  () => !props.stack && props.allowed && standing.forward === 'enqueue' && mergesNow.value && !props.sending,
);

/** Every requirement not met, as the bypass line lists them; empty where there is no such line. */
const bypassSkips = computed((): readonly string[] => {
  const { options } = props;
  const pr = shownPr.value;
  if (!options?.viewerCanMergeAsAdmin || !props.allowed || !canBypassNow(pr)) {
    return [];
  }

  const { checks, review, behind, other } = getBypassSkips(pr, options.checks);
  return [
    ...checks.map(check => checkTexts.name(check)),
    ...(review === 'required' ? [t(l.bypassSkipsReviewRequired)] : []),
    ...(review === 'changesRequested' ? [t(l.bypassSkipsChangesRequested)] : []),
    ...(behind ? [t(l.bypassSkipsBehind, { base: pr.baseRefName })] : []),
    ...(other ? [t(l.bypassSkipsOther)] : []),
  ];
});
/** The line and `⌥⌘↵` are there (PM12a): GitHub says the viewer may, and something it lists isn't met. */
const canBypass = computed(() => bypassSkips.value.length > 0 && method.value !== null);
/** With a stack of several open, it speaks of the first alone (SP55). */
const bypassOfFirst = computed(() => (props.stack?.merge.open.length ?? 0) > 1);
const bypassLines = computed(() => {
  const list = new Intl.ListFormat(APP_LANGUAGE).format(bypassSkips.value);
  const email = props.emails?.viewerDefaultCommitEmail;
  return {
    title: bypassOfFirst.value ? t(l.bypassTitleOf, { number: props.pr.number }) : t(l.bypassTitle),
    skips: bypassOfFirst.value ? t(l.bypassSkipsFirst, { list }) : t(l.bypassSkips, { list }),
    queue: props.pr.isMergeQueueEnabled ? t(l.bypassOutsideQueue) : null,
    // A rebase makes no commit of its own.
    commits: method.value === 'REBASE' ? null : email ? t(l.bypassCommitsAs, { email }) : t(l.bypassCommitsAsDefault),
    button: bypassOfFirst.value ? t(l.bypassMergeNumber, { number: props.pr.number }) : t(l.bypassMerge),
  };
});
/** The addresses to choose the commit email from, while merging is the way forward (PM6); `null` with no choice. */
const commitEmails = computed(() =>
  mergesNow.value && standing.forward === 'merge'
    ? getCommitEmails({ emails: props.emails, method: method.value, pr: props.pr, viewerLogin: props.viewerLogin })
    : null,
);
/** The address the merge commits with, as the line shows it: the one chosen, while it is still offered. */
const shownEmail = computed(() => {
  const chosen = chosenEmail.value;
  return chosen !== null && commitEmails.value?.includes(chosen) ? chosen : (commitEmails.value?.[0] ?? null);
});

const verdict = computed((): PanelVerdict => {
  if (stackSays.value) {
    return stackSays.value.verdict;
  }

  if (merging.value) {
    return { kind: 'merging', ...standing.verdict };
  }

  // Merged already when this panel's merge was sent: GitHub said so, and how it landed was not this merge (PM30).
  if (props.pr.merged && props.alreadyMerged) {
    const sha = props.pr.mergedAs?.sha.slice(0, SHORT_SHA_LENGTH);
    const aside = sha === undefined ? t(l.githubSaysMerged) : t(l.githubSaysMergedAs, { sha });
    return { kind: 'merged', ...standing.verdict, text: t(l.alreadyMerged), aside };
  }

  if (props.pr.merged) {
    return { kind: 'merged', ...standing.verdict, aside: mergedAside() };
  }

  const ended = endVerdict();
  if (ended) {
    return ended;
  }

  // The panel stays, and merging comes back when GitHub says so (PM20).
  if (props.advancing === 'updateBranch') {
    const aside = t(l.updatingDetail, { base: props.pr.baseRefName });
    return { kind: 'ready', tone: 'warning', icon: RefreshCw, text: t(l.updating), aside };
  }

  return { kind: leadsToMerge.value ? 'ready' : 'blocked', ...standing.verdict };
});

/** What holds the merge besides the checks, or is not known yet, each in a line above them; none for a draft. */
const conditions = computed((): ConditionLine[] => {
  const pr = shownPr.value;
  if (pr.isDraft) {
    return [];
  }

  const shown: ConditionLine[] = [];
  const now = getPullRequestStanding(pr);
  if (now.changesRequested || now.waitingForReview) {
    shown.push({ label: t(l.reviews), ...prConditions.reviews });
  }

  const base = pr.baseRefName;
  // The opened item's line, in the panel's words: conflicts, or not known yet.
  const conflicts = prConditions.conflicts;
  if (conflicts.tone !== 'success') {
    const text = conflicts.tone === 'danger' ? t(l.conflictsWith, { base }) : t(l.notKnownYet);
    shown.push({ label: t(l.conflicts), ...conflicts, text });
  }

  if (pr.mergeStateStatus === 'BEHIND') {
    const text = t(l.behind, { base });
    shown.push({ label: t(l.branch), tone: 'warning', icon: GitBranch, text, aside: null });
  }

  return shown;
});
/** GitHub is still working out whether it merges (PM22): said where the read says it is on its way. */
const computing = computed(() => isOpenPullRequest(props.pr) && !props.pr.isDraft && isMergeabilityUnknown(props.pr));

const commitMethod = computed(() => toCommitMethod(autoMerge.value?.mergeMethod ?? method.value));
const proposal = computed(() =>
  commitMethod.value && props.options ? props.options.proposedTexts[commitMethod.value] : null,
);
const draft = computed(() =>
  commitMethod.value && !textFixed.value ? (edited.value[commitMethod.value] ?? null) : null,
);
const titleEdited = computed(() => draft.value !== null && draft.value.title !== proposal.value?.title);
const bodyEdited = computed(() => draft.value !== null && draft.value.body !== proposal.value?.body);
const isEdited = computed(() => titleEdited.value || bodyEdited.value);
/** The commit's title as it will land: edited, proposed, or — before the proposal — what GitHub writes by default. */
const commitTitle = computed(() => {
  const chosen = autoMerge.value?.commitHeadline;
  if (chosen) {
    return chosen;
  }

  const text = draft.value ?? proposal.value;
  if (text) {
    return text.title;
  }

  const { pr } = props;
  return commitMethod.value === 'SQUASH'
    ? `${pr.title} (#${pr.number})`
    : `Merge pull request #${pr.number} from ${pr.repository.owner}/${pr.headRefName}`;
});
const commitBody = computed(() => {
  // What auto-merge was given, once read; what GitHub proposes otherwise.
  const chosen = autoMerge.value ? props.options?.autoMergeBody : null;
  return chosen ?? (draft.value ?? proposal.value)?.body ?? null;
});
/** The commit editor's fields: what is typed is the edit of the method chosen. */
const draftTitle = computed({
  get: () => draft.value?.title ?? '',
  set: (title: string | null | undefined) => updateText({ title: title ?? '' }),
});
const draftBody = computed({
  get: () => draft.value?.body ?? '',
  set: (body: string | null | undefined) => updateText({ body: body ?? '' }),
});
const peek = computed(() => peekLines(commitBody.value ?? ''));
const bodyLineCount = computed(() => (draft.value?.body.trimEnd() ?? '').split('\n').length);

const canSend = computed(
  () => props.allowed && mergesNow.value && method.value !== null && !props.sending && props.advancing === null,
);
const stepButton = computed((): StepButton | null => {
  const current = step.value;
  switch (current) {
    case 'markReady': {
      const forward = stackSays.value?.forward;
      const label = forward?.kind === 'markReady' ? t(l.markNumberReady, { number: forward.number }) : t(l.markReady);
      return { label, icon: Eye };
    }
    case 'updateBranch':
      return { label: t(l.updateBranch), icon: GitPullRequestArrow };
    case 'enableAutoMerge':
      return method.value === null ? null : { label: t(l.enableAutoMerge), icon: Timer };
    // A link of its own, out of the panel, and buttons of their own, not the filled one (PM11, PM14, PM15).
    case 'resolveConflicts':
    case 'disableAutoMerge':
    case 'jumpQueue':
    case 'dequeue':
    case null:
      return null;
    default:
      return assertNever(current);
  }
});
const conflictsUrl = computed(() => getConflictEditorUrl(props.pr));
/** PM15: where it is in the queue, and GitHub's state with who put it there. */
const queueLines = computed((): ConditionLine[] => {
  const entry = queueEntry.value;
  if (!entry) {
    return [];
  }

  const ago = formatTimeAgo(Date.parse(entry.enqueuedAt), props.now);
  return [
    {
      label: t(l.queuePosition),
      tone: 'muted',
      icon: ListOrdered,
      text: t(l.queuePlace, { place: queueTexts.place(entry), base: props.pr.baseRefName }),
      aside: null,
    },
    {
      label: t(l.queueState),
      tone: standing.verdict.tone,
      icon: standing.verdict.icon,
      text: capitalize(queueTexts.state(entry)),
      aside: t(l.addedBy, { login: entry.enqueuer, ago }),
    },
  ];
});
/** The methods from the repository's settings until the read narrows them (PM9): chosen before it arrives too. */
const choosable = computed(() => methods.value.length > 1 && !editing.value && !merging.value);
/** While being merged, the method it was sent with (PM24). */
const shownMethod = computed(() => shownPr.value.merging ?? autoMerge.value?.mergeMethod ?? method.value);
/** The state lets the checks show: those of the pull request, or of a stack's member, by the panel's way of showing each. */
const checksShowable = computed(() => {
  switch (verdict.value.kind) {
    case 'ready':
    case 'blocked':
    case 'newCommit':
      return !editing.value;
    case 'merging':
    case 'merged':
    case 'refused':
    case 'unknown':
      return false;
    default:
      return assertNever(verdict.value.kind);
  }
});
const showChecks = computed(() => checksShowable.value && !several.value && queueEntry.value === null);
const showStackChecks = computed(() => checksShowable.value && stackChecks.value !== null && checksOpen.value);
const showLanding = computed(() => {
  const says = stackSays.value;
  if (says) {
    return (
      (says.forward.kind === 'merge' || says.forward.kind === 'markReady') &&
      !(checksShowable.value && checksOpen.value)
    );
  }

  switch (verdict.value.kind) {
    case 'merging':
    case 'refused':
      return true;
    case 'ready':
      return !checksOpen.value;
    // The new commit's state decides, as it does for the primary (PM27).
    case 'newCommit':
      return leadsToMerge.value && !checksOpen.value;
    // What the merge past the rules would land as, chosen here: a queue's has nothing to choose (PM12a).
    case 'blocked':
      return canBypass.value && !props.pr.isMergeQueueEnabled && !checksOpen.value;
    case 'merged':
    case 'unknown':
      return false;
    default:
      return assertNever(verdict.value.kind);
  }
});
const primaryLabel = computed(() => {
  // Merged or closed meanwhile (the read, a sync): that is what stops it, whatever the role.
  if (!props.allowed && isOpenPullRequest(props.pr)) {
    return t(l.notAllowed);
  }

  const says = stackSays.value;
  if (says?.forward.kind === 'addAgain') {
    return t(l.addAgain);
  }

  if (says?.forward.kind === 'none') {
    return says.forward.label;
  }

  if (says && method.value !== null) {
    if (triesAgain.value) {
      return t(l.tryAgain);
    }

    return several.value && props.stack
      ? stackPrimaryName(props.stack.merge, method.value, props.stack.description.landed)
      : primaryName(method.value);
  }

  if (!mergesNow.value) {
    return verdict.value.kind === 'refused' || verdict.value.kind === 'newCommit'
      ? standing.verdict.text
      : verdict.value.text;
  }

  if (method.value === null) {
    return t(l.nothingToOffer);
  }

  if (triesAgain.value) {
    return t(l.tryAgain);
  }

  return primaryName(method.value);
});
const primaryIcon = computed(() => (standing.forward === 'enqueue' ? ListPlus : GitMerge));
const checksHint = computed(() => {
  if (several.value) {
    return getStackChecksHint();
  }

  if (!showChecks.value) {
    return null;
  }

  // Before the read, in its place, `C` inactive until it arrives: nothing moves when it does.
  if (!props.options) {
    return props.reading ? t(l.hintChecks) : null;
  }

  if (props.options.checks.length === 0) {
    return null;
  }

  if (checksOpen.value) {
    return t(l.hintFold);
  }

  return hasAttention.value ? t(l.hintAllChecks) : t(l.hintChecks);
});
const typeIcon = computed(() => getPullRequestKind(props.pr));
const reference = computed(() => `${props.pr.repository.nameWithOwner}#${props.pr.number}`);
/** The method's note under a stack's merge of two or more (SP40, SP44). */
const stackMethodNote = computed(() => {
  if (props.pr.isMergeQueueEnabled) {
    return t(l.eachOwnCommit);
  }

  return shownMethod.value === 'REBASE' ? t(l.eachCommitOnto, { base: props.pr.baseRefName }) : t(l.eachOwnTitle);
});
/** What the last merge's end says beneath the verdict: GitHub's reason, the new commit, or that the next refresh settles it. */
const band = computed((): Band | null => (stackSays.value ? stackSays.value.band : endBand()));
/** The one thrown out, on GitHub (SP54). */
const stackQueueLink = computed(() => {
  const queue = stackQueue.value;
  return queue?.kind === 'out' && !end.value ? queue.thrownOut : null;
});
const noticeText = computed(() => {
  const current = notice.value;
  // A merge refused for the method the read took away says it once, in its own band (PM28).
  if (!current || end.value?.kind === 'methodNotAllowed') {
    return null;
  }

  const from = methodName(current.from);
  const base = props.pr.baseRefName;
  return {
    title:
      current.from === 'MERGE' && props.options?.requiresLinearHistory
        ? t(l.goneLinearHistory, { method: from, base })
        : t(l.goneRuleset, { method: from, base }),
    text: current.to ? t(l.nowOn, { from, to: methodName(current.to) }) : t(l.noneLeft, { from }),
  };
});

// Never left on a method that would be refused (PM9): one the read takes away gives way to the default, said once.
watch(offered, (next, previous) => {
  if (!next) {
    return;
  }

  const current = method.value;
  if (current !== null && next.methods.includes(current)) {
    return;
  }

  method.value = next.defaultMethod;
  carryEdit(current, next.defaultMethod);
  // A queue's method is the queue's to say: nothing was chosen, so nothing gave way.
  if (current !== null && previous?.methods.includes(current) && !props.pr.isMergeQueueEnabled) {
    notice.value = { from: current, to: next.defaultMethod };
  }
});

watch(
  () => props.sending,
  sending => {
    if (!sending) {
      bypassing.value = false;
    }
  },
);

// Auto-merge went on while the text was being edited: GitHub holds it now, and the field no longer says anything (PM11).
watch(textFixed, fixed => {
  if (fixed) {
    editing.value = false;
  }
});

watch(proposal, text => {
  if (text && editWhenRead.value) {
    editWhenRead.value = false;
    void edit();
  }
});

/**
 * The verdict the last merge's end gives, where it has one (PM25, PM27–PM29): refused, a new commit, or not known —
 * neither merged nor failed.
 */
function endVerdict(): PanelVerdict | null {
  const record = end.value;
  if (!record) {
    return null;
  }

  const stop = stackStop.value;
  if (stop) {
    return {
      kind: 'refused',
      ...getMergeEndLook('refused'),
      text: t(l.stackStopped, { number: stop.at.number }),
      aside: t(l.stackStoppedAside, { landed: stop.landed, open: props.stack?.merge.open.length ?? 0 }),
    };
  }

  const look = getMergeEndLook(record.kind);
  switch (record.kind) {
    case 'refused': {
      const text = record.sent.going ? t(l.stackRefused) : t(l.refused);
      return { kind: 'refused', ...look, text, aside: t(l.nothingMerged) };
    }
    case 'headMoved':
      return { kind: 'newCommit', ...look, text: t(l.newCommitArrived), aside: null };
    case 'methodNotAllowed': {
      const text = t(l.methodNotAllowed, {
        method: methodName(record.sent.request.method),
        base: props.pr.baseRefName,
      });
      return { kind: 'refused', ...look, text, aside: t(l.nothingMerged) };
    }
    case 'unknown':
      return {
        kind: 'unknown',
        ...look,
        text: t(l.outcomeUnknown),
        aside: record.refusal ? t(l.refusedNotRead) : t(l.notAnsweredYet),
      };
    default:
      return assertNever(record);
  }
}

/** What the last merge's end says beneath the verdict: GitHub's reason, the new commit, or that the next refresh settles it. */
function endBand(): Band | null {
  const record = end.value;
  const base = props.pr.baseRefName;
  // Stopped midway, what landed rewrote those left: their new heads are no new commit, GitHub's words still say why.
  const stop = stackStop.value;
  if (stop && props.record?.kind === 'refused') {
    const { number, url } = stop.at;
    return { ...refusalBand(props.record.reason), link: { label: t(l.seeOnGitHub, { number }), url, key: 'O' } };
  }

  switch (record?.kind) {
    case undefined:
      return null;
    case 'refused': {
      const said = refusedBand(record.reason);
      // Of a stack's merge, a key to the top of it, for what GitHub says there (SP61, SP62).
      return record.sent.going
        ? { ...said, link: said.link ?? { label: t(l.openOnGitHub), url: endPr.value.url, key: 'O' } }
        : said;
    }
    case 'headMoved': {
      const head = record.head.slice(0, SHORT_SHA_LENGTH);
      const asked = record.sent.head.slice(0, SHORT_SHA_LENGTH);
      const { commit } = record;
      const cancelled = t(l.newCommitCancelled, { asked });
      return {
        tone: 'warning',
        icon: GitCommitHorizontal,
        title: commit?.author
          ? t(l.newCommitPushedBy, { author: commit.author, head })
          : t(l.newCommitPushed, { head }),
        text: commit ? t(l.newCommitHeadline, { headline: commit.headline, cancelled }) : cancelled,
        link: { label: t(l.seeNewCommit), url: `${endPr.value.url}/commits/${record.head}`, key: 'D' },
      };
    }
    case 'methodNotAllowed': {
      const sent = record.sent.request.method;
      const only = methods.value.length === 1 ? methods.value[0] : undefined;
      let title: string;
      if (sent === 'MERGE' && props.options?.requiresLinearHistory) {
        title = t(l.requiresLinearHistory, { base });
      } else if (only) {
        title = t(l.rulesetAllowsOnly, { base, method: methodName(only) });
      } else {
        title = t(l.rulesetDisallows, { base, method: methodName(sent) });
      }

      return { tone: 'danger', icon: CircleX, title, text: t(l.sentBeforeRules, { base }), link: null };
    }
    case 'unknown': {
      const link = { label: t(l.openOnGitHub), url: endPr.value.url, key: 'O' };
      if (record.refusal) {
        const said = refusalBand(record.refusal);
        return { ...said, link: said.link ?? link };
      }

      return {
        tone: 'muted',
        icon: Info,
        title: t(l.nextRefreshSettles),
        text: record.accepted ? t(l.noResult, { minutes: MERGE_TIME_LIMIT_MS / 60_000 }) : t(l.noAnswer),
        link,
      };
    }
    default:
      return assertNever(record);
  }
}

/**
 * GitHub's refusal: its words, and with a push to a lower one of a stack, which pull request has the new commit (D21,
 * SP47) — GitHub's words only say the stack needs a rebase.
 */
function refusedBand(reason: EditFailureReason): Band {
  const said = refusalBand(reason);
  const block = props.stack?.merge.block;
  if (reason.kind !== 'refused' || block?.kind !== 'needsRebase' || block.cause.kind !== 'earlierPush') {
    return said;
  }

  return {
    tone: 'warning',
    icon: GitCommitHorizontal,
    title: t(l.stackEarlierPush, { number: block.cause.pushedNumber }),
    text: t(l.stackEarlierPushRefused, { words: said.title, detail: t(l.stackEarlierPushDetail) }),
    link: null,
  };
}

/**
 * What the panel says of a stack's range: what the range itself says, with how its last merge that did not end merged
 * ended laid over the verdict and the band (D11, SP59–SP62). The way forward stays the range's — the merge again, the
 * rebase, marking ready — but for no answer, when nothing is offered as it may still land (PM29).
 */
function getStackSays(view: StackMergeView): StackSays | null {
  const range = getRangeSays(view);
  const ended = endVerdict();
  if (!range || !ended) {
    return range;
  }

  return { verdict: ended, band: endBand(), forward: ended.kind === 'unknown' ? { kind: 'close' } : range.forward };
}

/**
 * What a stack's range says of itself (stacked PRs D11, D18, D19, D21): all merged, being merged (SP56), the copy
 * incomplete (SP50) or the stack needing a rebase (SP46, SP47) — whatever the line — then, with two or more going or
 * one that can merge, what holds the range or that it is ready (SP40–SP45, SP48, SP49). `null` where one alone is going
 * and it can't merge as it is: its own verdict and way forward then, as for any pull request.
 */
function getRangeSays(view: StackMergeView): StackSays | null {
  const { merge } = view;
  const { landed, held, size } = view.description;
  if (merge.open.length === 0) {
    const text = landed > 0 ? t(l.stackMerged, { count: landed }) : t(l.stackNothingOpen);
    return {
      verdict: { kind: 'merged', tone: 'done', icon: GitMerge, text, aside: null },
      band: null,
      forward: { kind: 'close' },
    };
  }

  const going = stackMerging.value.length;
  if (going > 0) {
    const text =
      going === merge.open.length && landed === 0
        ? t(l.stackBeingMergedAll, { count: going })
        : t(l.stackBeingMerged, { count: going });
    const said: PanelVerdict = { kind: 'merging', tone: 'warning', icon: Loader, text, aside: t(l.stackTakesLonger) };
    return { verdict: said, band: null, forward: { kind: 'close' } };
  }

  if (merge.queue?.kind === 'in') {
    return { verdict: { kind: 'blocked', ...standing.verdict }, band: null, forward: { kind: 'close' } };
  }

  const { block, holder } = merge;
  const offeredName = method.value === null ? t(l.nothingToOffer) : primaryName(method.value);
  if (block?.kind === 'incomplete') {
    const aside = t(l.stackIncompleteAside, { held, size });
    const said: PanelVerdict = {
      kind: 'blocked',
      tone: 'muted',
      icon: CircleDashed,
      text: t(l.stackIncomplete),
      aside,
    };
    return { verdict: said, band: null, forward: { kind: 'none', label: offeredName } };
  }

  if (block?.kind === 'needsRebase') {
    const said: PanelVerdict = {
      kind: 'blocked',
      tone: 'warning',
      icon: GitBranch,
      text: t(l.stackNeedsRebase),
      aside: t(l.stackNeedsRebaseAside),
    };
    const under: Band =
      block.cause.kind === 'earlierPush'
        ? {
            tone: 'warning',
            icon: GitCommitHorizontal,
            title: t(l.stackEarlierPush, { number: block.cause.pushedNumber }),
            text: t(l.stackEarlierPushDetail),
            link: null,
          }
        : {
            tone: 'warning',
            icon: GitBranch,
            title: t(l.stackTargetMoved, { base: props.pr.baseRefName }),
            text: t(l.stackTargetMovedDetail),
            link: null,
          };
    // GitHub's "Rebase stack" is on the stack's pull requests' pages: the top open one shows it all.
    const url = merge.open.at(-1)?.url ?? props.pr.url;
    return { verdict: said, band: under, forward: { kind: 'visit', url, label: t(l.rebaseStack) } };
  }

  if (merge.queue?.kind === 'out') {
    const { thrownOut, left, stillThere } = merge.queue;
    const aside =
      left.length > 0
        ? t(l.stackThrownOut, { number: thrownOut.number })
        : t(l.stackThrownOutAlone, { number: thrownOut.number });
    const said: PanelVerdict = { kind: 'blocked', tone: 'danger', icon: CircleX, text: t(l.stackOutOfQueue), aside };
    // Still there as GitHub holds it, or held by what the merge meets again: nothing to send yet.
    const again: StackForward =
      stillThere || block || !forwardMerges.value ? { kind: 'none', label: t(l.addAgain) } : { kind: 'addAgain' };
    return { verdict: said, band: null, forward: again };
  }

  // One alone going is a merge like any: why it can't merge as it is, in its own verdict, and its own way forward (D18)
  // — the same where only the pips hold it, as while GitHub works out whether it merges (PM22).
  if (!several.value && (!forwardMerges.value || block?.kind === 'held')) {
    return null;
  }

  const closed = holder?.kind === 'closed' ? holder.number : null;
  if (closed !== null) {
    const text = t(l.stackClosed, { number: closed });
    const said: PanelVerdict = {
      kind: block ? 'blocked' : 'ready',
      tone: 'danger',
      icon: CircleX,
      text,
      aside: t(l.stackClosedAside),
    };
    const under: Band = {
      tone: 'muted',
      icon: Info,
      title: t(l.stackDissolve),
      text: t(l.stackDissolveDetail, { number: closed }),
      link: { label: t(l.openOnGitHub), url: merge.open.at(-1)?.url ?? props.pr.url, key: 'O' },
    };
    return { verdict: said, band: under, forward: block ? { kind: 'none', label: text } : { kind: 'merge' } };
  }

  if (holder) {
    const text =
      merge.canLand === 0
        ? t(l.stackNotReadyYet)
        : t(l.stackCanLand, { count: merge.canLand, open: merge.open.length });
    const said: PanelVerdict = {
      kind: block ? 'blocked' : 'ready',
      tone: 'warning',
      icon: Hourglass,
      text,
      aside: merge.freshChecks
        ? t(l.stackCheckingLeft, { landed, left: merge.open.length })
        : getHeldByText({ blocker: holder, lang: APP_LANGUAGE, otherwise: l.stackHeldByOther }),
    };
    let forward: StackForward = { kind: 'merge' };
    if (merge.freshChecks) {
      const label = method.value === null ? t(l.nothingToOffer) : stackPrimaryName(merge, method.value, landed);
      forward = { kind: 'none', label };
    } else if (block) {
      forward = holder.kind === 'draft' ? { kind: 'markReady', number: holder.number } : { kind: 'none', label: text };
    }

    return { verdict: said, band: null, forward };
  }

  const said: PanelVerdict = {
    kind: 'ready',
    tone: 'success',
    icon: CircleCheck,
    text: props.pr.isMergeQueueEnabled ? t(l.stackReadyForQueue) : t(l.stackReady),
    aside: readyAside(merge, landed),
  };
  return { verdict: said, band: null, forward: { kind: 'merge' } };
}

/** What lands of a stack ready as far as the line (SP40–SP43). */
function readyAside(merge: StackMerge, landed: number) {
  const count = merge.going.length;
  const rest = merge.open.length - count;
  const queue = props.pr.isMergeQueueEnabled;
  if (rest > 0) {
    const first = merge.going[0];
    if (count === 1 && first) {
      return t(l.stackOnlyOne, { number: first.number, rest });
    }

    return queue ? t(l.stackSomeEnter, { count, rest }) : t(l.stackSomeLand, { count, rest });
  }

  if (count === 1) {
    return t(l.stackLastOne);
  }

  if (queue) {
    return landed > 0 ? t(l.stackEnterWithLanded, { count, landed }) : t(l.stackAllEnter, { count });
  }

  return landed > 0 ? t(l.stackLandWithLanded, { count, landed }) : t(l.stackAllLand, { count });
}

/** "Squash and merge all 3", "… 2" after some landed, "… 2 of 4" with the line before the last (SP40, SP41, SP58). */
function stackPrimaryName(merge: StackMerge, value: PullRequestMergeMethod, landed: number) {
  const primary = primaryName(value);
  const count = merge.going.length;
  if (props.pr.isMergeQueueEnabled) {
    if (count < merge.open.length) {
      return t(l.addCountOfToQueue, { count, open: merge.open.length });
    }

    return landed > 0 ? t(l.addCountToQueue, { count }) : t(l.addAllToQueue, { count });
  }

  if (count < merge.open.length) {
    return t(l.primaryOf, { primary, count, open: merge.open.length });
  }

  return landed > 0 ? t(l.primaryCount, { primary, count }) : t(l.primaryAll, { primary, count });
}

/** `C` with two or more going: the member's checks, from the row's summary until they are read (SP40–SP45). */
function getStackChecksHint() {
  const shown = stackChecks.value;
  if (!shown || !checksShowable.value) {
    return null;
  }

  if (checksOpen.value) {
    return t(l.hintFold);
  }

  const any = shown.checks ? shown.checks.length > 0 : shown.summary !== null;
  return any ? t(l.hintChecks) : null;
}

/** GitHub's reason in its own words: the first line as the title, the rest quoted beneath it (PM25, PM31). */
function refusalBand(reason: EditFailureReason): Band {
  switch (reason.kind) {
    case 'refused': {
      const title = getReasonTitle(reason.message);
      const more = reason.message.trim().split('\n').slice(1).join(' ').trim();
      const text = more ? t(l.reasonMore, { more }) : null;
      return { tone: 'danger', icon: MessageSquareWarning, title, text, link: null };
    }
    case 'notAllowed':
      return { tone: 'danger', icon: MessageSquareWarning, title: t(l.reasonNotAllowed), text: null, link: null };
    // G5: GitHub lets githq read the organisation's public repositories, and refuses every change there.
    case 'organizationRestricted':
      return {
        tone: 'danger',
        icon: Lock,
        title: t(l.organizationRestricted, { organization: reason.organization }),
        text: t(l.organizationRestrictedDetail),
        link: { label: t(l.requestAccess), url: getApprovalUrl(browser.origin), key: 'A' },
      };
    // Unanswered is not a refusal: recorded as not known (`MergePanelStore`).
    case 'offline':
    case 'dropped':
    case 'missing':
      return { tone: 'danger', icon: MessageSquareWarning, title: t(l.reasonOther), text: null, link: null };
    default:
      return assertNever(reason);
  }
}

/** The method a panel starts on: the one its last merge was sent with, while still offered; else the default. */
function initialMethod() {
  const sent = props.sent?.request.method;
  return sent !== undefined && offered.value?.methods.includes(sent) ? sent : (offered.value?.defaultMethod ?? null);
}

/** The text its last merge was sent with, given back as the edit of the method it starts on (D15). */
function initialEdits(): Partial<Record<CommitMethod, MergeCommitText>> {
  const text = props.sent?.edited;
  const key = toCommitMethod(method.value);
  return text && key ? { [key]: text } : {};
}

/** The edit of a method the read took away stays, as the edit of the method it gave way to (PM28). */
function carryEdit(from: PullRequestMergeMethod | null, to: PullRequestMergeMethod | null) {
  const fromKey = toCommitMethod(from);
  const toKey = toCommitMethod(to);
  const text = fromKey ? edited.value[fromKey] : undefined;
  const proposed = fromKey ? props.options?.proposedTexts[fromKey] : undefined;
  const changed = text && (text.title !== proposed?.title || text.body !== proposed.body);
  if (toKey && changed && !edited.value[toKey]) {
    edited.value = { ...edited.value, [toKey]: text };
  }
}

function toCommitMethod(value: PullRequestMergeMethod | null): CommitMethod | null {
  return value === 'MERGE' || value === 'SQUASH' ? value : null;
}

function methodName(value: PullRequestMergeMethod) {
  return capitalize(getMethodName(value));
}

function primaryName(value: PullRequestMergeMethod) {
  if (props.pr.isMergeQueueEnabled) {
    return t(l.addToQueue);
  }

  switch (value) {
    case 'SQUASH':
      return t(l.primarySquash);
    case 'MERGE':
      return t(l.primaryMerge);
    case 'REBASE':
      return t(l.primaryRebase);
    default:
      return assertNever(value);
  }
}

/**
 * How it landed (PM26): "Squashed into main as 6dcb09b · just now". The method and the commit only when this app's
 * merge confirmed them (`mergedAs`); GitHub's copy of it says neither.
 */
function mergedAside() {
  const { pr } = props;
  const landed = pr.mergedAs;
  let into: string;
  if (landed) {
    into = t(l.landedAs, {
      landed: landedName(landed.method, pr.baseRefName),
      sha: landed.sha.slice(0, SHORT_SHA_LENGTH),
    });
  } else {
    into = t(l.into, { base: pr.baseRefName });
  }

  if (pr.closedAt === null) {
    return into;
  }

  const at = Date.parse(pr.closedAt);
  return `${into} · ${props.now - at < JUST_NOW_MS ? t(l.justNow) : formatTimeAgo(at, props.now)}`;
}

function landedName(value: PullRequestMergeMethod, base: string) {
  switch (value) {
    case 'SQUASH':
      return t(l.squashedInto, { base });
    case 'MERGE':
      return t(l.mergedInto, { base });
    case 'REBASE':
      return t(l.rebasedOnto, { base });
    default:
      return assertNever(value);
  }
}

/** Whether a merge past the rules is one to offer now, whatever isn't met: GitHub's way forward is what is left otherwise. */
function canBypassNow(pr: PullRequestItem) {
  const merge = props.stack?.merge;
  return (
    isOpenPullRequest(pr) &&
    // GitHub refuses a draft and conflicts whoever asks.
    !pr.isDraft &&
    !getPullRequestStanding(pr).conflicts &&
    !standing.mergeable &&
    !merging.value &&
    !pr.mergeQueueEntry &&
    !pr.autoMerge &&
    !outcomeUnknown.value &&
    stackMerging.value.length === 0 &&
    (!merge || (!merge.queue && !merge.freshChecks && !isWholeRangeBlocked(merge)))
  );
}

/** The first lines of a message with something on them, and how many lines follow. */
function peekLines(body: string) {
  const all = body.trimEnd().split('\n');
  const lines: string[] = [];
  let consumed = 0;
  for (const [index, line] of all.entries()) {
    if (lines.length === PEEK_LINES) {
      break;
    }

    if (line.trim() !== '') {
      lines.push(line);
      consumed = index + 1;
    }
  }

  return { lines, more: lines.length === 0 ? 0 : all.length - consumed };
}

/** `⌘↵`: the way forward — the merge, or the step towards it (D12). */
function goForward() {
  const forward = stackSays.value?.forward;
  if (forward?.kind === 'visit') {
    emit('visit', forward.url);
    return;
  }

  if (forward?.kind === 'close' || forward?.kind === 'none') {
    return;
  }

  const next = step.value;
  if (next === null) {
    send();
  } else if (props.allowed && props.advancing === null) {
    if (next !== 'enableAutoMerge') {
      emit('step', next);
    } else if (method.value !== null) {
      // PM10: on with the method chosen now, and only the text edited: GitHub writes its own otherwise (D6).
      emit('enableAutoMerge', toSubmission(method.value));
    }
  }
}

/** `⌥⌘↵`: never `⌘↵`, the one merge nobody can take back past what isn't met (D12, PM12a). */
function bypass() {
  if (!canBypass.value || method.value === null || props.sending || props.advancing !== null) {
    return;
  }

  bypassing.value = true;
  const { request, edited: text } = toSubmission(method.value);
  emit('bypass', { request: { ...request, bypassRules: true }, edited: text });
}

/** `Y`: the next address, back to the default after the last (PM6). */
function nextEmail() {
  const emails = commitEmails.value;
  if (emails && shownEmail.value !== null) {
    chosenEmail.value = emails[(emails.indexOf(shownEmail.value) + 1) % emails.length] ?? null;
  }
}

/** `⇧⌘↵`: never `⌘↵`, as it rebuilds everything in progress in the queue (D12, PM14). */
function jump() {
  if (canJump.value && props.advancing === null) {
    emit('step', 'jumpQueue');
  }
}

function takeOutOfQueue() {
  if (props.allowed && props.advancing === null) {
    emit('step', 'dequeue');
  }
}

function send() {
  if (!canSend.value || method.value === null) {
    return;
  }

  emit('merge', toSubmission(method.value));
}

/**
 * The method and the text as shown. Only what the user edited goes; GitHub writes its own default otherwise (D6). With
 * two or more of a stack going, nothing: each lands under its own title (stacked PRs D11).
 */
function toSubmission(chosen: PullRequestMergeMethod): MergeSubmission {
  const text = several.value ? null : draft.value;
  const email = shownEmail.value;
  return {
    request: {
      method: chosen,
      ...(text && titleEdited.value ? { title: text.title } : {}),
      ...(text && bodyEdited.value ? { body: text.body } : {}),
      // With the default, none: the merge stays on REST, and GitHub commits with it (D5).
      ...(email !== null && email !== commitEmails.value?.[0] ? { authorEmail: email } : {}),
    },
    edited: text && isEdited.value ? text : null,
  };
}

function choose(next: PullRequestMergeMethod) {
  method.value = next;
  notice.value = null;
}

async function edit() {
  const key = commitMethod.value;
  // Two or more of a stack land each under its own title, and a queue or auto-merge already on holds the text: there
  // is none to edit (stacked PRs D11, PM11, PM14).
  if (key === null || merging.value || several.value || textFixed.value) {
    return;
  }

  const text = proposal.value;
  if (!text) {
    editWhenRead.value = props.reading;
    return;
  }

  edited.value = { ...edited.value, [key]: edited.value[key] ?? text };
  editing.value = true;
  await nextTick();
  titleField.value?.focus();
}

function updateText(patch: Partial<MergeCommitText>) {
  const key = commitMethod.value;
  const text = draft.value;
  if (key !== null && text) {
    edited.value = { ...edited.value, [key]: { ...text, ...patch } };
  }
}

function backToProposal() {
  const key = commitMethod.value;
  const text = proposal.value;
  if (key !== null && text) {
    edited.value = { ...edited.value, [key]: text };
  }
}

function onKeydown(event: KeyboardEvent) {
  if (matchesCommandKey(event, 'Mod+Enter')) {
    event.preventDefault();
    goForward();
    return;
  }

  if (matchesCommandKey(event, 'Shift+Mod+Enter')) {
    event.preventDefault();
    jump();
    return;
  }

  if (matchesCommandKey(event, 'Alt+Mod+Enter')) {
    event.preventDefault();
    bypass();
    return;
  }

  if (isEditableTarget(event.target) || merging.value) {
    return;
  }

  const index = ['1', '2', '3'].findIndex(key => matchesCommandKey(event, key));
  const chosen = index === -1 ? undefined : methods.value[index];
  if (chosen && choosable.value) {
    event.preventDefault();
    choose(chosen);
  } else if (canMoveLine.value && (matchesCommandKey(event, 'ArrowUp') || matchesCommandKey(event, 'ArrowDown'))) {
    event.preventDefault();
    emit('move', matchesCommandKey(event, 'ArrowUp') ? 'earlier' : 'later');
  } else if (stackDraft.value !== null && props.allowed && !props.advancing && matchesCommandKey(event, 'Mod+K')) {
    event.preventDefault();
    emit('step', 'markReady');
  } else if (canTakeOut.value && matchesCommandKey(event, 'Shift+Q')) {
    event.preventDefault();
    takeOutOfQueue();
  } else if (commitEmails.value && matchesCommandKey(event, 'Y')) {
    event.preventDefault();
    nextEmail();
  } else if (stackQueueLink.value && matchesCommandKey(event, 'O')) {
    event.preventDefault();
    emit('visit', stackQueueLink.value.url);
  } else if (matchesCommandKey(event, 'E') && !editing.value) {
    event.preventDefault();
    void edit();
  } else if (
    matchesCommandKey(event, 'C') &&
    checksHint.value !== null &&
    (props.options !== null || stackChecks.value !== null)
  ) {
    event.preventDefault();
    checksOpen.value = !checksOpen.value;
  } else if (band.value?.link && matchesCommandKey(event, band.value.link.key)) {
    event.preventDefault();
    emit('visit', band.value.link.url);
  }
}

/** Escape leaves the commit editor, keeping the edit, before it closes the panel (PM3d). */
function onEscape(event: KeyboardEvent) {
  if (editing.value) {
    event.preventDefault();
    editing.value = false;
    root.value?.focus();
  }
}

/** Opening puts the focus on the panel itself, where its keys work. */
function onOpenFocus(event: Event) {
  event.preventDefault();
  root.value?.focus();
}
</script>

<template>
  <Dialog
    v-model:open="open"
    :title="stack ? t(l.stackDialogTitle, { name: stack.description.name.title }) : t(l.dialogTitle, { reference })"
    :width="640"
    bare
    fit-content
    centered
    @escape-key-down="onEscape"
    @open-auto-focus="onOpenFocus"
  >
    <div
      ref="root"
      :class="css.mergePanel"
      tabindex="-1"
      data-no-commands
      data-layer
      @keydown="onKeydown"
    >
      <header :class="css.mergePanel_header">
        <template v-if="stack">
          <Layers
            :class="[css.mergePanel_typeIcon, css.mergePanel_typeIcon_stack]"
            aria-hidden="true"
          />
          <span :class="css.mergePanel_reference">{{ pr.repository.nameWithOwner }}</span>
          <span :class="css.mergePanel_title">{{ stack.description.name.title }}</span>
        </template>
        <template v-else>
          <component
            :is="typeIcon.icon"
            :class="[css.mergePanel_typeIcon, css[`mergePanel_typeIcon_${typeIcon.tone}`]]"
            aria-hidden="true"
          />
          <span :class="css.mergePanel_reference">{{ reference }}</span>
          <span :class="css.mergePanel_title">{{ pr.title }}</span>
        </template>
        <span
          v-if="reading"
          :class="css.mergePanel_reading"
          role="status"
        >
          <RefreshCw
            :class="css.mergePanel_readingIcon"
            aria-hidden="true"
          />
          {{ t(l.reading) }}
        </span>
        <span
          v-else-if="computing"
          :class="css.mergePanel_reading"
          role="status"
        >
          <RefreshCw
            :class="css.mergePanel_readingIcon"
            aria-hidden="true"
          />
          {{ t(l.computing) }}
        </span>
        <Button
          variant="ghost"
          size="sm"
          kbd="Escape"
          :aria-label="t(l.close)"
          aria-keyshortcuts="Escape"
          @click="open = false"
        />
      </header>

      <!-- On a short window it scrolls, with nothing inside to reach it by key in some states (SP55). -->
      <div
        :class="css.mergePanel_body"
        tabindex="0"
      >
        <PullRequestVerdictLine
          :verdict="verdict"
          inset="lg"
        />

        <StackMergeMembers
          v-if="stack"
          :rows="stackRows"
          :line="stackLine"
        />

        <div
          v-if="band"
          :class="[css.mergePanel_band, css[`mergePanel_band_${band.tone}`]]"
          :role="outcomeUnknown ? 'status' : 'alert'"
        >
          <component
            :is="band.icon"
            :class="css.mergePanel_bandIcon"
            aria-hidden="true"
          />
          <span :class="css.mergePanel_bandText">
            <strong :class="css.mergePanel_bandTitle">{{ band.title }}</strong>
            <span v-if="band.text">{{ band.text }}</span>
            <span
              v-if="band.link"
              :class="css.mergePanel_bandLink"
            >
              <Button
                size="sm"
                :icon="ArrowUpRight"
                :link="band.link.url"
                target="_blank"
                rel="noopener noreferrer"
                :kbd="band.link.key"
                :aria-keyshortcuts="band.link.key"
                >{{ band.link.label }}</Button
              >
            </span>
          </span>
        </div>

        <div
          v-if="showChecks"
          :class="css.mergePanel_checks"
        >
          <MergeCondition
            v-for="condition in conditions"
            :key="condition.label"
            :icon="condition.icon"
            :tone="condition.tone"
            :label="condition.label"
            :text="condition.text"
            :aside="condition.aside"
          />
          <MergeChecks
            :checks="options?.checks ?? null"
            :summary="pr.checks"
            :open="checksOpen"
            :now="now"
            :run-again="step === 'updateBranch'"
            :reading="reading"
            @toggle="checksOpen = !checksOpen"
          />
        </div>

        <div
          v-if="queueEntry"
          :class="css.mergePanel_checks"
        >
          <MergeCondition
            v-for="line in queueLines"
            :key="line.label"
            :icon="line.icon"
            :tone="line.tone"
            :label="line.label"
            :text="line.text"
            :aside="line.aside"
          />
        </div>

        <div
          v-if="showStackChecks && stackChecks"
          :class="css.mergePanel_checks"
        >
          <MergeChecks
            :checks="stackChecks.checks"
            :summary="stackChecks.summary"
            :label="t(l.stackChecksOf, { number: stackChecks.number })"
            open
            :now="now"
            :reading="stackChecks.reading"
            @toggle="checksOpen = false"
          />
        </div>

        <dl
          v-if="showLanding"
          :class="css.mergePanel_landing"
        >
          <div
            v-if="!autoMerge"
            :class="css.mergePanel_line"
          >
            <dt :class="css.mergePanel_lineKey">{{ t(l.method) }}</dt>
            <dd :class="css.mergePanel_lineValue">
              <div :class="css.mergePanel_methodRow">
                <span
                  v-if="queueStack && !merging"
                  :class="css.mergePanel_methodName"
                  >{{ t(l.setByQueueLine) }}</span
                >
                <SegmentedTabs
                  v-else-if="choosable && method"
                  :model-value="method"
                  :label="t(l.methodsLabel)"
                  :options="methodOptions"
                  show-keys
                  @update:model-value="choose"
                />
                <template v-else>
                  <span :class="css.mergePanel_methodName">{{
                    shownMethod ? methodName(shownMethod) : t(l.noMethod, { base: pr.baseRefName })
                  }}</span>
                  <span
                    v-if="shownMethod && !merging && reading"
                    :class="css.mergePanel_note"
                    >{{ t(l.repositoryDefault) }}</span
                  >
                  <span
                    v-else-if="shownMethod && !merging && pr.isMergeQueueEnabled"
                    :class="css.mergePanel_note"
                    >{{ t(l.setByQueue) }}</span
                  >
                  <span
                    v-else-if="shownMethod && !merging && methods.length === 1"
                    :class="css.mergePanel_note"
                    >{{ t(l.onlyMethod, { base: pr.baseRefName }) }}</span
                  >
                </template>
                <span
                  v-if="several"
                  :class="css.mergePanel_note"
                  >{{ stackMethodNote }}</span
                >
                <span :class="css.mergePanel_spacer" />
                <!-- A stack lands on its first one's base. -->
                <span
                  v-if="stack"
                  :class="css.mergePanel_branch"
                  >{{ pr.baseRefName }}</span
                >
                <template v-else>
                  <span :class="css.mergePanel_hidden">{{
                    t(l.branchInto, { head: pr.headRefName, base: pr.baseRefName })
                  }}</span>
                  <span
                    :class="css.mergePanel_branch"
                    aria-hidden="true"
                    >{{ pr.headRefName }}</span
                  >
                  <ArrowRight
                    :class="css.mergePanel_branchIcon"
                    aria-hidden="true"
                  />
                  <span
                    :class="css.mergePanel_branch"
                    aria-hidden="true"
                    >{{ pr.baseRefName }}</span
                  >
                </template>
              </div>
            </dd>
          </div>

          <div
            v-if="!merging && !noCommitText && pr.isMergeQueueEnabled && !autoMerge"
            :class="css.mergePanel_line"
          >
            <dt :class="css.mergePanel_lineKey">{{ t(l.commit) }}</dt>
            <dd :class="[css.mergePanel_lineValue, css.mergePanel_rebaseNote]">
              {{ t(l.writtenByQueue) }}
            </dd>
          </div>

          <div
            v-else-if="!editing && !merging && !noCommitText && shownMethod === 'REBASE'"
            :class="css.mergePanel_line"
          >
            <dt :class="css.mergePanel_lineKey">{{ t(l.commits) }}</dt>
            <dd :class="[css.mergePanel_lineValue, css.mergePanel_rebaseNote]">
              {{ t(l.rebaseNote, { base: pr.baseRefName }) }}
            </dd>
          </div>

          <div
            v-else-if="!editing && !merging && !noCommitText && commitMethod"
            :class="css.mergePanel_line"
          >
            <dt :class="css.mergePanel_lineKey">{{ t(l.commit) }}</dt>
            <dd :class="[css.mergePanel_lineValue, css.mergePanel_commit]">
              <div :class="css.mergePanel_commitTitleRow">
                <span :class="css.mergePanel_commitTitle">{{ commitTitle }}</span>
                <span
                  v-if="isEdited"
                  :class="css.mergePanel_edited"
                  >{{ t(l.edited) }}</span
                >
                <!-- GitHub's proposal on its way: what it brings opens below once it is in, if it brings anything. -->
                <span
                  v-if="commitBody === null && reading"
                  :class="css.mergePanel_commitLoader"
                  tid="commit-loader"
                >
                  <LoaderCircle
                    :class="css.mergePanel_commitLoaderIcon"
                    aria-hidden="true"
                  />
                  <span :class="css.mergePanel_hidden">{{ t(l.proposalOnItsWay) }}</span>
                </span>
                <span :class="css.mergePanel_spacer" />
                <Button
                  v-if="(proposal || reading) && !textFixed"
                  variant="ghost"
                  size="sm"
                  kbd="E"
                  aria-keyshortcuts="E"
                  @click="edit()"
                  >{{ t(l.edit) }}</Button
                >
              </div>
              <Reveal tid="commit-message">
                <span
                  v-if="peek.lines.length > 0 || peek.more > 0"
                  key="message"
                  :class="css.mergePanel_commitMessage"
                >
                  <span
                    v-if="peek.lines.length > 0"
                    :class="css.mergePanel_commitLines"
                  >
                    <span
                      v-for="(line, index) in peek.lines"
                      :key="index"
                      :class="css.mergePanel_commitLine"
                      >{{ line }}</span
                    >
                  </span>
                  <span
                    v-if="peek.more > 0"
                    :class="css.mergePanel_commitMore"
                    >{{ t(l.moreLines, { count: peek.more }) }}</span
                  >
                </span>
                <span
                  v-else-if="commitBody === null && !reading"
                  key="default"
                  :class="css.mergePanel_commitLines"
                  >{{ t(l.githubDefault) }}</span
                >
              </Reveal>
            </dd>
          </div>

          <div
            v-if="commitEmails && shownEmail && !editing"
            :class="css.mergePanel_line"
          >
            <dt :class="css.mergePanel_lineKey">{{ t(l.email) }}</dt>
            <dd :class="css.mergePanel_lineValue">
              <div :class="css.mergePanel_methodRow">
                <span :class="css.mergePanel_methodName">{{ shownEmail }}</span>
                <span :class="css.mergePanel_note">{{ t(l.emailMore, { count: commitEmails.length - 1 }) }}</span>
                <span :class="css.mergePanel_spacer" />
                <Button
                  variant="ghost"
                  size="sm"
                  kbd="Y"
                  aria-keyshortcuts="Y"
                  @click="nextEmail()"
                  >{{ t(l.changeEmail) }}</Button
                >
              </div>
            </dd>
          </div>
        </dl>

        <div
          v-if="showLanding && editing && draft"
          :class="css.mergePanel_editor"
        >
          <TextField
            ref="titleField"
            v-model="draftTitle"
            :label="t(l.titleLabel)"
            label-hidden
            autocomplete="off"
          />
          <TextArea
            v-model="draftBody"
            :class="css.mergePanel_messageField"
            :label="t(l.messageLabel)"
            label-hidden
          />
          <div :class="css.mergePanel_editorFoot">
            <span :class="css.mergePanel_editorNote">{{
              isEdited ? t(l.editedLines, { count: bodyLineCount }) : t(l.proposedLines, { count: bodyLineCount })
            }}</span>
            <span :class="css.mergePanel_spacer" />
            <Button
              v-if="isEdited"
              variant="ghost"
              size="sm"
              @click="backToProposal()"
              >{{ t(l.backToProposal) }}</Button
            >
          </div>
        </div>

        <div
          v-if="noticeText"
          :class="[css.mergePanel_band, css.mergePanel_band_info]"
          role="status"
        >
          <Info
            :class="css.mergePanel_bandIcon"
            aria-hidden="true"
          />
          <span :class="css.mergePanel_bandText">
            <strong :class="css.mergePanel_bandTitle">{{ noticeText.title }}</strong>
            <span>{{ noticeText.text }}</span>
          </span>
        </div>
      </div>

      <div
        v-if="canBypass"
        :class="css.mergePanel_bypass"
      >
        <ShieldAlert
          :class="css.mergePanel_bypassIcon"
          aria-hidden="true"
        />
        <div :class="css.mergePanel_bypassText">
          <span :class="css.mergePanel_bypassTitle">{{ bypassLines.title }}</span>
          <span>{{ bypassLines.skips }}</span>
          <span v-if="bypassLines.queue">{{ bypassLines.queue }}</span>
          <span v-if="bypassLines.commits">{{ bypassLines.commits }}</span>
        </div>
        <Button
          variant="danger"
          kbd="Alt+Mod+Enter"
          :aria-keyshortcuts="formatAriaKeyShortcuts('Alt+Mod+Enter')"
          :busy="sending && bypassing"
          :disabled="advancing !== null"
          @click="bypass()"
          >{{ bypassLines.button }}</Button
        >
      </div>

      <footer :class="css.mergePanel_footer">
        <span
          v-if="verdict.kind === 'merging'"
          :class="css.mergePanel_hint"
          aria-hidden="true"
          ><Kbd keys="Escape" /> {{ t(l.hintCloseGoesOn) }}</span
        >
        <span
          v-if="verdict.kind === 'merging'"
          :class="css.mergePanel_footerNote"
          >{{ t(l.keepWorking) }}</span
        >
        <span
          v-else-if="editing"
          :class="css.mergePanel_hint"
          aria-hidden="true"
          ><Kbd keys="Escape" /> {{ t(l.hintLeaveField) }}</span
        >
        <span
          v-else-if="!stackFooterBare && (end || canTakeOut || verdict.kind === 'merged')"
          :class="css.mergePanel_hint"
          aria-hidden="true"
          ><Kbd keys="Escape" /> {{ t(l.hintClose) }}</span
        >
        <template v-else-if="!stackFooterBare">
          <Button
            v-if="stackQueueLink"
            variant="ghost"
            size="sm"
            :link="stackQueueLink.url"
            target="_blank"
            rel="noopener noreferrer"
            kbd="O"
            aria-keyshortcuts="O"
            >{{ t(l.numberOnGitHub, { number: stackQueueLink.number }) }}</Button
          >
          <span
            v-if="showStopEarlier"
            :class="css.mergePanel_hint"
            aria-hidden="true"
            ><Kbd keys="↑ ↓" /> {{ t(l.stopEarlier) }}</span
          >
          <span
            v-if="checksHint"
            :class="css.mergePanel_hint"
            aria-hidden="true"
            ><Kbd keys="C" /> {{ checksHint }}</span
          >
          <span
            v-if="step === 'enableAutoMerge' && allowed"
            :class="css.mergePanel_footerNote"
            >{{ t(l.mergesByItself) }}</span
          >
          <span
            v-if="canJump"
            :class="css.mergePanel_footerNote"
            >{{ t(l.jumpRebuilds) }}</span
          >
        </template>
        <span :class="css.mergePanel_spacer" />
        <!-- In the queue it is on its way, with no primary: leaving shows here, when it matters (PM15, SP54). -->
        <template v-if="canTakeOut">
          <Button
            v-if="allowed"
            kbd="Shift+Q"
            aria-keyshortcuts="Shift+Q"
            :busy="advancing === 'dequeue'"
            @click="takeOutOfQueue()"
            >{{ t(l.takeOutOfQueue) }}</Button
          >
        </template>
        <template v-else-if="stackSays?.forward.kind === 'close' && verdict.kind !== 'merging'">
          <Button
            kbd="Escape"
            aria-keyshortcuts="Escape"
            @click="open = false"
            >{{ t(l.hintClose) }}</Button
          >
        </template>
        <template v-else-if="verdict.kind !== 'merging' && verdict.kind !== 'merged' && verdict.kind !== 'unknown'">
          <Button
            v-if="canJump"
            variant="ghost"
            kbd="Shift+Mod+Enter"
            :aria-keyshortcuts="formatAriaKeyShortcuts('Shift+Mod+Enter')"
            :busy="advancing === 'jumpQueue'"
            @click="jump()"
            >{{ t(l.jumpQueue) }}</Button
          >
          <Button
            v-if="stackDraft !== null && allowed"
            variant="ghost"
            :icon="Eye"
            kbd="Mod+K"
            :aria-keyshortcuts="formatAriaKeyShortcuts('Mod+K')"
            :busy="advancing === 'markReady'"
            @click="emit('step', 'markReady')"
            >{{ t(l.markNumberReady, { number: stackDraft }) }}</Button
          >
          <!-- Not filled: the merge already went wrong once, and it is sent again by asking (SP54). -->
          <Button
            v-if="stackSays?.forward.kind === 'addAgain' && allowed"
            :icon="ListPlus"
            kbd="Mod+Enter"
            :aria-keyshortcuts="formatAriaKeyShortcuts('Mod+Enter')"
            :busy="sending"
            @click="send()"
            >{{ primaryLabel }}</Button
          >
          <!-- GitHub's "Rebase stack" is on github.com only, and the icon says so (stacked PRs D8, D21). -->
          <Button
            v-else-if="stackSays?.forward.kind === 'visit' && allowed"
            :icon="ArrowUpRight"
            :link="stackSays.forward.url"
            target="_blank"
            rel="noopener noreferrer"
            kbd="Mod+Enter"
            :aria-keyshortcuts="formatAriaKeyShortcuts('Mod+Enter')"
            >{{ stackSays.forward.label }}</Button
          >
          <!-- Turning it off isn't the filled action: nothing gets merged by it (PM11). -->
          <Button
            v-else-if="step === 'disableAutoMerge' && allowed"
            :icon="CircleOff"
            kbd="Mod+Enter"
            :aria-keyshortcuts="formatAriaKeyShortcuts('Mod+Enter')"
            :busy="advancing === 'disableAutoMerge'"
            @click="goForward()"
            >{{ t(l.disableAutoMerge) }}</Button
          >
          <!-- It leaves for github.com's editor, and the icon says so (PM19). -->
          <Button
            v-else-if="step === 'resolveConflicts' && allowed"
            :icon="ArrowUpRight"
            :link="conflictsUrl"
            target="_blank"
            rel="noopener noreferrer"
            kbd="Mod+Enter"
            :aria-keyshortcuts="formatAriaKeyShortcuts('Mod+Enter')"
            >{{ t(l.resolveOnGitHub) }}</Button
          >
          <Button
            v-else-if="stepButton && allowed"
            variant="primary"
            :icon="stepButton.icon"
            kbd="Mod+Enter"
            :aria-keyshortcuts="formatAriaKeyShortcuts('Mod+Enter')"
            :busy="advancing !== null"
            @click="goForward()"
            >{{ stepButton.label }}</Button
          >
          <Button
            v-else-if="canSend || (sending && !bypassing)"
            variant="primary"
            :icon="primaryIcon"
            kbd="Mod+Enter"
            :aria-keyshortcuts="formatAriaKeyShortcuts('Mod+Enter')"
            :busy="sending"
            @click="send()"
            >{{ primaryLabel }}</Button
          >
          <Button
            v-else
            :icon="stack?.merge.freshChecks || advancing === 'jumpQueue' ? primaryIcon : CircleX"
            disabled
            >{{ primaryLabel }}</Button
          >
        </template>
      </footer>
    </div>
  </Dialog>
</template>

<style lang="scss" module="css">
.mergePanel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  outline: none;
}

.mergePanel_header {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  padding: 11px 14px;
  white-space: nowrap;
  border-bottom: 1px solid $color-border;
}

.mergePanel_typeIcon {
  flex: none;
  width: 15px;
  height: 15px;
}

.mergePanel_typeIcon_open {
  color: $color-green;
}

.mergePanel_typeIcon_draft {
  color: $color-fg-3;
}

.mergePanel_typeIcon_done {
  color: $color-purple;
}

.mergePanel_typeIcon_closed {
  color: $color-red;
}

.mergePanel_typeIcon_stack {
  color: $color-fg-2;
}

.mergePanel_reference {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.mergePanel_title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.mergePanel_reading {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.mergePanel_readingIcon {
  width: 11px;
  height: 11px;
}

.mergePanel_body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
}

.mergePanel_checks {
  display: flex;
  flex: none;
  flex-direction: column;
  padding-top: $spacing-4;
  padding-bottom: $spacing-4;
}

.mergePanel_band {
  display: flex;
  flex: none;
  gap: 9px;
  align-items: flex-start;
  padding: $spacing-10 14px;
  font-size: $font-size-xs;
  line-height: 17px;
  color: $color-fg-2;
  border-top: 1px solid $color-border;
}

.mergePanel_band_danger {
  background: rgba($color-red, 0.08);
}

.mergePanel_band_info {
  background: rgba($color-accent, 0.08);
}

.mergePanel_band_warning {
  background: rgba($color-amber, 0.08);
}

.mergePanel_bandIcon {
  flex: none;
  width: 14px;
  height: 14px;
  margin-top: 1px;

  .mergePanel_band_danger & {
    color: $color-red;
  }

  .mergePanel_band_info & {
    color: $color-accent;
  }

  .mergePanel_band_warning & {
    color: $color-amber;
  }

  .mergePanel_band_muted & {
    color: $color-fg-3;
  }
}

.mergePanel_bandLink {
  display: flex;
  margin-top: 5px;
}

.mergePanel_bandText {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.mergePanel_bandTitle {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.mergePanel_landing {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 9px;
  padding: $spacing-10 14px;
  margin: 0;
  border-top: 1px solid $color-border;
}

.mergePanel_line {
  display: flex;
  gap: $spacing-8;
  align-items: flex-start;
}

.mergePanel_lineKey {
  flex: none;
  width: 93px;
  padding-top: 3px;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.mergePanel_lineValue {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  margin: 0;
}

.mergePanel_methodRow {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-height: 24px;
  white-space: nowrap;
}

.mergePanel_methodName {
  font-size: $font-size-sm;
  color: $color-fg;
}

.mergePanel_note {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.mergePanel_spacer {
  flex: 1;
}

.mergePanel_hidden {
  @include visually-hidden;
}

.mergePanel_branch {
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.mergePanel_branchIcon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}

.mergePanel_rebaseNote {
  padding-top: 3px;
  font-size: $font-size-sm;
  color: $color-fg-2;
}

.mergePanel_commitTitleRow {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-height: 24px;
}

.mergePanel_commitTitle {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-sm;
  color: $color-fg;
  white-space: nowrap;
}

.mergePanel_edited {
  flex: none;
  font-size: $font-size-2xs;
  color: $color-accent;
}

// Beside the title while GitHub's proposal is read, in the place the title row already holds.
.mergePanel_commitLoader {
  display: inline-flex;
  flex: none;
  align-items: center;
}

.mergePanel_commitLoaderIcon {
  width: 12px;
  height: 12px;
  color: $color-fg-dim;
  animation: merge-panel-spin 1s linear infinite;
}

.mergePanel_commitMessage {
  display: flex;
  flex-direction: column;
}

.mergePanel_commitLines {
  display: flex;
  flex-direction: column;
  font-size: $font-size-xs;
  line-height: 18px;
  color: $color-fg-dim;
}

.mergePanel_commitLine {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mergePanel_commitMore {
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.mergePanel_editor {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: $spacing-8;
  padding: $spacing-10 14px;
  border-top: 1px solid $color-border;
}

// Long text scrolls inside its field, which keeps one height (PM3d): over `TextArea`'s growing with its text, hence
// the doubled class.
.mergePanel_messageField.mergePanel_messageField textarea {
  min-height: min(300px, 40vh);
  max-height: min(300px, 40vh);
  padding: $spacing-8 $spacing-10;
  overflow-y: auto;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  line-height: 17px;
  color: $color-fg-2;
}

.mergePanel_editorFoot {
  display: flex;
  gap: $spacing-8;
  align-items: center;
}

.mergePanel_editorNote {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

// On no red ground: the usual action stays the one filled button, last (D12, PM12a).
.mergePanel_bypass {
  display: flex;
  flex: none;
  gap: $spacing-10;
  align-items: center;
  padding: $spacing-8 14px;
  border-top: 1px solid $color-border;
}

.mergePanel_bypassIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-red;
}

.mergePanel_bypassText {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: $font-size-xs;
  line-height: 17px;
  color: $color-fg-dim;
}

.mergePanel_bypassTitle {
  color: $color-fg-2;
}

.mergePanel_footer {
  display: flex;
  flex: none;
  gap: $spacing-12;
  align-items: center;
  min-height: 52px;
  padding: $spacing-10 14px;
  background: $color-bg;
  border-top: 1px solid $color-border;
}

.mergePanel_hint {
  display: inline-flex;
  gap: $spacing-5;
  align-items: center;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.mergePanel_footerNote {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

@keyframes merge-panel-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
