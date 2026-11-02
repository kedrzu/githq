<!-- The merge panel (PM1a–PM32a, merging D6, D7, D11–D13): its own surface over any screen, 640 wide and centred, that answers "can I merge this now, and how will it land?". The verdict, the checks (`MergeChecks`), the method — only those the repository and the base branch allow, `1 2 3` — and the commit text GitHub proposes for it: a title and three lines, `E` to edit (Esc leaves the field keeping the edit, a second Esc closes). The read arriving moves nothing (PM8): until then the methods are the repository's settings' (the read may narrow them, PM9), the checks' chevron and `C` are in place but inactive, and quiet bars hold the commit's lines. What holds the merge besides the checks — reviews, conflicts, a branch behind — or is not known yet shows in a line above them. `⌘↵` is always the way forward of the state, from the verdict the opened item's standing shares (D12, PM38): it merges at once, before the panel's read arrives too, and while GitHub is still working out whether it merges (PM22): unedited text is then GitHub's default, and only edited text is ever sent. A draft is marked ready first (PM21); a branch behind one that must be up to date is updated (PM20), the panel saying so until GitHub answered and the panel read it again; conflicts leave for GitHub's editor (PM19); with no way forward the primary is off and says why (PM13). When the read takes the chosen method away, the panel moves to the default and says so once. While the merge is sent it stays as it was, its primary busy, until GitHub answers. Being merged, it says so and offers nothing to repeat; merged, how it landed and nothing to do (PM26); refused, it stays with the text and GitHub's reason in its own words, and ⌘↵ tries again (PM25, PM31) — with no answer at all, that the outcome is not known. What the session knows of the last merge that did not end merged (`MergeRecord`) decides the rest: a head that moved since says nothing merged and names the new commit (`D`), the primary going by its state (PM27); a method the rules, read late, don't allow leaves the panel on one they do, the edit kept as its text (PM28); no answer in time is grey, neither merged nor failed, with no second merge and GitHub a key away (`O`, PM29). Opened again with such a record, it starts on the method and the edited text that merge was sent with (D15). The keys are the panel's only while it is open: nothing reaches the screen below (`data-layer`, `data-no-commands`, focus kept inside). -->
<script lang="ts" setup>
import type { PullRequestMergeMethod } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  ArrowRight,
  ArrowUpRight,
  CircleX,
  Eye,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequestArrow,
  Info,
  Lock,
  MessageSquareWarning,
  RefreshCw,
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
import PullRequestVerdictLine from '@/item/PullRequestVerdictLine.vue';
import { usePullRequestConditions } from '@/item/usePullRequestConditions.js';
import type { PullRequestCondition } from '@/item/usePullRequestConditions.js';
import { usePullRequestVerdict } from '@/item/usePullRequestVerdict.js';
import type { PullRequestVerdict } from '@/item/usePullRequestVerdict.js';
import { getPullRequestKind } from '@/lists/utils/getPullRequestKind.js';
import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import { isMergeabilityUnknown } from '@/store/isMergeabilityUnknown.js';
import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import { formatTimeAgo } from '@/utils/formatTimeAgo.js';
import { Browser } from '@/services/Browser.js';
import { getApprovalUrl } from '@/tracking/utils/getApprovalUrl.js';
import { isEditableTarget } from '@/utils/isEditableTarget.js';

import { countMergeChecks } from './countMergeChecks.js';
import { MERGE_TIME_LIMIT_MS } from './createMergeEdit.js';
import { getConflictEditorUrl } from './getConflictEditorUrl.js';
import { getAttentionChecks } from './getAttentionChecks.js';
import { getMergeEnd } from './getMergeEnd.js';
import { getMergeEndLook } from './getMergeEndLook.js';
import { getMergeMethods } from './getMergeMethods.js';
import type { MergeSettings } from './getMergeMethods.js';
import { getReasonTitle } from './getReasonTitle.js';
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
   * (`getMergeEnd`) — or no answer (PM29). `null` for none, and while a merge is sent.
   */
  record: MergeRecord | null;
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
}>();

const emit = defineEmits<{
  /** `⌘↵` or the primary: merge as shown. */
  merge: [submission: MergeSubmission];
  /** `⌘↵` or the primary where it can't merge yet: the step towards the merge (merging D12). */
  step: [step: MergeStep];
  /** A link's key (`D`, `O`): opens the page on github.com in a new tab. */
  visit: [url: string];
}>();

const open = defineModel<boolean>('open', { required: true });

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
const standing = usePullRequestVerdict(shownPr, counts);
const prConditions = usePullRequestConditions(shownPr);

const offered = computed(() => (props.settings ? getMergeMethods(props.settings, props.options) : null));
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
const checksOpen = ref(false);

const merging = computed(() => shownPr.value.merging !== undefined);
/** How the last merge that did not end merged reads now: refused, a new commit, a method gone, or not known. */
const end = computed(() => getMergeEnd(props.record, props.pr, props.options));
/** No answer (PM29): the merge may still land, so nothing is offered to send it again. */
const outcomeUnknown = computed(() => end.value?.kind === 'unknown');
const hasAttention = computed(() => props.options !== null && getAttentionChecks(props.options.checks).length > 0);

/** Merging is the way forward: ⌘↵ merges (D6, D12). */
const mergesNow = computed(() => !merging.value && !outcomeUnknown.value && standing.forward === 'merge');
/**
 * The step ⌘↵ takes instead of merging: the one asked for until it is done, else the way forward where it can't
 * merge yet (D12). `null` where it merges, or nothing is left to do.
 */
const step = computed((): MergeStep | null => {
  if (props.advancing) {
    return props.advancing;
  }

  const forward = merging.value || outcomeUnknown.value ? null : standing.forward;
  return forward === 'merge' ? null : forward;
});
/** Where the way forward ends in a merge — not for a draft or conflicts (PM19, PM21): the method and the text show. */
const leadsToMerge = computed(() => mergesNow.value || step.value === 'updateBranch');

const verdict = computed((): PanelVerdict => {
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

const commitMethod = computed(() => toCommitMethod(method.value));
const proposal = computed(() =>
  commitMethod.value && props.options ? props.options.proposedTexts[commitMethod.value] : null,
);
const draft = computed(() => (commitMethod.value ? (edited.value[commitMethod.value] ?? null) : null));
const titleEdited = computed(() => draft.value !== null && draft.value.title !== proposal.value?.title);
const bodyEdited = computed(() => draft.value !== null && draft.value.body !== proposal.value?.body);
const isEdited = computed(() => titleEdited.value || bodyEdited.value);
/** The commit's title as it will land: edited, proposed, or — before the proposal — what GitHub writes by default. */
const commitTitle = computed(() => {
  const text = draft.value ?? proposal.value;
  if (text) {
    return text.title;
  }

  const { pr } = props;
  return commitMethod.value === 'SQUASH'
    ? `${pr.title} (#${pr.number})`
    : `Merge pull request #${pr.number} from ${pr.repository.owner}/${pr.headRefName}`;
});
const commitBody = computed(() => (draft.value ?? proposal.value)?.body ?? null);
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
    case 'markReady':
      return { label: t(l.markReady), icon: Eye };
    case 'updateBranch':
      return { label: t(l.updateBranch), icon: GitPullRequestArrow };
    // A link of its own, out of the panel.
    case 'resolveConflicts':
    case null:
      return null;
    default:
      return assertNever(current);
  }
});
const conflictsUrl = computed(() => getConflictEditorUrl(props.pr));
/** The methods from the repository's settings until the read narrows them (PM9): chosen before it arrives too. */
const choosable = computed(() => methods.value.length > 1 && !editing.value && !merging.value);
/** While being merged, the method it was sent with (PM24). */
const shownMethod = computed(() => shownPr.value.merging ?? method.value);
const showChecks = computed(() => {
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
const showLanding = computed(() => {
  switch (verdict.value.kind) {
    case 'merging':
    case 'refused':
      return true;
    case 'ready':
      return !checksOpen.value;
    // The new commit's state decides, as it does for the primary (PM27).
    case 'newCommit':
      return leadsToMerge.value && !checksOpen.value;
    case 'blocked':
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

  if (!mergesNow.value) {
    return verdict.value.kind === 'refused' || verdict.value.kind === 'newCommit'
      ? standing.verdict.text
      : verdict.value.text;
  }

  if (method.value === null) {
    return t(l.nothingToOffer);
  }

  // Refused for what still holds: the same merge again. A moved head or a method gone make it another merge.
  return end.value?.kind === 'refused' ? t(l.tryAgain) : primaryName(method.value);
});
const checksHint = computed(() => {
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
/** What the last merge's end says beneath the verdict: GitHub's reason, the new commit, or that the next refresh settles it. */
const band = computed((): Band | null => {
  const record = end.value;
  const base = props.pr.baseRefName;
  switch (record?.kind) {
    case undefined:
      return null;
    case 'refused':
      return refusalBand(record.reason);
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
        link: { label: t(l.seeNewCommit), url: `${props.pr.url}/commits/${record.head}`, key: 'D' },
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
    case 'unknown':
      return {
        tone: 'muted',
        icon: Info,
        title: t(l.nextRefreshSettles),
        text: record.accepted ? t(l.noResult, { minutes: MERGE_TIME_LIMIT_MS / 60_000 }) : t(l.noAnswer),
        link: { label: t(l.openOnGitHub), url: props.pr.url, key: 'O' },
      };
    default:
      return assertNever(record);
  }
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
  if (current !== null && previous?.methods.includes(current)) {
    notice.value = { from: current, to: next.defaultMethod };
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

  const look = getMergeEndLook(record.kind);
  switch (record.kind) {
    case 'refused':
      return { kind: 'refused', ...look, text: t(l.refused), aside: t(l.nothingMerged) };
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
      return { kind: 'unknown', ...look, text: t(l.outcomeUnknown), aside: t(l.notAnsweredYet) };
    default:
      return assertNever(record);
  }
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
  switch (value) {
    case 'SQUASH':
      return t(l.methodSquash);
    case 'MERGE':
      return t(l.methodMerge);
    case 'REBASE':
      return t(l.methodRebase);
    default:
      return assertNever(value);
  }
}

function primaryName(value: PullRequestMergeMethod) {
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
  const next = step.value;
  if (next === null) {
    send();
  } else if (props.allowed && props.advancing === null) {
    emit('step', next);
  }
}

function send() {
  if (!canSend.value || method.value === null) {
    return;
  }

  // Only what the user edited goes; GitHub writes its own default otherwise (D6).
  const text = draft.value;
  emit('merge', {
    request: {
      method: method.value,
      ...(text && titleEdited.value ? { title: text.title } : {}),
      ...(text && bodyEdited.value ? { body: text.body } : {}),
    },
    edited: text && isEdited.value ? text : null,
  });
}

function choose(next: PullRequestMergeMethod) {
  method.value = next;
  notice.value = null;
}

async function edit() {
  const key = commitMethod.value;
  if (key === null || merging.value) {
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

  if (isEditableTarget(event.target) || merging.value) {
    return;
  }

  const index = ['1', '2', '3'].findIndex(key => matchesCommandKey(event, key));
  const chosen = index === -1 ? undefined : methods.value[index];
  if (chosen && choosable.value) {
    event.preventDefault();
    choose(chosen);
  } else if (matchesCommandKey(event, 'E') && !editing.value) {
    event.preventDefault();
    void edit();
  } else if (matchesCommandKey(event, 'C') && checksHint.value !== null && props.options !== null) {
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
    :title="t(l.dialogTitle, { reference })"
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
        <component
          :is="typeIcon.icon"
          :class="[css.mergePanel_typeIcon, css[`mergePanel_typeIcon_${typeIcon.tone}`]]"
          aria-hidden="true"
        />
        <span :class="css.mergePanel_reference">{{ reference }}</span>
        <span :class="css.mergePanel_title">{{ pr.title }}</span>
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

      <div :class="css.mergePanel_body">
        <PullRequestVerdictLine
          :verdict="verdict"
          inset="lg"
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

        <dl
          v-if="showLanding"
          :class="css.mergePanel_landing"
        >
          <div :class="css.mergePanel_line">
            <dt :class="css.mergePanel_lineKey">{{ t(l.method) }}</dt>
            <dd :class="css.mergePanel_lineValue">
              <div :class="css.mergePanel_methodRow">
                <SegmentedTabs
                  v-if="choosable && method"
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
                    v-else-if="shownMethod && !merging && methods.length === 1"
                    :class="css.mergePanel_note"
                    >{{ t(l.onlyMethod, { base: pr.baseRefName }) }}</span
                  >
                </template>
                <span :class="css.mergePanel_spacer" />
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
              </div>
            </dd>
          </div>

          <div
            v-if="!editing && !merging && shownMethod === 'REBASE'"
            :class="css.mergePanel_line"
          >
            <dt :class="css.mergePanel_lineKey">{{ t(l.commits) }}</dt>
            <dd :class="[css.mergePanel_lineValue, css.mergePanel_rebaseNote]">
              {{ t(l.rebaseNote, { base: pr.baseRefName }) }}
            </dd>
          </div>

          <div
            v-else-if="!editing && !merging && commitMethod"
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
                <span :class="css.mergePanel_spacer" />
                <Button
                  v-if="proposal || reading"
                  variant="ghost"
                  size="sm"
                  kbd="E"
                  aria-keyshortcuts="E"
                  @click="edit()"
                  >{{ t(l.edit) }}</Button
                >
              </div>
              <template v-if="commitBody !== null">
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
              </template>
              <!-- The lines GitHub's proposal fills, held quiet until it arrives: nothing moves when it does. -->
              <template v-else-if="reading">
                <span :class="css.mergePanel_hidden">{{ t(l.proposalOnItsWay) }}</span>
                <span
                  :class="css.mergePanel_commitLines"
                  aria-hidden="true"
                >
                  <span
                    v-for="index in PEEK_LINES"
                    :key="index"
                    :class="[css.mergePanel_commitLine, css.mergePanel_placeholder]"
                    >&nbsp;</span
                  >
                </span>
                <span
                  :class="[css.mergePanel_commitMore, css.mergePanel_placeholder]"
                  aria-hidden="true"
                  >&nbsp;</span
                >
              </template>
              <span
                v-else
                :class="css.mergePanel_commitLines"
                >{{ t(l.githubDefault) }}</span
              >
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

      <footer :class="css.mergePanel_footer">
        <span
          v-if="merging"
          :class="css.mergePanel_hint"
          aria-hidden="true"
          ><Kbd keys="Escape" /> {{ t(l.hintCloseGoesOn) }}</span
        >
        <span
          v-if="merging"
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
          v-else-if="end || verdict.kind === 'merged'"
          :class="css.mergePanel_hint"
          aria-hidden="true"
          ><Kbd keys="Escape" /> {{ t(l.hintClose) }}</span
        >
        <span
          v-else-if="checksHint"
          :class="css.mergePanel_hint"
          aria-hidden="true"
          ><Kbd keys="C" /> {{ checksHint }}</span
        >
        <span :class="css.mergePanel_spacer" />
        <template v-if="!merging && verdict.kind !== 'merged' && verdict.kind !== 'unknown'">
          <!-- It leaves for github.com's editor, and the icon says so (PM19). -->
          <Button
            v-if="step === 'resolveConflicts' && allowed"
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
            v-else-if="canSend || sending"
            variant="primary"
            :icon="GitMerge"
            kbd="Mod+Enter"
            :aria-keyshortcuts="formatAriaKeyShortcuts('Mod+Enter')"
            :busy="sending"
            @click="send()"
            >{{ primaryLabel }}</Button
          >
          <Button
            v-else
            :icon="CircleX"
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

// A line of the message to come: a quiet bar in the line's own box, so the line keeps its height.
.mergePanel_placeholder {
  position: relative;

  &::after {
    position: absolute;
    top: 50%;
    left: 0;
    width: 88%;
    height: 6px;
    content: '';
    background: $color-bg-3;
    border-radius: $radius-sm;
    transform: translateY(-50%);
  }

  &:nth-child(2)::after {
    width: 72%;
  }

  &:nth-child(3)::after {
    width: 56%;
  }

  &.mergePanel_commitMore::after {
    width: 48px;
  }
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
</style>
