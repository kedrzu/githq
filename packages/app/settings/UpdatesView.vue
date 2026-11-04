<!-- The Updates section of Settings, in the desktop app only (U3–U19): what is running and what it follows, Check for updates (`U`), one line saying what the updater is doing or how it last ended, whoever started it (D11), with Restart or Try again (`R`) when there is something to run, and the choice of stream where there is one (not on Windows, U12). Choosing Stable on a build with a prerelease part asks first (U13, D5), since that can install an older version; the radio follows the native side's stream, so it moves only once the switch has been made. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Check, CircleArrowDown, Info, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed, useId, useTemplateRef } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import ChoiceCards from '@/components/ChoiceCards.vue';
import type { ChoiceCardsOption } from '@/components/ChoiceCards.vue';
import Dialog from '@/components/Dialog.vue';
import ProgressBar from '@/components/ProgressBar.vue';
import { isOlderVersion, isPrereleaseVersion } from '@/services/AppUpdate.js';
import type { UpdateState, UpdateStream } from '@/services/AppUpdate.js';
import { formatTimeAgo } from '@/utils/formatTimeAgo.js';

import * as l from './UpdatesView.loc.js';

/** How the status line is drawn. */
interface UpdatesStatus {
  readonly icon: LucideIcon;
  readonly tone: 'accent' | 'dim' | 'muted' | 'warning';
  readonly title: string;
  readonly detail?: string;
  /** The download's bar: how much of it has arrived, 0–1; `null` while its length is not known. */
  readonly progress?: number | null;
  /** The button at the line's end: Restart, or Try again; both restart (`AppUpdate.restart`). */
  readonly action?: string;
}

const COMMIT_LENGTH = 7;
const MINUTE = 60_000;
const CONFIRM_WIDTH = 480;

const props = defineProps<{
  state: UpdateState;
  /** The time "checked 2 hours ago" is counted to, in epoch milliseconds. */
  now: number;
}>();

const emit = defineEmits<{
  check: [];
  /** Restarts into the ready update, or tries installing it again. */
  restart: [];
  /** The stream to follow from now on; to Stable, on a build with a prerelease part, only once confirmed. */
  setStream: [stream: UpdateStream];
}>();

/** The confirmation of switching to Stable is open (U13). */
const confirming = defineModel<boolean>('confirming', { default: false });

const t = useTranslate();
const id = useId();
const confirmButton = useTemplateRef<InstanceType<typeof Button>>('confirmButton');

const isDevelopmentBuild = computed(() => isPrereleaseVersion(props.state.version));
const build = computed(() => getBuildLine());
const status = computed(() => getStatus());
/** Nothing to ask for while the updater is at it: the status line says so (U5, U7). */
const resting = computed(() => ['checking', 'downloading', 'installing'].includes(props.state.activity.kind));
const streamOptions = computed((): ChoiceCardsOption<UpdateStream>[] => [
  { value: 'stable', label: t(l.stable), detail: t(l.stableDetail) },
  { value: 'development', label: t(l.development), detail: t(l.developmentDetail) },
]);
const stream = computed({
  get: () => props.state.stream,
  set: chooseStream,
});

useCommands(() => [
  {
    id: 'updates.check',
    title: t(l.checkForUpdates),
    section: 'view',
    key: 'U',
    // The menu has its own, which runs anywhere in the app.
    menu: false,
    when: () => !resting.value,
    run: () => emit('check'),
  },
  ...(status.value?.action
    ? [
        {
          id: 'updates.restart',
          title: status.value.action,
          section: 'view' as const,
          key: 'R',
          menu: false,
          run: () => emit('restart'),
        },
      ]
    : []),
]);

function getBuildLine() {
  const { commit, stream: following, canChoose } = props.state;
  const line = !isDevelopmentBuild.value
    ? t(l.stableVersion)
    : commit === null
      ? t(l.developmentBuild)
      : t(l.developmentBuildFromCommit, { commit: commit.slice(0, COMMIT_LENGTH) });

  return canChoose ? t(l.following, { build: line, stream: getStreamName(following) }) : line;
}

function getStreamName(of: UpdateStream) {
  return t(of === 'stable' ? l.stable : l.development);
}

function getStatus(): UpdatesStatus | null {
  const { activity, version, stream: following, manual } = props.state;
  // On Stable a build with a prerelease part takes the newest Stable, whatever its number (D5). A rule, not a memory of
  // the switch: it holds across a restart and until that Stable has arrived, so what these lines say holds too.
  const leaving = following === 'stable' && isDevelopmentBuild.value;

  switch (activity.kind) {
    case 'idle':
      // Nothing has been checked yet, so there is nothing to say (the check at launch is next).
      return null;
    case 'checking':
      return { icon: LoaderCircle, tone: 'muted', title: t(l.checking) };
    case 'upToDate':
      return getUpToDateStatus();
    case 'downloading':
      return {
        icon: CircleArrowDown,
        tone: 'accent',
        title: getDownloadingTitle(activity.version, activity.percent, leaving),
        progress: activity.percent === null ? null : activity.percent / 100,
      };
    case 'ready':
      return {
        icon: CircleArrowDown,
        tone: 'accent',
        title: t(l.ready, { version: activity.version }),
        detail: t(
          leaving && isOlderVersion(activity.version, props.state.version) ? l.readyStableDetail : l.readyDetail,
        ),
        action: t(l.restart),
      };
    case 'failed':
      return {
        icon: TriangleAlert,
        tone: 'warning',
        title: t(leaving ? l.failedStable : l.failedCheck),
        detail: getFailureDetail(activity.reason, leaving),
      };
    case 'noRelease':
      return getNoReleaseStatus(leaving, manual);
    case 'installing':
      return { icon: LoaderCircle, tone: 'muted', title: t(l.installing, { version: activity.version }) };
    case 'installFailed':
      return {
        icon: TriangleAlert,
        tone: 'warning',
        title: t(l.installFailed, { version: activity.version }),
        detail: t(l.installFailedDetail, { version }),
        action: t(l.tryAgain),
      };
  }
}

function getUpToDateStatus(): UpdatesStatus {
  const { version, stream: following, checkedAt } = props.state;
  // On Development a stable version waits for a greater build (U18): the newest there may well be older than it.
  if (following === 'development' && !isDevelopmentBuild.value) {
    return {
      icon: Check,
      tone: 'dim',
      title: t(l.nothingNewer, { version }),
      detail: t(l.nothingNewerDetail),
    };
  }

  return {
    icon: Check,
    tone: 'dim',
    title: t(isDevelopmentBuild.value ? l.newestBuild : l.newestVersion),
    detail: checkedAt === null ? undefined : getCheckedText(checkedAt),
  };
}

function getCheckedText(checkedAt: number) {
  return props.now - checkedAt < MINUTE
    ? t(l.checkedJustNow)
    : t(l.checkedAgo, { age: formatTimeAgo(checkedAt, props.now) });
}

function getDownloadingTitle(version: string, percent: number | null, leaving: boolean) {
  if (percent === null) {
    return t(leaving ? l.downloadingStable : l.downloading, { version });
  }

  return t(leaving ? l.downloadingStablePercent : l.downloadingPercent, { version, percent });
}

function getFailureDetail(reason: 'offline' | 'unreachable', leaving: boolean) {
  if (reason === 'offline') {
    return t(leaving ? l.failedStableOffline : l.failedOffline);
  }

  return t(leaving ? l.failedStableUnreachable : l.failedUnreachable);
}

function getNoReleaseStatus(leaving: boolean, manual: boolean): UpdatesStatus {
  const { version, stream: following } = props.state;
  if (following === 'development') {
    return { icon: Info, tone: 'muted', title: t(l.noDevelopmentBuild), detail: t(l.noReleaseDetail) };
  }

  if (!leaving) {
    return { icon: Info, tone: 'muted', title: t(l.noStableVersion), detail: t(l.noReleaseDetail) };
  }

  // Before the first Stable the builds are numbered after it (D4): 0.1.0-dev.187 comes before 0.1.0.
  const first = version.split('-')[0];
  return manual
    ? {
        icon: Info,
        tone: 'muted',
        title: t(l.noStableVersionSwitched),
        detail: t(l.noStableVersionSwitchedDetail, { version: first }),
      }
    : {
        icon: Info,
        tone: 'muted',
        title: t(l.noStableVersion),
        detail: t(l.noStableVersionFirst, { version: first }),
      };
}

function chooseStream(chosen: UpdateStream) {
  if (chosen === props.state.stream) {
    return;
  }

  if (chosen === 'stable' && isDevelopmentBuild.value) {
    confirming.value = true;
  } else {
    emit('setStream', chosen);
  }
}

function confirmSwitch() {
  emit('setStream', 'stable');
  confirming.value = false;
}

// ↵ is the switch, as the button's hint says: Enter presses what has the focus, and the dialog would give it to Cancel.
function focusConfirmButton(event: Event) {
  event.preventDefault();
  const button: unknown = confirmButton.value?.$el;
  if (button instanceof HTMLElement) {
    button.focus();
  }
}
</script>

<template>
  <div :class="css.updatesView">
    <div :class="css.updatesView_column">
      <section :class="css.updatesView_block">
        <h2 :class="css.updatesView_title">{{ t(l.versionTitle) }}</h2>
        <div :class="css.updatesView_box">
          <div :class="css.updatesView_running">
            <div :class="css.updatesView_text">
              <p :class="css.updatesView_version">{{ t(l.version, { version: state.version }) }}</p>
              <p :class="css.updatesView_detail">{{ build }}</p>
            </div>
            <Button
              size="sm"
              :icon="RefreshCw"
              kbd="U"
              aria-keyshortcuts="U"
              :disabled="resting"
              @click="emit('check')"
            >
              {{ t(l.checkForUpdates) }}
            </Button>
          </div>
          <div
            v-if="status"
            :class="css.updatesView_status"
          >
            <component
              :is="status.icon"
              :class="[css.updatesView_icon, css[`updatesView_icon_${status.tone}`]]"
              aria-hidden="true"
            />
            <div
              :class="css.updatesView_text"
              role="status"
            >
              <p :class="css.updatesView_statusTitle">{{ status.title }}</p>
              <p
                v-if="status.detail"
                :class="css.updatesView_detail"
              >
                {{ status.detail }}
              </p>
              <ProgressBar
                v-if="status.progress !== undefined"
                :class="css.updatesView_progress"
                :value="status.progress"
                :label="t(l.downloadProgress)"
              />
            </div>
            <Button
              v-if="status.action"
              size="sm"
              kbd="R"
              aria-keyshortcuts="R"
              @click="emit('restart')"
            >
              {{ status.action }}
            </Button>
          </div>
        </div>
      </section>
      <section
        v-if="state.canChoose"
        :class="css.updatesView_block"
      >
        <div :class="css.updatesView_head">
          <h2
            :id="`${id}-stream`"
            :class="css.updatesView_title"
          >
            {{ t(l.streamTitle) }}
          </h2>
          <span :class="css.updatesView_scope">{{ t(l.streamScope) }}</span>
        </div>
        <ChoiceCards
          v-model="stream"
          stacked
          :labelledby="`${id}-stream`"
          :options="streamOptions"
        />
      </section>
    </div>
    <Dialog
      v-model:open="confirming"
      :title="t(l.confirmTitle)"
      :width="CONFIRM_WIDTH"
      bare
      fit-content
      centered
      @open-auto-focus="focusConfirmButton"
    >
      <div :class="css.updatesView_confirm">
        <p
          :class="css.updatesView_confirmTitle"
          aria-hidden="true"
        >
          <CircleArrowDown :class="css.updatesView_confirmIcon" />
          {{ t(l.confirmTitle) }}
        </p>
        <p :class="css.updatesView_confirmText">{{ t(l.confirmInstall, { version: state.version }) }}</p>
        <p :class="css.updatesView_confirmText">{{ t(l.confirmSync) }}</p>
        <div :class="css.updatesView_confirmButtons">
          <Button
            variant="outline"
            size="sm"
            kbd="Escape"
            aria-keyshortcuts="Escape"
            @click="confirming = false"
          >
            {{ t(l.cancel) }}
          </Button>
          <Button
            ref="confirmButton"
            size="sm"
            kbd="Enter"
            aria-keyshortcuts="Enter"
            @click="confirmSwitch"
          >
            {{ t(l.confirmSwitch) }}
          </Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style lang="scss" module="css">
.updatesView {
  @include settings-screen;
}

.updatesView_column {
  @include settings-screen-column;

  gap: 28px;
}

.updatesView_block {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
}

.updatesView_head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.updatesView_title {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $color-fg-2;
}

.updatesView_scope {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.updatesView_box {
  border: 1px solid $color-border;
  border-radius: $radius-xl;
}

.updatesView_running,
.updatesView_status {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  padding: $spacing-12 $spacing-14;
}

.updatesView_status {
  padding-block: 11px;
  border-top: 1px solid $color-border;
}

.updatesView_text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.updatesView_version {
  font-family: $font-family-mono;
  font-size: $font-size-xl;
  font-weight: $font-weight-medium;
  overflow-wrap: anywhere;
}

.updatesView_detail {
  font-size: $font-size-sm;
  line-height: $line-height-normal;
  color: $color-fg-2;
}

.updatesView_statusTitle {
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
}

.updatesView_progress {
  margin-top: $spacing-4;
}

.updatesView_icon {
  flex: none;
  align-self: flex-start;
  width: 15px;
  height: 15px;
  margin-top: 1px;
}

.updatesView_icon_accent {
  color: $color-accent;
}

.updatesView_icon_dim {
  color: $color-fg-3;
}

.updatesView_icon_muted {
  color: $color-fg-2;
}

.updatesView_icon_warning {
  color: $color-amber;
}

.updatesView_confirm {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  padding: 20px;
}

.updatesView_confirmTitle {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
}

.updatesView_confirmIcon {
  flex: none;
  width: 18px;
  height: 18px;
  color: $color-accent;
}

.updatesView_confirmText {
  font-size: $font-size-md;
  line-height: $line-height-normal;
  color: $color-fg-2;
}

.updatesView_confirmButtons {
  display: flex;
  gap: $spacing-8;
  justify-content: flex-end;
  padding-top: $spacing-8;
}
</style>
