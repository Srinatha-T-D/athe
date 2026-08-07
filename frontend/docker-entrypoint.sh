#!/bin/sh
# Regenerates env-config.js from container environment variables at startup so
# the same built image can be promoted across dev/staging/prod/k8s environments.
set -eu

CONFIG_FILE=/usr/share/nginx/html/env-config.js

cat > "$CONFIG_FILE" << EOC
window._env_ = {
  REACT_APP_BACKEND_URL: "${REACT_APP_BACKEND_URL:-}"
};
EOC

echo "[entrypoint] wrote runtime config: $(cat $CONFIG_FILE)"
