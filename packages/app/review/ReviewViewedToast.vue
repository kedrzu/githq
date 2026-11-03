<!-- The toast of viewed marks GitHub didn't take (D9), for a `Toaster`: which file or how many, and GitHub's words. The marks have already gone back to what they were. -->
<script lang="ts">
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';

import Toast from '@/components/Toast.vue';

import { getFileName } from './utils/getFileName.js';
import * as l from './ReviewViewedToast.loc.js';
import { ReviewViewedFailures } from './ReviewViewedFailures.js';

const failures = useService(ReviewViewedFailures);
const t = useTranslate();
</script>

<template>
  <Toast
    v-if="failures.latest"
    :key="failures.latest.id"
    :title="
      t(l.failed, {
        count: failures.latest.paths.length,
        formatted: numbers.format(failures.latest.paths.length),
        name: getFileName(failures.latest.paths[0] ?? ''),
      })
    "
    @dismiss="failures.dismiss()"
    @update:open="open => open || failures.dismiss()"
  >
    {{ failures.latest.message }}
  </Toast>
</template>
