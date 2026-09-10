// migrate-from-supabase.js
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://eqxznsjaptwhvrdwfgdn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JTtyi4PJxhQ5jplxujhFog_qMY-krrN';

const uploadsDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

async function migrate() {
  console.log('Fetching sound records from Supabase...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sounds?select=*`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch sounds: ${res.status} ${res.statusText}`);
  }

  const sounds = await res.json();
  console.log(`Found ${sounds.length} sounds in Supabase.`);

  const migratedSounds = [];

  for (let i = 0; i < sounds.length; i++) {
    const sound = sounds[i];
    console.log(`[${i + 1}/${sounds.length}] Processing "${sound.name}"...`);

    if (sound.src && sound.src.includes('sounds-media')) {
      try {
        const originalFileName = sound.src.split('/').pop().split('?')[0];
        const localFilePath = path.join(uploadsDir, originalFileName);

        // Download the audio file
        console.log(`  Downloading audio file ${originalFileName}...`);
        const fileRes = await fetch(sound.src);
        if (!fileRes.ok) {
          console.error(`  Warning: Failed to download audio (${fileRes.status}). Keeping remote src.`);
          migratedSounds.push(sound);
          continue;
        }

        const arrayBuffer = await fileRes.arrayBuffer();
        fs.writeFileSync(localFilePath, Buffer.from(arrayBuffer));
        console.log(`  Saved to uploads/${originalFileName} (${(arrayBuffer.byteLength / 1024).toFixed(1)} KB)`);

        migratedSounds.push({
          id: sound.id,
          name: sound.name,
          color: sound.color,
          src: `/uploads/${originalFileName}`,
          created_at: sound.created_at || new Date().toISOString()
        });
      } catch (err) {
        console.error(`  Error downloading "${sound.name}":`, err.message);
        migratedSounds.push(sound);
      }
    } else {
      // Remote URL or default sound
      migratedSounds.push(sound);
    }
  }

  const soundsJsonPath = path.join(dataDir, 'sounds.json');
  fs.writeFileSync(soundsJsonPath, JSON.stringify(migratedSounds, null, 2), 'utf-8');
  console.log(`\nMigration complete! Saved ${migratedSounds.length} sounds to data/sounds.json.`);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
