import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { BookOpen, HardDrive, Lock, PanelsTopLeft } from 'lucide-vue-next';

import PhoneSettingsGroup from './PhoneSettingsGroup.vue';
import PhoneSettingsRow from './PhoneSettingsRow.vue';

const meta = {
    component: PhoneSettingsRow,
    args: { label: 'Display' },
} satisfies Meta<typeof PhoneSettingsRow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Phone / Settings / Row` in its kinds, in groups: going into a screen, opening a page outside, only telling, amber. */
export const Gallery: Story = {
    render: () => ({
        components: { PhoneSettingsGroup, PhoneSettingsRow },
        setup: () => ({ BookOpen, HardDrive, Lock, PanelsTopLeft }),
        template: `
          <div style="width: 390px">
            <PhoneSettingsGroup title="How githq behaves">
              <PhoneSettingsRow :icon="PanelsTopLeft" label="Display" value="Animations on" to="/settings?tab=display" />
              <PhoneSettingsRow :icon="BookOpen" label="What githq counts" href="https://githq.dev/docs" />
            </PhoneSettingsGroup>
            <PhoneSettingsGroup title="Organisations">
              <PhoneSettingsRow :icon="Lock" label="acme-health" value="Private data hidden" tone="amber" />
              <PhoneSettingsRow label="fitloop" value="Approved" tone="good" />
            </PhoneSettingsGroup>
            <PhoneSettingsGroup title="This phone" description="What githq keeps here.">
              <PhoneSettingsRow :icon="HardDrive" label="Copy kept here" value="48 MB" />
            </PhoneSettingsGroup>
          </div>
        `,
    }),
};
