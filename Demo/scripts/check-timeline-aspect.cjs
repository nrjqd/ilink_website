const { chromium } = require("playwright");

async function capture(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const diagnostics = [];
  const allConsole = [];
  const errors = [];

  page.on("console", async (message) => {
    const text = message.text();
    const args = [];

    for (const arg of message.args()) {
      try {
        args.push(await arg.jsonValue());
      } catch {
        args.push(String(arg));
      }
    }

    if (text.includes("[Timeline Diagnostics]")) {
      diagnostics.push({
        type: message.type(),
        text,
        args,
      });
    }

    allConsole.push({
      type: message.type(),
      text,
      args,
    });

    if (message.type() === "error") {
      errors.push({ text, args });
    }
  });

  page.on("pageerror", (error) => {
    errors.push({ text: error.message, args: [] });
  });

  if (process.env.MOCK_TIMELINE_API === "1") {
    await page.route("**/api/v1/site-settings", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({}),
      });
    });

    await page.route("**/api/v1/posts?**", async (route) => {
      const imageUrl =
        "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/branding/logo/i-link-logo-display.png";

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          items: [
            {
              id: 1,
              slug: "diagnostic-r2-image",
              title: "Diagnostic R2 image",
              summary: "Diagnostic fixture",
              region: "Diagnostic",
              category: "Diagnostic",
              event_date: "2026-09-01",
              cover_media: {
                original_filename: "diagnostic.webp",
                original_url: imageUrl,
                large_url: imageUrl,
                thumbnail_url: imageUrl,
              },
              gallery_links: [],
            },
          ],
        }),
      });
    });
  }

  await page.goto(url, {
    waitUntil: "networkidle",
    timeout: 45000,
  });

  await page.evaluate(() => {
    document.querySelector("#story")?.scrollIntoView();
  });

  await page.waitForTimeout(5000);
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(3000);

  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector(
      ".timeline-canvas canvas",
    );

    if (!(canvas instanceof HTMLCanvasElement)) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();

    return {
      width: canvas.width,
      height: canvas.height,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      rectWidth: rect.width,
      rectHeight: rect.height,
      bufferAspect: canvas.width / canvas.height,
      cssAspect: canvas.clientWidth / canvas.clientHeight,
      devicePixelRatio: window.devicePixelRatio,
    };
  });

  await browser.close();

  return {
    url,
    canvasInfo,
    diagnostics,
    allConsole: allConsole.slice(0, 160),
    errors,
  };
}

async function main() {
  const baseUrl =
    process.env.BASE_URL || "http://127.0.0.1:5174";
  const data = await capture(`${baseUrl}/`);
  const zero = await capture(
    `${baseUrl}/?timelineRotation=0`,
  );

  console.log(
    JSON.stringify(
      {
        data,
        zero,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
