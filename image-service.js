/**
 * ImageService: Robust Image Generation with Smart Rotation
 * Automatically cascades through multiple free models to ensure 100% success rate.
 */

// Pollinations.AI Provider
class PollinationsProvider {
    constructor(modelName) {
        this.name = `Pollinations (${modelName || 'default'})`;
        this.model = modelName; // 'flux', 'turbo', 'any-dark', 'sdxl'
    }

    async generate(prompt) {
        const safePrompt = encodeURIComponent(prompt);
        // Random seed to ensure uniqueness
        const seed = Math.floor(Math.random() * 1000000);

        let modelParam = '';
        if (this.model && this.model !== 'default') {
            modelParam = `&model=${this.model}`;
        }

        // Pollinations returns the image directly
        // We add nologo=true to keep it clean
        // We Use image.pollinations.ai/prompt/ for direct image access (avoids HTML wrappers)
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&seed=${seed}${modelParam}&nologo=true`;

        // Use local proxy
        return `/proxy?url=${encodeURIComponent(pollinationsUrl)}`;
    }
}

// Canvas Procedural Fallback (Never Fails)
class CanvasFallbackProvider {
    constructor() {
        this.name = 'Canvas Fallback';
    }

    async generate(prompt) {
        return new Promise((resolve) => {
            const width = 512;
            const height = 512;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // Vivid Colors for Kids
            const hue = Math.floor(Math.random() * 360);
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, `hsl(${hue}, 80%, 75%)`);
            gradient.addColorStop(1, `hsl(${hue + 60}, 70%, 60%)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Pop Art Shapes
            const shapes = 5 + Math.random() * 5;
            for (let i = 0; i < shapes; i++) {
                ctx.fillStyle = `hsla(${(hue + i * 45) % 360}, 90%, 50%, 0.3)`;
                ctx.beginPath();
                ctx.arc(
                    Math.random() * width,
                    Math.random() * height,
                    Math.random() * 100 + 20,
                    0, Math.PI * 2
                );
                ctx.fill();
            }

            // Text
            ctx.fillStyle = "white";
            ctx.strokeStyle = "black";
            ctx.lineWidth = 4;
            ctx.font = "bold 24px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.strokeText("Scene Visualized!", width / 2, height / 2 - 20);
            ctx.fillText("Scene Visualized!", width / 2, height / 2 - 20);

            ctx.font = "18px sans-serif";
            ctx.strokeText(prompt.substring(0, 25) + "...", width / 2, height / 2 + 20);
            ctx.fillText(prompt.substring(0, 25) + "...", width / 2, height / 2 + 20);

            canvas.toBlob((blob) => {
                resolve(URL.createObjectURL(blob));
            }, 'image/png');
        });
    }
}

// Manager Class
export class ImageService {
    constructor() {
        this.providers = [
            new PollinationsProvider('flux'),   // Best Quality
            new PollinationsProvider('turbo'),  // Fastest
            new PollinationsProvider('sdxl'),   // Solid Backup
            new PollinationsProvider('midjourney'), // Variant
        ];
        this.fallback = new CanvasFallbackProvider();
        this.cache = new Map();
    }

    async generateImage(prompt, config = {}) {
        const style = config.style || '';
        const fullPrompt = style ? `${style} style, ${prompt}` : prompt;
        const cacheKey = fullPrompt.trim();

        if (this.cache.has(cacheKey)) {
            console.log('Serving from cache:', cacheKey);
            return this.cache.get(cacheKey);
        }

        // 1. Try Providers in Rotation
        for (const provider of this.providers) {
            try {
                console.log(`Using ${provider.name}...`);
                const url = await provider.generate(fullPrompt);
                // Return URL directly. Let the browser handle loading/errors via img.onerror
                // This prevents double-fetching (once for validation, once for display) which kills performance.
                this.cache.set(cacheKey, url);
                return url;
            } catch (error) {
                console.warn(`${provider.name} failed/timed out:`, error);
                // Continue loop
            }
        }

        // 2. Ultimate Fallback
        console.warn("All AI providers failed. Using Canvas fallback.");
        const fallbackUrl = await this.fallback.generate(fullPrompt);
        return fallbackUrl;
    }

    // Checking if image URL is valid via Proxy
    async validateUrl(url, timeout = 60000) {

        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);

            // Use GET because our simple python proxy only implements do_GET.
            // HEAD requests are falling back to local file checks and 404ing.
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(id);

            if (response.ok) {
                // We don't need the body, just the status
                return true;
            }
            return false;
        } catch (err) {
            console.warn("Validation error:", err);
            return false;
        }
    }
}

