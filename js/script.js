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
    // --- Controls ---
    const colorPicker = document.getElementById('colorPicker');
    const strokeWidthSlider = document.getElementById('strokeWidth');
    const strokeWidthValue = document.getElementById('strokeWidthValue');
    const undoBtn = document.getElementById('undoBtn');
    const clearBtn = document.getElementById('clearBtn');
    const saveBtn = document.getElementById('saveBtn');
    const startRecordBtn = document.getElementById('startRecordBtn');
    const stopRecordBtn = document.getElementById('stopRecordBtn');

    // --- State Management ---
    let penColor = colorPicker.value;
    let penWidth = strokeWidthSlider.value;
    let currentMode = 'PEN_UP'; // DRAW, ERASE, PEN_UP, FIST, NONE
    let lastMode = 'PEN_UP';
    let panStartPosition = null;
    let canvasOffset = { x: 0, y: 0 };
    
    // --- Recording State ---
    let mediaRecorder;
    let recordedChunks = [];

    // --- Optional WASM module ---
    let wasmProcessor = null;
    
    // --- Functions ---
    function setCanvasSize() {
        const videoRect = videoElement.getBoundingClientRect();
        drawingCanvas.width = videoRect.width;
        drawingCanvas.height = videoRect.height;
    }

    function onHandResults(results) {
        loadingSpinner.style.display = 'none';
        toolbar.style.visibility = 'visible';
        statusMessage.textContent = 'Show 1 finger to draw, 2 to lift pen, 4 to erase, or a fist to pan.';

        // Reset canvas transform each frame before drawing
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.translate(canvasOffset.x, canvasOffset.y);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            const gestureInfo = HandTracker.detectGesture(landmarks);
            currentMode = gestureInfo.gesture;
            
            const position = gestureInfo.position ? {
                x: gestureInfo.position.x * drawingCanvas.width,
                y: gestureInfo.position.y * drawingCanvas.height
            } : null;

            handleGesture(position);
            lastMode = currentMode;
        } else {
            // No hand detected, act as if pen is up
            if (lastMode === 'DRAW') Drawing.endStroke();
            currentMode = 'PEN_UP';
            lastMode = 'PEN_UP';
        }
    }

    function handleGesture(position) {
        switch (currentMode) {
            case 'DRAW':
                if (lastMode !== 'DRAW') {
                    Drawing.startStroke(position, penColor, penWidth);
                } else {
                    Drawing.addPoint(position);
                }
                break;
            
            case 'FIST':
                if (lastMode !== 'FIST') {
                    panStartPosition = position; // Start panning
                } else if (panStartPosition) {
                    // Calculate delta and update visual offset for real-time feedback
                    canvasOffset.x = position.x - panStartPosition.x;
                    canvasOffset.y = position.y - panStartPosition.y;
                }
                break;

            case 'PEN_UP':
            case 'NONE':
            case 'ERASE': // Eraser is handled in the render loop
                if (lastMode === 'DRAW') {
                    Drawing.endStroke();
                } else if (lastMode === 'FIST' && panStartPosition) {
                    // Pan is finished, apply the transformation permanently
                    const deltaX = position.x - panStartPosition.x;
                    const deltaY = position.y - panStartPosition.y;
                    
                    if (wasmProcessor) {
                        // High-performance path with C++/WASM
                        const strokes = Drawing.getStrokes();
                        const flatPoints = [];
                        strokes.forEach(s => s.points.forEach(p => flatPoints.push(p.x, p.y)));
                        
                        const ptr = wasmProcessor.malloc(flatPoints.length * 4);
                        wasmProcessor.HEAPF32.set(flatPoints, ptr / 4);
                        wasmProcessor.translatePoints(ptr, flatPoints.length / 2, deltaX, deltaY);
                        const newFlatPoints = wasmProcessor.HEAPF32.subarray(ptr / 4, ptr / 4 + flatPoints.length);
                        
                        let pointIndex = 0;
                        strokes.forEach(s => s.points.forEach(p => {
                            p.x = newFlatPoints[pointIndex++];
                            p.y = newFlatPoints[pointIndex++];
                        }));
                        Drawing.setStrokes(strokes);
                        wasmProcessor.free(ptr);
                    } else {
                        // Standard JavaScript path
                        Drawing.translateAllStrokes(deltaX, deltaY);
                    }
                    
                    Drawing.clearCanvas(); // Now clear for the new drawing session
                    panStartPosition = null;
                    canvasOffset = { x: 0, y: 0 };
                }
                break;
        }
    }

    function gameLoop() {
        // Apply visual offset for panning
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        Drawing.renderStrokes(drawingCanvas); // Render strokes first
        ctx.translate(canvasOffset.x, canvasOffset.y);

        if (currentMode === 'ERASE' && results.multiHandLandmarks && results.multiHandLandmarks[0]) {
            const landmarks = results.multiHandLandmarks[0];
            const gestureInfo = HandTracker.detectGesture(landmarks);
            if(gestureInfo.gesture === 'ERASE') {
                const eraserPos = {
                     x: gestureInfo.position.x * drawingCanvas.width,
                     y: gestureInfo.position.y * drawingCanvas.height
                };
                // This operation makes new shapes "erase" what's underneath
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillStyle = '#000';
                ctx.beginPath();
                const mirroredX = drawingCanvas.width - eraserPos.x;
                ctx.arc(mirroredX, eraserPos.y, penWidth, 0, 2 * Math.PI);
                ctx.fill();
                // Reset to default for next frame's drawing
                ctx.globalCompositeOperation = 'source-over';
            }
        }
        
        requestAnimationFrame(gameLoop);
    }

    // --- Recording Logic ---
    async function startRecording() {
        try {
            // Get combined stream from canvas, and audio from user
            const canvasStream = drawingCanvas.captureStream(30); // 30 FPS
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            
            const combinedStream = new MediaStream([
                ...canvasStream.getVideoTracks(),
                ...audioStream.getAudioTracks()
            ]);

            mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
            recordedChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'air-writing-session.webm';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            };

            mediaRecorder.start();
            startRecordBtn.classList.add('hidden');
            stopRecordBtn.classList.remove('hidden');
            statusMessage.textContent = '🔴 Recording...';
        } catch (err) {
            console.error("Error starting recording:", err);
            statusMessage.textContent = 'Could not start recording. Microphone permission required.';
        }
    }
    
    function stopRecording() {
        mediaRecorder.stop();
        startRecordBtn.classList.remove('hidden');
        stopRecordBtn.classList.add('hidden');
        statusMessage.textContent = 'Recording saved!';
    }


    // --- Initialization ---
    async function main() {
        statusMessage.textContent = 'Initializing camera...';
        toolbar.style.visibility = 'hidden';

        try {
            // Try to load optional WASM module
            const wasmModule = await import('/wasm/processor.js');
            wasmProcessor = {
                translatePoints: wasmModule.cwrap('translatePoints', null, ['number', 'number', 'number', 'number']),
                malloc: wasmModule._malloc,
                free: wasmModule._free,
                HEAPF32: wasmModule.HEAPF32
            };
            console.log("WASM module loaded successfully for high-performance panning.");
        } catch (e) {
            console.log("WASM module not found. Using standard JavaScript for panning.");
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
            videoElement.srcObject = stream;
            videoElement.onloadedmetadata = () => {
                setCanvasSize();
                HandTracker.initialize(videoElement, (r) => { window.results = r; onHandResults(r); });
                gameLoop();
            };
        } catch (error) {
            console.error("Initialization failed:", error);
            statusMessage.textContent = 'Error: Could not access webcam. Please grant permission and refresh.';
            loadingSpinner.style.display = 'none';
        }
    }

    // --- Event Listeners ---
    colorPicker.addEventListener('input', (e) => penColor = e.target.value);
    strokeWidthSlider.addEventListener('input', (e) => {
        penWidth = e.target.value;
        strokeWidthValue.textContent = penWidth;
    });
    undoBtn.addEventListener('click', Drawing.undoLastStroke);
    clearBtn.addEventListener('click', Drawing.clearCanvas);
    saveBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'air-drawing.png';
        ctx.globalCompositeOperation = 'destination-over';
        ctx.drawImage(videoElement, 0, 0, drawingCanvas.width, drawingCanvas.height);
        link.href = drawingCanvas.toDataURL('image/png');
        link.click();
        ctx.globalCompositeOperation = 'source-over';
    });
    startRecordBtn.addEventListener('click', startRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
    window.addEventListener('resize', setCanvasSize);

    main();
});

