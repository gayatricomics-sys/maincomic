const https = require('https');
const url = require('url');

exports.handler = async function (event, context) {
    const targetUrl = event.queryStringParameters.url;

    // CORS Headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json' // Default
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (!targetUrl) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "Missing 'url' parameter" })
        };
    }

    // Security Whitelist
    const allowedDomains = [
        'api-inference.huggingface.co',
        'image.pollinations.ai',
        'gen.pollinations.ai',
        'text.pollinations.ai'
    ];
    try {
        const domain = new URL(targetUrl).hostname;
        if (!allowedDomains.includes(domain)) {
            console.error(`Blocked domain: ${domain}`);
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: "Domain not allowed" })
            };
        }
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid URL" }) };
    }

    // Perform Request
    // We use standard fetch if available (Node 18+)
    // Or basic https request for compatibility

    try {
        const method = event.httpMethod;
        const body = event.body;

        const fetchOptions = {
            method: method,
            headers: {
                // Forward content type if present
                ...(event.headers['content-type'] ? { 'Content-Type': event.headers['content-type'] } : {}),
                'User-Agent': 'Mozilla/5.0'
            }
        };

        if (method === 'POST' && body) {
            fetchOptions.body = body;
        }

        const response = await fetch(targetUrl, fetchOptions);

        // Get response buffer (for images) or text
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type');

        if (contentType) {
            headers['Content-Type'] = contentType;
        }

        return {
            statusCode: response.status,
            headers,
            body: buffer.toString('base64'),
            isBase64Encoded: true
        };

    } catch (err) {
        console.error("Proxy Error:", err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message })
        };
    }
};
