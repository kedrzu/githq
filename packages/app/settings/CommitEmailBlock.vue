<!-- The Commit email section of a repository's settings (T24, T25), a `SettingsBlock`: "For all of <owner>" (GitHub default or an address) with the note that a repository may set its own, and "For this repository" (same as the owner, GitHub default or an address) with the address a merge here commits as (`resolveCommitEmail`); under them, what it affects. Each a select — a `Menu` of `MenuRadioItem`s from a bordered trigger with a chevron, by click or the keys — offering the addresses GitHub offers for this repository. A stored address GitHub doesn't offer here stays chosen, marked amber "not offered here", and is left as it is: only a pick is asked for (`owner`, `repository`). Before GitHub's addresses are known (`settings` `null`) the selects show the stored choices, disabled, with no note of the address. On a phone (`phone`) the label, select and note of a row stack, the menus open at the bottom. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown, TriangleAlert } from 'lucide-vue-next';
import { computed, useId } from 'vue';

import Button from '@/components/Button.vue';
import Menu from '@/components/Menu.vue';
import MenuRadioGroup from '@/components/MenuRadioGroup.vue';
import MenuRadioItem from '@/components/MenuRadioItem.vue';
import type { MergeSettings } from '@/merge/getMergeMethods.js';
import { resolveCommitEmail } from '@/merge/resolveCommitEmail.js';
import type { CommitEmailChoices } from '@/tracking/TrackingStore.js';

import * as l from './CommitEmailBlock.loc.js';
import SettingsBlock from './SettingsBlock.vue';

const props = defineProps<{
  /** The repository's owner, whose default the first select sets. */
  owner: string;
  /** What is stored for the repository and its owner. */
  choices: CommitEmailChoices;
  /** What GitHub offers for the repository; `null` until its metadata is known. */
  settings: Pick<MergeSettings, 'viewerDefaultCommitEmail' | 'viewerPossibleCommitEmails'> | null;
  /** On a phone: each row's label, select and note stacked. */
  phone?: boolean;
}>();

const emit = defineEmits<{
  /** The owner's default picked: an address, `null` for GitHub's default. */
  owner: [email: string | null];
  /** The repository's default picked: an address, `null` for GitHub's default, `undefined` for the owner's. */
  repository: [email: string | null | undefined];
}>();

/** A select's value for GitHub's default, and for the owner's; an address is `email:<address>`. */
const GITHUB_DEFAULT = 'github';
const SAME_AS_OWNER = 'owner';
const EMAIL_PREFIX = 'email:';

interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly detail?: string;
}

interface SelectRow {
  readonly key: 'owner' | 'repository';
  readonly label: string;
  readonly value: string;
  /** What the trigger shows. */
  readonly valueText: string;
  readonly options: readonly SelectOption[];
  /** The stored address is one GitHub doesn't offer here. */
  readonly notOffered: boolean;
  readonly note: string | null;
}

const t = useTranslate();
const idPrefix = useId();

const rows = computed((): readonly SelectRow[] => {
  const { owner, repository } = props.choices;
  const ownerLabel = t(l.forOwner, { owner: props.owner });
  const ownerNotOffered = !isOffered(owner);
  const repositoryNotOffered = repository !== undefined && !isOffered(repository);
  return [
    {
      key: 'owner',
      label: ownerLabel,
      value: encodeEmail(owner),
      valueText: owner ?? t(l.githubDefault),
      options: [githubDefaultOption(), ...addressOptions(owner)],
      notOffered: ownerNotOffered,
      note: ownerNotOffered ? null : t(l.ownerNote),
    },
    {
      key: 'repository',
      label: t(l.forRepository),
      value: repository === undefined ? SAME_AS_OWNER : encodeEmail(repository),
      valueText:
        repository === undefined ? t(l.sameAsOwner, { owner: props.owner }) : (repository ?? t(l.githubDefault)),
      options: [
        { value: SAME_AS_OWNER, label: t(l.sameAsOwner, { owner: props.owner }) },
        githubDefaultOption(),
        ...addressOptions(repository ?? null),
      ],
      notOffered: repositoryNotOffered,
      note: resolvedNote(),
    },
  ];
});

function choose(row: SelectRow, value: string) {
  if (value === row.value) {
    return;
  }

  const email = value === GITHUB_DEFAULT ? null : value.slice(EMAIL_PREFIX.length);
  if (row.key === 'owner') {
    emit('owner', email);
  } else {
    emit('repository', value === SAME_AS_OWNER ? undefined : email);
  }
}

/** Known not to be offered: an address GitHub's list for this repository lacks. Unknown yet, or GitHub's default, never. */
function isOffered(email: string | null | undefined) {
  return !props.settings || typeof email !== 'string' || props.settings.viewerPossibleCommitEmails.includes(email);
}

function encodeEmail(email: string | null) {
  return email === null ? GITHUB_DEFAULT : `${EMAIL_PREFIX}${email}`;
}

function githubDefaultOption(): SelectOption {
  return {
    value: GITHUB_DEFAULT,
    label: t(l.githubDefault),
    detail: props.settings?.viewerDefaultCommitEmail ?? undefined,
  };
}

/** GitHub's addresses for the repository, and a stored one it doesn't offer, still chosen, after them. */
function addressOptions(stored: string | null): SelectOption[] {
  const offered = props.settings?.viewerPossibleCommitEmails ?? [];
  const options: SelectOption[] = offered.map(email => ({ value: encodeEmail(email), label: email }));
  if (stored !== null && !offered.includes(stored)) {
    options.push({ value: encodeEmail(stored), label: stored, detail: t(l.notOffered) });
  }

  return options;
}

function resolvedNote() {
  const resolved = resolveCommitEmail({ ...props.choices, settings: props.settings });
  if (!resolved) {
    return null;
  }

  return resolved.email === props.settings?.viewerDefaultCommitEmail
    ? t(l.commitsAsGithubDefault, { email: resolved.email })
    : t(l.commitsAs, { email: resolved.email });
}
</script>

<template>
  <SettingsBlock
    :title="t(l.title)"
    :description="t(l.description)"
    :phone="phone"
  >
    <div :class="[css.commitEmailBlock, phone && css.commitEmailBlock_phone]">
      <div :class="css.commitEmailBlock_rows">
        <div
          v-for="row in rows"
          :key="row.key"
          :class="css.commitEmailBlock_row"
        >
          <span
            :id="`${idPrefix}-${row.key}-label`"
            :class="css.commitEmailBlock_label"
            >{{ row.label }}</span
          >
          <Menu :label="row.label">
            <template #trigger>
              <Button
                variant="outline"
                :class="css.commitEmailBlock_select"
                :disabled="!settings"
                :aria-labelledby="`${idPrefix}-${row.key}-label ${idPrefix}-${row.key}-value`"
              >
                <span
                  :id="`${idPrefix}-${row.key}-value`"
                  :class="css.commitEmailBlock_value"
                  >{{ row.valueText }}</span
                >
                <ChevronDown
                  :class="css.commitEmailBlock_chevron"
                  aria-hidden="true"
                />
              </Button>
            </template>
            <MenuRadioGroup
              :model-value="row.value"
              @update:model-value="choose(row, $event)"
            >
              <MenuRadioItem
                v-for="option in row.options"
                :key="option.value"
                :value="option.value"
                :detail="option.detail"
              >
                {{ option.label }}
              </MenuRadioItem>
            </MenuRadioGroup>
          </Menu>
          <span
            v-if="row.notOffered || row.note"
            :class="css.commitEmailBlock_notes"
          >
            <span
              v-if="row.notOffered"
              :class="css.commitEmailBlock_notOffered"
            >
              <TriangleAlert
                :class="css.commitEmailBlock_notOfferedIcon"
                aria-hidden="true"
              />
              {{ t(l.notOffered) }}
            </span>
            <span
              v-if="row.note"
              :class="css.commitEmailBlock_note"
              >{{ row.note }}</span
            >
          </span>
        </div>
      </div>
      <p :class="css.commitEmailBlock_affects">{{ t(l.affects) }}</p>
    </div>
  </SettingsBlock>
</template>

<style lang="scss" module="css">
.commitEmailBlock {
  display: flex;
  flex-direction: column;
  gap: $spacing-16;
}

// The labels, the selects and the notes each in a column of their own, as the design lines them up.
.commitEmailBlock_rows {
  display: grid;
  grid-template-columns: max-content max-content minmax(0, 1fr);
  gap: $spacing-10 $spacing-16;
  align-items: center;
}

.commitEmailBlock_row {
  display: contents;
}

.commitEmailBlock_label {
  font-size: $font-size-md;
  color: $color-fg-2;
}

.commitEmailBlock_select {
  justify-self: start;
  max-width: 100%;
}

.commitEmailBlock_value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commitEmailBlock_chevron {
  margin-left: $spacing-4;
  color: $color-fg-dim;
}

.commitEmailBlock_notes {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
}

.commitEmailBlock_note {
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.commitEmailBlock_notOffered {
  display: inline-flex;
  gap: $spacing-4;
  align-items: center;
  padding: 0 $spacing-6;
  font-size: $font-size-xs;
  color: $color-amber;
  border: 1px solid currentcolor;
  border-radius: $radius-sm;
}

.commitEmailBlock_notOfferedIcon {
  flex: none;
  width: 12px;
  height: 12px;
}

.commitEmailBlock_affects {
  font-size: $font-size-sm;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}

// On a phone: each row's label, select and note one under another.
.commitEmailBlock_phone .commitEmailBlock_rows {
  grid-template-columns: minmax(0, 1fr);
  gap: $spacing-6;
}

.commitEmailBlock_phone .commitEmailBlock_row + .commitEmailBlock_row .commitEmailBlock_label {
  margin-top: $spacing-10;
}
</style>
