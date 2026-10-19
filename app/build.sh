#!/bin/sh
# Golden Chess app: copy capacitor.config.json and www/ (the site's offline copy, made by "node build.js" at the
# repository root) into the native iOS / Android projects. Run after "npm install".
set -e
cd "$(dirname "$0")"
npx cap sync
echo "synced. iPhone: npx cap open ios · Android: npx cap open android"
