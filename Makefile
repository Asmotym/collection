COMPOSE := docker compose
COMPOSE_WATCH := docker compose -f docker-compose.watch.yml

.PHONY: help install build frontend-build backend-build up watch watch-down start rebuild stop down destroy restart logs ps health collection db-ui dev-health dev-collection dev-db-ui clean

help:
	@printf '%s\n' \
		'Available commands:' \
		'  make install         Install frontend and backend dependencies' \
		'  make build           Build frontend and backend locally' \
		'  make frontend-build  Build the Vite frontend locally' \
		'  make backend-build   Build the Fastify backend locally' \
		'  make up              Build and start Docker services in the background' \
		'  make watch           Run the Docker dev stack in watch mode' \
		'  make watch-down      Stop and remove the Docker dev stack' \
		'  make start           Start existing Docker services' \
		'  make rebuild         Rebuild Docker images without using cache' \
		'  make stop            Stop Docker services without removing containers' \
		'  make down            Stop and remove Docker containers and networks' \
		'  make destroy         Remove Docker containers, networks, volumes, and local images' \
		'  make restart         Restart Docker services' \
		'  make logs            Follow Docker service logs' \
		'  make ps              Show Docker service status' \
		'  make health          Check backend health through the frontend proxy' \
		'  make collection      Check the collection API through the frontend proxy' \
		'  make db-ui           Print the database web interface URL' \
		'  make dev-health      Check backend health through Vite dev proxy' \
		'  make dev-collection  Check collection API through Vite dev proxy' \
		'  make dev-db-ui       Print the dev database web interface URL' \
		'  make clean           Remove local build output'

install:
	npm install
	npm install --prefix backend

build: frontend-build backend-build

frontend-build:
	npm run build

backend-build:
	npm run build --prefix backend

up:
	$(COMPOSE) up --build -d

watch:
	$(COMPOSE_WATCH) up --build

watch-down:
	$(COMPOSE_WATCH) down --remove-orphans

start:
	$(COMPOSE) start

rebuild:
	$(COMPOSE) build --no-cache

stop:
	$(COMPOSE) stop

down:
	$(COMPOSE) down --remove-orphans

destroy:
	$(COMPOSE) down --volumes --remove-orphans --rmi local

restart:
	$(COMPOSE) restart

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

health:
	curl -sS http://localhost:8080/health

collection:
	curl -sS http://localhost:8080/api/collection

db-ui:
	@printf '%s\n' 'Adminer: http://localhost:8081'
	@printf '%s\n' 'System: PostgreSQL | Server: postgres | Username: collection | Password: collection | Database: collection'

dev-health:
	curl -sS http://localhost:5173/health

dev-collection:
	curl -sS http://localhost:5173/api/collection

dev-db-ui: db-ui

clean:
	rm -rf dist backend/dist
