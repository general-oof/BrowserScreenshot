import { NextRequest, NextResponse } from 'next/server';
import { chromium, Browser } from 'playwright';

// Global variable to hold our persistent browser instance
let globalBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!globalBrowser) {
    console.log('[Screenshot API] Launching new global browser instance...');
    globalBrowser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }
  return globalBrowser;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    new URL(url);
  } catch (e) {
    return NextResponse.json({ error: 'Invalid url parameter format' }, { status: 400 });
  }

  const width = parseInt(searchParams.get('width') || '1280');
  const height = parseInt(searchParams.get('height') || '800');
  const fullPage = searchParams.get('fullPage') === 'true';

  try {
    const startTime = Date.now();
    console.log(`[Screenshot API] Capturing: ${url}`);

    // Check out browser from the "pool" (our global instance)
    const browser = await getBrowser();

    // Create an isolated context for this specific request
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();

    // OPTIMIZATION: Block unnecessary resources
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      const reqUrl = route.request().url();

      // Block heavy and unnecessary types
      if (['media', 'font', 'other'].includes(type) ||
        reqUrl.includes('google-analytics') ||
        reqUrl.includes('doubleclick') ||
        reqUrl.includes('facebook.com')) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Navigate using a faster wait strategy
    // 'domcontentloaded' or 'load' is much faster than 'networkidle'
    await page.goto(url, { waitUntil: 'load', timeout: 15000 });

    // Optional: add a tiny explicit wait just for JS rendering/animations to settle
    await page.waitForTimeout(500);

    const screenshotBuffer = await page.screenshot({
      fullPage,
      type: 'png'
    });

    // Close just the context, leave the browser running!
    await context.close();

    console.log(`[Screenshot API] Captured ${url} in ${Date.now() - startTime}ms`);

    // Return image with caching headers (e.g. cache for 1 hour on CDN)
    return new NextResponse(screenshotBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });

  } catch (error) {
    console.error('[Screenshot API] Error:', error);
    return NextResponse.json({
      error: 'Failed to capture screenshot',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
  // Notice we NO LONGER close the browser in the finally block!
}
