import { LLMService } from './llm-service.js';

// Mock Fetch
global.fetch = async (url, options) => {
    // console.log(`[MockFetch] Request to ${url}`);

    // Test Case 1: Error Response (simulating 429 or 500)
    if (url.includes("error_test")) {
        return {
            ok: false,
            status: 429,
            text: async () => "Rate Limit Exceeded"
        };
    }

    // Test Case 2: Content Policy Text
    if (url.includes("policy_test")) {
        return {
            ok: true,
            status: 200,
            text: async () => "I cannot generate this content due to safety guidelines."
        };
    }

    // Test Case 3: Success
    return {
        ok: true,
        status: 200,
        text: async () => "A beautiful sunset over the mountains."
    };
};

// Mock Console to keep output clean but visible
const originalConsole = { ...console };
console.warn = (msg) => originalConsole.log(`[Expected Warn] ${msg}`);
console.log = (msg) => originalConsole.log(`[Log] ${msg}`);

async function runTests() {
    const service = new LLMService();
    let passed = 0;
    let total = 0;

    console.log("--- Starting LLMService Logic Tests ---");

    // Test 1: Success Path
    total++;
    try {
        const result = await service.visualize("Panel 1: Sunset");
        if (result === "A beautiful sunset over the mountains.") {
            console.log("✅ Test 1 Passed: Normal Generation");
            passed++;
        } else {
            console.error("❌ Test 1 Failed: Got " + result);
        }
    } catch (e) { console.error("❌ Test 1 Exception: " + e); }


    // Test 2: Policy/Safety Block
    total++;
    try {
        // We inject a special string to trigger our mock
        // Real code encodes the prompt, so we need to ensure our mock logic matches the encoded string or just rely on the URL structure.
        // LLMService encodes the prompt.
        // Let's modify the service call slightly or rely on the mock ignoring query params effectively for this test?
        // Actually, our mock checks `url.includes`.
        // The service generates: /proxy?url=...pollinations.ai/...prompt...
        // So if we put 'policy_test' in the prompt, it will appear in the URL.
        const result = await service.visualize("policy_test");

        // Expected: Fallback to original text because "safety guidelines" is in errorSignatures
        if (result === "policy_test") {
            console.log("✅ Test 2 Passed: Safety Fallback");
            passed++;
        } else {
            console.error("❌ Test 2 Failed: Should fallback to script text. Got: " + result);
        }
    } catch (e) { console.error("❌ Test 2 Exception: " + e); }

    // Test 3: Retry Logic (Error 429)
    total++;
    // To properly test retry, we need state in our mock.
    // Let's redefine mock for this test
    let attempts = 0;
    global.fetch = async (url) => {
        if (url.includes("retry_test")) {
            attempts++;
            if (attempts < 3) {
                return { ok: false, status: 429, text: async () => "Rate Limit" };
            }
            return { ok: true, status: 200, text: async () => "Success after retry" };
        }
        return { ok: true, status: 200, text: () => "OK" };
    };

    try {
        const result = await service.visualize("retry_test");
        if (result === "Success after retry" && attempts === 3) {
            console.log("✅ Test 3 Passed: Retry Logic (Attempts: " + attempts + ")");
            passed++;
        } else {
            console.error(`❌ Test 3 Failed: Result='${result}', Attempts=${attempts}`);
        }
    } catch (e) { console.error("❌ Test 3 Exception: " + e); }

    console.log(`\n--- Results: ${passed}/${total} Passed ---`);
}

runTests();
