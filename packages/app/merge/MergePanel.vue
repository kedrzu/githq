<!-- The merge panel (PM1a–PM32a, merging D6, D7, D11–D13): its own surface over any screen, 640 wide and centred, that answers "can I merge this now, and how will it land?". The verdict, the checks (`MergeChecks`), the method — only those the repository and the base branch allow, `1 2 3` — and the commit text GitHub proposes for it: a title and three lines, `E` to edit (Esc leaves the field keeping the edit, a second Esc closes). `⌘↵` merges at once, before the panel's read arrives too: unedited text is then GitHub's default, and only edited text is ever sent. When the read takes the chosen method away, the panel moves to the default and says so once. Being merged, it says so and offers nothing to repeat; refused at once, it stays with the text and GitHub's reason. The keys are the panel's only while it is open: nothing reaches the screen below (`data-layer`, `data-no-commands`, focus kept inside). -->
<script lang="ts" setup>
import type { PullRequestMergeMethod } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  ArrowRight,
  CircleCheck,
  CircleX,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Info,
  LoaderCircle,
  MessageSquareWarning,
  RefreshCw,
} from 'lucide-vue-next';
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Button from '@/components/Button.vue';
import Dialog from '@/components/Dialog.vue';
import Kbd from '@/components/Kbd.vue';
import type { EditFailureReason } from '@/edits/EditTypes.js';
import { usePullRequestVerdict } from '@/item/usePullRequestVerdict.js';
import type { PullRequestVerdictTone } from '@/item/usePullRequestVerdict.js';
import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import { isEditableTarget } from '@/utils/isEditableTarget.js';

import { countMergeChecks } from './countMergeChecks.js';
import { getMergeMethods } from './getMergeMethods.js';
import type { MergeSettings } from './getMergeMethods.js';
import MergeChecks, { getAttentionChecks } from './MergeChecks.vue';
import * as l from './MergePanel.loc.js';
import type { MergeCommitText, MergeOptions, MergeRequest } from './MergeTypes.js';

const props = defineProps<{
  pr: PullRequestItem;
  /** The repository's merge settings; `null` until its metadata is known. */
  settings: MergeSettings | null;
  /** The panel's read (rulesets, proposed texts, checks); `null` until it arrives, or when it could not be read. */
  options: MergeOptions | null;
  /** The read is on its way. */
  reading: boolean;
  /** The viewer may merge it (`ItemEditor`'s permissions). */
  allowed: boolean;
  /** A merge is sent and GitHub has not answered yet. */
  sending: boolean;
  /** Why GitHub refused the merge sent from this panel at once (PM25). */
  refusal: EditFailureReason | null;
  /** The method of the merge GitHub accepted, for a panel reopened while it runs (PM24); `null` when not known. */
  sentMethod: PullRequestMergeMethod | null;
  /** Epoch ms a running check's time is counted to. */
  now: number;
}>();

const emit = defineEmits<{
  /** `⌘↵` or the primary: merge as shown. */
  merge: [request: MergeRequest];
}>();

const open = defineModel<boolean>('open', { required: true });

/** The methods that make a commit of their own, with a text GitHub proposes. */
type CommitMethod = Exclude<PullRequestMergeMethod, 'REBASE'>;

type PanelVerdictKind = 'blocked' | 'merging' | 'ready' | 'refused';

interface PanelVerdict {
  readonly kind: PanelVerdictKind;
  readonly tone: PullRequestVerdictTone;
  readonly icon: LucideIcon;
  readonly text: string;
  readonly aside: string | null;
}

/** The method the panel was on when the read took it away (PM9). */
interface MethodNotice {
  readonly from: PullRequestMergeMethod;
  readonly to: PullRequestMergeMethod | null;
}

/** What GitHub's status says when it would merge now: requirements met (an optional check may still fail). */
const READY_STATES = new Set(['CLEAN', 'HAS_HOOKS', 'UNSTABLE']);
const PEEK_LINES = 3;

const t = useTranslate();
const root = useTemplateRef<HTMLElement>('root');
const titleField = useTemplateRef<HTMLInputElement>('titleField');
const { verdict: standingVerdict, mergeable } = usePullRequestVerdict(() => props.pr);

const offered = computed(() => (props.settings ? getMergeMethods(props.settings, props.options) : null));
const methods = computed(() => offered.value?.methods ?? []);
const method = ref<PullRequestMergeMethod | null>(offered.value?.defaultMethod ?? null);
const notice = ref<MethodNotice | null>(null);
/** The commit texts the user edited, per method: the text follows the method. */
const edited = ref<Partial<Record<CommitMethod, MergeCommitText>>>({});
const editing = ref(false);
/** `E` pressed while the proposal was on its way: the editor opens once it is in (PM8). */
const editWhenRead = ref(false);
const checksOpen = ref(false);

const merging = computed(() => props.pr.merging === true);
const counts = computed(() => (props.options ? countMergeChecks(props.options.checks) : null));
const hasAttention = computed(() => props.options !== null && getAttentionChecks(props.options.checks).length > 0);

/** Whether GitHub would merge it now, from the read when it is in, else from the row (D6). */
const ready = computed(() => {
  const { pr } = props;
  if (pr.state !== 'OPEN' || pr.isDraft || merging.value) {
    return false;
  }

  const current = counts.value;
  if (current && !getPullRequestStanding(pr).conflicts) {
    return current.requiredFailing + current.requiredPending === 0 && READY_STATES.has(pr.mergeStateStatus);
  }

  return mergeable.value;
});

const verdict = computed((): PanelVerdict => {
  const { pr } = props;
  if (merging.value) {
    return {
      kind: 'merging',
      tone: 'warning',
      icon: LoaderCircle,
      text: t(l.beingMerged),
      aside: t(l.beingMergedDetail),
    };
  }

  if (props.refusal) {
    return { kind: 'refused', tone: 'danger', icon: CircleX, text: t(l.refused), aside: t(l.nothingMerged) };
  }

  const current = counts.value;
  const openWithoutConflicts = pr.state === 'OPEN' && !pr.isDraft && !getPullRequestStanding(pr).conflicts;
  if (current && openWithoutConflicts) {
    if (current.requiredFailing > 0) {
      const aside = t(l.requiredFailed, { count: current.requiredFailing });
      return { kind: 'blocked', tone: 'danger', icon: CircleX, text: t(l.cannotMerge), aside };
    }

    if (current.requiredPending > 0) {
      const running = t(l.requiredRunning, { count: current.requiredPending });
      const aside = pr.reviewDecision === 'APPROVED' ? `${running} · ${t(l.approved)}` : running;
      return { kind: 'blocked', tone: 'warning', icon: LoaderCircle, text: t(l.cannotMerge), aside };
    }

    if (ready.value) {
      return { kind: 'ready', tone: 'success', icon: CircleCheck, text: t(l.ready), aside: readyAside() };
    }
  }

  return { kind: ready.value ? 'ready' : 'blocked', ...standingVerdict.value };
});

const commitMethod = computed((): CommitMethod | null =>
  method.value === 'MERGE' || method.value === 'SQUASH' ? method.value : null,
);
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
const peek = computed(() => peekLines(commitBody.value ?? ''));
const bodyLineCount = computed(() => (draft.value?.body.trimEnd() ?? '').split('\n').length);

const canSend = computed(() => props.allowed && ready.value && method.value !== null && !props.sending);
const choosable = computed(() => !props.reading && methods.value.length > 1 && !editing.value && !merging.value);
const shownMethod = computed(() => (merging.value ? props.sentMethod : method.value));
const showChecks = computed(
  () => !editing.value && (verdict.value.kind === 'ready' || verdict.value.kind === 'blocked'),
);
const showLanding = computed(() => {
  switch (verdict.value.kind) {
    case 'merging':
      return props.sentMethod !== null;
    case 'refused':
      return true;
    case 'ready':
      return !checksOpen.value;
    case 'blocked':
      return false;
    default:
      return assertNever(verdict.value.kind);
  }
});
const primaryLabel = computed(() => {
  if (!props.allowed) {
    return t(l.notAllowed);
  }

  if (!ready.value) {
    return verdict.value.kind === 'refused' ? standingVerdict.value.text : verdict.value.text;
  }

  if (method.value === null) {
    return t(l.nothingToOffer);
  }

  return props.refusal ? t(l.tryAgain) : primaryName(method.value);
});
const checksHint = computed(() => {
  if (!props.options || props.options.checks.length === 0 || !showChecks.value) {
    return null;
  }

  if (checksOpen.value) {
    return t(l.hintFold);
  }

  return hasAttention.value ? t(l.hintAllChecks) : t(l.hintChecks);
});
const typeIcon = computed((): { icon: LucideIcon; tone: string } => {
  const { pr } = props;
  if (pr.merged) {
    return { icon: GitMerge, tone: 'merged' };
  }

  if (pr.state !== 'OPEN') {
    return { icon: GitPullRequestClosed, tone: 'closed' };
  }

  return pr.isDraft ? { icon: GitPullRequestDraft, tone: 'draft' } : { icon: GitPullRequest, tone: 'open' };
});
const reference = computed(() => `${props.pr.repository.nameWithOwner}#${props.pr.number}`);
const refusalText = computed(() => {
  const reason = props.refusal;
  if (!reason) {
    return null;
  }

  switch (reason.kind) {
    case 'refused':
      return reason.message;
    case 'offline':
      return t(l.reasonOffline);
    case 'notAllowed':
      return t(l.reasonNotAllowed);
    case 'dropped':
    case 'missing':
      return t(l.reasonOther);
    default:
      return assertNever(reason);
  }
});
const noticeText = computed(() => {
  const current = notice.value;
  if (!current) {
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

function readyAside() {
  const { pr } = props;
  const current = counts.value;
  if (pr.reviewDecision === 'APPROVED') {
    const allPassed = current !== null && current.passing + current.skipped === props.options?.checks.length;
    return allPassed ? t(l.readyAllPassed) : t(l.readyRequiredPassed);
  }

  return pr.reviewDecision === null ? t(l.readyNoReview) : t(l.readyNoConflicts);
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

function send() {
  if (!canSend.value || method.value === null) {
    return;
  }

  // Only what the user edited goes; GitHub writes its own default otherwise (D6).
  const text = draft.value;
  emit('merge', {
    method: method.value,
    ...(text && titleEdited.value ? { title: text.title } : {}),
    ...(text && bodyEdited.value ? { body: text.body } : {}),
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

function onTitleInput(event: Event) {
  if (event.target instanceof HTMLInputElement) {
    updateText({ title: event.target.value });
  }
}

function onBodyInput(event: Event) {
  if (event.target instanceof HTMLTextAreaElement) {
    updateText({ body: event.target.value });
  }
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
    send();
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
  } else if (matchesCommandKey(event, 'C') && checksHint.value !== null) {
    event.preventDefault();
    checksOpen.value = !checksOpen.value;
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
        <button
          type="button"
          :class="css.mergePanel_close"
          :aria-label="t(l.close)"
          aria-keyshortcuts="Escape"
          @click="open = false"
        >
          <Kbd keys="Escape" />
        </button>
      </header>

      <div :class="css.mergePanel_body">
        <p :class="[css.mergePanel_verdict, css[`mergePanel_verdict_${verdict.tone}`]]">
          <component
            :is="verdict.icon"
            :class="css.mergePanel_verdictIcon"
            aria-hidden="true"
          />
          <strong :class="css.mergePanel_verdictTitle">{{ verdict.text }}</strong>
          <span
            v-if="verdict.aside"
            :class="css.mergePanel_verdictDetail"
            >{{ verdict.aside }}</span
          >
        </p>

        <div
          v-if="refusalText"
          :class="[css.mergePanel_band, css.mergePanel_band_danger]"
          role="alert"
        >
          <MessageSquareWarning
            :class="css.mergePanel_bandIcon"
            aria-hidden="true"
          />
          <span :class="css.mergePanel_bandTitle">{{ refusalText }}</span>
        </div>

        <MergeChecks
          v-if="showChecks"
          :class="css.mergePanel_checks"
          :checks="options?.checks ?? null"
          :summary="pr.checks"
          :open="checksOpen"
          :now="now"
          @toggle="checksOpen = !checksOpen"
        />

        <dl
          v-if="showLanding"
          :class="css.mergePanel_landing"
        >
          <div :class="css.mergePanel_line">
            <dt :class="css.mergePanel_lineKey">{{ t(l.method) }}</dt>
            <dd :class="css.mergePanel_lineValue">
              <div :class="css.mergePanel_methodRow">
                <div
                  v-if="choosable"
                  :class="css.mergePanel_methods"
                  role="group"
                  :aria-label="t(l.methodsLabel)"
                >
                  <button
                    v-for="(choice, index) in methods"
                    :key="choice"
                    type="button"
                    :class="[css.mergePanel_method, choice === method && css.mergePanel_method_chosen]"
                    :aria-pressed="choice === method"
                    :aria-keyshortcuts="String(index + 1)"
                    @click="choose(choice)"
                  >
                    {{ methodName(choice) }}
                    <span
                      :class="css.mergePanel_methodKey"
                      aria-hidden="true"
                      >{{ index + 1 }}</span
                    >
                  </button>
                </div>
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
                  v-if="proposal"
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
              <span
                v-else
                :class="css.mergePanel_commitLines"
                >{{ reading ? t(l.proposalOnItsWay) : t(l.githubDefault) }}</span
              >
            </dd>
          </div>
        </dl>

        <div
          v-if="showLanding && editing && draft"
          :class="css.mergePanel_editor"
        >
          <input
            ref="titleField"
            :class="css.mergePanel_titleField"
            :value="draft.title"
            :aria-label="t(l.titleLabel)"
            autocomplete="off"
            @input="onTitleInput"
          />
          <textarea
            :class="css.mergePanel_messageField"
            :value="draft.body"
            :aria-label="t(l.messageLabel)"
            @input="onBodyInput"
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
          v-else-if="refusal"
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
        <template v-if="!merging">
          <Button
            v-if="canSend || sending"
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

.mergePanel_typeIcon_merged {
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

.mergePanel_close {
  @include focus-ring;

  display: inline-flex;
  flex: none;
  padding: 0;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: $radius-sm;
}

.mergePanel_body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
}

.mergePanel_verdict {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-10 14px;
  margin: 0;
  font-size: $font-size-sm;
  white-space: nowrap;
}

.mergePanel_verdict_success {
  background: rgba($color-green, 0.08);
}

.mergePanel_verdict_danger {
  background: rgba($color-red, 0.08);
}

.mergePanel_verdict_warning {
  background: rgba($color-amber, 0.08);
}

.mergePanel_verdict_done {
  background: rgba($color-purple, 0.08);
}

.mergePanel_verdictIcon {
  flex: none;
  width: 15px;
  height: 15px;

  .mergePanel_verdict_success & {
    color: $color-green;
  }

  .mergePanel_verdict_danger & {
    color: $color-red;
  }

  .mergePanel_verdict_warning & {
    color: $color-amber;
  }

  .mergePanel_verdict_done & {
    color: $color-purple;
  }

  .mergePanel_verdict_muted & {
    color: $color-fg-3;
  }
}

.mergePanel_verdictTitle {
  flex: none;
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.mergePanel_verdictDetail {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg-2;
}

.mergePanel_checks {
  flex: none;
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

.mergePanel_methods {
  display: flex;
  gap: $spacing-2;
  align-items: center;
}

.mergePanel_method {
  @include focus-ring;

  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
  padding: 3px $spacing-6 3px 9px;
  font-family: $font-family-sans;
  font-size: $font-size-sm;
  color: $color-fg-2;
  cursor: pointer;
  background: none;
  border: 1px solid transparent;
  border-radius: $radius-md;

  &:hover {
    color: $color-fg;
  }
}

.mergePanel_method_chosen {
  font-weight: $font-weight-medium;
  color: $color-fg;
  background: $color-bg-3;
  border-color: $color-border-2;
}

.mergePanel_methodKey {
  font-family: $font-family-mono;
  font-size: 10.5px;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
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

.mergePanel_editor {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: $spacing-8;
  padding: $spacing-10 14px;
  border-top: 1px solid $color-border;
}

.mergePanel_titleField,
.mergePanel_messageField {
  width: 100%;
  margin: 0;
  color: $color-fg;
  background: $color-bg;
  border: 1px solid $color-border-2;
  border-radius: $radius-md;
  outline: none;

  &:focus {
    border-color: $color-accent;
  }
}

.mergePanel_titleField {
  padding: 6px $spacing-10;
  font-family: $font-family-sans;
  font-size: $font-size-sm;
}

// Long text scrolls inside its field (PM3d).
.mergePanel_messageField {
  height: 300px;
  max-height: 40vh;
  padding: $spacing-8 $spacing-10;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  line-height: 17px;
  color: $color-fg-2;
  resize: none;
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
