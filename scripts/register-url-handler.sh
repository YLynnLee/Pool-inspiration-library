#!/bin/sh
# Registers the pool:// link with this computer, so the app's
# Connect AI button can start the helper by itself (the way a Zoom or Slack
# link opens its app). Run by scripts/start.sh on every start — it only
# rebuilds when something changed. See SECURITY.md.
#
# macOS: a tiny background app (.helper/Pool Helper.app,
#        gitignored) that claims the link and runs start.sh --background.
# Linux: a .desktop entry registered as the link's handler.
# Windows: done by "Start Pool.bat" in the registry instead.
set -u
cd "$(dirname "$0")/.." || exit 1
REPO="$(pwd)"
SCHEME="pool"

if [ "$(uname)" = "Darwin" ]; then
  APP="$REPO/.helper/Pool Helper.app"
  STAMP="$REPO/.helper/registered-for"
  # Rebuild only if missing, or if this folder has moved since it was built.
  if [ -d "$APP" ] && [ -f "$STAMP" ] && [ "$(cat "$STAMP")" = "$REPO" ]; then
    exit 0
  fi
  mkdir -p "$REPO/.helper"
  rm -rf "$APP"
  SRC="$REPO/.helper/helper.applescript"
  START_QUOTED=$(printf '%s' "$REPO/scripts/start.sh" | sed 's/"/\\"/g')
  cat > "$SRC" <<EOF
property startScript : "$START_QUOTED"

-- Opened by an pool:// link (the app's Connect AI button):
-- start the helper quietly; the page waits for it and switches over.
on open location theURL
	do shell script "nohup /bin/sh " & quoted form of startScript & " --background >/dev/null 2>&1 &"
end open location

-- Opened directly: start the helper and open the app.
on run
	do shell script "nohup /bin/sh " & quoted form of startScript & " --background --open >/dev/null 2>&1 &"
end run
EOF
  osacompile -o "$APP" "$SRC" || exit 1
  PLIST="$APP/Contents/Info.plist"
  /usr/libexec/PlistBuddy \
    -c "Delete :CFBundleIdentifier" \
    -c "Add :CFBundleIdentifier string com.pool.helper" \
    -c "Add :LSUIElement bool true" \
    -c "Add :CFBundleURLTypes array" \
    -c "Add :CFBundleURLTypes:0 dict" \
    -c "Add :CFBundleURLTypes:0:CFBundleURLName string Pool" \
    -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" \
    -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $SCHEME" \
    "$PLIST" 2>/dev/null
  # Editing Info.plist invalidates osacompile's signature; re-sign locally.
  codesign --force --deep -s - "$APP" >/dev/null 2>&1
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP"
  printf '%s' "$REPO" > "$STAMP"
  echo "Registered $SCHEME:// — the app's Connect AI button can now start the helper."
  exit 0
fi

if command -v xdg-mime >/dev/null 2>&1; then
  DESKTOP="$HOME/.local/share/applications/pool.desktop"
  mkdir -p "$(dirname "$DESKTOP")"
  cat > "$DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=Pool Helper
Exec=/bin/sh "$REPO/scripts/start.sh" --background %u
NoDisplay=true
MimeType=x-scheme-handler/$SCHEME;
EOF
  xdg-mime default pool.desktop "x-scheme-handler/$SCHEME"
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$(dirname "$DESKTOP")" >/dev/null 2>&1
  exit 0
fi
