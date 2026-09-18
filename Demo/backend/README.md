# I-Link Backend

FastAPI backend for the I-Link CMS article and media workflow.

## Run

```bash
cd Demo/backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

API base: `http://127.0.0.1:8000/api/v1`

Health check: `http://127.0.0.1:8000/health`

## First Admin

```bash
python scripts/create_admin.py teacher@example.com "ChangeMe123!" "I-Link Admin"
```

## CMS APIs

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/posts`
- `GET /api/v1/posts?status=published`
- `GET /api/v1/posts?status=published&timeline=true`
- `GET /api/v1/posts/{slug}`
- `GET /api/v1/posts/id/{post_id}`
- `POST /api/v1/posts`
- `PATCH /api/v1/posts/{post_id}`
- `DELETE /api/v1/posts/{post_id}`
- `POST /api/v1/media`
- `GET /api/v1/media`
- `GET /api/v1/media/{media_id}`
- `PATCH /api/v1/media/{media_id}`
- `DELETE /api/v1/media/{media_id}`

Write routes require `Authorization: Bearer <token>`. Media uploads are converted to WebP and stored as:

```text
posts/YYYY/MM/original/{uuid}.webp
posts/YYYY/MM/large/{uuid}.webp
posts/YYYY/MM/thumb/{uuid}.webp
```

Cloudflare R2 is used when all `R2_*` settings are present. Otherwise uploads are written under local `uploads/` for development.
