/**
 * 前端自動化檢查腳本，透過瀏覽器或檔案掃描驗證頁面渲染、媒體 URL 與互動狀態。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

const { chromium } = require("playwright");

const baseUrl = (process.env.CHECK_BASE_URL || "http://127.0.0.1:5174").replace(/\/$/, "");
const localMediaPattern = /^http:\/\/(?:127\.0\.0\.1|localhost):\d+\/(?:assets\/|images\/|uploads\/|favicon\.svg)/;
const pages = ["/", "/works", "/places", "/events", "/impact", "/about"];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const localMediaRequests = [];
  const failedRequests = [];
  let currentPath = "";

  page.on("request", (request) => {
    const url = request.url();
    if ((request.resourceType() === "image" || request.resourceType() === "media") && localMediaPattern.test(url)) {
      localMediaRequests.push({ page: currentPath, url });
    }
  });
  page.on("requestfailed", (request) => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText });
  });

  for (const path of pages) {
    currentPath = path;
    await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1800);
    await page.evaluate(() => window.scrollTo(0, Math.floor(document.body.scrollHeight * 0.55)));
    await page.waitForTimeout(1200);
  }

  await browser.close();

  const externalFailures = failedRequests.filter(
    (request) => request.error !== "net::ERR_ABORTED" && !localMediaPattern.test(request.url),
  );
  if (localMediaRequests.length > 0) {
    console.error(JSON.stringify({ ok: false, localMediaRequests, externalFailures }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, pagesChecked: pages.length, localMediaRequests: 0, externalFailures }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
