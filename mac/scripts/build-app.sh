#!/bin/bash
# Builds mac/build/Polaris.app so macOS can send polaris:// links (from the web app's
# Connect page) to Polaris. Run from anywhere:  mac/scripts/build-app.sh [--open]
#
# POLARIS_API_URL is copied from your shell into the app's Info.plist (apps opened from
# Finder don't see your shell's exports). AI runs in the web app, so no Gemini key is needed here.
set -euo pipefail
cd "$(dirname "$0")/.."

swift build -c release
BIN="$(swift build -c release --show-bin-path)"
APP="build/Polaris.app"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN/Polaris" "$APP/Contents/MacOS/Polaris"
cp -R Sources/Polaris/Resources/Fonts "$APP/Contents/Resources/Fonts"

env_entries=""
for name in POLARIS_API_URL; do
  value="${!name:-}"
  if [ -n "$value" ]; then
    env_entries+="    <key>$name</key><string>$value</string>"$'\n'
  fi
done

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>app.polaris.mac</string>
  <key>CFBundleName</key><string>Polaris</string>
  <key>CFBundleDisplayName</key><string>Polaris</string>
  <key>CFBundleExecutable</key><string>Polaris</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key><string>app.polaris.mac</string>
      <key>CFBundleURLSchemes</key><array><string>polaris</string></array>
    </dict>
  </array>
  <key>LSEnvironment</key>
  <dict>
$env_entries  </dict>
</dict>
</plist>
PLIST

# Free local ("ad-hoc") signature: fine on this Mac; sharing needs an Apple Developer ID.
# The designated requirement names only the bundle id, so macOS keeps the Accessibility
# permission across rebuilds instead of treating each build as a new app.
codesign --force --sign - -r='designated => identifier "app.polaris.mac"' "$APP"
# Tell macOS this app handles polaris:// links.
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP"

echo "✅ Built $(pwd)/$APP"
if [ "${1:-}" = "--open" ]; then
  pkill -x Polaris 2>/dev/null || true
  open "$APP"
fi
