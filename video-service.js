export class VideoService {
    async generateVideo(config = {}) {
        const panels = Array.isArray(config.panels) ? config.panels.filter(panel => panel?.imageUrl) : [];
        if (!panels.length) {
            throw new Error('At least one generated panel is required');
        }

        const response = await fetch('/api/local/reel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                panels,
                audio_url: config.audioUrl || '',
                animation_prompt: config.animationPrompt || '',
                prompt: config.prompt || ''
            })
        });
        if (!response.ok) {
            let detail = '';
            try {
                const errorBody = await response.json();
                detail = errorBody?.error || errorBody?.message || '';
            } catch {
                detail = await response.text();
            }
            throw new Error(detail ? `${detail} (${response.status})` : `Video request failed (${response.status})`);
        }

        const payload = await response.json();
        if (!payload?.url) {
            throw new Error('Reel generation returned no URL');
        }
        return payload.url;
    }
}
