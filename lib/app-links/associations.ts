import { locales } from '@/i18n/config';

/**
 * Which kallo.fit links open the mobile app instead of the browser, and which
 * app builds may claim them, as the two documents iOS and Android read:
 * `/.well-known/apple-app-site-association` (Universal Links) and
 * `/.well-known/assetlinks.json` (App Links). The routes only serve them.
 *
 * Only invite links are claimed. Every other page stays on the web, so a link
 * to the food pages or docs never yanks someone into the app.
 */

/** Apple team id + bundle id of the iOS app (`ios/Runner.xcodeproj`). */
const IOS_APP_ID = 'ZNG57U88R5.com.khoivo.nham';

/** The Android application id shipped on Google Play. */
const ANDROID_PACKAGE = 'fit.kallo.app';

/**
 * SHA-256 fingerprints of the certificates that sign the Android app: Google
 * Play's app-signing key (every build installed from Play) and our upload key
 * (`~/.android-keys/kallo-upload.jks`, sideloaded release builds). A build
 * signed by anything else (a debug build) is not verified and opens links in
 * the browser.
 */
const ANDROID_CERT_SHA256 = [
  'E5:E7:BD:EA:0C:11:DB:88:61:FC:FC:A8:BF:1C:4D:7F:6A:F9:72:BD:97:66:F5:60:70:7D:92:CA:A0:BC:96:86',
  '30:01:3C:68:FC:53:D8:D2:8B:F1:74:26:06:85:EE:89:77:CE:4A:21:92:BE:EC:B4:04:B0:A4:8E:76:87:87:2E',
];

/**
 * Invite link path prefixes: `/<locale>/invite/` as the apps build them, plus
 * the bare `/invite/` a person might type (the web redirects it to a locale).
 * The Android manifest lists the same prefixes as `pathPrefix`; a test holds
 * the two equal.
 */
export const INVITE_PATH_PREFIXES = [
  ...locales.map((locale) => `/${locale}/invite/`),
  '/invite/',
];

/** The Universal Links document for the iOS app. */
export const appleAppSiteAssociation = {
  applinks: {
    details: [
      {
        appIDs: [IOS_APP_ID],
        // `?*`: at least one character after the prefix, so a bare
        // `/en/invite/` with no slug stays on the web.
        components: INVITE_PATH_PREFIXES.map((prefix) => ({
          '/': `${prefix}?*`,
        })),
      },
    ],
  },
};

/**
 * The App Links statement for the Android app. It names the app and its
 * signing certs only; the paths live in the manifest's intent filter.
 */
export const androidAssetLinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: ANDROID_PACKAGE,
      sha256_cert_fingerprints: ANDROID_CERT_SHA256,
    },
  },
];
