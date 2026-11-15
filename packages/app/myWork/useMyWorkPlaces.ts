import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import type { NavigationPlace } from '@/commands/searchNavigation.js';
import type { MyWorkGroup } from '@/store/ItemStoreTypes.js';

import * as groupLabels from './MyWorkGroupLabel.loc.js';
import { getMyWorkGroupPath } from './myWorkRoutes.js';
import * as l from './useMyWorkPlaces.loc.js';

/**
 * My work as a place of the command menu: the whole of it (`myWork`, for `null`) or one of its groups (`myWork:<group>`).
 * `AppCommands` lists them under "Go to", and on a phone My work's view offers the same ones first from the command line,
 * with their counts (mobile D17).
 */
export function useMyWorkPlaces(): (group: MyWorkGroup | null) => NavigationPlace {
    const t = useTranslate();

    return group =>
        group === null
            ? { id: 'myWork', group: 'goTo', kind: 'myWork', title: t(l.myWork), path: '/' }
            : {
                  id: `myWork:${group}`,
                  group: 'goTo',
                  kind: 'myWork',
                  title: t(groupLabels[group]),
                  detail: t(l.myWork),
                  path: getMyWorkGroupPath(group),
              };
}
