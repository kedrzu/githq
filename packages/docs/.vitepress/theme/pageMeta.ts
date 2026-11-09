import type { DefaultTheme } from 'vitepress';
import { useData } from 'vitepress';
import { computed } from 'vue';

import type { DocsSection } from '../sections.js';
import { sections } from '../sections.js';

/** A page's date as the docs show it, the same on the server and in every time zone: "Nov 9, 2026". */
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

/** A date as the docs show it, for a `<time>`: the text and the ISO form for its `datetime`. */
export function formatDate(timestamp: number) {
    const date = new Date(timestamp);
    return { text: DATE_FORMAT.format(date), iso: date.toISOString() };
}

/**
 * What the article says about the page it shows: its section, when and in which commit it last changed, how long it
 * takes to read and where to edit it. The reading time and the commit come from the config's `transformPageData`.
 */
export function usePageMeta() {
    const { page, frontmatter, theme } = useData<DefaultTheme.Config>();

    const section = computed<DocsSection | undefined>(() => {
        const folder = page.value.relativePath.split('/')[0];
        return sections.find(candidate => candidate.id === folder);
    });

    const updated = computed(() => {
        const timestamp = page.value.lastUpdated;
        // A page not committed yet has no date (git answers nothing, VitePress makes it `NaN`).
        if (!timestamp || !Number.isFinite(timestamp)) {
            return undefined;
        }
        return formatDate(timestamp);
    });

    const readingMinutes = computed(() => numberOrUndefined(frontmatter.value.readingMinutes));
    const commit = computed(() => stringOrUndefined(frontmatter.value.commit));

    // As the default theme's `useEditLink` builds it: the pattern with the page's path.
    const editUrl = computed(() => {
        const pattern = theme.value.editLink?.pattern;
        if (typeof pattern !== 'string' || frontmatter.value.editLink === false) {
            return undefined;
        }
        return pattern.replace(/:path/g, page.value.filePath);
    });

    return { section, updated, readingMinutes, commit, editUrl };
}

function numberOrUndefined(value: unknown): number | undefined {
    return typeof value === 'number' ? value : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}
