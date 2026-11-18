<!-- An issue or pull request found by the command menu (E11, MB272), in two lines read as a list's row: the kind and state icon in its tone (its state said to a screen reader), the title with what was typed marked and how long ago it changed; under them, dim and small, the reference (`portal#1187`, the number marked when typed), a pull request's checks and standing as the list says them ("Approved · checks passed", "Draft"), the row field of its first project with its colour dot and "+N", and the author's avatar (none on the viewer's own). Only the status is drawn: no Merge or Open buttons, nothing hidden by display options. The age is counted to when the row was drawn and does not tick. On a phone (MB272) the title is one line cut with an ellipsis and line two holds the short standing ("✓ 12/12", "Approved"), each said in full to a screen reader, with one avatar and the age at its end. Line two never wraps: the field gives way first, the reference and standing never. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { injectContext } from '@nzyme/vue-utils/context.js';
import { SquareKanban } from 'lucide-vue-next';
import { computed } from 'vue';

import { AuthStore } from '@/auth/AuthStore.js';
import Avatar from '@/components/Avatar.vue';
import MatchedText from '@/components/MatchedText.vue';
import { formatShortReference } from '@/item/itemRoutes.js';
import ItemField from '@/lists/ItemField.vue';
import ItemStatus from '@/lists/ItemStatus.vue';
import { useItemFacts } from '@/lists/useItemFacts.js';
import type { ItemShortFact } from '@/lists/useItemFacts.js';
import { MergeContext } from '@/merge/MergeContext.js';
import { Clock } from '@/services/Clock.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import type { Item } from '@/store/ItemTypes.js';

import type { CommandMenuMatch } from './findMenuRows.js';

const props = defineProps<{
  item: Item;
  /** What typed text matched: its title's words or the number in its reference, drawn marked. */
  match: CommandMenuMatch | null;
}>();

const phone = useService(PhoneLayout);
const auth = useService(AuthStore);
const merging = injectContext(MergeContext, { optional: true });
/** Read once: the age is counted to when the menu drew the row and does not tick while it is open. */
const now = useService(Clock).now();
const facts = useItemFacts({
  item: () => props.item,
  parent: null,
  repository: null,
  viewerLogin: () => auth.viewer?.login ?? '',
  now,
  reviewRequested: false,
  people: 'author',
  mergeRecord: () => merging?.getRecord(props.item.id) ?? null,
});
/** The menu's reference (`portal#1187`): the text a typed number's match was found in. */
const reference = computed(() => formatShortReference(props.item));
/** MB272: its checks as a count, then its standing in a word or two, each said in full to a screen reader. */
const shortFacts = computed((): readonly ItemShortFact[] => {
  const short = facts.status?.short ?? [];
  return facts.shortChecks ? [facts.shortChecks, ...short] : short;
});
const author = computed(() => facts.people[0] ?? null);
</script>

<template>
  <div :class="[css.commandMenuItem, phone.active && css.commandMenuItem_phone]">
    <component
      :is="facts.kind.icon"
      :class="[css.commandMenuItem_kind, css[`commandMenuItem_kind_${facts.kind.tone}`]]"
      role="img"
      :aria-label="facts.kind.label"
    />
    <div :class="css.commandMenuItem_content">
      <div :class="css.commandMenuItem_line">
        <span :class="css.commandMenuItem_title">
          <MatchedText
            :text="item.title"
            :ranges="match?.field === 'title' ? match.ranges : null"
          />
        </span>
        <time
          v-if="!phone.active"
          :class="css.commandMenuItem_age"
          :datetime="item.updatedAt"
          >{{ facts.age }}</time
        >
      </div>
      <div :class="[css.commandMenuItem_line, css.commandMenuItem_facts]">
        <span :class="css.commandMenuItem_reference">
          <MatchedText
            :text="reference"
            :ranges="match?.field === 'reference' ? match.ranges : null"
          />
        </span>
        <template v-if="phone.active">
          <span
            v-for="shortFact in shortFacts"
            :key="shortFact.text"
            :class="css.commandMenuItem_status"
            role="img"
            :aria-label="shortFact.label"
            :title="shortFact.label"
          >
            <ItemStatus :status="shortFact" />
          </span>
        </template>
        <template v-else>
          <ItemStatus
            v-if="facts.checks"
            :class="css.commandMenuItem_status"
            :status="facts.checks"
          />
          <ItemStatus
            v-if="facts.status"
            :class="css.commandMenuItem_status"
            :status="facts.status"
          />
        </template>
        <ItemField
          v-if="facts.projectField"
          :class="css.commandMenuItem_field"
          :icon="SquareKanban"
          :color="facts.projectField.color"
          :value="facts.projectField.value"
          :more="facts.projectField.more"
          :title="facts.projectField.title"
        />
        <Avatar
          v-if="author && !phone.active"
          :name="author.login"
          :src="author.avatarUrl"
          size="xs"
        />
        <span
          v-if="phone.active"
          :class="css.commandMenuItem_aside"
        >
          <Avatar
            v-if="author"
            :name="author.login"
            :src="author.avatarUrl"
            size="sm"
          />
          <time
            :class="css.commandMenuItem_age"
            :datetime="item.updatedAt"
            >{{ facts.age }}</time
          >
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module="css">
// Fills the menu's row, which grows to its two lines.
.commandMenuItem {
  display: flex;
  flex: 1;
  gap: $spacing-10;
  align-items: flex-start;
  min-width: 0;
}

// Beside the title's line, as the menu's other icons sit beside theirs.
.commandMenuItem_kind {
  flex: none;
  width: 14px;
  height: 14px;
  margin-top: $spacing-2;

  .commandMenuItem_phone & {
    width: $phone-row-icon-size;
    height: $phone-row-icon-size;
    margin-top: 1px;
  }

  @include item-kind-tones;
}

.commandMenuItem_content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-2;
  min-width: 0;

  .commandMenuItem_phone & {
    gap: $spacing-4;
  }
}

.commandMenuItem_line {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
  line-height: 18px;
  white-space: nowrap;

  .commandMenuItem_phone & {
    line-height: 20px;
  }
}

// No spacer: the age sits right after the title, the title giving way first.
.commandMenuItem_title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.commandMenuItem_age {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.commandMenuItem_facts {
  overflow: hidden;
  font-size: $font-size-xs;
  line-height: 16px;
  color: $color-fg-dim;

  .commandMenuItem_phone & {
    font-size: $font-size-sm;
  }
}

.commandMenuItem_reference {
  flex: none;
  font-family: $font-family-mono;
}

.commandMenuItem_status {
  flex: none;
}

// Gives way first, with an ellipsis, keeping the reference and the standing whole.
.commandMenuItem_field {
  min-width: 0;
  overflow: hidden;
}

.commandMenuItem_aside {
  display: inline-flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  margin-left: auto;
}
</style>
