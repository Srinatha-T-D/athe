# ATHE - Connect. Chat. Chill.

A real-time chat app: FastAPI + MongoDB/DocumentDB backend (REST +
WebSocket), React frontend, Redis-backed message fan-out for multi-replica
deployments.

## Repository layout

```
backend/            FastAPI app (server.py), Dockerfile, requirements
frontend/           React (CRA/craco) app - the deployed chat UI, Dockerfile, nginx config
frontend-landing/   Standalone Vite/React scaffold, NOT currently wired into
                     docker-compose, k8s, or CI. Unused unless you build it
                     out into a marketing/landing page and add it to the
                     deployment pipeline yourself.
k8s/                Kubernetes manifests for production (see DEPLOY.md)
.github/workflows/  CI/CD pipeline (build, push to ECR, deploy to EKS)
docker-compose.yml  Local development / smoke-testing stack only
DEPLOY.md           Full AWS EKS deployment walkthrough
```

## Local development

```bash
cp backend/.env.example backend/.env       # edit as needed
cp frontend/.env.example frontend/.env     # edit as needed
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:8000/api/health
- Mongo and Redis run as containers with no auth beyond what's in
  `docker-compose.yml` - fine for local dev, not for production.

Without Docker: `cd backend && pip install -r requirements-dev.txt && uvicorn server:app --reload`
and `cd frontend && npm install && npm start` (needs `mongod` and, if you
want to test multi-instance delivery, `redis-server` running locally).

## Production deployment (AWS)

See **[DEPLOY.md](./DEPLOY.md)** for the full walkthrough: ECR, EKS,
DocumentDB, ElastiCache, ALB Ingress with TLS, and CI/CD via GitHub Actions.

## Architecture notes

- **Auth:** JWT (24h expiry), bcrypt password hashing, guest accounts
  supported.
- **Realtime:** WebSocket per user at `/api/ws/{user_id}`. With multiple
  backend replicas, delivery goes through Redis pub/sub rather than an
  in-memory map, since a sender and recipient's WebSockets can be held by
  different pods - see `ConnectionManager` in `backend/server.py`.
- **Frontend runtime config:** the Docker image is built once and promoted
  across environments; `REACT_APP_BACKEND_URL` is injected at *container
  start* (via `docker-entrypoint.sh` writing `public/env-config.js`) and
  read at runtime in `frontend/src/lib/config.js`, not baked in at build
  time.
- **Health checks:** `GET /api/health` (liveness) and `GET /api/health/ready`
  (checks Mongo + Redis connectivity) back the Docker `HEALTHCHECK` and k8s
  probes.
