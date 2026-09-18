"""List R2 media objects and write an audit report for CMS repair work."""
# 將R2的資料寫進R2_MEDIA_AUDIT.json

# 讀取 .env
# → 連線 Cloudflare R2
# → 遍歷 Bucket 內所有物件
# → 整理 key / URL / size / type / thumb 狀態
# → 統計
# → 輸出 R2_MEDIA_AUDIT.json

from __future__ import annotations
# 這行是 Python 的未來相容設定。

# 它會讓型別註記：

# dict[str, int]
# Path
# str

# 在執行時不要立刻解析，而是延後處理。
from email.mime import application
import json
import mimetypes
# 這是 Python 內建的 MIME type 判斷工具。
# 例如：.jpg 可以推測成：image/jpeg
import os
# 這裡主要拿來讀取：環境變數
import sys
# 把錯誤訊息寫到「標準錯誤輸出」。
from collections import defaultdict
# 普通 dict：a = {}
#     a["img"] += 1 會出錯，因為：img還不存在。
# 但是：
# a = defaultdict(int)第一次：a["img"]
# 會自動當成：0
# 所以：a["img"] += 1
from pathlib import Path
# Path 是 Python 內建的「檔案路徑物件」。
import boto3
# 操作Cloudflare R2 提供： S3-compatible API

BACKEND_ROOT = Path(__file__).resolve().parents[1]
# __file__: 現在這支 Python 檔案自己的位置。
# .resolve(): 把它轉成完整絕對路徑。
# .parents[1]: 向上找第二層父資料夾。
PROJECT_ROOT = BACKEND_ROOT.parent
# 再 .parent 一次：
REPORT_PATH = PROJECT_ROOT / "R2_MEDIA_AUDIT.json"
# / 在 Path 裡不是除法。它代表：拼接路徑。

REQUIRED_ENV = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_BASE_URL",
]
# 建立一個 list。裡面放：這支程式一定要有的環境變數名稱。


def load_env(path: Path) -> None:
    # 定義一個函式：load_env 表示參數 path 預期是一個：Path物件。
    # -> None 這個函式不需要回傳資料。
    if not path.exists():
        return
        # 不存在就直接離開函式。
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        # 讀完整 .env .splitlines() 切成：
        # [
        #     "R2_ACCOUNT_ID=abc",
        #     "R2_BUCKET_NAME=ilink-media"
        # ]
        # 然後：for raw_line in ...一行一行處理。
        line = raw_line.strip()
        # .strip() 去除頭尾空白。
        if not line or line.startswith("#") or "=" not in line:
            # 判斷哪些行不要處理。
            # not line 代表空白行。
            # line.startswith("#") 代表註解行。
            # "=" not in line 代表沒有等號的行。
            continue
            # continue 跳過這行，處理下一行。
        key, value = line.split("=", 1)
        # 例如密碼可能是：PASSWORD=abc=123
        #如果沒有 1：abc123可能被切太多次。
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
        # 將資料放進 Python 的環境變數。
        # setdefault如果這個環境變數原本不存在，才設定它。
        # key.strip() 去除頭尾空白。
        # .strip('"') 去除頭尾雙引號。

def guess_type(key: str) -> str:
    # 輸入是一個字串。回傳也是字串。
    if key.lower().endswith(".webp"):
        # 先把 key 轉小寫
        # .endswith(".webp")檢查是不是 .webp。
        return "image/webp"
    guessed, _ = mimetypes.guess_type(key)
    # 如果不是 .webp，交給 Python 自己猜。
    # image/jpeg第二個值這裡不需要，所以用： _
    return guessed or "application/octet-stream"
    # 如果猜不到：None
    # 就回：application/octet-stream 這是一種通用二進位資料 MIME type。

def main() -> int:
    load_env(BACKEND_ROOT / ".env")
    # 並讀：Demo/backend/.env
    missing = [key for key in REQUIRED_ENV if not os.environ.get(key)]
    # 檢查 REQUIRED_ENV 裡有哪些設定沒有值。
    if missing:
        print(f"Missing R2 settings: {', '.join(missing)}", file=sys.stderr)
        # 缺少哪些設定印出來。
        return 2

    endpoint = f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"
    # r2.cloudflarestorage.com = API 管理入口
    # pub-xxxxx.r2.dev = 使用者看圖片的公開網址
    client = boto3.client(
        "s3",
        # 建立 AWS S3 client。因為 R2 相容 S3。
        endpoint_url=endpoint,
        # 不要連 AWS S3。改連：Cloudflare R2
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    )

    bucket = os.environ["R2_BUCKET_NAME"]
    # 取出 bucket 名稱。
    public_base = os.environ["R2_PUBLIC_BASE_URL"].rstrip("/")
    # 公開 URL .rstrip("/")移除最後面的 /。
    paginator = client.get_paginator("list_objects_v2")
    # ListObjectsV2 分頁器。因為 R2/S3 一次不一定會把所有 object 都回傳。所以不能只：一次請求
    objects = []
    by_prefix: dict[str, int] = defaultdict(int)
    # 立一個統計 dictionary。用途：統計 R2 第一層資料夾有多少 object。
    by_type: dict[str, int] = defaultdict(int)

    for page in paginator.paginate(Bucket=bucket):
    # 把這個 bucket 的所有頁面依序拿回來
        for item in page.get("Contents", []):
            # 每一頁裡會有：Contents也就是 object 列表。
            key = item["Key"]
            # 從 R2 object 取得：Object Key
            # 例如：assets/img/0317/thumb_test.webp
            content_type = guess_type(key)
            by_prefix[key.split("/", 1)[0]] += 1
            # 假設：key = "assets/img/0317/a.webp"
            # 先：key.split("/", 1)
            # 得到：
            # [
            #     "assets",
            #     "img/0317/a.webp"
            # ]
            by_type[content_type] += 1
            # 統計第一層 prefix。
            objects.append(
                {
                    "key": key,
                    "url": f"{public_base}/{key}",
                    "size": item.get("Size", 0),
                    # 取得 R2 回傳的檔案大小。
                    "last_modified": item.get("LastModified").isoformat() if item.get("LastModified") else None,
                    # 紀錄 R2 object 最後修改時間。
                    "content_type": content_type,
                    # 加入：
                    #     image/webp
                    #     image/jpeg
                    "is_thumb": Path(key).name.startswith("thumb_"),
                }
            )

    objects.sort(key=lambda item: item["key"])
    # 放進 objects，然後依照 key 排序。
    report = {
        "bucket": bucket,
        "public_base_url": public_base,
        "total": len(objects),
        # 計算總 object 數量。
        "total_bytes": sum(item["size"] for item in objects),
        "by_prefix": dict(sorted(by_prefix.items())),
        # 排序後轉成普通 dict。因為 defaultdict 不能直接 json.dumps。
        "by_type": dict(sorted(by_type.items())),
        # 整理 MIME type 統計。
        "objects": objects,
        # 把所有 R2 object 詳細資料放進報告。
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    # json.dumps把 Python dictionary 轉 JSON 字串。
    # ensure_ascii=False，非常重要，讓中文字可以正常顯示，而不是變成 \u4e2d\u6587 這種亂碼。
    # indent=2 JSON 縮排 2 格，比較好閱讀。
    print(f"objects={report['total']} bytes={report['total_bytes']}")
    print("by_prefix=" + json.dumps(report["by_prefix"], ensure_ascii=False, sort_keys=True))
    print("by_type=" + json.dumps(report["by_type"], ensure_ascii=False, sort_keys=True))
    print(f"report={REPORT_PATH}")
    return 0 #程式正常完成
    # 你前面設定缺失時：return 2 就是代表錯誤。

if __name__ == "__main__":
    # 只有當這個檔案被「直接執行」時，才執行下面程式。
    # import audit_r2_media 這時就不會直接執行 main()。
    raise SystemExit(main())
