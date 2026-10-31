<!-- `/settings` (G9): the account page, with the organisations read from GitHub when it opens (once a session, as the tracking screens read them), the approval requests githq remembers, what this browser keeps of the account and how big it is, how it refreshes, and signing out. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, onMounted, shallowRef } from 'vue';

import { AuthStore } from '@/auth/AuthStore.js';
import { Browser } from '@/services/Browser.js';
import { useNow } from '@/services/useNow.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import { ApprovalRequests } from '@/tracking/ApprovalRequests.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { getApprovalUrl } from '@/tracking/utils/getApprovalUrl.js';

import AccountView from './AccountView.vue';
import type { AccountCopy, AccountOrganizations, AccountRefresh } from './AccountView.vue';

/** How often "last 14s ago" moves on. */
const TICK_MS = 1000;

const auth = useService(AuthStore);
const tracking = useService(TrackingStore);
const approvals = useService(ApprovalRequests);
const items = useService(ItemStore);
const sync = useService(SyncEngine);
const rateLimits = useService(GitHubRateLimitStore);
const browser = useService(Browser);

const now = useNow(TICK_MS);
const failed = shallowRef(false);
const bytes = shallowRef<number | null>(null);

const organizations = computed((): AccountOrganizations => {
  const candidates = tracking.candidates;
  if (!candidates) {
    return failed.value ? { kind: 'failed' } : { kind: 'loading' };
  }

  return {
    kind: 'read',
    organizations: candidates.organizations.map(organization => ({
      login: organization.login,
      hiddenPrivate: organization.hiddenPrivate,
      requestedAt: approvals.getRequestedAt(organization.login),
    })),
  };
});

const copy = computed((): AccountCopy => ({
  repositories: tracking.repositories.length,
  projects: tracking.projects.length,
  items: items.all.length,
  bytes: bytes.value,
}));

const refresh = computed((): AccountRefresh => {
  const notice = sync.notice;
  switch (notice?.kind) {
    case 'offline':
      return { kind: 'offline', since: notice.since };
    case 'paused':
      return { kind: 'paused', until: notice.until };
    default:
      return { kind: 'running', lastAt: items.getSyncState('myWork').lastSuccessAt };
  }
});

onMounted(() => {
  void loadOrganizations();
  void browser.estimateStorage().then(estimate => (bytes.value = estimate));
});

async function loadOrganizations() {
  failed.value = false;
  failed.value = (await tracking.loadCandidates()) === null;
}
</script>

<template>
  <AccountView
    v-if="auth.viewer"
    :viewer="auth.viewer"
    :organizations="organizations"
    :copy="copy"
    :refresh="refresh"
    :rate-limit="rateLimits.get('graphql')"
    :now="now"
    :approval-url="getApprovalUrl(browser.origin)"
    @request-approval="approvals.record"
    @retry="loadOrganizations"
    @sign-out="auth.signOut()"
  />
</template>
