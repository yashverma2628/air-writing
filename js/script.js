import * as HandTracker from './handTracker.js';
import * as Drawing from './drawing.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const videoElement = document.getElementById('webcam');
    const drawingCanvas = document.getElementById('drawingCanvas');
    const ctx = drawingCanvas.getContext('2d');
    const toolbar = document.getElementById('toolbar');
    const statusMessage = document.getElementById('status-message');
    const loadingSpinner = document.getElementById('loading-spinner');
    const geminiDescription = document.getElementById('gemini-description');
    // --- Controls ---
    const colorPicker = document.getElementById('colorPicker');
    const strokeWidthSlider = document.getElementById('strokeWidth');
    const strokeWidthValue = document.getElementById('strokeWidthValue');
    const undoBtn = document.getElementById('undoBtn');
    const clearBtn = document.getElementById('clearBtn');
    const saveBtn = document.getElementById('saveBtn');
    const startRecordBtn = document.getElementById('startRecordBtn');
    const stopRecordBtn = document.getElementById('stopRecordBtn');
    const describeBtn = document.getElementById('describeBtn');

    // --- State Management ---
    let penColor = colorPicker.value;
    let penWidth = strokeWidthSlider.value;
    let currentMode = 'PEN_UP'; 
    let lastMode = 'PEN_UP';
    let panStartPosition = null;
    let canvasOffset = { x: 0, y: 0 };
    let permanentOffset = { x: 0, y: 0 }; // Permanent offset that persists after fist is released
    let temporaryOffset = { x: 0, y: 0 }; // Temporary offset while dragging with fist
    let globalHandLandmarks = null;
    
    // --- Recording State ---
    let mediaRecorder;
    let recordedChunks = [];
    
    function setCanvasSize() {
        const videoRect = videoElement.getBoundingClientRect();
        drawingCanvas.width = videoRect.width;
        drawingCanvas.height = videoRect.height;
    }

    function onHandResults(results) {
        globalHandLandmarks = results.multiHandLandmarks && results.multiHandLandmarks.length > 0 ? results.multiHandLandmarks[0] : null;
        if (loadingSpinner.style.display !== 'none') {
            loadingSpinner.style.display = 'none';
            toolbar.style.visibility = 'visible';
            statusMessage.textContent = '1 finger: draw | 2 fingers: lift pen | 4 fingers: erase | Fist: move | 🤘: clear';
        }

        if (globalHandLandmarks) {
            const gestureInfo = HandTracker.detectGesture(globalHandLandmarks);
            currentMode = gestureInfo.gesture;
            
            const position = gestureInfo.position ? {
                x: gestureInfo.position.x * drawingCanvas.width,
                y: gestureInfo.position.y * drawingCanvas.height
            } : null;

            handleGesture(position);
            lastMode = currentMode;
        } else {
            if (lastMode === 'DRAW' || lastMode === 'ERASE') Drawing.endStroke();
            if (lastMode === 'FIST') handlePanEnd(); // Properly end pan if hand is lost
            currentMode = 'PEN_UP';
            lastMode = 'PEN_UP';
        }
    }

    function handlePanEnd() {
        if (!panStartPosition) return;
        // When fist is released, make the temporary offset permanent
        permanentOffset.x += temporaryOffset.x;
        permanentOffset.y += temporaryOffset.y;
        temporaryOffset = { x: 0, y: 0 };
        panStartPosition = null;
        // Update the combined offset
        canvasOffset = { x: permanentOffset.x, y: permanentOffset.y };
    }

    function handleGesture(position) {
         switch (currentMode) {
            case 'DRAW':
            case 'ERASE':
                const strokeColor = currentMode === 'ERASE' ? 'ERASER_STROKE' : penColor;
                const strokeWidth = currentMode === 'ERASE' ? penWidth * 2 : penWidth; // Make eraser thicker
                if (lastMode !== currentMode) {
                    Drawing.endStroke(); // End previous stroke if mode changed
                    if(position) {
                        // Adjust position based on permanent offset when starting a new stroke
                        const adjustedPosition = {
                            x: position.x - permanentOffset.x,
                            y: position.y - permanentOffset.y
                        };
                        Drawing.startStroke(adjustedPosition, strokeColor, strokeWidth);
                    }
                } else if (position) {
                    // Adjust position based on permanent offset when adding points
                    const adjustedPosition = {
                        x: position.x - permanentOffset.x,
                        y: position.y - permanentOffset.y
                    };
                    Drawing.addPoint(adjustedPosition);
                }
                break;
            
            case 'FIST':
                // Fist is for panning/moving the drawing
                if (lastMode !== 'FIST' && position) {
                    panStartPosition = position;
                    temporaryOffset = { x: 0, y: 0 };
                } else if (panStartPosition && position) {
                    temporaryOffset.x = position.x - panStartPosition.x;
                    temporaryOffset.y = position.y - panStartPosition.y;
                    // Update the combined offset for rendering
                    canvasOffset.x = permanentOffset.x + temporaryOffset.x;
                    canvasOffset.y = permanentOffset.y + temporaryOffset.y;
                }
                break;

            case 'ROCK_ON':
                // Rock on gesture (🤘) clears the screen and resets offsets
                if (lastMode !== 'ROCK_ON') {
                    Drawing.clearAllStrokes();
                    permanentOffset = { x: 0, y: 0 };
                    temporaryOffset = { x: 0, y: 0 };
                    canvasOffset = { x: 0, y: 0 };
                    panStartPosition = null;
                    statusMessage.textContent = 'Canvas cleared! 🤘';
                    setTimeout(() => {
                        statusMessage.textContent = '1 finger: draw | 2 fingers: lift pen | 4 fingers: erase | Fist: move | 🤘: clear';
                    }, 2000);
                }
                break;

            case 'PEN_UP':
            case 'NONE':
                if (lastMode === 'DRAW' || lastMode === 'ERASE') {
                    Drawing.endStroke();
                } else if (lastMode === 'FIST') {
                   handlePanEnd();
                }
                break;
        }
    }

    function gameLoop() {
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height); // Clear before drawing
        
        ctx.translate(canvasOffset.x, canvasOffset.y);
        Drawing.renderStrokes(drawingCanvas); 
        
        requestAnimationFrame(gameLoop);
    }
    
    // --- Gemini API Functions (Implementations are unchanged) ---
    async function handleDescribeAndNarrate() {
        statusMessage.textContent = 'Analyzing your masterpiece...';
        loadingSpinner.style.display = 'flex';
        describeBtn.disabled = true;

        try {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = drawingCanvas.width;
            tempCanvas.height = drawingCanvas.height;
            Drawing.renderStrokes(tempCanvas);
            const imageData = tempCanvas.toDataURL('image/png').split(',')[1];
            
            const description = await callGeminiVision(imageData);
            
            geminiDescription.textContent = description;
            geminiDescription.style.opacity = '1';
            statusMessage.textContent = 'Generating audio...';

            const audioData = await callGeminiTTS(description);
            if (audioData) {
                await playPcmAudio(audioData.audioData, audioData.sampleRate);
            }
            statusMessage.textContent = 'Done! Try another drawing.';

        } catch (error) {
            console.error("Gemini API Error:", error);
            statusMessage.textContent = "Sorry, I couldn't process that. Please try again.";
            geminiDescription.textContent = '';
        } finally {
            loadingSpinner.style.display = 'none';
            describeBtn.disabled = false;
            setTimeout(() => { geminiDescription.style.opacity = '0'; }, 6000);
        }
    }
    
    async function callGeminiVision(base64ImageData) {
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const payload = { contents: [{ parts: [ { text: "Describe this drawing in a creative, short, single sentence." }, { inlineData: { mimeType: "image/png", data: base64ImageData } } ] }] };
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        return result.candidates[0].content.parts[0].text;
    }

    async function callGeminiTTS(textToSpeak) {
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
        const payload = { contents: [{ parts: [{ text: textToSpeak }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } } }, model: "gemini-2.5-flash-preview-tts" };
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        const part = result?.candidates?.[0]?.content?.parts?.[0];
        const audioData = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType;
        if (audioData && mimeType && mimeType.startsWith("audio/")) {
            const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)[1], 10);
            return { audioData, sampleRate };
        }
        return null;
    }

    function playPcmAudio(base64Data, sampleRate) { /* Unchanged */
        return new Promise((resolve) => {
            const pcmData = atob(base64Data).split('').map(c => c.charCodeAt(0));
            const byteCharacters = new Uint8Array(pcmData);
            const pcm16 = new Int16Array(byteCharacters.buffer);
            const wavBlob = pcmToWav(pcm16, sampleRate);
            const audioUrl = URL.createObjectURL(wavBlob);
            const audio = new Audio(audioUrl);
            audio.onended = () => { URL.revokeObjectURL(audioUrl); resolve(); };
            audio.play();
        });
    }

    function pcmToWav(pcmData, sampleRate) { /* Unchanged */
        const numChannels = 1, bitsPerSample = 16, blockAlign = (numChannels * bitsPerSample) / 8, byteRate = sampleRate * blockAlign, dataSize = pcmData.length * 2, buffer = new ArrayBuffer(44 + dataSize), view = new DataView(buffer);
        writeString(view, 0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeString(view, 8, 'WAVE'); writeString(view, 12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true); view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true); view.setUint16(34, bitsPerSample, true); writeString(view, 36, 'data'); view.setUint32(40, dataSize, true);
        for (let i = 0; i < pcmData.length; i++) { view.setInt16(44 + i * 2, pcmData[i], true); }
        return new Blob([view], { type: 'audio/wav' });
    }
    
    function writeString(view, offset, string) { /* Unchanged */
        for (let i = 0; i < string.length; i++) { view.setUint8(offset + i, string.charCodeAt(i)); }
    }
    
    async function startRecording() { /* Unchanged - implement if needed */ }
    function stopRecording() { /* Unchanged - implement if needed */ }

    async function main() {
        try {
            await HandTracker.initialize(videoElement, onHandResults);
            setCanvasSize();
            requestAnimationFrame(gameLoop);
        } catch (error) {
            console.error("Initialization failed:", error);
            statusMessage.textContent = 'Error: Could not access webcam. Please grant permission and refresh.';
            loadingSpinner.style.display = 'none';
        }
    }

    // --- Event Listeners ---
    colorPicker.addEventListener('input', (e) => penColor = e.target.value);
    strokeWidthSlider.addEventListener('input', (e) => { penWidth = e.target.value; strokeWidthValue.textContent = penWidth; });
    undoBtn.addEventListener('click', Drawing.undoLastStroke);
    clearBtn.addEventListener('click', () => {
        Drawing.clearAllStrokes();
        permanentOffset = { x: 0, y: 0 };
        temporaryOffset = { x: 0, y: 0 };
        canvasOffset = { x: 0, y: 0 };
    });
    saveBtn.addEventListener('click', () => {
        const link = document.createElement('a'); link.download = 'air-drawing.png';
        ctx.globalCompositeOperation = 'destination-over'; ctx.drawImage(videoElement, 0, 0, drawingCanvas.width, drawingCanvas.height);
        link.href = drawingCanvas.toDataURL('image/png'); link.click();
        ctx.globalCompositeOperation = 'source-over';
    });
    startRecordBtn.addEventListener('click', startRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
    describeBtn.addEventListener('click', handleDescribeAndNarrate);
    window.addEventListener('resize', setCanvasSize);

    main();
});
