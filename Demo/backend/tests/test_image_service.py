from io import BytesIO

import pytest
from fastapi import HTTPException
from PIL import Image

from app.services.image_service import process_image


def _image_bytes(fmt: str, size: tuple[int, int] = (4032, 3024), mode: str = "RGB") -> bytes:
    buffer = BytesIO()
    Image.new(mode, size, color=(20, 120, 180)).save(buffer, format=fmt)
    return buffer.getvalue()


def _variant_size(content: bytes) -> tuple[int, int]:
    image = Image.open(BytesIO(content))
    image.load()
    return image.size


def test_jpg_png_and_webp_can_be_processed_to_webp():
    samples = [
        (_image_bytes("JPEG"), "image/jpeg", "photo.jpg"),
        (_image_bytes("JPEG"), "image/jpeg", "photo.jpeg"),
        (_image_bytes("PNG"), "image/png", "graphic.png"),
        (_image_bytes("WEBP"), "image/webp", "source.webp"),
    ]

    for content, content_type, filename in samples:
        result = process_image(content, content_type, filename)
        assert Image.open(BytesIO(result.original.bytes)).format == "WEBP"
        assert Image.open(BytesIO(result.large.bytes)).format == "WEBP"
        assert Image.open(BytesIO(result.thumbnail.bytes)).format == "WEBP"


def test_variants_keep_aspect_ratio_and_long_edge_limits():
    result = process_image(_image_bytes("JPEG", (4032, 3024)), "image/jpeg", "photo.jpg")

    assert max(result.original.width, result.original.height) <= 2560
    assert _variant_size(result.original.bytes) == (2560, 1920)
    assert _variant_size(result.large.bytes) == (1600, 1200)
    assert _variant_size(result.thumbnail.bytes) == (600, 450)


def test_small_images_are_not_upscaled():
    result = process_image(_image_bytes("PNG", (500, 400)), "image/png", "small.png")

    assert (result.original.width, result.original.height) == (500, 400)
    assert (result.large.width, result.large.height) == (500, 400)
    assert (result.thumbnail.width, result.thumbnail.height) == (500, 400)


def test_portrait_image_keeps_ratio():
    result = process_image(_image_bytes("JPEG", (1200, 2400)), "image/jpeg", "portrait.jpg")

    assert (result.large.width, result.large.height) == (800, 1600)
    assert (result.thumbnail.width, result.thumbnail.height) == (300, 600)


def test_exif_orientation_is_applied_before_resize():
    source = Image.new("RGB", (40, 80), color=(200, 30, 30))
    exif = source.getexif()
    exif[274] = 6
    buffer = BytesIO()
    source.save(buffer, format="JPEG", exif=exif)

    result = process_image(buffer.getvalue(), "image/jpeg", "phone.jpg")

    assert (result.original.width, result.original.height) == (80, 40)


def test_transparent_png_preserves_alpha():
    buffer = BytesIO()
    Image.new("RGBA", (32, 32), color=(20, 120, 180, 96)).save(buffer, format="PNG")

    result = process_image(buffer.getvalue(), "image/png", "transparent.png")
    image = Image.open(BytesIO(result.original.bytes))

    assert image.mode == "RGBA"


@pytest.mark.parametrize(
    ("content_factory", "content_type"),
    [
        (lambda: b"", "image/png"),
        (lambda: b"not an image", "image/png"),
        (lambda: _image_bytes("PNG", (32, 24)), "text/plain"),
    ],
    ids=["empty", "invalid-bytes", "invalid-mime"],
)
def test_invalid_uploads_are_rejected(content_factory, content_type: str):
    with pytest.raises(HTTPException):
        process_image(content_factory(), content_type, "image.png")


def test_invalid_file_extension_is_rejected():
    with pytest.raises(HTTPException):
        process_image(_image_bytes("PNG", (32, 24)), "image/png", "image.gif")
