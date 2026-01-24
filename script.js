import { ImageService } from './image-service.js';
import { LLMService } from './llm-service.js';

const imageService = new ImageService();
const llmService = new LLMService();

// State
const state = {
    currentStyle: 'Kids Cartoon',
    layout: 'grid',
    panels: []
};

// Elements are defined at top of file
// Ensure state is available


document.addEventListener('DOMContentLoaded', () => {
    // Auth Check
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Setup Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userEmail');
            window.location.href = 'login.html';
        };
    }

    // Show User
    const userDisplay = document.getElementById('user-display');
    if (userDisplay && localStorage.getItem('userEmail')) {
        userDisplay.innerText = localStorage.getItem('userEmail');
    }

    setupModelSelector();
    renderStyleOptions();
});

// Styles Configuration
const STYLES = [
    { name: 'Claymation', icon: '🧱', promptSuffix: 'claymation style, plasticine, aardman style, stop motion, cute, tactile texture' },
    { name: 'Origami', icon: '🦢', promptSuffix: 'origami style, paper folded art, papercraft, craft texture, 3d paper' },
    { name: 'Lego Style', icon: '🧩', promptSuffix: 'lego minifigures style, brick building, toy plastic texture, vibrant' },
    { name: 'Playdough', icon: '🌈', promptSuffix: 'playdough art, soft shapes, colorful, handmade texture, kid friendly' },
    { name: 'Plushie', icon: '🧸', promptSuffix: 'cute plushie toy style, felt texture, soft stitching, stuffed animal look' },
    { name: 'Sticker Art', icon: '🏷️', promptSuffix: 'sticker art style, white border, vector, pop art, vibrant, cute' },

    // --- Artistic & Hand-Drawn ---
    { name: 'Crayon', icon: '🖍️', promptSuffix: 'child crayon drawing, wax texture, colorful, scribbly, naive art' },
    { name: 'Watercolor', icon: '🖌️', promptSuffix: 'soft watercolor painting, pastel colors, artistic, dreamy, storybook' },
    { name: 'Colored Pencil', icon: '✏️', promptSuffix: 'colored pencil sketch, hatching, hand drawn, textured paper, soft' },
    { name: 'Chalkboard', icon: '🏫', promptSuffix: 'chalk art on blackboard, white outlines, dusty texture, school style' },
    { name: 'Doodle', icon: '📝', promptSuffix: 'notebook doodle, blue ink, lined paper background, sketch looking' },

    // --- Digital & Anime ---
    { name: 'Pixar 3D', icon: '🎈', promptSuffix: 'pixar animation style, 3d render, cinema lighting, cute, high detail, disney' },
    { name: 'Anime', icon: '👘', promptSuffix: 'anime style, studio ghibli inspired, vibrant, detailed background' },
    { name: 'Chibi', icon: '👶', promptSuffix: 'chibi anime style, big head small body, cute, kawaii, emoji style' },
    { name: 'Pixel Art', icon: '👾', promptSuffix: 'pixel art, 16-bit, retro game sprite, blocky, vibrant' },
    { name: 'Low Poly', icon: '🔷', promptSuffix: 'low poly 3d art, flat shading, geometric, video game style, minimal' },

    // --- Themes ---
    { name: 'Block World', icon: '🟩', promptSuffix: 'minecraft style, voxel art, blocky world, square shapes, video game' },
    { name: 'Superhero', icon: '🦸', promptSuffix: 'classic superhero comic, bold ink lines, ben-day dots, action pose, dynamic' },
    { name: 'Space', icon: '🚀', promptSuffix: 'space theme, starry background, futuristic, sci-fi, glowing, vibrant' },
    { name: 'Fairytale', icon: '🧚', promptSuffix: 'fairytale book illustration, magical, glowing, fantasy, enchanted forest' },
    { name: 'Cyberpunk', icon: '🤖', promptSuffix: 'kid friendly cyberpunk, neon lights, futuristic city, robot friends, glowing' },
    { name: 'Steampunk', icon: '⚙️', promptSuffix: 'steampunk style, brass and gears, victorian fantasy, adventure, warm colors' },

    // --- Classic ---
    { name: '90s Cartoon', icon: '📺', promptSuffix: '90s saturday morning cartoon, thick outlines, flat color, dexter laboratory style' },
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
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),
    loadingProgress: document.getElementById('loading-progress'),
    showSamplesBtn: document.getElementById('show-samples-btn')
};

// Samples
const SAMPLE_STORY = `Panel 1: A brave little cat puts on a red superhero cape in the bedroom.
Panel 2: The cat looks in the mirror and poses heroically.
Panel 3: The cat jumps out the window to save the city!
Panel 4: The cat lands softly on a grassy lawn, chasing a butterfly.`;

// Initialization
function init() {
    renderStyleSelector();
    setupEventListeners();
    updateCharCount();

    // Add Random Style Button dynamically
    addRandomStyleButton();
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
    elements.showSamplesBtn.addEventListener('click', () => {
        elements.scriptInput.value = SAMPLE_STORY;
        updateCharCount();
    });

    // Exports
    elements.exportPngBtn.addEventListener('click', exportToPNG);
    elements.exportPdfBtn.addEventListener('click', exportToPDF);
    elements.exportZipBtn.addEventListener('click', exportToZIP);

    // Model Selection logic
    const modelSelector = document.getElementById('model-selector');
    const apiKeyContainer = document.getElementById('api-key-container');

    if (modelSelector) {
        modelSelector.addEventListener('change', () => {
            const val = modelSelector.value;
            if (val.startsWith('hf-')) {
                apiKeyContainer.classList.remove('hidden');
            } else {
                apiKeyContainer.classList.add('hidden');
            }
        });
    }
}

function updateCharCount() {
    const len = elements.scriptInput.value.length;
    elements.charCount.innerText = `${len} characters`;
}

// ---------------------------------------------------------
// Core Logic
// ---------------------------------------------------------

function parseScript(text) {
    // 1. Split by newlines
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const panels = [];

    // 2. Regex to identify "Panel X:" or just generic paragraphs
    const panelRegex = /^(?:Panel\s+(\d+)[:\.]?|(\d+)[:\.]?)\s*(.*)/i;

    let currentPanel = 1;

    lines.forEach(line => {
        const match = line.match(panelRegex);
        if (match) {
            // Explicit panel definition
            // match[1] or match[2] is the number (optional), match[3] is text
            const textContent = match[3] || line; // Fallback if regex is weird
            panels.push({
                id: currentPanel++,
                text: textContent.trim()
            });
        } else {
            // Implicit panel (just a line of text)
            // If the line is short, treat as new panel. 
            // If it follows a panel immediately, maybe append? 
            // For simplicity: Every non-empty line is a panel if not explicit.
            panels.push({
                id: currentPanel++,
                text: line.trim()
            });
        }
    });

    return panels;
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

    // Credit Check / Deduction
    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/user/deduct', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();

        if (!res.ok) {
            if (res.status === 403) {
                if (confirm("Insufficient Credits! You need more credits to generate a comic. Buy now?")) {
                    window.location.href = 'pricing.html';
                }
                return;
            }
            throw new Error(data.error || "Payment verification failed");
        }

        // Update Credit Display
        const creditDisplay = document.getElementById('credit-display');
        if (creditDisplay && data.remaining !== 'Unlimited') {
            creditDisplay.innerText = `${data.remaining} Credits`;
        }

    } catch (e) {
        alert("Authorization Error: " + e.message);
        return;
    }

    // 2. Setup UI
    elements.comicContainer.innerHTML = '';
    elements.exportPngBtn.disabled = true;
    elements.exportPdfBtn.disabled = true;
    elements.exportZipBtn.disabled = true;
    showLoading(true);

    // 3. Render Placeholders
    state.panels.forEach(panel => {
        const panelEl = createPanelElement(panel);
        elements.comicContainer.appendChild(panelEl);
    });

    // 4. Generate Images
    const styleConfig = STYLES.find(s => s.name === state.currentStyle);
    const stylePrompt = styleConfig ? styleConfig.promptSuffix : '';
    // Free mode config
    const config = {
        style: stylePrompt,
        model: 'pollinations-flux',
        apiKey: null
    };

    let completed = 0;
    const total = state.panels.length;

    try {
        log("Starting Sequential Generation (Optimized for Free APIs)...");

        // SEQUENTIAL LOOP start
        for (const panel of state.panels) {
            const imgEl = document.getElementById(`img-${panel.id}`);

            // Scroll to current panel (better UX)
            imgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            log(`Starting Panel ${panel.id} of ${total}...`);

            try {
                // 4a. Visualization
                let visualPrompt = panel.text;
                try {
                    log(`Panel ${panel.id}: Visualizing scene...`);
                    visualPrompt = await llmService.visualize(panel.text);

                } catch (vizErr) {
                    console.warn(vizErr);
                    log(`Panel ${panel.id}: LLM Error. Using raw text.`);
                }

                // 4b. Image Generation
                log(`Panel ${panel.id}: Requesting image...`);
                const imageUrl = await imageService.generateImage(visualPrompt, config);

                // 4c. Load Image
                await new Promise((resolve, reject) => {
                    imgEl.onload = () => {
                        log(`Panel ${panel.id}: Image loaded.`, 'success');
                        resolve();
                    };
                    imgEl.onerror = () => {
                        reject(new Error("Failed to load image resource"));
                    };
                    imgEl.crossOrigin = "anonymous";
                    imgEl.src = imageUrl;
                });

            } catch (err) {
                log(`Panel ${panel.id} failed (${err.message}). Generating fallback...`, 'error');
                try {
                    const fallbackUrl = await imageService.fallback.generate(panel.text);
                    imgEl.src = fallbackUrl;
                } catch (fbErr) {
                    imgEl.src = `https://placehold.co/512x512?text=Error+${panel.id}`;
                }
            }

            // Progress Step
            completed++;
            updateProgress(completed, total);

            // 4d. Rate Limiting Delay (Critical for free usage)
            if (completed < total) {
                log("Waiting 1.5s for rate limits...");
                await new Promise(r => setTimeout(r, 1500));
            }
        }
        // SEQUENTIAL LOOP end

        log(`All panels finished!`);
        elements.exportPngBtn.disabled = false;
        elements.exportPdfBtn.disabled = false;
        elements.exportZipBtn.disabled = false;

    } catch (e) {
        log(`Global Error: ${e.message}`, 'error');
    } finally {
        setTimeout(() => showLoading(false), 500);
    }
}

// ---------------------------------------------------------
// UI Enhancements: Controls and Bubbles
// ---------------------------------------------------------

function createPanelElement(panel) {
    const div = document.createElement('div');
    div.className = 'comic-panel';
    div.dataset.id = panel.id;

    // Panel Number
    const numDiv = document.createElement('div');
    numDiv.className = 'panel-number';
    numDiv.innerText = `#${panel.id}`;
    div.appendChild(numDiv);

    // Controls Overlay
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'panel-controls';

    // Regenerate Button
    const regenBtn = document.createElement('button');
    regenBtn.className = 'control-btn';
    regenBtn.title = "Regenerate Image";
    regenBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
    regenBtn.onclick = (e) => {
        e.stopPropagation(); // Prevent bubbles from stealing click
        regeneratePanel(panel.id);
    };
    controlsDiv.appendChild(regenBtn);

    // Edit Button
    const editBtn = document.createElement('button');
    editBtn.className = 'control-btn';
    editBtn.title = "Edit Prompt";
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
    editBtn.onclick = (e) => {
        e.stopPropagation();
        editPanelPrompt(panel.id);
    };
    controlsDiv.appendChild(editBtn);

    div.appendChild(controlsDiv);

    // Image Container
    const imgContainer = document.createElement('div');
    imgContainer.className = 'panel-image-container';
    div.appendChild(imgContainer);

    const img = document.createElement('img');
    img.id = `img-${panel.id}`;
    img.className = 'panel-image';
    img.src = "https://placehold.co/512x512?text=Generating...";
    img.alt = "Loading...";
    img.referrerPolicy = "no-referrer";
    imgContainer.appendChild(img);

    // Speech Bubble (Instead of bottom text)
    if (panel.text && panel.text.trim().length > 0) {
        const bubble = document.createElement('div');
        bubble.className = 'speech-bubble';
        bubble.contentEditable = true; // Allow editing text directly
        bubble.innerText = panel.text;

        // Smart Default Positioning: Avoid Center (Faces)
        const positions = [
            { top: '10px', left: '10px' },
            { top: '10px', right: '10px', left: 'auto' },
            { bottom: '20px', left: '20px', top: 'auto' },
            { bottom: '20px', right: '20px', top: 'auto', left: 'auto' }
        ];
        // Pick based on panel ID to be deterministic but varied
        const pos = positions[panel.id % positions.length];
        Object.assign(bubble.style, pos);

        // Simple Draggable Logic
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        bubble.addEventListener("mousedown", dragStart);

        function dragStart(e) {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            if (e.target === bubble) {
                isDragging = true;
                // Add event listeners specific to this drag session
                document.addEventListener("mousemove", drag);
                document.addEventListener("mouseup", dragEnd);
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;
                setTranslate(currentX, currentY, bubble);
            }
        }

        function setTranslate(xPos, yPos, el) {
            el.style.transform = "translate3d(" + xPos + "px, " + yPos + "px, 0)";
        }

        function dragEnd(e) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            document.removeEventListener("mousemove", drag);
            document.removeEventListener("mouseup", dragEnd);
        }

        imgContainer.appendChild(bubble);
    }

    // Add hidden text container for fallbacks/PDFs if needed later
    const textDiv = document.createElement('div');
    textDiv.className = 'panel-text hidden';
    textDiv.innerText = panel.text;
    div.appendChild(textDiv);

    return div;
}

// ---------------------------------------------------------
// Logic for Regeneration & Editing
// ---------------------------------------------------------

async function regeneratePanel(id) {
    const panelIndex = state.panels.findIndex(p => p.id === id);
    if (panelIndex === -1) return;

    const panel = state.panels[panelIndex];
    const imgEl = document.getElementById(`img-${id}`);

    if (!confirm(`Regenerate Panel ${id}?`)) return;

    // Show loading state for button
    const btn = document.querySelector(`.comic-panel[data-id="${id}"] .control-btn`);
    if (btn) btn.classList.add('loading');

    imgEl.style.opacity = 0.5;

    // Config
    const styleConfig = STYLES.find(s => s.name === state.currentStyle);
    const stylePrompt = styleConfig ? styleConfig.promptSuffix : '';
    // Free mode always active

    const config = {
        style: stylePrompt,
        model: 'pollinations-flux', // Default free
        apiKey: null
    };

    try {
        log(`Regenerating Panel ${id}...`);

        // Re-visualize logic if needed? 
        // For regeneration, maybe keep the visualization similar but new seed?
        // Or re-run LLM? Let's re-run LLM to get a variation.
        let visualPrompt = panel.text;
        try {
            visualPrompt = await llmService.visualize(panel.text);
        } catch (e) {
            console.warn("Regen visualization failed, using raw text");
        }

        const imageUrl = await imageService.generateImage(visualPrompt, config);

        // Load
        await new Promise((resolve, reject) => {
            imgEl.onload = resolve;
            imgEl.onerror = reject;
            // Force refresh by adding timestamp if URL is same (rare for unique seed)
            imgEl.src = imageUrl;
        });

        log(`Panel ${id} regenerated.`, 'success');

    } catch (err) {
        log(`Regeneration failed: ${err.message}`, 'error');
        alert("Failed to regenerate image.");
    } finally {
        imgEl.style.opacity = 1;
        if (btn) btn.classList.remove('loading');
    }
}

function editPanelPrompt(id) {
    const panel = state.panels.find(p => p.id === id);
    if (!panel) return;

    const newText = prompt("Edit script for this panel:", panel.text);
    if (newText !== null && newText.trim() !== "") {
        panel.text = newText;
        // Update bubble text
        const panelEl = document.querySelector(`.comic-panel[data-id="${id}"]`);
        const bubble = panelEl.querySelector('.speech-bubble');
        if (bubble) bubble.innerText = newText;

        // Note: Does not auto-regenerate image. User can click regenerate if they want.
        log(`Panel ${id} text updated. Click regenerate to update image.`);
    }
}


// ---------------------------------------------------------
// UI Utilities
// ---------------------------------------------------------

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

// ---------------------------------------------------------
// Export
// ---------------------------------------------------------

async function exportToPNG() {
    const btnContent = elements.exportPngBtn.innerHTML;
    elements.exportPngBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    try {
        // Wait for images to be fully ready
        await new Promise(r => setTimeout(r, 500));

        // Use html2canvas
        // Use html2canvas
        const canvas = await html2canvas(elements.comicContainer, {
            scale: 2, // Retina quality
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        // Trigger Download
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `ComicForge_Art_${Date.now()}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (err) {
        console.error("Export failed:", err);
        alert('Could not export image. ' + err.message);
    } finally {
        elements.exportPngBtn.innerHTML = btnContent;
    }
}

async function exportToPDF() {
    const btnContent = elements.exportPdfBtn.innerHTML;
    elements.exportPdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();

        const canvas = await html2canvas(elements.comicContainer, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pageWidth) / imgProps.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pdfHeight);
        pdf.save(`ComicForge_Story_${Date.now()}.pdf`);

    } catch (err) {
        console.error("PDF Export failed:", err);
        alert('Could not save PDF.');
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

// Start
init();
