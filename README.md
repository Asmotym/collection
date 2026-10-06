# Collection

Vue/Vite frontend with a TypeScript Fastify backend and PostgreSQL, designed to run locally through Docker Compose.

## Requirements

- Docker with Docker Compose
- `make` for the documented command shortcuts

All Makefile install, build, cleanup, and API check commands run inside Docker containers. Node.js, npm, and curl are not required on the host. Node.js 22 and npm are only needed if you choose to develop outside Docker.

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
CATALOG_DISCOGS_ENABLED=false
DISCOGS_TOKEN=
CATALOG_FANART_ENABLED=false
FANART_API_KEY=
CATALOG_LASTFM_ENABLED=false
LASTFM_API_KEY=
VITE_API_BASE_URL=
VITE_DISCORD_CLIENT_ID=
VITE_DISCORD_REDIRECT_URI=
```

Set `VITE_DISCORD_CLIENT_ID` and `VITE_DISCORD_REDIRECT_URI` when testing Discord login. For the Docker frontend, the default app URL is `http://localhost:8080`.

`MUSICBRAINZ_USER_AGENT` defaults to this repository's contact URL. Override it with an application name, version, and real contact URL or email for your deployment; MusicBrainz requires this identification for API requests.

Discogs, Fanart.tv, and Last.fm are optional providers. Set the matching `CATALOG_*_ENABLED` flag to `true` and provide the server-side credential to enable one. Credentials are never sent to the browser. Cover lookup gathers selectable candidates from Cover Art Archive, Discogs, and Fanart.tv; Fanart.tv requires a MusicBrainz release-group ID. Before enabling Last.fm, confirm that the deployment is non-commercial and complies with its API approval and attribution requirements. Last.fm artwork is intentionally not used. Discogs images are resolved through the backend and cached for less than six hours.

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

## Dependencies and Builds in Docker

Install dependencies:

```sh
make install
```

Build the frontend and backend:

```sh
make build
make frontend-build
make backend-build
```

These commands use temporary containers from the development images and work without a running stack. Dependencies are stored in Docker volumes; lockfile updates and build output (`dist` and `backend/dist`) are written to the mounted project directory. Run `make install` after changing dependencies to refresh the volumes. Use `make clean` to remove build output through Docker.

For server deployment, `make up` builds and starts the production images, installing dependencies during the image build. Running `make install` or `make build` first is unnecessary. API checks (`make health`, `make collection`, and their `dev-` variants) require the corresponding stack to be running and execute inside its frontend container.

## Development Outside Docker

If you prefer host-side development, install Node.js 22 and npm, then install dependencies locally:

```sh
npm install
npm install --prefix backend
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

Album rows retain the selected cover URL and store a validated copy of the image in the `image_data` (`BYTEA`) and `image_mime_type` columns. Stored artwork is served by `GET /api/albums/:id/image`; legacy rows with a URL but no image data are downloaded and backfilled the first time that endpoint is requested.

The Docker database starts with schema only and no sample collection data.

Use Adminer at `http://localhost:8081` to inspect the Docker database:

```text
System: PostgreSQL
Server: postgres
Username: collection
Password: collection
Database: collection
```
