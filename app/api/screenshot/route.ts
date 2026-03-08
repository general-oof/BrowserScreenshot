import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright-extra';
import { Browser } from 'playwright';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { z } from 'zod';

chromium.use(stealthPlugin());

let globalBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!globalBrowser) {
    console.log('[Screenshot API] Launching persistent global browser pool...');
    globalBrowser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }
  return globalBrowser;
}

// Helper to reliably parse string "true"/"false" from URL to boolean
const boolParam = (defaultValue: boolean) =>
  z.string()
    .optional()
    .default(defaultValue ? 'true' : 'false')
    .transform((val) => val === 'true');

const screenshotSchema = z.object({
  url: z.string().url(),
  width: z.coerce.number().int().min(100).max(4000).default(1280),
  height: z.coerce.number().int().min(100).max(4000).default(800),
  full_page: boolParam(false),

  format: z.enum(['png', 'jpeg']).default('png'),
  quality: z.coerce.number().int().min(1).max(100).default(80),
  omit_background: boolParam(false),
  device_scale_factor: z.coerce.number().int().min(1).max(3).default(2),

  wait_until: z.enum(['load', 'domcontentloaded', 'networkidle']).default('load'),
  wait_for_timeout: z.coerce.number().int().min(0).max(30000).optional(),
  wait_for_selector: z.string().optional(),

  dark_mode: boolParam(false),
  hide_selectors: z.string().optional(),
  user_agent: z.string().optional(),

  block_ads_trackers: boolParam(true),
  block_cookie_banners: boolParam(false),

  cold_boot: boolParam(false),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const paramsObj: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    paramsObj[key] = value;
  });

  const parsedParams = screenshotSchema.safeParse(paramsObj);

  if (!parsedParams.success) {
    return NextResponse.json({
      error: 'Invalid Request Parameters',
      details: parsedParams.error.format()
    }, { status: 400 });
  }

  const options = parsedParams.data;
  const startTime = Date.now();

  let browser: Browser | null = null;

  try {
    console.log(`[Screenshot API] Processing: ${options.url} (Format: ${options.format}, Cold Boot: ${options.cold_boot})`);

    if (options.cold_boot) {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
    } else {
      browser = await getBrowser();
    }

    const contextOptions: any = {
      viewport: { width: options.width, height: options.height },
      deviceScaleFactor: options.device_scale_factor,
      colorScheme: options.dark_mode ? 'dark' : 'light',
    };

    if (options.user_agent) {
      contextOptions.userAgent = options.user_agent;
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    if (options.block_ads_trackers) {
      await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        const reqUrl = route.request().url();
        const blockedDomains = ['google-analytics', 'doubleclick', 'facebook.com', 'googleadservices', 'analytics'];
        if (['media', 'font'].includes(type) || blockedDomains.some(d => reqUrl.includes(d))) {
          route.abort();
        } else {
          route.continue();
        }
      });
    }

    await page.goto(options.url, { waitUntil: options.wait_until, timeout: 30000 });

    // Force Dark Mode Aggressively (for sites that ignore prefers-color-scheme)
    if (options.dark_mode) {
      await page.evaluate(() => {
        // Force classes and attributes on HTML and BODY (e.g., Tailwind, Radix)
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.setAttribute('color-theme', 'dark');
        document.body.classList.add('dark');
      }).catch(() => { });
    }

    if (options.hide_selectors) {
      console.log(`[Screenshot API] Hiding selectors: ${options.hide_selectors}`);
      await page.addStyleTag({
        content: `${options.hide_selectors} { display: none !important; opacity: 0 !important; visibility: hidden !important; }`
      });
    }


    if (options.wait_for_selector) {
      await page.waitForSelector(options.wait_for_selector, { timeout: 15000 }).catch(() => {
        console.warn(`[Screenshot API] Timeout waiting for explicit selector: ${options.wait_for_selector}`);
      });
    }

    if (options.wait_for_timeout) {
      await page.waitForTimeout(options.wait_for_timeout);
    } else if (options.wait_until === 'load' && !options.wait_for_selector) {
      await page.waitForTimeout(500);
    }

    // Run Cookie Blockers AFTER all waiting strategies have finished and the DOM is settled
    if (options.block_cookie_banners) {
      await page.addStyleTag({
        content: `
         [id*="cookie" i], [class*="cookie" i], 
         [id*="consent" i], [class*="consent" i], 
         [class*="gdpr" i], [id*="gdpr" i],
         [id="onetrust-consent-sdk"], [class*="onetrust"],
         [class*="ccpa" i], [id*="ccpa" i],
         [class^="CookieBanner"], [class*="CookieBanner"],
         [data-testid*="cookie" i], [data-testid*="consent" i],
         [data-testid="consent-banner"],
         .fc-consent-root, #usercentrics-root
         { display: none !important; z-index: -9999 !important; pointer-events: none !important; visibility: hidden !important; opacity: 0 !important; }`
      });

      await page.evaluate(() => {
        // Step 1: Nuke common cookie elements by forcefully clicking "Reject All" or "Accept All"
        const buttons = Array.from(document.querySelectorAll('button, a'));
        buttons.forEach(b => {
          const el = b as HTMLElement;
          const text = (el.innerText || '').trim().toLowerCase();
          if (text.includes('reject all') || text.includes('got it') || text.includes('accept all cookies') || text.includes('agree & close')) {
            try { el.click(); } catch (e) { }
          }
        });

        // Step 2: Ruthlessly hunt down remaining fixed/absolute text containers
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        const nodesToRemove = [];
        let node;
        while (node = walker.nextNode()) {
          const text = node.nodeValue?.trim().toLowerCase() || '';
          if (text.includes('we use cookies') || text.includes('cookie settings') || text.includes('accept all cookies') || text.includes('reject all cookies')) {
            let parent = node.parentElement;
            for (let i = 0; i < 5; i++) {
              if (parent && parent !== document.body) {
                const style = window.getComputedStyle(parent);
                if (style.position === 'fixed' || style.position === 'absolute' || parent.tagName === 'DIALOG' || parseInt(style.zIndex || '0', 10) > 10) {
                  nodesToRemove.push(parent);
                  break;
                }
                parent = parent.parentElement;
              }
            }
          }
        }
        nodesToRemove.forEach(n => n.remove());
      }).catch(() => { });

      await page.waitForTimeout(1000); // Give the banner 1 second to play its exit animation
    }

    const screenshotOptions: any = {
      fullPage: options.full_page, // This is safely a boolean now!
      type: options.format,
    };

    if (options.format === 'jpeg') {
      screenshotOptions.quality = options.quality;
    }

    if (options.omit_background && options.format === 'png') {
      screenshotOptions.omitBackground = true;
    }

    const screenshotBuffer = await page.screenshot(screenshotOptions);

    await context.close();

    if (options.cold_boot && browser) {
      await browser.close();
    }

    console.log(`[Screenshot API] Successfully rendered ${options.url} in ${Date.now() - startTime}ms`);

    const contentType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';

    return new NextResponse(screenshotBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });

  } catch (error) {
    console.error('[Screenshot API] Error:', error);
    if (options.cold_boot && browser) {
      await browser.close().catch(() => { });
    }
    return NextResponse.json({
      error: 'Failed to capture screenshot',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
