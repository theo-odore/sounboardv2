require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';

// Storage directories
const uploadsDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');
const soundsJsonPath = path.join(dataDir, 'sounds.json');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Seed default sounds if database file does not exist
const defaultSounds = [
    { id: crypto.randomUUID(), name: 'Vine Boom', src: 'https://www.myinstants.com/media/sounds/vine-boom.mp3', color: 'color-red', created_at: new Date().toISOString() },
    { id: crypto.randomUUID(), name: 'Bruh', src: 'https://www.myinstants.com/media/sounds/movie_1.mp3', color: 'color-purple', created_at: new Date().toISOString() },
    { id: crypto.randomUUID(), name: 'Fart', src: 'https://www.myinstants.com/media/sounds/fart-with-reverb.mp3', color: 'color-orange', created_at: new Date().toISOString() },
    { id: crypto.randomUUID(), name: 'Among Us', src: 'https://www.myinstants.com/media/sounds/among-us-role-reveal-sound.mp3', color: 'color-blue', created_at: new Date().toISOString() }
];

function getSounds() {
    if (!fs.existsSync(soundsJsonPath)) {
        fs.writeFileSync(soundsJsonPath, JSON.stringify(defaultSounds, null, 2), 'utf-8');
        return defaultSounds;
    }
    try {
        const data = fs.readFileSync(soundsJsonPath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Error reading sounds.json:', e);
        return [];
    }
}

function saveSounds(sounds) {
    const tempPath = `${soundsJsonPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(sounds, null, 2), 'utf-8');
    fs.renameSync(tempPath, soundsJsonPath);
}

// Multer storage configuration for audio file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.wav';
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${Date.now()}_${base}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB max file size
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded audio files
app.use('/uploads', express.static(uploadsDir));

// GET /api/sounds — List all sounds
app.get('/api/sounds', (req, res) => {
    const sounds = getSounds();
    res.json(sounds);
});

// POST /api/sounds — Upload a new sound track
app.post('/api/sounds', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided.' });
        }

        const name = (req.body.name || path.basename(req.file.originalname, path.extname(req.file.originalname))).trim() || 'Untitled Sound';
        const color = req.body.color || 'color-red';
        const src = `/uploads/${req.file.filename}`;

        const newSound = {
            id: crypto.randomUUID(),
            name,
            color,
            src,
            created_at: new Date().toISOString()
        };

        const sounds = getSounds();
        sounds.push(newSound);
        saveSounds(sounds);

        res.status(201).json(newSound);
    } catch (err) {
        console.error('Error saving sound:', err);
        res.status(500).json({ error: 'Internal server error while saving sound.' });
    }
});

// POST /api/verify-admin — Check admin credentials
app.post('/api/verify-admin', (req, res) => {
    const { key } = req.body;
    if (key === ADMIN_KEY) {
        res.json({ valid: true });
    } else {
        res.status(401).json({ valid: false });
    }
});

// DELETE /api/sounds/:id — Delete a sound
app.delete('/api/sounds/:id', (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    const soundId = req.params.id;

    if (adminKey !== ADMIN_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid Admin Key' });
    }

    try {
        const sounds = getSounds();
        const soundIndex = sounds.findIndex(s => s.id === soundId);

        if (soundIndex === -1) {
            return res.status(404).json({ error: 'Sound not found' });
        }

        const [sound] = sounds.splice(soundIndex, 1);

        // If file is stored in local uploads directory, remove it from disk
        if (sound.src && sound.src.startsWith('/uploads/')) {
            const fileName = path.basename(sound.src);
            const filePath = path.join(uploadsDir, fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        saveSounds(sounds);
        res.status(200).json({ message: 'Sound deleted successfully' });
    } catch (error) {
        console.error('Server error deleting sound:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
