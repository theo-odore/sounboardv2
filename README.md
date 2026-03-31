# 🎵 Serverless Soundboard

A modern, fast, and globally synchronized meme soundboard. Upload tracks, play meme sounds instantly, and share the exact same board with everyone around the world powered natively by JavaScript and **Supabase**! 

## ✨ Features
*   🎹 **Instant Playback** – Zero latency native HTML Audio.
*   ☁️ **Globally Synced** – Live database pulling everyone's uploaded sounds in real-time.
*   ✂️ **Native Audio Trimming** – Crop audio length natively in the browser via Web Audio API *before* uploading to save storage!
*   🎬 **Video & Audio Support** – Drop any `.mp4`, `.mov`, `.mp3`, or `.wav` directly into the drop zone.
*   🗑️ **Global Deletion** – Anyone can instantly delete a soundboard track to keep it clean.
*   🎨 **Premium UI** – 3D glossy Discord-style buttons, smooth glassmorphic modals, and reactive hover animations.

## 🛠️ Tech Stack
*   **Frontend**: HTML5, Vanilla JavaScript, Custom CSS.
*   **Audio Engine**: Web Audio `OfflineAudioContext` for native browser media cropping.
*   **Backend / Database**: Supabase (PostgreSQL).
*   **Storage**: Supabase Storage Buckets.
*   **Hosting**: GitHub Pages (100% Serverless).

## 🚀 How It Works
Because this application is 100% serverless, there is **no running server code**. 
1. The frontend (`index.html`) serves a static UI grid. 
2. `script.js` uses `@supabase/supabase-js` to directly execute an asynchronous `select` query to a public PostgreSQL table named `sounds`.
3. When a user uploads a new sound, it is cropped in the browser and passed directly to the `sounds-media` Supabase Storage bucket. 
4. The return URL is instantly inserted as a new row in the `sounds` table, ready for the next person who opens the site!

---

## 💻 Local Developement
Since there is no Node.js backend required, you can run this instantly on any machine using a static server.

1. Clone the repository:
```bash
git clone https://github.com/theo-odore/sounboard.git
cd sounboard
```

2. Run a local static server:
```bash
npx serve -l 3000
```

3. Open your browser:
```text
http://localhost:3000
```

## 🗄️ Supabase Configuration Checklist
If you are deploying this yourself on a new Supabase instance, you must configure your cloud environment exactly as follows:

1. Create a table named `sounds` with the following columns:
   * `id` (uuid)
   * `name` (text)
   * `color` (text)
   * `src` (text)
   * `created_at` (timestamp)
2. Disable Row Level Security (RLS) on the `sounds` table (or write specific open policies).
3. Create a Storage Bucket named `sounds-media` and set its privacy to **Public**.
4. Disable RLS on the `sounds-media` bucket (or write specific open policies) to allow public uploads and deletions.
