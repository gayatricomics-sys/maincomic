export class AudioService {
    async generateNarration(text, config = {}) {
        const cleanText = (text || '').trim();
        if (!cleanText) {
            throw new Error('Narration text is required');
        }

        const voice = config.voice || 'Aman';
        const backend = config.backend || 'system';
        const response = await fetch('/api/local/audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: cleanText,
                voice,
                backend
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
            throw new Error(detail ? `${detail} (${response.status})` : `Narration request failed (${response.status})`);
        }

        const payload = await response.json();
        if (!payload?.url) {
            throw new Error('Narration generation returned no URL');
        }
        return payload.url;
    }
}
