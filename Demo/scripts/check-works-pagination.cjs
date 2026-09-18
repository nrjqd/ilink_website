/**
 * 前端自動化檢查腳本，透過瀏覽器或檔案掃描驗證頁面渲染、媒體 URL 與互動狀態。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const logs = [];
  const failedRequests = [];

  page.on("console", (msg) => logs.push({ type: msg.type(), text: msg.text() }));
  page.on("pageerror", (error) => logs.push({ type: "pageerror", text: error.stack || error.message }));
  page.on("requestfailed", (request) => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText });
  });

  const response = await page.goto("http://127.0.0.1:5174/works", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);

  const firstPage = await page.evaluate(() => ({
    countText: document.querySelector(".works-bottom p")?.textContent?.replace(/\s+/g, " ").trim(),
    cards: [...document.querySelectorAll(".work-card")].map((card) => card.textContent?.replace(/\s+/g, " ").trim()),
    images: [...document.querySelectorAll(".work-card img")].map((image) => ({
      src: image.getAttribute("src"),
      complete: image.complete,
      width: image.naturalWidth,
      height: image.naturalHeight,
    })),
    activePage: document.querySelector(".works-pagination button.is-active")?.textContent?.trim(),
  }));

  await page.getByRole("button", { name: "下一頁" }).click();
  await page.waitForTimeout(900);

  const secondPage = await page.evaluate(() => ({
    countText: document.querySelector(".works-bottom p")?.textContent?.replace(/\s+/g, " ").trim(),
    cards: [...document.querySelectorAll(".work-card")].map((card) => card.textContent?.replace(/\s+/g, " ").trim()),
    images: [...document.querySelectorAll(".work-card img")].map((image) => ({
      src: image.getAttribute("src"),
      complete: image.complete,
      width: image.naturalWidth,
      height: image.naturalHeight,
    })),
    activePage: document.querySelector(".works-pagination button.is-active")?.textContent?.trim(),
  }));

  await page.screenshot({ path: "test-results/check-works-pagination.png", fullPage: false });
  console.log(JSON.stringify({ responseStatus: response?.status(), logs, failedRequests, firstPage, secondPage }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
