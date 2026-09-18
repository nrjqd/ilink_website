"""Configure Cloudflare R2 CORS for browser and WebGL media loading."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import boto3

BACKEND_ROOT = Path(__file__).resolve().parents[1]

REQUIRED_ENV = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
]


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def main() -> int:
    load_env(BACKEND_ROOT / ".env")
    missing = [key for key in REQUIRED_ENV if not os.environ.get(key)]
    if missing:
        print(f"Missing R2 settings: {', '.join(missing)}", file=sys.stderr)
        return 2

    endpoint = f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    )
    cors = {
        "CORSRules": [
            {
                "AllowedOrigins": [
                    "http://localhost:5174",
                    "http://127.0.0.1:5174",
                    "http://localhost:3000",
                    "http://127.0.0.1:3000",
                ],
                "AllowedMethods": ["GET", "HEAD"],
                "AllowedHeaders": ["*"],
                "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
                "MaxAgeSeconds": 86400,
            }
        ]
    }
    client.put_bucket_cors(Bucket=os.environ["R2_BUCKET_NAME"], CORSConfiguration=cors)
    print("R2 CORS configured for local frontend origins.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
