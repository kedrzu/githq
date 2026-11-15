import {
    BookMarked,
    CircleArrowDown,
    Cloud,
    FileDiff,
    PanelsTopLeft,
    ScrollText,
    Shield,
    SquareKanban,
    User,
} from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';

import type { SettingsSection } from './settingsRoutes.js';

/** Each section's icon: on the computer's column of the sections (`SettingsView`) and on a phone's list (`SettingsSectionsList`). */
export const SETTINGS_SECTION_ICONS: Readonly<Record<SettingsSection, LucideIcon>> = {
    repositories: BookMarked,
    projects: SquareKanban,
    display: PanelsTopLeft,
    review: FileDiff,
    privacy: Shield,
    sync: Cloud,
    account: User,
    updates: CircleArrowDown,
    changelog: ScrollText,
};
