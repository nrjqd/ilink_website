# Docker

This setup runs the Vite frontend, FastAPI backend, and PostgreSQL database.

## Start

```bash
cd Demo
docker compose up --build
```

Frontend: http://localhost:5174

Backend API: http://localhost:8000/api/v1

Health check: http://localhost:8000/health

## Environment

Docker uses `.env.docker` by default. Keep local development values there, and copy from `.env.docker.example` if you need to reset it.

Important values:

- `DATABASE_URL`: backend database connection string inside Docker.
- `JWT_SECRET`: change this before production.
- `FRONTEND_URL`: comma-separated CORS origins.
- `TRUSTED_HOSTS`: comma-separated allowed host headers.
- `VITE_API_BASE_URL`: API URL embedded into the frontend build.

## Admin User

After the stack is running, create the first admin user:

```bash
docker compose exec backend python scripts/create_admin.py teacher@example.com "ChangeMe123!" "I-Link Admin"
```

## Import Existing Frontend Media

The frontend ships images and videos under `public/assets`, but they are not CMS records until they are registered in the backend database. Run this from the host when Admin media is empty:

```powershell
cd C:\Users\USER\Projects\figma-codex-lab\Demo\backend
.\.venv\Scripts\python.exe scripts\import_public_media.py
```

This registers the existing files in the `media` table with URLs such as `/assets/img/...` and `/assets/mv/...`.

## Seed Existing Frontend Text into CMS

The public frontend now reads CMS APIs first and falls back to static data only when the backend is unavailable. After creating or resetting the database, seed the current page, event, place, work, and timeline text into PostgreSQL:

```powershell
cd C:\Users\USER\Projects\figma-codex-lab\Demo
node scripts\export_static_cms.mjs

cd C:\Users\USER\Projects\figma-codex-lab\Demo\backend
.\.venv\Scripts\python.exe scripts\seed_static_cms.py
```

Then refresh `http://127.0.0.1:5174/admin`. The CMS snapshot should show non-zero `timeline_events`, `content_items`, and `media`.

## Migrations

The backend container runs `alembic upgrade head` automatically on startup. To run migrations manually:

```bash
docker compose exec backend alembic upgrade head
```

Set `RUN_MIGRATIONS=false` on the backend service if you want to disable automatic migrations.

If Alembic reports `Can't locate revision identified by ...`, the PostgreSQL volume is ahead of the backend image. Rebuild and recreate the backend container so `/app/alembic/versions` contains the latest migration files:

```bash
docker compose build backend
docker compose up -d backend
docker compose logs --tail=80 backend
```

## Stop

```bash
docker compose down
```

To remove database and upload volumes:

```bash
docker compose down -v
```
