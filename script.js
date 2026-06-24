import { ImageService } from './image-service.js?v=20260513a';
import { LLMService } from './llm-service.js?v=20260513a';
import { VideoService } from './video-service.js?v=20260513a';
import { AudioService } from './audio-service.js?v=20260513a';

const imageService = new ImageService();
const llmService = new LLMService();
const videoService = new VideoService();
const audioService = new AudioService();

// State
const state = {
    currentStyle: 'Kids Cartoon',
    layout: 'grid',
    panels: [],
    reelUrl: '',
    audioUrl: '',
    audioSource: 'generated',
    reelScriptEdited: false
};

// Elements are defined at top of file
// Ensure state is available

// Styles Configuration
const STYLES = [
    { name: 'Kids Cartoon', icon: '🎨', promptSuffix: 'kids cartoon style, bright cheerful colors, friendly rounded characters, playful fun atmosphere, child-friendly illustration, soft shapes, happy expressive faces, storybook quality' },
    { name: 'Claymation', icon: '🧱', promptSuffix: 'claymation style, plasticine, aardman style, stop motion, cute, tactile texture' },
    { name: 'Origami', icon: '🦢', promptSuffix: 'origami style, paper folded art, papercraft, craft texture, 3d paper' },
    { name: 'Lego Style', icon: '🧩', promptSuffix: 'lego minifigures style, brick building, toy plastic texture, vibrant' },
    { name: 'Playdough', icon: '🌈', promptSuffix: 'playdough art, soft shapes, colorful, handmade texture, kid friendly' },
    { name: 'Plushie', icon: '🧸', promptSuffix: 'cute plushie toy style, felt texture, soft stitching, stuffed animal look' },
    { name: 'Sticker Art', icon: '🏷️', promptSuffix: 'sticker art style, white border, vector, pop art, vibrant, cute' },

    // --- Artistic & Hand-Drawn ---
    { name: 'Crayon', icon: '🖍️', promptSuffix: 'child crayon drawing, wax texture, colorful, scribbly, naive art' },
    { name: 'Cyber Crayon', icon: '🔐', promptSuffix: 'cybersecurity comic in crayon style, hand-drawn wax texture, hacker laptops, glowing shields, playful but clear infosec storytelling' },
    { name: 'Watercolor', icon: '🖌️', promptSuffix: 'soft watercolor painting, pastel colors, artistic, dreamy, storybook' },
    { name: 'Colored Pencil', icon: '✏️', promptSuffix: 'colored pencil sketch, hatching, hand drawn, textured paper, soft' },
    { name: 'Chalkboard', icon: '🏫', promptSuffix: 'chalk art on blackboard, white outlines, dusty texture, school style' },
    { name: 'Doodle', icon: '📝', promptSuffix: 'notebook doodle, blue ink, lined paper background, sketch looking' },
    { name: 'Threat Doodle', icon: '🛜', promptSuffix: 'cybersecurity threat doodle art, notebook sketch style, attack arrows, server icons, padlocks, whiteboard explanation energy' },

    // --- Digital & Manga-Inspired ---
    { name: 'Cinematic 3D', icon: '🎈', promptSuffix: 'stylized cinematic 3d animation, expressive faces, soft global illumination, polished family adventure look, high detail' },
    { name: 'Shonen Manga', icon: '👘', promptSuffix: 'dynamic shonen manga illustration, speed lines, dramatic action framing, expressive faces, crisp ink, screen tone shading' },
    { name: 'Cyber Manga', icon: '💻', promptSuffix: 'cybersecurity manga panel, dramatic hacker duel, glowing monitors, speed lines, sharp ink, screen tone shading, high tension incident response scene' },
    { name: 'Chibi', icon: '👶', promptSuffix: 'chibi anime style, big head small body, cute, kawaii, emoji style' },
    { name: 'Pixel Art', icon: '👾', promptSuffix: 'pixel art, 16-bit, retro game sprite, blocky, vibrant' },
    { name: 'Low Poly', icon: '🔷', promptSuffix: 'low poly 3d art, flat shading, geometric, video game style, minimal' },

    // --- Themes ---
    { name: 'Block World', icon: '🟩', promptSuffix: 'minecraft style, voxel art, blocky world, square shapes, video game' },
    { name: 'Hero Comic', icon: '🦸', promptSuffix: 'original superhero comic art, bold ink lines, halftone texture, dynamic action pose, dramatic city backdrop' },
    { name: 'Silver Age Hero', icon: '⭐', promptSuffix: 'original silver age hero comic, bright primary colors, clean ink contours, dramatic foreshortening, retro halftone printing, energetic action scene' },
    { name: 'Space', icon: '🚀', promptSuffix: 'space theme, starry background, futuristic, sci-fi, glowing, vibrant' },
    { name: 'Fairytale', icon: '🧚', promptSuffix: 'fairytale book illustration, magical, glowing, fantasy, enchanted forest' },
    { name: 'Cyberpunk', icon: '🤖', promptSuffix: 'kid friendly cyberpunk, neon lights, futuristic city, robot friends, glowing' },
    { name: 'Cybersecurity Comic', icon: '🛡️', promptSuffix: 'cybersecurity comic illustration, network defense dashboards, hackers, analysts, servers, clean visual storytelling, dramatic incident response scene' },
    { name: 'Indian Mythology', icon: '🪔', promptSuffix: 'Indian mythology comic illustration for kids, bal divine characters, gentle expressions, bright festive colors, temple architecture, glowing ornaments, respectful storybook tone, warm celestial palette' },
    { name: 'Ganesh Comic', icon: '🐘', promptSuffix: 'Bal Ganesh inspired child character comic illustration for kids, elephant-headed young divine figure, cute gentle expression, warm festive colors, temple motifs, modak, respectful storybook art, soft rounded shapes' },
    { name: 'Hanuman Epic', icon: '🗡️', promptSuffix: 'Bal Hanuman inspired child character comic illustration for kids, young divine monkey hero, playful bravery, gada mace, bright mythological landscape, respectful high-energy storybook style, friendly expression' },
    { name: 'Shiva Cosmic', icon: '🔱', promptSuffix: 'Bal Shiva inspired child character comic illustration for kids, young divine figure, gentle cosmic aura, trident symbolism, crescent moon, flowing hair, Himalayan or celestial backdrop, respectful soft storybook tone' },
    { name: 'Vishnu Celestial', icon: '🐚', promptSuffix: 'Bal Vishnu inspired child character comic illustration for kids, young divine royal figure, shankha and chakra symbolism, serene protective energy, heavenly setting, respectful warm storybook grandeur' },
    { name: 'Steampunk', icon: '⚙️', promptSuffix: 'steampunk style, brass and gears, victorian fantasy, adventure, warm colors' },
    { name: 'Dark Vigilante', icon: '🌃', promptSuffix: 'original dark vigilante comic, moody shadows, rain-soaked city, noir lighting, dramatic cape silhouette' },
    { name: 'Metro Guardian', icon: '🛡️', promptSuffix: 'original urban guardian comic, towering skyline, cinematic backlight, flowing cape shapes, emblematic costume design, high-impact hero framing' },
    { name: 'Shadow Detective', icon: '🕶️', promptSuffix: 'original noir detective vigilante comic, heavy shadows, rooftop tension, grayscale mood, sharp ink rendering, stormy night atmosphere' },
    { name: 'Saturday Cartoon', icon: '📡', promptSuffix: 'original saturday morning action cartoon, punchy shapes, thick outlines, energetic expressions, bright flat color' },
    { name: 'Toon Squad', icon: '🎭', promptSuffix: 'original team action cartoon, expressive poses, clean cel shading, playful exaggeration, colorful group energy, television animation layout' },
    { name: 'Action Toon', icon: '💥', promptSuffix: 'original animated action comedy, bold silhouette design, flat vibrant colors, simplified environments, snappy motion, youthful adventure tone' },
    { name: 'Seinen Ink', icon: '🖤', promptSuffix: 'seinen manga ink art, gritty black and white contrast, sharp linework, cinematic framing, mature atmosphere' },

    // --- Classic ---
    { name: 'Retro Cartoon', icon: '📺', promptSuffix: 'retro television cartoon, thick outlines, simplified backgrounds, high contrast color blocks, playful character acting' },
    { name: 'Vintage Comic', icon: '🗞️', promptSuffix: 'vintage comic book, halftone pattern, slightly distressed, retro colors' }
];

// DOM Elements
const elements = {
    scriptInput: document.getElementById('script-input'),
    charCount: document.querySelector('.char-count'),
    styleSelector: document.getElementById('style-selector'),
    layoutBtns: document.querySelectorAll('.layout-btn'),
    generateBtn: document.getElementById('generate-btn'),
    comicContainer: document.getElementById('comic-container'),
    exportPngBtn: document.getElementById('export-png'),
    exportPdfBtn: document.getElementById('export-pdf'),
    exportZipBtn: document.getElementById('export-zip'),
    exportAiPackageBtn: document.getElementById('export-ai-package'),
    generateVideoBtn: document.getElementById('generate-video-btn'),
    downloadVideoBtn: document.getElementById('download-video-btn'),
    videoModelSelector: document.getElementById('video-model-selector'),
    videoPromptInput: document.getElementById('video-prompt-input'),
    animationPromptInput: document.getElementById('animation-prompt-input'),
    videoStatus: document.getElementById('video-status'),
    videoPreview: document.getElementById('video-preview'),
    audioPreview: document.getElementById('audio-preview'),
    audioBackendSelector: document.getElementById('audio-backend-selector'),
    voiceSelector: document.getElementById('voice-selector'),
    customVoiceId: document.getElementById('custom-voice-id'),
    customAudioInput: document.getElementById('custom-audio-input'),
    generateAudioBtn: document.getElementById('generate-audio-btn'),
    playReelAudioBtn: document.getElementById('play-reel-audio-btn'),
    downloadAudioBtn: document.getElementById('download-audio-btn'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),
    loadingProgress: document.getElementById('loading-progress'),
    showSamplesBtn: document.getElementById('show-samples-btn'),
    saveProfileBtn: document.getElementById('save-profile-btn'),
    comicTitleInput: document.getElementById('comic-title-input'),
    comicCreditsInput: document.getElementById('comic-credits-input')
};

const CINEMATIC_PROMPT_SUFFIX = 'cinematic comic illustration, dynamic lighting, cinematic animation frame, smooth motion feel, slight motion blur, polished reel composition';

const INLINE_LOADING_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffd54f"/>
      <stop offset="100%" stop-color="#ff8a65"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="120" cy="110" r="56" fill="rgba(255,255,255,0.22)"/>
  <circle cx="408" cy="390" r="72" fill="rgba(255,255,255,0.16)"/>
  <text x="256" y="230" font-family="Arial, sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="#111">Generating...</text>
  <text x="256" y="276" font-family="Arial, sans-serif" font-size="20" text-anchor="middle" fill="#111">Preparing panel artwork</text>
</svg>
`)}`;

const IMAGE_TIMEOUT_MS = 90 * 1000;

function createErrorImageDataUrl(panelId) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="#f4f4f4"/>
      <rect x="24" y="24" width="464" height="464" rx="24" fill="#ffffff" stroke="#222" stroke-width="4"/>
      <text x="256" y="225" font-family="Arial, sans-serif" font-size="32" font-weight="700" text-anchor="middle" fill="#222">Panel ${panelId}</text>
      <text x="256" y="272" font-family="Arial, sans-serif" font-size="20" text-anchor="middle" fill="#555">Generation failed</text>
      <text x="256" y="308" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" fill="#777">Retry this panel</text>
    </svg>
    `)}`;
}

// Initialization
function init() {
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
        userDisplay.innerText = 'Guest';
    }

    const creditDisplay = document.getElementById('credit-display');
    if (creditDisplay) {
        creditDisplay.innerText = 'Guest Mode';
    }

    setupModelSelector();
    renderStyleSelector();
    setupEventListeners();
    syncVideoPromptFromScript();
    updateCharCount();

    // Add Random Style Button dynamically
    addRandomStyleButton();

    // Check for "load" param
    checkLoadParams();

    // Save Button
    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveComicToProfile);
}

function setupModelSelector() {
    const modelSelector = document.getElementById('model-selector');
    const apiKeyContainer = document.getElementById('api-key-container');
    if (!modelSelector || !apiKeyContainer) return;

    const syncVisibility = () => {
        apiKeyContainer.classList.add('hidden');
    };

    syncVisibility();
    modelSelector.addEventListener('change', syncVisibility);
}

function getPromptEngineConfig() {
    const provider = document.getElementById('prompt-provider-selector')?.value || 'ollama';
    const model = document.getElementById('ollama-model-selector')?.value || 'qwen3:8b';
    return { provider, model };
}

function getAudioBackendConfig() {
    const backend = elements.audioBackendSelector?.value || 'system';
    const selectedVoice = elements.voiceSelector?.value || 'Aman';
    const customVoice = elements.customVoiceId?.value.trim() || '';
    const voice = customVoice || selectedVoice || (backend === 'piper' ? 'en_US-amy-medium' : 'Aman');
    return { backend, voice };
}

function getAudioBackendFallbacks() {
    const preferred = getAudioBackendConfig();
    const candidates = [
        preferred,
        { backend: 'system', voice: 'Aman' },
        { backend: 'system', voice: 'Flo' },
        { backend: 'piper', voice: 'en_US-amy-medium' },
        { backend: 'piper', voice: 'en_US-lessac-medium' }
    ];

    const seen = new Set();
    return candidates.filter(item => {
        const key = `${item.backend}:${item.voice}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function addRandomStyleButton() {
    const headerActions = document.querySelector('.header-actions');
    const randomBtn = document.createElement('button');
    randomBtn.className = 'btn secondary';
    randomBtn.innerHTML = '<i class="fa-solid fa-dice"></i> Random Style';
    randomBtn.onclick = () => {
        const randomStyle = STYLES[Math.floor(Math.random() * STYLES.length)];
        selectStyle(randomStyle.name);
        // Scroll to style selector
        elements.styleSelector.scrollIntoView({ behavior: 'smooth' });
    };
    headerActions.insertBefore(randomBtn, headerActions.firstChild);
}

function renderStyleSelector() {
    elements.styleSelector.innerHTML = '';
    STYLES.forEach(style => {
        const div = document.createElement('div');
        div.className = `style-card ${style.name === state.currentStyle ? 'active' : ''}`;
        div.innerHTML = `
            <span class="style-icon">${style.icon}</span>
            <span class="style-name">${style.name}</span>
        `;
        div.onclick = () => selectStyle(style.name);
        elements.styleSelector.appendChild(div);
    });
}

function selectStyle(name) {
    state.currentStyle = name;
    renderStyleSelector();
}

function setupEventListeners() {
    // Input updates
    elements.scriptInput.addEventListener('input', updateCharCount);
    elements.scriptInput.addEventListener('input', syncVideoPromptFromScript);
    elements.videoPromptInput?.addEventListener('input', () => {
        state.reelScriptEdited = true;
    });

    // Layout Switching
    elements.layoutBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.layoutBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.layout = btn.dataset.layout;
            elements.comicContainer.className = `comic-container layout-${state.layout}`;
        });
    });

    // Main Actions
    elements.generateBtn.addEventListener('click', generateComic);
    // Exports
    elements.exportPngBtn.addEventListener('click', exportToPNG);
    elements.exportPdfBtn.addEventListener('click', exportToPDF);
    elements.exportZipBtn.addEventListener('click', exportToZIP);
    elements.exportAiPackageBtn?.addEventListener('click', exportToAIPackage);
    elements.generateVideoBtn?.addEventListener('click', generateEducationalReel);
    elements.downloadVideoBtn?.addEventListener('click', downloadEducationalReel);
    elements.generateAudioBtn?.addEventListener('click', generateNarrationAudio);
    elements.downloadAudioBtn?.addEventListener('click', downloadNarrationAudio);
    elements.playReelAudioBtn?.addEventListener('click', playReelWithNarration);
    elements.customAudioInput?.addEventListener('change', handleCustomAudioUpload);

}

function updateCharCount() {
    const len = elements.scriptInput.value.length;
    elements.charCount.innerText = `${len} characters`;
}

function getComicTitle() {
    const typed = elements.comicTitleInput?.value.trim();
    if (typed) return typed;
    return `${state.currentStyle || 'Kids'} Comic Adventure`;
}

function getComicCredits() {
    const typed = elements.comicCreditsInput?.value.trim();
    if (typed) return typed;
    return 'Created with ComicForge for kids';
}

function slugifyFilename(value) {
    return (value || 'comic')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'comic';
}

function getSelectedModel() {
    const modelSelector = document.getElementById('model-selector');
    const value = modelSelector?.value || 'pollinations-default';
    if (value === 'pollinations-flux') return 'flux';
    if (value === 'pollinations-turbo') return 'turbo';
    return '';
}

function buildVisualPrompt(panelText) {
    return panelText
        .replace(/caption:\s*".*?"/gi, '')
        .replace(/dialogue:\s*/gi, '')
        .replace(/dev:\s*".*?"/gi, '')
        .replace(/user:\s*".*?"/gi, '')
        .replace(/hacker:\s*".*?"/gi, '')
        .replace(/engineer:\s*".*?"/gi, '')
        .replace(/parser:\s*".*?"/gi, '')
        .replace(/system:\s*".*?"/gi, '')
        .replace(/secure parser:\s*".*?"/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function deriveCharacterPresenceHints(text) {
    const source = text || '';
    const explicitSpeakers = [...source.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*:/g)]
        .map(match => match[1].trim());
    const namedCharacters = [];

    if (/\b(ganesh|ganesha)\b/i.test(source)) namedCharacters.push('Bal Ganesh');
    if (/\bhanuman\b/i.test(source)) namedCharacters.push('Bal Hanuman');
    if (/\bshiva\b/i.test(source)) namedCharacters.push('Bal Shiva');
    if (/\bvishnu\b/i.test(source)) namedCharacters.push('Bal Vishnu');
    if (/\bsita\b/i.test(source)) namedCharacters.push('young Sita');
    if (/\brama\b/i.test(source)) namedCharacters.push('young Rama');
    if (/\blakshmana\b/i.test(source)) namedCharacters.push('young Lakshmana');
    if (/\bravana\b/i.test(source)) namedCharacters.push('Ravana');
    if (/\bindra\b/i.test(source)) namedCharacters.push('Indra');
    if (/\bthe gods\b|\bgods\b/i.test(source)) namedCharacters.push('a group of startled gods');

    const allCharacters = [...new Set([...explicitSpeakers, ...namedCharacters])];
    if (!allCharacters.length) {
        return '';
    }

    return `Show these characters clearly in the panel: ${allCharacters.join(', ')}`;
}

function deriveEmotionHints(text) {
    const lower = (text || '').toLowerCase();
    const emotions = [];

    if (/(happy|happily|joy|joyful|smile|smiling|laugh|laughter|cheerful|playful|excited|wonder)/.test(lower)) emotions.push('joyful and lively emotion');
    if (/(sad|sadly|worried|afraid|fear|anxious|cry|crying|upset)/.test(lower)) emotions.push('clear emotional vulnerability');
    if (/(angry|furious|rage|threat|menacing|mischievous|evil|sinister)/.test(lower)) emotions.push('strong dramatic emotion');
    if (/(brave|courage|heroic|protect|defend|determined|confident)/.test(lower)) emotions.push('heroic and determined emotion');
    if (/(calm|peaceful|gentle|serene|safe|secure|blessing|divine)/.test(lower)) emotions.push('gentle peaceful emotion');
    if (/(surprised|startled|shocked|amazed)/.test(lower)) emotions.push('visible surprise and reaction');
    if (/(cried|shouted|yelled|called out|stop!|warned|gasped)/.test(lower)) emotions.push('strong shouting and alarmed reaction');

    if (!emotions.length) {
        return 'Give the main characters clear readable facial expressions and emotions that match the scene';
    }

    return `Use expressive faces and body language with ${emotions.join(', ')}`;
}

function deriveBreedHints(text) {
    const lower = (text || '').toLowerCase();
    const breeds = [];

    if (/\b(toy poodle|poodle|poodles)\b/.test(lower)) {
        breeds.push('Toy Poodle: small size, elegant curly fur, distinctive poodle groom, alert expression');
    }
    if (/\b(golden retriever|retriever|retrievers)\b/.test(lower)) {
        breeds.push('Golden Retriever: large size, smooth long golden coat, floppy ears, friendly wagging tail, gentle face');
    }
    if (/\b(labrador|lab)\b/.test(lower)) {
        breeds.push('Labrador: medium-large size, short dense coat, powerful build, friendly active expression');
    }
    if (/\b(german shepherd)\b/.test(lower)) {
        breeds.push('German Shepherd: large size, alert pointed ears, black and tan coat, strong athletic build');
    }
    if (/\b(pug)\b/.test(lower)) {
        breeds.push('Pug: small size, wrinkled face, flat snout, curled tail, cute expressive eyes');
    }
    if (/\b(bulldog)\b/.test(lower)) {
        breeds.push('Bulldog: medium size, stocky build, wrinkled face, wide stance, grumpy but cute look');
    }

    return breeds.length ? `Identify breeds clearly: ${breeds.join(', ')}` : '';
}

function deriveActionHints(text) {
    const lower = (text || '').toLowerCase();
    const actions = [];

    if (/\bthe gods\b|\bgods\b/.test(lower)) actions.push('show the gods visibly reacting together in the scene');
    if (/\bindra\b/.test(lower) && /(cried|shouted|yelled|called out|warned|stop!)/.test(lower)) {
        actions.push('show Indra clearly shouting Stop with an urgent expression and raised gesture');
    }
    if (/(reach|reached|soared|flew|sky|skies)/.test(lower)) {
        actions.push('show the character clearly high in the sky above the ground, surrounded by clouds, open air, and a strong sense of height');
    }
    if (/(sun|glowing sun)/.test(lower)) actions.push('show the glowing sun clearly as an important story element');
    if (/(grab|grabbing|catch|caught)/.test(lower)) actions.push('show the action moment clearly at the center of the panel');
    if (/(grab|grabbing|catch|caught)/.test(lower) && /\bsun\b/.test(lower)) {
        actions.push('show the main character physically reaching the glowing sun and holding or touching it clearly with the hands');
        actions.push('make the sun large, bright, and close to the character so the grab action is unmistakable');
    }
    if (/(fruit|fruity|juicy fruit)/.test(lower) && /\bsun\b/.test(lower)) {
        actions.push('show that the character sees the sun like a juicy fruit and is eagerly chasing it');
    }
    if (/(laughter|courage|twinkling eyes|joyful|playful)/.test(lower)) {
        actions.push('show joyful flying energy with a bright smile, delighted expression, and playful body pose');
    }

    return actions.join(', ');
}

function toEnglishBubbleText(text) {
    if (!text || typeof text !== 'string') {
        return 'A wonderful moment.';
    }

    // Step 1: Normalize unicode and remove non-English characters
    let normalized = text
        .normalize('NFKD')
        .replace(/[^\x00-\x7F]/g, ' ')
        .replace(/[🍑🪔🐘🐵🔱🐚✨🌞🌻🌼🌟]/g, ' ');

    // Step 2: Remove metadata markers and formatting
    normalized = normalized
        .replace(/\bpanel\s*\d+\s*[:.)\-]?\s*/gi, ' ')
        .replace(/\b(caption|dialogue|prompt|scene|description|visual|script|title|visual prompt)\s*[:.)\-]?\s*/gi, ' ')
        .replace(/^\s*["'\-*]+/, '')
        .replace(/["'\-*]+\s*$/, '');

    // Step 3: Look for actual dialogue patterns (e.g., "Character: Hello there!")
    const dialoguePattern = /["']?([A-Za-z]+)\s*:\s*["']?([^"'.!?]+[.!?])["']?/i;
    const dialogueMatch = normalized.match(dialoguePattern);
    if (dialogueMatch) {
        const spoken = dialogueMatch[2].trim();
        if (spoken.length > 3 && spoken.split(/\s+/).length >= 2) {
            return spoken.charAt(0).toUpperCase() + spoken.slice(1);
        }
    }

    // Step 4: Look for quoted speech "Hello there"
    const quotePattern = /"([^"]{5,100})"/;
    const quoteMatch = normalized.match(quotePattern);
    if (quoteMatch) {
        const spoken = quoteMatch[1].trim();
        if (spoken.length > 3) {
            if (!spoken.match(/[.!?]$/)) {
                return spoken.charAt(0).toUpperCase() + spoken.slice(1) + '.';
            }
            return spoken.charAt(0).toUpperCase() + spoken.slice(1);
        }
    }

    // Step 5: Extract the first meaningful English sentence
    const sentencePattern = /[A-Z][a-z]*(?:\s+[a-z]+){2,15}[.!?]/i;
    const sentenceMatch = normalized.match(sentencePattern);

    if (sentenceMatch) {
        let sentence = sentenceMatch[0].trim();
        if (!sentence.match(/[.!?]$/)) {
            sentence += '.';
        }
        return sentence;
    }

    // Step 6: Fallback - clean up remaining text and ensure it's English letters only
    let cleaned = normalized
        .replace(/[^A-Za-z0-9 .,!?':;\-]/g, ' ')
        .replace(/([!?.,])\1+/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();

    // Step 7: Final validation and formatting
    if (!cleaned || cleaned.length < 5 || !/[a-zA-Z]/.test(cleaned)) {
        return 'A wonderful moment.';
    }

    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

    if (!cleaned.match(/[.!?]$/)) {
        cleaned = cleaned.replace(/[,;]$/, '') + '.';
    }

    return cleaned;
}

function deriveSceneRoleHints(text) {
    const hints = [];
    if (/(developer|engineer|analyst|teacher|student|user|admin|manager|attacker|hacker|robot|parser|system|server)/i.test(text)) {
        hints.push('clear character roles');
    }
    if (/(laptop|computer|monitor|server|dashboard|terminal|code|screen|network|device|phone)/i.test(text)) {
        hints.push('readable technology props');
    }
    if (/(attack|breach|threat|warning|error|alert|exploit|leak|blocked|defend|shield|secure|lock)/i.test(text)) {
        hints.push('strong cybersecurity storytelling');
    }
    return hints.join(', ');
}

function deriveCinematicScenePrompt(panelInput) {
    const panel = typeof panelInput === 'string' ? { text: panelInput } : (panelInput || {});
    const englishText = toEnglishBubbleText(panel.text || '');
    const visualCore = buildVisualPrompt(englishText) || englishText;
    const breedHints = deriveBreedHints(panel.text || englishText);
    const roleHints = deriveSceneRoleHints(englishText);
    const characterHints = deriveCharacterPresenceHints(panel.text || englishText);
    const emotionHints = deriveEmotionHints(panel.text || englishText);
    const actionHints = deriveActionHints(panel.text || englishText);
    const mythologyHints = [];

    if (/\b(ganesh|ganesha)\b/i.test(englishText)) {
        mythologyHints.push('Bal Ganesh, a cute child form with a gentle elephant face, playful expression, small divine ornaments, and a warm storybook presentation');
    }
    if (/\bhanuman\b/i.test(englishText)) {
        mythologyHints.push('Bal Hanuman, a cute child monkey hero with joyful energy, friendly expression, and a playful devotional storybook look');
    }
    if (/\bshiva\b/i.test(englishText)) {
        mythologyHints.push('Bal Shiva, a serene child form with soft divine glow, gentle expression, and respectful kid-friendly cosmic storybook styling');
    }
    if (/\bvishnu\b/i.test(englishText)) {
        mythologyHints.push('Bal Vishnu, a calm child form with royal gentle presence, soft celestial glow, and respectful storybook styling for kids');
    }
    if (/\bsita\b/i.test(englishText)) {
        mythologyHints.push('Sita as a gentle child princess in a respectful Ramayana storybook style, traditional Indian attire, graceful expression, warm devotional setting');
    }

    return [
        visualCore,
        breedHints,
        roleHints,
        characterHints,
        emotionHints,
        actionHints,
        mythologyHints.join(', '),
        CINEMATIC_PROMPT_SUFFIX
    ].filter(Boolean).join(', ');
}

function deriveAnimationDirection(panelInput) {
    const panel = typeof panelInput === 'string' ? { text: panelInput } : (panelInput || {});
    const englishText = toEnglishBubbleText(panel.text || '');
    const lower = englishText.toLowerCase();
    const motions = [];

    if (/(typing|writing|coding|upload|click|working|explaining|talking|showing|pointing)/.test(lower)) {
        motions.push('subtle hand and body motion');
    }
    if (/(code|screen|monitor|dashboard|terminal|computer|device|network|data|xml)/.test(lower)) {
        motions.push('screen glow and interface flicker');
    }
    if (/(attack|breach|warning|alert|exploit|fire|crash|damage|chaos|impact)/.test(lower)) {
        motions.push('intensifying motion with light shake');
    }
    if (/(shield|protect|secure|blocked|safe|calm|restored|stable)/.test(lower)) {
        motions.push('steady defensive energy pulse');
    }
    if (/(city|room|server|office|lab|workspace|background)/.test(lower)) {
        motions.push('ambient background movement');
    }

    if (!motions.length) {
        motions.push('subtle character movement');
        motions.push('ambient background motion');
    }

    const cameraMove = /(attack|breach|warning|impact|explosion|crash)/.test(lower)
        ? 'camera shake with dramatic push-in'
        : /(calm|secure|restored|safe|ending)/.test(lower)
            ? 'slow cinematic pan'
            : 'slow zoom-in camera move';

    return `${motions.join(', ')}, ${cameraMove}`;
}

function buildContextualImagePrompt(panelInput) {
    const panel = typeof panelInput === 'string' ? { text: panelInput } : (panelInput || {});
    const visualCore = deriveCinematicScenePrompt(panel);
    return [
        'Create one high-quality educational comic panel image in English context only.',
        `Scene context: ${visualCore}.`,
        'Make the named characters accurate to the script and keep their visual role clear in the scene.',
        'Make all characters look cute, appealing, expressive, and attractive for kids.',
        'Use soft friendly faces, playful body language, rounded shapes, bright cheerful colors, and a warm storybook feel.',
        'Use cinematic composition and visual storytelling that matches the script exactly.',
        'Show the full scene clearly so the viewer immediately understands what is happening.',
        'Keep main character faces visible and unobstructed.',
        'Place speaking space away from faces, leaving open negative space near a panel edge for the app bubble overlay.',
        'CRITICAL: ABSOLUTELY NO TEXT IN IMAGE. NO words, NO letters, NO numbers, NO subtitles, NO speech bubbles, NO symbols, NO interface text, NO signs, NO book pages, NO screens with readable content, NO captions inside the artwork.',
        'NO GIBBERISH: Avoid random squiggles that look like fake writing, avoid letter-like patterns, avoid text-like textures.',
        'PURE VISUALS ONLY: Show actions, expressions, and scenes through imagery alone without any written elements.',
        'All readable text will be added by the app overlay in English only.',
        'Clean professional image with zero writing, zero text, zero letters, zero symbols, zero watermarks.'
    ].join(' ');
}

function syncVideoPromptFromScript() {
    if (!elements.videoPromptInput) return;
    if (state.reelScriptEdited && elements.videoPromptInput.value.trim()) return;
    elements.videoPromptInput.value = 'Create a short vertical reel that covers all comic panels, with optional narration, in a fun and kid-friendly style.';

    if (elements.animationPromptInput && !elements.animationPromptInput.value.trim()) {
        elements.animationPromptInput.value = 'Animate each panel into a short MP4 scene with subtle cinematic zoom, gentle pan across threat progression, parallax on defense scenes, and background changes for impact moments.';
    }
}

function buildAutoNarrationScript() {
    const sourcePanels = state.panels.length ? state.panels : parseScript(elements.scriptInput?.value || '');
    if (!sourcePanels.length) {
        return '';
    }

    return sourcePanels.map((panel, index) => {
        const text = toEnglishBubbleText(panel.text || '')
            .replace(/^[A-Za-z0-9\s]+:\s*/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!text) {
            return '';
        }

        if (index === 0) {
            return `Once upon a time, ${text}.`;
        }
        if (index === sourcePanels.length - 1) {
            return `And in the end, ${text}.`;
        }
        return `Then, ${text}.`;
    }).filter(Boolean).join(' ');
}

function getNarrationTextForReel() {
    const typedPrompt = (elements.videoPromptInput?.value || '').trim();
    if (typedPrompt && typedPrompt !== 'Create a short vertical reel that covers all comic panels, with optional narration, in a fun and kid-friendly style.') {
        return typedPrompt;
    }
    return buildAutoNarrationScript();
}

function revokeIfObjectUrl(url) {
    if (typeof url === 'string' && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
    }
}

function buildPanelAnimationPromptTemplate(panel) {
    const scenePrompt = deriveCinematicScenePrompt(panel);
    const sceneMotion = deriveAnimationDirection(panel);
    const globalMotion = elements.animationPromptInput?.value.trim() || 'subtle cinematic zoom, gentle pan, soft parallax, smooth vertical video motion';
    return [
        `Prompt: ${scenePrompt}`,
        `Motion: ${sceneMotion}`,
        `Direction: ${globalMotion}`,
        'Style: vertical MP4 clip, stable composition, no text in image'
    ].join('\n');
}

function buildPanelVoiceScriptTemplate(panel) {
    const cleaned = toEnglishBubbleText(panel?.text || '')
        .replace(/^[A-Za-z0-9\s]+:\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned && cleaned !== 'Panel description'
        ? cleaned
        : 'Narrate this panel clearly in English.';
}

function getGeneratedPanelsForReel() {
    return state.panels
        .map(panel => ({
            id: panel.id,
            text: panel.text,
            imageUrl: document.getElementById(`img-${panel.id}`)?.src || ''
        }))
        .filter(panel => panel.imageUrl && !panel.imageUrl.startsWith('data:'));
}

async function generatePanelImage(panel, config) {
    let visualPrompt = buildContextualImagePrompt(panel);

    log(`Panel ${panel.id}: Prompt "${visualPrompt.substring(0, 80)}${visualPrompt.length > 80 ? '...' : ''}"`);

    let lastError;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            log(`Panel ${panel.id}: Requesting image (attempt ${attempt}/2)...`);
            return await imageService.generateImage(visualPrompt, { ...config, attempt });
        } catch (err) {
            lastError = err;
            log(`Panel ${panel.id}: Attempt ${attempt} failed (${err.message}).`, 'error');
        }
    }

    throw lastError || new Error('Image generation failed');
}

function getGenerationConfig() {
    const styleConfig = STYLES.find(s => s.name === state.currentStyle);
    return {
        style: styleConfig ? styleConfig.promptSuffix : '',
        model: getSelectedModel(),
        apiKey: null
    };
}

async function renderPanel(panel, config) {
    const imgEl = document.getElementById(`img-${panel.id}`);
    if (!imgEl) return false;

    setPanelDownloadReady(panel.id, false);
    setPanelRetryBusy(panel.id, true);
    imgEl.src = INLINE_LOADING_IMAGE;

    try {
        const imagePromise = generatePanelImage(panel, config);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Image generation timed out')), IMAGE_TIMEOUT_MS));
        const imageUrl = await Promise.race([imagePromise, timeoutPromise]);

        await new Promise((resolve, reject) => {
            imgEl.onload = () => {
                setPanelDownloadReady(panel.id, true);
                setPanelRetryBusy(panel.id, false);
                log(`Panel ${panel.id}: Image loaded.`, 'success');
                resolve();
            };
            imgEl.onerror = () => reject(new Error("Failed to load image resource"));
            imgEl.crossOrigin = "anonymous";
            imgEl.src = imageUrl;
        });

        return true;
    } catch (err) {
        log(`Panel ${panel.id} failed (${err.message}).`, 'error');
        imgEl.src = createErrorImageDataUrl(panel.id);
        setPanelDownloadReady(panel.id, false);
        setPanelRetryBusy(panel.id, false);
        return false;
    }
}

// ---------------------------------------------------------
// Core Logic
// ---------------------------------------------------------

function splitShortStoryIntoPanels(normalized) {
    const lines = normalized
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
    const titleLikeLine = lines[0] && lines[0].length <= 80 && !/[.!?]$/.test(lines[0]) ? lines[0] : '';
    const storyLines = titleLikeLine ? lines.slice(1) : lines;
    const storyContext = `${titleLikeLine} ${storyLines.join(' ')}`;
    const inferredHero = /\bhanuman\b/i.test(storyContext)
        ? 'Bal Hanuman'
        : /\b(ganesh|ganesha)\b/i.test(storyContext)
            ? 'Bal Ganesh'
            : /\bshiva\b/i.test(storyContext)
                ? 'Bal Shiva'
                : /\bvishnu\b/i.test(storyContext)
                    ? 'Bal Vishnu'
                    : '';
    const importantNames = ['Hanuman', 'Ganesh', 'Ganesha', 'Shiva', 'Vishnu', 'Sita', 'Rama', 'Lakshmana', 'Ravana', 'Indra'];

    const cleanChunk = chunk => chunk
        .replace(/(\*\*|__)?(Prompt|Scene|Script|Description|Teaching Point|Visual|Title)(\*\*|__)?:\s*/gi, ' ')
        .replace(/[🍑🪔🐘🐵🔱🐚✨🌞🌻🌼🌟]/g, ' ')
        .replace(/^(\*\*|__)/, '')
        .replace(/(\*\*|__)$/, '')
        .replace(/\s+/g, ' ')
        .trim();

    const enrichChunk = chunk => {
        const cleaned = cleanChunk(chunk);
        if (!cleaned) return '';

        const hasImportantName = importantNames.some(name => new RegExp(`\\b${name}\\b`, 'i').test(cleaned));
        const startsWithPronoun = /^(he|she|they|his|her|their|him)\b/i.test(cleaned);
        const referencesHeroIndirectly = /\b(he|his|him|little one|young hero|the child)\b/i.test(cleaned);

        if (inferredHero && !hasImportantName && (startsWithPronoun || referencesHeroIndirectly)) {
            return `${inferredHero} ${cleaned}`;
        }

        if (inferredHero && !hasImportantName && titleLikeLine) {
            return `${inferredHero} scene: ${cleaned}`;
        }

        return cleaned;
    };

    if (storyLines.length >= 4 && storyLines.every(line => line.length <= 140)) {
        if (storyLines.length <= 8) {
            return storyLines.map(enrichChunk).filter(Boolean);
        }

        const targetPanels = Math.min(8, Math.max(5, Math.ceil(storyLines.length / 2)));
        const pairSize = Math.ceil(storyLines.length / targetPanels);
        const chunks = [];
        for (let i = 0; i < storyLines.length; i += pairSize) {
            chunks.push(storyLines.slice(i, i + pairSize).join(' '));
        }
        return chunks.map(enrichChunk).filter(Boolean).slice(0, 8);
    }

    const sentences = normalized
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?])\s+/)
        .map(sentence => sentence.trim())
        .filter(Boolean);

    if (sentences.length >= 3) {
        const targetPanels = Math.min(8, Math.max(3, Math.ceil(sentences.length / 2)));
        const perPanel = Math.ceil(sentences.length / targetPanels);
        const chunks = [];
        for (let i = 0; i < sentences.length; i += perPanel) {
            chunks.push(sentences.slice(i, i + perPanel).join(' '));
        }
        return chunks.map(enrichChunk).filter(Boolean).slice(0, 8);
    }

    return [enrichChunk(normalized)].filter(Boolean);
}

function parseScript(text) {
    const normalized = (text || '')
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim();

    if (!normalized) return [];

    const explicitHeaderRegex = /(?:^|\n)\s*(?:🟦\s*|[-*]\s*|#+\s*)?(?:panel|scene)\s*(\d+)\s*[:.\-–)]?\s*/ig;
    const numberedLineRegex = /(?:^|\n)\s*(\d{1,2})\s*[).:\-–]\s+/ig;

    const buildPanelsFromMatches = (sourceText, matcher) => {
        const matches = [...sourceText.matchAll(matcher)];
        if (!matches.length) return [];

        return matches.map((match, index) => {
            const start = match.index + match[0].length;
            const end = index + 1 < matches.length ? matches[index + 1].index : sourceText.length;
            return sourceText.slice(start, end).trim();
        }).filter(Boolean);
    };

    let chunks = buildPanelsFromMatches(normalized, explicitHeaderRegex);

    if (chunks.length <= 1) {
        const lineNumberChunks = buildPanelsFromMatches(normalized, numberedLineRegex);
        if (lineNumberChunks.length > chunks.length) {
            chunks = lineNumberChunks;
        }
    }

    if (chunks.length <= 1) {
        chunks = normalized
            .split(/\n\s*\n+/)
            .map(chunk => chunk.trim())
            .filter(Boolean);
    }

    if (chunks.length <= 1) {
        chunks = splitShortStoryIntoPanels(normalized);
    }

    return chunks.map((chunk, index) => {
        let cleanText = chunk;
        cleanText = cleanText.replace(/(\*\*|__)?(Prompt|Scene|Script|Description|Teaching Point|Visual)(\*\*|__)?:\s*/gi, ' ');
        cleanText = cleanText.replace(/^(\*\*|__)/, '').replace(/(\*\*|__)$/, '');
        cleanText = cleanText.replace(/\s+/g, ' ').trim();

        return {
            id: index + 1,
            text: cleanText
        };
    }).filter(panel => panel.text);
}

// Debug Logger
function log(msg, type = 'info') {
    const consoleEl = document.getElementById('debug-console');
    if (!consoleEl) return;
    const div = document.createElement('div');
    div.className = `debug-log debug-${type}`;
    div.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    consoleEl.appendChild(div);
    consoleEl.scrollTop = consoleEl.scrollHeight;
    console.log(msg); // Also to browser console
}

async function generateComic() {
    const script = elements.scriptInput.value.trim();
    if (!script) {
        alert("Please write a story first!");
        return;
    }

    // 1. Parse
    state.panels = parseScript(script);
    log(`Parsed ${state.panels.length} panels.`);

    if (state.panels.length === 0) return;

    // 2. Setup UI
    elements.comicContainer.innerHTML = '';
    elements.exportPngBtn.disabled = true;
    elements.exportPdfBtn.disabled = true;
    elements.exportZipBtn.disabled = true;
    if (elements.exportAiPackageBtn) {
        elements.exportAiPackageBtn.disabled = true;
    }
    showLoading(true);

    // 3. Render Placeholders
    state.panels.forEach(panel => {
        const panelEl = createPanelElement(panel);
        elements.comicContainer.appendChild(panelEl);
    });

    // 4. Generate Images
    const config = getGenerationConfig();

    let completed = 0;
    const total = state.panels.length;

    try {
        log("Starting Sequential Generation with Pollinations...", 'info');

        // SEQUENTIAL LOOP start
        for (const panel of state.panels) {
            const imgEl = document.getElementById(`img-${panel.id}`);

            // Scroll to current panel (better UX)
            imgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            log(`Starting Panel ${panel.id} of ${total}...`);

            await renderPanel(panel, config);
            completed++;
            updateProgress(completed, total);

            if (completed < total) {
                log("Waiting 800ms before next panel...");
                await new Promise(r => setTimeout(r, 800));
            }
        }

        log(`All panels finished!`);
        elements.exportPngBtn.disabled = false;
        elements.exportPdfBtn.disabled = false;
        elements.exportZipBtn.disabled = false;
        if (elements.exportAiPackageBtn) {
            elements.exportAiPackageBtn.disabled = false;
        }

        log("Comic ready. Use Save JSON to download a local copy.", 'success');

    } catch (e) {
        log(`Global Error: ${e.message}`, 'error');
    } finally {
        setTimeout(() => showLoading(false), 500);
    }
}

// ... (existing code) ...

async function saveComicToProfile(silent = false) {
    const btn = document.getElementById('save-profile-btn');
    const originalText = btn.innerHTML;
    if (!silent) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;
    }

    if (state.panels.length === 0) {
        if (!silent) alert("Nothing to save! Generate a comic first.");
        if (!silent) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
        return;
    }

    try {
        const payload = {
            title: `Comic ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
            panels: state.panels.map(p => ({
                id: p.id,
                text: p.text,
                imageUrl: document.getElementById(`img-${p.id}`)?.src || ''
            }))
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${payload.title.replace(/[^\w\-]+/g, '_')}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        if (!silent) alert('Comic JSON downloaded.');
        log('Comic JSON downloaded locally.', 'success');
    } catch (e) {
        if (!silent) alert("Error saving comic: " + e.message);
        log(`Local save failed: ${e.message}`, 'error');
    } finally {
        if (!silent) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

// Check for Load ID
async function checkLoadParams() {
    const params = new URLSearchParams(window.location.search);
    const comicId = params.get('load');
    if (!comicId) return;

    const token = localStorage.getItem('authToken');
    if (!token) {
        log('Saved profile comic loading is disabled in guest mode.', 'info');
        return;
    }

    // Load Comic
    try {
        showLoading(true);
        const res = await fetch(`/api/comics/get?id=${comicId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) throw new Error("Could not load comic");

        const data = await res.json();
        const comicData = data.data; // Array of panels

        // Populate State
        state.panels = comicData.map(p => ({
            id: p.id,
            text: p.text
        }));

        // Populate Input (approximate reconstruction from panels)
        elements.scriptInput.value = state.panels.map(p => `Panel ${p.id}: ${p.text}`).join('\n');
        updateCharCount();

        // Render UI
        elements.comicContainer.innerHTML = '';
        state.panels.forEach(panel => {
            const panelEl = createPanelElement(panel);
            elements.comicContainer.appendChild(panelEl);

            // Set Image
            const imgEl = document.getElementById(`img-${panel.id}`);
            if (imgEl && panel.imageUrl) {
                imgEl.onload = () => setPanelDownloadReady(panel.id, true);
                imgEl.src = panel.imageUrl;
                if (imgEl.complete) {
                    setPanelDownloadReady(panel.id, true);
                }
            }
        });

        // Enable Exports
        elements.exportPngBtn.disabled = false;
        elements.exportPdfBtn.disabled = false;
        elements.exportZipBtn.disabled = false;
        if (elements.exportAiPackageBtn) {
            elements.exportAiPackageBtn.disabled = false;
        }

        log(`Loaded comic: ${data.title}`, 'success');

    } catch (e) {
        log(`Failed to load comic: ${e.message}`, 'error');
        alert("Failed to load comic.");
    } finally {
        showLoading(false);
        // Clear param so refresh doesn't reload
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// ---------------------------------------------------------
// UI Utilities
// ---------------------------------------------------------

function createPanelElement(panel) {
    const div = document.createElement('div');
    div.className = 'comic-panel';
    div.id = `panel-${panel.id}`;

    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `
        <span><i class="fa-solid fa-square"></i> Scene</span>
        <div class="panel-actions">
            <button class="panel-retry-btn" id="retry-panel-${panel.id}">
                <i class="fa-solid fa-rotate-right"></i> Retry
            </button>
            <button class="panel-download-btn" id="download-panel-${panel.id}" disabled>
                <i class="fa-solid fa-download"></i> Download
            </button>
        </div>
    `;
    div.appendChild(header);
    const downloadBtn = header.querySelector('.panel-download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => downloadPanelImage(panel.id));
    }
    const retryBtn = header.querySelector('.panel-retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => retryPanelImage(panel.id));
    }

    // Image Container
    const imgContainer = document.createElement('div');
    imgContainer.className = 'panel-image-container';
    div.appendChild(imgContainer);

    // Image
    const img = document.createElement('img');
    img.id = `img-${panel.id}`;
    img.alt = `Scene visualization`;
    img.src = INLINE_LOADING_IMAGE;
    img.className = 'panel-image';
    imgContainer.appendChild(img);

    // Text Overlay (Caption vs Speech Bubble)
    if (panel.text) {
        const bubbleText = toEnglishBubbleText(panel.text);
        const overlay = document.createElement('div');

        // Heuristic: Colon usually implies dialogue (e.g. "Bob: Hello")
        // But exclude "Panel 1:" or "Prompt:" which we cleaned, but user might type others.
        // We assume cleaned text.
        const isDialogue = /^[A-Za-z0-9\s]+:/.test(bubbleText);

        if (isDialogue) {
            overlay.className = 'speech-bubble';
            // Optional: Strip the name? No, keep it for context usually.
        } else {
            overlay.className = 'caption-box';
        }

        overlay.innerText = bubbleText;
        imgContainer.appendChild(overlay);
    }

    return div;
}

function setPanelDownloadReady(panelId, isReady) {
    const btn = document.getElementById(`download-panel-${panelId}`);
    if (!btn) return;
    btn.disabled = !isReady;
}

function setPanelRetryBusy(panelId, isBusy) {
    const btn = document.getElementById(`retry-panel-${panelId}`);
    if (!btn) return;
    btn.disabled = isBusy;
    btn.innerHTML = isBusy
        ? '<i class="fa-solid fa-spinner fa-spin"></i> Retry'
        : '<i class="fa-solid fa-rotate-right"></i> Retry';
}

async function retryPanelImage(panelId) {
    const panel = state.panels.find(item => item.id === panelId);
    if (!panel) return;
    log(`Panel ${panelId}: Retrying generation...`, 'info');
    await renderPanel(panel, getGenerationConfig());
}

async function generateEducationalReel() {
    if (!elements.videoPromptInput || !elements.videoPreview || !elements.videoStatus) return;

    const panels = getGeneratedPanelsForReel();
    if (!panels.length) {
        alert('Generate panel images first.');
        return;
    }

    const btn = elements.generateVideoBtn;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating';
    elements.downloadVideoBtn.disabled = true;
    elements.videoStatus.innerText = 'Generating reel. This can take a while...';

    try {
        if (state.reelUrl) {
            revokeIfObjectUrl(state.reelUrl);
            state.reelUrl = '';
        }

        const autoNarration = buildAutoNarrationScript();
        const reelPrompt = (elements.videoPromptInput?.value || '').trim();
        const effectivePrompt = reelPrompt && reelPrompt !== 'Create a short vertical reel that covers all comic panels, with optional narration, in a fun and kid-friendly style.'
            ? reelPrompt
            : autoNarration;

        if (!effectivePrompt) {
            throw new Error('No narration script is available for the reel');
        }

        if (elements.videoPromptInput && (!reelPrompt || reelPrompt === 'Create a short vertical reel that covers all comic panels, with optional narration, in a fun and kid-friendly style.')) {
            elements.videoPromptInput.value = effectivePrompt;
        }

        if (!state.audioUrl) {
            elements.videoStatus.innerText = 'Generating narration audio for the reel...';
            await generateNarrationAudio({ silent: true, forReel: true });
            if (!state.audioUrl) {
                throw new Error('Narration audio could not be generated for the reel');
            }
        }

        const reelUrl = await videoService.generateVideo({
            model: elements.videoModelSelector?.value || 'local-reel',
            prompt: effectivePrompt,
            animationPrompt: elements.animationPromptInput?.value.trim() || '',
            panels,
            audioUrl: state.audioUrl
        });
        state.reelUrl = reelUrl;
        elements.videoPreview.src = reelUrl;
        elements.videoPreview.load();
        elements.downloadVideoBtn.disabled = false;
        elements.playReelAudioBtn.disabled = !state.audioUrl;
        elements.videoStatus.innerText = 'Reel generated. Preview and download it below.';
        log('Educational reel generated successfully.', 'success');
    } catch (err) {
        elements.videoStatus.innerText = `Reel generation failed: ${err.message}`;
        log(`Reel generation failed: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

function downloadEducationalReel() {
    if (!state.reelUrl) {
        alert('Generate a reel first.');
        return;
    }

    const baseName = slugifyFilename(getComicTitle());
    const link = document.createElement('a');
    link.href = state.reelUrl;
    link.download = `${baseName}-reel.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function generateNarrationAudio(options = {}) {
    const narrationText = getNarrationTextForReel();
    if (!narrationText) {
        if (!options.silent) {
            alert('Add panel content first.');
        }
        return;
    }

    const btn = elements.generateAudioBtn;
    const original = btn?.innerHTML || '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating';
    }
    if (!options.forReel) {
        elements.videoStatus.innerText = 'Generating narration audio...';
    }

    try {
        if (state.audioUrl) {
            revokeIfObjectUrl(state.audioUrl);
            state.audioUrl = '';
        }

        let audioUrl = '';
        let lastError = null;
        const attempts = options.forReel ? getAudioBackendFallbacks() : [getAudioBackendConfig()];

        for (const attempt of attempts) {
            try {
                audioUrl = await audioService.generateNarration(narrationText, attempt);
                log(`Narration audio generated using ${attempt.backend}:${attempt.voice}.`, 'success');
                break;
            } catch (err) {
                lastError = err;
                log(`Narration backend failed (${attempt.backend}:${attempt.voice}): ${err.message}`, 'error');
            }
        }

        if (!audioUrl) {
            throw lastError || new Error('Narration audio generation failed');
        }

        state.audioUrl = audioUrl;
        state.audioSource = 'generated';
        elements.audioPreview.src = audioUrl;
        elements.audioPreview.load();
        elements.downloadAudioBtn.disabled = false;
        elements.playReelAudioBtn.disabled = !state.reelUrl;
        if (!options.forReel) {
            elements.videoStatus.innerText = 'Narration generated. You can preview audio or play it with the reel.';
        }
        log('Narration audio generated successfully.', 'success');
        return audioUrl;
    } catch (err) {
        if (!options.forReel) {
            elements.videoStatus.innerText = `Narration failed: ${err.message}`;
        }
        log(`Narration failed: ${err.message}`, 'error');
        if (!options.silent) {
            throw err;
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read the selected audio file.'));
        reader.readAsDataURL(file);
    });
}

async function handleCustomAudioUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    try {
        elements.videoStatus.innerText = 'Uploading custom voice audio...';
        const dataUrl = await fileToDataUrl(file);
        const response = await fetch('/api/local/audio-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: file.name,
                data_url: dataUrl
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
            throw new Error(detail || `Audio upload failed (${response.status})`);
        }

        const payload = await response.json();
        if (!payload?.url) {
            throw new Error('Upload did not return an audio URL.');
        }

        if (state.audioUrl) {
            revokeIfObjectUrl(state.audioUrl);
        }
        state.audioUrl = payload.url;
        state.audioSource = 'uploaded';
        elements.audioPreview.src = payload.url;
        elements.audioPreview.load();
        elements.downloadAudioBtn.disabled = false;
        elements.playReelAudioBtn.disabled = !state.reelUrl;
        elements.videoStatus.innerText = 'Using uploaded voice audio for the reel.';
        log('Custom narration audio uploaded successfully.', 'success');
    } catch (err) {
        elements.videoStatus.innerText = 'Custom voice upload failed.';
        log(`Custom audio upload failed: ${err.message}`, 'error');
        alert(`Custom voice upload failed: ${err.message}`);
    } finally {
        if (elements.customAudioInput) {
            elements.customAudioInput.value = '';
        }
    }
}

function downloadNarrationAudio() {
    if (!state.audioUrl) {
        alert('Generate narration first.');
        return;
    }

    const baseName = slugifyFilename(getComicTitle());
    const link = document.createElement('a');
    link.href = state.audioUrl;
    link.download = `${baseName}-narration.m4a`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function playReelWithNarration() {
    if (!state.reelUrl || !state.audioUrl) {
        alert('Generate both reel and narration first.');
        return;
    }

    try {
        elements.videoPreview.currentTime = 0;
        elements.audioPreview.currentTime = 0;
        await Promise.all([
            elements.videoPreview.play(),
            elements.audioPreview.play()
        ]);
    } catch (err) {
        log(`Sync playback failed: ${err.message}`, 'error');
    }
}

async function downloadPanelImage(panelId) {
    const imgEl = document.getElementById(`img-${panelId}`);
    if (!imgEl || !imgEl.src) {
        alert('Panel image is not ready yet.');
        return;
    }

    const btn = document.getElementById(`download-panel-${panelId}`);
    const original = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving';
    }

    try {
        const canvas = await renderPanelDownloadCanvas(panelId);
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `comic-panel-${panelId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        log(`Panel ${panelId} downloaded.`, 'success');
    } catch (err) {
        alert(`Could not download panel ${panelId}: ${err.message}`);
        log(`Panel ${panelId} download failed: ${err.message}`, 'error');
    } finally {
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-download"></i> Download';
            btn.disabled = false;
        }
    }
}

async function exportPanelToComfyUI(panelId) {
    const panel = state.panels.find(item => item.id === panelId);
    const imgEl = document.getElementById(`img-${panelId}`);
    if (!panel || !imgEl?.src || imgEl.src.startsWith('data:')) {
        alert('Generate the panel image first.');
        return;
    }

    const btn = document.getElementById(`comfy-panel-${panelId}`);
    const original = btn?.innerHTML || '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending';
    }

    try {
        const styleConfig = STYLES.find(style => style.name === state.currentStyle);
        const response = await fetch('/api/integrations/comfyui/panel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                panel: {
                    id: panel.id,
                    text: panel.text,
                    imageUrl: imgEl.src,
                    style: state.currentStyle,
                    visualPrompt: buildContextualImagePrompt(panel),
                    animationPrompt: buildPanelAnimationPromptTemplate(panel)
                },
                project: {
                    style: {
                        name: state.currentStyle,
                        promptSuffix: styleConfig?.promptSuffix || ''
                    },
                    narrationText: getNarrationTextForReel(),
                    reelPrompt: elements.videoPromptInput?.value.trim() || '',
                    animationPrompt: elements.animationPromptInput?.value.trim() || ''
                }
            })
        });

        if (!response.ok) {
            let detail = '';
            try {
                const body = await response.json();
                detail = body?.error || '';
            } catch {
                detail = await response.text();
            }
            throw new Error(detail || `ComfyUI export failed (${response.status})`);
        }

        const payload = await response.json();
        log(`Panel ${panelId} exported to ComfyUI workspace: ${payload.folder}`, 'success');
        alert(`Panel exported to ComfyUI.\n\nFolder: ${payload.folder}`);
    } catch (err) {
        console.error(err);
        alert(`Could not export panel ${panelId} to ComfyUI: ${err.message}`);
        log(`ComfyUI export failed for panel ${panelId}: ${err.message}`, 'error');
    } finally {
        if (btn) {
            btn.innerHTML = original;
            btn.disabled = false;
        }
    }
}

async function animatePanelToMp4(panelId) {
    const panel = state.panels.find(item => item.id === panelId);
    const imgEl = document.getElementById(`img-${panelId}`);
    if (!panel || !imgEl?.src || imgEl.src.startsWith('data:')) {
        alert('Generate the panel image first.');
        return;
    }

    const animationPrompt = buildPanelAnimationPromptTemplate(panel);
    const voiceScript = buildPanelVoiceScriptTemplate(panel);

    const btn = document.getElementById(`animate-panel-${panelId}`);
    const original = btn?.innerHTML || '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rendering';
    }

    try {
        const response = await fetch('/api/local/panel-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                panel: {
                    id: panel.id,
                    text: panel.text,
                    imageUrl: imgEl.src,
                    visualPrompt: buildContextualImagePrompt(panel),
                    animationPrompt,
                    voiceScript
                },
                animation_prompt: animationPrompt,
                voice_script: voiceScript,
                video_model: elements.videoModelSelector?.value || 'local-reel',
                project: {
                    style: state.selectedStyle || {},
                    narrationText: getNarrationTextForReel(),
                    reelPrompt: elements.videoPromptInput?.value.trim() || '',
                    animationPrompt: elements.animationPromptInput?.value.trim() || ''
                }
            })
        });

        if (!response.ok) {
            let detail = '';
            try {
                const body = await response.json();
                detail = body?.error || '';
            } catch {
                detail = await response.text();
            }
            throw new Error(detail || `Panel video generation failed (${response.status})`);
        }

        const payload = await response.json();
        if (!payload?.url) {
            throw new Error('No MP4 URL returned');
        }

        const link = document.createElement('a');
        link.href = payload.url;
        link.download = `comic-panel-${panelId}-${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (payload.motion_mode === 'wan-i2v') {
            log(`Panel ${panelId} rendered with WAN image-to-video and downloaded.`, 'success');
            if (payload.comfyui_folder) {
                alert(`WAN image-to-video clip downloaded.\n\nComfyUI motion folder:\n${payload.comfyui_folder}`);
            }
        } else if (payload.comfyui_folder) {
            log(`Panel ${panelId} quick MP4 downloaded. Real WAN/ComfyUI motion package exported to: ${payload.comfyui_folder}`, 'success');
            alert(`Quick preview MP4 downloaded.\n\nFor real image-to-motion rendering, the panel was also exported to ComfyUI:\n${payload.comfyui_folder}`);
        } else {
            log(`Panel ${panelId} MP4 generated and downloaded.`, 'success');
        }
    } catch (err) {
        console.error(err);
        alert(`Could not animate panel ${panelId}: ${err.message}`);
        log(`Panel ${panelId} MP4 failed: ${err.message}`, 'error');
    } finally {
        if (btn) {
            btn.innerHTML = original;
            btn.disabled = false;
        }
    }
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

async function ensureImageLoaded(imgEl) {
    if (imgEl.complete && imgEl.naturalWidth > 0) {
        return;
    }

    await new Promise((resolve, reject) => {
        const onLoad = () => {
            cleanup();
            resolve();
        };
        const onError = () => {
            cleanup();
            reject(new Error('Panel image failed to load'));
        };
        const cleanup = () => {
            imgEl.removeEventListener('load', onLoad);
            imgEl.removeEventListener('error', onError);
        };
        imgEl.addEventListener('load', onLoad);
        imgEl.addEventListener('error', onError);
    });
}

function wrapCanvasText(ctx, text, maxWidth) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';

    words.forEach(word => {
        const candidate = current ? `${current} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth || !current) {
            current = candidate;
        } else {
            lines.push(current);
            current = word;
        }
    });

    if (current) {
        lines.push(current);
    }

    return lines.slice(0, 5);
}

async function renderPanelDownloadCanvas(panelId) {
    const panel = state.panels.find(item => item.id === panelId);
    const imgEl = document.getElementById(`img-${panelId}`);
    if (!panel || !imgEl) {
        throw new Error('Rendered panel not found');
    }

    await ensureImageLoaded(imgEl);

    const text = toEnglishBubbleText(panel.text || '');
    const isDialogue = /^[A-Za-z0-9\s]+:/.test(text);
    const naturalWidth = imgEl.naturalWidth || 1024;
    const naturalHeight = imgEl.naturalHeight || 1024;
    const maxExportWidth = 1200;
    const scale = naturalWidth > maxExportWidth ? (maxExportWidth / naturalWidth) : 1;
    const sourceWidth = Math.round(naturalWidth * scale);
    const sourceHeight = Math.round(naturalHeight * scale);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const captionExtraHeight = isDialogue ? 0 : 170;

    canvas.width = sourceWidth;
    canvas.height = sourceHeight + captionExtraHeight;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgEl, 0, 0, sourceWidth, sourceHeight);

    if (isDialogue) {
        const bubbleWidth = Math.round(sourceWidth * 0.82);
        const bubbleX = Math.round((sourceWidth - bubbleWidth) / 2);
        const bubbleY = Math.round(sourceHeight * 0.72);
        const fontSize = Math.max(26, Math.round(sourceWidth * 0.04));
        const paddingX = 28;
        const paddingY = 22;
        ctx.font = `700 ${fontSize}px "Comic Neue", "Arial", sans-serif`;
        const lines = wrapCanvasText(ctx, text, bubbleWidth - (paddingX * 2));
        const lineHeight = Math.round(fontSize * 1.22);
        const bubbleHeight = Math.max(120, (lines.length * lineHeight) + (paddingY * 2));

        ctx.fillStyle = 'rgba(255,255,255,0.98)';
        drawRoundedRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, 28);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(bubbleX + 84, bubbleY + bubbleHeight);
        ctx.lineTo(bubbleX + 122, bubbleY + bubbleHeight + 34);
        ctx.lineTo(bubbleX + 156, bubbleY + bubbleHeight);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#000000';
        let textY = bubbleY + paddingY + fontSize;
        lines.forEach(line => {
            const width = ctx.measureText(line).width;
            ctx.fillText(line, bubbleX + ((bubbleWidth - width) / 2), textY);
            textY += lineHeight;
        });
    } else {
        const captionY = sourceHeight;
        const fontSize = Math.max(26, Math.round(sourceWidth * 0.036));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, captionY, sourceWidth, captionExtraHeight);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, captionY, sourceWidth, captionExtraHeight);
        ctx.font = `700 ${fontSize}px "Comic Neue", "Arial", sans-serif`;
        ctx.fillStyle = '#000000';
        const lines = wrapCanvasText(ctx, text, sourceWidth - 90);
        const lineHeight = Math.round(fontSize * 1.28);
        let textY = captionY + 46;
        lines.forEach(line => {
            const width = ctx.measureText(line).width;
            ctx.fillText(line, (sourceWidth - width) / 2, textY);
            textY += lineHeight;
        });
    }

    return canvas;
}

async function renderCombinedComicCanvas() {
    if (!state.panels.length) {
        throw new Error('No comic to export');
    }

    const panelCanvases = [];
    for (const panel of state.panels) {
        panelCanvases.push(await renderPanelDownloadCanvas(panel.id));
    }

    const columns = panelCanvases.length === 1 ? 1 : 2;
    const gap = 16;
    const outerPadding = 20;
    const headerHeight = 150;
    const footerHeight = 52;
    const panelWidth = columns === 1 ? 980 : 680;
    const scaledHeights = panelCanvases.map(canvas => Math.round((canvas.height * panelWidth) / canvas.width));
    const rowHeights = [];

    for (let i = 0; i < scaledHeights.length; i += columns) {
        rowHeights.push(Math.max(...scaledHeights.slice(i, i + columns)));
    }

    const width = outerPadding * 2 + (panelWidth * columns) + (gap * (columns - 1));
    const height = outerPadding + headerHeight + rowHeights.reduce((sum, value) => sum + value, 0) + (gap * Math.max(0, rowHeights.length - 1)) + footerHeight + outerPadding;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#fff8d6');
    bg.addColorStop(0.55, '#ffe7b8');
    bg.addColorStop(1, '#ffd8b3');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#fffdf7';
    drawRoundedRect(ctx, 18, 18, width - 36, height - 36, 30);
    ctx.fill();
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 6;
    ctx.stroke();

    const title = getComicTitle();
    const credits = getComicCredits();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#111111';
    ctx.font = '700 64px "Bangers", "Comic Neue", sans-serif';
    ctx.fillText(title, width / 2, outerPadding + 58);

    ctx.fillStyle = '#9a4318';
    ctx.font = '700 21px "Comic Neue", "Arial", sans-serif';
    ctx.fillText('A playful comic page made for kids', width / 2, outerPadding + 96);

    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(outerPadding + 20, outerPadding + 124);
    ctx.lineTo(width - outerPadding - 20, outerPadding + 124);
    ctx.stroke();

    let y = outerPadding + headerHeight;
    panelCanvases.forEach((panelCanvas, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        if (col === 0 && row > 0) {
            y += rowHeights[row - 1] + gap;
        }
        const x = outerPadding + col * (panelWidth + gap);
        const drawHeight = Math.round((panelCanvas.height * panelWidth) / panelCanvas.width);

        ctx.fillStyle = '#ffffff';
        drawRoundedRect(ctx, x - 5, y - 5, panelWidth + 10, drawHeight + 10, 20);
        ctx.fill();
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.drawImage(panelCanvas, x, y, panelWidth, drawHeight);
    });

    ctx.fillStyle = '#111111';
    ctx.font = '700 22px "Comic Neue", "Arial", sans-serif';
    ctx.fillText(credits, width / 2, height - outerPadding + 6);

    return canvas;
}

function showLoading(show) {
    if (show) {
        elements.loadingOverlay.classList.remove('hidden');
        updateProgress(0, 1);
    } else {
        elements.loadingOverlay.classList.add('hidden');
    }
}

function updateProgress(current, total) {
    const pct = Math.round((current / total) * 100);
    elements.loadingProgress.style.width = `${pct}%`;
    elements.loadingText.innerText = `Generating Artwork... ${current}/${total}`;
}

async function captureComicCanvas(target, options = {}) {
    document.body.classList.add('export-clean');
    try {
        await new Promise(r => setTimeout(r, 80));
        return await html2canvas(target, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            ...options
        });
    } finally {
        document.body.classList.remove('export-clean');
    }
}

// ---------------------------------------------------------
// Export
// ---------------------------------------------------------

async function exportToPNG() {
    const btnContent = elements.exportPngBtn.innerHTML;
    elements.exportPngBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    // Safety check
    if (!elements.comicContainer || elements.comicContainer.children.length === 0) {
        alert("No comic to export!");
        elements.exportPngBtn.innerHTML = btnContent;
        return;
    }

    try {
        log("Export to PNG started...");
        const canvas = await renderCombinedComicCanvas();

        // Trigger Download
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const link = document.createElement('a');
        link.download = `ComicForge_Art_${Date.now()}.jpeg`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        log("Export to PNG complete.", "success");

    } catch (err) {
        console.error("Export failed:", err);
        alert('Could not export image. ' + err.message);
        log("Export failed: " + err.message, "error");
    } finally {
        elements.exportPngBtn.innerHTML = btnContent;
    }
}

async function exportToPDF() {
    const btnContent = elements.exportPdfBtn.innerHTML;
    elements.exportPdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    if (state.panels.length === 0) {
        alert("No comic to export!");
        elements.exportPdfBtn.innerHTML = btnContent;
        return;
    }

    try {
        log("Export to PDF started...");
        const { jsPDF } = window.jspdf;
        const canvas = await renderCombinedComicCanvas();
        const imgData = canvas.toDataURL('image/jpeg', 0.88);
        const orientation = canvas.width >= canvas.height ? 'l' : 'p';
        const pdf = new jsPDF({
            orientation,
            unit: 'pt',
            format: [canvas.width, canvas.height],
            compress: true
        });
        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);

        // Save
        pdf.save(`${slugifyFilename(getComicTitle())}.pdf`);
        log("Export to PDF complete.", "success");

    } catch (err) {
        console.error("PDF Export failed:", err);
        alert('Could not save PDF. check console for details.');
        log("PDF Export failed: " + err.message, "error");
    } finally {
        elements.exportPdfBtn.innerHTML = btnContent;
    }
}

async function exportToZIP() {
    const btnContent = elements.exportZipBtn.innerHTML;
    elements.exportZipBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Zipping...';

    try {
        const zip = new JSZip();

        // 1. Add the full comic strip (Composite)
        // Use proxy/CORS safe canvas capture
        const canvas = await html2canvas(elements.comicContainer, {
            scale: 2,
            useCORS: true
        });

        // Convert canvas to blob (Promise-based)
        const comicBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        zip.file("full-comic.png", comicBlob);

        // 2. Add individual panels folder
        const panelsFolder = zip.folder("panels");

        // Iterate panels and fetch their source images
        // We use the same proxy pattern or direct fetch if permissible
        const promises = state.panels.map(async (panel) => {
            const imgEl = document.getElementById(`img-${panel.id}`);
            if (!imgEl) return;

            const src = imgEl.src;
            try {
                // Fetch the image data
                // Since we solved CORS with the proxy/header, standard fetch should work for the binary data
                const response = await fetch(src);
                if (!response.ok) throw new Error(`Failed to fetch ${src}`);

                const blob = await response.blob();
                // Determine extension from MIME type
                const mime = blob.type;
                let ext = 'jpg';
                if (mime === 'image/png') ext = 'png';
                else if (mime === 'image/webp') ext = 'webp';

                panelsFolder.file(`panel-${panel.id}.${ext}`, blob);
            } catch (err) {
                console.error(`Could not zip panel ${panel.id}`, err);
                // Create a text file error note instead
                panelsFolder.file(`panel-${panel.id}-error.txt`, `Could not download image: ${err.message}`);
            }
        });

        await Promise.all(promises);

        // 3. Add Story Text
        const storyText = state.panels.map(p => `Panel ${p.id}: ${p.text}`).join('\n\n');
        zip.file("story.txt", storyText);

        // 4. Generate and Download
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `comic-forge-${Date.now()}.zip`;
        link.click();

        // Cleanup
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);

    } catch (err) {
        console.error(err);
        alert('Could not generate ZIP file.');
    } finally {
        elements.exportZipBtn.innerHTML = btnContent;
    }
}

function buildIntegrationPayload() {
    const storyText = state.panels.map(panel => `Panel ${panel.id}: ${panel.text}`).join('\n\n');
    const narrationText = getNarrationTextForReel();
    const styleConfig = STYLES.find(style => style.name === state.currentStyle);

    return {
        title: `ComicForge Package ${new Date().toISOString()}`,
        style: {
            name: state.currentStyle,
            promptSuffix: styleConfig?.promptSuffix || ''
        },
        layout: state.layout,
        prompt_engine: getPromptEngineConfig(),
        image_model: getSelectedModel() || 'pollinations-default',
        reel_prompt: elements.videoPromptInput?.value.trim() || '',
        animation_prompt: elements.animationPromptInput?.value.trim() || '',
        narration_text: narrationText,
        audio_url: state.audioUrl || '',
        reel_url: state.reelUrl || '',
        story_text: storyText,
        panels: state.panels.map(panel => ({
            id: panel.id,
            text: panel.text,
            imageUrl: panel.imageUrl || '',
            style: state.currentStyle,
            visualPrompt: buildContextualImagePrompt(panel),
            animationPrompt: buildPanelAnimationPromptTemplate(panel)
        }))
    };
}

async function exportToAIPackage() {
    const button = elements.exportAiPackageBtn;
    const btnContent = button?.innerHTML || '';

    if (!state.panels.length) {
        alert('Generate at least one panel before exporting the AI package.');
        return;
    }

    if (button) {
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Packaging...';
        button.disabled = true;
    }

    try {
        const response = await fetch('/api/integrations/package', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildIntegrationPayload())
        });

        if (!response.ok) {
            let detail = '';
            try {
                const body = await response.json();
                detail = body?.error || '';
            } catch {
                detail = await response.text();
            }
            throw new Error(detail || `Package export failed (${response.status})`);
        }

        const payload = await response.json();
        if (!payload?.url) {
            throw new Error('Package export returned no file URL');
        }

        const link = document.createElement('a');
        link.href = payload.url;
        link.download = payload.filename || `comicforge-ai-package-${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        log('AI package ready for ComfyUI, ControlNet, and Deforum.', 'success');
    } catch (err) {
        console.error(err);
        alert(`Could not export AI package. ${err.message}`);
        log(`AI package export failed: ${err.message}`, 'error');
    } finally {
        if (button) {
            button.innerHTML = btnContent;
            button.disabled = false;
        }
    }
}

// Start
init();
