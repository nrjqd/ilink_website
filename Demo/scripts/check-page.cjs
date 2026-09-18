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

  page.on("console", (msg) => logs.push({ type: msg.type(), text: msg.text() }));
  page.on("pageerror", (error) => logs.push({ type: "pageerror", text: error.stack || error.message }));

  const response = await page.goto("http://127.0.0.1:5174/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(6500);

  const responseStatus = response?.status();
  const state = await page.evaluate(() => {
    const root = document.getElementById("root");
    const body = document.body;
    const center = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    const intro = document.querySelector(".intro");
    const video = document.querySelector("video");

    return {
      title: document.title,
      rootText: (root?.innerText || "").slice(0, 800),
      rootHtmlLength: root?.innerHTML.length || 0,
      bodyRect: { width: body.scrollWidth, height: body.scrollHeight },
      rootRect: root
        ? { width: root.getBoundingClientRect().width, height: root.getBoundingClientRect().height }
        : null,
      centerTag: center?.tagName,
      centerClass: typeof center?.className === "string" ? center.className : "",
      introRect: intro
        ? { width: intro.getBoundingClientRect().width, height: intro.getBoundingClientRect().height }
        : null,
      videoRect: video
        ? { width: video.getBoundingClientRect().width, height: video.getBoundingClientRect().height }
        : null,
      videoReadyState: video ? video.readyState : null,
    };
  });

  await page.screenshot({ path: "test-results/check-page.png", fullPage: false });
  console.log(JSON.stringify({ responseStatus, logs, state }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
