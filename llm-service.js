/**
 * LLMService: Handles text-to-text generation for scene visualization.
 * Uses local Ollama when available, with Pollinations text as fallback.
 */
export class LLMService {
    constructor() {
        this.provider = 'ollama';
    }

    async visualize(scriptText, config = {}) {
        const logText = scriptText.length > 50 ? scriptText.substring(0, 50) + "..." : scriptText;
        console.log("LLMService: Visualizing scene for...", logText);

        // SYSTEM PROMPT: Optimized for stability
        const systemPrompt = `You are a visual prompt engineer.
Task: Convert the comic script into a concise visual description for an image generator (Stable Diffusion).
Rules:
1. Output ONLY the visual description in English language. NO conversational filler.
2. Focus on: Characters, Action, Setting, Lighting.
3. BE SPECIFIC ABOUT BREEDS: If an animal is mentioned (like a dog), specify its breed and distinctive features (e.g., "Toy Poodle: small, curly white fur" vs "Golden Retriever: large, smooth golden coat").
4. Ignore dialogue.
5. Max 40 words.
6. If the script is abstract, describe a concrete metaphorical scene.`;

        const fullPrompt = `${systemPrompt}\n\nUser Script: "${scriptText}"\n\nVisual Prompt:`;
        const provider = config.provider || 'ollama';
        const model = config.model || 'qwen3:8b';

        if (provider === 'ollama') {
            const ollamaText = await this.tryOllama(fullPrompt, model);
            if (ollamaText) {
                return ollamaText;
            }
        }

        return this.tryPollinations(fullPrompt, scriptText);
    }

    async tryOllama(fullPrompt, model) {
        try {
            const response = await fetch('/api/ollama/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt: fullPrompt
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const payload = await response.json();
            const text = this.cleanVisualPrompt(payload?.response || '');
            if (!text || text.length < 5) {
                throw new Error('Response too short');
            }

            console.log('LLMService: Ollama success:', text);
            return text;
        } catch (err) {
            console.warn(`LLMService: Ollama failed: ${err.message}`);
            return '';
        }
    }

    async tryPollinations(fullPrompt, scriptText) {
        const targetUrl = `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}`;
        const proxyUrl = '/proxy?url=' + encodeURIComponent(targetUrl);

        const maxRetries = 3;
        const baseDelay = 1500;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                let text = await response.text();

                // VALIDATION: Check for emptiness or error messages
                if (!text || text.trim().length < 5) throw new Error("Response too short");

                const lowerText = text.toLowerCase();
                const invalidSignatures = [
                    "error", "rate limit", "unable to generate",
                    "i cannot", "sorry", "content policy", "response body"
                ];

                if (invalidSignatures.some(sig => lowerText.includes(sig))) {
                    throw new Error("LLM returned refusal or error message");
                }

                text = this.cleanVisualPrompt(text);

                console.log("LLMService: Success:", text);
                return text;

            } catch (err) {
                console.warn(`LLMService: Attempt ${attempt} failed: ${err.message}`);
                if (attempt < maxRetries) {
                    const delay = baseDelay * Math.pow(1.5, attempt - 1); // Exponential backoff
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }

        // FALLBACK: If all retries fail, construct a basic safety prompt
        console.error("LLMService: All attempts failed. Using fallback.");
        return `${scriptText}, comic book style, vivid colors, high quality`;
    }

    cleanVisualPrompt(text) {
        return (text || '')
            .trim()
            .replace(/^Visual Description:\s*/i, '')
            .replace(/^Visual Prompt:\s*/i, '')
            .replace(/^Scene:\s*/i, '')
            .replace(/^"|"$/g, '');
    }
}
