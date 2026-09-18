# 本機啟動指令

## 1. 啟動資料庫

若 `backend\.env` 使用 PostgreSQL：

```powershell
cd C:\Users\USER\Projects\figma-codex-lab\Demo
docker compose up -d db
```

若沒有 PostgreSQL，將 `backend\.env` 的 `DATABASE_URL` 改成：

```text
DATABASE_URL=sqlite:///./ilink_dev.db
```

## 2. 啟動後端

```powershell
cd C:\Users\USER\Projects\figma-codex-lab\Demo\backend
.\.venv\Scripts\activate
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

後端 API：

```text
http://127.0.0.1:8000/api/v1
```

健康檢查：

```text
http://127.0.0.1:8000/health
```

## 3. 建立後台管理員

首次啟動或資料庫重建後執行：

```powershell
cd C:\Users\USER\Projects\figma-codex-lab\Demo\backend
.\.venv\Scripts\activate
python scripts\create_admin.py teacher@example.com "ChangeMe123!" "I-Link Admin"
```

## 4. 匯入既有前端內容到後端 CMS

前台原本的頁面文字、地點、成果、活動與首頁 timeline 先放在 `src/**/*.data.ts`。若要讓 Admin 可以即時管理這些內容，先匯出 seed，再寫入後端資料庫：

```powershell
cd C:\Users\USER\Projects\figma-codex-lab\Demo
node scripts\export_static_cms.mjs

cd C:\Users\USER\Projects\figma-codex-lab\Demo\backend
.\.venv\Scripts\activate
python scripts\seed_static_cms.py
```

這會 upsert：

- `site_pages`: places、works、events、impact、about
- `content_items`: places、place_spots、works、events
- `timeline_events`: 首頁時間軸活動與圖片

前台會優先讀後端 CMS；API 不可用時才使用靜態 fallback。

## 5. 匯入前端既有媒體到後端

若要讓 Admin 媒體庫看到 `public/assets` 內既有圖片與影片，執行：

```powershell
cd C:\Users\USER\Projects\figma-codex-lab\Demo\backend
.\.venv\Scripts\activate
python scripts\import_public_media.py
```

這會把圖片與影片登錄到後端 `media` 表，前端仍從 `/assets/...` 顯示原檔。

## 6. 啟動前端

確認 `Demo\.env.local`：

```text
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

啟動 Vite：

```powershell
cd C:\Users\USER\Projects\figma-codex-lab\Demo
npm run dev
```

前端預設網址：

```text
http://127.0.0.1:5174
```

後台網址：

```text
http://127.0.0.1:5174/admin
```

## 7. 驗證

```powershell
cd C:\Users\USER\Projects\figma-codex-lab\Demo\backend
.\.venv\Scripts\python.exe -m pytest

cd C:\Users\USER\Projects\figma-codex-lab\Demo
npm run build
```

後台測試帳號：

```text
teacher@example.com
ChangeMe123!
```
