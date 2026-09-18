const { chromium } = require("playwright");

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5181";
const imageUrl =
  "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/branding/logo/i-link-logo-display.png";

function makeItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    slug: `diagnostic-${index + 1}`,
    title: `Diagnostic ${index + 1}`,
    summary: `Timeline diagnostic chapter ${index + 1}`,
    region: "Diagnostic",
    category: "Diagnostic",
    event_date: `2026-09-${String(index + 1).padStart(2, "0")}`,
    cover_media: {
      original_filename: `diagnostic-${index + 1}.png`,
      original_url: imageUrl,
      large_url: imageUrl,
      thumbnail_url: imageUrl,
    },
    gallery_links: [],
  }));
}

async function installRoutes(page, chapterCount) {
  await page.route("**/api/v1/site-settings", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({}),
    });
  });

  await page.route("**/api/v1/posts?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ items: makeItems(chapterCount) }),
    });
  });
}

async function readMetrics(page) {
  return page.evaluate(() => {
    const container = document.querySelector(".timeline-story");
    const viewport = document.querySelector(".timeline-viewport");
    const nextSection = container?.nextElementSibling;
    const pinSpacer =
      viewport?.parentElement?.classList.contains("pin-spacer")
        ? viewport.parentElement
        : viewport?.closest(".pin-spacer");

    if (!(container instanceof HTMLElement) || !(viewport instanceof HTMLElement)) {
      return null;
    }

    const containerRect = container.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const nextRect =
      nextSection instanceof HTMLElement
        ? nextSection.getBoundingClientRect()
        : null;
    const pinSpacers = Array.from(
      container.querySelectorAll(".pin-spacer"),
    );
    const containerStyle = getComputedStyle(container);
    const viewportStyle = getComputedStyle(viewport);
    const pinSpacerStyle =
      pinSpacer instanceof HTMLElement
        ? getComputedStyle(pinSpacer)
        : null;
    const trigger = window.ScrollTrigger?.getAll?.().find(
      (item) => item.vars.id === "timeline-story",
    );
    const chapterCount = document.querySelectorAll(".chapter-copy").length;
    const configuredDistance = chapterCount * 360;
    const cssMinHeight = parseFloat(containerStyle.minHeight);
    const requiredPinHeight = viewport.offsetHeight + configuredDistance;

    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      chapterCount,
      configuredDistance,
      triggerStart: trigger?.start ?? null,
      triggerEnd: trigger?.end ?? null,
      scrollY: window.scrollY,
      timelineStory: {
        offsetHeight: container.offsetHeight,
        scrollHeight: container.scrollHeight,
        cssMinHeight: containerStyle.minHeight,
        cssHeight: containerStyle.height,
        parsedMinHeight: cssMinHeight,
      },
      timelineViewport: {
        offsetHeight: viewport.offsetHeight,
        cssHeight: viewportStyle.height,
        rectTop: viewportRect.top,
        rectBottom: viewportRect.bottom,
      },
      pinSpacer:
        pinSpacer instanceof HTMLElement
          ? {
              offsetHeight: pinSpacer.offsetHeight,
              paddingBottom: pinSpacerStyle?.paddingBottom ?? null,
              marginBottom: pinSpacerStyle?.marginBottom ?? null,
              nestedPinSpacerCount: pinSpacers.length,
            }
          : null,
      gaps: {
        containerBottom: containerRect.bottom,
        viewportBottom: viewportRect.bottom,
        nextSectionTop: nextRect?.top ?? null,
        gapFromViewportToContainerBottom:
          containerRect.bottom - viewportRect.bottom,
        gapFromContainerToNextSection: nextRect
          ? nextRect.top - containerRect.bottom
          : null,
      },
      heightComparison: {
        cssMinHeight,
        requiredPinHeight,
        difference: container.offsetHeight - requiredPinHeight,
      },
      triggers:
        window.ScrollTrigger?.getAll?.().map((item) => ({
          id: item.vars.id ?? null,
          trigger: item.trigger?.className ?? null,
          start: item.start,
          end: item.end,
          pin: item.pin?.className ?? null,
        })) ?? [],
      lenisInlineStyles: {
        html: document.documentElement.getAttribute("style"),
        body: document.body.getAttribute("style"),
      },
    };
  });
}

async function capture(viewport, chapterCount = 4) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 1,
  });
  const consoleTables = [];
  const errors = [];

  page.on("console", async (message) => {
    const text = message.text();
    if (text.includes("[Timeline Scroll Diagnostics]") || message.type() === "table") {
      const args = [];
      for (const arg of message.args()) {
        try {
          args.push(await arg.jsonValue());
        } catch {
          args.push(String(arg));
        }
      }
      consoleTables.push({ type: message.type(), text, args });
    }
    if (message.type() === "error") {
      errors.push(text);
    }
  });

  await installRoutes(page, chapterCount);
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector(".timeline-story", { timeout: 30000 });
  await page.waitForTimeout(3500);

  const afterRefresh = await readMetrics(page);
  const targetScroll =
    afterRefresh && typeof afterRefresh.triggerEnd === "number"
      ? afterRefresh.triggerEnd - 4
      : 0;

  if (targetScroll > 0) {
    await page.evaluate((y) => window.scrollTo(0, y), targetScroll);
    await page.waitForTimeout(1200);
  }

  const nearEnd = await readMetrics(page);

  await page.setViewportSize({
    width: viewport.width + 1,
    height: viewport.height,
  });
  await page.waitForTimeout(800);
  await page.setViewportSize(viewport);
  await page.waitForTimeout(1200);

  const afterResize = await readMetrics(page);

  await browser.close();

  return {
    viewport,
    afterRefresh,
    nearEnd,
    afterResize,
    diagnosticsSeen: consoleTables.some((entry) =>
      entry.text.includes("[Timeline Scroll Diagnostics]"),
    ),
    errors: errors.slice(0, 8),
  };
}

async function main() {
  const results = [];
  const chapterCounts = (process.env.CHAPTER_COUNTS || "4")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

  for (const chapterCount of chapterCounts) {
    const viewports =
      chapterCounts.length > 1
        ? [{ width: 1440, height: 900 }]
        : [
            { width: 1920, height: 1080 },
            { width: 1440, height: 900 },
            { width: 1366, height: 768 },
            { width: 900, height: 800 },
            { width: 390, height: 844 },
          ];

    for (const viewport of viewports) {
      const result = await capture(viewport, chapterCount);
      const pick = (metrics) =>
        metrics
          ? {
            chapterCount: metrics.chapterCount,
            configuredDistance: metrics.configuredDistance,
            triggerStart: metrics.triggerStart,
            triggerEnd: metrics.triggerEnd,
            timelineStoryOffsetHeight:
              metrics.timelineStory.offsetHeight,
            timelineStoryCssMinHeight:
              metrics.timelineStory.cssMinHeight,
            viewportOffsetHeight:
              metrics.timelineViewport.offsetHeight,
            pinSpacerHeight:
              metrics.pinSpacer?.offsetHeight ?? null,
            pinSpacerPaddingBottom:
              metrics.pinSpacer?.paddingBottom ?? null,
            nestedPinSpacerCount:
              metrics.pinSpacer?.nestedPinSpacerCount ?? 0,
            gapFromViewportToContainerBottom:
              metrics.gaps.gapFromViewportToContainerBottom,
            gapFromContainerToNextSection:
              metrics.gaps.gapFromContainerToNextSection,
            requiredPinHeight:
              metrics.heightComparison.requiredPinHeight,
            difference: metrics.heightComparison.difference,
            triggerCount: metrics.triggers.length,
            lenisInlineStyles: metrics.lenisInlineStyles,
          }
        : null;

      results.push({
        viewport: result.viewport,
        requestedChapterCount: chapterCount,
        afterRefresh: pick(result.afterRefresh),
        nearEnd: pick(result.nearEnd),
        afterResize: pick(result.afterResize),
        diagnosticsSeen: result.diagnosticsSeen,
        errorCount: result.errors.length,
        errors: result.errors,
      });
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
