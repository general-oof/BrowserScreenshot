const fs = require('fs/promises');
const path = require('path');

async function download(url, filename) {
    console.log(`Downloading: ${url}`);
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        await fs.writeFile(path.join(__dirname, filename), buffer);
        console.log(`Saved ${filename} (${(buffer.length / 1024).toFixed(2)} KB)`);
    } catch (err) {
        console.error(`Error saving ${filename}:`, err.message);
    }
}

async function runTests() {
    console.log('--- TEST 1: BULK SCREENSHOTS ---');
    const bulkUrls = [
        'https://kunalm.com',
        'https://harshkl.com',
        'https://anshulkr.com',
        'https://browserbase.com',
        'https://unikraft.com'
    ];

    const bulkPayload = {
        requests: bulkUrls.map(url => ({ url })),
        options: {
            format: 'jpeg',
            width: 1280,
            height: 800
        }
    };

    try {
        const res = await fetch('http://localhost:3000/api/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bulkPayload)
        });

        const data = await res.json();
        if (data.results) {
            for (const result of data.results) {
                if (result.success && result.data) {
                    const domain = new URL(result.url).hostname;
                    const base64Data = result.data.replace(/^data:image\/\w+;base64,/, "");
                    const buffer = Buffer.from(base64Data, 'base64');
                    const file = `bulk-${domain}.jpeg`;
                    await fs.writeFile(path.join(__dirname, file), buffer);
                    console.log(`Saved Bulk Screenshot: ${file}`);
                } else {
                    console.error(`Failed Bulk Screenshot for ${result.url}:`, result.error);
                }
            }
        } else {
            console.error('Bulk API failed:', data);
        }
    } catch (err) {
        console.error('Bulk fetch error:', err);
    }

    console.log('\n--- TEST 2: SCROLL DOWN SCREENSHOT ---');
    // Scroll down by 800px on kunalm.com
    const kunalUrl = 'http://localhost:3000/api/screenshot?url=https://kunalm.com&scroll_by=800&format=jpeg';
    await download(kunalUrl, 'kunalm-scrolled.jpeg');

    console.log('\n--- TEST 3: ANIMATED SCREENSHOT W/ TIME LIMIT ---');
    // Animated screenshot of browserbase.com, scroll by 300px each 500ms, max time 5000ms (5 seconds)
    const browserbaseUrl = 'http://localhost:3000/api/screenshot?url=https://browserbase.com&format=webm&scroll_by=300&scroll_delay=500&scroll_max_time=5000';
    await download(browserbaseUrl, 'browserbase-animated.webm');

    console.log('\nAll tests complete! Check the prexel-browser directory for the files.');
}

runTests();
