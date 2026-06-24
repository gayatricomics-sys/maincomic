# ComicForge

ComicForge is a combined comic creation app with:

- a browser workspace for writing panel scripts, choosing art styles, generating panels, and exporting comics
- a Python backend for auth, saved comics, proxying AI requests, local narration, reels, and export packages
- optional Ollama prompting for local scene descriptions

## Run locally

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm install
npm start
```

Then open:

```text
http://localhost:8081
```

## Notes

- Panel images use Pollinations through the backend proxy, so internet access is required for AI image generation.
- Prompt generation can use local Ollama when it is running, or Pollinations Text as a fallback.
- PDF/ZIP exports use browser libraries loaded from CDN in `index.html`. The same packages are also listed in `package.json` for local installation.
- Local reels, ControlNet guides, and ComfyUI export packages require Pillow from `requirements.txt`.
- Local narration uses macOS `say` and `/opt/homebrew/bin/ffmpeg`.
