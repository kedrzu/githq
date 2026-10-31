<!-- The account page (G9), from the account menu or ⌘K: who the user is signed in as, the organisations they belong to — each one hiding its private data from githq (D14) with a way to request approval, and when they did; one that no longer hides it "Approved" when its approval was requested from here, else "No restrictions" — what this browser holds and how it refreshes, and signing out, which says plainly that it deletes the copy kept here and changes nothing on GitHub. -->
<script lang="ts" setup>
import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { ArrowUpRight, CircleCheck, Lock, LogOut } from 'lucide-vue-next';
import { computed } from 'vue';

import type { Viewer } from '@/auth/AuthStore.js';
import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { formatCheckedAge } from '@/utils/formatCheckedAge.js';
import { formatShortDate } from '@/utils/formatShortDate.js';
import { formatTime } from '@/utils/formatTime.js';

import * as l from './AccountView.loc.js';

/** An organisation the user belongs to, as the page lists it. */
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
  /** The page's clock, for "last 14s ago". */
  now: number;
  /** The link to GitHub's page where an organisation's approval is requested. */
  approvalUrl: string;
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
const megabytes = new Intl.NumberFormat(APP_LANGUAGE, {
  style: 'unit',
  unit: 'megabyte',
  maximumFractionDigits: 1,
});
const kilobytes = new Intl.NumberFormat(APP_LANGUAGE, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 0 });

const organizationCount = computed(() =>
  props.organizations.kind === 'read' ? props.organizations.organizations.length : null,
);

const whoText = computed(() =>
  organizationCount.value === null
    ? t(l.signedInWith)
    : `${t(l.signedInWith)} · ${t(l.memberOf, { count: organizationCount.value })}`,
);

const copyText = computed(() => {
  const { repositories, projects, items, bytes } = props.copy;
  const parts = [
    `${t(l.copyRepositories, { count: repositories })}, ${t(l.copyProjects, { count: projects })}`,
    t(l.copyItems, { count: items, formatted: number.format(items) }),
  ];
  if (bytes !== null) {
    parts.push(formatBytes(bytes));
  }

  return parts.join(' · ');
});

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

/** Its approval was requested from here, and it no longer hides anything: approved, as far as githq can tell. */
function isApproved(organization: AccountOrganization) {
  return !organization.hiddenPrivate && organization.requestedAt !== null;
}

function formatBytes(bytes: number) {
  return bytes >= 1_000_000 ? megabytes.format(bytes / 1_000_000) : kilobytes.format(bytes / 1000);
}
</script>

<template>
  <div :class="css.accountView">
    <header :class="css.accountView_header">
      <h1 :class="css.accountView_title">{{ t(l.title) }}</h1>
    </header>
    <div :class="css.accountView_body">
      <div :class="css.accountView_column">
        <section
          :class="css.accountView_who"
          :aria-label="viewer.login"
        >
          <Avatar
            :name="viewer.login"
            :src="viewer.avatarUrl"
            size="lg"
            decorative
          />
          <div :class="css.accountView_whoText">
            <h2 :class="css.accountView_login">{{ viewer.login }}</h2>
            <p :class="css.accountView_dim">{{ whoText }}</p>
          </div>
          <Button
            variant="secondary"
            :icon="ArrowUpRight"
            :link="`https://github.com/${viewer.login}`"
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
                size="sm"
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
.accountView {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.accountView_header {
  display: flex;
  flex: none;
  align-items: center;
  height: $list-header-height;
  padding: 0 20px;
  border-bottom: 1px solid $color-border;
}

.accountView_title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
}

.accountView_body {
  flex: 1;
  min-height: 0;
  padding: 36px 20px;
  overflow-y: auto;
}

.accountView_column {
  display: flex;
  flex-direction: column;
  gap: 28px;
  max-width: 680px;
  margin: 0 auto;
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
  border: 1px solid rgba($color-red, 0.35);
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
