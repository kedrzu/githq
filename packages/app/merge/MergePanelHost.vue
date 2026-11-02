<!-- The merge panel as the app shows it, mounted once over every screen (merging D7): open for the pull request `MergePanelStore` names — or its stack, from the local copy alone (stacked PRs D7, D11): the stack's first open pull request is the panel's, its rulesets and proposal read, and the line `↑`/`↓` move starts on the whole stack from an entry, on everything up to the pull request it was opened on, held before one that can't land (D19); a merge of two or more goes to the top of the range, and refused, the stack is read again — fed by the stores — the pull request as the local copy holds it, its row or the detail of one opened from outside the lists, the repository's merge settings, the viewer's permission — and the read it starts on opening (`useMergeOptions`), and merging through the store, which keeps what the session knows of a merge that did not end merged; its steps towards the merge — GitHub's conflict editor, marking it ready, updating its branch (`ItemEditor`) — read the pull request again once done. Each opening is a fresh panel. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, shallowRef, watch } from 'vue';

import { AuthStore } from '@/auth/AuthStore.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { useNow } from '@/services/useNow.js';
import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import { describeStack } from '@/store/stacks/describeStack.js';
import { groupStacks } from '@/store/stacks/groupStacks.js';
import { pause } from '@/utils/pause.js';

import MergePanel from './MergePanel.vue';
import { getConflictEditorUrl } from './getConflictEditorUrl.js';
import { MergePanelStore } from './MergePanelStore.js';
import type { MergeStep, MergeSubmission } from './MergeTypes.js';
import { getStackMerge } from './stack/getStackMerge.js';
import { getStackMergeEnd } from './stack/getStackMergeEnd.js';
import { getStackMergeOutcome } from './stack/getStackMergeOutcome.js';
import { moveStackMergeEnd } from './stack/moveStackMergeEnd.js';
import type { StackMergeView } from './stack/StackMergeTypes.js';
import { useMergeOptions } from './useMergeOptions.js';

/** How often a running check's time moves on. */
const TICK_MS = 1000;
/** The first wait before reading again whether an update of the branch landed; each next one doubles. */
const FIRST_UPDATE_READ_MS = 1000;
/** How long the panel waits for an update of the branch to land before it shows what GitHub says. */
const UPDATE_TIME_LIMIT_MS = 30_000;

const store = useService(MergePanelStore);
const details = useService(ItemDetailStore);
const items = useService(ItemStore);
const auth = useService(AuthStore);
const repositories = useService(RepositoryStore);
const editor = useService(ItemEditor);
const browser = useService(Browser);
const clock = useService(Clock);

const opened = computed(() => {
  const id = store.itemId;
  const item = id === null ? undefined : details.getItem(id);
  return item?.kind === 'pullRequest' ? item : null;
});
// The stack the panel is open for, from the local copy alone — no request (D7). While its merge is sent the panel
// stays as it was (PM32a): being merged is drawn elsewhere from the first moment.
const description = computed(() => {
  const stackId = store.stack?.id;
  const item = opened.value;
  if (stackId === undefined || !item) {
    return null;
  }

  const others = items.all.filter(
    (other): other is PullRequestItem =>
      other.kind === 'pullRequest' && other.stack?.id === stackId && other.id !== item.id,
  );
  const members = [...others, item];
  const found = groupStacks(sending.value ? members.map(pr => ({ ...pr, merging: undefined })) : members).get(stackId);
  return found
    ? describeStack({ stack: found, viewerLogin: auth.viewer?.login ?? '', getItem: id => details.getItem(id) })
    : null;
});
/** Where the user put the line with `↑`/`↓` in this opening; `undefined` until then: where it opens (D11, D19). */
const movedEnd = shallowRef<number | null | undefined>(undefined);
const stackMerge = computed(() => {
  const stack = description.value;
  const openedOn = store.stack?.openedOn ?? null;
  if (!stack) {
    return null;
  }

  const end = movedEnd.value === undefined ? getStackMergeEnd({ description: stack, openedOn }) : movedEnd.value;
  return getStackMerge({ description: stack, end });
});
/** The stack's pull requests the copy holds, first to last. */
const stackMembers = computed(() =>
  (stackMerge.value?.members ?? []).flatMap(pip => (pip.kind === 'missing' ? [] : [pip.pullRequest])),
);
const stackView = computed((): StackMergeView | null => {
  const stack = description.value;
  const range = stackMerge.value;
  const stackId = store.stack?.id;
  if (!stack || !range || stackId === undefined) {
    return null;
  }

  const outcome = getStackMergeOutcome({ record: store.getStackRecord(stackId), members: stackMembers.value });
  return { name: stack.name.title, merge: range, outcome };
});
/**
 * The pull request the panel is for: a stack's first open one — what lands alone, its base the stack's, its rulesets
 * the ones the merge meets — else the last one, all merged.
 */
const pr = computed(() => {
  const members = stackMembers.value;
  return members.find(isOpenPullRequest) ?? members.at(-1) ?? opened.value;
});
const read = useMergeOptions({ itemId: () => pr.value?.id ?? null });
const repository = computed(() => pr.value?.repository.nameWithOwner ?? null);
const settings = computed(() => (repository.value === null ? null : (repositories.get(repository.value) ?? null)));
const sending = shallowRef(false);
const advancing = shallowRef<MergeStep | null>(null);
/** GitHub said at once the merge sent merged: it was merged already (PM30). */
const alreadyMerged = shallowRef(false);
const now = useNow(TICK_MS, () => pr.value !== null);

const open = computed({
  get: () => pr.value !== null,
  set: (value: boolean) => {
    if (!value) {
      store.close();
    }
  },
});

// Each opening starts clean; the repository's settings are read when not in memory, or old.
watch(
  () => store.opening,
  () => {
    sending.value = false;
    advancing.value = null;
    alreadyMerged.value = false;
    movedEnd.value = undefined;
  },
);
watch(repository, name => {
  if (name !== null) {
    void repositories.ensure(name);
  }
});

/**
 * Busy until GitHub answered — and, refused, until the panel read the pull request again, so it shows what the refusal
 * is told apart by (PM27, PM28). The head commit read is noted on the refusal, for the rows and the opened item to
 * name who pushed it (PM37).
 */
async function merge(submission: MergeSubmission) {
  const item = pr.value;
  if (!item) {
    return;
  }

  const opening = store.opening;
  sending.value = true;
  // Two or more of a stack: one merge of the top of the range lands them all (D11).
  const range = stackMerge.value;
  const stackId = store.stack?.id;
  const top = range?.top;
  const several = range && top && stackId !== undefined && range.going.length > 1;
  const answer = await (several
    ? store.merge({
        item: top,
        submission,
        stack: { id: stackId, size: range.members.length, going: range.going },
      })
    : store.merge({ item, submission }));
  if (answer.kind === 'refused' && store.opening === opening) {
    await read.refresh();
    const commit = read.options?.headCommit;
    if (commit && store.opening === opening && pr.value?.id === item.id) {
      store.noteHeadCommit(item.id, commit);
    }
  }

  // Opened anew meanwhile: that panel is not this one's to answer.
  if (store.opening === opening) {
    sending.value = false;
    alreadyMerged.value = answer.kind === 'merged';
  }
}

/**
 * A step towards the merge (merging D12): the conflicts leave for GitHub's editor; marking it ready and updating its
 * branch are edits like any other — a refusal is reported as a failed edit — after which the panel reads the pull
 * request again, and merging comes back when GitHub says so (PM20, PM21). The step is no news of the last merge: what
 * the session knew of it stops speaking (`forget`).
 */
async function takeStep(step: MergeStep) {
  const item = getStepTarget(step);
  if (!item) {
    return;
  }

  if (step === 'resolveConflicts') {
    browser.openInNewTab(getConflictEditorUrl(item));
    return;
  }

  const opening = store.opening;
  const head = item.headRefOid;
  advancing.value = step;
  store.forget(item.id);
  const outcome = await editor.edit(
    [item.id],
    step === 'markReady' ? { kind: 'draft', draft: false } : { kind: 'updateBranch', method: 'MERGE' },
  );
  await read.refresh();
  if (step === 'updateBranch' && outcome.failed.length === 0) {
    await waitForNewHead(item.id, opening, head);
  }

  // Opened anew meanwhile: that panel is not this one's to answer.
  if (store.opening === opening) {
    advancing.value = null;
  }
}

/** A stack's draft that holds the rest is marked ready from its panel (SP49); any other step is the panel's own one. */
function getStepTarget(step: MergeStep) {
  const range = stackMerge.value;
  if (step !== 'markReady' || !range) {
    return pr.value;
  }

  const draft = range.forward?.kind === 'markReady' ? range.forward.pullRequest : null;
  return draft ?? range.open.find(member => member.number === range.holder?.number) ?? pr.value;
}

/** `↑`/`↓`: the line one open pull request earlier or later (D18). */
function moveLine(direction: 'earlier' | 'later') {
  const range = stackMerge.value;
  if (range) {
    movedEnd.value = moveStackMergeEnd(range, direction);
  }
}

/**
 * GitHub answers an update of the branch before it is made: the old head, its mergeability unknown (live,
 * 2026-11-02). Merging that head would be refused as a new commit, so the panel stays updating and reads the pull
 * request again, waiting longer each time, until the head moved — or the panel is opened anew, or the time is up:
 * then what GitHub says goes.
 */
async function waitForNewHead(itemId: string, opening: number, head: string) {
  const deadline = clock.now() + UPDATE_TIME_LIMIT_MS;
  let delay = FIRST_UPDATE_READ_MS;
  while (isShown() && pr.value?.headRefOid === head && clock.now() < deadline) {
    await pause(clock, Math.min(delay, deadline - clock.now()));
    delay *= 2;
    if (!isShown()) {
      return;
    }

    await read.refresh();
  }

  function isShown() {
    return store.opening === opening && pr.value?.id === itemId;
  }
}
</script>

<template>
  <MergePanel
    v-if="pr"
    :key="store.opening"
    v-model:open="open"
    :pr="pr"
    :settings="settings"
    :options="read.options"
    :reading="read.reading"
    :allowed="editor.getPermissions(pr).mergePanel"
    :sending="sending"
    :record="sending || (stackMerge && !stackMerge.ordinary) ? null : store.getRecord(pr.id)"
    :sent="store.getSent(pr.id)"
    :already-merged="alreadyMerged"
    :advancing="advancing"
    :now="now"
    :stack="stackView"
    @merge="merge"
    @move="moveLine"
    @step="takeStep"
    @visit="browser.openInNewTab"
  />
</template>
