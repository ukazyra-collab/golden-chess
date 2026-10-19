#!/bin/sh
# Back to the real project after dev.sh: bundle id com.kozyramedia.goldenchess (for the Kozyra Media team).
set -e
cd "$(dirname "$0")"
git checkout -- ios/App/App.xcodeproj/project.pbxproj
echo "release project restored: com.kozyramedia.goldenchess"
