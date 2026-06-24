class LocalProvider {
    constructor() {
        this.name = 'Local (SD)';
    }

    async generate(prompt, config = {}) {
        const response = await fetch('/api/local/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            throw new Error(`Local image generation failed: HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        return data.url;
    }
}

class PollinationsProvider {
    constructor(modelName) {
        this.model = modelName || '';
        this.name = this.model ? `Pollinations (${this.model})` : 'Pollinations (default)';
    }

    async generate(prompt, config = {}) {
        // Add strong negative weighting to the prompt itself for text exclusion
        const textExclusion = ', NO TEXT IN IMAGE, absolutely no words, no letters, no writing, no captions, no subtitles, no watermarks, no logos, no signatures, clean image without any readable characters';
        const enhancedPrompt = prompt + textExclusion;
        const safePrompt = encodeURIComponent(enhancedPrompt);
        const seed = config.seed || Math.floor(Math.random() * 1000000);
        const params = new URLSearchParams({
            width: '1280',
            height: '1280',
            seed: String(seed),
            nologo: 'true'
        });

        const model = config.model || this.model;
        if (model) {
            params.set('model', model);
        }

        // Add negative prompt to exclude text from images
        const negativePrompt = 'text, words, letters, writing, caption, subtitle, speech bubble, comic bubble, callout, thought bubble, dialogue box, watermark, signature, logo, gibberish text, random letters, unreadable text, text-like patterns, alphabet, numbers, signage, book pages, readable screens, typography, font, typeface';
        params.set('negative_prompt', negativePrompt);

        const targetUrl = `https://gen.pollinations.ai/image/${safePrompt}?${params.toString()}`;
        return `/proxy?url=${encodeURIComponent(targetUrl)}`;
    }
}

function enhancePromptForQuality(prompt) {
    return [
        prompt,
        'single comic panel',
        'high quality',
        'highly detailed',
        'clean composition',
        'sharp focus',
        'professional illustration',
        'consistent anatomy',
        'cinematic lighting',
        'ABSOLUTELY NO TEXT: image must contain zero words, zero letters, zero numbers, zero readable characters',
        'no watermark, no logo, no signature, no text overlay of any kind',
        'no gibberish squiggles or fake letter patterns',
        'no book pages, no screens with text, no signs with writing',
        'pure visual storytelling with imagery only',
        'overlay text handled separately by app'
    ].join(', ');
}

// Manager Class
export class ImageService {
    constructor() {
        this.providers = [
            new PollinationsProvider(''),
            new PollinationsProvider('flux'),
            new PollinationsProvider('turbo'),
            new LocalProvider()  // Fallback to local SD
        ];
        this.cache = new Map();
    }

    async generateImage(prompt, config = {}) {
        const style = config.style || '';
        const combinedPrompt = style ? `${style}, ${prompt}` : prompt;
        const fullPrompt = enhancePromptForQuality(combinedPrompt);
        const cacheKey = `${fullPrompt.trim()}::${config.model || 'pollinations-default'}`;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        let lastError;
        for (const provider of this.providers) {
            try {
                const imageUrl = await provider.generate(fullPrompt, {
                    model: config.model,
                    seed: Math.floor(Math.random() * 1000000)
                });
                const isValid = await this.validateUrl(imageUrl, 60000);
                if (!isValid) {
                    throw new Error('Provider returned a non-image response');
                }
                this.cache.set(cacheKey, imageUrl);
                return imageUrl;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Pollinations image generation failed');
    }

    async validateUrl(url, timeout = 60000) {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(id);
            if (!response.ok) {
                return false;
            }
            const contentType = response.headers.get('Content-Type') || '';
            return contentType.startsWith('image/');
        } catch {
            return false;
        }
    }
}
