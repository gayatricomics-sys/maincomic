class PollinationsProvider {
    constructor(modelName) {
        this.model = modelName || '';
        this.name = this.model ? `Pollinations (${this.model})` : 'Pollinations (default)';
    }

    async generate(prompt, config = {}) {
        const safePrompt = encodeURIComponent(prompt);
        const seed = config.seed || Math.floor(Math.random() * 1000000);
        const params = new URLSearchParams({
            width: '1280',
            height: '1280',
            seed: String(seed)
        });

        const model = config.model || this.model;
        if (model) {
            params.set('model', model);
        }

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
        'no watermark',
        'no text inside image',
        'no letters',
        'no words',
        'no subtitles',
        'no foreign language characters',
        'no gibberish typography',
        'overlay text handled separately'
    ].join(', ');
}

// Manager Class
export class ImageService {
    constructor() {
        this.providers = [
            new PollinationsProvider(''),
            new PollinationsProvider('flux'),
            new PollinationsProvider('turbo')
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
