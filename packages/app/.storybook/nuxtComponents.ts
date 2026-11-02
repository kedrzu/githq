import { defineComponent, h } from 'vue';

// What `#components` gives the app's components, for Storybook, which builds them without Nuxt (`main.ts`).

/** Nuxt Image's `<NuxtImg>` as a plain `<img>`: the attributes as written, the source image as it is, no `srcset`. */
export const NuxtImg = defineComponent({
    name: 'NuxtImg',
    setup: () => () => h('img'),
});
