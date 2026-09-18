"""維運腳本，協助建立管理員、匯入媒體、同步 R2 資產或修復 CMS 內的媒體路徑。

維護重點：這裡的註解說明資料流、權限邊界與副作用，讓後續調整 API、資料模型或批次腳本時能快速判斷影響範圍。
"""

from __future__ import annotations

import mimetypes
import os
import sys
from pathlib import Path

import boto3

REQUIRED_ENV = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_BASE_URL",
]

# load_env 將此步驟封裝成可測試的函式，讓路由、服務或腳本能重複使用同一套規則。
def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values

# guess_content_type 將此步驟封裝成可測試的函式，讓路由、服務或腳本能重複使用同一套規則。
def guess_content_type(path: Path) -> str:
    content_type, _ = mimetypes.guess_type(path.name)
    if path.suffix.lower() == ".webp":
        return "image/webp"
    if path.suffix.lower() == ".heic":
        return "image/heic"
    return content_type or "application/octet-stream"

# main 將此步驟封裝成可測試的函式，讓路由、服務或腳本能重複使用同一套規則。
def main() -> int:
    backend_root = Path(__file__).resolve().parents[1]
    project_root = backend_root.parent
    env_values = load_env(backend_root / ".env")

    for key, value in env_values.items():
        os.environ.setdefault(key, value)

    missing = [key for key in REQUIRED_ENV if not os.environ.get(key)]
    if missing:
        print(f"Missing R2 settings: {', '.join(missing)}", file=sys.stderr)
        return 2

    source_root = project_root / "dist" / "assets" / "img"
    if not source_root.exists():
        print(f"Source directory not found: {source_root}", file=sys.stderr)
        return 2

    files = [path for path in source_root.rglob("*") if path.is_file()]
    if not files:
        print(f"No files found in: {source_root}", file=sys.stderr)
        return 0

    endpoint = f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    )

    bucket = os.environ["R2_BUCKET_NAME"]
    public_base_url = os.environ["R2_PUBLIC_BASE_URL"].rstrip("/")
    uploaded = 0
    total_bytes = 0

    for path in files:
        relative = path.relative_to(source_root).as_posix()
        object_key = f"assets/img/{relative}"
        content_type = guess_content_type(path)
        size = path.stat().st_size

        client.upload_file(
            str(path),
            bucket,
            object_key,
            ExtraArgs={
                "ContentType": content_type,
                "CacheControl": "public, max-age=31536000, immutable",
            },
        )
        uploaded += 1
        total_bytes += size
        print(f"uploaded {object_key} ({content_type}, {size} bytes)")

    print("")
    print(f"Uploaded {uploaded} files, {total_bytes} bytes total.")
    print(f"Public base: {public_base_url}/assets/img/")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
