<!-- Opens the githq links opened in the desktop app (`link_take`, `link-opened`), on the screens they stand for. No markup. -->
<script lang="ts" setup>
import { useLogger } from '@nzyme/vue-ioc/useLogger.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { useRouter } from 'vue-router';

import { NativeBridge } from './NativeBridge.js';

const router = useRouter();
const bridge = useService(NativeBridge);
const logger = useLogger();

/** Goes to the link taken from the native side, if there is one. */
async function openTakenLink() {
  try {
    const address = await bridge.takeOpenedLink();
    if (address !== null) {
      await router.push(address);
    }
  } catch (error: unknown) {
    logger.warn('Could not open a link opened in the app', { error });
  }
}

// Listening first, then taking once: a link opened between the two is told by the event, so none falls in between.
bridge
  .onLinkOpened(() => {
    void openTakenLink();
  })
  .then(openTakenLink)
  .catch((error: unknown) => {
    logger.warn('Could not listen to the links opened in the app', { error });
  });
</script>
