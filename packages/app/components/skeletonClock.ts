/** The name of the band's keyframes (`@keyframes skeleton-sweep`, `main.scss`). */
const SWEEP = 'skeleton-sweep';

let installed = false;

/**
 * Puts every skeleton's band on one clock, whenever it starts: a CSS animation counts from when its element got its
 * style, so a ghost mounted later, or motion turned on later, would run out of step with the rest. Each one is
 * started at the document timeline's zero instead, so the bands of a whole screen — code review's masked `::before`s
 * too, which no component mounts — move as one, each row only its stagger behind (D9). Once per page; `SkeletonBar`
 * also anchors its own at mount, so a shape is never painted off the clock for a frame.
 */
export function syncSkeletonClock() {
    if (installed) {
        return;
    }
    installed = true;
    document.addEventListener('animationstart', event => {
        if (event.animationName === SWEEP && event.target instanceof Element) {
            anchorSkeletonAnimations(event.target);
        }
    });
}

/** Starts the bands on the element and its pseudo-elements at the document timeline's zero. */
export function anchorSkeletonAnimations(element: Element) {
    for (const animation of element.getAnimations({ subtree: true })) {
        if (animation instanceof CSSAnimation && animation.animationName === SWEEP && animation.startTime !== 0) {
            animation.startTime = 0;
        }
    }
}
