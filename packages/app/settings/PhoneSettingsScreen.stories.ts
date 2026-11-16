import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import PhoneSettingsGroup from './PhoneSettingsGroup.vue';
import PhoneSettingsRow from './PhoneSettingsRow.vue';
import PhoneSettingsScreen from './PhoneSettingsScreen.vue';

const meta = {
    component: PhoneSettingsScreen,
    args: { title: 'Display', back: true, backPlace: 'Settings', scrollKey: 'story', onBack: fn() },
    render: args => ({
        components: { PhoneSettingsScreen, PhoneSettingsGroup, PhoneSettingsRow },
        setup: () => ({ args }),
        template: `
          <div style="display: flex; width: 390px; height: 100vh">
            <PhoneSettingsScreen v-bind="args">
              <PhoneSettingsGroup title="Motion">
                <PhoneSettingsRow label="Animations" value="On" />
              </PhoneSettingsGroup>
            </PhoneSettingsScreen>
          </div>
        `,
    }),
} satisfies Meta<typeof PhoneSettingsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A section's screen: back to Settings. */
export const Section: Story = {};

/** MB146: the list opened from My work. */
export const FromMyWork: Story = { args: { title: 'Settings', backPlace: 'My work' } };

/** Nothing behind it: the places button. */
export const NothingBehind: Story = { args: { title: 'Settings', back: false } };
