from io import BytesIO

from PIL import Image
import pytest
from sqlalchemy import func, select

from app.dependencies.database import get_db
from app.main import app
from app.models import Media, Post, PostMedia


def _png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (32, 24), color=(20, 120, 180)).save(buffer, format="PNG")
    return buffer.getvalue()


def _upload_image(client, admin_headers, filename: str = "image.png") -> dict:
    response = client.post(
        "/api/v1/admin/uploads",
        headers=admin_headers,
        files={"file": (filename, _png_bytes(), "image/png")},
    )
    assert response.status_code == 201
    return response.json()


def _create_post(client, admin_headers, **overrides) -> dict:
    payload = {
        "title": "Contract Post",
        "content": "Body",
        "category": "local_research",
    }
    payload.update(overrides)
    response = client.post("/api/v1/admin/posts", headers=admin_headers, json=payload)
    assert response.status_code == 201
    return response.json()


def _db_value(statement):
    with next(iter(app.dependency_overrides[get_db]())) as db:
        return db.scalar(statement)


def _db_values(statement):
    with next(iter(app.dependency_overrides[get_db]())) as db:
        return list(db.scalars(statement).all())


def test_media_upload_and_post_crud(client, admin_headers):
    upload = client.post(
        "/api/v1/media",
        headers=admin_headers,
        files={"file": ("cover.png", _png_bytes(), "image/png")},
    )
    assert upload.status_code == 201
    media = upload.json()
    assert media["mime_type"] == "image/webp"
    assert media["large_object_key"].startswith("posts/")
    assert media["large_object_key"].endswith("/large.webp")
    assert media["thumbnail_object_key"].endswith("/thumbnail.webp")

    create = client.post(
        "/api/v1/posts",
        headers=admin_headers,
        json={
            "title": "Qishan Culture Tour",
            "summary": "A local event.",
            "content": "Article body",
            "category": "local_research",
            "event_date": "2026-03-17",
            "cover_media_id": media["id"],
            "gallery_media": [{"media_id": media["id"], "sort_order": 1, "caption": "Cover"}],
        },
    )
    assert create.status_code == 201
    post = create.json()
    assert post["slug"] == "qishan-culture-tour"
    assert post["region"] is None
    assert post["status"] == "draft"
    assert post["cover_media"]["id"] == media["id"]
    assert post["gallery_links"][0]["media_id"] == media["id"]

    publish = client.post(
        f"/api/v1/admin/posts/{post['id']}/publish",
        headers=admin_headers,
    )
    assert publish.status_code == 200
    assert publish.json()["published_at"] is not None

    public_detail = client.get("/api/v1/posts/qishan-culture-tour")
    assert public_detail.status_code == 200
    assert public_detail.json()["status"] == "published"

    delete = client.delete(f"/api/v1/posts/{post['id']}", headers=admin_headers)
    assert delete.status_code == 200
    assert delete.json()["status"] == "archived"
    assert delete.json()["deleted_at"] is None
    assert client.get("/api/v1/posts/qishan-culture-tour").status_code == 404


def test_timeline_is_derived_from_published_posts(client, admin_headers):
    payloads = [
        {
            "title": "Later Event",
            "content": "Body",
            "category": "local_research",
            "event_date": "2026-05-10",
        },
        {
            "title": "Earlier Event",
            "content": "Body",
            "category": "craft_design",
            "event_date": "2026-03-17",
        },
    ]
    for payload in payloads:
        response = client.post("/api/v1/posts", headers=admin_headers, json=payload)
        assert response.status_code == 201
        publish = client.post(f"/api/v1/admin/posts/{response.json()['id']}/publish", headers=admin_headers)
        assert publish.status_code == 200

    timeline = client.get("/api/v1/posts?status=published&timeline=true")
    assert timeline.status_code == 200
    titles = [item["title"] for item in timeline.json()["items"]]
    assert titles == ["Earlier Event", "Later Event"]


def test_post_create_and_update_reject_managed_fields(client, admin_headers):
    create = client.post(
        "/api/v1/posts",
        headers=admin_headers,
        json={
            "title": "Managed Fields",
            "content": "Body",
            "category": "local_research",
            "slug": "custom-slug",
            "status": "published",
        },
    )
    assert create.status_code == 422

    response = client.post(
        "/api/v1/posts",
        headers=admin_headers,
        json={"title": "Immutable Slug", "content": "Body", "category": "local_research"},
    )
    assert response.status_code == 201
    post = response.json()

    update = client.patch(
        f"/api/v1/posts/{post['id']}",
        headers=admin_headers,
        json={"slug": "changed", "status": "published"},
    )
    assert update.status_code == 422


@pytest.mark.parametrize(
    "category",
    ["local_research", "craft_design", "industry_record", "ai_application", "sustainability"],
)
def test_new_post_categories_are_valid(client, admin_headers, category):
    response = client.post(
        "/api/v1/admin/posts",
        headers=admin_headers,
        json={"title": f"{category} Post", "content": "Body", "category": category},
    )
    assert response.status_code == 201
    assert response.json()["category"] == category


@pytest.mark.parametrize(
    "category",
    ["local_research", "craft_design", "industry_record", "ai_application", "sustainability"],
)
def test_new_post_category_filters_are_valid(client, admin_headers, category):
    post = _create_post(client, admin_headers, title=f"{category} Filter Post", category=category)
    publish = client.post(f"/api/v1/admin/posts/{post['id']}/publish", headers=admin_headers)
    assert publish.status_code == 200

    response = client.get(f"/api/v1/posts?category={category}&status=published")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["category"] == category


@pytest.mark.parametrize("legacy_category", ["event", "student_work", "story", "place", "achievement"])
def test_legacy_post_categories_are_rejected(client, admin_headers, legacy_category):
    response = client.post(
        "/api/v1/admin/posts",
        headers=admin_headers,
        json={"title": "Legacy Category", "content": "Body", "category": legacy_category},
    )
    assert response.status_code == 422

    public_filter = client.get(f"/api/v1/posts?category={legacy_category}")
    assert public_filter.status_code == 422


def test_post_region_can_be_managed_and_filtered(client, admin_headers):
    qishan = _create_post(
        client,
        admin_headers,
        title="Qishan Student Work",
        category="craft_design",
        region="qishan",
    )
    assert qishan["region"] == "qishan"
    publish_qishan = client.post(f"/api/v1/admin/posts/{qishan['id']}/publish", headers=admin_headers)
    assert publish_qishan.status_code == 200

    meinong = _create_post(
        client,
        admin_headers,
        title="Meinong Student Work",
        category="craft_design",
        region="meinong",
    )
    publish_meinong = client.post(f"/api/v1/admin/posts/{meinong['id']}/publish", headers=admin_headers)
    assert publish_meinong.status_code == 200

    qishan_only = client.get("/api/v1/posts?category=craft_design&status=published&region=qishan")
    assert qishan_only.status_code == 200
    payload = qishan_only.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == qishan["id"]
    assert payload["items"][0]["category"] == "craft_design"
    assert payload["items"][0]["region"] == "qishan"

    update = client.patch(
        f"/api/v1/admin/posts/{qishan['id']}",
        headers=admin_headers,
        json={"region": "neimen"},
    )
    assert update.status_code == 200
    assert update.json()["region"] == "neimen"

    qishan_after_update = client.get("/api/v1/posts?category=craft_design&status=published&region=qishan")
    assert qishan_after_update.status_code == 200
    assert qishan_after_update.json()["total"] == 0


def test_post_category_filter_and_region_category_filter(client, admin_headers):
    qishan_ai = _create_post(
        client,
        admin_headers,
        title="Qishan AI Work",
        category="ai_application",
        region="qishan",
    )
    client.post(f"/api/v1/admin/posts/{qishan_ai['id']}/publish", headers=admin_headers)

    meinong_ai = _create_post(
        client,
        admin_headers,
        title="Meinong AI Work",
        category="ai_application",
        region="meinong",
    )
    client.post(f"/api/v1/admin/posts/{meinong_ai['id']}/publish", headers=admin_headers)

    craft = _create_post(
        client,
        admin_headers,
        title="Craft Work",
        category="craft_design",
        region="qishan",
    )
    client.post(f"/api/v1/admin/posts/{craft['id']}/publish", headers=admin_headers)

    ai_posts = client.get("/api/v1/posts?category=ai_application&status=published")
    assert ai_posts.status_code == 200
    assert ai_posts.json()["total"] == 2

    qishan_ai_only = client.get("/api/v1/posts?category=ai_application&region=qishan&status=published")
    assert qishan_ai_only.status_code == 200
    payload = qishan_ai_only.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == qishan_ai["id"]


def test_event_date_timeline_does_not_depend_on_event_category(client, admin_headers):
    event_dated = _create_post(
        client,
        admin_headers,
        title="Dated Research Event",
        category="local_research",
        event_date="2026-03-17",
    )
    undated = _create_post(
        client,
        admin_headers,
        title="Undated Research",
        category="local_research",
    )
    client.post(f"/api/v1/admin/posts/{event_dated['id']}/publish", headers=admin_headers)
    client.post(f"/api/v1/admin/posts/{undated['id']}/publish", headers=admin_headers)

    timeline = client.get("/api/v1/posts?status=published&timeline=true")
    assert timeline.status_code == 200
    ids = [item["id"] for item in timeline.json()["items"]]
    assert event_dated["id"] in ids
    assert undated["id"] not in ids


def test_legacy_null_category_serializes_in_public_list(client, admin_headers):
    with next(iter(app.dependency_overrides[get_db]())) as db:
        post = Post(
            title="Legacy Null Category",
            slug="legacy-null-category",
            summary="Legacy",
            content="Body",
            category=None,
            status="published",
        )
        db.add(post)
        db.commit()
        post_id = post.id

    response = client.get("/api/v1/posts?status=published")
    assert response.status_code == 200
    item = next(item for item in response.json()["items"] if item["id"] == post_id)
    assert item["category"] is None


def test_post_patch_title_preserves_gallery_when_gallery_omitted(client, admin_headers):
    media_ids = []
    for filename in ("first.png", "second.png"):
        upload = client.post(
            "/api/v1/admin/uploads",
            headers=admin_headers,
            files={"file": (filename, _png_bytes(), "image/png")},
        )
        assert upload.status_code == 201
        media_ids.append(upload.json()["id"])

    create = client.post(
        "/api/v1/admin/posts",
        headers=admin_headers,
        json={
            "title": "Gallery Contract",
            "content": "Body",
            "category": "local_research",
            "gallery_media": [
                {"media_id": media_ids[0], "sort_order": 0, "caption": "First"},
                {"media_id": media_ids[1], "sort_order": 1, "caption": "Second"},
            ],
        },
    )
    assert create.status_code == 201
    post = create.json()

    update = client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        headers=admin_headers,
        json={"title": "Gallery Contract Updated"},
    )
    assert update.status_code == 200
    payload = update.json()
    assert payload["title"] == "Gallery Contract Updated"
    assert [link["media_id"] for link in payload["gallery_links"]] == media_ids


def test_post_patch_empty_gallery_clears_gallery(client, admin_headers):
    upload = client.post(
        "/api/v1/admin/uploads",
        headers=admin_headers,
        files={"file": ("gallery.png", _png_bytes(), "image/png")},
    )
    assert upload.status_code == 201
    media_id = upload.json()["id"]

    create = client.post(
        "/api/v1/admin/posts",
        headers=admin_headers,
        json={
            "title": "Clear Gallery",
            "content": "Body",
            "category": "local_research",
            "gallery_media": [{"media_id": media_id, "sort_order": 0, "caption": "Gallery"}],
        },
    )
    assert create.status_code == 201
    post = create.json()

    update = client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        headers=admin_headers,
        json={"gallery_media": []},
    )
    assert update.status_code == 200
    assert update.json()["gallery_links"] == []


def test_post_patch_null_event_date_clears_date(client, admin_headers):
    create = client.post(
        "/api/v1/admin/posts",
        headers=admin_headers,
        json={"title": "Date Contract", "content": "Body", "category": "local_research", "event_date": "2026-09-14"},
    )
    assert create.status_code == 201
    post = create.json()

    update = client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        headers=admin_headers,
        json={"event_date": None},
    )
    assert update.status_code == 200
    assert update.json()["event_date"] is None


def test_validation_errors_include_field_details(client, admin_headers):
    create = client.post(
        "/api/v1/admin/posts",
        headers=admin_headers,
        json={"title": "Validation Details", "content": "Body", "category": "local_research"},
    )
    assert create.status_code == 201
    post = create.json()

    invalid = client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        headers=admin_headers,
        json={"event_date": "", "cover_media_id": 0, "slug": "changed"},
    )
    assert invalid.status_code == 422
    error = invalid.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    fields = {".".join(str(part) for part in detail["loc"]) for detail in error["details"]}
    assert "body.event_date" in fields
    assert "body.cover_media_id" in fields
    assert "body.slug" in fields


def test_full_post_response_patch_is_rejected_with_extra_field_details(client, admin_headers):
    create = client.post(
        "/api/v1/admin/posts",
        headers=admin_headers,
        json={"title": "Full Response", "content": "Body", "category": "local_research"},
    )
    assert create.status_code == 201
    post = create.json()

    update = client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        headers=admin_headers,
        json=post,
    )
    assert update.status_code == 422
    fields = {".".join(str(part) for part in detail["loc"]) for detail in update.json()["error"]["details"]}
    assert "body.id" in fields
    assert "body.slug" in fields
    assert "body.gallery_links" in fields


def test_post_patch_cover_can_change_and_clear(client, admin_headers):
    first_media = _upload_image(client, admin_headers, "first-cover.png")
    second_media = _upload_image(client, admin_headers, "second-cover.png")
    post = _create_post(client, admin_headers, cover_media_id=first_media["id"])

    changed = client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        headers=admin_headers,
        json={"cover_media_id": second_media["id"]},
    )
    assert changed.status_code == 200
    assert changed.json()["cover_media_id"] == second_media["id"]
    assert changed.json()["cover_media"]["id"] == second_media["id"]

    cleared = client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        headers=admin_headers,
        json={"cover_media_id": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["cover_media_id"] is None
    assert cleared.json()["cover_media"] is None


def test_post_create_persists_cover_media_id_to_database(client, admin_headers):
    media = _upload_image(client, admin_headers, "create-cover-db.png")
    post = _create_post(client, admin_headers, title="Create Cover DB", cover_media_id=media["id"])

    assert post["cover_media_id"] == media["id"]
    assert post["cover_media"]["id"] == media["id"]
    assert _db_value(select(Post.cover_media_id).where(Post.id == post["id"])) == media["id"]


def test_post_update_persists_cover_media_id_to_database(client, admin_headers):
    media = _upload_image(client, admin_headers, "update-cover-db.png")
    post = _create_post(client, admin_headers, title="Update Cover DB")

    update = client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        headers=admin_headers,
        json={"cover_media_id": media["id"]},
    )

    assert update.status_code == 200
    assert update.json()["cover_media_id"] == media["id"]
    assert update.json()["cover_media"]["id"] == media["id"]
    assert _db_value(select(Post.cover_media_id).where(Post.id == post["id"])) == media["id"]


def test_post_cover_rejects_missing_media_id(client, admin_headers):
    create = client.post(
        "/api/v1/admin/posts",
        headers=admin_headers,
        json={"title": "Missing Cover", "content": "Body", "category": "local_research", "cover_media_id": 999},
    )
    assert create.status_code == 404
    assert create.json()["error"]["code"] == "MEDIA_NOT_FOUND"

    post = _create_post(client, admin_headers, title="Missing Cover Update")
    update = client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        headers=admin_headers,
        json={"cover_media_id": 999},
    )
    assert update.status_code == 404
    assert update.json()["error"]["code"] == "MEDIA_NOT_FOUND"


def test_multiple_posts_can_reuse_same_cover_media_without_duplicate_media(client, admin_headers):
    media = _upload_image(client, admin_headers, "shared-cover.png")
    first = _create_post(client, admin_headers, title="Shared Cover A", cover_media_id=media["id"])
    second = _create_post(client, admin_headers, title="Shared Cover B", cover_media_id=media["id"])

    cover_ids = _db_values(
        select(Post.cover_media_id).where(Post.id.in_([first["id"], second["id"]])).order_by(Post.id.asc())
    )
    assert cover_ids == [media["id"], media["id"]]
    assert _db_value(select(func.count(Media.id)).where(Media.id == media["id"])) == 1


def test_post_list_and_detail_serialize_cover_media(client, admin_headers):
    media = _upload_image(client, admin_headers, "serialized-cover.png")
    post = _create_post(client, admin_headers, title="Serialized Cover", cover_media_id=media["id"])

    listing = client.get("/api/v1/admin/posts", headers=admin_headers)
    assert listing.status_code == 200
    listed = next(item for item in listing.json()["items"] if item["id"] == post["id"])
    assert listed["cover_media_id"] == media["id"]
    assert listed["cover_media"]["id"] == media["id"]
    assert listed["cover_media"]["thumbnail_url"]

    detail = client.get(f"/api/v1/admin/posts/{post['id']}", headers=admin_headers)
    assert detail.status_code == 200
    assert detail.json()["cover_media_id"] == media["id"]
    assert detail.json()["cover_media"]["id"] == media["id"]
    assert detail.json()["cover_media"]["large_url"]


def test_post_patch_gallery_can_remove_reorder_and_update_caption(client, admin_headers):
    first_media = _upload_image(client, admin_headers, "first-gallery.png")
    second_media = _upload_image(client, admin_headers, "second-gallery.png")
    third_media = _upload_image(client, admin_headers, "third-gallery.png")
    post = _create_post(
        client,
        admin_headers,
        gallery_media=[
            {"media_id": first_media["id"], "sort_order": 0, "caption": "First"},
            {"media_id": second_media["id"], "sort_order": 1, "caption": "Second"},
            {"media_id": third_media["id"], "sort_order": 2, "caption": "Third"},
        ],
    )

    update = client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        headers=admin_headers,
        json={
            "gallery_media": [
                {"media_id": third_media["id"], "sort_order": 0, "caption": "Third moved"},
                {"media_id": first_media["id"], "sort_order": 1, "caption": None},
            ]
        },
    )
    assert update.status_code == 200
    links = update.json()["gallery_links"]
    assert [link["media_id"] for link in links] == [third_media["id"], first_media["id"]]
    assert [link["caption"] for link in links] == ["Third moved", None]


def test_post_patch_rejects_nested_gallery_response_fields(client, admin_headers):
    media = _upload_image(client, admin_headers, "nested-extra.png")
    post = _create_post(
        client,
        admin_headers,
        gallery_media=[{"media_id": media["id"], "sort_order": 0, "caption": "Original"}],
    )
    gallery_record = post["gallery_links"][0]

    update = client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        headers=admin_headers,
        json={"gallery_media": [gallery_record]},
    )
    assert update.status_code == 422
    fields = {".".join(str(part) for part in detail["loc"]) for detail in update.json()["error"]["details"]}
    assert "body.gallery_media.0.id" in fields
    assert "body.gallery_media.0.post_id" in fields
    assert "body.gallery_media.0.media" in fields
    assert "body.gallery_media.0.created_at" in fields


def test_media_update_rejects_response_only_fields(client, admin_headers):
    media = _upload_image(client, admin_headers, "media-extra.png")

    update = client.patch(
        f"/api/v1/admin/media/{media['id']}",
        headers=admin_headers,
        json=media,
    )
    assert update.status_code == 422
    fields = {".".join(str(part) for part in detail["loc"]) for detail in update.json()["error"]["details"]}
    assert "body.id" in fields
    assert "body.original_url" in fields
    assert "body.thumbnail_object_key" in fields


def test_media_update_rejects_empty_filename_and_allows_null_noop(client, admin_headers):
    media = _upload_image(client, admin_headers, "media-empty-name.png")

    empty = client.patch(
        f"/api/v1/admin/media/{media['id']}",
        headers=admin_headers,
        json={"original_filename": ""},
    )
    assert empty.status_code == 422
    fields = {".".join(str(part) for part in detail["loc"]) for detail in empty.json()["error"]["details"]}
    assert "body.original_filename" in fields

    null_noop = client.patch(
        f"/api/v1/admin/media/{media['id']}",
        headers=admin_headers,
        json={"original_filename": None},
    )
    assert null_noop.status_code == 200
    assert null_noop.json()["original_filename"] == media["original_filename"]


def test_media_delete_rejects_media_used_as_cover_or_gallery(client, admin_headers):
    cover_media = _upload_image(client, admin_headers, "in-use-cover.png")
    gallery_media = _upload_image(client, admin_headers, "in-use-gallery.png")
    post = _create_post(
        client,
        admin_headers,
        cover_media_id=cover_media["id"],
        gallery_media=[{"media_id": gallery_media["id"], "sort_order": 0, "caption": "Gallery"}],
    )

    cover_delete = client.delete(f"/api/v1/admin/media/{cover_media['id']}", headers=admin_headers)
    assert cover_delete.status_code == 409
    assert cover_delete.json()["error"]["code"] == "MEDIA_IN_USE"

    gallery_delete = client.delete(f"/api/v1/admin/media/{gallery_media['id']}", headers=admin_headers)
    assert gallery_delete.status_code == 409
    assert gallery_delete.json()["error"]["code"] == "MEDIA_IN_USE"

    unlink = client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        headers=admin_headers,
        json={"cover_media_id": None, "gallery_media": []},
    )
    assert unlink.status_code == 200

    cover_delete_after_unlink = client.delete(f"/api/v1/admin/media/{cover_media['id']}", headers=admin_headers)
    assert cover_delete_after_unlink.status_code == 200
    gallery_delete_after_unlink = client.delete(f"/api/v1/admin/media/{gallery_media['id']}", headers=admin_headers)
    assert gallery_delete_after_unlink.status_code == 200


def test_public_write_routes_still_require_admin_auth(client):
    post_create = client.post(
        "/api/v1/posts",
        json={"title": "Unauthorized", "content": "Body", "category": "local_research"},
    )
    assert post_create.status_code in {401, 403}

    post_patch = client.patch("/api/v1/posts/1", json={"title": "Unauthorized"})
    assert post_patch.status_code in {401, 403}

    post_delete = client.delete("/api/v1/posts/1")
    assert post_delete.status_code in {401, 403}

    media_patch = client.patch("/api/v1/media/1", json={"original_filename": "name.png"})
    assert media_patch.status_code in {401, 403}

    media_delete = client.delete("/api/v1/media/1")
    assert media_delete.status_code in {401, 403}


def test_admin_write_routes_remain_available(client, admin_headers):
    media = _upload_image(client, admin_headers, "admin-route.png")
    post = _create_post(client, admin_headers, cover_media_id=media["id"])

    post_update = client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        headers=admin_headers,
        json={"summary": "Updated through admin route"},
    )
    assert post_update.status_code == 200
    assert post_update.json()["summary"] == "Updated through admin route"

    media_update = client.patch(
        f"/api/v1/admin/media/{media['id']}",
        headers=admin_headers,
        json={"original_filename": "renamed.png"},
    )
    assert media_update.status_code == 200
    assert media_update.json()["original_filename"] == "renamed.png"


def test_public_write_routes_are_marked_deprecated_in_openapi(client):
    schema = client.get("/openapi.json").json()

    assert schema["paths"]["/api/v1/posts"]["post"]["deprecated"] is True
    assert schema["paths"]["/api/v1/posts/{post_id}"]["patch"]["deprecated"] is True
    assert schema["paths"]["/api/v1/posts/{post_id}"]["delete"]["deprecated"] is True
    assert schema["paths"]["/api/v1/media"]["post"]["deprecated"] is True
    assert schema["paths"]["/api/v1/media/{media_id}"]["patch"]["deprecated"] is True
    assert schema["paths"]["/api/v1/media/{media_id}"]["delete"]["deprecated"] is True

    assert "deprecated" not in schema["paths"]["/api/v1/admin/posts"]["post"]
    assert "deprecated" not in schema["paths"]["/api/v1/admin/posts/{post_id}"]["patch"]
    assert "deprecated" not in schema["paths"]["/api/v1/admin/media"]["post"]
    assert "deprecated" not in schema["paths"]["/api/v1/admin/media/{media_id}"]["patch"]


@pytest.mark.parametrize(
    ("patch", "expected"),
    [
        ({"summary": "Updated summary"}, {"summary": "Updated summary"}),
        ({"summary": None}, {"summary": None}),
        ({"content": "Updated body"}, {"content": "Updated body"}),
        ({"category": "ai_application"}, {"category": "ai_application"}),
        ({"event_date": "2026-10-01"}, {"event_date": "2026-10-01"}),
    ],
)
def test_post_patch_scalar_fields(client, admin_headers, patch, expected):
    post = _create_post(client, admin_headers, summary="Initial summary", event_date=None)

    update = client.patch(f"/api/v1/admin/posts/{post['id']}", headers=admin_headers, json=patch)
    assert update.status_code == 200
    payload = update.json()
    for key, value in expected.items():
        assert payload[key] == value
    assert payload["slug"] == post["slug"]


@pytest.mark.parametrize(
    ("patch", "field"),
    [
        ({"title": ""}, "body.title"),
        ({"content": ""}, "body.content"),
        ({"event_date": ""}, "body.event_date"),
        ({"cover_media_id": 0}, "body.cover_media_id"),
        ({"gallery_media": [{"media_id": 0, "sort_order": 0}]}, "body.gallery_media.0.media_id"),
    ],
)
def test_post_patch_rejects_invalid_values_with_field_details(client, admin_headers, patch, field):
    post = _create_post(client, admin_headers)

    update = client.patch(f"/api/v1/admin/posts/{post['id']}", headers=admin_headers, json=patch)
    assert update.status_code == 422
    fields = {".".join(str(part) for part in detail["loc"]) for detail in update.json()["error"]["details"]}
    assert field in fields


def test_post_update_keeps_status_for_draft_and_published_posts(client, admin_headers):
    draft = _create_post(client, admin_headers, title="Draft Update")
    draft_update = client.patch(
        f"/api/v1/admin/posts/{draft['id']}",
        headers=admin_headers,
        json={"title": "Draft Update Edited"},
    )
    assert draft_update.status_code == 200
    assert draft_update.json()["status"] == "draft"
    assert draft_update.json()["published_at"] is None

    publish = client.post(f"/api/v1/admin/posts/{draft['id']}/publish", headers=admin_headers)
    assert publish.status_code == 200
    published_at = publish.json()["published_at"]

    published_update = client.patch(
        f"/api/v1/admin/posts/{draft['id']}",
        headers=admin_headers,
        json={"summary": "Published edit"},
    )
    assert published_update.status_code == 200
    assert published_update.json()["status"] == "published"
    assert published_update.json()["published_at"] == published_at


def test_admin_archive_keeps_post_out_of_trash(client, admin_headers):
    post = _create_post(client, admin_headers, title="Archive Lifecycle", event_date="2026-09-16")
    publish = client.post(f"/api/v1/admin/posts/{post['id']}/publish", headers=admin_headers)
    assert publish.status_code == 200

    archive = client.post(f"/api/v1/admin/posts/{post['id']}/archive", headers=admin_headers)
    assert archive.status_code == 200
    payload = archive.json()
    assert payload["status"] == "archived"
    assert payload["published_at"] is None
    assert payload["deleted_at"] is None

    admin_list = client.get("/api/v1/admin/posts?status=archived", headers=admin_headers)
    assert admin_list.status_code == 200
    assert post["id"] in [item["id"] for item in admin_list.json()["items"]]

    trash = client.get("/api/v1/admin/posts/trash", headers=admin_headers)
    assert trash.status_code == 200
    assert post["id"] not in [item["id"] for item in trash.json()["items"]]

    public_detail = client.get(f"/api/v1/posts/{post['slug']}")
    assert public_detail.status_code == 404


def test_admin_delete_soft_deletes_and_moves_post_to_trash(client, admin_headers):
    post = _create_post(client, admin_headers, title="Soft Delete Lifecycle")

    delete = client.delete(f"/api/v1/admin/posts/{post['id']}", headers=admin_headers)
    assert delete.status_code == 200
    deleted = delete.json()
    assert deleted["status"] == "archived"
    assert deleted["published_at"] is None
    assert deleted["deleted_at"] is not None

    admin_list = client.get("/api/v1/admin/posts", headers=admin_headers)
    assert admin_list.status_code == 200
    assert post["id"] not in [item["id"] for item in admin_list.json()["items"]]

    trash = client.get("/api/v1/admin/posts/trash", headers=admin_headers)
    assert trash.status_code == 200
    assert post["id"] in [item["id"] for item in trash.json()["items"]]


def test_soft_deleted_post_is_hidden_from_public_detail_list_and_timeline(client, admin_headers):
    post = _create_post(
        client,
        admin_headers,
        title="Public Hidden Deleted",
        event_date="2026-10-03",
    )
    publish = client.post(f"/api/v1/admin/posts/{post['id']}/publish", headers=admin_headers)
    assert publish.status_code == 200
    delete = client.delete(f"/api/v1/admin/posts/{post['id']}", headers=admin_headers)
    assert delete.status_code == 200

    public_detail = client.get(f"/api/v1/posts/{post['slug']}")
    assert public_detail.status_code == 404
    assert public_detail.json()["error"]["code"] == "POST_NOT_FOUND"

    public_list = client.get("/api/v1/posts?status=published")
    assert public_list.status_code == 200
    assert post["id"] not in [item["id"] for item in public_list.json()["items"]]

    timeline = client.get("/api/v1/posts?status=published&timeline=true")
    assert timeline.status_code == 200
    assert post["id"] not in [item["id"] for item in timeline.json()["items"]]


def test_admin_restore_deleted_post_returns_draft(client, admin_headers):
    post = _create_post(client, admin_headers, title="Restore Lifecycle")
    publish = client.post(f"/api/v1/admin/posts/{post['id']}/publish", headers=admin_headers)
    assert publish.status_code == 200
    delete = client.delete(f"/api/v1/admin/posts/{post['id']}", headers=admin_headers)
    assert delete.status_code == 200

    restore = client.post(f"/api/v1/admin/posts/{post['id']}/restore", headers=admin_headers)
    assert restore.status_code == 200
    restored = restore.json()
    assert restored["deleted_at"] is None
    assert restored["status"] == "draft"
    assert restored["published_at"] is None

    trash = client.get("/api/v1/admin/posts/trash", headers=admin_headers)
    assert trash.status_code == 200
    assert post["id"] not in [item["id"] for item in trash.json()["items"]]
    assert client.get(f"/api/v1/posts/{post['slug']}").status_code == 404


def test_admin_permanent_delete_removes_only_deleted_post(client, admin_headers):
    post = _create_post(client, admin_headers, title="Permanent Lifecycle")
    delete = client.delete(f"/api/v1/admin/posts/{post['id']}", headers=admin_headers)
    assert delete.status_code == 200

    permanent = client.delete(f"/api/v1/admin/posts/{post['id']}/permanent", headers=admin_headers)
    assert permanent.status_code == 204
    assert _db_value(select(Post.id).where(Post.id == post["id"])) is None


def test_admin_permanent_delete_removes_gallery_links_but_retains_media_and_r2(client, admin_headers, fake_r2_client):
    media = _upload_image(client, admin_headers, "gallery-retained.png")
    post = _create_post(
        client,
        admin_headers,
        title="Permanent Gallery Retains Media",
        gallery_media=[{"media_id": media["id"], "sort_order": 0, "caption": "Gallery"}],
    )
    delete = client.delete(f"/api/v1/admin/posts/{post['id']}", headers=admin_headers)
    assert delete.status_code == 200

    permanent = client.delete(f"/api/v1/admin/posts/{post['id']}/permanent", headers=admin_headers)
    assert permanent.status_code == 204

    assert _db_value(select(Post.id).where(Post.id == post["id"])) is None
    assert _db_values(select(PostMedia.id).where(PostMedia.post_id == post["id"])) == []
    assert _db_value(select(Media.id).where(Media.id == media["id"])) == media["id"]
    assert fake_r2_client.deletes == []


def test_admin_permanent_delete_retains_cover_media_and_r2(client, admin_headers, fake_r2_client):
    media = _upload_image(client, admin_headers, "cover-retained.png")
    post = _create_post(client, admin_headers, title="Permanent Cover Retains Media", cover_media_id=media["id"])
    delete = client.delete(f"/api/v1/admin/posts/{post['id']}", headers=admin_headers)
    assert delete.status_code == 200

    permanent = client.delete(f"/api/v1/admin/posts/{post['id']}/permanent", headers=admin_headers)
    assert permanent.status_code == 204

    assert _db_value(select(Post.id).where(Post.id == post["id"])) is None
    assert _db_value(select(Media.id).where(Media.id == media["id"])) == media["id"]
    assert fake_r2_client.deletes == []


def test_admin_permanent_delete_active_post_is_rejected(client, admin_headers):
    post = _create_post(client, admin_headers, title="Active Permanent Rejected")

    permanent = client.delete(f"/api/v1/admin/posts/{post['id']}/permanent", headers=admin_headers)
    assert permanent.status_code == 404
    assert permanent.json()["error"]["code"] == "POST_NOT_FOUND"
    assert _db_value(select(Post.id).where(Post.id == post["id"])) == post["id"]


def test_admin_trash_route_does_not_collide_with_post_id_route(client, admin_headers):
    trash = client.get("/api/v1/admin/posts/trash", headers=admin_headers)
    assert trash.status_code == 200
    assert "items" in trash.json()


def test_archive_keeps_post_visible_to_admin_as_archived(client, admin_headers):
    post = _create_post(client, admin_headers, title="Archive Contract")

    archive = client.post(f"/api/v1/admin/posts/{post['id']}/archive", headers=admin_headers)
    assert archive.status_code == 200
    assert archive.json()["status"] == "archived"
    assert archive.json()["deleted_at"] is None

    listing = client.get("/api/v1/admin/posts?status=archived", headers=admin_headers)
    assert listing.status_code == 200
    assert [item["id"] for item in listing.json()["items"]] == [post["id"]]

    update = client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        headers=admin_headers,
        json={"summary": "Archived edit"},
    )
    assert update.status_code == 200
    assert update.json()["status"] == "archived"
    assert update.json()["summary"] == "Archived edit"


def test_archived_posts_are_counted_in_admin_but_hidden_from_public_reads(client, admin_headers):
    post = _create_post(
        client,
        admin_headers,
        title="Archived Public Visibility",
        event_date="2026-09-14",
    )
    publish = client.post(f"/api/v1/admin/posts/{post['id']}/publish", headers=admin_headers)
    assert publish.status_code == 200

    archive = client.post(f"/api/v1/admin/posts/{post['id']}/archive", headers=admin_headers)
    assert archive.status_code == 200
    assert archive.json()["status"] == "archived"

    dashboard = client.get("/api/v1/admin/dashboard", headers=admin_headers)
    assert dashboard.status_code == 200
    assert dashboard.json()["posts"]["archived"] == 1
    assert dashboard.json()["timeline_events"]["archived"] == 1

    snapshot = client.get("/api/v1/admin/cms", headers=admin_headers)
    assert snapshot.status_code == 200
    snapshot_posts = snapshot.json()["posts"]
    assert [item["id"] for item in snapshot_posts] == [post["id"]]
    assert snapshot_posts[0]["status"] == "archived"

    public_timeline = client.get("/api/v1/posts?status=published&timeline=true")
    assert public_timeline.status_code == 200
    assert public_timeline.json()["items"] == []

    public_detail = client.get(f"/api/v1/posts/{post['slug']}")
    assert public_detail.status_code == 404


def test_openapi_keeps_distinct_admin_and_public_post_operations(client):
    schema = client.get("/openapi.json").json()

    assert schema["paths"]["/api/v1/posts"]["get"].get("deprecated") is not True
    assert schema["paths"]["/api/v1/posts"]["post"]["deprecated"] is True
    assert schema["paths"]["/api/v1/posts/{post_id}"]["patch"]["deprecated"] is True
    assert "post" in schema["paths"]["/api/v1/admin/posts"]
    assert "patch" in schema["paths"]["/api/v1/admin/posts/{post_id}"]
    assert "delete" in schema["paths"]["/api/v1/admin/posts/{post_id}"]
