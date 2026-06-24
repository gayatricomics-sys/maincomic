# ComicForge 🎨🖍️

ComicForge is a powerful, full-featured comic creation application designed for storytellers, artists, and creators. It brings together an intuitive web workspace with an advanced Python backend, leveraging AI for image generation, scene descriptions, local narration, and multimedia exports.

---

## 🌟 Key Features

### 🖥️ Browser Workspace
- **Dynamic Panel Scripting**: Write and structure your comic scripts panel by panel.
- **AI Art Styles & Prompting**: Choose from rich art styles and use AI assistance to generate stunning panel illustrations.
- **Modular Frontend Services**: Dedicated service handlers for images (`image-service.js`), audio (`audio-service.js`), video reels (`video-service.js`), and LLM prompting (`llm-service.js`).
- **Export Capabilities**: Seamlessly export your completed comics as PDF documents or ZIP packages.
- **User Management**: Integrated pages for login, signup, password resets, user profiles, and admin views.

### ⚙️ Python Backend (`server.py`)
- **API Proxy & Storage**: Manages secure communication with external AI providers and persists comics in a local SQLite database (`comic.db`).
- **Local Narration & Reels**: Converts comic panels into video reels with automated audio narration.
- **Ollama Integration**: Optionally connects to a local Ollama instance for fast, private scene description prompting.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js & npm
- FFmpeg (for local video/audio processing)

### Installation & Execution

1. **Set up the Python virtual environment and install dependencies:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Install frontend packages and start the backend server:**
   ```bash
   npm install
   npm start
   ```

3. **Access the application:**
   Open your browser and navigate to:
   ```text
   http://localhost:8081
   ```

---

## 📁 Project Structure

```text
├── index.html               # Main workspace application
├── style.css                # Primary application stylesheet
├── script.js                # Core frontend logic and UI handling
├── server.py                # Python backend server and API handlers
├── comic.db                 # SQLite database for comics and user authentication
├── requirements.txt         # Python package dependencies
├── package.json             # Node package scripts and client dependencies
├── *-service.js             # Modular services (image, audio, video, llm)
├── login/signup/profile     # Authentication and account management views
└── functions/               # Serverless proxy functions
```

---

## 📝 Technical Notes & Fallbacks

- **AI Image Generation**: Panel images utilize Pollinations via the backend proxy. An active internet connection is required.
- **Prompt Generation**: Connects to a local Ollama instance if active; automatically falls back to Pollinations Text if Ollama is unavailable.
- **Exporting**: PDF and ZIP exports utilize browser libraries loaded via CDN in `index.html` (also defined in `package.json` for local builds).
- **Advanced Multimedia**: Local reels, ControlNet guides, and ComfyUI export packages require `Pillow` (included in `requirements.txt`).
- **Audio Narration**: Uses macOS `say` and `/opt/homebrew/bin/ffmpeg` for generating text-to-speech panel narration.

---

## 📄 License
This project is open-source and available for custom development and distribution.
