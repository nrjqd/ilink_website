const { chromium } = require("playwright");

const baseUrl = (process.env.CHECK_BASE_URL || "http://localhost:5174").replace(/\/$/, "");
const badConsolePattern = /Texture load failed|CORS policy|GSAP target not found|Context Lost|WebGLRenderer: Context Lost/i;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const imageRequests = [];

  page.on("console", (message) => {
    consoleMessages.push({ type: message.type(), text: message.text() });
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.stack || error.message);
  });

  page.on("requestfailed", (request) => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText });
  });

  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("r2.dev/") && /\/posts\/.*\.(webp|png|jpe?g)(\?|$)/i.test(url)) {
      imageRequests.push({ url, status: response.status() });
    }
  });

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator("#story").scrollIntoViewIfNeeded();
  await page.waitForTimeout(5000);

  const beforeResize = await page.evaluate(() => {
    const canvas = document.querySelector(".timeline-canvas canvas");
    const wrapper = document.querySelector(".timeline-canvas");
    const story = document.querySelector("#story");
    return {
      canvasExists: Boolean(canvas),
      canvasWidth: canvas?.clientWidth ?? 0,
      canvasHeight: canvas?.clientHeight ?? 0,
      wrapperWidth: wrapper?.clientWidth ?? 0,
      wrapperHeight: wrapper?.clientHeight ?? 0,
      storyHeight: story?.clientHeight ?? 0,
    };
  });

  await page.setViewportSize({ width: 1180, height: 920 });
  await page.waitForTimeout(2000);

  const afterResize = await page.evaluate(() => {
    const canvas = document.querySelector(".timeline-canvas canvas");
    const wrapper = document.querySelector(".timeline-canvas");
    return {
      canvasExists: Boolean(canvas),
      canvasWidth: canvas?.clientWidth ?? 0,
      canvasHeight: canvas?.clientHeight ?? 0,
      wrapperWidth: wrapper?.clientWidth ?? 0,
      wrapperHeight: wrapper?.clientHeight ?? 0,
    };
  });

  await browser.close();

  const badConsole = consoleMessages.filter((message) => badConsolePattern.test(message.text));
  const externalFailures = failedRequests.filter(
    (request) => request.error !== "net::ERR_ABORTED" && !request.url.includes("favicon"),
  );
  const thumbCount = imageRequests.filter((request) => request.url.includes("/thumb/")).length;
  const largeCount = imageRequests.filter((request) => request.url.includes("/large/")).length;
  const originalCount = imageRequests.filter((request) => request.url.includes("/original/")).length;
  const ok =
    badConsole.length === 0 &&
    pageErrors.length === 0 &&
    externalFailures.length === 0 &&
    beforeResize.canvasExists &&
    beforeResize.canvasWidth > 0 &&
    beforeResize.canvasHeight > 0 &&
    afterResize.canvasExists &&
    afterResize.canvasWidth > 0 &&
    afterResize.canvasHeight > 0 &&
    thumbCount > 0 &&
    largeCount === 0 &&
    originalCount === 0;

  const result = {
    ok,
    beforeResize,
    afterResize,
    badConsole,
    pageErrors,
    externalFailures,
    imageRequestCount: imageRequests.length,
    thumbCount,
    largeCount,
    originalCount,
    sampleImageRequests: imageRequests.slice(0, 12),
  };

  console.log(JSON.stringify(result, null, 2));
  if (!ok) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
