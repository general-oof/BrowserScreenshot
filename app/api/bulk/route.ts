import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { requests, options: baseOptions = {} } = body;

        if (!Array.isArray(requests)) {
            return NextResponse.json({ error: '"requests" must be an array of objects' }, { status: 400 });
        }

        const hostOrigin = req.nextUrl.origin;

        console.log(`[Bulk API] Processing ${requests.length} requests sequentially...`);
        const results = [];

        for (let i = 0; i < requests.length; i++) {
            const reqConfig = requests[i];
            if (!reqConfig.url) {
                results.push({ error: 'URL is required for each request', success: false });
                continue;
            }

            const mergedOptions = { ...baseOptions, ...reqConfig };

            const searchParams = new URLSearchParams();
            for (const [key, value] of Object.entries(mergedOptions)) {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, String(value));
                }
            }

            const apiUrl = `${hostOrigin}/api/screenshot?${searchParams.toString()}`;
            console.log(`[Bulk API] -> Taking screenshot ${i + 1}/${requests.length}: ${reqConfig.url}`);

            try {
                const res = await fetch(apiUrl);
                if (res.ok) {
                    const arrayBuffer = await res.arrayBuffer();
                    const base64 = Buffer.from(arrayBuffer).toString('base64');
                    const contentType = res.headers.get('content-type') || 'image/png';
                    results.push({
                        url: reqConfig.url,
                        success: true,
                        content_type: contentType,
                        data: `data:${contentType};base64,${base64}`
                    });
                } else {
                    const errText = await res.text();
                    let errJson;
                    try { errJson = JSON.parse(errText); } catch { errJson = errText; }
                    results.push({
                        url: reqConfig.url,
                        success: false,
                        error: errJson
                    });
                }
            } catch (fetchErr: any) {
                results.push({
                    url: reqConfig.url,
                    success: false,
                    error: fetchErr.message
                });
            }
        }

        console.log(`[Bulk API] Finished processing ${requests.length} requests.`);
        return NextResponse.json({ results });
    } catch (err: any) {
        return NextResponse.json({ error: 'Failed to process bulk request', details: err.message }, { status: 500 });
    }
}
