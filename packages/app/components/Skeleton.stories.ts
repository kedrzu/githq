import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import { withMotion } from '@/testing/withMotion.js';

import Skeleton from './Skeleton.vue';
import SkeletonBar from './SkeletonBar.vue';
import SkeletonCircle from './SkeletonCircle.vue';

// Three wrappers of mixed shapes, one per row, composed as another screen might (a workflow's name and its strip of
// five runs): each row shows one band across all its shapes, the row below 80 ms later.
const Rows = defineComponent(
    () => () =>
        h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', maxWidth: '720px' } },
            [0, 1, 2].map(row =>
                h(
                    Skeleton,
                    {
                        row,
                        'data-testid': `row-${row}`,
                        style: { display: 'flex', alignItems: 'center', gap: '10px' },
                    },
                    () => [
                        h(SkeletonCircle, { size: 14 }),
                        h(SkeletonBar, { width: 260 }),
                        h(SkeletonBar, { width: 120, height: 8, tone: 'weak' }),
                        ...[0, 1, 2, 3, 4].map(() => h(SkeletonCircle, { size: 10, tone: 'weak' })),
                        h(SkeletonBar, { width: 24, height: 16, radius: 4 }),
                    ],
                ),
            ),
        ),
);

const meta = {
    component: Skeleton,
    render: () => h(Rows),
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** With the app's animations on: a soft band runs along the shapes, never over the background between them. */
export const Shapes: Story = {
    decorators: [withMotion],
};

/** Animations off (Display, or the system asks for reduced motion): the shapes stand still in their base tones. */
export const AnimationsOff: Story = {};
