import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { defineComponent, h } from 'vue';

import DownloadScreen from './DownloadScreen.vue';

// The page follows its own width (`landing-mobile`), not the browser's.
function pageOfWidth(width: number): Decorator {
    return story => {
        const Story = story();
        return defineComponent({
            setup: () => () => h('div', { style: { width: `${width}px` } }, [h(Story)]),
        });
    };
}

const wide = pageOfWidth(1440);

const meta = {
    component: DownloadScreen,
    args: { system: 'macos', signedIn: false, onSignIn: fn() },
} satisfies Meta<typeof DownloadScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

/** LP17: on a Mac, Apple Silicon highlighted. */
export const OnAMac: Story = { decorators: [wide] };

/** On Windows, its row highlighted with its warnings. */
export const OnWindows: Story = { decorators: [wide], args: { system: 'windows' } };

/** On Linux, the `.AppImage` highlighted. */
export const OnLinux: Story = { decorators: [wide], args: { system: 'linux' } };

/** LP18: on a phone nothing is highlighted and the browser path comes first. */
export const Phone: Story = { decorators: [pageOfWidth(390)], args: { system: null } };

/** LP19: signed in, "Open githq" in place of signing in. */
export const SignedIn: Story = { decorators: [wide], args: { signedIn: true } };
