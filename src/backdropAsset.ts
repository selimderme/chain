import { Asset } from 'expo-asset';
import { Image } from 'react-native';

// This is the existing atmosphere with the settled blur baked in. Native
// blurRadius runs after onLoad, allowing a late change even for cached images.
export const NEON_BACKDROP_IMAGE = require('../assets/aurora-atmosphere-soft.png');

let preparation: Promise<void> | null = null;

/** Load and decode before the app exposes any screen that uses the backdrop. */
export function warmNeonBackdrop(): Promise<void> {
  if (!preparation) {
    preparation = Asset.loadAsync(NEON_BACKDROP_IMAGE).then(async ([asset]) => {
      const uri = asset.localUri || asset.uri;
      const cached = await Image.prefetch(uri);
      if (cached === false) throw new Error('Backdrop image could not be prepared.');
    }).catch(error => {
      // A failed dev-server request can be retried without restarting the app.
      preparation = null;
      throw error;
    });
  }
  return preparation;
}
