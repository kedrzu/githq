import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { userEvent, within } from 'storybook/test';
import { ChevronDown } from 'lucide-vue-next';
import { defineComponent, h } from 'vue';

import { StoryPage, StoryRow } from '@/.storybook/StoryLayout.jsx';
import Button from '@/components/Button.vue';
import Menu from '@/components/Menu.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { createFixedPhoneLayout } from '@/testing/createFixedPhoneLayout.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { SAMPLE_PROJECT, SAMPLE_VIEW_SPRINT } from '@/testing/sampleProject.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import ProjectContextMenu from './ProjectContextMenu.vue';
import { ProjectStore } from './ProjectStore.js';

const meta = {
    component: ProjectContextMenu,
    args: { projectId: SAMPLE_PROJECT.id, current: false, shownView: null },
    decorators: [
        // A user signed in tracking the project, its saved views read: the menu lists them.
        story =>
            defineComponent({
                setup() {
                    const container = createContainer();
                    container.set(LanguageContext, () => APP_LANGUAGE);
                    // The story frame is narrower than a phone's width: the computer's menu.
                    container.set(PhoneLayout, createFixedPhoneLayout(false));
                    container.set(Browser, createSignedInBrowser());
                    setIndexedDbPersistence(container);
                    provideContainer(container);
                    void trackProject();
                    return () => h(story());

                    async function trackProject() {
                        const tracking = container.resolve(TrackingStore);
                        await tracking.ready();
                        tracking.track({ project: SAMPLE_PROJECT });
                        container.resolve(ProjectStore).setProject(SAMPLE_PROJECT);
                    }
                },
            }),
    ],
    render: args =>
        defineComponent({
            setup() {
                return () => (
                    <StoryPage>
                        <StoryRow>
                            <Menu modal={false}>
                                {{
                                    trigger: () => (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                        >
                                            {SAMPLE_PROJECT.title} <ChevronDown />
                                        </Button>
                                    ),
                                    default: () => <ProjectContextMenu {...args} />,
                                }}
                            </Menu>
                        </StoryRow>
                    </StoryPage>
                );
            },
        }),
} satisfies Meta<typeof ProjectContextMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

/** R3: another project's menu in the sidebar: its saved views without keys, which would do nothing there. */
export const Other: Story = { play: openMenu };

/** R5: the open project's menu: its saved views on `1`–`9`, the one shown checked, no "Open". */
export const Current: Story = {
    args: { current: true, shownView: SAMPLE_VIEW_SPRINT.id, newIssueKey: 'C' },
    play: openMenu,
};

/** Opens the menu and waits for its items: the project is tracked once IndexedDB is read, and until then the menu is empty, which axe rejects. */
async function openMenu({ canvasElement }: { canvasElement: HTMLElement }) {
    await userEvent.click(within(canvasElement).getByRole('button'));
    // The menu opens in a portal, outside the canvas.
    await within(canvasElement.ownerDocument.body).findAllByRole('menuitem');
}
