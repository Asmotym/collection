# Collection

Vue/Vite frontend with a TypeScript Fastify backend and PostgreSQL, designed to run locally through Docker Compose.

## Requirements

- Docker with Docker Compose
- Node.js 22 and npm for local builds or development outside Docker
- `make` for the documented command shortcuts

## Setup

Copy the example environment file if you need local overrides:

```sh
cp .env.example .env
```

The Docker stack already defines database defaults in `docker-compose.yml`:

```env
POSTGRES_DB=collection
POSTGRES_USER=collection
POSTGRES_PASSWORD=collection
DATABASE_URL=postgres://collection:collection@postgres:5432/collection
MUSICBRAINZ_USER_AGENT=Collection/0.1.0 (your-email@example.com)
VITE_API_BASE_URL=
VITE_DISCORD_CLIENT_ID=
VITE_DISCORD_REDIRECT_URI=
```

Set `VITE_DISCORD_CLIENT_ID` and `VITE_DISCORD_REDIRECT_URI` when testing Discord login. For the Docker frontend, the default app URL is `http://localhost:8080`.

`MUSICBRAINZ_USER_AGENT` defaults to this repository's contact URL. Override it with an application name, version, and real contact URL or email for your deployment; MusicBrainz requires this identification for API requests.

`VITE_API_BASE_URL` is optional. When set, it can be either the backend origin, such as `http://localhost:3000`, or the full API base, such as `http://localhost:3000/api`.

## Docker Commands

Use the Makefile for container lifecycle commands:

```sh
make up
```

This builds and starts:

- `frontend`: Vite app served by Nginx at `http://localhost:8080`
- `backend`: Fastify API at `http://localhost:3000`
- `postgres`: PostgreSQL 16 with a named Docker volume
- `adminer`: database web UI at `http://localhost:8081`

Common commands:

```sh
make ps          # show running services
make logs        # follow service logs
make health      # check http://localhost:8080/health
make collection  # check http://localhost:8080/api/collection
make db-ui       # print database web UI connection details
make stop        # stop containers without removing them
make down        # stop and remove containers/networks
make destroy     # remove containers, networks, volumes, and local images
```

`make destroy` removes the Postgres Docker volume, so local database data is deleted.

## Docker Watch Mode

Use watch mode for day-to-day development:

```sh
make watch
```

This runs the full stack in the foreground with source folders mounted into the containers:

- Vite dev server at `http://localhost:5173`
- Fastify backend watcher at `http://localhost:3000`
- PostgreSQL at `localhost:5432`
- Adminer database web UI at `http://localhost:8081`

Frontend requests to `/api/*` and `/health` are proxied by Vite to the backend container, so the app can keep using same-origin API URLs during development.

Useful watch-mode commands:

```sh
make dev-health      # check http://localhost:5173/health
make dev-collection  # check http://localhost:5173/api/collection
make dev-db-ui       # print database web UI connection details
make watch-down      # stop and remove the watch-mode containers
```

## Local Development

Install dependencies:

```sh
make install
```

Run local checks/builds:

```sh
make build
make frontend-build
make backend-build
```

Run frontend and backend development servers separately:

```sh
npm run dev
npm run dev --prefix backend
```

When running the backend locally outside Docker, set `DATABASE_URL` to a reachable PostgreSQL instance. The Vite dev server proxies `/api` and `/health` to `http://localhost:3000` by default. Override that with `VITE_DEV_API_URL` if your backend runs elsewhere.

## API

- `GET /health` returns backend/database health.
- `GET /api/collection` returns collection rows in the frontend shape.
- `POST /api/discord` accepts the Discord OAuth payload, fetches Discord user info, upserts into `users`, and returns `{ success, data, queryType }`.

Through Docker/Nginx, use the frontend origin:

```sh
curl http://localhost:8080/health
curl http://localhost:8080/api/collection
```

## Database

Schema initialization is in `postgres/init/001_schema.sql`. It creates:

- `artist`
- `album`
- `collection`
- `users`

The Docker database starts with schema only and no sample collection data.

Use Adminer at `http://localhost:8081` to inspect the Docker database:

```text
System: PostgreSQL
Server: postgres
Username: collection
Password: collection
Database: collection
```
