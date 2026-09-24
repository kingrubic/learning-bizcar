#!/bin/zsh
set -euo pipefail
cd /Users/vsc_agent/projects/learning-bizcar
set -a
source .env.local
set +a
export NODE_ENV=production
export PATH="/Users/vsc_agent/.nvm/versions/node/v26.8.2/bin:/opt/homebrew/bin:/usr/bin:/bin"
exec /Users/vsc_agent/.nvm/versions/node/v26.8.2/bin/node ./node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3014
