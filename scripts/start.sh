#!/bin/sh
# Starts the Pool helper. Sets itself up on the first run, so
# nobody has to type `npm install`. See SECURITY.md.
#
#   scripts/start.sh                     what "Start Pool" runs:
#                                        in a Terminal window, opens the app
#   scripts/start.sh --background [--open]
#                                        what the app's Connect AI button
#                                        triggers (via pool://):
#                                        no window, output to .helper/helper.log
cd "$(dirname "$0")/.." || exit 1

BACKGROUND=0
OPEN=1
for arg in "$@"; do
  case "$arg" in
    --background) BACKGROUND=1; OPEN=0 ;;
    --open) OPEN=1 ;;
  esac
done

if [ "$BACKGROUND" -eq 1 ]; then
  mkdir -p .helper
  exec >> .helper/helper.log 2>&1
  echo "--- $(date) background start"
fi

pause() {
  if [ "$BACKGROUND" -eq 0 ]; then
    printf '\nPress Return to close this window.'
    read -r _
  fi
}

# Opened from Finder or a link, this can start without the PATH a terminal
# has, so the helper couldn't see node or the AI apps (claude, codex, …).
# Borrow the user's own shell PATH.
if [ -n "${SHELL:-}" ]; then
  LOGIN_PATH=$("$SHELL" -ilc 'printf %s "$PATH"' 2>/dev/null) && [ -n "$LOGIN_PATH" ] && PATH="$LOGIN_PATH:$PATH"
fi
PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
export PATH

if ! command -v node >/dev/null 2>&1; then
  echo "Pool needs Node.js (free) to connect your AI."
  echo "Opening the download page — install it, then start Pool again."
  (open "https://nodejs.org/en/download" || xdg-open "https://nodejs.org/en/download") >/dev/null 2>&1
  pause
  exit 1
fi

if [ ! -d node_modules/playwright ]; then
  mkdir -p .helper
  LOCK=".helper/install.lock"
  if mkdir "$LOCK" 2>/dev/null; then
    trap 'rmdir "$LOCK" 2>/dev/null' EXIT INT TERM
    echo "First run: setting up (about a minute)…"
    if ! npm install --no-audit --no-fund; then
      echo "Setup failed — see the messages above."
      pause
      exit 1
    fi
  else
    # Another start already running (e.g. a retried Connect AI click) is
    # installing — wait for it instead of racing a second npm install in
    # the same node_modules.
    echo "Setup already running in another window — waiting for it…"
    while [ -d "$LOCK" ]; do sleep 1; done
    if [ ! -d node_modules/playwright ]; then
      echo "Setup didn't finish — see the other window for errors."
      pause
      exit 1
    fi
  fi
fi

# Lets the app's Connect AI button start the helper next time.
sh scripts/register-url-handler.sh || echo "(Couldn't register the pool:// link; Connect AI will ask you to start the helper by hand.)"

if [ "$OPEN" -eq 1 ]; then
  [ "$BACKGROUND" -eq 0 ] && echo "Starting Pool. Keep this window open while you use the Drain button."
  node scripts/server.js --open
else
  node scripts/server.js
fi
pause
