import { defineContext } from '@nzyme/vue-utils/context.js';

/**
 * The `Skeleton` a shape sits in: it lays one band out across all its shapes, so it has to know where each one is.
 * A shape outside a wrapper is a span of its own.
 */
export interface SkeletonContext {
    /** A shape that mounted inside the wrapper. */
    add(shape: HTMLElement): void;
    /** A shape that unmounted. */
    remove(shape: HTMLElement): void;
}

export const SkeletonContext = defineContext<SkeletonContext>('SkeletonContext');
