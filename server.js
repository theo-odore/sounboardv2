require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Secure frontend config endpoint
app.get('/api/config', (req, res) => {
    res.json({
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_KEY: process.env.SUPABASE_KEY
    });
});

// Supabase Setup
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Verify Admin Key endpoint
app.post('/api/verify-admin', (req, res) => {
    const { key } = req.body;
    if (key === process.env.ADMIN_KEY) {
        res.json({ valid: true });
    } else {
        res.status(401).json({ valid: false });
    }
});

// Delete endpoint
app.delete('/api/sounds/:id', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    const soundId = req.params.id;
    const { src } = req.body;

    // Verify admin key
    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid Admin Key' });
    }

    try {
        // Delete from Storage if it's a media file
        if (src && src.includes('sounds-media')) {
            const fileName = src.split('/').pop();
            const { error: storageError } = await supabase.storage.from('sounds-media').remove([fileName]);
            if (storageError) {
                console.error("Storage delete error:", storageError);
            }
        }

        // Delete from DB
        const { error: dbError } = await supabase.from('sounds').delete().eq('id', soundId);
        
        if (dbError) {
            console.error("DB delete error:", dbError);
            return res.status(500).json({ error: 'Failed to delete from database' });
        }

        res.status(200).json({ message: 'Sound deleted successfully' });
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
