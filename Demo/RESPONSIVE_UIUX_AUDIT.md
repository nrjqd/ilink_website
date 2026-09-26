# I-LINK Responsive UI/UX Audit

> 階段：Phase 1–5 完成、Phase 6–7（Figma Proposal / Prototype）**尚未完成**（Figma Starter 方案 MCP 呼叫額度用盡，見〈Figma 狀態〉）。
> 本文件只做分析，**未修改任何既有程式碼、未 commit、未部署**。
> 擷取日期：2026-09-26，正式站 https://usckh.com，Chrome（Playwright）實測 7 頁 × 12 viewport = 84 次載入。

Figma：https://www.figma.com/design/audQmrRvH0zjWLrL39PaED

---

# Executive Summary

I-LINK 桌機版的品牌感與敘事（WebGL 時間軸、serif 大標、金/墨綠配色）是資產，應保留。問題集中在 **≤1023px**：

1. **手機首頁是桌機邏輯的殘留物**：時間軸 fallback 把 25 則故事顯示兩次（overlay 列表 + 卡片 grid），首頁 27,057px ≈ 32 個螢幕；平板 768 更長（29,203px）。
2. **三個會直接壞掉的 bug**：Works 手機篩選列溢出讓整頁被縮放、首頁手機 5–23 張圖因 CORS 快取衝突顯示「圖片暫時無法載入」、site-settings API 全站 404。
3. **內容是海報，版型卻是照片**：25 篇封面有 23 張是直式海報（1131×1600），卻被放進 16:10 / 16:11 / 4:3 的 `object-fit: cover`，海報文字被切掉；Works 還把標題疊在海報上。
4. **設計系統失控**：89 種 font-size、43 種 gap、99 種 padding、11 個 breakpoint；金色文字對比 1.88:1。

建議策略：Desktop 保留沉浸式體驗但修可讀性；Tablet 不再套手機單欄、也不跑 WebGL；Mobile 改為 **Option C（最新故事 swipe + 年度 rail 時間軸 + 漸進顯示）**，同一份 CMS `/posts?timeline=true` 資料。

| 指標 | 數量 |
|---|---|
| Pages analyzed | 7（+ admin 未納入） |
| Viewports tested | 12 |
| Components analyzed | 22 |
| Responsive issues | 28（High 6 / Medium 15 / Low 7） |

---

## Current Architecture

- Vite 6 + React 18 + TypeScript，無 router 套件：`src/App.tsx` 以 `window.location.pathname` 手動分派、攔截站內 `<a>` 做 pushState。
- 樣式：單一 `src/styles.css`（6,789 行）+ `src/features/pages/AboutILink.css`（462 行），無 Tailwind / CSS Modules。
- 動畫：GSAP 3.13 + ScrollTrigger（首頁 pin、Impact/Places 進場）、Lenis 1.3（全站平滑捲動，僅 reduced-motion 關閉）、Flip（已註冊）。
- 3D：three 0.170 + @react-three/fiber 8（`TimelineScene`，lazy；`max-width: 900px` 時不載入）。
- 資料：FastAPI 後端（`VITE_API_BASE_URL=https://ilink-website.onrender.com/api/v1`），圖片在 Cloudflare R2（`VITE_R2_PUBLIC_BASE_URL`）。
  - 時間軸 = `GET /posts?timeline=true&status=published&limit=100` → `timeline.api.ts` → `createTimelineChapters()` → `TimelineChapter[]`
  - 頁面 hero = `GET /pages/{key}`；站台設定 = `GET /site-settings`（**正式站 404**）
- 共用：`SiteHeader`、`SiteFooter`、`SafeImage/SafeVideo`、`media.ts`（R2 URL 解析）、`contentLabels.ts`（enum → 中文）。
- 未使用：`src/features/timeline/StoryPanel.tsx`（578 行，無任何 import）。

## Current Routes

| Route | Component | 資料來源 | 備註 |
|---|---|---|---|
| `/` | `TimelinePage` | `/posts?timeline=true` | Hero 影片 + WebGL pinned timeline + chapter grid + story detail |
| `/places`、`/places/*` | `PlacesPage` = `ExplorePlacesHero` + `PlaceChapters` | `/pages/places`、`/posts?region=` | 子路徑全部顯示同一頁 |
| `/works`、`/works/*` | `WorksArchivePage` | `/posts`（分頁 + 地區/分類篩選） | 子路徑全部顯示同一頁 |
| `/events` | `EventsPage` | `/posts?timeline=true`、`/pages/events` | 25 則活動垂直時間軸 |
| `/impact` | `ImpactPage` | `/posts?limit=1`（取 total）、`/pages/impact` | 數字 + 年度進度 |
| `/about` | `AboutPage` + `AboutILink` | `/pages/about` | 靜態內容為主 |
| `/posts/:slug` | `PostPage` | `/posts/{slug}` | 封面 + 標題 + 摘要 + 內文 |
| `/admin`、`/admin/*` | `AdminTimelinePage` | admin API | noindex，不在本次 RWD 範圍 |
| 其他 | `TimelinePage` | — | 無 404 頁 |

## Current Breakpoints

| 來源 | 值 |
|---|---|
| `styles.css` max-width | 1180、980、900、767（+ 768–1199 range）、720、680、600、560、480、420、380 |
| `AboutILink.css` | 980、720、420 |
| 其他 | `(orientation: landscape) and (max-height: 560px)`、`prefers-reduced-motion` ×5 |
| JS | `useMediaQuery("(max-width: 900px)")`（首頁 3D/pin 開關）、`ExplorePlacesHero` `matchMedia("(max-width: 900px)")` |

900px 是實質的「桌機 / 手機」分界：768–900 的平板吃手機單欄；901–1024 的 iPad 橫向吃桌機 WebGL + pin。

## Current Design Tokens

**Colors（`:root` + 實際使用頻率）**

| Token | 值 | 用途 / 問題 |
|---|---|---|
| `--gold` | `#D0B947` | 主強調；作為淺底文字只有 **1.88:1** |
| `--ink` / `--green` / `--muted` | `#35444C` | 三個變數同值；muted 其實不 muted |
| `--paper` | `#FBFAF5` | 背景 |
| `--gray` / `--pink` | `#CED2D1` / `#E4D5CC` | 輔助 |
| 未 token 化 | `#26343A`(×16)、`#FFFDF7`(×19)、`#66767D`、`#9D382D`、`#1F5F54`、`rgb(53 68 76 / x%)`(×95) … | 應收斂 |

**Typography**：Noto Serif TC（標題）/ Noto Sans TC（內文），**未載入 webfont**（`index.html` 無字型連結）；Georgia ×15、Brush Script MT ×2 作裝飾。89 種 font-size，含 26 個不同的 `clamp()`。

**Spacing / Radius**：43 種 gap、99 種 padding；radius 999px ×23、8px ×19、`--timeline-panel-radius`(8) ×15、50% ×15、6px ×11，另有 10/18/52/72/86px 個案。

**Container**：`--timeline-max-width: 1180px`、`--header-edge` / `--timeline-gutter: clamp(24px, 6vw, 88px)` → 900 以下 24px → 560 以下 16px。

### 提案 Token（已建立於 Figma 00 Foundations，變數 76 個、Text styles 30 個）

- Color：`brand/gold #D0B947`、**`brand/gold-ink #7D6A16`（新增，淺底金字 5.09:1）**、`brand/ink #35444C`、`brand/deep #26343A`、`brand/pink`、`brand/gray`、`bg/paper|surface|sunken`、`text/primary|muted(#66767D, 4.51:1)|inverse|accent`、`border/default(ink 18%)|strong(ink 32%)`、`state/error|warning|success|focus`
- Type scale（Desktop / Tablet / Mobile）：Display 96/64/40、H1 64/48/34、H2 44/36/28、H3 28/24/22、Body L 20/18/17、Body 17/16/16、Small 15/14/14、Caption 13、Eyebrow 13/12/12（+12% tracking）、Button 16
- Spacing：4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128
- Radius：sm 6 · md 8 · lg 16 · xl 28 · pill 999
- Container：max 1180；gutter 88 / 40 / 20；grid 12 / 8 / 4 欄；gap 24 / 20 / 16；section gap 128 / 96 / 64；header 76 / 72 / 64
- Breakpoints：**Mobile < 640、Tablet 640–1023、Desktop ≥ 1024**；沉浸式 WebGL 條件 = Desktop **且** `(hover: hover) and (pointer: fine)`

---

## 量測摘要（正式站）

| Page | 390 高度（屏數） | 768 高度 | 1440 高度 | H1 390 / 1440 | 備註 |
|---|---|---|---|---|---|
| Home | 27,057（32.1） | 29,203（28.5） | 16,696 | 32 / 92px | 390 有 23 個 media fallback |
| Places | 5,464（6.5） | 5,646 | 4,699 | 70 / 158px | |
| Works | 2,513（**頁寬 453**） | 3,318 | 2,000 | 54 / 109px | 390 溢出、選單鈕不可點 |
| Events | 18,031（21.4） | 21,396（20.9） | 12,164 | 44 / 82px | |
| Impact | 2,559（3.0） | 2,635 | 1,827 | 44 / 82px | |
| About | 5,596（6.6） | 3,798 | 3,341 | 44 / 82px | |
| Post | 1,685（2.0） | 1,572 | 1,517 | 36 / 72px | |

全頁共通：`GET /api/v1/site-settings` 404；Home hero poster `posts/2026/09/thumb/60d4bfc5-….webp` 404。

---

## Desktop Issues

### RWD-009

Page: Home
Viewport: ≥1024（實測 1440）
Component: TimelineOverlay / TimelineProgress（`.chapter-copy`、`.timeline-progress`）

Current behavior: 巨大日期數字（如「05/19」）與標題壓在 WebGL 海報圖上；說明卡為半透明，背後是文字量大的海報；右下進度列表只顯示 01–20，21–25 被截掉。

UX impact: 標題與內文可讀性差、視覺焦點衝突；使用者無法從進度列表得知總量與跳轉到後段。

Proposed Figma solution: `TimelineCard / Desktop Panel`（03 Components 已建）：實心 surface 卡片 + 陰影，日期縮為 Tag 放在卡內；「05 / 25」計數；進度列表改為可捲動、可點擊跳轉的 25 格；保留 WebGL 與 pin。

Code impact: `TimelineOverlay.tsx`、`TimelineProgress.tsx`、`styles.css` `.chapter-copy*`、`.timeline-progress*`；`useTimelineAnimation` 不變。

Risk: Medium（ScrollTrigger label 動畫依賴 `.chapter-copy` 結構）

### RWD-010

Page: Home
Viewport: all
Component: `chapter-grid` + `story-detail`

Current behavior: 時間軸後面接 25 張卡片 grid，點卡片不會進文章而是替換下方 story-detail 並捲過去；story-detail 內容與 `/posts/:slug` 重複。

UX impact: 同一份內容出現三次（WebGL、grid、detail）；「點卡片」的結果不符合預期（使用者以為會進文章）；首頁過長。

Proposed Figma solution: 移除 story-detail；grid 改為「所有故事」4 欄 StoryCard（海報比例）+ 地區篩選 + 「查看全部」，卡片直接連 `/posts/:slug`；首屏下方放一張 `StoryCard / Featured` 最新故事。

Code impact: `TimelinePage.tsx`（刪 `selectChapter` / `storyDetailRef` 流程）、`StoryGuide` 保留；CSS `.chapter-grid`、`.story-detail*`。

Risk: Medium（改變既有互動，需確認業主是否依賴 detail 區）

### RWD-012

Page: Works
Viewport: all
Component: `WorkCard`（`.work-card`、`.work-card--0..4`）

Current behavior: 標題、摘要、地區/分類直接疊在海報圖上（底部漸層），海報本身文字很多；手機上編號「04」與標題重疊。

UX impact: 標題難讀、資訊與海報文字互相干擾；手機重疊看起來像壞掉。

Proposed Figma solution: `WorkCard`（已建）：上方海報 `contain` 圖框、下方標題/摘要/標籤；編號改為 caption；Desktop 3 欄等高 grid 取代 bento 版型。

Code impact: `WorksArchivePage.tsx` `WorkCard`、CSS `.work-card*`（`work-card--0..4` 可刪）。

Risk: Low

### RWD-028

Page: Home / Works / Events / Places / Post
Viewport: all
Component: `SafeImage` 使用處（timeline-card、event-card、work-card、place-spot、post cover）

Current behavior: CMS 25 篇封面中 **23 張是直式海報 1131×1600**，只有 2 張照片；版型全部以橫式比例（16:11、16:10、4:3）+ `object-fit: cover` 呈現。

UX impact: 海報上的標題/日期被裁掉，同一張海報在不同頁裁切位置不同；使用者看不到海報原本要傳達的資訊。

Proposed Figma solution: `ImageFrame` 新增 `3:4 Poster`（contain + 淡底）與 `Fallback`；卡片預設用海報比例，照片類才用 cover。

Code impact: `SafeImage` 增加 `ratio` / `fit` props（或 CSS utility `.media--poster`）；各卡片 CSS。

Risk: Low

## Tablet Issues

### RWD-007

Page: Home、Events（亦影響 Places、Works）
Viewport: 640–900（實測 768、820）
Component: 全頁 layout（`@media (max-width: 900px)`）

Current behavior: 768 直接套手機單欄；海報以 768px 全寬呈現，一張圖就超過一個螢幕。Home 29,203px（比手機更長）、Events 21,396px。

UX impact: 平板使用者要捲 20–28 屏；大量空白與巨圖，閱讀節奏很差。

Proposed Figma solution: Tablet 8 欄：Home「所有故事」2 欄海報卡、Events 2 欄 EventCard + 月份標題、Works 2 欄、Places 2+1。導覽用 Navbar/Tablet（3 項 + 「更多」）。

Code impact: 新增 640–1023 tablet 區段；`TimelinePage` 的 `isMobileTimeline` 條件改為 `< 1024 || coarse pointer`。

Risk: Medium

### RWD-008

Page: Home
Viewport: 901–1024（iPad 橫向、觸控筆電）
Component: `TimelineScene`、`useTimelineAnimation`、`useSmoothScroll`

Current behavior: 觸控裝置仍載入 three.js 並 pin 25 × 360 = 9,000px 的 scroll-jacking。

UX impact: 觸控滑動時畫面被「卡住」、慣性不自然；GPU/電量負擔；使用者不知道還要滑多久。

Proposed Figma solution: WebGL 啟用條件 = `min-width: 1024px` **且** `(hover:hover) and (pointer:fine)`；其餘走 Tablet 版（無 pin）。

Code impact: `TimelinePage.tsx` 的 media query；`ExplorePlacesHero` 同步。

Risk: Medium（Desktop regression 風險：條件必須只縮小、不擴大 fallback 範圍）

## Mobile Issues

### RWD-001

Page: Home
Viewport: < 900（實測 320–430）
Component: `TimelineOverlay`（mobile media）+ `chapter-grid` + `story-detail`

Current behavior: 手機關閉 WebGL 後，overlay 把 25 則故事全部列出（16,734px），接著 chapter-grid 再列一次 25 張卡（11,350px），再加 story-detail（2,060px）；整頁 27,057px ≈ 32 屏。

UX impact: 內容重複、找不到頁尾與其他入口；載入 50+ 張圖；使用者在第 3–4 屏就會放棄。

Proposed Figma solution: **Option C（建議）**：Hero CTA → 「最新故事」橫向 swipe（StoryCard/Feed，6 則）→「年度時間軸」TimelineCard/Rail（地區 chips、月份分組、先顯示 8 則 +「顯示其餘 17 則」）→ 導覽 3 列 → Footer。預估約 5,600px（7 屏）。Option A / B 見〈Timeline Issues〉。

Code impact: 新 `TimelineRail.tsx`、`StoryFeed.tsx`（使用同一份 `TimelineChapter[]`）；`TimelinePage` 在 mobile/tablet 分支不渲染 overlay 列表與 chapter-grid。

Risk: Medium

### RWD-002

Page: Home
Viewport: < 900
Component: `SafeImage`（`.timeline-card img`）vs `TimelineOverlay` mobile media

Current behavior: overlay 以 `disableAutoCrossOrigin`（no-cors）載入縮圖，同一 URL 在 chapter-grid 又以 `crossOrigin="anonymous"` 載入；瀏覽器快取的不透明回應導致 CORS 失敗（console：`Access to image at …/thumbnail.webp … blocked`），390 有 23 個「圖片暫時無法載入」；fallback 文字被擠成直排塞在「01」徽章內。

UX impact: 首頁卡片一半沒有圖，而且 fallback 看起來像版面壞掉。

Proposed Figma solution: `ImageFrame / Fallback 4:3`：固定比例的 fallback，文字置中不擠壓；時間軸改版後同一張圖在手機只出現一次。

Code impact: `SafeImage` 對一般 `<img>` 不應自動加 `crossOrigin`（只有 WebGL texture 需要）；或 R2 CORS 回應加 `Vary: Origin`。`.media-fallback` 需要 `aspect-ratio`。

Risk: Low（但需回歸測試 WebGL texture 載入）

### RWD-003

Page: Works
Viewport: ≤ 430（實測 320–430）
Component: `.works-filter`、`.works-filter__group`

Current behavior: 兩組篩選按鈕排成一列，寬度到 751px；父層沒有 overflow 限制，手機 layout viewport 被撐成 453px，整頁縮放，漢堡選單被推出畫面（Playwright 點擊逾時）。

UX impact: 手機上 Works 頁無法使用導覽，文字變小、可橫向拖動。

Proposed Figma solution: 頁面上只留「篩選（n）」按鈕 + 目前條件 chips（橫向捲動、容器 `overflow-x: auto`）；完整篩選收進 `MobileBottomSheet`（已建），chip 44px。

Code impact: `WorksArchivePage.tsx`（篩選 UI 分 mobile/desktop）、CSS `.works-filter*`；新增 `BottomSheet`。

Risk: Low

### RWD-005

Page: Home
Viewport: < 900
Component: `TimelineOverlay` mobile

Current behavior: 手機 overlay 的故事卡不可點、沒有文章連結；圖說顯示原始檔名「0327旗山文化介紹與探索.webp」（`panel.label = original_filename`）。

UX impact: 使用者看到故事卻進不去；檔名看起來像測試資料。

Proposed Figma solution: TimelineCard/Rail 與 StoryCard/Feed 整張卡為連結；不顯示檔名，只顯示日期/地區/分類。

Code impact: `TimelineOverlay.tsx`（或由新元件取代）、`timeline.api.ts` 的 `label`。

Risk: Low

### RWD-011

Page: Events
Viewport: < 900
Component: `events-timeline`、`.event-card`

Current behavior: 25 張活動卡單欄堆疊，每張有 16:10 海報圖 + 全寬「查看活動」按鈕；手機 21 屏、平板 21 屏；沒有年份分組、篩選、跳轉。

UX impact: 無法快速找到特定月份或地區的活動；每張卡有兩個重複的觸控目標。

Proposed Figma solution: `EventCard / Mobile`（已建）：96px 縮圖橫列、整卡可點、移除按鈕；「2025 / 2026」年份切換 + 黏性月份標題；地區篩選共用 BottomSheet。預估 ≈ 4 屏。

Code impact: `ContentPages.tsx` `EventsPage`；CSS `.events-timeline*`、`.event-card*`。

Risk: Low

### RWD-021

Page: Places
Viewport: < 640
Component: `ExplorePlacesHero`

Current behavior: 裝飾性的 `field` 手寫字、「02 / 06」rail 在手機仍佔位；H1 70px，與其他頁 44px 不一致。

UX impact: 首屏資訊密度低；各頁標題大小跳動。

Proposed Figma solution: Mobile 隱藏裝飾，H1 使用 Mobile/H1（34px）；三個場域節點保留。

Code impact: CSS `.explore-*`。

Risk: Low

### RWD-022

Page: About
Viewport: < 640
Component: `.partners-list`

Current behavior: 5 個合作單位單欄堆疊，約 1,200px。

UX impact: 次要資訊佔太多捲動。

Proposed Figma solution: 手機 2 欄、平板 3 欄。

Code impact: `AboutILink.css`。

Risk: Low

### RWD-023

Page: Impact
Viewport: < 640
Component: `.impact-stat`

Current behavior: 4 個數據卡單欄，各 `min-height: 220px`。

UX impact: 4 個數字要捲 1.3 屏，無法一眼比較。

Proposed Figma solution: 2×2 grid，數字使用 Mobile/Display。

Code impact: CSS `.impact-stats__inner`、`.impact-stat`。

Risk: Low

### RWD-026

Page: Home
Viewport: < 640
Component: `.intro`（Hero）

Current behavior: Hero 佔滿首屏，但沒有任何 CTA；唯一的「向下探索」在時間軸區段。

UX impact: 首屏沒有下一步。

Proposed Figma solution: Hero 底部 Primary「開始看故事」+ 次要「逛地方 / 學生作品」文字連結。

Code impact: `TimelinePage.tsx` hero 區塊。

Risk: Low

## Timeline Issues

（RWD-001、002、005、008、009、010、027 皆屬時間軸，此處整理方案。）

**資料來源不變**：`fetchTimelineEvents()` → `createTimelineChapters()` → `TimelineChapter[]`（`id, slug, index, year, eyebrow, title, description, location, panels[]…`）。所有方案只換呈現元件。

| | Option A · 簡化 Vertical Timeline | Option B · Story Feed | **Option C · Hybrid（建議）** |
|---|---|---|---|
| 形式 | Rail 列表：日期欄 + 軸點 + 60×80 海報縮圖 + 標題 + 標籤；月份黏性標頭 | 一則一屏橫向 swipe（scroll-snap）；上方 25 段進度；44px 上/下一則；可切換列表 | 最新 6 則 swipe（B）+ 全年 rail（A），先顯示 8 則再展開 |
| 高度（25 則） | ≈ 2,900px | ≈ 720px | ≈ 2,400px（含 swipe） |
| 優點 | 最易掃讀、最省流量、SEO/讀屏友善 | 保留「翻閱故事」的敘事感 | 兼顧敘事入口與完整索引 |
| 缺點 | 故事感弱 | 找特定活動要一直滑；橫向手勢較難發現 | 元件兩種 |
| Desktop | 不用 | 不用 | 不影響（Desktop 保留 WebGL） |

Tablet：不載入 WebGL；使用 Option C 的 2 欄版本。

## Image Issues

- RWD-002 CORS 快取衝突（Home mobile）
- RWD-028 直式海報被橫式 cover 裁切（全站）
- RWD-020 Post 封面寬幅裁切海報
- `SafeImage` 沒有 `srcset/sizes`，手機載入 `large_url`；timeline 縮圖在手機同時載入兩份
- Home hero poster 404（RWD-004），影片載入前手機 hero 是底色
- `.media-fallback` 沒有比例，fallback 時版面塌陷

### RWD-020

Page: Post Detail
Viewport: all（手機最明顯）
Component: `.post-page__cover`

Current behavior: 封面以寬幅 `cover` 裁切，海報類封面上下被切掉。

UX impact: 文章頁看不到完整主視覺。

Proposed Figma solution: 海報封面 `contain`，最大高度 Desktop 640 / Mobile 480，照片封面維持 cover。

Code impact: `PostPage.tsx`、CSS `.post-page__cover`。

Risk: Low

## Navigation Issues

### RWD-013

Page: Works
Viewport: all
Component: `.works-filter__group` 按鈕

Current behavior: 地區與分類兩組都以「全部」開頭，桌機一列看到兩個「全部」；按鈕為純文字、高度約 20px，active 狀態用 1.88:1 的金色文字 + 底線。

UX impact: 使用者分不清哪個「全部」屬於哪組；手機難以點準。

Proposed Figma solution: `FilterChip`（已建）44px、「全部地區 / 全部分類」、群組標籤「地區」「分類」、Selected 用 ink 底 + 勾號（不只靠顏色）。

Code impact: `WorksArchivePage.tsx` 篩選按鈕、CSS `.works-filter*`；可加 `role="radiogroup"`。

Risk: Low

### RWD-014

Page: 全站
Viewport: ≤ 900
Component: `SiteHeader`（`.menu-toggle`、`.demo-header nav`）

Current behavior: 關閉的選單只有 `opacity: 0; pointer-events: none`，6 個連結仍在 Tab 順序與讀屏樹中；沒有 Esc 關閉、點遮罩關閉、背景捲動鎖定、focus trap；開啟時頁面內容仍可見且可捲；目前頁金色文字 1.88:1。

UX impact: 鍵盤/讀屏使用者會聚焦到看不見的連結；手機誤觸背景。

Proposed Figma solution: `MobileMenu`（已建）：全螢幕、64px 列高、目前頁有「目前頁面」文字標示、gold-ink；`Navbar` Desktop/Tablet/Mobile 三個 variant。

Code impact: `SiteHeader.tsx`（`inert`/`hidden`、keydown、scroll lock）、CSS。

Risk: Low

### RWD-015

Page: 全站
Viewport: < 640
Component: `.site-footer__links`、Works 篩選、分頁

Current behavior: Footer 連結高 19px；Works chip 約 20px。

UX impact: 觸控誤點。

Proposed Figma solution: 所有互動元素 ≥ 44×44（Footer 2 欄 × 44px 列）。

Code impact: CSS。

Risk: Low

### RWD-019

Page: Post Detail
Viewport: all
Component: `PostPage`

Current behavior: 沒有日期/地區/分類、沒有返回、沒有 gallery（API 有 `gallery_links` 但沒渲染）、沒有相關文章或上下篇；Header 傳 `currentPath="/posts"`，fallback 成「看故事」被標為目前頁。

UX impact: 文章頁是死路；使用者不知道這篇屬於哪個場域/時間。

Proposed Figma solution: 麵包屑/返回列、Tag（日期/地區/分類）、封面、內文、gallery（橫向捲動）、相關文章 3 張 PostCard、上一篇/下一篇。

Code impact: `PostPage.tsx`（只讀既有 API 欄位，不改 API）、`SiteHeader` active 邏輯。

Risk: Low

## Accessibility Issues

### RWD-027

Page: Home
Viewport: < 900
Component: `TimelineOverlay`

Current behavior: 手機 25 則故事全部可見，但除 activeIndex(0) 外都 `aria-hidden="true"`。

UX impact: 讀屏使用者只讀得到 1 則故事。

Proposed Figma solution: 新 Rail/Feed 為一般列表（`<ol>` + `<a>`），不使用 aria-hidden。

Code impact: `TimelineOverlay.tsx` / 新元件。

Risk: Low

### RWD-006

Page: Home
Viewport: all
Component: `timeline.api.ts`（`theme: post.category`、`location: post.region`）

Current behavior: 顯示原始 enum：`LOCAL_RESEARCH`、`AI_APPLICATION`、`QISHAN`；其他頁已經用 `formatPostCategory` / `formatPostRegion`。

UX impact: 讀屏會逐字母念出；看起來像未完成。

Proposed Figma solution: `Tag` 一律顯示中文 label。

Code impact: `timeline.api.ts` 或 `timeline.data.ts` 套用 `contentLabels.ts`。

Risk: Low

其他：
- 金色文字對比 1.88:1（eyebrow、日期、active nav、Works 篩選 active）→ `text/accent #7D6A16`。
- 無 404 頁：未知路徑顯示首頁。
- Events 卡片 `<h2>` 與區段 `<h2>` 同級，標題階層扁平。

## Performance Concerns

### RWD-024

Page: 全站
Viewport: touch devices
Component: `useSmoothScroll`（Lenis）

Current behavior: Lenis 在所有裝置啟用（`touchMultiplier: 1.1`），只有 reduced-motion 時關閉；`gsap.ticker.lagSmoothing(0)`。

UX impact: 手機原生慣性捲動被接管，低階機掉幀；與 iOS 橡皮筋、網址列收合互動不佳。

Proposed Figma solution: Motion 規則：Mobile/Tablet 使用原生捲動（Foundations → Motion）。

Code impact: `useSmoothScroll.ts` 條件（`pointer: fine` 且 ≥1024）。

Risk: Medium（`scrollToPageY` 依賴 activeLenis，需保留原生 fallback）

### RWD-004

Page: 全站
Viewport: all
Component: `siteSettings.ts`、Home hero `<video poster>`

Current behavior: `GET /api/v1/site-settings` 回 404，header/footer 永遠使用前端 fallback；hero poster 404，手機在影片（900ms 後才開始載）出現前 hero 只有底色。

UX impact: CMS 無法控制導覽/頁尾；首屏空白。

Proposed Figma solution: Hero 以靜態圖為底、影片漸入（Desktop/Tablet），Mobile 預設只顯示圖片（省流量），提供播放鈕。

Code impact: 後端路由或前端 endpoint 路徑確認；`TimelinePage.tsx` poster URL。

Risk: Low

其他：
- 手機首頁載入 50+ 張圖（同一張縮圖兩次）；改版後首屏只載 3 張。
- `ScrollTrigger` diagnostics 僅 DEV，OK。
- `gsap/Flip` 已註冊但未使用（`ContentPages.tsx`）。

### RWD-016

Page: 全站
Viewport: all
Component: `styles.css`

Current behavior: 89 種 font-size、43 種 gap、99 種 padding、11 個 breakpoint；H1 在各頁 32–158px。

UX impact: 各頁視覺節奏不一致；每修一個 breakpoint 就可能影響別頁。

Proposed Figma solution: 00 Foundations token + text styles（D/T/M 各 10 階）。

Code impact: `:root` 新增 CSS custom properties；逐元件替換（不一次重寫）。

Risk: Medium

### RWD-017

Page: 全站
Viewport: all
Component: 標題

Current behavior: 中文標題孤字（「訪」「索」「台。」）。

UX impact: 閱讀節奏差、看起來未排版。

Proposed Figma solution: 標題 `text-wrap: balance`，段落 `text-wrap: pretty`；標題最大寬度以字數控制。

Code impact: CSS。

Risk: Low

### RWD-018

Page: 全站
Viewport: all
Component: `index.html`、`:root` font-family

Current behavior: Noto Sans/Serif TC 未載入，依賴本機字型（iOS → PingFang/Songti、Windows → 微軟正黑/新細明體）。

UX impact: 品牌 serif 標題在多數手機上不是設計的字體。

Proposed Figma solution: Foundations 指定字體；建議 Google Fonts `Noto Serif TC`（只載 700）+ `display=swap`、`unicode-range` 分片。

Code impact: `index.html`、`styles.css`。

Risk: Medium（CJK webfont 流量，需子集或只用在標題）

### RWD-025

Page: —
Viewport: —
Component: 程式碼

Current behavior: `StoryPanel.tsx`（578 行）未使用；約 30 個 CSS class 已無引用（`editorial-*`、`about-hero*`、`about-network*`、`event-row`、`events-hero`、`hero-mosaic`、`work-grid`、`works-hero`、`place-panel`、`journey-path`、`filter-strip`、`impact-bars` …）。

UX impact: 無直接影響；增加維護與 regression 風險。

Proposed Figma solution: —

Code impact: 刪除死碼（Implementation 階段最後做）。

Risk: Low

---

## Proposed Responsive Strategy

**Desktop ≥ 1024（且 fine pointer）**：保留 Hero 影片、WebGL 時間軸、pin、Lenis。修：TimelineCard/Desktop Panel 可讀性、進度列可跳轉、移除 story-detail、「所有故事」4 欄海報卡、Works 3 欄文字在圖外、Events 左側年份/月份索引 + 右側列表、Post 兩欄（內文 720 + 側欄 meta）、H1 統一 64（Display 96 只用於首頁）。

**Tablet 640–1023**：不載 three.js、不 pin、原生捲動；Navbar/Tablet（3 項 + 更多）；8 欄 grid：Home 2 欄 StoryCard、Works 2 欄、Events 2 欄、Places 2+1；Post 單欄 640。

**Mobile < 640**：Timeline Option C；Hero 加 CTA；Works/Events 篩選收進 BottomSheet；EventCard 緊湊橫列；Impact 2×2；About partners 2 欄；Post 加 meta/返回/gallery/相關文章；全站 44px 觸控、原生捲動、reduced-motion 全關。

**不變**：CMS data model、API response、slug、URL、SEO metadata、Media 結構、App.tsx 路由語意。

## Components To Refactor

| Component | 檔案 | 改動 |
|---|---|---|
| SiteHeader | `shared/SiteHeader.tsx` | Tablet variant、menu 可及性（inert/Esc/scroll lock）、Post active 狀態 |
| SiteFooter | `shared/SiteFooter.tsx` | 44px 連結、2 欄 |
| SafeImage | `shared/SafeMedia.tsx` | `ratio`/`fit` props、不自動 crossOrigin、fallback 保留比例、srcset |
| TimelineOverlay / TimelineProgress | `features/timeline/` | Desktop Panel 樣式、25 格可跳轉進度 |
| TimelinePage | `features/timeline/TimelinePage.tsx` | 斷點條件、移除 story-detail、hero CTA |
| WorkCard + 篩選 | `features/pages/WorksArchivePage.tsx` | 文字移出圖、BottomSheet |
| EventsPage | `features/pages/ContentPages.tsx` | 分組、緊湊卡 |
| PostPage | `features/posts/PostPage.tsx` | meta、返回、gallery、相關文章 |
| useSmoothScroll | `features/timeline/hooks/useSmoothScroll.ts` | 只在 desktop fine pointer 啟用 |

## Components To Preserve

- `TimelineScene`（WebGL，Desktop only）與 `useTimelineAnimation` 的 pin 機制
- `createTimelineChapters` / `fetchTimelineEvents`（資料層）
- `ExplorePlacesHero` 路線圖（Desktop）、`PlaceChapters`、`AboutILink` 結構
- `ImpactCounter` / 年度進度（加 reduced-motion 已有）
- `media.ts`、`posts.ts`、`seo.ts`、`App.tsx` 路由

## Components Mobile Should Replace

| Desktop | Mobile / Tablet 替代 | 決策 |
|---|---|---|
| WebGL `TimelineScene` + pin | `StoryFeed`（swipe）+ `TimelineRail` | C · 替換 |
| `TimelineOverlay` 全部列出 | 不渲染 | D · 移除 |
| `chapter-grid` + `story-detail` | 併入 Rail（直接連文章） | D · 移除 |
| `TimelineProgress` | Rail 月份標頭 / Feed 分段進度 | C · 替換 |
| Works 兩列篩選按鈕 | 「篩選」按鈕 + BottomSheet | C · 替換 |
| Events 大卡 + 按鈕 | EventCard/Mobile 橫列 | B · 簡化 |
| Places 路線 SVG 動畫 | 靜態節點（已如此） | B · 保留簡化 |
| Hover 效果 | focus-visible / pressed | B · 簡化 |
| Lenis | 原生捲動 | D · 移除 |

## Risk Areas

1. **首頁時間軸**（GSAP pin + Lenis + R3F）：High。任何 DOM 結構變動都可能讓 pin spacer 計算錯誤；repo 已有 `check-timeline-scroll.cjs` / `check-timeline-aspect.cjs` 可做回歸。
2. **斷點條件改變**（900 → 1024 + pointer）：Medium。901–1023 的非觸控小筆電會從 WebGL 變成 Tablet 版，需業主確認。
3. **R2 CORS**：SafeImage crossOrigin 策略改變可能影響 WebGL texture（three 需要 CORS 圖）。
4. **CJK webfont**：流量與 FOUT。

## Regression Risks

- Desktop WebGL 在 ≥1024 fine pointer 必須與現況完全一致（Production Before vs Local After 截圖比對）。
- `scrollToPageY` / 「向下探索」在 Lenis 關閉時要能 fallback 原生 `scrollTo`。
- Works 分頁與篩選 URL 參數行為不可變（`check-works-pagination.cjs`）。
- `/posts/:slug` SEO（`updateSeo`、JSON-LD）不可變。
- 圖片不可重新出現 CORS 或 local media 請求（`check-no-local-media-requests.cjs`）。

## Figma Frames Created

File：https://www.figma.com/design/audQmrRvH0zjWLrL39PaED （Starter 方案限 3 頁，9 個規劃頁以區段合併）

| Figma 頁 | 內容 | 狀態 | Node |
|---|---|---|---|
| `00 Foundations · 03 Components` | **00 Foundations**：Colors（19 variables + 對比）、Typography（30 text styles，D/T/M）、Spacing、Radius、Breakpoints/Grid、Motion 規則 | ✅ | `5:2` |
| 同上 | **03 Components**：Button（24 variants：Primary/Secondary/Text × Default/Hover/Pressed/Disabled × Desktop/Mobile）、Tag（4）、FilterChip（3）、SectionHeading（3）、ImageFrame（5）、PostCard（2）、StoryCard（2）、TimelineCard（2）、PlaceCard（2）、EventCard（2）、WorkCard（2）、Logo、Navbar（3）、MobileMenu、MobileBottomSheet、Footer（2）— 全部 Auto Layout + 綁定 color variables | ✅ | `6:2` |
| `01 Current Website · 02 Responsive Audit` | 7 頁 × Desktop 1440 / Tablet 768 / Mobile 390 正式站截圖（54 張切片）+ 每列右側 RWD 問題卡 + 全站問題區 | ✅ | `2:2` |
| `04–06 Proposals · 07 Prototype · 08 Handoff` | Desktop / Tablet / Mobile 提案畫面、Prototype 連線、Dev Handoff | ❌ 未建立（MCP 額度用盡） | — |

Variables：`I-LINK / Color`（19）、`I-LINK / Scale`（57：space 10、radius 5、desktop/tablet/mobile 各 14）。

## Files Likely To Change

```
src/styles.css                                   tokens、斷點收斂、各元件 CSS
src/features/pages/AboutILink.css                partners grid
index.html                                       webfont
src/shared/SiteHeader.tsx                        tablet nav、menu a11y、active
src/shared/SiteFooter.tsx                        44px links
src/shared/SafeMedia.tsx                         ratio/fit、crossOrigin、fallback
src/features/timeline/TimelinePage.tsx           斷點條件、移除 detail、hero CTA、mobile 分支
src/features/timeline/TimelineOverlay.tsx        desktop panel
src/features/timeline/TimelineProgress.tsx       25 格可跳轉
src/features/timeline/timeline.api.ts            中文 label、不帶檔名
src/features/timeline/hooks/useSmoothScroll.ts   desktop only
src/features/timeline/TimelineRail.tsx           (new)
src/features/timeline/StoryFeed.tsx              (new)
src/shared/BottomSheet.tsx                       (new)
src/features/pages/WorksArchivePage.tsx          WorkCard、篩選
src/features/pages/ContentPages.tsx              Events 分組、Impact 2×2
src/features/pages/ExplorePlacesHero.tsx         斷點條件、mobile 裝飾
src/features/posts/PostPage.tsx                  meta、返回、gallery、相關文章
src/features/timeline/StoryPanel.tsx             (delete, unused)
```

---

## 附註：內容資料

- 2 篇文章 `event_date` 在未來：`mei-nong-de-wen-hua-yu-di-fang-ji-yi-fen-xiang-2`（2026-11-04）、`qi-shan-zai-di-qi-che-chan-ye-qi-che-fen-xiang`（2026-11-11），可能是 2025 的誤植；它們會排在「最新故事」第一、二位。
- 3 篇標題皆為「AI共讀讀書會」、3 篇「美濃的文化與地方記憶分享」，在卡片列表中難以區分，建議加副標或場次。

## Figma 狀態

Figma 帳號為 **Starter 方案 + View seat**：
- 每月 20 次 MCP 工具呼叫 → 已用完，最後一次（Mobile Proposal）被拒：`You've reached the Figma MCP tool call limit on the Starter plan.`
- 每個檔案最多 3 頁、每個 variable collection 只能 1 個 mode。

要完成 04–08 需擇一：升級 Professional（Full 或 Dev seat，200 次/日、無頁數限制、可用 modes）、或等下個月額度重置。
