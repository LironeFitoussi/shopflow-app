# ShopFlow – Docker Lab

> **Level:** Beginner–Intermediate | **Total time:** ~2.5 hours | **Requirements:** Docker, Docker Compose

---

## Project Overview

ShopFlow is an online store composed of 4 services:

| Service | Technology | Role |
|---------|------------|------|
| frontend | Nginx + React (Vite) | User interface |
| backend | NestJS (Node.js) | REST API |
| postgres | PostgreSQL 16 | Primary database |
| redis | Redis 7 | Caching layer |

### Network Architecture

```
Browser → frontend (port 8080)
               ↓ /api/* proxy
            backend (port 3000)
               ↓
       postgres + redis
```

Two isolated networks:
- `frontend-net` — frontend only (external traffic)
- `backend-net` — backend, postgres, redis, and frontend (for proxy)

---

## Phase 1 – Docker Build & Multi-Stage (45 min)

### Goal
Understand multi-stage builds, network isolation, and image layers.

### Steps

**1.1 – Build and run**
```bash
cd shopflow
docker compose up --build
```

Open `http://localhost:8080` and verify the store loads.

**1.2 – Compare image sizes**
```bash
# Builder stage only (includes devDependencies, TypeScript compiler):
docker build --target builder -t shopflow-backend:fat ./backend
docker images shopflow-backend:fat

# Final production image (only dist + runtime dependencies):
docker images shopflow-backend
```
> **Question:** How many MB did you save? What's in the builder that's excluded from production?

**1.3 – Prove network isolation**
```bash
# Frontend should NOT be able to reach postgres directly:
docker exec shopflow-frontend ping postgres
# Expected: Name or service not known

# Backend can:
docker exec shopflow-backend ping postgres
# Expected: successful response
```

> **Why does this work?** Frontend is attached to both `frontend-net` and `backend-net`, but postgres lives only on `backend-net`. Frontend can proxy requests to backend, but cannot reach postgres directly.

**1.4 – Check healthchecks**
```bash
docker compose ps
# Verify every service shows "healthy"
```

### Verification commands
```bash
docker compose ps
docker compose logs backend --tail=20
docker network ls
docker network inspect shopflow_backend-net
docker network inspect shopflow_frontend-net
```

### Discussion questions
1. Why separate `frontend-net` from `backend-net`?
2. What happens if you remove `depends_on`?
3. What's the difference between `COPY` and `ADD` in a Dockerfile?
4. Why use `node:20-alpine` instead of `node:20`?

---

## Phase 2 – Cache in Action (30 min)

### Goal
See the Redis cache working in real time and understand cache invalidation.

### Steps

**2.1 – Open the app**

Go to `http://localhost:8080` and look at the badge in the header:
- 🗄 **POSTGRES** = data came directly from the DB (cache miss)
- ⚡ **REDIS CACHE** = data came from cache (cache hit)

**2.2 – Follow logs in real time**
```bash
docker compose logs -f backend
```

Refresh the page (F5) several times and watch the log toggle between:
```
🟡 Cache MISS
🔵 Cache HIT
```

**2.3 – Cache invalidation**

Click **BUY NOW** on any product:
1. The request sends `PATCH /api/products/:id/stock`
2. Backend deletes the `products:all` key from Redis
3. The next `GET /api/products` request causes a cache miss and hits Postgres

**2.4 – Inspect Redis manually**
```bash
docker exec -it shopflow-redis redis-cli
> KEYS *
> GET products:all
> TTL products:all
> EXIT
```

### Discussion questions
1. What is TTL (Time To Live) and why is it set to 60 seconds?
2. What happens if Redis goes down? Does the app continue to work?
3. When can a Redis cache return stale data?

---

## Phase 3 – Volumes & Data Persistence (30 min)

### Goal
Understand that database data lives in a volume, not inside the container.

### Steps

**3.1 – Inspect volumes**
```bash
docker volume ls
# You should see: shopflow_postgres-data, shopflow_redis-data
```

**3.2 – Prove persistence**

Buy a few products (BUY NOW) to change stock values.

```bash
# Stop all containers WITHOUT removing volumes:
docker compose down

# Start again:
docker compose up -d

# Open http://localhost:8080 — stock changes are preserved
```

**3.3 – Delete volumes**
```bash
# Stop and remove volumes:
docker compose down -v

# Start again:
docker compose up -d

# Open http://localhost:8080 — data reset to defaults (backend re-seeds)
```

> The backend automatically seeds 5 products on first startup.

### Discussion questions
1. What is the difference between `docker compose down` and `docker compose down -v`?
2. Why does postgres need a volume but the backend doesn't?
3. What happens if two containers try to write to the same volume simultaneously?

---

## Phase 4 – Development Mode (25 min)

### Goal
Understand the difference between production and development compose, and see hot-reload in action.

### Steps

**4.1 – Start the dev environment**
```bash
# Make sure production environment is stopped:
docker compose down

# Start dev environment:
docker compose -f docker-compose.dev.yml up --build
```

Differences between environments:

| | Production | Development |
|---|---|---|
| Backend command | `node dist/main.js` | `nest start --watch` (hot reload) |
| Frontend server | Nginx + static build | Vite dev server |
| Frontend port | 8080 | 5173 |
| Source mount | No | Yes — changes apply instantly |

**4.2 – Test hot-reload**

Open `http://localhost:5173` in your browser.

Edit `frontend/src/App.tsx` — change the text `ShopFlow` inside the `<h1>` to anything else and save. The browser will update automatically.

**4.3 – Inspect running commands**
```bash
# See the command running inside each container:
docker inspect shopflow-backend --format '{{.Config.Cmd}}'
```

### Discussion questions
1. Why not use `target: builder` in production?
2. What is the advantage of mounting source code in development?
3. Why doesn't the development frontend need Nginx?

---

## Cleanup

```bash
# Stop production environment:
docker compose down -v

# Stop development environment:
docker compose -f docker-compose.dev.yml down -v

# Remove images (optional):
docker rmi shopflow-backend shopflow-frontend shopflow-backend:fat
```

### Completion checklist

- [ ] Built images with multi-stage build
- [ ] Proved network isolation between frontend and postgres
- [ ] Saw the cache badge toggle between Redis and Postgres
- [ ] Verified cache invalidation with redis-cli
- [ ] Proved volumes persist data after `docker compose down`
- [ ] Ran the development environment with hot-reload

---

## Quick Reference

```bash
# Compose
docker compose up --build
docker compose up --build -d          # background
docker compose down
docker compose down -v                # includes volumes
docker compose logs -f backend
docker compose ps

# Dev mode
docker compose -f docker-compose.dev.yml up --build

# Images
docker images
docker build --target builder -t name:tag ./dir

# Containers
docker exec -it shopflow-redis redis-cli
docker exec shopflow-backend ping postgres

# Networks
docker network ls
docker network inspect shopflow_backend-net

# Volumes
docker volume ls
docker volume inspect shopflow_postgres-data
```
