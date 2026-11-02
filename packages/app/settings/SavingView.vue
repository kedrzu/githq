<!-- The Saving to GitHub section of Settings (settings-sync T3–T8). Off (T3): the choice; ticking it asks GitHub first — with no repository it is created and saving goes on, with one already there what combining would change is shown (T6) and nothing happens until "Combine and turn on" (`⌘↵`), Cancel (`Esc`) leaving both sides as they were; a repository that can't be used says why under the choice, which stays off. On (T4): the repository, when this device last synced, what is saved, turning off with no question, and where the repository is removed. Just turned off (T5): the choice again, and that the repository is still there. Stopped (T7): why, trying again (`R`), and turning off. -->
<script lang="ts">
import type { StoppedReason } from './sync/SettingsSaving.js';

/** A repository or project combining would untrack here, with how many of its items this device keeps. */
export interface SavingUntracked {
  readonly name: string;
  /** `null`: not known. */
  readonly items: number | null;
}

/** What combining this device's settings with the ones found changes (T6), by name. */
export interface SavingCombining {
  readonly download: readonly string[];
  readonly saved: readonly string[];
  readonly untracked: readonly SavingUntracked[];
}

/**
 * Where turning saving on is: not started; GitHub being asked, or the repository created; a repository found, its
 * changes waiting for the user's word (T6); a repository that can't be used, saving still off; GitHub out of reach.
 */
export type SavingConnect =
  | { readonly kind: 'idle' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'found'; readonly combining: SavingCombining }
  | { readonly kind: 'unusable'; readonly reason: StoppedReason }
  | { readonly kind: 'unreachable' };
</script>

<script lang="ts" setup>
import { SETTINGS_REPOSITORY_NAME } from '@githq/github/settings/getSettingsRepository.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowUp, ArrowUpRight, CircleCheck, Plus, TriangleAlert } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { formatTimeAgo } from '@/utils/formatTimeAgo.js';

import SavingChoice from './SavingChoice.vue';
import SavingStopped from './SavingStopped.vue';
import type { SettingsSaving } from './sync/SettingsSaving.js';
import * as l from './SavingView.loc.js';

/** The key of "Combine and turn on". */
const COMBINE_KEY = 'Mod+Enter';

/** One group of what combining changes (T6). */
interface CombiningGroup {
  readonly key: string;
  readonly icon: LucideIcon;
  readonly warning: boolean;
  readonly head: string;
  readonly items: string;
}

const props = defineProps<{
  /** The signed-in user's login: the settings repository's owner. */
  login: string;
  saving: SettingsSaving;
  connect: SavingConnect;
  /** How many repositories and projects are tracked, which is what is saved. */
  repositories: number;
  projects: number;
  /** The section's clock, for "2 minutes ago". */
  now: number;
  /** The box ticked: ask GitHub, and turn on when nothing is there. */
  turnOn: () => Promise<unknown>;
  /** "Combine and turn on" (T6). */
  combine: () => Promise<unknown>;
  /** "Try again" after syncing stopped. */
  retry: () => Promise<unknown>;
}>();

const emit = defineEmits<{
  /** Combining declined (T6): nothing changes. */
  cancel: [];
  turnOff: [];
  /** The file comes from a newer githq: load the page again. */
  reload: [];
}>();

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);
const combining = ref(false);

const repository = computed(() => `${props.login}/${SETTINGS_REPOSITORY_NAME}`);
const repositoryUrl = computed(() => `https://github.com/${repository.value}`);

const ticked = computed({
  get: () => props.connect.kind === 'busy' || props.connect.kind === 'found',
  set: value => {
    if (value) {
      void props.turnOn();
    } else if (props.connect.kind === 'found') {
      cancel();
    }
  },
});

const syncedAt = computed(() => {
  const { saving } = props;
  return saving.state === 'off' ? null : (saving.syncedAt ?? null);
});

const syncedText = computed(() => (syncedAt.value === null ? t(l.notYet) : formatTimeAgo(syncedAt.value, props.now)));

const savedText = computed(() =>
  t(l.savedValue, {
    repositories: t(l.repositories, { count: props.repositories }),
    projects: t(l.projects, { count: props.projects }),
  }),
);

const combiningGroups = computed((): CombiningGroup[] => {
  if (props.connect.kind !== 'found') {
    return [];
  }

  const { download, saved, untracked } = props.connect.combining;
  const groups: CombiningGroup[] = [];
  if (download.length > 0) {
    groups.push({
      key: 'download',
      icon: Plus,
      warning: false,
      head: t(l.download, { count: download.length }),
      items: download.join(', '),
    });
  }

  if (saved.length > 0) {
    groups.push({
      key: 'saved',
      icon: ArrowUp,
      warning: false,
      head: t(l.addedToSaved, { count: saved.length }),
      items: saved.join(', '),
    });
  }

  if (untracked.length > 0) {
    groups.push({
      key: 'untracked',
      icon: TriangleAlert,
      warning: true,
      head: t(l.untracked, { count: untracked.length }),
      items: untracked.map(formatUntracked).join(', '),
    });
  }

  return groups;
});

useCommands(() => {
  if (props.saving.state !== 'off') {
    return [{ id: 'settings.saving.turnOff', title: t(l.turnOffTitle), section: 'view', run: turnOff }];
  }

  // What combining changes (T6) is shown only while saving is off.
  return props.connect.kind === 'found'
    ? [
        { id: 'settings.saving.combine', title: t(l.combine), section: 'view', key: COMBINE_KEY, run: runCombine },
        { id: 'settings.saving.cancel', title: t(l.cancel), section: 'view', key: 'Escape', run: cancel },
      ]
    : [];
});

function formatUntracked(entry: SavingUntracked) {
  return entry.items === null
    ? entry.name
    : `${entry.name} · ${t(l.items, { count: entry.items, formatted: numbers.format(entry.items) })}`;
}

function runCombine() {
  void combineAndTurnOn();
}

async function combineAndTurnOn() {
  if (combining.value) {
    return;
  }

  combining.value = true;
  try {
    await props.combine();
  } finally {
    combining.value = false;
  }
}

function cancel() {
  if (!combining.value) {
    emit('cancel');
  }
}

function turnOff() {
  emit('turnOff');
}
</script>

<template>
  <div :class="css.savingView">
    <div :class="css.savingView_column">
      <template v-if="saving.state === 'off'">
        <div :class="css.savingView_box">
          <SavingChoice
            v-model="ticked"
            :busy="connect.kind === 'busy'"
            :disabled="combining"
          />
        </div>

        <section
          v-if="connect.kind === 'found'"
          :class="[css.savingView_box, css.savingView_combining]"
          aria-labelledby="saving-combine"
        >
          <h2
            id="saving-combine"
            :class="css.savingView_title"
          >
            {{ t(l.combineTitle, { repository }) }}
          </h2>
          <div
            v-for="group in combiningGroups"
            :key="group.key"
            :class="css.savingView_change"
            :tid="`saving-${group.key}`"
          >
            <component
              :is="group.icon"
              :class="[css.savingView_changeIcon, group.warning && css.savingView_changeIcon_warning]"
              aria-hidden="true"
            />
            <div :class="css.savingView_changeText">
              <p>{{ group.head }}</p>
              <p :class="css.savingView_changeItems">{{ group.items }}</p>
            </div>
          </div>
          <div :class="css.savingView_actions">
            <Button
              variant="primary"
              :aria-keyshortcuts="formatAriaKeyShortcuts(COMBINE_KEY)"
              :busy="combining"
              @click="combineAndTurnOn"
            >
              {{ t(l.combine) }}
            </Button>
            <Button
              kbd="Escape"
              aria-keyshortcuts="Escape"
              :disabled="combining"
              @click="cancel"
            >
              {{ t(l.cancel) }}
            </Button>
          </div>
        </section>

        <SavingStopped
          v-else-if="connect.kind === 'unusable'"
          :reason="connect.reason"
          :login="login"
          :retry="turnOn"
          @reload="emit('reload')"
        />

        <p
          v-else-if="connect.kind === 'unreachable'"
          :class="css.savingView_note"
        >
          {{ t(l.unreachable) }}
        </p>

        <div
          v-else-if="saving.repositoryLeft"
          :class="css.savingView_left"
        >
          <p :class="css.savingView_turnedOff">{{ t(l.turnedOff, { repository }) }}</p>
          <div :class="css.savingView_removing">
            <p>{{ t(l.removing) }}</p>
            <a
              :class="css.savingView_link"
              :href="`${repositoryUrl}/settings`"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ t(l.repositorySettings) }}
              <ArrowUpRight
                :class="css.savingView_linkIcon"
                aria-hidden="true"
              />
            </a>
          </div>
        </div>
      </template>

      <template v-else>
        <p
          v-if="saving.state === 'on'"
          :class="css.savingView_on"
        >
          <CircleCheck
            :class="css.savingView_onIcon"
            aria-hidden="true"
          />
          {{ t(l.on) }}
        </p>
        <SavingStopped
          v-else
          :reason="saving.reason"
          :login="login"
          :retry="retry"
          @reload="emit('reload')"
        />

        <dl :class="css.savingView_facts">
          <div :class="css.savingView_fact">
            <dt>{{ t(l.repository) }}</dt>
            <dd v-if="saving.state === 'on'">
              <a
                :class="css.savingView_link"
                :href="repositoryUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ repository }}
                <ArrowUpRight
                  :class="css.savingView_linkIcon"
                  aria-hidden="true"
                />
              </a>
              <span :class="css.savingView_tag">{{ t(l.private) }}</span>
            </dd>
            <dd v-else>{{ repository }}</dd>
          </div>
          <div :class="css.savingView_fact">
            <dt>{{ t(l.lastSynced) }}</dt>
            <dd tid="saving-synced">{{ syncedText }}</dd>
          </div>
          <div
            v-if="saving.state === 'on'"
            :class="css.savingView_fact"
          >
            <dt>{{ t(l.saved) }}</dt>
            <dd>{{ savedText }}</dd>
          </div>
        </dl>

        <section
          :class="[css.savingView_box, css.savingView_turnOff]"
          aria-labelledby="saving-turn-off"
        >
          <div :class="css.savingView_turnOffText">
            <h2
              id="saving-turn-off"
              :class="css.savingView_title"
            >
              {{ t(l.turnOffTitle) }}
            </h2>
            <p :class="css.savingView_detail">{{ t(l.turnOffDetail) }}</p>
          </div>
          <Button @click="turnOff">{{ t(l.turnOff) }}</Button>
        </section>

        <div
          v-if="saving.state === 'on'"
          :class="css.savingView_removing"
        >
          <p>{{ t(l.removing) }}</p>
          <a
            :class="css.savingView_link"
            :href="`${repositoryUrl}/settings`"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t(l.repositorySettings) }}
            <ArrowUpRight
              :class="css.savingView_linkIcon"
              aria-hidden="true"
            />
          </a>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.savingView {
  flex: 1;
  min-height: 0;
  padding: 32px 20px;
  overflow-y: auto;
}

.savingView_column {
  display: flex;
  flex-direction: column;
  gap: 28px;
  max-width: 680px;
  margin: 0 auto;
}

.savingView_box {
  padding: 14px $spacing-16;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
}

.savingView_title {
  font-size: 13.5px;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.savingView_combining {
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-color: $color-border-2;
}

.savingView_change {
  display: flex;
  gap: $spacing-10;
  font-size: $font-size-md;
  line-height: 1.45;
  color: $color-fg;
}

.savingView_changeIcon {
  flex: none;
  width: 14px;
  height: 14px;
  margin-top: 3px;
  color: $color-fg-2;
}

.savingView_changeIcon_warning {
  color: $color-amber;
}

.savingView_changeText {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.savingView_changeItems {
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.savingView_actions {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding-top: $spacing-2;
}

.savingView_note {
  font-size: $font-size-md;
  line-height: 1.5;
  color: $color-fg-2;
}

.savingView_left {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
}

.savingView_turnedOff {
  font-size: $font-size-md;
  line-height: 1.5;
  color: $color-fg;
}

.savingView_on {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  font-size: 13.5px;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.savingView_onIcon {
  flex: none;
  width: 15px;
  height: 15px;
  color: $color-green;
}

.savingView_facts {
  margin: 0;
  border: 1px solid $color-border;
  border-radius: $radius-lg;

  > * + * {
    border-top: 1px solid $color-border;
  }
}

.savingView_fact {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  padding: 11px 14px;
  font-size: $font-size-sm;
  line-height: 15px;

  dt {
    flex: none;
    width: 160px;
    color: $color-fg-dim;
  }

  dd {
    display: flex;
    gap: $spacing-10;
    align-items: center;
    min-width: 0;
    margin: 0;
    color: $color-fg;
  }
}

.savingView_link {
  @include focus-ring;

  display: inline-flex;
  gap: 5px;
  align-items: center;
  color: $color-accent;
  text-decoration: none;
  border-radius: $radius-sm;

  &:hover {
    text-decoration: underline;
  }
}

.savingView_linkIcon {
  flex: none;
  width: 13px;
  height: 13px;
}

.savingView_tag {
  padding: 0 $spacing-6;
  font-size: 11px;
  line-height: 15px;
  color: $color-fg-dim;
  border: 1px solid $color-border-2;
  border-radius: $radius-sm;
}

.savingView_turnOff {
  display: flex;
  gap: 14px;
  align-items: center;
}

.savingView_turnOffText {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-4;
  min-width: 0;
}

.savingView_detail {
  font-size: $font-size-sm;
  line-height: 1.5;
  color: $color-fg-2;
}

.savingView_removing {
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: flex-start;
  padding: 0 $spacing-2;
  font-size: $font-size-sm;
  line-height: 1.5;
  color: $color-fg-dim;
}
</style>
