from fastapi import APIRouter

from app.api.routes import admin, auth, media, posts

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(posts.router, prefix="/posts", tags=["posts"])
api_router.include_router(media.router, prefix="/media", tags=["media"], deprecated=True)
api_router.include_router(media.router, prefix="/admin/media", tags=["admin-media"])
