from dataclasses import dataclass
from io import BytesIO
from pathlib import PurePath

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.exceptions import api_error

MAX_IMAGE_UPLOAD_BYTES = 15 * 1024 * 1024
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MIN_IMAGE_SIDE = 1


@dataclass(frozen=True)
class ImageVariant:
    bytes: bytes
    width: int
    height: int


@dataclass(frozen=True)
class ImageVariantSet:
    original: ImageVariant
    large: ImageVariant
    thumbnail: ImageVariant


def _normalize_mode(image: Image.Image) -> Image.Image:
    has_alpha = image.mode in {"RGBA", "LA"} or (image.mode == "P" and "transparency" in image.info)
    if has_alpha:
        return image.convert("RGBA")
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def validate_image_extension(filename: str | None) -> None:
    suffix = PurePath(filename or "").suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        raise api_error(400, "UPLOAD_INVALID_EXTENSION", "Only .jpg, .jpeg, .png and .webp uploads are allowed.")


def resize_image(image: Image.Image, max_side: int) -> Image.Image:
    long_edge = max(image.width, image.height)
    if long_edge <= max_side:
        return image.copy()
    ratio = max_side / long_edge
    size = (max(1, round(image.width * ratio)), max(1, round(image.height * ratio)))
    return image.resize(size, Image.Resampling.LANCZOS)


def _encode_webp(image: Image.Image, *, max_side: int, quality: int) -> ImageVariant:
    output = resize_image(image, max_side)
    buffer = BytesIO()
    output.save(buffer, format="WEBP", quality=quality, method=6)
    return ImageVariant(bytes=buffer.getvalue(), width=output.width, height=output.height)


def process_image(content: bytes, content_type: str | None, filename: str | None = None) -> ImageVariantSet:
    if not content:
        raise api_error(400, "UPLOAD_EMPTY", "Upload file is empty.")
    if content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise api_error(400, "UPLOAD_INVALID_TYPE", "Only JPEG, PNG and WebP uploads are allowed.")
    validate_image_extension(filename)
    if len(content) > MAX_IMAGE_UPLOAD_BYTES:
        raise api_error(400, "UPLOAD_TOO_LARGE", "Upload size must be 15 MB or less.")

    try:
        image = Image.open(BytesIO(content))
        image = ImageOps.exif_transpose(image)
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise api_error(400, "UPLOAD_INVALID_IMAGE", "Invalid image file.") from exc

    if image.width < MIN_IMAGE_SIDE or image.height < MIN_IMAGE_SIDE:
        raise api_error(400, "UPLOAD_INVALID_IMAGE", "Invalid image dimensions.")

    image = _normalize_mode(image)
    return ImageVariantSet(
        original=_encode_webp(image, max_side=2560, quality=85),
        large=_encode_webp(image, max_side=1600, quality=80),
        thumbnail=_encode_webp(image, max_side=600, quality=75),
    )
