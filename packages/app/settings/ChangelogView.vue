<!-- The changelog, a block of Settings' Updates section under the version and the stream, in the desktop app only (desktop releases D17, D20, U41–U48): every version a fold of its own, newest first, the first open and the rest collapsed, each opening by itself (↑↓ and Space, or the mouse), with "New" on what the user didn't have before this update and "Running" on what is installed. A Stable version shows its release as GitHub rendered it (`GitHubHtml`); a Development build has one fold for everything since the last Stable, filtered as release notes are, whose pull requests open in githq (`GitHubLinks`, as links to GitHub's HTML do). No versions yet (U45), quiet lines while they load (U46), waiting for the connection (U47), and a failure (U48). `O` opens the same on GitHub: on a Development build its commits once they show or failed to load, else the releases; offline nothing can open, so nothing is offered. Its title, the keys and that button are the block's head row; the Updates page scrolls it. -->
<script lang="ts">
/** What the section has to show. */
export type ChangelogContent =
  | { readonly kind: 'loading' | 'offline' | 'failed' }
  /** No version at all: the first Stable to come (U45). */
  | { readonly kind: 'none'; readonly firstVersion: string }
  | { readonly kind: 'versions'; readonly versions: readonly ChangelogVersion[] };

/** A whole-section message (none, offline, failed) as `EmptyState` draws it. */
interface SectionMessage {
  icon: LucideIcon;
  tone: 'muted' | 'warning';
  title: string;
  detail: string;
  fact: string | undefined;
}
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import { ArrowUpRight, Check, ChevronDown, ChevronRight, Info, TriangleAlert, WifiOff } from 'lucide-vue-next';
import { computed, reactive, ref, useId, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';

import { bindCommand } from '@/commands/bindCommand.js';
import { openOnGitHub } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import EmptyState from '@/components/EmptyState.vue';
import Kbd from '@/components/Kbd.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import GitHubHtml from '@/item/GitHubHtml.vue';
import type { ChangeGroupKind } from '@/scripts/releasePlan.js';

import { RELEASES_URL } from '@/landing/landingLinks.js';
import { getGitHubLinkTarget, GITHQ_LINK_ATTRIBUTE } from '@/shell/gitHubLinks.js';
import GitHubLinks from '@/shell/GitHubLinks.vue';

import { getPullRequestUrl } from './buildChangelog.js';
import type { ChangelogDevelopment, ChangelogVersion } from './buildChangelog.js';
import * as l from './ChangelogView.loc.js';

/** The lengths of the quiet lines that hold the place (U46), as drawn. */
const LOADING_LINES = [120, 560, 500, 200, 420, 380, 460];
const GROUP_TITLES = {
  breaking: l.breaking,
  features: l.features,
  fixes: l.fixes,
  performance: l.performance,
} satisfies Record<ChangeGroupKind, unknown>;
const DATES = new Intl.DateTimeFormat(APP_LANGUAGE, { dateStyle: 'long' });

const props = defineProps<{
  content: ChangelogContent;
  /** A Development build's commits on GitHub; `null` on a Stable version. */
  commitsUrl: string | null;
}>();

const emit = defineEmits<{
  /** Opens a page of GitHub outside the app. */
  openOnGitHub: [url: string];
}>();

const t = useTranslate();
const router = useRouter();
const id = useId();
const list = useTemplateRef<HTMLElement>('list');

const versions = computed(() => (props.content.kind === 'versions' ? props.content.versions : []));
const showsCommits = computed(
  () => (props.content.kind === 'versions' || props.content.kind === 'failed') && props.commitsUrl !== null,
);
const gitHubUrl = computed(() => (showsCommits.value && props.commitsUrl) || RELEASES_URL);
const gitHubLabel = computed(() => t(showsCommits.value ? l.allCommits : l.allReleases));
const hasGitHubLink = computed(() => props.content.kind !== 'offline');
const message = computed((): SectionMessage | null => {
  const { content } = props;
  switch (content.kind) {
    case 'none':
      return {
        icon: Info,
        tone: 'muted',
        title: t(l.noneTitle),
        detail: t(l.noneDetail, { version: content.firstVersion }),
        fact: t(l.noneFact, { version: content.firstVersion }),
      };
    case 'offline':
      return { icon: WifiOff, tone: 'warning', title: t(l.offlineTitle), detail: t(l.offlineDetail), fact: undefined };
    case 'failed':
      return {
        icon: TriangleAlert,
        tone: 'warning',
        title: t(l.failedTitle),
        detail: t(l.failedDetail),
        fact: undefined,
      };
    default:
      return null;
  }
});

/** The folds the user opened or closed; the rest are as they start. */
const toggled = reactive(new Map<string, boolean>());
/** The fold the keys are on; `-1` until they first move. */
const current = ref(-1);

useCommands(() => [
  ...(hasGitHubLink.value
    ? [bindCommand(openOnGitHub, { place: 'changelog', section: 'view', run: openGitHubLink }, t)]
    : []),
  ...(versions.value.length > 0
    ? [
        {
          id: 'changelog.next',
          title: t(l.moveDown),
          section: 'view' as const,
          key: 'ArrowDown',
          menu: false,
          run: () => move(1),
        },
        {
          id: 'changelog.previous',
          title: t(l.moveUp),
          section: 'view' as const,
          key: 'ArrowUp',
          menu: false,
          run: () => move(-1),
        },
        {
          id: 'changelog.toggle',
          title: t(l.openOrClose),
          section: 'view' as const,
          key: 'Space',
          menu: false,
          // Space on another control is that control's.
          when: () => !isOtherControlFocused(),
          run: toggleCurrent,
        },
      ]
    : []),
]);

function getKey(version: ChangelogVersion) {
  return version.kind === 'development' ? 'development' : version.version;
}

function isOpen(version: ChangelogVersion, index: number) {
  return toggled.get(getKey(version)) ?? index === 0;
}

function toggle(version: ChangelogVersion, index: number) {
  toggled.set(getKey(version), !isOpen(version, index));
}

function toggleCurrent() {
  const index = Math.max(current.value, 0);
  const version = versions.value[index];
  if (version) {
    toggle(version, index);
    focusHead(index);
  }
}

function move(by: number) {
  const next = current.value === -1 ? 0 : current.value + by;
  if (next >= 0 && next < versions.value.length) {
    focusHead(next);
  }
}

function getHeads() {
  return Array.from(list.value?.querySelectorAll<HTMLElement>('[data-changelog-head]') ?? []);
}

function focusHead(index: number) {
  current.value = index;
  getHeads()[index]?.focus();
}

function isOtherControlFocused() {
  const { activeElement } = document;
  return (
    activeElement instanceof HTMLElement &&
    activeElement.matches('a, button') &&
    !activeElement.matches('[data-changelog-head]')
  );
}

function openGitHubLink() {
  emit('openOnGitHub', gitHubUrl.value);
}

/** A pull request's link: githq's path, marked with GitHub's address, or GitHub's address in a new tab. */
function getPullRequestLink(number: number) {
  const url = getPullRequestUrl(number);
  // A pull request is never a workflow, the one address that depends on what is tracked.
  const target = getGitHubLinkTarget(url, { router, isTracked: () => true });
  return target
    ? { href: target.path, [GITHQ_LINK_ATTRIBUTE]: url }
    : { href: url, target: '_blank', rel: 'noopener noreferrer' };
}

function getCountLine({ groups, commits, limited }: ChangelogDevelopment) {
  const changes = groups.reduce((sum, group) => sum + group.changes.length, 0);
  return t(l.noticedSentence, {
    changes: t(l.noticedChanges, { count: changes }),
    commits: t(limited ? l.inNewestCommits : l.outOfCommits, { count: commits }),
  });
}
</script>

<template>
  <section :class="css.changelogView">
    <div :class="css.changelogView_head">
      <h2 :class="css.changelogView_title">{{ t(l.title) }}</h2>
      <span :class="css.changelogView_hint">
        <Kbd keys="ArrowUp ArrowDown" />
        {{ t(l.move) }}
      </span>
      <span :class="css.changelogView_hint">
        <Kbd keys="Space" />
        {{ t(l.openOrClose) }}
      </span>
      <Button
        v-if="hasGitHubLink"
        variant="secondary"
        size="sm"
        :icon="ArrowUpRight"
        :kbd="keyOf(openOnGitHub)"
        :keyshortcuts="keyOf(openOnGitHub)"
        @click="openGitHubLink"
      >
        {{ gitHubLabel }}
      </Button>
    </div>
    <div
      v-if="content.kind === 'loading'"
      :class="css.changelogView_loading"
      aria-hidden="true"
    >
      <span
        v-for="(width, index) in LOADING_LINES"
        :key="index"
        :class="css.changelogView_loadingLine"
        :style="{ width: `${width}px` }"
      />
    </div>
    <EmptyState
      v-else-if="message"
      :icon="message.icon"
      :tone="message.tone"
      :title="message.title"
      :detail="message.detail"
      :fact="message.fact"
      role="status"
    />
    <ul
      v-else
      ref="list"
      :class="css.changelogView_list"
    >
      <li
        v-for="(version, index) in versions"
        :key="getKey(version)"
        :class="css.changelogView_fold"
      >
        <h3 :class="css.changelogView_heading">
          <button
            type="button"
            :class="css.changelogView_head"
            :aria-expanded="isOpen(version, index)"
            :aria-controls="`${id}-${index}`"
            data-changelog-head
            @click="toggle(version, index)"
            @focus="current = index"
          >
            <component
              :is="isOpen(version, index) ? ChevronDown : ChevronRight"
              :class="css.changelogView_chevron"
              aria-hidden="true"
            />
            <template v-if="version.kind === 'release'">
              <span :class="css.changelogView_version">{{ t(l.version, { version: version.version }) }}</span>
              <span :class="css.changelogView_date">{{ DATES.format(new Date(version.publishedAt)) }}</span>
              <span
                v-if="version.isNew"
                :class="[css.changelogView_tag, css.changelogView_tag_new]"
              >
                {{ t(l.tagNew) }}
              </span>
              <span
                v-if="version.running"
                :class="css.changelogView_tag"
              >
                {{ t(l.tagRunning) }}
              </span>
            </template>
            <template v-else>
              <span :class="css.changelogView_version">{{ t(l.development) }}</span>
              <span
                v-if="version.since"
                :class="css.changelogView_date"
              >
                {{ t(l.since, { version: version.since }) }}
              </span>
              <span :class="css.changelogView_tag">{{ t(l.tagRunning) }}</span>
            </template>
          </button>
        </h3>
        <div
          v-if="isOpen(version, index)"
          :id="`${id}-${index}`"
          :class="css.changelogView_content"
        >
          <GitHubHtml
            v-if="version.kind === 'release'"
            :class="css.changelogView_release"
            :html="version.html"
          />
          <GitHubLinks v-else-if="version.groups.length > 0">
            <div :class="css.changelogView_development">
              <p :class="css.changelogView_count">{{ getCountLine(version) }}</p>
              <section
                v-for="group in version.groups"
                :key="group.kind"
                :class="css.changelogView_group"
              >
                <h4 :class="css.changelogView_groupTitle">{{ t(GROUP_TITLES[group.kind]) }}</h4>
                <ul :class="css.changelogView_changes">
                  <li
                    v-for="(change, changeIndex) in group.changes"
                    :key="changeIndex"
                    :class="css.changelogView_change"
                  >
                    {{ change.description }}
                    <a
                      v-if="change.pullRequest !== undefined"
                      :class="css.changelogView_pullRequest"
                      v-bind="getPullRequestLink(change.pullRequest)"
                    >
                      #{{ change.pullRequest }}
                    </a>
                  </li>
                </ul>
              </section>
            </div>
          </GitHubLinks>
          <EmptyState
            v-else
            place="column"
            :icon="Check"
            :title="
              version.limited
                ? t(l.nothingTitleNewest, { count: version.commits })
                : t(l.nothingTitle, { count: version.commits })
            "
          />
        </div>
      </li>
    </ul>
  </section>
</template>

<style lang="scss" module="css">
.changelogView {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
}

.changelogView_head {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-6 14px;
  align-items: center;
}

.changelogView_title {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $color-fg-2;
}

.changelogView_hint {
  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
  font-size: 11.5px;
  color: $color-fg-dim;
}

.changelogView_list {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  padding: 0;
  margin: 0;
  list-style: none;
}

.changelogView_fold {
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: 10px;
}

.changelogView_head {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  width: 100%;
  padding: $spacing-12 14px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: 10px;

  &:focus-visible {
    @include focus-ring;
  }
}

.changelogView_chevron {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.changelogView_version {
  font-family: $font-family-mono;
  font-size: 13.5px;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.changelogView_date {
  font-size: $font-size-sm;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}

.changelogView_tag {
  padding: 1px 5px;
  font-size: 11px;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-sm;
}

.changelogView_tag_new {
  color: $color-accent;
  border-color: $color-accent;
}

.changelogView_content {
  padding: 2px 14px 18px 36px;
}

// Twice the class: above what `GitHubHtml` sets for itself, whichever stylesheet comes first.
.changelogView_release.changelogView_release {
  font-size: 13px;
  color: $color-fg;

  :global {
    p {
      margin-bottom: 14px;
      font-size: 13.5px;
      line-height: 1.55;
    }

    h1,
    h2,
    h3 {
      margin: 14px 0 7px;
      font-size: 12.5px;
      font-weight: $font-weight-semibold;
      color: $color-fg-2;
    }

    h1:first-child,
    h2:first-child,
    h3:first-child {
      margin-top: 0;
    }

    ul {
      padding-left: 11px;
      margin-bottom: 14px;
      list-style: disc;
    }

    li {
      margin-bottom: 7px;
    }

    li::marker {
      color: $color-fg-3;
    }

    a.issue-link {
      font-size: 12.5px;
      color: $color-fg-dim;
      text-decoration: none;

      &:hover {
        color: $color-fg-2;
        text-decoration: underline;
      }
    }
  }
}

.changelogView_development {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.changelogView_count {
  font-size: 13px;
  color: $color-fg-2;
}

.changelogView_group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.changelogView_groupTitle {
  margin: 0;
  font-size: 12.5px;
  font-weight: $font-weight-semibold;
  color: $color-fg-2;
}

.changelogView_changes {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-left: 11px;
  margin: 0;
  list-style: disc;
}

.changelogView_change {
  font-size: 13px;
  color: $color-fg;

  &::marker {
    color: $color-fg-3;
  }
}

.changelogView_pullRequest {
  margin-left: $spacing-4;
  font-size: 12.5px;
  color: $color-fg-dim;
  text-decoration: none;

  &:hover {
    color: $color-fg-2;
    text-decoration: underline;
  }
}

.changelogView_loading {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
}

.changelogView_loadingLine {
  max-width: 100%;
  height: 10px;
  background: $color-bg-3;
  border-radius: 3px;
}
</style>
