# `Demo` 專案目錄與檔案命名說明

這份文件說明 `C:\Users\USER\Projects\figma-codex-lab\Demo` 裡的主要資料夾與檔案名稱意思。
`node_modules`、`.venv`、`dist`、`test-results`、`.pytest_cache`、`.playwright-cli` 這類由工具產生的資料夾會說明用途，但不逐一列出內部所有第三方套件或暫存檔。

## `Demo` 根目錄

```text
Demo
├─ .playwright-cli                 Playwright 測試工具暫存
├─ backend                         後端服務
├─ dist                            前端建置輸出
├─ node_modules                    Node.js 前端依賴
├─ output                          檢查截圖與輸出報告
├─ public                          前端公開靜態資源
├─ scripts                         專案維護腳本
├─ src                             前端原始碼
├─ test-results                    Playwright / 測試結果
├─ .dockerignore                   Docker 忽略規則
├─ .env.docker                     Docker 環境變數
├─ .env.docker.example             Docker 環境變數範例
├─ .env.local                      前端本機環境變數
├─ .gitignore                      Git 忽略規則
├─ docker-compose.yml              Docker Compose 編排設定
├─ DOCKER.md                       Docker 使用文件
├─ Dockerfile                      前端 Docker 映像設定
├─ index.html                      Vite HTML 入口
├─ nginx.conf                      Nginx 設定
├─ package-lock.json               npm 鎖定檔
├─ package.json                    npm 專案設定
├─ R2_MEDIA_AUDIT.json             R2 媒體盤點資料
├─ SRC_目錄命名說明.md             本文件
├─ START.md                        啟動說明
├─ tsconfig.json                   TypeScript 前端設定
├─ tsconfig.node.json              TypeScript Node 設定
├─ tsconfig*.tsbuildinfo           TypeScript 編譯快取
├─ vite-dev*.log                   Vite 開發伺服器紀錄
├─ vite.config.*                   Vite 設定檔
├─ 網站與後台規劃.md               網站與 CMS 後台規劃文件
└─ 頁面內容設計.md                 頁面內容設計文件
```

| 名稱 | 英文意思 | 中文意思 | 用途 |
| --- | --- | --- | --- |
| `.playwright-cli` | Playwright CLI cache | Playwright 指令工具暫存 | 瀏覽器自動化測試工具產生的資料夾。 |
| `backend` | Backend | 後端 | FastAPI / CMS / 資料庫 / R2 媒體管理相關程式碼。 |
| `dist` | Distribution | 發佈輸出 | `npm run build` 後產生的前端靜態檔案。 |
| `node_modules` | Node modules | Node 套件 | npm 安裝的第三方前端依賴，不手動修改。 |
| `output` | Output | 輸出 | Playwright 截圖、行動版檢查結果、人工驗證輸出。 |
| `public` | Public assets | 公開資源 | Vite 會原樣公開的圖片、影片、favicon 等靜態資源。 |
| `scripts` | Scripts | 腳本 | 前端與 CMS 維護、驗證、資料同步用的 Node.js 腳本。 |
| `src` | Source | 原始碼 | React 前端應用程式原始碼。 |
| `test-results` | Test results | 測試結果 | Playwright 或測試工具輸出的結果資料。 |
| `.dockerignore` | Docker ignore | Docker 忽略清單 | 建立 Docker image 時排除不需要複製的檔案。 |
| `.env.docker` | Docker environment | Docker 環境變數 | Docker 執行時使用的實際環境設定。 |
| `.env.docker.example` | Docker environment example | Docker 環境變數範例 | 提供 `.env.docker` 的範本，不應放真實密鑰。 |
| `.env.local` | Local environment | 本機環境變數 | Vite 前端本機開發使用的環境設定。 |
| `.gitignore` | Git ignore | Git 忽略清單 | 指定不進版控的檔案，例如依賴、快取、環境變數。 |
| `docker-compose.yml` | Docker Compose file | Docker Compose 設定 | 同時啟動前端、後端、資料庫等容器服務。 |
| `DOCKER.md` | Docker docs | Docker 文件 | 說明如何用 Docker 啟動與部署專案。 |
| `Dockerfile` | Docker build file | Docker 映像檔設定 | 定義前端容器如何安裝、建置與提供靜態檔案。 |
| `index.html` | HTML entry | HTML 入口 | Vite 前端的 HTML 入口，React 會掛載到這裡。 |
| `nginx.conf` | Nginx config | Nginx 設定 | 前端 Docker 部署時用 Nginx 服務靜態檔與路由 fallback。 |
| `package-lock.json` | Package lock | 套件鎖定檔 | 鎖定 npm 依賴版本，確保安裝結果一致。 |
| `package.json` | Package manifest | 套件設定檔 | 定義 npm scripts、dependencies、devDependencies。 |
| `R2_MEDIA_AUDIT.json` | R2 media audit | R2 媒體盤點 | 記錄 Cloudflare R2 圖片/媒體架構與盤點結果。 |
| `SRC_目錄命名說明.md` | Source naming docs | 目錄命名說明 | 本文件，說明 Demo 內所有重要資料夾與檔案名稱。 |
| `START.md` | Start guide | 啟動指南 | 專案啟動步驟、常用指令與開發注意事項。 |
| `tsconfig.json` | TypeScript config | TypeScript 設定 | 前端 TypeScript 編譯設定。 |
| `tsconfig.node.json` | TypeScript Node config | Node 版 TypeScript 設定 | Vite config 等 Node 執行環境用的 TS 設定。 |
| `tsconfig.node.tsbuildinfo` | TS build info | TS 編譯快取 | TypeScript 增量編譯產物，可重新產生。 |
| `tsconfig.tsbuildinfo` | TS build info | TS 編譯快取 | TypeScript 增量編譯產物，可重新產生。 |
| `vite-dev.err.log` | Vite dev error log | Vite 錯誤紀錄 | 開發伺服器 stderr 紀錄。 |
| `vite-dev.log` | Vite dev log | Vite 執行紀錄 | 開發伺服器 stdout 紀錄。 |
| `vite.config.d.ts` | Vite config declarations | Vite 設定型別宣告 | `vite.config` 相關型別輸出或宣告。 |
| `vite.config.js` | Vite config JavaScript | Vite JS 設定 | Vite 設定的 JavaScript 版本。 |
| `vite.config.ts` | Vite config TypeScript | Vite TS 設定 | Vite 設定的 TypeScript 原始檔。 |
| `網站與後台規劃.md` | Website and admin plan | 網站與後台規劃 | CMS、網站資訊架構、後台功能規劃文件。 |
| `頁面內容設計.md` | Page content design | 頁面內容設計 | 各頁文案、內容區塊與資訊呈現設計文件。 |

## `backend` 後端

`backend` 的意思是「後端」。這裡是 FastAPI API、CMS、資料庫模型、資料遷移、R2 儲存服務與測試。

```text
backend
├─ .pytest_cache                   pytest 測試快取
├─ .venv                           Python 虛擬環境
├─ alembic                         資料庫 migration
├─ app                             後端應用程式
├─ scripts                         後端維護腳本
├─ tests                           後端測試
├─ uploads                         本機上傳檔案目錄
├─ .dockerignore
├─ .env
├─ .env.example
├─ .gitignore
├─ alembic.ini
├─ docker-entrypoint.sh
├─ Dockerfile
├─ ilink_dev.db
├─ README.md
├─ requirements.txt
└─ uvicorn*.log
```

### `backend` 根目錄檔案

| 名稱 | 英文意思 | 中文意思 | 用途 |
| --- | --- | --- | --- |
| `.pytest_cache` | pytest cache | pytest 快取 | pytest 產生的測試快取。 |
| `.venv` | Virtual environment | Python 虛擬環境 | 後端 Python 套件安裝位置，不手動編輯。 |
| `alembic` | Alembic migrations | 資料庫遷移 | 管理資料庫 schema 版本。 |
| `app` | Application | 後端應用 | FastAPI 主要程式碼。 |
| `scripts` | Scripts | 後端腳本 | 資料匯入、R2 同步、維護、驗證用腳本。 |
| `tests` | Tests | 測試 | pytest 測試檔案。 |
| `uploads` | Uploads | 上傳檔案 | 本機開發時保存上傳媒體的目錄。 |
| `.dockerignore` | Docker ignore | Docker 忽略清單 | 後端 Docker build 排除規則。 |
| `.env` | Environment | 環境變數 | 後端本機實際環境設定，可能包含密鑰。 |
| `.env.example` | Environment example | 環境變數範例 | 後端環境設定範本。 |
| `.gitignore` | Git ignore | Git 忽略清單 | 後端不進版控檔案規則。 |
| `alembic.ini` | Alembic config | Alembic 設定 | Alembic migration 工具設定檔。 |
| `docker-entrypoint.sh` | Docker entrypoint | Docker 進入點腳本 | 容器啟動時先執行的 shell 腳本。 |
| `Dockerfile` | Docker build file | Docker 映像設定 | 建立後端容器映像的設定。 |
| `ilink_dev.db` | I-LINK dev database | I-LINK 開發資料庫 | SQLite 本機開發資料庫。 |
| `README.md` | Readme | 說明文件 | 後端安裝、啟動與 API 說明。 |
| `requirements.txt` | Requirements | Python 依賴清單 | 後端 Python 套件列表。 |
| `uvicorn-8003.err.log` | Uvicorn error log | Uvicorn 8003 錯誤紀錄 | API server 在 8003 port 的錯誤輸出。 |
| `uvicorn-8003.log` | Uvicorn log | Uvicorn 8003 紀錄 | API server 在 8003 port 的一般輸出。 |
| `uvicorn-admin.err.log` | Uvicorn admin error log | 後台 API 錯誤紀錄 | 後台 API server 錯誤輸出。 |
| `uvicorn-admin.log` | Uvicorn admin log | 後台 API 紀錄 | 後台 API server 一般輸出。 |

### `backend/alembic`

| 名稱 | 英文意思 | 中文意思 | 用途 |
| --- | --- | --- | --- |
| `env.py` | Alembic environment | Alembic 執行環境 | Alembic 執行 migration 時載入 DB 與 model 設定。 |
| `script.py.mako` | Script template | migration 範本 | 新 migration 檔產生時使用的模板。 |
| `versions` | Migration versions | migration 版本 | 放每一次資料庫結構變更檔。 |

#### `backend/alembic/versions`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `20260819_0001_create_core_tables.py` | 建立核心資料表 | 初始化主要資料庫表。 |
| `20260821_0002_add_media_source_path.py` | 新增媒體來源路徑 | 替 media 表加入來源路徑欄位。 |
| `20260821_0003_create_timeline_events.py` | 建立時間軸事件 | 建立 timeline events 相關資料表。 |
| `20260901_0004_create_audit_logs.py` | 建立稽核紀錄 | 建立後台操作紀錄資料表。 |
| `20260901_0005_create_site_pages.py` | 建立網站頁面 | 建立一般內容頁資料表。 |
| `20260901_0006_create_site_settings.py` | 建立網站設定 | 建立全站設定資料表。 |
| `20260901_0007_create_content_items.py` | 建立內容項目 | 建立內容項目資料表。 |
| `20260901_0008_add_content_item_unique_key.py` | 加入內容唯一鍵 | 替內容項目加入唯一識別限制。 |
| `20260905_0009_add_media_thumbnail_metadata.py` | 加入縮圖 metadata | 替媒體資料加入縮圖相關欄位。 |
| `20260905_0010_link_timeline_images_to_media.py` | 連結時間軸圖片與媒體 | 讓時間軸圖片可以對應 media 資料。 |

### `backend/app`

| 名稱 | 英文意思 | 中文意思 | 用途 |
| --- | --- | --- | --- |
| `main.py` | Main application | 後端主程式 | 建立 FastAPI app、註冊路由、中介層與健康檢查。 |
| `__init__.py` | Package initializer | Python 套件初始化 | 讓 `app` 成為 Python package。 |
| `api` | API layer | API 層 | API router 與各路由模組。 |
| `core` | Core | 核心設定 | 設定、例外、安全與基礎共用邏輯。 |
| `data` | Data | 資料 | CMS seed JSON 等初始資料。 |
| `db` | Database | 資料庫 | SQLAlchemy base、session 等 DB 連線邏輯。 |
| `dependencies` | Dependencies | 依賴注入 | FastAPI dependency，例如登入驗證、DB session。 |
| `models` | Models | 資料模型 | SQLAlchemy ORM 資料表模型。 |
| `schemas` | Schemas | API 型別結構 | Pydantic request / response schema。 |
| `services` | Services | 服務層 | 商業邏輯、資料處理、R2 儲存與媒體 URL 邏輯。 |

#### `backend/app/api`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `router.py` | API 路由總表 | 集中註冊所有 API route。 |
| `routes` | 路由模組 | 各功能 API endpoint 所在資料夾。 |

#### `backend/app/api/routes`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `admin_audit_logs.py` | 後台稽核紀錄 API | 查詢後台操作紀錄。 |
| `admin_cms.py` | 後台 CMS API | CMS 管理總覽或共用管理 API。 |
| `admin_content_items.py` | 後台內容項目 API | 管理一般內容資料。 |
| `admin_dashboard.py` | 後台儀表板 API | 提供後台統計與概覽資料。 |
| `admin_media.py` | 後台媒體 API | 管理圖片、影片、R2 媒體。 |
| `admin_posts.py` | 後台文章 API | 管理文章資料。 |
| `admin_site_pages.py` | 後台網站頁面 API | 管理一般頁面內容。 |
| `admin_site_settings.py` | 後台網站設定 API | 管理站名、SEO、導覽、footer 等設定。 |
| `admin_timeline_events.py` | 後台時間軸事件 API | 管理 timeline event。 |
| `auth.py` | 認證 API | 登入、token 或使用者驗證。 |
| `content_items.py` | 內容項目公開 API | 前端讀取內容資料。 |
| `pages.py` | 頁面公開 API | 前端讀取一般頁面資料。 |
| `posts.py` | 文章公開 API | 前端讀取文章列表與單篇文章。 |
| `site_settings.py` | 網站設定公開 API | 前端讀取全站設定。 |
| `timeline.py` | 時間軸公開 API | 前端讀取 timeline 資料。 |
| `uploads.py` | 上傳 API | 處理檔案上傳。 |
| `__init__.py` | 套件初始化 | 讓 `routes` 可被 import。 |

#### `backend/app/core`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `config.py` | 設定 | 讀取環境變數與系統設定。 |
| `exceptions.py` | 例外處理 | 定義 API 錯誤與例外處理邏輯。 |
| `security.py` | 安全 | 密碼、token、驗證相關工具。 |

#### `backend/app/data`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `static_cms_seed.json` | 靜態 CMS 種子資料 | 用來初始化 CMS 的靜態內容。 |
| `wuxi_cms_seed.json` | 五溪 CMS 種子資料 | 專案主題內容的初始化資料。 |

#### `backend/app/db`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `base.py` | ORM 基底 | 匯出 SQLAlchemy Base 與 model metadata。 |
| `session.py` | DB session | 建立資料庫 engine 與 session。 |

#### `backend/app/dependencies`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `auth.py` | 認證依賴 | FastAPI route 使用的登入/權限 dependency。 |
| `database.py` | 資料庫依賴 | 提供 request 期間的 DB session。 |

#### `backend/app/models`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `audit_log.py` | 稽核紀錄模型 | 後台操作紀錄資料表。 |
| `content_item.py` | 內容項目模型 | CMS 一般內容資料表。 |
| `media.py` | 媒體模型 | 圖片、影片、R2 object 資料表。 |
| `post.py` | 文章模型 | 文章資料表。 |
| `site_page.py` | 網站頁面模型 | 一般頁面內容資料表。 |
| `site_settings.py` | 網站設定模型 | 全站設定資料表。 |
| `timeline_event.py` | 時間軸事件模型 | 時間軸事件資料表。 |
| `user.py` | 使用者模型 | 後台使用者資料表。 |
| `__init__.py` | 模型匯總 | 匯入模型，讓 Alembic / ORM 能辨識 metadata。 |

#### `backend/app/schemas`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `admin_cms.py` | 後台 CMS schema | 後台 CMS API request / response 型別。 |
| `admin_dashboard.py` | 後台儀表板 schema | 後台統計資料型別。 |
| `audit_log.py` | 稽核紀錄 schema | 稽核紀錄 API 型別。 |
| `auth.py` | 認證 schema | 登入與 token 型別。 |
| `cms_health.py` | CMS 健康檢查 schema | CMS health response 型別。 |
| `content_item.py` | 內容項目 schema | 內容項目 request / response 型別。 |
| `media.py` | 媒體 schema | 媒體檔案與 R2 資料型別。 |
| `post.py` | 文章 schema | 文章 request / response 型別。 |
| `site_page.py` | 網站頁面 schema | 頁面內容型別。 |
| `site_settings.py` | 網站設定 schema | 全站設定型別。 |
| `timeline.py` | 時間軸 schema | 公開時間軸資料型別。 |
| `timeline_event.py` | 時間軸事件 schema | 後台時間軸事件管理型別。 |

#### `backend/app/services`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `audit_log_service.py` | 稽核紀錄服務 | 建立與查詢後台操作紀錄。 |
| `auth_service.py` | 認證服務 | 登入、密碼驗證、token 建立等邏輯。 |
| `content_item_service.py` | 內容項目服務 | 內容項目的查詢與更新邏輯。 |
| `media_url.py` | 媒體 URL 服務 | 處理本機、public、R2 圖片網址轉換。 |
| `post_service.py` | 文章服務 | 文章查詢、建立、更新與排序邏輯。 |
| `site_page_service.py` | 網站頁面服務 | 一般內容頁的讀寫邏輯。 |
| `site_settings_service.py` | 網站設定服務 | 全站設定讀寫與 fallback。 |
| `storage_service.py` | 儲存服務 | 檔案上傳、R2 object 操作、媒體保存。 |
| `timeline_event_service.py` | 時間軸事件服務 | 時間軸事件的查詢、排序、媒體關聯。 |

### `backend/scripts`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `audit_r2_media.py` | 盤點 R2 媒體 | 檢查 R2 bucket 裡的媒體檔。 |
| `configure_r2_cors.py` | 設定 R2 CORS | 設定 R2 跨來源存取規則。 |
| `create_admin.py` | 建立管理員 | 建立後台 admin 帳號。 |
| `import_public_media.py` | 匯入 public 媒體 | 把 `public` 圖片匯入 CMS / media 表。 |
| `import_timeline_media.py` | 匯入時間軸媒體 | 將時間軸圖片建立 media 關聯。 |
| `migrate_legacy_uploads_to_r2.py` | 舊上傳遷移到 R2 | 把本機舊 uploads 搬到 R2。 |
| `prefer_r2_thumbnails.py` | 優先使用 R2 縮圖 | 將媒體 URL 改為 R2 thumbnail。 |
| `rebuild_cms_from_r2.py` | 從 R2 重建 CMS | 根據 R2 媒體重建 CMS 資料。 |
| `repair_cms_media_urls.py` | 修復 CMS 媒體 URL | 修正 CMS 中錯誤或舊格式媒體路徑。 |
| `seed_static_cms.py` | 匯入靜態 CMS 種子資料 | 將 JSON seed 寫入資料庫。 |
| `smoke_cms_r2_crud.py` | CMS R2 CRUD 冒煙測試 | 快速驗證 CMS 與 R2 新增/讀取/更新/刪除。 |
| `upload_dist_assets_to_r2.py` | 上傳 dist assets 到 R2 | 把建置後靜態資源上傳到 R2。 |
| `upload_public_assets_to_r2.py` | 上傳 public assets 到 R2 | 把公開媒體資源上傳到 R2。 |

### `backend/tests`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `conftest.py` | pytest 共用設定 | 測試 fixture、測試 DB、client 設定。 |
| `test_admin_audit_logs_api.py` | 後台稽核 API 測試 | 測試 audit logs endpoints。 |
| `test_admin_cms_api.py` | 後台 CMS API 測試 | 測試 CMS 後台 API。 |
| `test_admin_cms_health_api.py` | CMS 健康檢查測試 | 測試 CMS health endpoint。 |
| `test_admin_dashboard_api.py` | 後台儀表板 API 測試 | 測試 dashboard 統計 API。 |
| `test_admin_media_api.py` | 後台媒體 API 測試 | 測試媒體上傳、查詢、R2 邏輯。 |
| `test_auth_upload_api.py` | 認證與上傳 API 測試 | 測試登入權限與上傳行為。 |
| `test_content_items_api.py` | 內容項目 API 測試 | 測試 content items endpoints。 |
| `test_health.py` | 健康檢查測試 | 測試基礎 health endpoint。 |
| `test_media_url_service.py` | 媒體 URL 服務測試 | 測試 URL 轉換與 R2 路徑處理。 |
| `test_posts_api.py` | 文章 API 測試 | 測試 posts endpoints。 |
| `test_security_config.py` | 安全設定測試 | 測試安全與環境設定限制。 |
| `test_site_pages_api.py` | 網站頁面 API 測試 | 測試 site pages endpoints。 |
| `test_site_settings_api.py` | 網站設定 API 測試 | 測試 site settings endpoints。 |
| `test_timeline_api.py` | 時間軸 API 測試 | 測試公開 timeline endpoint。 |
| `test_timeline_events_api.py` | 時間軸事件 API 測試 | 測試後台 timeline events endpoints。 |

## `src` 前端原始碼

`src` 的意思是「source code，原始碼」。這裡是 React + TypeScript 前端。

```text
src
├─ App.tsx
├─ main.tsx
├─ styles.css
├─ vite-env.d.ts
├─ features
│  ├─ admin
│  ├─ pages
│  ├─ posts
│  └─ timeline
│     └─ hooks
└─ shared
```

### `src` 根目錄檔案

| 名稱 | 英文意思 | 中文意思 | 用途 |
| --- | --- | --- | --- |
| `App.tsx` | Application | 應用程式主元件 | 前端路由判斷、lazy loading、SEO metadata 更新。 |
| `main.tsx` | Main entry | 主入口檔 | 把 React `App` 掛載到 HTML。 |
| `styles.css` | Styles | 樣式表 | 全站 CSS、版面、動畫、響應式樣式。 |
| `vite-env.d.ts` | Vite environment declarations | Vite 環境型別 | 提供 Vite / `import.meta.env` TypeScript 型別。 |

### `src/features`

`features` 是「功能模組」。依照業務功能切分前端程式碼。

| 名稱 | 英文意思 | 中文意思 | 用途 |
| --- | --- | --- | --- |
| `admin` | Admin | 後台功能 | 後台 CMS 管理介面。 |
| `pages` | Pages | 一般內容頁功能 | 地方、作品、活動、影響力、關於等頁面。 |
| `posts` | Posts | 文章功能 | 單篇文章頁。 |
| `timeline` | Timeline | 時間軸功能 | 首頁故事時間軸、3D 場景、動畫。 |

#### `src/features/admin`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `admin.api.ts` | 後台 API | 前端呼叫後台 CMS API 的封裝。 |
| `AdminTimelinePage.tsx` | 後台時間軸頁 | 管理時間軸事件、媒體與 CMS 內容的後台頁面。 |

#### `src/features/pages`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `AboutILink.css` | 關於 I-LINK 樣式 | 關於頁專用 CSS。 |
| `AboutILink.tsx` | 關於 I-LINK 元件 | 關於 I-LINK 的內容頁元件。 |
| `ContentPages.tsx` | 內容頁集合 | 匯出 `AboutPage`、`EventsPage`、`ImpactPage`、`PlacesPage`、`WorksPage` 等頁面。 |
| `ExplorePlacesHero.tsx` | 探索地點首屏 | 地方探索頁的主視覺與導覽入口。 |
| `pages.data.ts` | 頁面資料 | 一般內容頁的靜態資料與 fallback。 |
| `PlaceChapters.tsx` | 地方章節 | 顯示地方章節、地點卡片、區域介紹。 |
| `WorksArchivePage.tsx` | 作品典藏頁 | 顯示作品列表、典藏內容、作品歸檔。 |

#### `src/features/posts`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `PostPage.tsx` | 文章頁 | 根據 `/posts/...` 顯示單篇文章。 |

#### `src/features/timeline`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `StoryPanel.tsx` | 故事面板 | 時間軸中顯示故事內容、圖片與資訊。 |
| `timeline.api.ts` | 時間軸 API | 前端讀取 timeline API 的封裝。 |
| `timeline.data.ts` | 時間軸資料 | 時間軸預設資料與 fallback 章節。 |
| `timeline.types.ts` | 時間軸型別 | 定義 timeline chapter、panel、3D 座標等型別。 |
| `TimelineOverlay.tsx` | 時間軸覆蓋層 | 時間軸畫面上的文字與 UI 覆蓋資訊。 |
| `TimelinePage.tsx` | 時間軸頁 | 時間軸主要頁面，整合資料、動畫、場景。 |
| `TimelineProgress.tsx` | 時間軸進度 | 顯示捲動或章節進度。 |
| `TimelineScene.tsx` | 時間軸場景 | 3D / 視覺場景與面板渲染。 |
| `hooks` | hooks | timeline 專用 React hooks。 |

##### `src/features/timeline/hooks`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `useMediaQuery.ts` | 使用媒體查詢 | 偵測螢幕尺寸與 media query。 |
| `useReducedMotion.ts` | 使用減少動態設定 | 偵測使用者是否偏好減少動畫。 |
| `useSmoothScroll.ts` | 使用平滑捲動 | 管理平滑捲動行為。 |
| `useTimelineAnimation.ts` | 使用時間軸動畫 | 管理時間軸動畫、進度與轉場。 |

### `src/shared`

`shared` 是「共用」。放跨頁面、跨功能都會使用的元件與工具。

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `cms.ts` | CMS 輔助工具 | 處理 CMS 內容的共用方法。 |
| `media.ts` | 媒體輔助工具 | 處理圖片、影片、R2 或本機媒體 URL。 |
| `SiteFooter.tsx` | 網站頁尾 | 全站共用 footer。 |
| `SiteHeader.tsx` | 網站頁首 | 全站共用 header 與導覽。 |
| `siteNavigation.ts` | 網站導覽 | 定義前端導覽項目與連結。 |
| `siteSettings.ts` | 網站設定 | 定義 site settings 型別、預設值與 API 讀取邏輯。 |

## `scripts` 前端與專案維護腳本

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `annotate-source-comments.cjs` | 標註原始碼註解 | 批次處理或檢查原始碼註解。 |
| `check-no-local-media-requests.cjs` | 檢查沒有本機媒體請求 | 確認前端不直接請求錯誤的 localhost 媒體 URL。 |
| `check-page.cjs` | 檢查頁面 | 用 Playwright 或瀏覽器檢查指定頁面渲染。 |
| `check-r2-image-architecture.cjs` | 檢查 R2 圖片架構 | 驗證圖片是否走 R2 / 正確媒體架構。 |
| `check-timeline-render.cjs` | 檢查時間軸渲染 | 驗證 timeline 是否正常顯示。 |
| `check-works-pagination.cjs` | 檢查作品分頁 | 驗證 works archive 分頁行為。 |
| `export_static_cms.mjs` | 匯出靜態 CMS | 將 CMS 資料匯出成靜態 JSON 或 seed。 |
| `sync-timeline-thumbnails.mjs` | 同步時間軸縮圖 | 建立或同步 timeline thumbnails。 |
| `update-marketing-posts.mjs` | 更新行銷文章 | 批次更新 posts / marketing content。 |
| `verify-timeline-backend.mjs` | 驗證時間軸後端 | 檢查前端讀取 timeline backend 是否正常。 |
| `verify_admin_cms.mjs` | 驗證後台 CMS | 檢查 admin CMS API 與頁面流程。 |
| `verify_cms_pages.mjs` | 驗證 CMS 頁面 | 檢查 CMS content pages 是否正常。 |

## `public` 公開靜態資源

`public` 裡的檔案會被 Vite 直接公開，前端可以用 `/assets/...` 或 `/favicon.svg` 取用。

```text
public
├─ favicon.svg
└─ assets
   ├─ figma-formal
   ├─ generated
   ├─ img
   ├─ mv
   └─ timeline-thumbs
```

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `favicon.svg` | 網站小圖示 | 瀏覽器分頁 icon。 |
| `assets` | 靜態資源 | 圖片、影片、設計稿輸出、縮圖。 |
| `assets/figma-formal` | Figma 正式設計圖 | 從 Figma 或設計流程輸出的正式視覺資源。 |
| `assets/generated` | 生成資源 | AI 或設計流程產生的 logo、雜誌風圖片等。 |
| `assets/img` | 原始活動圖片 | 活動照片、海報、螢幕截圖，依日期資料夾分類。 |
| `assets/mv` | Movie / video | 影片檔。 |
| `assets/timeline-thumbs` | 時間軸縮圖 | 從活動圖片轉出的 webp 縮圖，供 timeline 使用。 |

### `public/assets/figma-formal`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `culture-map.png` | 文化地圖 | 地方/文化視覺素材。 |
| `figma-reference.png` | Figma 參考圖 | 設計參考用圖片。 |
| `hero-pair.png` | 首屏雙圖 | Hero 區塊視覺素材。 |
| `search-illustration.png` | 搜尋插圖 | 搜尋或探索區塊插圖。 |
| `story-card-01.png` | 故事卡 01 | fallback 或故事卡片視覺。 |
| `story-card-02.png` | 故事卡 02 | fallback 或故事卡片視覺。 |
| `story-card-03.png` | 故事卡 03 | fallback 或故事卡片視覺。 |

### `public/assets/generated`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `i-link-logo-display.png` | I-LINK 展示 logo | 大尺寸品牌展示。 |
| `i-link-logo-header-compact.png` | I-LINK 精簡 header logo | 窄版或 compact header 使用。 |
| `i-link-logo-header-small.png` | I-LINK 小 header logo | 小尺寸 header 使用。 |
| `i-link-logo-header.png` | I-LINK header logo | 一般網站頁首使用。 |
| `magazine-asset-01-craft.png` | 工藝雜誌風圖片 | craft / 工藝主題視覺。 |
| `magazine-asset-02-food.png` | 食物雜誌風圖片 | food / 飲食主題視覺。 |
| `magazine-asset-03-architecture.png` | 建築雜誌風圖片 | architecture / 建築主題視覺。 |
| `magazine-asset-04-people.png` | 人物雜誌風圖片 | people / 人物主題視覺。 |
| `magazine-asset-05-festival.png` | 節慶雜誌風圖片 | festival / 節慶主題視覺。 |
| `magazine-asset-07-travel.png` | 旅行雜誌風圖片 | travel / 旅行主題視覺。 |
| `magazine-asset-08-agriculture.png` | 農業雜誌風圖片 | agriculture / 農業主題視覺。 |
| `magazine-asset-09-design-object.png` | 設計物件雜誌風圖片 | design object / 設計物件主題視覺。 |

### `public/assets/img`

`img` 依日期或日期區間分類，資料夾名稱大多是活動日期。

| 資料夾 | 中文意思 | 內容 |
| --- | --- | --- |
| `0317` | 3 月 17 日 | 計畫啟動說明會暨旗山宗教文化探訪圖片。 |
| `0327` | 3 月 27 日 | 旗山文化介紹與探索圖片。 |
| `0331` | 3 月 31 日 | AI 行銷新技相關圖片。 |
| `0414` | 4 月 14 日 | 成大計劃團隊資源中心拜訪圖片。 |
| `05030511` | 5 月 3 日到 5 月 11 日 | 標點符號活動圖片與無照片 placeholder。 |
| `0519` | 5 月 19 日 | AI 共讀讀書會海報。 |
| `0523` | 5 月 23 日 | 活動海報與無照片 placeholder。 |
| `0526` | 5 月 26 日 | AI 共讀讀書會圖片。 |
| `0528` | 5 月 28 日 | 無照片 placeholder。 |
| `0602` | 6 月 2 日 | 讀書會圖片。 |
| `07230725` | 7 月 23 日到 7 月 25 日 | 無照片 placeholder。 |
| `0817` | 8 月 17 日 | 宋江陣圖片。 |
| `0902` | 9 月 2 日 | 活動圖片資料夾，目前可能作為保留分類。 |
| `0911` | 9 月 11 日 | 活動圖片資料夾，目前可能作為保留分類。 |
| `1013` | 10 月 13 日 | 旗山產業歷史漫談圖片。 |
| `1016` | 10 月 16 日 | 學生採訪實務經驗分享圖片。 |
| `1017` | 10 月 17 日 | 活動圖片資料夾，目前可能作為保留分類。 |
| `1020` | 10 月 20 日 | iLink 美濃藍染文創設計工坊與相關照片。 |
| `1103` | 11 月 3 日 | 美濃文化與地方記憶分享（一）。 |
| `1104` | 11 月 4 日 | 美濃文化與地方記憶分享（二）。 |
| `1105` | 11 月 5 日 | 腳本設計、旗山農產實務與截圖。 |
| `1110` | 11 月 10 日 | 木工、餐飲業、生成式 AI 電子書設計與截圖。 |
| `1111` | 11 月 11 日 | 汽車主題活動與截圖。 |
| `1113` | 11 月 13 日 | 旗山餐飲業實務分享（二）。 |
| `1114` | 11 月 14 日 | 美濃文化與地方記憶分享（三）。 |
| `1118` | 11 月 18 日 | AI / n8n 行政自動化活動圖片。 |
| `1120` | 11 月 20 日 | 《六堆風雲》雜誌與客家文化圖片。 |
| `1128` | 11 月 28 日 | AI、俗文學、SDGs 故事力活動圖片。 |
| `1210` | 12 月 10 日 | AI 永續網站活動圖片。 |

### `public/assets/mv`

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `i-link-video.mp4` | I-LINK 影片 | 網站首頁或內容頁使用的影片資源。 |

### `public/assets/timeline-thumbs`

`timeline-thumbs` 是「時間軸縮圖」。資料夾名稱對應 `assets/img` 的日期資料夾，例如 `0317`、`0327`、`1110`、`1128`。裡面的 `.webp` 檔通常是原始圖片的縮圖版本，用來提升 timeline 載入速度。

## `output` 輸出與檢查結果

```text
output
├─ mobile-audit
└─ playwright
```

| 名稱 | 中文意思 | 用途 |
| --- | --- | --- |
| `mobile-audit` | 行動版檢查輸出 | 存放手機尺寸截圖與 overflow 檢查腳本。 |
| `playwright` | Playwright 截圖 | 存放桌機/手機頁面截圖、設計驗證截圖。 |

### `output/mobile-audit`

| 名稱類型 | 中文意思 | 用途 |
| --- | --- | --- |
| `check-overflow.cjs` | overflow 檢查腳本 | 檢查手機版是否有水平溢出。 |
| `home-*.png` | 首頁手機截圖 | 首頁不同寬度或修正階段的截圖。 |
| `events-*.png` | 活動頁手機截圖 | 活動頁手機版檢查圖。 |
| `places-*.png` | 地方頁手機截圖 | 地方頁手機版檢查圖。 |
| `works-*.png` | 作品頁手機截圖 | 作品頁手機版檢查圖。 |

### `output/playwright`

| 名稱類型 | 中文意思 | 用途 |
| --- | --- | --- |
| `about-*.png` | 關於頁截圖 | 關於頁視覺驗證。 |
| `current-frontend-*.png` | 目前前端截圖 | 當下版本前端畫面紀錄。 |
| `demo-full-video-*.png` | 影片頁面截圖 | 含影片區塊頁面驗證。 |
| `events-*.png` | 活動頁截圖 | 活動頁桌機/手機視覺驗證。 |
| `footer-*.png` | 頁尾截圖 | footer 響應式檢查。 |
| `header-*.png` | 頁首截圖 | header、logo、導覽狀態檢查。 |
| `home-*.png` | 首頁截圖 | 首頁或故事導覽截圖。 |
| `impact-*.png` | 影響力頁截圖 | impact 頁面桌機/手機驗證。 |
| `places-*.png` | 地方頁截圖 | places 頁面桌機/手機驗證。 |
| `responsive-*.png` | 響應式截圖 | 不同 viewport 的章節、footer、story 檢查。 |
| `story-*.png` | 故事區塊截圖 | story detail / story panel 視覺檢查。 |
| `works-*.png` | 作品頁截圖 | works 頁面與分頁檢查。 |

## 產物與工具資料夾

| 名稱 | 中文意思 | 是否應手動修改 | 說明 |
| --- | --- | --- | --- |
| `node_modules` | npm 依賴 | 否 | 由 `npm install` 產生。 |
| `backend/.venv` | Python 虛擬環境 | 否 | 由 Python venv / pip 產生。 |
| `dist` | 前端建置產物 | 否 | 由 `npm run build` 產生，可重新建置。 |
| `test-results` | 測試結果 | 否 | 由測試工具產生，可清除後重新產生。 |
| `.playwright-cli` | Playwright 工具快取 | 否 | Playwright CLI 使用的暫存或工具資料。 |
| `backend/.pytest_cache` | pytest 快取 | 否 | pytest 自動產生。 |
| `tsconfig*.tsbuildinfo` | TypeScript 編譯快取 | 否 | TypeScript 增量編譯資訊，可重新產生。 |
| `vite-dev*.log`、`uvicorn*.log` | 執行紀錄 | 通常否 | 開發伺服器輸出紀錄，用於除錯。 |

## 命名規則補充

| 命名形式 | 英文意思 | 中文意思 | 範例 |
| --- | --- | --- | --- |
| `*.tsx` | TypeScript JSX | React 元件檔 | `App.tsx`、`TimelinePage.tsx` |
| `*.ts` | TypeScript | TypeScript 程式檔 | `timeline.api.ts`、`siteSettings.ts` |
| `*.css` | CSS stylesheet | 樣式表 | `styles.css`、`AboutILink.css` |
| `*.py` | Python | Python 程式檔 | `main.py`、`post_service.py` |
| `*.mjs` | ES module JavaScript | ES Module 腳本 | `export_static_cms.mjs` |
| `*.cjs` | CommonJS JavaScript | CommonJS 腳本 | `check-page.cjs` |
| `.api.ts` | API wrapper | API 封裝 | `admin.api.ts`、`timeline.api.ts` |
| `.data.ts` | Data file | 資料檔 | `pages.data.ts`、`timeline.data.ts` |
| `.types.ts` | Type definitions | 型別定義 | `timeline.types.ts` |
| `_service.py` | Service layer | 服務層 | `post_service.py`、`storage_service.py` |
| `test_*.py` | Test file | 測試檔 | `test_posts_api.py` |
| `admin_*` | Admin feature | 後台功能 | `admin_media.py`、`admin_posts.py` |
| `site_*` | Site-level feature | 網站層級功能 | `site_settings.py`、`site_pages_api.py` |
| `timeline_*` | Timeline feature | 時間軸功能 | `timeline_event.py` |
| `use...` | React hook | React hook | `useSmoothScroll.ts` |
