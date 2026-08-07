// Runtime configuration.
//
// In Docker/Kubernetes, docker-entrypoint.sh regenerates public/env-config.js
// from container environment variables on every pod start, and index.html
// loads it before the app bundle - so the same built image can be promoted
// across dev/staging/prod without a rebuild.
//
// For local `npm start` (no Docker), window._env_ won't be populated, so we
// fall back to the build-time process.env value from .env.
export function getBackendUrl() {
  const runtimeUrl = typeof window !== 'undefined' && window._env_ && window._env_.REACT_APP_BACKEND_URL;
  return runtimeUrl || process.env.REACT_APP_BACKEND_URL || '';
}
