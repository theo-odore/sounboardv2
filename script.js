// Supabase credentials
const SUPABASE_URL = 'https://eqxznsjaptwhvrdwfgdn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JTtyi4PJxhQ5jplxujhFog_qMY-krrN';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentAudio = null;
let currentButtonInfo = null;

const colors = ['color-red', 'color-purple', 'color-blue', 'color-green', 'color-orange'];

const defaultSounds = [
    { name: 'Vine Boom', src: 'https://www.myinstants.com/media/sounds/vine-boom.mp3', color: 'color-red' },
    { name: 'Bruh', src: 'https://www.myinstants.com/media/sounds/movie_1.mp3', color: 'color-purple' },
    { name: 'Fart', src: 'https://www.myinstants.com/media/sounds/fart-with-reverb.mp3', color: 'color-orange' },
    { name: 'Among Us', src: 'https://www.myinstants.com/media/sounds/among-us-role-reveal-sound.mp3', color: 'color-blue' }
];

// DOM Elements
const grid = document.getElementById('soundboard-grid');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const loadingIndicator = document.getElementById('loading-indicator');
const template = document.getElementById('sound-item-template');

// Modal Elements
const uploadModal = document.getElementById('upload-modal');
const soundTitleInput = document.getElementById('sound-title');
const startTimeInput = document.getElementById('start-time');
const endTimeInput = document.getElementById('end-time');
const cancelUploadBtn = document.getElementById('cancel-upload');
const confirmUploadBtn = document.getElementById('confirm-upload');

let pendingUploadFile = null;

async function initUI() {
    try {
        const { data: sounds, error } = await supabase.from('sounds').select('*');
        if (error) throw error;
        
        grid.innerHTML = ''; // Clear existing
        if (sounds && sounds.length > 0) {
            sounds.forEach(s => renderSoundItem(s));
        } else {
            // Seed defaults if empty
            const { data: inserted } = await supabase.from('sounds').insert(defaultSounds).select();
            if (inserted) inserted.forEach(s => renderSoundItem(s));
        }
    } catch (e) {
        console.error('Failed to load sounds SDK:', e);
    }
}

function renderSoundItem(sound) {
    const clone = template.content.cloneNode(true);
    const itemContainer = clone.querySelector('.sound-item');
    const button = clone.querySelector('.sound-button');
    const nameLabel = clone.querySelector('.sound-name');
    
    nameLabel.textContent = sound.name;
    nameLabel.title = sound.name;
    
    button.classList.add(sound.color);

    // Audio Object uses the URL provided by the backend (or the standard http link for defaults)
    const audioObj = new Audio(sound.src);

    // Play behavior
    button.addEventListener('click', () => {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            if (currentButtonInfo) currentButtonInfo.classList.remove('playing');
        }

        currentAudio = audioObj;
        currentButtonInfo = button;
        
        button.classList.add('playing');
        audioObj.play().catch(e => console.error("Playback failed:", e));

        audioObj.onended = () => {
            button.classList.remove('playing');
            if (currentAudio === audioObj) {
                currentAudio = null;
                currentButtonInfo = null;
            }
        };
    });

    // Actions
    const deleteBtn = clone.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async () => {
        if (confirm(`Remove "${sound.name}" globally?`)) {
            // Stop audio if playing
            if (currentAudio === audioObj) {
                currentAudio.pause();
                currentAudio = null;
                currentButtonInfo = null;
            }
            
            // Remove from server
            try {
                if (sound.src.includes('sounds-media')) {
                    const fileName = sound.src.split('/').pop();
                    await supabase.storage.from('sounds-media').remove([fileName]);
                }
                const { error } = await supabase.from('sounds').delete().eq('id', sound.id);
                if (!error) {
                    itemContainer.remove();
                } else {
                    alert('Failed to delete sound from Supabase.');
                }
            } catch(e) {
                console.error("Failed to delete", e);
                alert('An error occurred.');
            }
        }
    });

    grid.appendChild(clone);
}

// Upload Handling
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
        handleFile(fileInput.files[0]);
    }
});

async function handleFile(file) {
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    
    if (!isVideo && !isAudio) {
        alert('Unsupported file type.');
        return;
    }

    pendingUploadFile = file;

    // Reset and show modal
    soundTitleInput.value = file.name.replace(/\.[^/.]+$/, "");
    startTimeInput.value = "";
    endTimeInput.value = "";
    uploadModal.classList.remove('hidden');
}

cancelUploadBtn.addEventListener('click', () => {
    uploadModal.classList.add('hidden');
    pendingUploadFile = null;
    fileInput.value = ""; // reset
});

confirmUploadBtn.addEventListener('click', async () => {
    if (!pendingUploadFile) return;

    const file = pendingUploadFile;
    const name = soundTitleInput.value.trim() || 'Untitled Sound';
    const startSec = parseFloat(startTimeInput.value);
    const endSec = parseFloat(endTimeInput.value);

    uploadModal.classList.add('hidden');
    showLoading(true);

    try {
        let finalBlob = file;

        // If trim is requested
        if (!isNaN(startSec) || !isNaN(endSec)) {
            finalBlob = await trimAudio(file, startSec || 0, endSec || Infinity);
        }

        const color = colors[Math.floor(Math.random() * colors.length)];
        // Ensure new trimmed files use .wav or original extension if full length
        const fileExt = finalBlob !== file ? 'wav' : file.name.split('.').pop();
        const fileName = `${Date.now()}_${name.replace(/[^a-zA-Z0-9.-]/g, '_')}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage.from('sounds-media').upload(fileName, finalBlob);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('sounds-media').getPublicUrl(fileName);

        const newSound = {
            name,
            color,
            src: urlData.publicUrl
        };

        const { data: inserted, error: insertError } = await supabase.from('sounds').insert([newSound]).select();
        
        if (insertError) throw insertError;

        if (inserted && inserted.length > 0) {
            renderSoundItem(inserted[0]);
            
            // Visual feedback
            dropZone.style.borderColor = 'var(--accent-red-light)';
            setTimeout(() => dropZone.style.borderColor = '', 1000);
        }
    } catch (err) {
        console.error("Error saving sound", err);
        alert('Could not upload to server.');
    } finally {
        showLoading(false);
        pendingUploadFile = null;
        fileInput.value = "";
    }
});

function showLoading(show) {
    if (show) {
        loadingIndicator.classList.remove('hidden');
        dropZone.style.display = 'none';
    } else {
        loadingIndicator.classList.add('hidden');
        dropZone.style.display = 'flex';
    }
}

// Utility to trim audio using Web Audio API
async function trimAudio(file, startSec, endSec) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const actualStart = Math.max(0, startSec);
    const actualEnd = Math.min(audioBuffer.duration, endSec);
    
    if (actualStart >= actualEnd) {
        throw new Error("Invalid trim times.");
    }

    const duration = actualEnd - actualStart;
    
    // Create an offline context for the trimmed duration
    const offlineCtx = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioContext.sampleRate * duration,
        audioContext.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    
    // Start playback offset by actualStart, for the length of duration
    source.start(0, actualStart, duration);
    
    // Render
    const renderedBuffer = await offlineCtx.startRendering();

    // Convert AudioBuffer back to a Blob using WAV encoding manually
    return audioBufferToWavBlob(renderedBuffer);
}

// Convert AudioBuffer to WAV Blob
function audioBufferToWavBlob(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    const channels = [];
    let sample;
    let offset = 0;
    let pos = 0;

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this export)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // write interleaved data
    for (let i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
        for (let i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
            view.setInt16(pos, sample, true); // write 16-bit sample
            pos += 2;
        }
        offset++;
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}

// Run on load
document.addEventListener('DOMContentLoaded', initUI);
