const { withAndroidManifest, withGradleProperties } = require('expo/config-plugins');

/**
 * Release-build settings for Android, kept in config so they survive `expo prebuild --clean`.
 *
 * 1. R8. android/app/build.gradle reads these two gradle properties:
 *      minifyEnabled   <- android.enableMinifyInReleaseBuilds          (default false)
 *      shrinkResources <- android.enableShrinkResourcesInReleaseBuilds (default false)
 *
 * 2. SYSTEM_ALERT_WINDOW ("Display over other apps"). React Native declares it in a
 *    debug-only library manifest for the dev overlay, and older prebuilds left a copy in
 *    the main manifest, where it would ship to production. The app never draws overlays,
 *    and Play flags the permission, so it is stripped from the main manifest here.
 */
const GRADLE_PROPERTIES = {
  'android.enableMinifyInReleaseBuilds': 'true',
  'android.enableShrinkResourcesInReleaseBuilds': 'true',
};

const DROP_PERMISSIONS = ['android.permission.SYSTEM_ALERT_WINDOW'];

function withR8(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(GRADLE_PROPERTIES)) {
      const existing = cfg.modResults.find((item) => item.type === 'property' && item.key === key);
      if (existing) existing.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
}

function withoutOverlayPermission(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    if (Array.isArray(manifest['uses-permission'])) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (entry) => !DROP_PERMISSIONS.includes(entry.$?.['android:name'])
      );
    }
    return cfg;
  });
}

module.exports = function withAndroidRelease(config) {
  return withoutOverlayPermission(withR8(config));
};
