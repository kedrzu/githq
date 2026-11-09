// Types for what tsgo can't read itself: Vite's (stylesheets, `import.meta.env`) through VitePress, which re-exports
// them, and single-file components.
/// <reference types="vitepress/client" />

declare module '*.vue' {
    import type { DefineComponent } from 'vue';

    const component: DefineComponent;
    export default component;
}
