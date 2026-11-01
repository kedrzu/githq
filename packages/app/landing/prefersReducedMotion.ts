/**
 * Whether the visitor asked for no motion (`prefers-reduced-motion: reduce`): the landing page's motion starts
 * only when this is false. Reads `window`, so only in the browser — in `onMounted` or later, never while the
 * prerendered page renders.
 */
export function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
