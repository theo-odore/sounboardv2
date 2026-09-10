# 🎵 Self-Hosted Meme Soundboard

A modern, fast, self-hosted meme soundboard. Upload tracks, play meme sounds instantly, trim audio directly in the browser with Web Audio API, and host everything on your own server with zero external cloud dependencies or inactivity pauses!

## ✨ Features
*   🎹 **Instant Playback** – Zero latency native HTML5 Audio.
*   💾 **100% Self-Hosted** – Runs on your own Node.js server. No Supabase pausing or third-party limits.
*   ✂️ **Native Audio Trimming** – Interactive waveform scrubber; crop audio length in-browser via Web Audio `OfflineAudioContext` *before* uploading to save storage.
*   🎬 **Video & Audio Support** – Drag and drop `.mp4`, `.mov`, `.mp3`, `.wav`, `.m4a`, or `.webm` directly into the drop zone.
*   🛡️ **Admin Protection** – Built-in secret admin key for sound deletion (5 clicks on title).
*   🎨 **Premium UI** – 3D glossy Discord-style buttons, glassmorphic modals, and reactive hover animations.

## 🛠️ Tech Stack
*   **Frontend**: HTML5, Vanilla JavaScript, CSS3.
*   **Audio Engine**: Web Audio API (`AudioContext`, `OfflineAudioContext`, dynamic PCM to WAV encoder).
*   **Backend**: Node.js & Express.
*   **File Uploads**: `multer` storing files directly in `uploads/`.
*   **Database**: Persistent file storage in `data/sounds.json`.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
Copy `.env.example` to `.env` or customize:
```env
PORT=3000
ADMIN_KEY=your_secret_admin_key
```

### 3. Start the Server

**Direct Node.js:**
```bash
npm start
```

**Or via Docker Compose:**
```bash
docker compose up -d
```

Visit:
```text
http://localhost:3000
```

---

## 🛡️ Admin Mode (Sound Deletion)
To prevent accidental or unauthorized sound deletion:
1. Click the **Soundboard** title header **5 times within 1 second**.
2. Enter your `ADMIN_KEY` when prompted.
3. The **Admin Mode Active** badge will appear and delete trash icons will unlock on all sound buttons.
4. Clicking the header 5 times again exits Admin Mode.

---

## 🔄 Supabase Migration
If you have an existing Supabase project with sounds you want to import:
```bash
npm run migrate:supabase
```
This automatically downloads all sound files into `uploads/` and migrates records into `data/sounds.json`.
