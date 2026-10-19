#!/bin/sh
# A cable build onto your own iPhone with a free Apple ID (Personal Team), before the paid Kozyra Media account:
# a separate bundle id (com.kozyramedia.goldenchess.dev), because an App ID registered by the personal team could
# not be used later by the Kozyra Media team (explicit App IDs are unique across all teams).
# Back to the real project before a store build: sh release.sh
set -e
cd "$(dirname "$0")"
P=ios/App/App.xcodeproj/project.pbxproj
perl -pi -e 's/PRODUCT_BUNDLE_IDENTIFIER = com\.kozyramedia\.goldenchess;/PRODUCT_BUNDLE_IDENTIFIER = com.kozyramedia.goldenchess.dev;/g' "$P"
echo "dev build ready: bundle id com.kozyramedia.goldenchess.dev. Now: npx cap open ios"
