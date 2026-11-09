import type { Component } from 'vue';

import { Cog, LayoutList, Rocket } from 'lucide-vue-next';

import type { SectionIcon } from '../sections.js';

/** The component drawing each section's icon; a new icon in `SectionIcon` fails the type check until it's added here. */
export const sectionIcons: Record<SectionIcon, Component> = {
    rocket: Rocket,
    'layout-list': LayoutList,
    cog: Cog,
};
