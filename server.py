import http.server
import socketserver
import urllib.request
import urllib.parse
from urllib.error import URLError, HTTPError
import os
import sys
import json
import base64
import sqlite3
import hashlib
import hmac
import secrets
import time
import re
import subprocess
import tempfile
import uuid
import shutil
import io
import math
import random
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageOps

LOCAL_VENV_SITE = os.path.expanduser('~/Openclaw/output/monetization_venv/lib/python3.14/site-packages')
if os.path.isdir(LOCAL_VENV_SITE) and LOCAL_VENV_SITE not in sys.path:
    sys.path.insert(0, LOCAL_VENV_SITE)

try:
    import torch
    from diffusers import AutoPipelineForText2Image
except Exception:
    torch = None
    AutoPipelineForText2Image = None

# Load .env file manually to avoid dependencies
env_path = os.path.join(os.getcwd(), 'config.env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            if '=' in line:
                key, value = line.strip().split('=', 1)
                os.environ[key] = value

PORT = 8081
DB_FILE = 'comic.db'

class ReusableTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

LOCAL_IMAGE_PIPELINE = None
LOCAL_IMAGE_DEVICE = None
LOCAL_IMAGE_MODEL = os.environ.get('LOCAL_IMAGE_MODEL', 'segmind/tiny-sd')
COMFYUI_API_BASE_URL_CACHE = None

# ---------------------------------------------------------
# Database Setup
# ---------------------------------------------------------
def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
                 email TEXT PRIMARY KEY,
                 password_hash TEXT,
                 salt TEXT,
                 role TEXT DEFAULT 'user',
                 credits INTEGER DEFAULT 0,
                 created_at REAL
                 )''')
    # Tokens Table (Sessions & Reset)
    c.execute('''CREATE TABLE IF NOT EXISTS tokens (
                 token TEXT PRIMARY KEY,
                 email TEXT,
                 type TEXT, -- 'session' or 'reset'
                 expires_at REAL
                 )''')
    
    # Comics Table
    c.execute('''CREATE TABLE IF NOT EXISTS comics (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 email TEXT,
                 title TEXT,
                 data TEXT,
                 created_at REAL
                 )''')

    # Migration: Add columns if missing
    try: c.execute("ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 0")
    except: pass
    try: c.execute("ALTER TABLE users ADD COLUMN salt TEXT")
    except: pass

    conn.commit()
    conn.close()

init_db()

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def generate_salt():
    return secrets.token_hex(16)

def hash_password(password, salt):
    # PBKDF2-HMAC-SHA256 (NIST recommended)
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()

def validate_email(email):
    # Basic RFC 5322 regex
    return re.match(r"[^@]+@[^@]+\.[^@]+", email)

def generate_token():
    return secrets.token_hex(16)

# Rate Limiting: IP -> [timstamps]
rate_limits = {}

import smtplib
from email.mime.text import MIMEText

def check_rate_limit(ip, limit=20, window=60): # Relaxed limit for testing
    now = time.time()
    if ip not in rate_limits:
        rate_limits[ip] = []
    
    rate_limits[ip] = [t for t in rate_limits[ip] if t > now - window]
    if len(rate_limits[ip]) >= limit:
        return False
    rate_limits[ip].append(now)
    return True

def send_email_token(to_email, token):
    email_user = os.environ.get('EMAIL_USER')
    email_pass = os.environ.get('EMAIL_PASS')
    
    # Standard Reset Link
    reset_link = f"http://localhost:{PORT}/reset.html?token={token}"
    
    if email_user and email_pass:
        try:
            msg = MIMEText(f"Click here to reset your password: {reset_link}\n\nToken: {token}\n\nValid for 5 minutes.")
            msg['Subject'] = "ComicForge Password Reset"
            msg['From'] = email_user
            msg['To'] = to_email
            
            # Gmail uses port 465 for SSL or 587 for TLS
            # Trying standard TLS on 587
            with smtplib.SMTP('smtp.gmail.com', 587) as server:
                server.starttls()
                server.login(email_user, email_pass)
                server.sendmail(email_user, to_email, msg.as_string())
            print(f"[EMAIL SENT] To: {to_email}")
            return True
        except Exception as e:
            print(f"[EMAIL ERROR] Failed to send: {e}")
            # Fallback to console
    
    # Fallback / Simulation
    print(f"\n[EMAIL SIMULATION] To: {to_email}")
    print(f"[EMAIL SIMULATION] Reset Token: {token}")
    print(f"[EMAIL SIMULATION] Link: {reset_link}\n")
    return False

def ensure_exports_dir():
    path = os.path.join(os.getcwd(), 'exports')
    os.makedirs(path, exist_ok=True)
    return path

def get_local_image_pipeline():
    global LOCAL_IMAGE_PIPELINE, LOCAL_IMAGE_DEVICE
    if LOCAL_IMAGE_PIPELINE is not None:
        return LOCAL_IMAGE_PIPELINE
    if AutoPipelineForText2Image is None or torch is None:
        raise RuntimeError('Local image stack is not installed')

    device = 'mps' if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available() else 'cpu'
    dtype = torch.float16 if device == 'mps' else torch.float32
    pipe = AutoPipelineForText2Image.from_pretrained(
        LOCAL_IMAGE_MODEL,
        torch_dtype=dtype
    )
    pipe.set_progress_bar_config(disable=True)
    pipe = pipe.to(device)
    LOCAL_IMAGE_PIPELINE = pipe
    LOCAL_IMAGE_DEVICE = device
    return LOCAL_IMAGE_PIPELINE

def local_generate_image(prompt):
    pipe = get_local_image_pipeline()
    image = pipe(
        prompt,
        num_inference_steps=2,
        guidance_scale=7.0,
        width=512,
        height=512
    ).images[0]
    exports_dir = ensure_exports_dir()
    filename = f"local_panel_{uuid.uuid4().hex}.png"
    out_path = os.path.join(exports_dir, filename)
    image.save(out_path)
    return f"/exports/{filename}"

def _prepare_story_narration_text(text):
    cleaned = (text or '').strip()
    if not cleaned:
        return ''

    cleaned = re.sub(r'\s+', ' ', cleaned)
    cleaned = cleaned.replace('...', '. ')
    cleaned = re.sub(r'([.!?])(?=[A-Za-z])', r'\1 ', cleaned)
    cleaned = re.sub(r',\s*', ', ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # Add gentle pauses so system narration sounds more like story reading.
    cleaned = cleaned.replace('. ', '. ... ')
    cleaned = cleaned.replace('! ', '! ... ')
    cleaned = cleaned.replace('? ', '? ... ')
    return cleaned


def local_generate_audio(text, voice='Aman'):
    exports_dir = ensure_exports_dir()
    stem = f"local_audio_{uuid.uuid4().hex}"
    aiff_path = os.path.join(exports_dir, f"{stem}.aiff")
    m4a_path = os.path.join(exports_dir, f"{stem}.m4a")
    prepared_text = _prepare_story_narration_text(text)
    speech_rate = '165' if voice == 'Aman' else '175'
    subprocess.run(['say', '-v', voice, '-r', speech_rate, '-o', aiff_path, prepared_text], check=True)
    subprocess.run([
        '/opt/homebrew/bin/ffmpeg', '-y', '-i', aiff_path, '-c:a', 'aac', '-b:a', '192k', m4a_path
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(aiff_path):
        os.remove(aiff_path)
    return f"/exports/{os.path.basename(m4a_path)}"

def local_generate_audio_piper(text, voice='en_US-lessac-medium'):
    exports_dir = ensure_exports_dir()
    stem = f"local_audio_{uuid.uuid4().hex}"
    wav_path = os.path.join(exports_dir, f"{stem}.wav")
    m4a_path = os.path.join(exports_dir, f"{stem}.m4a")
    model_path = os.path.join(os.getcwd(), 'models', 'piper', f'{voice}.onnx')

    if not os.path.exists(model_path):
        raise RuntimeError(f'Piper voice model not found: {voice}')

    process = subprocess.run(
        [os.path.join(os.getcwd(), '.venv-piper', 'bin', 'piper'), '--model', model_path, '--output_file', wav_path],
        input=text.encode('utf-8'),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False
    )
    if process.returncode != 0:
        detail = (process.stderr.decode('utf-8', errors='ignore') or process.stdout.decode('utf-8', errors='ignore')).strip()
        raise RuntimeError(detail or 'Piper narration generation failed')

    subprocess.run([
        '/opt/homebrew/bin/ffmpeg', '-y', '-i', wav_path, '-c:a', 'aac', '-b:a', '192k', m4a_path
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(wav_path):
        os.remove(wav_path)
    return f"/exports/{os.path.basename(m4a_path)}"

def _load_font(size):
    font_paths = [
        '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/System/Library/Fonts/Supplemental/Helvetica.ttc'
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()

def _sanitize_bubble_text(text):
    clean = ''.join(ch if 32 <= ord(ch) < 127 else ' ' for ch in (text or ''))
    clean = re.sub(r'\bpanel\s*\d+\s*:', ' ', clean, flags=re.I)
    clean = re.sub(r'\bcaption\s*:', ' ', clean, flags=re.I)
    clean = re.sub(r'\b(dialogue|prompt|scene)\s*:', ' ', clean, flags=re.I)
    clean = re.sub(r'([!?.,])\1+', r'\1', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean or 'Panel description'

def _derive_animation_prompt(panel, global_prompt=''):
    text = _sanitize_bubble_text(panel.get('text', ''))
    lower = text.lower()
    if any(word in lower for word in ['hacker', 'attack', 'threat', 'breach', 'exploit']):
        motion = 'fast dramatic motion with lateral movement and tension'
    elif any(word in lower for word in ['impact', 'data', 'network', 'server', 'alert']):
        motion = 'dynamic infographic motion with background transitions'
    elif any(word in lower for word in ['engineer', 'secure', 'block', 'protect', 'mitigation']):
        motion = 'heroic camera push with stable layered depth'
    else:
        motion = 'gentle cinematic zoom with clear scene emphasis'
    prompt_hint = _sanitize_bubble_text(global_prompt)
    if prompt_hint and prompt_hint != 'Panel description':
        return f'{text}; animate as {motion}; guidance: {prompt_hint}'
    return f'{text}; animate as {motion}'

def _choose_motion_preset(panel, index, global_prompt=''):
    global_lower = _sanitize_bubble_text(global_prompt).lower()
    if 'background' in global_lower:
        return 'background_change'
    if 'parallax' in global_lower:
        return 'parallax'
    if 'pan' in global_lower:
        return 'pan'
    if 'zoom' in global_lower:
        return 'zoom'

    lower = _sanitize_bubble_text(panel.get('text', '')).lower()
    if any(word in lower for word in ['impact', 'breach', 'ssrf', 'dos', 'network']):
        return 'background_change'
    if any(word in lower for word in ['hacker', 'attack', 'inject', 'malicious']):
        return 'pan'
    if any(word in lower for word in ['engineer', 'secure', 'disable', 'blocked', 'shield']):
        return 'parallax'
    return ['zoom', 'pan', 'parallax', 'background_change'][index % 4]

def _choose_subtitle_template(text):
    lower = text.lower()
    if ':' in text or any(token in lower for token in ['"', '?', '!']):
        return 'story-bubble'
    if len(text) > 95:
        return 'caption-card'
    return 'lower-third'

def _wrap_text(draw, text, font, max_width):
    words = text.split()
    lines = []
    current = ''
    for word in words:
        candidate = f'{current} {word}'.strip()
        bbox = draw.textbbox((0, 0), candidate, font=font)
        width = bbox[2] - bbox[0]
        if width <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines[:5]

def _load_panel_image(src):
    raw_bytes = None
    content_type = ''

    if src.startswith('data:'):
        header, encoded = src.split(',', 1)
        content_type = header.split(';', 1)[0].replace('data:', '').strip().lower()
        raw_bytes = base64.b64decode(encoded)
    else:
        if src.startswith('/'):
            src = f'http://127.0.0.1:{PORT}{src}'

        req = urllib.request.Request(src, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            content_type = (resp.headers.get('Content-Type') or '').lower()
            raw_bytes = resp.read()

    if not raw_bytes:
        raise RuntimeError('Panel image is empty')

    if 'svg' in content_type:
        raise RuntimeError('Panel image is still an SVG placeholder. Generate finished raster panels before creating a reel.')

    try:
        return Image.open(io.BytesIO(raw_bytes)).convert('RGB')
    except Exception as e:
        raise RuntimeError(f'Could not normalize panel image for reel: {e}') from e

def _resize_cover(image, target_width, target_height):
    scale = max(target_width / image.width, target_height / image.height)
    resized = image.resize((max(1, int(image.width * scale)), max(1, int(image.height * scale))), Image.Resampling.LANCZOS)
    left = max(0, (resized.width - target_width) // 2)
    top = max(0, (resized.height - target_height) // 2)
    return resized.crop((left, top, left + target_width, top + target_height))

def _resize_contain(image, target_width, target_height):
    copy = image.copy()
    copy.thumbnail((target_width, target_height), Image.Resampling.LANCZOS)
    return copy

def _motion_canvas(image, preset, t):
    if preset == 'background_change':
        bg = _resize_cover(image, 720, 1280)
        bg = ImageEnhance.Color(bg.filter(ImageFilter.GaussianBlur(radius=18))).enhance(0.7)
        tint = Image.new('RGB', (720, 1280), (
            int(145 + 60 * math.sin(t * math.pi)),
            int(180 + 35 * math.sin((t + 0.25) * math.pi)),
            int(205 + 30 * math.cos(t * math.pi))
        ))
        bg = Image.blend(bg, tint, 0.22)
        fg = _resize_contain(image, 610, 860)
        offset_y = int(28 * math.sin(t * math.pi))
        card_x = (720 - fg.width) // 2
        card_y = 130 + offset_y
        canvas = bg
        shadow = Image.new('RGBA', (fg.width + 32, fg.height + 32), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        shadow_draw.rounded_rectangle([10, 10, fg.width + 20, fg.height + 20], radius=28, fill=(0, 0, 0, 80))
        canvas = canvas.convert('RGBA')
        canvas.alpha_composite(shadow, (card_x - 16, card_y - 16))
        card = Image.new('RGBA', (fg.width + 24, fg.height + 24), (255, 255, 255, 255))
        card_draw = ImageDraw.Draw(card)
        card_draw.rounded_rectangle([0, 0, fg.width + 23, fg.height + 23], radius=30, fill=(255, 255, 255, 255), outline=(24, 24, 24, 255), width=4)
        canvas.alpha_composite(card, (card_x - 12, card_y - 12))
        canvas.alpha_composite(fg.convert('RGBA'), (card_x, card_y))
        return canvas.convert('RGB')

    if preset == 'parallax':
        bg = _resize_cover(image, 720, 1280).filter(ImageFilter.GaussianBlur(radius=14))
        bg = ImageEnhance.Brightness(bg).enhance(0.82)
        bg_scale = 1.04 + (0.04 * t)
        bg_resized = bg.resize((int(720 * bg_scale), int(1280 * bg_scale)), Image.Resampling.LANCZOS)
        bg_x = (bg_resized.width - 720) // 2 - int(18 * t)
        bg_y = (bg_resized.height - 1280) // 2 - int(26 * t)
        canvas = bg_resized.crop((bg_x, bg_y, bg_x + 720, bg_y + 1280))
        fg = _resize_contain(image, 660, 860)
        fg_x = (720 - fg.width) // 2 + int(20 * (t - 0.5))
        fg_y = 110 + int(12 * math.sin(t * math.pi))
        canvas.paste(fg, (fg_x, fg_y))
        return canvas

    scale = 1.06 + (0.10 * t)
    if preset == 'pan':
        scale = 1.12
    resized = image.resize((max(720, int(image.width * scale)), max(1280, int(image.height * scale))), Image.Resampling.LANCZOS)
    cover = _resize_cover(resized, max(720, resized.width), max(1280, resized.height))
    if preset == 'pan':
        pan_space = max(0, cover.width - 720)
        left = int(pan_space * t)
        top = max(0, (cover.height - 1280) // 2)
    else:
        pan_space_x = max(0, cover.width - 720)
        pan_space_y = max(0, cover.height - 1280)
        left = pan_space_x // 2
        top = int((pan_space_y // 2) * t)
    return cover.crop((left, top, left + 720, top + 1280))

def _draw_story_subtitle(frame, panel, template):
    bubble_text = _sanitize_bubble_text(panel.get('text', ''))
    draw = ImageDraw.Draw(frame)
    font = _load_font(34)
    max_text_width = 720 - 140
    lines = _wrap_text(draw, bubble_text, font, max_text_width)
    line_boxes = [draw.textbbox((0, 0), line, font=font) for line in lines]
    line_height = max((bbox[3] - bbox[1] for bbox in line_boxes), default=32)
    gap = 12
    text_block_height = (line_height * len(lines)) + (gap * max(len(lines) - 1, 0))
    box_width = min(max((bbox[2] - bbox[0] for bbox in line_boxes), default=300) + 56, 640)
    box_x = (720 - box_width) // 2

    if template == 'story-bubble':
        box_y = 980
        box_height = text_block_height + 72
        draw.rounded_rectangle([box_x, box_y, box_x + box_width, box_y + box_height], radius=28, fill='white', outline='black', width=4)
        draw.polygon([(box_x + 84, box_y + box_height), (box_x + 124, box_y + box_height), (box_x + 94, box_y + box_height + 32)], fill='white', outline='black')
        text_start_y = box_y + 24
    elif template == 'caption-card':
        box_y = 920
        box_height = text_block_height + 86
        draw.rounded_rectangle([50, box_y, 670, box_y + box_height], radius=22, fill=(15, 15, 15), outline='white', width=3)
        box_x = 72
        box_width = 576
        text_start_y = box_y + 28
    else:
        box_y = 1040
        box_height = text_block_height + 44
        draw.rounded_rectangle([36, box_y, 684, box_y + box_height], radius=20, fill=(0, 0, 0), outline='white', width=2)
        box_x = 70
        box_width = 580
        text_start_y = box_y + 18

    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        line_width = bbox[2] - bbox[0]
        text_x = box_x + (box_width - line_width) // 2
        fill = 'black' if template == 'story-bubble' else 'white'
        draw.text((text_x, text_start_y), line, font=font, fill=fill)
        text_start_y += line_height + gap

def _render_animated_panel_frames(panel, dest_dir, start_index, panel_index, global_prompt='', fps=10, seconds=6.0):
    image = _load_panel_image(panel.get('imageUrl', ''))
    preset = _choose_motion_preset(panel, panel_index, global_prompt=global_prompt)
    animation_prompt = _derive_animation_prompt(panel, global_prompt=global_prompt)
    template = _choose_subtitle_template(_sanitize_bubble_text(panel.get('text', '')))
    total_frames = max(12, int(fps * seconds))

    for frame_offset in range(total_frames):
        t = frame_offset / max(1, total_frames - 1)
        frame = _motion_canvas(image, preset, t)
        _draw_story_subtitle(frame, panel, template)
        frame.info['animation_prompt'] = animation_prompt
        frame_path = os.path.join(dest_dir, f'frame{start_index + frame_offset:04d}.png')
        frame.save(frame_path, format='PNG')

    return total_frames

def local_generate_reel(panels, audio_path=None, animation_prompt=''):
    exports_dir = ensure_exports_dir()
    work_dir = tempfile.mkdtemp(prefix='comic_reel_')
    try:
        frame_cursor = 1
        fps = 10
        for index, panel in enumerate(panels, start=1):
            rendered = _render_animated_panel_frames(panel, work_dir, frame_cursor, index - 1, global_prompt=animation_prompt, fps=fps)
            frame_cursor += rendered

        output_path = os.path.join(exports_dir, f"reel_{uuid.uuid4().hex}.mp4")
        fitted_audio_path = None
        if audio_path:
            target_duration = max(0.1, (frame_cursor - 1) / fps)
            fitted_audio_path = _fit_audio_to_duration(audio_path, target_duration)

        ffmpeg_cmd = [
            '/opt/homebrew/bin/ffmpeg', '-y',
            '-framerate', str(fps),
            '-i', os.path.join(work_dir, 'frame%04d.png')
        ]

        if fitted_audio_path:
            ffmpeg_cmd += ['-i', fitted_audio_path]

        ffmpeg_cmd += [
            '-vf', 'format=yuv420p',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-r', '30'
        ]

        if fitted_audio_path:
            ffmpeg_cmd += ['-c:a', 'aac', '-shortest']

        ffmpeg_cmd.append(output_path)
        result = subprocess.run(
            ffmpeg_cmd,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or '').strip().splitlines()[-10:]
            raise RuntimeError('ffmpeg failed: ' + ' | '.join(detail))
        return f"/exports/{os.path.basename(output_path)}"
    finally:
        if 'fitted_audio_path' in locals() and fitted_audio_path and fitted_audio_path != audio_path and os.path.exists(fitted_audio_path):
            os.remove(fitted_audio_path)
        shutil.rmtree(work_dir, ignore_errors=True)

def _slugify(value):
    clean = re.sub(r'[^a-zA-Z0-9]+', '-', (value or '').strip().lower()).strip('-')
    return clean or 'comicforge-package'

def _download_asset_bytes(src):
    if not src:
        raise RuntimeError('Missing asset source')
    if src.startswith('data:'):
        header, encoded = src.split(',', 1)
        return base64.b64decode(encoded), header.split(';', 1)[0].replace('data:', '').strip().lower()

    if src.startswith('/'):
        src = f'http://127.0.0.1:{PORT}{src}'

    req = urllib.request.Request(src, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read(), (resp.headers.get('Content-Type') or '').lower()

def _asset_extension(content_type, fallback='bin'):
    if 'png' in content_type:
        return 'png'
    if 'jpeg' in content_type or 'jpg' in content_type:
        return 'jpg'
    if 'webp' in content_type:
        return 'webp'
    if 'mp4' in content_type:
        return 'mp4'
    if 'audio' in content_type or 'm4a' in content_type:
        return 'm4a'
    if 'json' in content_type:
        return 'json'
    if 'text' in content_type:
        return 'txt'
    return fallback

def _threshold_image(image, threshold=72):
    return image.convert('L').point(lambda px: 255 if px > threshold else 0).convert('RGB')

def _controlnet_guides(image):
    base = image.convert('RGB')
    canny_like = _threshold_image(base.convert('L').filter(ImageFilter.FIND_EDGES), threshold=48)
    lineart_like = ImageOps.invert(_threshold_image(ImageOps.grayscale(base).filter(ImageFilter.CONTOUR), threshold=136))
    depth_like = ImageOps.autocontrast(ImageOps.grayscale(base).filter(ImageFilter.GaussianBlur(radius=10))).convert('RGB')
    return {
        'canny': canny_like,
        'lineart': lineart_like,
        'depth': depth_like
    }

def _panel_motion_profile(panel):
    text = _sanitize_bubble_text(panel.get('text', '')).lower()
    if any(word in text for word in ['hacker', 'attack', 'inject', 'malicious', 'exploit']):
        return {
            'zoom': '0:(1.00), 24:(1.04)',
            'translation_x': '0:(0), 24:(18)',
            'translation_y': '0:(0), 24:(-6)'
        }
    if any(word in text for word in ['impact', 'breach', 'ssrf', 'dos', 'network', 'data']):
        return {
            'zoom': '0:(1.00), 24:(1.02)',
            'translation_x': '0:(0), 24:(0)',
            'translation_y': '0:(0), 24:(-14)'
        }
    if any(word in text for word in ['engineer', 'secure', 'shield', 'blocked', 'mitigation']):
        return {
            'zoom': '0:(1.00), 24:(1.05)',
            'translation_x': '0:(0), 24:(-12)',
            'translation_y': '0:(0), 24:(-4)'
        }
    return {
        'zoom': '0:(1.00), 24:(1.03)',
        'translation_x': '0:(0), 24:(10)',
        'translation_y': '0:(0), 24:(-8)'
    }

def _build_wan_motion_prompt(text, animation_prompt=''):
    scene = _sanitize_bubble_text(text)
    motion = _sanitize_bubble_text(animation_prompt)
    if not motion or motion == 'Panel description':
        motion = 'subtle cinematic motion, natural body movement, environmental motion, soft camera push'
    return (
        f'{scene}\n\n'
        'Camera Motion:\n'
        f'{motion}\n\n'
        'Animation Effects:\n'
        'natural body motion, environmental movement, screen glow, subtle lighting changes\n\n'
        'Style:\n'
        'clean vertical-friendly educational comic animation, stable character identity, no text inside image'
    )

def _get_comfyui_api_base_url():
    global COMFYUI_API_BASE_URL_CACHE
    if COMFYUI_API_BASE_URL_CACHE:
        return COMFYUI_API_BASE_URL_CACHE

    candidates = (
        os.environ.get('COMFYUI_API_URL', '').strip(),
        'http://127.0.0.1:8188',
        'http://127.0.0.1:8000'
    )
    for base_url in candidates:
        if not base_url:
            continue
        try:
            with urllib.request.urlopen(f'{base_url}/object_info', timeout=5) as resp:
                if resp.status == 200:
                    COMFYUI_API_BASE_URL_CACHE = base_url.rstrip('/')
                    return COMFYUI_API_BASE_URL_CACHE
        except Exception:
            continue
    raise RuntimeError('ComfyUI API is not reachable on localhost')

def _comfyui_request_json(path, payload=None, method='GET', timeout=30):
    url = f'{_get_comfyui_api_base_url()}{path}'
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode('utf-8')
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        detail = exc.read().decode('utf-8', errors='ignore').strip()
        raise RuntimeError(f'ComfyUI API error {exc.code}: {detail or exc.reason}')
    except URLError as exc:
        raise RuntimeError(f'ComfyUI API request failed: {exc.reason}')

def _comfyui_is_available():
    try:
        _get_comfyui_api_base_url()
        return True
    except Exception:
        return False

def _build_wan_i2v_workflow(input_image_name, prompt, filename_prefix, seed=None):
    seed = seed or random.randint(1, 2_147_483_647)
    width = 512
    height = 896
    frames = 49
    total_steps = 4
    split_step = 2
    negative_prompt = (
        'blurry, low quality, low detail, static shot, frozen frame, jittery motion, '
        'distorted face, malformed hands, duplicate limbs, watermark, logo, subtitle, '
        'speech bubble, text, letters, non-English text, gibberish, oversaturated'
    )
    return {
        '1': {
            'class_type': 'LoadImage',
            'inputs': {
                'image': input_image_name
            }
        },
        '2': {
            'class_type': 'ImageScale',
            'inputs': {
                'image': ['1', 0],
                'upscale_method': 'lanczos',
                'width': width,
                'height': height,
                'crop': 'center'
            }
        },
        '3': {
            'class_type': 'WanVideoVAELoader',
            'inputs': {
                'model_name': 'wan_2.1_vae.safetensors',
                'precision': 'bf16',
                'use_cpu_cache': False,
                'verbose': False
            }
        },
        '4': {
            'class_type': 'LoadWanVideoT5TextEncoder',
            'inputs': {
                'model_name': 'umt5_xxl_fp16.safetensors',
                'precision': 'bf16',
                'load_device': 'offload_device',
                'quantization': 'disabled'
            }
        },
        '5': {
            'class_type': 'WanVideoTextEncode',
            'inputs': {
                'positive_prompt': prompt,
                'negative_prompt': negative_prompt,
                't5': ['4', 0],
                'force_offload': True,
                'device': 'cpu'
            }
        },
        '6': {
            'class_type': 'WanVideoBlockSwap',
            'inputs': {
                'blocks_to_swap': 40,
                'offload_img_emb': True,
                'offload_txt_emb': True,
                'use_non_blocking': False,
                'vace_blocks_to_swap': 0,
                'prefetch_blocks': 0,
                'block_swap_debug': False
            }
        },
        '7': {
            'class_type': 'WanVideoLoraSelect',
            'inputs': {
                'lora': 'wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors',
                'strength': 1.0,
                'low_mem_load': False,
                'merge_loras': False
            }
        },
        '8': {
            'class_type': 'WanVideoLoraSelect',
            'inputs': {
                'lora': 'wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors',
                'strength': 1.0,
                'low_mem_load': False,
                'merge_loras': False
            }
        },
        '9': {
            'class_type': 'WanVideoModelLoader',
            'inputs': {
                'model': 'wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors',
                'base_precision': 'fp16',
                'quantization': 'disabled',
                'load_device': 'offload_device',
                'attention_mode': 'sdpa',
                'rms_norm_function': 'default'
            }
        },
        '10': {
            'class_type': 'WanVideoModelLoader',
            'inputs': {
                'model': 'wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors',
                'base_precision': 'fp16',
                'quantization': 'disabled',
                'load_device': 'offload_device',
                'attention_mode': 'sdpa',
                'rms_norm_function': 'default'
            }
        },
        '11': {
            'class_type': 'WanVideoSetBlockSwap',
            'inputs': {
                'model': ['9', 0],
                'block_swap_args': ['6', 0]
            }
        },
        '12': {
            'class_type': 'WanVideoSetBlockSwap',
            'inputs': {
                'model': ['10', 0],
                'block_swap_args': ['6', 0]
            }
        },
        '13': {
            'class_type': 'WanVideoSetLoRAs',
            'inputs': {
                'model': ['11', 0],
                'lora': ['7', 0]
            }
        },
        '14': {
            'class_type': 'WanVideoSetLoRAs',
            'inputs': {
                'model': ['12', 0],
                'lora': ['8', 0]
            }
        },
        '15': {
            'class_type': 'WanVideoImageToVideoEncode',
            'inputs': {
                'width': width,
                'height': height,
                'num_frames': frames,
                'noise_aug_strength': 0.02,
                'start_latent_strength': 1.0,
                'end_latent_strength': 0.92,
                'force_offload': True,
                'vae': ['3', 0],
                'start_image': ['2', 0],
                'fun_or_fl2v_model': False,
                'tiled_vae': False
            }
        },
        '16': {
            'class_type': 'WanVideoSampler',
            'inputs': {
                'model': ['13', 0],
                'image_embeds': ['15', 0],
                'text_embeds': ['5', 0],
                'steps': total_steps,
                'cfg': 2.0,
                'shift': 8.0,
                'seed': seed,
                'force_offload': True,
                'scheduler': 'dpm++_sde',
                'riflex_freq_index': 0,
                'denoise_strength': 1.0,
                'batched_cfg': False,
                'rope_function': 'comfy',
                'start_step': 0,
                'end_step': split_step,
                'add_noise_to_samples': False
            }
        },
        '17': {
            'class_type': 'WanVideoSampler',
            'inputs': {
                'model': ['14', 0],
                'image_embeds': ['15', 0],
                'text_embeds': ['5', 0],
                'samples': ['16', 0],
                'steps': total_steps,
                'cfg': 1.0,
                'shift': 8.0,
                'seed': seed,
                'force_offload': True,
                'scheduler': 'dpm++_sde',
                'riflex_freq_index': 0,
                'denoise_strength': 1.0,
                'batched_cfg': False,
                'rope_function': 'comfy',
                'start_step': split_step,
                'end_step': -1,
                'add_noise_to_samples': False
            }
        },
        '18': {
            'class_type': 'WanVideoDecode',
            'inputs': {
                'vae': ['3', 0],
                'samples': ['17', 0],
                'enable_vae_tiling': True,
                'tile_x': 272,
                'tile_y': 272,
                'tile_stride_x': 144,
                'tile_stride_y': 128,
                'normalization': 'default'
            }
        },
        '19': {
            'class_type': 'VHS_VideoCombine',
            'inputs': {
                'images': ['18', 0],
                'frame_rate': 12,
                'loop_count': 0,
                'filename_prefix': filename_prefix,
                'format': 'video/h264-mp4',
                'pix_fmt': 'yuv420p',
                'crf': 19,
                'save_metadata': True,
                'trim_to_audio': False,
                'pingpong': False,
                'save_output': True
            }
        }
    }

def _find_recent_comfyui_video(prefix_fragment, after_time):
    output_root = Path(_get_comfyui_base_path()) / 'output'
    if not output_root.exists():
        return None
    candidates = []
    for path in output_root.rglob('*.mp4'):
        try:
            stat = path.stat()
        except OSError:
            continue
        if stat.st_mtime < after_time:
            continue
        if prefix_fragment and prefix_fragment not in str(path):
            continue
        candidates.append((stat.st_mtime, path))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]

def _extract_history_video_path(history_payload):
    output_root = Path(_get_comfyui_base_path()) / 'output'
    if not history_payload:
        return None

    def walk(value):
        if isinstance(value, dict):
            filename = value.get('filename')
            if filename and str(filename).lower().endswith('.mp4'):
                subfolder = value.get('subfolder', '')
                candidate = output_root / subfolder / filename
                if candidate.exists():
                    return candidate
            for nested in value.values():
                match = walk(nested)
                if match:
                    return match
        elif isinstance(value, list):
            for nested in value:
                match = walk(nested)
                if match:
                    return match
        return None

    return walk(history_payload)

def _resolve_local_asset_path(asset_ref):
    if not asset_ref:
        return None
    if os.path.isabs(asset_ref) and os.path.exists(asset_ref):
        return asset_ref
    if asset_ref.startswith('/'):
        candidate = os.path.join(os.getcwd(), asset_ref.lstrip('/'))
        if os.path.exists(candidate):
            return candidate
    return None

def _build_panel_audio_text(data, panel):
    voice_script = _sanitize_bubble_text(data.get('voice_script', '') or panel.get('voiceScript', ''))
    if voice_script and voice_script != 'Panel description':
        return voice_script
    project = data.get('project') or {}
    narration_text = _sanitize_bubble_text(project.get('narrationText', ''))
    panel_text = _sanitize_bubble_text(panel.get('text', ''))
    if narration_text and len(narration_text.split()) <= 28:
        return narration_text
    return panel_text if panel_text and panel_text != 'Panel description' else narration_text

def _probe_media_duration(path):
    result = subprocess.run(
        [
            '/opt/homebrew/bin/ffprobe',
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            str(path)
        ],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    if result.returncode != 0:
        return None
    try:
        return float((result.stdout or '').strip())
    except Exception:
        return None

def _build_atempo_chain(ratio):
    ratio = max(0.05, float(ratio))
    filters = []
    while ratio > 2.0:
        filters.append('atempo=2.0')
        ratio /= 2.0
    while ratio < 0.5:
        filters.append('atempo=0.5')
        ratio /= 0.5
    filters.append(f'atempo={ratio:.6f}')
    return ','.join(filters)

def _fit_audio_to_duration(audio_path, target_duration):
    if not audio_path or not os.path.exists(audio_path):
        return audio_path
    audio_duration = _probe_media_duration(audio_path)
    if not audio_duration or audio_duration <= 0 or not target_duration:
        return audio_path
    if abs(audio_duration - target_duration) < 0.15:
        return audio_path

    fitted_path = os.path.join(ensure_exports_dir(), f'fitted_audio_{uuid.uuid4().hex}.m4a')
    tempo_ratio = audio_duration / max(0.1, target_duration)
    filter_chain = _build_atempo_chain(tempo_ratio)
    if target_duration > audio_duration:
        filter_chain = f'{filter_chain},apad=pad_dur={target_duration:.3f}'

    result = subprocess.run(
        [
            '/opt/homebrew/bin/ffmpeg', '-y',
            '-i', audio_path,
            '-filter:a', filter_chain,
            '-t', f'{target_duration:.3f}',
            '-c:a', 'aac',
            '-b:a', '192k',
            fitted_path
        ],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    if result.returncode != 0 or not os.path.exists(fitted_path):
        if os.path.exists(fitted_path):
            os.remove(fitted_path)
        return audio_path
    return fitted_path

def _gemini_request_json(path, payload=None, method='GET', timeout=60, api_key=''):
    base_url = 'https://generativelanguage.googleapis.com/v1beta'
    headers = {'x-goog-api-key': api_key}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(f'{base_url}{path}', data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode('utf-8')
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        detail = exc.read().decode('utf-8', errors='ignore').strip()
        raise RuntimeError(f'Veo request failed ({exc.code}): {detail or exc.reason}')

def _extract_video_uri(payload):
    if isinstance(payload, dict):
        uri = payload.get('uri')
        if isinstance(uri, str) and uri.startswith('http'):
            return uri
        for value in payload.values():
            match = _extract_video_uri(value)
            if match:
                return match
    elif isinstance(payload, list):
        for value in payload:
            match = _extract_video_uri(value)
            if match:
                return match
    return None

def generate_panel_video_with_veo(data):
    api_key = os.environ.get('GEMINI_API_KEY', '').strip() or os.environ.get('GOOGLE_API_KEY', '').strip()
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY is not configured for Veo 3.1')

    folder = export_panel_to_comfyui(data)
    panel = data.get('panel') or {}
    prompt = (data.get('animation_prompt', '') or panel.get('animationPrompt', '') or panel.get('text', '')).strip()
    if not prompt:
        raise RuntimeError('Missing Veo prompt')

    image = _load_panel_image(panel.get('imageUrl', ''))
    image_buffer = io.BytesIO()
    image.save(image_buffer, format='PNG')
    image_b64 = base64.b64encode(image_buffer.getvalue()).decode('utf-8')

    operation = _gemini_request_json(
        '/models/veo-3.1-generate-preview:predictLongRunning',
        payload={
            'instances': [{
                'prompt': prompt,
                'referenceImages': [{
                    'image': {
                        'inlineData': {
                            'mimeType': 'image/png',
                            'data': image_b64
                        }
                    },
                    'referenceType': 'asset'
                }]
            }],
            'parameters': {
                'aspectRatio': '9:16',
                'durationSeconds': 6
            }
        },
        method='POST',
        timeout=120,
        api_key=api_key
    )

    operation_name = operation.get('name', '')
    if not operation_name:
        raise RuntimeError('Veo did not return an operation id')

    final_status = operation
    for _ in range(90):
        if final_status.get('done'):
            break
        time.sleep(10)
        final_status = _gemini_request_json(f'/{operation_name}', timeout=60, api_key=api_key)

    if not final_status.get('done'):
        return {
            'status': 'queued',
            'folder': folder,
            'operation_name': operation_name
        }

    if final_status.get('error'):
        raise RuntimeError(final_status['error'].get('message') or 'Veo generation failed')

    video_uri = _extract_video_uri(final_status)
    if not video_uri:
        raise RuntimeError('Veo returned no downloadable video URL')

    with urllib.request.urlopen(
        urllib.request.Request(video_uri, headers={'x-goog-api-key': api_key}),
        timeout=300
    ) as resp:
        video_bytes = resp.read()

    exports_dir = ensure_exports_dir()
    temp_video_path = os.path.join(exports_dir, f'veo_temp_{uuid.uuid4().hex}.mp4')
    with open(temp_video_path, 'wb') as handle:
        handle.write(video_bytes)

    audio_path = None
    try:
        audio_text = _build_panel_audio_text(data, panel)
        if audio_text:
            audio_url = local_generate_audio(audio_text, voice='Aman')
            audio_path = _resolve_local_asset_path(audio_url)
    except Exception:
        audio_path = None

    try:
        final_url = _copy_comfyui_video_to_exports(temp_video_path, audio_path=audio_path)
    finally:
        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)

    return {
        'status': 'success',
        'folder': folder,
        'operation_name': operation_name,
        'url': final_url
    }

def _copy_comfyui_video_to_exports(video_path, audio_path=None):
    exports_dir = ensure_exports_dir()
    output_path = os.path.join(exports_dir, f'wan_panel_{uuid.uuid4().hex}.mp4')
    fitted_audio_path = None
    if audio_path and os.path.exists(audio_path):
        video_duration = _probe_media_duration(video_path)
        fitted_audio_path = _fit_audio_to_duration(audio_path, video_duration) if video_duration else audio_path
        result = subprocess.run(
            [
                '/opt/homebrew/bin/ffmpeg', '-y',
                '-i', str(video_path),
                '-i', fitted_audio_path,
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-shortest',
                output_path
            ],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if result.returncode == 0 and os.path.exists(output_path):
            if fitted_audio_path and fitted_audio_path != audio_path and os.path.exists(fitted_audio_path):
                os.remove(fitted_audio_path)
            return f"/exports/{os.path.basename(output_path)}"
    if fitted_audio_path and fitted_audio_path != audio_path and os.path.exists(fitted_audio_path):
        os.remove(fitted_audio_path)
    shutil.copy2(video_path, output_path)
    return f"/exports/{os.path.basename(output_path)}"

def generate_panel_video_with_wan(data):
    folder = export_panel_to_comfyui(data)
    folder_path = Path(folder)
    panel = data.get('panel') or {}
    panel_id = panel.get('id', 'scene')
    image_name = f"comicforge/{folder_path.name}/source.png"
    prompt = _build_wan_motion_prompt(panel.get('text', ''), data.get('animation_prompt', ''))
    filename_prefix = f"comicforge/panel-{panel_id}-wan-{uuid.uuid4().hex[:8]}"
    workflow = _build_wan_i2v_workflow(image_name, prompt, filename_prefix)
    _write_json(folder_path / 'wan_i2v_workflow.json', workflow)

    if not _comfyui_is_available():
        return {
            'status': 'exported',
            'folder': folder,
            'workflow': str(folder_path / 'wan_i2v_workflow.json')
        }

    started = time.time()
    response = _comfyui_request_json('/prompt', {'prompt': workflow, 'client_id': f'comicforge-{uuid.uuid4().hex}'}, method='POST', timeout=30)
    prompt_id = response.get('prompt_id')
    audio_path = None
    try:
        audio_text = _build_panel_audio_text(data, panel)
        if audio_text:
            audio_url = local_generate_audio(audio_text, voice='Aman')
            audio_path = _resolve_local_asset_path(audio_url)
    except Exception:
        audio_path = None

    for _ in range(300):
        history_path = None
        if prompt_id:
            try:
                history_payload = _comfyui_request_json(f'/history/{prompt_id}', timeout=10)
                history_path = _extract_history_video_path(history_payload)
            except Exception:
                history_path = None
        if history_path and history_path.exists():
            return {
                'status': 'success',
                'folder': folder,
                'workflow': str(folder_path / 'wan_i2v_workflow.json'),
                'prompt_id': prompt_id,
                'url': _copy_comfyui_video_to_exports(history_path, audio_path=audio_path)
            }
        video_path = _find_recent_comfyui_video(f'panel-{panel_id}-wan', started)
        if video_path and video_path.exists():
            return {
                'status': 'success',
                'folder': folder,
                'workflow': str(folder_path / 'wan_i2v_workflow.json'),
                'prompt_id': prompt_id,
                'url': _copy_comfyui_video_to_exports(video_path, audio_path=audio_path)
            }
        time.sleep(2)

    return {
        'status': 'queued',
        'folder': folder,
        'workflow': str(folder_path / 'wan_i2v_workflow.json'),
        'prompt_id': prompt_id
    }

def _build_comfyui_starter_workflow():
    return {
        '1': {
            'class_type': 'CheckpointLoaderSimple',
            'inputs': {
                'ckpt_name': 'PUT_YOUR_SD_CHECKPOINT.safetensors'
            }
        },
        '2': {
            'class_type': 'LoadImage',
            'inputs': {
                'image': 'panels/panel-1.png',
                'upload': 'image'
            }
        },
        '3': {
            'class_type': 'Canny',
            'inputs': {
                'image': ['2', 0],
                'low_threshold': 100,
                'high_threshold': 200
            }
        },
        '4': {
            'class_type': 'ControlNetLoader',
            'inputs': {
                'control_net_name': 'PUT_YOUR_CONTROLNET_MODEL.safetensors'
            }
        },
        '5': {
            'class_type': 'CLIPTextEncode',
            'inputs': {
                'clip': ['1', 1],
                'text': 'Replace with panel prompt from metadata/panels.json'
            }
        },
        '6': {
            'class_type': 'CLIPTextEncode',
            'inputs': {
                'clip': ['1', 1],
                'text': 'blurry, low quality, distorted text, extra limbs, watermark'
            }
        },
        '7': {
            'class_type': 'EmptyLatentImage',
            'inputs': {
                'width': 768,
                'height': 1024,
                'batch_size': 1
            }
        },
        '8': {
            'class_type': 'ControlNetApply',
            'inputs': {
                'conditioning': ['5', 0],
                'control_net': ['4', 0],
                'image': ['3', 0],
                'strength': 0.75
            }
        },
        '9': {
            'class_type': 'KSampler',
            'inputs': {
                'model': ['1', 0],
                'positive': ['8', 0],
                'negative': ['6', 0],
                'latent_image': ['7', 0],
                'seed': 123456789,
                'steps': 24,
                'cfg': 7.5,
                'sampler_name': 'euler',
                'scheduler': 'normal',
                'denoise': 0.65
            }
        },
        '10': {
            'class_type': 'VAEDecode',
            'inputs': {
                'samples': ['9', 0],
                'vae': ['1', 2]
            }
        },
        '11': {
            'class_type': 'SaveImage',
            'inputs': {
                'images': ['10', 0],
                'filename_prefix': 'comicforge_controlnet'
            }
        }
    }

def create_integration_package(data):
    panels = data.get('panels', [])
    if not panels:
        raise RuntimeError('No panels supplied for AI package export')

    exports_dir = ensure_exports_dir()
    package_stem = f"{_slugify(data.get('title', 'comicforge-package'))}-{uuid.uuid4().hex[:8]}"
    zip_filename = f"{package_stem}.zip"
    zip_path = os.path.join(exports_dir, zip_filename)

    summary = {
        'title': data.get('title', 'ComicForge AI Package'),
        'style': data.get('style', {}),
        'layout': data.get('layout', 'grid'),
        'prompt_engine': data.get('prompt_engine', {}),
        'image_model': data.get('image_model', ''),
        'reel_prompt': data.get('reel_prompt', ''),
        'animation_prompt': data.get('animation_prompt', ''),
        'narration_text': data.get('narration_text', ''),
        'story_text': data.get('story_text', ''),
        'panel_count': len(panels)
    }

    comfyui_workflow = {
        'app': 'ComicForge',
        'target': 'ComfyUI',
        'workflow_type': 'starter_api_prompt',
        'note': 'Load the provided panel image and matching ControlNet guide, then replace model names with your local ComfyUI assets.',
        'starter_prompt_graph': _build_comfyui_starter_workflow(),
        'panels': [
            {
                'id': panel.get('id'),
                'image': f"panels/panel-{panel.get('id')}.png",
                'control_canny': f"controlnet/guides/panel-{panel.get('id')}-canny.png",
                'control_lineart': f"controlnet/guides/panel-{panel.get('id')}-lineart.png",
                'control_depth': f"controlnet/guides/panel-{panel.get('id')}-depth.png",
                'prompt': panel.get('visualPrompt', ''),
                'animation_prompt': panel.get('animationPrompt', '')
            }
            for panel in panels
        ],
        'reel': {
            'prompt': data.get('reel_prompt', ''),
            'animation_prompt': data.get('animation_prompt', '')
        }
    }

    controlnet_manifest = {
        'app': 'ComicForge',
        'target': 'ControlNet',
        'note': 'Use the exported guide images with the matching prompt. Canny and lineart are suited for composition retention; depth is suited for spatial consistency.',
        'recommended_preprocessors': ['canny', 'lineart', 'depth'],
        'panels': [
            {
                'id': panel.get('id'),
                'source_image': f"panels/panel-{panel.get('id')}.png",
                'canny_guide': f"controlnet/guides/panel-{panel.get('id')}-canny.png",
                'lineart_guide': f"controlnet/guides/panel-{panel.get('id')}-lineart.png",
                'depth_guide': f"controlnet/guides/panel-{panel.get('id')}-depth.png",
                'prompt': panel.get('visualPrompt', ''),
                'conditioning_hint': panel.get('text', ''),
                'recommended_control_weight': 0.75,
                'recommended_denoise_strength': 0.6
            }
            for panel in panels
        ]
    }

    deforum_prompts = {}
    zoom_schedule = []
    translation_x_schedule = []
    translation_y_schedule = []
    frame_step = 24
    for index, panel in enumerate(panels):
        start_frame = index * frame_step
        deforum_prompts[str(start_frame)] = panel.get('animationPrompt', '') or panel.get('text', '')
        motion = _panel_motion_profile(panel)
        zoom_schedule.append(f'{start_frame}:{motion["zoom"].split("),", 1)[0].split(":(", 1)[1]}')
        translation_x_schedule.append(f'{start_frame}:{motion["translation_x"].split("),", 1)[0].split(":(", 1)[1]}')
        translation_y_schedule.append(f'{start_frame}:{motion["translation_y"].split("),", 1)[0].split(":(", 1)[1]}')

    deforum_settings = {
        'app': 'ComicForge',
        'target': 'Deforum',
        'warning': 'Deforum is maintained separately and setup requirements vary by machine.',
        'animation_mode': '2D',
        'max_frames': max(24, len(panels) * frame_step),
        'border': 'replicate',
        'fps': 12,
        'prompts': deforum_prompts,
        'strength_schedule': '0:(0.62)',
        'cfg_scale_schedule': '0:(7.5)',
        'noise_schedule': '0:(0.03)',
        'keyframes': {
            'zoom': ', '.join(f'{idx * frame_step}:(1.03)' for idx, _ in enumerate(panels)) or '0:(1.03)',
            'angle': '0:(0)',
            'translation_x': ', '.join(f'{idx * frame_step}:(0)' for idx, _ in enumerate(panels)) or '0:(0)',
            'translation_y': ', '.join(f'{idx * frame_step}:(-6)' for idx, _ in enumerate(panels)) or '0:(-6)'
        },
        'init_images': [
            {
                'frame': index * frame_step,
                'path': f"deforum/init_frames/panel-{panel.get('id')}.png"
            }
            for index, panel in enumerate(panels)
        ]
    }

    readme = (
        '# ComicForge AI Integration Package\n\n'
        'This package keeps the current ComicForge app flow unchanged and exports the current comic for optional use in ComfyUI, ControlNet, and Deforum.\n\n'
        'Contents:\n'
        '- `panels/`: generated panel images\n'
        '- `metadata/manifest.json`: full project metadata\n'
        '- `metadata/story.txt`: panel-by-panel story text\n'
        '- `metadata/narration.txt`: narration script used for the reel\n'
        '- `comfyui/workflow.json`: ComfyUI starter API graph with placeholders for local model names\n'
        '- `controlnet/controlnet_manifest.json`: ControlNet-ready prompt and guide mapping\n'
        '- `controlnet/guides/`: canny, lineart, and depth-style guide images derived from each panel\n'
        '- `deforum/deforum_settings.json`: Deforum starter settings with panel-based prompt schedule\n'
        '- `deforum/init_frames/`: per-panel init images for Deforum image-driven animation\n'
        '- `assets/`: optional local audio/reel exports when they exist\n\n'
        'Usage notes:\n'
        '- ComfyUI: replace the checkpoint and ControlNet model placeholders with your installed model names, then point `LoadImage` to the exported panel/control images.\n'
        '- ControlNet: use `controlnet/guides/*` as the control images and the matching prompt from `metadata/panels.json`.\n'
        '- Deforum: start from `deforum_settings.json`, keep `animation_mode=2D`, and use the exported `init_frames/` as init images for scene continuity.\n'
    )

    with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('README.md', readme)
        zf.writestr('metadata/manifest.json', json.dumps(summary, indent=2))
        zf.writestr('metadata/story.txt', data.get('story_text', ''))
        zf.writestr('metadata/narration.txt', data.get('narration_text', ''))
        zf.writestr('metadata/reel_prompt.txt', data.get('reel_prompt', ''))
        zf.writestr('metadata/animation_prompt.txt', data.get('animation_prompt', ''))
        zf.writestr('metadata/panels.json', json.dumps(panels, indent=2))
        zf.writestr('comfyui/workflow.json', json.dumps(comfyui_workflow, indent=2))
        zf.writestr('controlnet/controlnet_manifest.json', json.dumps(controlnet_manifest, indent=2))
        zf.writestr('deforum/deforum_settings.json', json.dumps(deforum_settings, indent=2))

        for panel in panels:
            panel_id = panel.get('id')
            source = panel.get('imageUrl', '')
            if not source:
                continue
            image = _load_panel_image(source)
            buffer = io.BytesIO()
            image.save(buffer, format='PNG')
            zf.writestr(f'panels/panel-{panel_id}.png', buffer.getvalue())
            zf.writestr(f'deforum/init_frames/panel-{panel_id}.png', buffer.getvalue())

            guides = _controlnet_guides(image)
            for guide_name, guide_image in guides.items():
                guide_buffer = io.BytesIO()
                guide_image.save(guide_buffer, format='PNG')
                zf.writestr(f'controlnet/guides/panel-{panel_id}-{guide_name}.png', guide_buffer.getvalue())

        for asset_key, zip_name in [('audio_url', 'assets/narration'), ('reel_url', 'assets/reel')]:
            asset_src = (data.get(asset_key) or '').strip()
            if not asset_src:
                continue
            try:
                raw_bytes, content_type = _download_asset_bytes(asset_src)
                ext = _asset_extension(content_type, fallback='bin')
                zf.writestr(f'{zip_name}.{ext}', raw_bytes)
            except Exception:
                pass

    return f'/exports/{zip_filename}', zip_filename

def _get_comfyui_base_path():
    config_path = os.path.expanduser('~/Library/Application Support/ComfyUI/config.json')
    try:
        with open(config_path, 'r', encoding='utf-8') as handle:
            config = json.load(handle)
            base_path = config.get('basePath', '').strip()
            if base_path:
                return base_path
    except Exception:
        pass
    return os.path.expanduser('~/Documents/ComfyUI')

def _write_json(path, payload):
    with open(path, 'w', encoding='utf-8') as handle:
        json.dump(payload, handle, indent=2)

def export_panel_to_comfyui(data):
    panel = data.get('panel') or {}
    if not panel.get('imageUrl'):
        raise RuntimeError('Panel image is missing')

    comfy_base = Path(_get_comfyui_base_path())
    input_root = comfy_base / 'input' / 'comicforge'
    input_root.mkdir(parents=True, exist_ok=True)

    panel_id = panel.get('id', 'scene')
    folder = input_root / f'panel-{panel_id}-{uuid.uuid4().hex[:8]}'
    folder.mkdir(parents=True, exist_ok=True)

    image = _load_panel_image(panel.get('imageUrl', ''))
    guides = _controlnet_guides(image)

    source_path = folder / 'source.png'
    image.save(source_path, format='PNG')
    for guide_name, guide_image in guides.items():
        guide_image.save(folder / f'{guide_name}.png', format='PNG')

    project = data.get('project') or {}
    text = _sanitize_bubble_text(panel.get('text', ''))
    visual_prompt = panel.get('visualPrompt', '')
    animation_prompt = panel.get('animationPrompt', '')
    style_name = ((project.get('style') or {}).get('name') or '').strip()
    prompt_suffix = ((project.get('style') or {}).get('promptSuffix') or '').strip()

    image_recipe_sdxl = {
        'workflow': 'panel_edit_sdxl',
        'checkpoint': 'sd_xl_base_1.0.safetensors',
        'source_image': 'source.png',
        'prompt': visual_prompt,
        'negative_prompt': 'blurry, low quality, distorted text, watermark, extra limbs',
        'settings': {
            'steps': 24,
            'cfg': 7.5,
            'denoise': 0.55,
            'sampler': 'euler'
        },
        'note': 'Start with img2img using the source panel, then optionally add a ControlNet model and use canny.png, lineart.png, or depth.png.'
    }

    image_recipe_sd15 = {
        'workflow': 'panel_edit_sd15',
        'checkpoint': 'v1-5-pruned-emaonly.safetensors',
        'source_image': 'source.png',
        'prompt': visual_prompt,
        'negative_prompt': 'blurry, low quality, distorted text, watermark, extra limbs',
        'settings': {
            'steps': 24,
            'cfg': 7.0,
            'denoise': 0.58,
            'sampler': 'euler'
        },
        'note': 'Use this when you want SD1.5 edits or when pairing with v3_sd15_mm.ckpt for animation.'
    }

    animation_recipe_sdxl = {
        'workflow': 'panel_animation_sdxl',
        'checkpoint': 'sd_xl_base_1.0.safetensors',
        'motion_model': 'mm_sdxl_v10_beta.ckpt',
        'source_image': 'source.png',
        'prompt': visual_prompt,
        'animation_prompt': animation_prompt,
        'reel_context': project.get('animationPrompt', ''),
        'settings': {
            'frames': 48,
            'fps': 12,
            'context_length': 8,
            'motion_strength': 0.8
        },
        'note': 'Use the source panel as init/reference image and AnimateDiff SDXL motion model for a short panel animation clip.'
    }

    animation_recipe_sd15 = {
        'workflow': 'panel_animation_sd15',
        'checkpoint': 'v1-5-pruned-emaonly.safetensors',
        'motion_model': 'v3_sd15_mm.ckpt',
        'source_image': 'source.png',
        'prompt': visual_prompt,
        'animation_prompt': animation_prompt,
        'reel_context': project.get('animationPrompt', ''),
        'settings': {
            'frames': 48,
            'fps': 12,
            'context_length': 16,
            'motion_strength': 0.9
        },
        'note': 'Use this pair for SD1.5-based AnimateDiff panel animation.'
    }

    animation_recipe_wan = {
        'workflow': 'panel_animation_wan_i2v',
        'model': 'wan2.6-i2v',
        'source_image': 'source.png',
        'prompt': _build_wan_motion_prompt(text, animation_prompt),
        'settings': {
            'duration_seconds': 5,
            'resolution': '720P',
            'generate_audio': True,
            'shot_type': 'single',
            'prompt_extend': True
        },
        'note': 'Use this when you want prompt-driven image-to-video with audio generated from the prompt via WanImageToVideoApi.'
    }

    panel_manifest = {
        'panel_id': panel_id,
        'text': text,
        'style': style_name,
        'style_prompt_suffix': prompt_suffix,
        'visual_prompt': visual_prompt,
        'animation_prompt': animation_prompt,
        'narration_text': project.get('narrationText', ''),
        'reel_prompt': project.get('reelPrompt', ''),
        'global_animation_prompt': project.get('animationPrompt', ''),
        'assets': {
            'source': 'source.png',
            'canny': 'canny.png',
            'lineart': 'lineart.png',
            'depth': 'depth.png'
        },
        'recipes': {
            'image_sdxl': 'recipe_image_sdxl.json',
            'image_sd15': 'recipe_image_sd15.json',
            'animation_sdxl': 'recipe_animation_sdxl.json',
            'animation_sd15': 'recipe_animation_sd15.json',
            'animation_wan': 'recipe_animation_wan.json'
        }
    }

    with open(folder / 'prompt.txt', 'w', encoding='utf-8') as handle:
        handle.write(visual_prompt)
    with open(folder / 'animation_prompt.txt', 'w', encoding='utf-8') as handle:
        handle.write(animation_prompt or project.get('animationPrompt', ''))
    with open(folder / 'narration.txt', 'w', encoding='utf-8') as handle:
        handle.write(project.get('narrationText', ''))
    with open(folder / 'README.txt', 'w', encoding='utf-8') as handle:
        handle.write(
            'ComicForge ComfyUI panel export\n\n'
            'Files:\n'
            '- source.png: current panel image\n'
            '- canny.png / lineart.png / depth.png: guide images for ControlNet-style editing\n'
            '- recipe_image_sdxl.json / recipe_image_sd15.json: starter edit settings\n'
            '- recipe_animation_sdxl.json / recipe_animation_sd15.json: starter panel animation settings\n'
            '- recipe_animation_wan.json: prompt-driven Wan image-to-video starter settings with generated audio\n\n'
            'Recommended pairs:\n'
            '- SDXL editing/animation: sd_xl_base_1.0.safetensors + mm_sdxl_v10_beta.ckpt\n'
            '- SD1.5 editing/animation: v1-5-pruned-emaonly.safetensors + v3_sd15_mm.ckpt\n'
            '- Wan image-to-video: WanImageToVideoApi with source.png and recipe_animation_wan.json prompt\n'
        )
    with open(folder / 'MOTION_WORKFLOW.txt', 'w', encoding='utf-8') as handle:
        handle.write(
            'ComicForge motion render guide\n\n'
            'Use this folder when you want real image-to-motion rendering instead of the quick preview MP4 from the app.\n\n'
            'Recommended path:\n'
            '1. Open ComfyUI.\n'
            '2. Use source.png as the init/reference image.\n'
            '3. Pick one of the animation recipes:\n'
            '   - recipe_animation_sd15.json with v1-5-pruned-emaonly.safetensors + v3_sd15_mm.ckpt\n'
            '   - recipe_animation_sdxl.json with sd_xl_base_1.0.safetensors + mm_sdxl_v10_beta.ckpt\n'
            '4. Paste animation_prompt.txt into your motion prompt input.\n'
            '5. Keep the output as an MP4 clip for this single panel.\n'
            '6. Join the downloaded panel clips later in your video editor.\n'
        )

    _write_json(folder / 'panel.json', panel_manifest)
    _write_json(folder / 'recipe_image_sdxl.json', image_recipe_sdxl)
    _write_json(folder / 'recipe_image_sd15.json', image_recipe_sd15)
    _write_json(folder / 'recipe_animation_sdxl.json', animation_recipe_sdxl)
    _write_json(folder / 'recipe_animation_sd15.json', animation_recipe_sd15)
    _write_json(folder / 'recipe_animation_wan.json', animation_recipe_wan)

    try:
        subprocess.Popen(['open', str(folder)])
    except Exception:
        pass

    return str(folder)

# ---------------------------------------------------------
# Server
# ---------------------------------------------------------
class MyRequestHandler(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def send_json(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_POST(self):
        sys.stderr.write(f"DEBUG: do_POST called with path: {self.path}\n")
        # 1. Proxy Check
        if self.path.startswith('/proxy'):
            self.handle_proxy_post()
            return

        # 2. JSON API
        content_length = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_length).decode('utf-8')
        try:
            data = json.loads(post_body) if post_body else {}
        except:
            data = {}
        
        if self.path == '/api/auth/signup': self.auth_signup(data)
        elif self.path == '/api/auth/login': self.auth_login(data)
        elif self.path == '/api/auth/forgot-password': self.auth_forgot(data)
        elif self.path == '/api/auth/reset-password': self.auth_reset(data)
        elif self.path == '/api/auth/change-password': self.auth_change_password(data)
        elif self.path == '/save': self.handle_save(data)
        elif self.path == '/api/user/deduct': self.handle_deduct(data)
        elif self.path == '/api/payment/create-order': self.handle_create_order(data)
        elif self.path == '/api/payment/verify': self.handle_verify_payment(data)
        elif self.path == '/api/comics/save': self.handle_save_comic(data)
        elif self.path.startswith('/api/comics/delete'): self.handle_delete_comic(data)
        elif self.path == '/api/local/image': self.handle_local_image(data)
        elif self.path == '/api/local/audio': self.handle_local_audio(data)
        elif self.path == '/api/local/audio-upload': self.handle_local_audio_upload(data)
        elif self.path == '/api/local/reel': self.handle_local_reel(data)
        elif self.path == '/api/local/panel-video': self.handle_local_panel_video(data)
        elif self.path == '/api/integrations/package': self.handle_integration_package(data)
        elif self.path == '/api/integrations/comfyui/panel': self.handle_comfyui_panel_export(data)
        elif self.path == '/api/ollama/generate': self.handle_ollama_generate(data)
        else: self.send_error(404)

    def do_GET(self):
        sys.stderr.write(f"DEBUG: do_GET called with path: {self.path}\n")
        
        if self.path == '/api/user/me':
             token = self.headers.get('Authorization', '').replace('Bearer ', '')
             conn = get_db_connection()
             cur = conn.cursor()
             cur.execute("SELECT u.email, u.role, u.credits FROM tokens t JOIN users u ON t.email = u.email WHERE t.token = ? AND t.type = 'session' AND t.expires_at > ?", (token, time.time()))
             user = cur.fetchone()
             conn.close()
             
             if user:
                  self.send_json(200, {
                      'email': user['email'], 
                      'role': user['role'], 
                      'credits': user['credits']
                  })
             else:
                  self.send_json(401, {'error': 'Unauthorized'})
             return

        if self.path == '/api/comics/list':
             token = self.headers.get('Authorization', '').replace('Bearer ', '')
             conn = get_db_connection()
             cur = conn.cursor()
             
             cur.execute("SELECT email FROM tokens WHERE token = ? AND type = 'session' AND expires_at > ?", (token, time.time()))
             res = cur.fetchone()
             if not res:
                 self.send_json(401, {'error': 'Unauthorized'})
                 conn.close()
                 return
             
             cur.execute("SELECT id, title, created_at FROM comics WHERE email = ? ORDER BY created_at DESC", (res['email'],))
             comics = [dict(row) for row in cur.fetchall()]
             conn.close()
             self.send_json(200, comics)
             return

        if self.path.startswith('/api/comics/get'):
             # /api/comics/get?id=123
             query = urllib.parse.urlparse(self.path).query
             params = urllib.parse.parse_qs(query)
             comic_id = params.get('id', [None])[0]
             
             if not comic_id:
                 self.send_json(400, {'error': 'Missing ID'})
                 return
                 
             conn = get_db_connection()
             cur = conn.cursor()
             cur.execute("SELECT * FROM comics WHERE id = ?", (comic_id,))
             comic = cur.fetchone()
             conn.close()
             
             if comic:
                 self.send_json(200, {
                     'id': comic['id'],
                     'title': comic['title'],
                     'data': json.loads(comic['data']),
                     'created_at': comic['created_at']
                 })
             else:
                 self.send_json(404, {'error': 'Comic not found'})
             return
            
        if self.path.startswith('/proxy'):
             # print(f"DEBUG: Proxy route matched for {self.path}")
             self.handle_proxy_get()
             return
        
        # print(f"DEBUG: Falling back to super.do_GET for {self.path}")
        super().do_GET()

    def auth_signup(self, data):
        client_ip = self.client_address[0]
        if not check_rate_limit(client_ip, limit=3, window=60):
            self.send_json(429, {'error': 'Rate limit exceeded'})
            return
        
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
             self.send_json(400, {'error': 'Missing email or password'})
             return
        
        if not validate_email(email):
             self.send_json(400, {'error': 'Invalid email format'})
             return

        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT * FROM users WHERE email = ?", (email,))
            if cur.fetchone():
                self.send_json(400, {'error': 'User already exists'})
                return
            
            role = 'admin' if email == 'gayathri5670@gmail.com' else 'user'
            salt = generate_salt()
            pw_hash = hash_password(password, salt)
            
            cur.execute("INSERT INTO users (email, password_hash, salt, role, created_at) VALUES (?, ?, ?, ?, ?)",
                        (email, pw_hash, salt, role, time.time()))
            conn.commit()
            self.send_json(201, {'status': 'success', 'message': 'User created'})
        except Exception as e:
            print(f"ERROR in auth_signup: {e}")
            import traceback
            traceback.print_exc()
            self.send_json(500, {'error': f"Server Error: {str(e)}"})
        finally:
            conn.close()

    def auth_login(self, data):
        email = data.get('email')
        password = data.get('password')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cur.fetchone()
        
        valid = False
        if user:
            stored_hash = user['password_hash']
            salt = user['salt']
            
            if salt:
                input_hash = hash_password(password, salt)
                if input_hash == stored_hash:
                    valid = True
            else:
                legacy_hash = hashlib.sha256(password.encode()).hexdigest()
                if legacy_hash == stored_hash:
                    new_salt = generate_salt()
                    new_hash = hash_password(password, new_salt)
                    cur.execute("UPDATE users SET password_hash = ?, salt = ? WHERE email = ?", (new_hash, new_salt, email))
                    conn.commit()
                    valid = True

        if valid:
            token = generate_token()
            expires = time.time() + 86400
            cur.execute("INSERT INTO tokens (token, email, type, expires_at) VALUES (?, ?, 'session', ?)",
                        (token, email, expires))
            conn.commit()
            self.send_json(200, {'status': 'success', 'token': token, 'role': user['role']})
        else:
            self.send_json(401, {'error': 'Invalid credentials'})
        conn.close()

    def auth_change_password(self, data):
        token = self.headers.get('Authorization', '').replace('Bearer ', '')
        old_pass = data.get('old_password')
        new_pass = data.get('new_password')
        
        if not old_pass or not new_pass:
            self.send_json(400, {'error': 'Missing fields'})
            return

        conn = get_db_connection()
        cur = conn.cursor()
        
        # Identify User from Token
        cur.execute("SELECT u.* FROM tokens t JOIN users u ON t.email = u.email WHERE t.token = ? AND t.expires_at > ?", (token, time.time()))
        user = cur.fetchone()
        
        if not user:
            self.send_json(401, {'error': 'Unauthorized'})
            conn.close()
            return
            
        # Verify Old Password
        stored_hash = user['password_hash']
        salt = user['salt']
        
        valid_old = False
        if salt:
            if hash_password(old_pass, salt) == stored_hash:
                valid_old = True
        else:
            # Legacy check
            if hashlib.sha256(old_pass.encode()).hexdigest() == stored_hash:
                valid_old = True
        
        if valid_old:
            # Update
            new_salt = generate_salt()
            new_hash = hash_password(new_pass, new_salt)
            cur.execute("UPDATE users SET password_hash = ?, salt = ? WHERE email = ?", (new_hash, new_salt, user['email']))
            conn.commit()
            self.send_json(200, {'status': 'success', 'message': 'Password changed successfully'})
        else:
            self.send_json(403, {'error': 'Current password incorrect'})
        
        conn.close()

    def auth_forgot(self, data):
        client_ip = self.client_address[0]
        if not check_rate_limit(client_ip, limit=5, window=300):
            self.send_json(429, {'error': 'Rate limit exceeded'})
            return

        email = data.get('email')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE email = ?", (email,))
        if cur.fetchone():
            token = generate_token()
            expires = time.time() + 300
            cur.execute("INSERT INTO tokens (token, email, type, expires_at) VALUES (?, ?, 'reset', ?)",
                        (token, email, expires))
            conn.commit()
            
            # Send Email
            send_email_token(email, token)
            
            self.send_json(200, {'status': 'success', 'message': 'Reset token sent to email'})
        else:
            self.send_json(200, {'status': 'success', 'message': 'If user exists, token sent'})
        conn.close()

    def auth_reset(self, data):
        token = data.get('token')
        new_password = data.get('password')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM tokens WHERE token = ? AND type = 'reset' AND expires_at > ?", 
                    (token, time.time()))
        record = cur.fetchone()
        
        if record:
            email = record['email']
            # New secure hash
            salt = generate_salt()
            pw_hash = hash_password(new_password, salt)
            
            cur.execute("UPDATE users SET password_hash = ?, salt = ? WHERE email = ?", 
                        (pw_hash, salt, email))
            cur.execute("DELETE FROM tokens WHERE token = ?", (token,))
            conn.commit()
            self.send_json(200, {'status': 'success', 'message': 'Password updated'})
        else:
            self.send_json(400, {'error': 'Invalid or expired token'})
        conn.close()

    def handle_save(self, data):
        try:
            filename = os.path.basename(data.get('filename'))
            file_data = data.get('data').split(',')[1] if ',' in data.get('data') else data.get('data')
            path = os.path.join('exports', filename)
            if not os.path.exists('exports'): os.makedirs('exports')
            with open(path, 'wb') as f: f.write(base64.b64decode(file_data))
            self.send_json(200, {'status': 'success', 'path': path})
        except Exception as e:
            self.send_json(500, {'error': str(e)})

    def handle_proxy_post(self):
        try:
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            target_url = params.get('url', [None])[0]
            if not target_url: return self.send_error(400)
            
            parsed_target = urllib.parse.urlparse(target_url)
            allowed = ['api-inference.huggingface.co', 'image.pollinations.ai', 'gen.pollinations.ai']
            if parsed_target.netloc not in allowed:
                return self.send_error(403)

            length = int(self.headers.get('Content-Length', 0))
            data = self.rfile.read(length)
            
            headers = {'Content-Type': 'application/json'}
            if parsed_target.netloc == 'gen.pollinations.ai':
                api_key = os.environ.get('POLLINATIONS_API_KEY')
                if api_key:
                    headers['Authorization'] = f'Bearer {api_key}'

            req = urllib.request.Request(target_url, data=data, headers=headers, method='POST')
            with urllib.request.urlopen(req) as resp:
                self.send_response(resp.status)
                self.send_header('Content-Type', resp.headers.get('Content-Type'))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(resp.read())
        except HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', e.headers.get('Content-Type', 'application/json'))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_error(500, str(e))

    def handle_deduct(self, data):
        # Verify Token
        token = self.headers.get('Authorization', '').replace('Bearer ', '')
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get User
        cur.execute("SELECT u.* FROM tokens t JOIN users u ON t.email = u.email WHERE t.token = ? AND t.type = 'session' AND t.expires_at > ?", (token, time.time()))
        user = cur.fetchone()
        
        if not user:
            self.send_json(401, {'error': 'Unauthorized'})
            conn.close()
            return

        # Admin Bypass
        if user['role'] == 'admin':
            self.send_json(200, {'status': 'success', 'remaining': 'Unlimited'})
            conn.close()
            return

        # Deduct
        if user['credits'] > 0:
            cur.execute("UPDATE users SET credits = credits - 1 WHERE email = ?", (user['email'],))
            conn.commit()
            self.send_json(200, {'status': 'success', 'remaining': user['credits'] - 1})
        else:
            self.send_json(403, {'error': 'Insufficient credits'})
        conn.close()

    def handle_create_order(self, data):
        # NO Rate Limit check here
        
        token = self.headers.get('Authorization', '').replace('Bearer ', '')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT email FROM tokens WHERE token = ? AND expires_at > ?", (token, time.time()))
        if not cur.fetchone():
            self.send_json(401, {'error': 'Unauthorized'})
            conn.close()
            return
        conn.close()

        plan_id = str(data.get('plan_id'))
        amounts = {'5': 50000, '10': 99900, '15': 180000} # In Paise
        if plan_id not in amounts:
            self.send_json(400, {'error': 'Invalid plan'})
            return
            
        amount = amounts[plan_id]
        key_id = os.environ.get('RAZORPAY_KEY_ID')
        key_secret = os.environ.get('RAZORPAY_KEY_SECRET')
        
        if not key_id or not key_secret:
            self.send_json(500, {'error': 'Server payment configuration missing'})
            return

        try:
            # Create Order via Razorpay API
            url = "https://api.razorpay.com/v1/orders"
            payload = json.dumps({
                "amount": amount,
                "currency": "INR",
                "receipt": f"rcpt_{int(time.time())}"
            }).encode('utf-8')
            
            # Basic Auth
            auth_str = base64.b64encode(f"{key_id}:{key_secret}".encode()).decode()
            
            req = urllib.request.Request(url, data=payload, method='POST')
            req.add_header('Content-Type', 'application/json')
            req.add_header('Authorization', f'Basic {auth_str}')
            
            with urllib.request.urlopen(req) as resp:
                order_data = json.loads(resp.read().decode())
                self.send_json(200, {
                    'order_id': order_data['id'],
                    'amount': amount,
                    'key_id': key_id
                })
        except Exception as e:
            print(f"Razorpay Error: {e}")
            self.send_json(500, {'error': 'Failed to create payment order'})

    def handle_verify_payment(self, data):
        # Strict Verification
        razorpay_order_id = data.get('razorpay_order_id')
        razorpay_payment_id = data.get('razorpay_payment_id')
        razorpay_signature = data.get('razorpay_signature')
        
        key_secret = os.environ.get('RAZORPAY_KEY_SECRET')
        
        if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature, key_secret]):
            self.send_json(400, {'error': 'Missing verification data'})
            return
            
        # HMAC Verification
        msg = f"{razorpay_order_id}|{razorpay_payment_id}"
        generated_signature = hmac.new(
            key_secret.encode(), 
            msg.encode(), 
            hashlib.sha256
        ).hexdigest()
        
        if generated_signature == razorpay_signature:
            # Success! Credit User.
            token = self.headers.get('Authorization', '').replace('Bearer ', '')
            conn = get_db_connection()
            cur = conn.cursor()
            
            # Find user
            cur.execute("SELECT u.email FROM tokens t JOIN users u ON t.email = u.email WHERE t.token = ? AND t.expires_at > ?", (token, time.time()))
            res = cur.fetchone()
            
            if res:
                plan_credits = int(data.get('plan_id', 0))
                cur.execute("UPDATE users SET credits = credits + ? WHERE email = ?", (plan_credits, res['email']))
                conn.commit()
                self.send_json(200, {'status': 'success', 'message': 'Payment Verified'})
            else:
                self.send_json(401, {'error': 'User not found'})
            conn.close()
        else:
            self.send_json(400, {'error': 'Invalid Signature'})

    def handle_proxy_get(self):
        try:
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            target_url = params.get('url', [None])[0]
            if not target_url: return self.send_error(400)
            
            # Expanded allow list for images
            allowed_domains = ['api-inference.huggingface.co', 'image.pollinations.ai', 'pollinations.ai', 'text.pollinations.ai', 'gen.pollinations.ai']
            parsed_target = urllib.parse.urlparse(target_url)
            domain = parsed_target.netloc
            if domain not in allowed_domains:
                return self.send_error(403)

            headers = {'User-Agent': 'Mozilla/5.0'}
            if domain == 'gen.pollinations.ai':
                api_key = os.environ.get('POLLINATIONS_API_KEY')
                if api_key:
                    headers['Authorization'] = f'Bearer {api_key}'

            req = urllib.request.Request(target_url, headers=headers, method='GET')
            with urllib.request.urlopen(req) as resp:
                self.send_response(resp.status)
                self.send_header('Content-Type', resp.headers.get('Content-Type'))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Cache-Control', 'public, max-age=31536000') # Cache images
                self.end_headers()
                self.wfile.write(resp.read())
        except HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', e.headers.get('Content-Type', 'application/json'))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_error(500, str(e))
    
    def handle_save_comic(self, data):
        token = self.headers.get('Authorization', '').replace('Bearer ', '')
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Auth Check
        cur.execute("SELECT email FROM tokens WHERE token = ? AND type = 'session' AND expires_at > ?", (token, time.time()))
        res = cur.fetchone()
        if not res:
            self.send_json(401, {'error': 'Unauthorized'})
            conn.close()
            return
        
        email = res['email']
        title = data.get('title', 'Untitled Comic')
        comic_data = json.dumps(data.get('panels', []))
        
        try:
            cur.execute("INSERT INTO comics (email, title, data, created_at) VALUES (?, ?, ?, ?)",
                        (email, title, comic_data, time.time()))
            conn.commit()
            self.send_json(201, {'status': 'success', 'message': 'Comic saved'})
        except Exception as e:
            self.send_json(500, {'error': str(e)})
        finally:
            conn.close()

    def handle_delete_comic(self, data):
        token = self.headers.get('Authorization', '').replace('Bearer ', '')
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check Auth
        cur.execute("SELECT email FROM tokens WHERE token = ? AND type = 'session' AND expires_at > ?", (token, time.time()))
        res = cur.fetchone()
        if not res:
            self.send_json(401, {'error': 'Unauthorized'})
            conn.close()
            return
        
        comic_id = data.get('id')
        cur.execute("DELETE FROM comics WHERE id = ? AND email = ?", (comic_id, res['email']))
        conn.commit()
        conn.close()
        self.send_json(200, {'status': 'success', 'message': 'Deleted'})

    def handle_local_image(self, data):
        prompt = data.get('prompt', '').strip()
        if not prompt:
            self.send_json(400, {'error': 'Missing prompt'})
            return
        try:
            image_url = local_generate_image(prompt)
            self.send_json(200, {'status': 'success', 'url': image_url})
        except Exception as e:
            self.send_json(500, {'error': str(e)})

    def handle_local_audio(self, data):
        text = data.get('text', '').strip()
        voice = data.get('voice', 'Aman').strip() or 'Aman'
        backend = data.get('backend', 'system').strip() or 'system'
        if not text:
            self.send_json(400, {'error': 'Missing text'})
            return
        try:
            if backend == 'piper':
                audio_url = local_generate_audio_piper(text, voice=voice)
            else:
                audio_url = local_generate_audio(text, voice=voice)
            self.send_json(200, {'status': 'success', 'url': audio_url})
        except Exception as e:
            self.send_json(500, {'error': str(e)})

    def handle_local_audio_upload(self, data):
        data_url = data.get('data_url', '').strip()
        filename = data.get('filename', '').strip() or 'voice-upload'
        if not data_url.startswith('data:audio/'):
            self.send_json(400, {'error': 'Missing audio data'})
            return
        try:
            header, encoded = data_url.split(',', 1)
            mime = header.split(';', 1)[0].replace('data:', '').strip().lower()
            ext = {
                'audio/mpeg': 'mp3',
                'audio/mp3': 'mp3',
                'audio/wav': 'wav',
                'audio/x-wav': 'wav',
                'audio/mp4': 'm4a',
                'audio/x-m4a': 'm4a',
                'audio/aac': 'aac',
                'audio/ogg': 'ogg',
                'audio/webm': 'webm'
            }.get(mime, Path(filename).suffix.lstrip('.').lower() or 'audio')
            exports_dir = ensure_exports_dir()
            raw_path = os.path.join(exports_dir, f'uploaded_voice_{uuid.uuid4().hex}.{ext}')
            final_path = os.path.join(exports_dir, f'uploaded_voice_{uuid.uuid4().hex}.m4a')
            with open(raw_path, 'wb') as handle:
                handle.write(base64.b64decode(encoded))

            result = subprocess.run([
                '/opt/homebrew/bin/ffmpeg', '-y', '-i', raw_path,
                '-c:a', 'aac', '-b:a', '192k', final_path
            ], check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if result.returncode != 0 or not os.path.exists(final_path):
                shutil.move(raw_path, final_path if ext == 'm4a' else raw_path)
                if ext == 'm4a':
                    output_name = os.path.basename(final_path)
                else:
                    output_name = os.path.basename(raw_path)
                self.send_json(200, {'status': 'success', 'url': f"/exports/{output_name}"})
                return

            if os.path.exists(raw_path):
                os.remove(raw_path)
            self.send_json(200, {'status': 'success', 'url': f"/exports/{os.path.basename(final_path)}"})
        except Exception as e:
            self.send_json(500, {'error': str(e)})

    def handle_local_reel(self, data):
        panels = data.get('panels', [])
        audio_url = data.get('audio_url', '').strip()
        animation_prompt = data.get('animation_prompt', '').strip() or data.get('prompt', '').strip()
        if not panels:
            self.send_json(400, {'error': 'Missing panels'})
            return
        try:
            audio_path = None
            if audio_url.startswith('/'):
                audio_path = os.path.join(os.getcwd(), audio_url.lstrip('/'))
            reel_url = local_generate_reel(panels, audio_path=audio_path, animation_prompt=animation_prompt)
            self.send_json(200, {'status': 'success', 'url': reel_url})
        except Exception as e:
            self.send_json(500, {'error': str(e)})

    def handle_local_panel_video(self, data):
        panel = data.get('panel') or {}
        animation_prompt = data.get('animation_prompt', '').strip()
        video_model = data.get('video_model', '').strip() or 'local-reel'
        if not panel or not panel.get('imageUrl'):
            self.send_json(400, {'error': 'Missing panel image'})
            return

        try:
            if video_model.startswith('veo-3.1'):
                veo_result = generate_panel_video_with_veo(data)
                if veo_result.get('url'):
                    self.send_json(200, {
                        'status': 'success',
                        'url': veo_result['url'],
                        'comfyui_folder': veo_result.get('folder', ''),
                        'motion_mode': 'veo-3.1',
                        'operation_name': veo_result.get('operation_name', '')
                    })
                    return
                self.send_json(202, {
                    'status': 'queued',
                    'comfyui_folder': veo_result.get('folder', ''),
                    'motion_mode': 'veo-3.1',
                    'operation_name': veo_result.get('operation_name', '')
                })
                return

            wan_result = generate_panel_video_with_wan(data)
            if wan_result.get('url'):
                self.send_json(200, {
                    'status': 'success',
                    'url': wan_result['url'],
                    'comfyui_folder': wan_result.get('folder', ''),
                    'motion_mode': 'wan-i2v',
                    'workflow': wan_result.get('workflow', '')
                })
                return

            fallback_audio_path = None
            try:
                fallback_audio_text = _build_panel_audio_text(data, panel)
                if fallback_audio_text:
                    fallback_audio_url = local_generate_audio(fallback_audio_text, voice='Aman')
                    fallback_audio_path = _resolve_local_asset_path(fallback_audio_url)
            except Exception:
                fallback_audio_path = None

            clip_url = local_generate_reel(
                [panel],
                audio_path=fallback_audio_path,
                animation_prompt=animation_prompt or panel.get('text', '')
            )
            comfyui_folder = wan_result.get('folder', '')
            try:
                if not comfyui_folder:
                    comfyui_folder = export_panel_to_comfyui({
                        'panel': {
                            'id': panel.get('id'),
                            'text': panel.get('text', ''),
                            'imageUrl': panel.get('imageUrl', ''),
                            'visualPrompt': panel.get('visualPrompt', ''),
                            'animationPrompt': animation_prompt or panel.get('animationPrompt', '')
                        },
                        'project': data.get('project') or {}
                    })
            except Exception:
                comfyui_folder = ''

            self.send_json(200, {
                'status': 'success',
                'url': clip_url,
                'comfyui_folder': comfyui_folder,
                'motion_mode': 'preview-fallback',
                'workflow': wan_result.get('workflow', '')
            })
        except Exception as e:
            self.send_json(500, {'error': str(e)})

    def handle_integration_package(self, data):
        try:
            package_url, package_filename = create_integration_package(data)
            self.send_json(200, {
                'status': 'success',
                'url': package_url,
                'filename': package_filename
            })
        except Exception as e:
            self.send_json(500, {'error': str(e)})

    def handle_comfyui_panel_export(self, data):
        try:
            folder = export_panel_to_comfyui(data)
            self.send_json(200, {
                'status': 'success',
                'folder': folder
            })
        except Exception as e:
            self.send_json(500, {'error': str(e)})

    def handle_ollama_generate(self, data):
        prompt = data.get('prompt', '').strip()
        model = data.get('model', 'qwen3:8b').strip() or 'qwen3:8b'
        if not prompt:
            self.send_json(400, {'error': 'Missing prompt'})
            return

        try:
            payload = json.dumps({
                'model': model,
                'prompt': prompt,
                'stream': False
            }).encode('utf-8')
            req = urllib.request.Request(
                'http://127.0.0.1:11434/api/generate',
                data=payload,
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                body = json.loads(resp.read().decode('utf-8'))
                self.send_json(200, {
                    'status': 'success',
                    'response': body.get('response', '')
                })
        except HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', e.headers.get('Content-Type', 'application/json'))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_json(500, {'error': str(e)})


with ReusableTCPServer(("", PORT), MyRequestHandler) as httpd:
    print(f"Serving Auth Server at port {PORT}")
    httpd.serve_forever()
