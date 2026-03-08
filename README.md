# Prexel Browser API

A powerful, high-performance Screenshot API built on Next.js, Playwright, and Puppeteer Stealth. Designed as a local, customizable alternative to premium APIs like ScreenshotOne.

## Features at a Glance
- 📸 **High-Fidelity Captures**: PNG and JPEG with retina device scaling support (`device_scale_factor`).
- 🎥 **Animated Captures (WebM)**: Record smooth video of web pages scrolling and loading.
- 🗂 **Bulk API**: Process multiple snapshot requests concurrently via a single JSON packet.
- 🌙 **Force Dark Mode**: Aggressively forces standard light/dark modes on uncooperative frameworks.
- 🚫 **Built-in Ad & Cookie Blocker**: Automatically snipes GDPR/CCPA consent banners and standard ad-networks.
- 📜 **Advanced Scrolling Strategy**: Capable of custom scrolling into views or pacing scrolls to trigger lazy loading.
- 👻 **Stealth Modifiers**: Injects Puppeteer stealth plugins to heavily mitigate bot detection.


---

## Getting Started

### 1. Installation

Ensure you have Node.js installed, then clone the repository and run:

```bash
npm install
# Install required browser binaries for Playwright
npx playwright install chromium
```

### 2. Running the Server

Start the local development server:

```bash
npm run dev
```

The server will spin up the API at `http://localhost:3000`.

---

## The `/api/screenshot` Endpoint (GET)

Handles individual URL screenshot requests by passing customization flags through URL query parameters.

### Basic Usage:
```
GET http://localhost:3000/api/screenshot?url=https://github.com&full_page=true
```

### Supported Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | `string` | **Required** | The target website URL. |
| `format` | `png \| jpeg \| webm` | `png` | File format to return. `webm` triggers video mode! |
| `width` | `number` | `1280` | Browser viewport width. |
| `height` | `number` | `800` | Browser viewport height. |
| `full_page` | `boolean` | `false` | Take a screenshot of the entire scrollable page. |
| `quality` | `number` | `80` | Image compression quality (only applies to `jpeg`). |
| `dark_mode` | `boolean` | `false` | Aggressively override site CSS with dark mode themes. |
| `block_cookie_banners` | `boolean` | `true` | Snipes and hides cookie/GDPR pop-ups. |
| `block_ads_trackers` | `boolean` | `true` | Intercepts routing calls to ad-networks (Google Analytics, etc). |
| `device_scale_factor` | `number` | `2` | Device pixel ratio (1-3). |
| `omit_background` | `boolean` | `false` | Sets transparent backgrounds (PNG only). |
| `wait_until` | `load \| domcontentloaded \| networkidle`| `load` | The event Playwright waits for before proceeding. |
| `wait_for_timeout` | `number` | `none` | Explicitly stall the capture by X milliseconds. |

### Scrolling Capabilities (for Lazy Loading & WebM)

If you need the page to scroll down slowly (to trigger images or record animation):

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `scroll_by` | `number` | `none` | Triggers a smooth auto-scroll mechanic by `X` pixels incrementally. |
| `scroll_delay` | `number` | `500` | The delay between each incremental scan (milliseconds). |
| `scroll_max_time` | `number` | `15000` | Abort scrolling after this amount of time (milliseconds). |
| `scroll_max_distance`| `number`| `none` | Maximum vertical scroll distance allowed before halting. |
| `scroll_to_element` | `string` | `none` | CSS Selector to specifically scroll down into view. |

---

## The `/api/bulk` Endpoint (POST)

Submits multiple screenshot tasks in a single JSON payload.

### Basic Usage:
```json
// POST http://localhost:3000/api/bulk
{
  "requests": [
    { "url": "https://example.com" },
    { "url": "https://github.com", "dark_mode": "true", "format": "jpeg" }
  ],
  "options": {
    "width": 1920,
    "height": 1080
  }
}
```

The `options` object defines the default parameters for all items. Individual `requests` objects override the globals!

### Response
Returns an array of results with pure base64 `data` values if successful:
```json
{
  "results": [
    {
      "url": "https://example.com",
      "success": true,
      "content_type": "image/png",
      "data": "data:image/png;base64,iVBORw0KGgo..."
    }
  ]
}
```

Enjoy your streamlined screenshot engine!
