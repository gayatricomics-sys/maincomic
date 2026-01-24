/**
 * LLMService: Handles text-to-text generation for scene visualization.
 * Uses free Hugging Face Inference API via local proxy.
 * Implements fallback strategies for robustness.
 */
export class LLMService {
    constructor() {
        this.primaryModel = "mistralai/Mistral-7B-Instruct-v0.2";
        this.backupModel = "HuggingFaceH4/zephyr-7b-beta";
    }

    async visualize(scriptText) {
        console.log("LLMService: Visualizing scene for...", scriptText.substring(0, 30));

        // Try Primary
        try {
            return await this.callModel(this.primaryModel, scriptText);
        } catch (err) {
            console.warn(`LLMService: Primary model failed (${err.message}). Trying backup...`);
            // Try Backup
            try {
                return await this.callModel(this.backupModel, scriptText);
            } catch (backupErr) {
                console.error("LLMService: All models failed. Returning raw text.");
                // Ultimate fallback is raw text
                return scriptText;
            }
        }
    }

    async callModel(model, scriptText) {
        // We use the proxy but query params need to be part of the url param
        const targetUrl = `https://api-inference.huggingface.co/models/${model}`;
        const proxyUrl = '/proxy?url=' + encodeURIComponent(targetUrl);

        // Prompt engineering suitable for Mistral/Zephyr
        const prompt = `<s>[INST] You are a comic book artist's assistant. Describe the visual scene for a comic panel based on this script:
"${scriptText}"

Instructions:
1. Describe CHARACTERS, SETTING, and ACTION.
2. Concise (1-2 sentences).
3. NO dialogue bubbles.
4. Output ONLY the visual description. [/INST]`;

        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_new_tokens: 150,
                    temperature: 0.7,
                    return_full_text: false
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HF Error ${response.status}: ${errText}`);
        }

        const data = await response.json();

        // Robust parsing of HF Inference API response
        let visualization = "";
        if (Array.isArray(data) && data.length > 0) {
            visualization = data[0].generated_text;
        } else if (data.generated_text) {
            visualization = data.generated_text;
        } else if (typeof data === 'string') {
            visualization = data;
        } else {
            throw new Error("Unexpected response format: " + JSON.stringify(data));
        }

        if (!visualization) throw new Error("Empty visualization result");

        // Cleanup tags
        visualization = visualization
            .replace(/\[\/INST\]/g, "")
            .replace(/<s>/g, "")
            .replace(/<\/s>/g, "")
            .trim();

        console.log(`LLMService: Visualization result (${model}):`, visualization);
        return visualization || scriptText;
    }
}
