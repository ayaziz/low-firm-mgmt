# ──────────────────────────────────────────────────────
#  LOMA – Law Office Management Application
#  Makefile
# ──────────────────────────────────────────────────────

.PHONY: build up down logs seed test test-e2e clean help

## Build all Docker images
build:
	docker compose build

## Start all services (Postgres, Redis, MinIO, Backend, Frontend, Nginx)
up:
	docker compose up --build -d

## Stop and remove all containers
down:
	docker compose down

## Stop and remove containers + volumes (full reset)
clean:
	docker compose down -v

## Tail logs from all services
logs:
	docker compose logs -f

## Run DB migrations + seed (standalone)
seed:
	docker compose run --rm db-init

## Run backend unit tests (local, no Docker required)
test:
	cd backend && npm test

## Run backend integration tests (requires Docker services running)
test-e2e:
	cd backend && npm run test:e2e

## Install all dependencies (local dev)
install:
	cd backend && npm install
	cd frontend && npm install

## Show available commands
help:
	@echo ""
	@echo "  LOMA – Available make targets:"
	@echo "  ─────────────────────────────────"
	@echo "  make build      Build Docker images"
	@echo "  make up         Start all services"
	@echo "  make down       Stop all services"
	@echo "  make clean      Stop + remove volumes"
	@echo "  make logs       Tail service logs"
	@echo "  make seed       Run DB migrations & seed"
	@echo "  make test       Run backend unit tests"
	@echo "  make test-e2e   Run integration tests"
	@echo "  make install    Install npm dependencies"
	@echo "  make help       Show this help"
	@echo ""
