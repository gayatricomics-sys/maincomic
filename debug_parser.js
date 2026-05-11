
const text = `🟦 Panel 1 – Introduction
Teaching Point:
AI is not one thing. There are different architectures designed for different problems.

Panel 2
**Prompt:**
A robot teaching a class of students.`;

function parseScript(text) {
    const lines = text.split('\n');
    const panels = [];

    // Buffer to hold lines for the current panel
    let buffer = [];

    // Regex to identify explicit panel starts
    // Matches: "Panel 1", "Panel 1:", "🟦 Panel 1", "Panel 1 - Intro"
    // Also matches just numbers like "1." if at start of line? Maybe too risky.
    // Let's stick to "Panel X" or variants with emojis users paste.
    const panelStartRegex = /^(?:🟦\s*|[*#-]*\s*)?Panel\s+(\d+)/i;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const match = trimmed.match(panelStartRegex);
        if (match) {
            // New Panel Detected

            // 1. Finish previous panel if buffer has content
            if (buffer.length > 0) {
                panels.push({ text: buffer.join(' ') });
                buffer = [];
            }

            // 2. Process Header Line
            // The header line itself might contain text (e.g. "Panel 1: The Intro")
            // We strip the "Panel X" part and separators
            let content = trimmed.replace(panelStartRegex, '').trim();
            // Remove separator chars at start like ":", "-", "–"
            content = content.replace(/^[:\-\–\.]\s*/, '');

            if (content) buffer.push(content);

        } else {
            // Continuation of current panel or implicit first panel
            buffer.push(trimmed);
        }
    });

    // Push final buffer
    if (buffer.length > 0) {
        panels.push({ text: buffer.join(' ') });
    }

    // Post-processing: Assign IDs and Clean Text
    return panels.map((p, index) => {
        let cleanText = p.text;

        // Remove "Prompt:", "Teaching Point:", etc.
        // We replace them with a space
        cleanText = cleanText.replace(/(\*\*|__)?(Prompt|Scene|Script|Description|Teaching Point|Visual)(\*\*|__)?:\s*/gi, " ");

        // Clean up excessive spaces
        cleanText = cleanText.replace(/\s+/g, ' ').trim();

        return {
            id: index + 1,
            text: cleanText
        };
    });
}

const result = parseScript(text);
console.log(JSON.stringify(result, null, 2));
console.log("Total Panels:", result.length);
