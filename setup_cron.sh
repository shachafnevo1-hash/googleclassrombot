#!/usr/bin/env bash
# setup_cron.sh — Register the weekly homework agent cron job.
# Runs every Sunday at 08:00.
# Usage: chmod +x setup_cron.sh && ./setup_cron.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$(which python3)"
CRON_LOG="$SCRIPT_DIR/logs/cron.log"

# Every Sunday at 08:00
CRON_SCHEDULE="0 8 * * 0"
CRON_CMD="$CRON_SCHEDULE cd \"$SCRIPT_DIR\" && $PYTHON_BIN \"$SCRIPT_DIR/main.py\" >> \"$CRON_LOG\" 2>&1"

# Create logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

# Add to crontab only if not already present (idempotent)
(
  crontab -l 2>/dev/null | grep -v "googleclassrombot/main.py" || true
  echo "$CRON_CMD"
) | crontab -

echo "Cron job registered successfully!"
echo ""
echo "Schedule: Every Sunday at 08:00"
echo "Command:  $CRON_CMD"
echo ""
echo "Verify with:  crontab -l"
echo "View logs:    tail -f \"$CRON_LOG\""
echo "             tail -f \"$SCRIPT_DIR/logs/agent.log\""
