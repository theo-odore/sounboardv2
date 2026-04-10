// Supabase client (credentials loaded dynamically from backend)
let supabaseClient = null;

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

// Upload Modal Elements
const uploadModal = document.getElementById('upload-modal');
const soundTitleInput = document.getElementById('sound-title');
const cancelUploadBtn = document.getElementById('cancel-upload');
const confirmUploadBtn = document.getElementById('confirm-upload');
const trimSummary = document.getElementById('trim-summary');
const trimSummaryText = document.getElementById('trim-summary-text');
const editTrimBtn = document.getElementById('edit-trim-btn');

// Trim Modal Elements
const trimModal = document.getElementById('trim-modal');
const waveformCanvas = document.getElementById('waveform-canvas');
const trimRegion = document.getElementById('trim-region');
const handleStart = document.getElementById('handle-start');
const handleEnd = document.getElementById('handle-end');
const playhead = document.getElementById('playhead');
const trimStartDisplay = document.getElementById('trim-start-display');
const trimEndDisplay = document.getElementById('trim-end-display');
const trimDurationDisplay = document.getElementById('trim-duration-display');
const trimPlayBtn = document.getElementById('trim-play-btn');
const trimPlayIcon = document.getElementById('trim-play-icon');
const trimPlayLabel = document.getElementById('trim-play-label');
const trimCancelBtn = document.getElementById('trim-cancel');
const trimResetBtn = document.getElementById('trim-reset');
const trimConfirmBtn = document.getElementById('trim-confirm');

// Trim state
let pendingUploadFile = null;
let trimAudioBuffer = null;   // decoded AudioBuffer for drawing waveform
let trimDuration = 0;         // total duration in seconds
let trimStartRatio = 0;       // 0..1
let trimEndRatio = 1;         // 0..1
let trimPreviewSource = null; // AudioBufferSourceNode for preview
let trimPreviewCtx = null;    // AudioContext for preview
let trimPlayheadInterval = null;
let trimIsPlaying = false;

// ─── Init ───────────────────────────────────────────────────────────────────

let titleClickCount = 0;
let titleClickTimer = null;

function setAdminMode(isActive) {
    const badge = document.getElementById('admin-badge');
    if (isActive) {
        document.body.classList.add('admin-mode');
        if (badge) badge.classList.remove('hidden');
    } else {
        document.body.classList.remove('admin-mode');
        if (badge) badge.classList.add('hidden');
    }
}

async function initUI() {
    // Check initial admin state
    if (localStorage.getItem('adminKey')) {
        setAdminMode(true);
    }

    // Title click listener for Admin Mode
    const titleEl = document.querySelector('.title');
    if (titleEl) {
        titleEl.addEventListener('click', () => {
            titleClickCount++;
            clearTimeout(titleClickTimer);
            
            if (titleClickCount >= 5) {
                titleClickCount = 0;
                
                // If already in admin mode, turn it off without prompting
                if (document.body.classList.contains('admin-mode')) {
                    localStorage.removeItem('adminKey');
                    setAdminMode(false);
                    return;
                }

                const key = prompt('Enter Admin Key:');
                if (key) {
                    // Verify key with server before activating
                    fetch('/api/verify-admin', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.valid) {
                            localStorage.setItem('adminKey', key);
                            setAdminMode(true);
                        } else {
                            alert('Incorrect Admin Key');
                        }
                    })
                    .catch(e => {
                        console.error('Error verifying admin key:', e);
                        alert('Error verifying admin key with server.');
                    });
                }
            } else {
                titleClickTimer = setTimeout(() => {
                    titleClickCount = 0;
                }, 1000);
            }
        });
    }

    try {
        // Securely load Supabase config from Node server
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

        const { data: sounds, error } = await supabaseClient.from('sounds').select('*');
        if (error) throw error;

        grid.innerHTML = '';
        if (sounds && sounds.length > 0) {
            sounds.forEach(s => renderSoundItem(s));
        } else {
            const { data: inserted } = await supabaseClient.from('sounds').insert(defaultSounds).select();
            if (inserted) inserted.forEach(s => renderSoundItem(s));
        }
    } catch (e) {
        console.error('Failed to load sounds:', e);
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

    const audioObj = new Audio(sound.src);

    button.addEventListener('click', () => {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            if (currentButtonInfo) currentButtonInfo.classList.remove('playing');
        }
        currentAudio = audioObj;
        currentButtonInfo = button;
        button.classList.add('playing');
        audioObj.play().catch(e => console.error('Playback failed:', e));
        audioObj.onended = () => {
            button.classList.remove('playing');
            if (currentAudio === audioObj) { currentAudio = null; currentButtonInfo = null; }
        };
    });

    const deleteBtn = clone.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async () => {
        if (confirm(`Remove "${sound.name}" globally?`)) {
            if (currentAudio === audioObj) {
                currentAudio.pause();
                currentAudio = null;
                currentButtonInfo = null;
            }
            // Remove from server via our secure backend
            try {
                const adminKey = localStorage.getItem('adminKey') || '';
                const response = await fetch(`/api/sounds/${sound.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-key': adminKey
                    },
                    body: JSON.stringify({ src: sound.src })
                });

                if (response.ok) {
                    itemContainer.remove();
                } else {
                    const data = await response.json().catch(() => ({}));
                    alert(`Failed to delete: ${data.error || 'Unauthorized'}`);
                    if (response.status === 401) {
                        localStorage.removeItem('adminKey');
                        setAdminMode(false);
                    }
                }
            } catch(e) {
                console.error("Failed to delete", e);
                alert('An error occurred.');
            }
        }
    });

    grid.appendChild(clone);
}

// ─── Upload handling ─────────────────────────────────────────────────────────

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
});

async function handleFile(file) {
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    if (!isVideo && !isAudio) { alert('Unsupported file type.'); return; }

    pendingUploadFile = file;
    await openTrimModal(file);
}

// ─── Trim Modal ───────────────────────────────────────────────────────────────

async function openTrimModal(file) {
    // Reset state
    trimStartRatio = 0;
    trimEndRatio = 1;
    stopTrimPreview();

    trimModal.classList.remove('hidden');

    // Decode audio for waveform
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        trimAudioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        trimDuration = trimAudioBuffer.duration;
        await audioCtx.close();
    } catch (e) {
        console.error('Failed to decode audio for waveform:', e);
        trimAudioBuffer = null;
        trimDuration = 0;
    }

    // Draw waveform after layout is established
    requestAnimationFrame(() => {
        drawWaveform();
        updateTrimRegionUI();
        updateTimeDisplays();
    });
}

function closeTrimModal() {
    stopTrimPreview();
    trimModal.classList.add('hidden');
    trimAudioBuffer = null;
}

// ─── Waveform drawing ─────────────────────────────────────────────────────────

function drawWaveform() {
    const canvas = waveformCanvas;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height || 110;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    if (!trimAudioBuffer) {
        // Placeholder bars when no audio
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        const barW = 3, gap = 2, totalBars = Math.floor(W / (barW + gap));
        for (let i = 0; i < totalBars; i++) {
            const h = 20 + Math.random() * (H - 40);
            ctx.fillRect(i * (barW + gap), (H - h) / 2, barW, h);
        }
        return;
    }

    // Get channel data (mix down to mono for display)
    const rawData = trimAudioBuffer.getChannelData(0);
    const barW = 2, gap = 1;
    const totalBars = Math.floor(W / (barW + gap));
    const samplesPerBar = Math.floor(rawData.length / totalBars);

    for (let i = 0; i < totalBars; i++) {
        let max = 0;
        const start = i * samplesPerBar;
        for (let j = 0; j < samplesPerBar; j++) {
            const v = Math.abs(rawData[start + j] || 0);
            if (v > max) max = v;
        }
        const barH = Math.max(2, max * (H - 8));
        const x = i * (barW + gap);
        const y = (H - barH) / 2;

        // Color: inside trim region = vivid red, outside = dim
        const ratio = i / totalBars;
        if (ratio >= trimStartRatio && ratio <= trimEndRatio) {
            // Gradient feel for active region
            const intensity = 0.5 + max * 0.5;
            ctx.fillStyle = `rgba(239, 68, 68, ${intensity})`;
        } else {
            ctx.fillStyle = `rgba(148, 163, 184, 0.25)`;
        }
        ctx.fillRect(x, y, barW, barH);
    }
}

// ─── Trim region UI (handles + fill) ────────────────────────────────────────

function updateTrimRegionUI() {
    const containerW = waveformCanvas.parentElement.getBoundingClientRect().width;
    const startPx = trimStartRatio * containerW;
    const endPx = trimEndRatio * containerW;

    trimRegion.style.left = startPx + 'px';
    trimRegion.style.width = (endPx - startPx) + 'px';
}

function updateTimeDisplays() {
    const startSec = trimStartRatio * trimDuration;
    const endSec = trimEndRatio * trimDuration;
    const dur = endSec - startSec;
    trimStartDisplay.textContent = startSec.toFixed(2) + 's';
    trimEndDisplay.textContent = endSec.toFixed(2) + 's';
    trimDurationDisplay.textContent = dur.toFixed(2) + 's';
}

// ─── Drag handles ────────────────────────────────────────────────────────────

function setupHandleDrag(handleEl, isStart) {
    let dragging = false;

    function getContainerRect() {
        return waveformCanvas.parentElement.getBoundingClientRect();
    }

    function onPointerDown(e) {
        dragging = true;
        handleEl.classList.add('dragging');
        stopTrimPreview();
        e.preventDefault();
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }

    function onPointerMove(e) {
        if (!dragging) return;
        const rect = getContainerRect();
        let ratio = (e.clientX - rect.left) / rect.width;
        ratio = Math.max(0, Math.min(1, ratio));
        const MIN_GAP = 0.01; // at least 1% separation

        if (isStart) {
            trimStartRatio = Math.min(ratio, trimEndRatio - MIN_GAP);
        } else {
            trimEndRatio = Math.max(ratio, trimStartRatio + MIN_GAP);
        }
        updateTrimRegionUI();
        updateTimeDisplays();
        drawWaveform();
    }

    function onPointerUp() {
        dragging = false;
        handleEl.classList.remove('dragging');
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
    }

    handleEl.addEventListener('pointerdown', onPointerDown);
}

setupHandleDrag(handleStart, true);
setupHandleDrag(handleEnd, false);

// Click on waveform container to set start point
waveformCanvas.parentElement.addEventListener('click', (e) => {
    // Ignore if click is on a handle
    if (e.target.closest('.trim-handle')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    // Click sets start, keep end where it is
    const MIN_GAP = 0.01;
    if (ratio < trimEndRatio - MIN_GAP) {
        trimStartRatio = ratio;
        updateTrimRegionUI();
        updateTimeDisplays();
        drawWaveform();
    }
});

// ─── Trim preview playback ────────────────────────────────────────────────────

async function startTrimPreview() {
    if (!trimAudioBuffer) return;
    stopTrimPreview();

    trimIsPlaying = true;
    trimPlayBtn.classList.add('playing');
    trimPlayIcon.textContent = '■';
    trimPlayLabel.textContent = 'Stop Preview';
    playhead.classList.remove('hidden');

    const startSec = trimStartRatio * trimDuration;
    const endSec = trimEndRatio * trimDuration;
    const duration = endSec - startSec;

    trimPreviewCtx = new (window.AudioContext || window.webkitAudioContext)();
    trimPreviewSource = trimPreviewCtx.createBufferSource();
    trimPreviewSource.buffer = trimAudioBuffer;
    trimPreviewSource.connect(trimPreviewCtx.destination);

    const startTime = trimPreviewCtx.currentTime;
    trimPreviewSource.start(0, startSec, duration);

    // Animate playhead
    const containerEl = waveformCanvas.parentElement;
    clearInterval(trimPlayheadInterval);
    trimPlayheadInterval = setInterval(() => {
        const elapsed = trimPreviewCtx.currentTime - startTime;
        const ratio = trimStartRatio + (elapsed / trimDuration);
        const W = containerEl.getBoundingClientRect().width;
        playhead.style.left = (ratio * W) + 'px';

        if (elapsed >= duration) {
            stopTrimPreview();
        }
    }, 50);

    trimPreviewSource.onended = () => {
        if (trimIsPlaying) stopTrimPreview();
    };
}

function stopTrimPreview() {
    trimIsPlaying = false;
    clearInterval(trimPlayheadInterval);
    playhead.classList.add('hidden');

    if (trimPreviewSource) {
        try { trimPreviewSource.stop(); } catch (_) {}
        trimPreviewSource = null;
    }
    if (trimPreviewCtx) {
        trimPreviewCtx.close().catch(() => {});
        trimPreviewCtx = null;
    }

    trimPlayBtn.classList.remove('playing');
    trimPlayIcon.textContent = '▶';
    trimPlayLabel.textContent = 'Preview Selection';
}

trimPlayBtn.addEventListener('click', () => {
    if (trimIsPlaying) stopTrimPreview();
    else startTrimPreview();
});

// ─── Trim modal buttons ───────────────────────────────────────────────────────

trimCancelBtn.addEventListener('click', () => {
    closeTrimModal();
    pendingUploadFile = null;
    fileInput.value = '';
});

trimResetBtn.addEventListener('click', () => {
    trimStartRatio = 0;
    trimEndRatio = 1;
    stopTrimPreview();
    updateTrimRegionUI();
    updateTimeDisplays();
    drawWaveform();
});

trimConfirmBtn.addEventListener('click', () => {
    closeTrimModal();
    openUploadModal();
});

// ─── Upload Modal ─────────────────────────────────────────────────────────────

function openUploadModal() {
    const file = pendingUploadFile;
    soundTitleInput.value = file.name.replace(/\.[^/.]+$/, '');

    const isTrimmed = trimStartRatio > 0.001 || trimEndRatio < 0.999;
    if (isTrimmed && trimDuration > 0) {
        const startSec = (trimStartRatio * trimDuration).toFixed(2);
        const endSec = (trimEndRatio * trimDuration).toFixed(2);
        trimSummaryText.textContent = `Trimmed: ${startSec}s – ${endSec}s`;
        trimSummary.classList.remove('hidden');
    } else {
        trimSummary.classList.add('hidden');
    }

    uploadModal.classList.remove('hidden');
}

editTrimBtn.addEventListener('click', () => {
    uploadModal.classList.add('hidden');
    openTrimModal(pendingUploadFile);
});

cancelUploadBtn.addEventListener('click', () => {
    uploadModal.classList.add('hidden');
    pendingUploadFile = null;
    fileInput.value = '';
    trimSummary.classList.add('hidden');
});

confirmUploadBtn.addEventListener('click', async () => {
    if (!pendingUploadFile) return;

    const file = pendingUploadFile;
    const name = soundTitleInput.value.trim() || 'Untitled Sound';

    uploadModal.classList.add('hidden');
    showLoading(true);

    try {
        let finalBlob = file;

        const isTrimmed = trimStartRatio > 0.001 || trimEndRatio < 0.999;
        if (isTrimmed && trimDuration > 0) {
            const startSec = trimStartRatio * trimDuration;
            const endSec = trimEndRatio * trimDuration;
            finalBlob = await trimAudioFile(file, startSec, endSec);
        }

        const color = colors[Math.floor(Math.random() * colors.length)];
        const fileExt = finalBlob !== file ? 'wav' : file.name.split('.').pop();
        const fileName = `${Date.now()}_${name.replace(/[^a-zA-Z0-9.-]/g, '_')}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabaseClient.storage.from('sounds-media').upload(fileName, finalBlob);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseClient.storage.from('sounds-media').getPublicUrl(fileName);
        const newSound = { name, color, src: urlData.publicUrl };

        const { data: inserted, error: insertError } = await supabaseClient.from('sounds').insert([newSound]).select();
        if (insertError) throw insertError;

        if (inserted && inserted.length > 0) {
            renderSoundItem(inserted[0]);
            dropZone.style.borderColor = 'var(--accent-red-light)';
            setTimeout(() => dropZone.style.borderColor = '', 1000);
        }
    } catch (err) {
        console.error('Error saving sound', err);
        alert('Could not upload to server.');
    } finally {
        showLoading(false);
        pendingUploadFile = null;
        fileInput.value = '';
        trimSummary.classList.add('hidden');
    }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function showLoading(show) {
    if (show) {
        loadingIndicator.classList.remove('hidden');
        dropZone.style.display = 'none';
    } else {
        loadingIndicator.classList.add('hidden');
        dropZone.style.display = 'flex';
    }
}

async function trimAudioFile(file, startSec, endSec) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();

    const actualStart = Math.max(0, startSec);
    const actualEnd = Math.min(audioBuffer.duration, endSec);
    if (actualStart >= actualEnd) throw new Error('Invalid trim times.');

    const duration = actualEnd - actualStart;
    const offlineCtx = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        Math.ceil(audioBuffer.sampleRate * duration),
        audioBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0, actualStart, duration);

    const renderedBuffer = await offlineCtx.startRendering();
    return audioBufferToWavBlob(renderedBuffer);
}

function audioBufferToWavBlob(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    const channels = [];
    let sample, offset = 0, pos = 0;

    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
    setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2); setUint16(16);
    setUint32(0x61746164); setUint32(length - pos - 4);

    for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

    while (pos < length) {
        for (let i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });

    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initUI);
