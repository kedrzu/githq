import {
    BookMarked,
    CircleArrowDown,
    CircleUser,
    CloudUpload,
    FileDiff,
    PanelsTopLeft,
    Shield,
    SquareKanban,
} from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';

import type { SettingsSection } from './settingsRoutes.js';

/**
 * Each section's icon: on the computer's column of the sections (`SettingsView`), on a phone's list
 * (`SettingsSectionsList`) and on its place in the command menu (`AppCommands`).
 */
export const SETTINGS_SECTION_ICONS: Readonly<Record<SettingsSection, LucideIcon>> = {
    repositories: BookMarked,
    projects: SquareKanban,
    display: PanelsTopLeft,
    review: FileDiff,
    privacy: Shield,
    sync: CloudUpload,
    account: CircleUser,
    updates: CircleArrowDown,
};
