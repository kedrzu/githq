<!-- The Account section of Settings (G9): who the user is signed in as, the organisations they belong to — each one hiding its private data from githq (D14) with a way to request approval, and when they did; one that no longer hides it "Approved" when its approval was requested from here, else "No restrictions" — what this browser holds and how it refreshes, and signing out, which says plainly that it deletes the copy kept here and changes nothing on GitHub. On a phone (`phone`, mobile MB156, MB157) one column of rows: who, "Open profile on GitHub" (↗), the organisations — one hiding its private data in amber with "Request approval on GitHub" (↗) under it — the copy kept on this phone with how it refreshes and the allowance under it, and "Sign out and clear", which asks once in a sheet from below, saying what it deletes. -->
<script lang="ts" setup>
import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { ArrowUpRight, Building2, CircleCheck, HardDrive, Lock, LogOut } from 'lucide-vue-next';
import { computed, shallowRef } from 'vue';

import type { Viewer } from '@/auth/AuthStore.js';
import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import Dialog from '@/components/Dialog.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { formatBytes } from '@/utils/formatBytes.js';
import { formatCheckedAge } from '@/utils/formatCheckedAge.js';
import { formatShortDate } from '@/utils/formatShortDate.js';
import { formatTime } from '@/utils/formatTime.js';
import { getGitHubUrl } from '@/tracking/trackingRoutes.js';
import PhoneSettingsGroup from '@/settings/PhoneSettingsGroup.vue';
import PhoneSettingsRow from '@/settings/PhoneSettingsRow.vue';

import * as l from './AccountView.loc.js';

/** An organisation the user belongs to, as the section lists it. */
export interface AccountOrganization {
  readonly login: string;
  /** It hides its private repositories and projects from githq until an owner approves it (G5). */
  readonly hiddenPrivate: boolean;
  /** When the user opened GitHub's page to request its approval (epoch ms), or `null`. */
  readonly requestedAt: number | null;
}

/** The user's organisations: being asked for, GitHub not answering, or read. */
export type AccountOrganizations =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'read'; readonly organizations: readonly AccountOrganization[] };

/** What this browser keeps of the account: what is tracked, how many items, and how many bytes (`null`: unknown). */
export interface AccountCopy {
  readonly repositories: number;
  readonly projects: number;
  readonly items: number;
  readonly bytes: number | null;
}

/**
 * How the copy refreshes: in the background (`lastAt` the last success, `null` before the first), paused until the
 * API allowance resets, or waiting for a connection.
 */
export type AccountRefresh =
  | { readonly kind: 'running'; readonly lastAt: number | null }
  | { readonly kind: 'paused'; readonly until: number }
  | { readonly kind: 'offline'; readonly since: number };

const props = defineProps<{
  viewer: Viewer;
  organizations: AccountOrganizations;
  copy: AccountCopy;
  refresh: AccountRefresh;
  /** GitHub's GraphQL allowance from its last answer, or `null` before one. */
  rateLimit: GitHubRateLimit | null;
  /** The section's clock, for "last 14s ago". */
  now: number;
  /** The link to GitHub's page where an organisation's approval is requested. */
  approvalUrl: string;
  /** In a phone's Settings: one column of rows, signing out asked once. */
  phone?: boolean;
}>();

defineSlots<{
  /** More of what this browser keeps, under its facts: a switch of the web builds. */
  browser?(): unknown;
}>();

const emit = defineEmits<{
  /** The user opened GitHub's page to request the organisation's approval. */
  requestApproval: [organization: string];
  /** Ask GitHub for the organisations again. */
  retry: [];
  signOut: [];
}>();

const t = useTranslate();
const number = new Intl.NumberFormat(APP_LANGUAGE);
/** On a phone, signing out is asked once (MB157). */
const confirmingSignOut = shallowRef(false);

const organizationCount = computed(() =>
  props.organizations.kind === 'read' ? props.organizations.organizations.length : null,
);

const whoText = computed(() =>
  organizationCount.value === null
    ? t(l.signedInWith)
    : `${t(l.signedInWith)} · ${t(l.memberOf, { count: organizationCount.value })}`,
);

/** What is tracked and how many items, without the bytes. */
const copyContents = computed(() => {
  const { repositories, projects, items } = props.copy;
  return [
    `${t(l.copyRepositories, { count: repositories })}, ${t(l.copyProjects, { count: projects })}`,
    t(l.copyItems, { count: items, formatted: number.format(items) }),
  ].join(' · ');
});

const copyText = computed(() =>
  props.copy.bytes === null ? copyContents.value : `${copyContents.value} · ${formatBytes(props.copy.bytes)}`,
);

const refreshText = computed(() => {
  const { refresh } = props;
  switch (refresh.kind) {
    case 'running':
      return refresh.lastAt === null
        ? t(l.refreshNotYet)
        : t(l.refreshRunning, { age: formatCheckedAge(refresh.lastAt, props.now) });
    case 'paused':
      return t(l.refreshPaused, { time: formatTime(refresh.until) });
    case 'offline':
      return t(l.refreshOffline, { time: formatTime(refresh.since) });
    default:
      return assertNever(refresh);
  }
});

const allowanceText = computed(() => {
  const { rateLimit } = props;
  return rateLimit
    ? t(l.allowanceLeft, {
        remaining: number.format(rateLimit.remaining),
        limit: number.format(rateLimit.limit),
        time: formatTime(rateLimit.resetAt.getTime()),
      })
    : t(l.allowanceUnknown);
});

function getStanding(organization: AccountOrganization) {
  if (organization.hiddenPrivate) {
    return t(l.hiddenPhone);
  }

  return t(isApproved(organization) ? l.approved : l.noRestrictions);
}

function signOut() {
  confirmingSignOut.value = false;
  emit('signOut');
}

/** Its approval was requested from here, and it no longer hides anything: approved, as far as githq can tell. */
function isApproved(organization: AccountOrganization) {
  return !organization.hiddenPrivate && organization.requestedAt !== null;
}
</script>

<template>
  <div
    v-if="phone"
    :class="css.accountView_phone"
  >
    <section
      :class="css.accountView_phoneWho"
      :aria-label="viewer.login"
    >
      <Avatar
        :name="viewer.login"
        :src="viewer.avatarUrl"
        size="xl"
        decorative
      />
      <div :class="css.accountView_whoText">
        <h2 :class="css.accountView_login">{{ viewer.login }}</h2>
        <p :class="css.accountView_dim">{{ whoText }}</p>
      </div>
    </section>
    <PhoneSettingsRow
      :label="t(l.openProfile)"
      :href="getGitHubUrl(viewer.login)"
    />

    <PhoneSettingsGroup :title="t(l.organizations)">
      <p
        v-if="organizations.kind === 'loading'"
        :class="css.accountView_phoneNote"
      >
        {{ t(l.organizationsLoading) }}
      </p>
      <p
        v-else-if="organizations.kind === 'failed'"
        :class="css.accountView_phoneNote"
      >
        {{ t(l.organizationsFailed) }}
        <Button
          variant="link"
          @click="emit('retry')"
        >
          {{ t(l.tryAgain) }}
        </Button>
      </p>
      <p
        v-else-if="organizations.organizations.length === 0"
        :class="css.accountView_phoneNote"
      >
        {{ t(l.noOrganizations) }}
      </p>
      <ul
        v-else
        :class="css.accountView_phoneList"
      >
        <li
          v-for="organization in organizations.organizations"
          :key="organization.login"
          tid="account-organization"
        >
          <PhoneSettingsRow
            :icon="organization.hiddenPrivate ? Lock : Building2"
            :label="organization.login"
            :value="getStanding(organization)"
            :tone="organization.hiddenPrivate ? 'amber' : isApproved(organization) ? 'good' : undefined"
          />
          <div
            v-if="organization.hiddenPrivate"
            :class="css.accountView_phoneHidden"
          >
            <p :class="css.accountView_dim">
              {{ t(l.hiddenDetailPhone) }}
              <template v-if="organization.requestedAt !== null">
                {{ t(l.requestedOn, { date: formatShortDate(organization.requestedAt) }) }}
              </template>
            </p>
            <Button
              variant="secondary"
              size="lg"
              :icon="ArrowUpRight"
              :link="approvalUrl"
              target="_blank"
              :aria-label="`${t(l.requestApprovalOnGitHub)}: ${organization.login}`"
              :class="css.accountView_phoneButton"
              @click="emit('requestApproval', organization.login)"
            >
              {{ t(l.requestApprovalOnGitHub) }}
            </Button>
          </div>
        </li>
      </ul>
    </PhoneSettingsGroup>

    <PhoneSettingsGroup :title="t(l.thisPhone)">
      <PhoneSettingsRow
        :icon="HardDrive"
        :label="t(l.copy)"
        :value="copy.bytes === null ? undefined : formatBytes(copy.bytes)"
      />
      <p
        :class="css.accountView_phoneNote"
        tid="account-copy"
      >
        {{ copyContents }}. {{ refreshText }}. {{ allowanceText }}.
      </p>
    </PhoneSettingsGroup>

    <div :class="css.accountView_phoneSignOut">
      <Button
        variant="danger"
        size="lg"
        :class="css.accountView_phoneButton"
        @click="confirmingSignOut = true"
      >
        {{ t(l.signOutAndClear) }}
      </Button>
    </div>

    <Dialog
      v-model:open="confirmingSignOut"
      edge="bottom"
      :title="t(l.signOutQuestion)"
    >
      <p :class="css.accountView_phoneSheetText">{{ t(l.signOutQuestionDetail, { copy: copyText }) }}</p>
      <template #footer>
        <div :class="css.accountView_phoneSheetActions">
          <Button
            variant="danger"
            size="lg"
            :class="css.accountView_phoneButton"
            @click="signOut"
          >
            {{ t(l.signOutAndClear) }}
          </Button>
          <Button
            size="lg"
            :class="css.accountView_phoneButton"
            @click="confirmingSignOut = false"
          >
            {{ t(l.cancel) }}
          </Button>
        </div>
      </template>
    </Dialog>
  </div>
  <div
    v-else
    :class="css.accountView"
  >
    <div
      :class="css.accountView_body"
      data-route-scroll="settings-account"
    >
      <div :class="css.accountView_column">
        <section
          :class="css.accountView_who"
          :aria-label="viewer.login"
        >
          <Avatar
            :name="viewer.login"
            :src="viewer.avatarUrl"
            size="xl"
            decorative
          />
          <div :class="css.accountView_whoText">
            <h2 :class="css.accountView_login">{{ viewer.login }}</h2>
            <p :class="css.accountView_dim">{{ whoText }}</p>
          </div>
          <Button
            variant="secondary"
            :icon="ArrowUpRight"
            :link="getGitHubUrl(viewer.login)"
            target="_blank"
          >
            {{ t(l.openProfile) }}
          </Button>
        </section>

        <section
          :class="css.accountView_section"
          :aria-labelledby="'account-organizations'"
        >
          <h2
            id="account-organizations"
            :class="css.accountView_heading"
          >
            {{ t(l.organizations) }}
          </h2>
          <p
            v-if="organizations.kind === 'loading'"
            :class="css.accountView_note"
          >
            {{ t(l.organizationsLoading) }}
          </p>
          <p
            v-else-if="organizations.kind === 'failed'"
            :class="css.accountView_note"
          >
            {{ t(l.organizationsFailed) }}
            <Button
              variant="link"
              @click="emit('retry')"
            >
              {{ t(l.tryAgain) }}
            </Button>
          </p>
          <p
            v-else-if="organizations.organizations.length === 0"
            :class="css.accountView_note"
          >
            {{ t(l.noOrganizations) }}
          </p>
          <ul
            v-else
            :class="css.accountView_box"
          >
            <li
              v-for="organization in organizations.organizations"
              :key="organization.login"
              :class="css.accountView_organization"
              tid="account-organization"
            >
              <component
                :is="organization.hiddenPrivate ? Lock : CircleCheck"
                :class="[
                  css.accountView_icon,
                  organization.hiddenPrivate && css.accountView_icon_warning,
                  isApproved(organization) && css.accountView_icon_good,
                ]"
                aria-hidden="true"
              />
              <div :class="css.accountView_organizationText">
                <p>
                  <span :class="css.accountView_organizationName">{{ organization.login }}</span>
                  <span
                    v-if="organization.hiddenPrivate"
                    :class="css.accountView_warning"
                    >{{ t(l.hidden) }}</span
                  >
                  <span
                    v-else-if="isApproved(organization)"
                    :class="css.accountView_good"
                    >{{ t(l.approved) }}</span
                  >
                  <span
                    v-else
                    :class="css.accountView_dim"
                    >{{ t(l.noRestrictions) }}</span
                  >
                </p>
                <p
                  v-if="organization.hiddenPrivate"
                  :class="css.accountView_dim"
                >
                  {{ t(l.hiddenDetail) }}
                  <template v-if="organization.requestedAt !== null">
                    {{ t(l.requestedOn, { date: formatShortDate(organization.requestedAt) }) }}
                  </template>
                </p>
              </div>
              <Button
                v-if="organization.hiddenPrivate"
                variant="secondary"
                :icon="ArrowUpRight"
                :link="approvalUrl"
                target="_blank"
                :aria-label="`${t(l.requestApproval)}: ${organization.login}`"
                @click="emit('requestApproval', organization.login)"
              >
                {{ t(l.requestApproval) }}
              </Button>
            </li>
          </ul>
        </section>

        <section
          :class="css.accountView_section"
          aria-labelledby="account-browser"
        >
          <h2
            id="account-browser"
            :class="css.accountView_heading"
          >
            {{ t(l.thisBrowser) }}
          </h2>
          <dl :class="css.accountView_box">
            <div :class="css.accountView_fact">
              <dt>{{ t(l.copy) }}</dt>
              <dd tid="account-copy">{{ copyText }}</dd>
            </div>
            <div :class="css.accountView_fact">
              <dt>{{ t(l.refresh) }}</dt>
              <dd tid="account-refresh">{{ refreshText }}</dd>
            </div>
            <div :class="css.accountView_fact">
              <dt>{{ t(l.allowance) }}</dt>
              <dd tid="account-allowance">{{ allowanceText }}</dd>
            </div>
          </dl>
          <slot name="browser" />
        </section>

        <section
          :class="css.accountView_signOut"
          aria-labelledby="account-sign-out"
        >
          <div :class="css.accountView_signOutText">
            <h2
              id="account-sign-out"
              :class="css.accountView_signOutTitle"
            >
              {{ t(l.signOut) }}
            </h2>
            <p :class="css.accountView_signOutDetail">{{ t(l.signOutDetail) }}</p>
          </div>
          <Button
            variant="danger"
            :icon="LogOut"
            @click="emit('signOut')"
          >
            {{ t(l.signOutAndClear) }}
          </Button>
        </section>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.accountView_phone {
  display: flex;
  flex-direction: column;
}

.accountView_phoneWho {
  display: flex;
  gap: $spacing-12;
  align-items: center;
  padding: $spacing-16 $spacing-16 $spacing-8;
}

.accountView_phoneList {
  padding: 0;
  margin: 0;
  list-style: none;
}

.accountView_phoneHidden {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding: 0 $spacing-16 $spacing-8;
}

.accountView_phoneNote {
  padding: $spacing-4 $spacing-16 0;
  font-size: $font-size-md;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}

// A phone's screen action (`lg`), the width of the screen's column.
.accountView_phoneButton {
  width: 100%;
}

.accountView_phoneSignOut {
  padding: $spacing-16;
}

.accountView_phoneSheetText {
  font-size: $font-size-lg;
  line-height: $line-height-normal;
  color: $color-fg-2;
}

.accountView_phoneSheetActions {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-8;
}

.accountView {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.accountView_body {
  flex: 1;
  min-height: 0;
  padding: $spacing-32 $spacing-20;
  overflow-y: auto;
}

.accountView_column {
  @include settings-screen-column;

  gap: 28px;
}

.accountView_who {
  display: flex;
  gap: 14px;
  align-items: center;
}

.accountView_whoText {
  flex: 1;
  min-width: 0;
}

.accountView_login {
  font-size: 16px;
  font-weight: $font-weight-semibold;
}

.accountView_section {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
}

.accountView_heading {
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
}

.accountView_note {
  font-size: $font-size-md;
  color: $color-fg-dim;
}

.accountView_box {
  padding: 0;
  margin: 0;
  list-style: none;
  border: 1px solid $color-border;
  border-radius: $radius-lg;

  > * + * {
    border-top: 1px solid $color-border;
  }
}

.accountView_organization {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  padding: $spacing-12 14px;
  font-size: $font-size-md;
}

.accountView_organizationText {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-2;
  min-width: 0;
}

.accountView_organizationName {
  margin-right: $spacing-8;
  color: $color-fg;
}

.accountView_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.accountView_icon_warning {
  color: $color-amber;
}

.accountView_warning {
  color: $color-amber;
}

.accountView_icon_good,
.accountView_good {
  color: $color-green;
}

.accountView_dim {
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.accountView_fact {
  display: flex;
  gap: $spacing-12;
  padding: $spacing-10 14px;
  font-size: $font-size-md;

  dt {
    flex: none;
    width: 170px;
    color: $color-fg-dim;
  }

  dd {
    margin: 0;
    color: $color-fg;
  }
}

.accountView_signOut {
  display: flex;
  gap: $spacing-16;
  align-items: center;
  padding: $spacing-16;
  border: 1px solid $color-border-danger;
  border-radius: $radius-lg;
}

.accountView_signOutText {
  flex: 1;
  min-width: 0;
}

.accountView_signOutTitle {
  margin-bottom: $spacing-4;
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
}

.accountView_signOutDetail {
  font-size: $font-size-sm;
  line-height: 20px;
  color: $color-fg-2;
}
</style>
