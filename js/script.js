import * as HandTracker from './handTracker.js';
import * as Drawing from './drawing.js';

document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('webcam');
    const drawingCanvas = document.getElementById('drawingCanvas');
    const ctx = drawingCanvas.getContext('2d');
    const colorPicker = document.getElementById('colorPicker');
    const strokeWidthSlider = document.getElementById('strokeWidth');
    const strokeWidthValue = document.getElementById('strokeWidthValue');
    const undoBtn = document.getElementById('undoBtn');
    const clearBtn = document.getElementById('clearBtn');
    const saveBtn = document.getElementById('saveBtn');
    const statusMessage = document.getElementById('status-message');
    const loadingSpinner = document.getElementById('loading-spinner');

    let penColor = colorPicker.value;
    let penWidth = strokeWidthSlider.value;
    
    // Manage the current action state
    let currentMode = 'PAUSE'; // Can be 'DRAW', 'ERASE', 'PAUSE'
    let lastMode = 'PAUSE';
    let eraserPosition = null;
    const ERASER_RADIUS = 20;

    function setCanvasSize() {
        const videoRect = videoElement.getBoundingClientRect();
        drawingCanvas.width = videoRect.width;
        drawingCanvas.height = videoRect.height;
    }

    function onHandResults(results) {
        loadingSpinner.style.display = 'none';
        statusMessage.textContent = 'Show 1 finger to draw, 2 to pause, 4 to erase.';

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            const gestureInfo = HandTracker.detectGesture(landmarks);
            currentMode = gestureInfo.gesture;
            
            const position = gestureInfo.position ? {
                x: gestureInfo.position.x * drawingCanvas.width,
                y: gestureInfo.position.y * drawingCanvas.height
            } : null;

            // State machine for drawing/erasing actions
            switch (currentMode) {
                case 'DRAW':
                    if (lastMode !== 'DRAW') {
                        Drawing.endStroke(); // End any previous stroke
                        Drawing.startStroke(position, penColor, penWidth);
                    } else {
                        Drawing.addPoint(position);
                    }
                    eraserPosition = null;
                    break;
                
                case 'ERASE':
                    if (lastMode === 'DRAW') Drawing.endStroke();
                    eraserPosition = position;
                    break;

                case 'PAUSE':
                case 'NONE':
                    if (lastMode === 'DRAW') Drawing.endStroke();
                    eraserPosition = null;
                    break;
            }
            lastMode = currentMode;
        } else {
            // No hand detected
            if (lastMode === 'DRAW') Drawing.endStroke();
            currentMode = 'PAUSE';
            lastMode = 'PAUSE';
            eraserPosition = null;
        }
    }

    function gameLoop() {
        // 1. Render all the permanent strokes from the drawing module
        Drawing.renderStrokes(drawingCanvas);

        // 2. If in erase mode, draw the "cutting out" eraser circle
        if (currentMode === 'ERASE' && eraserPosition) {
            // This operation makes new shapes "erase" what's underneath
            ctx.globalCompositeOperation = 'destination-out';
            
            ctx.fillStyle = '#000000'; // Color doesn't matter, only alpha
            ctx.beginPath();
            const mirroredX = drawingCanvas.width - eraserPosition.x;
            ctx.arc(mirroredX, eraserPosition.y, ERASER_RADIUS, 0, 2 * Math.PI);
            ctx.fill();

            // IMPORTANT: Reset to default mode for the next frame
            ctx.globalCompositeOperation = 'source-over';
        }
        
        requestAnimationFrame(gameLoop);
    }

    // --- Event Listeners ---
    colorPicker.addEventListener('input', (e) => penColor = e.target.value);
    strokeWidthSlider.addEventListener('input', (e) => {
        penWidth = e.target.value;
        strokeWidthValue.textContent = penWidth;
    });
    undoBtn.addEventListener('click', () => {
        Drawing.undoLastStroke();
        Drawing.renderStrokes(drawingCanvas); // Re-render immediately after undo
    });
    clearBtn.addEventListener('click', () => {
        Drawing.clearCanvas();
        Drawing.renderStrokes(drawingCanvas); // Re-render immediately after clear
    });
    saveBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'air-drawing.png';
        // Temporarily draw video on canvas for saving
        ctx.globalCompositeOperation = 'destination-over';
        ctx.drawImage(videoElement, 0, 0, drawingCanvas.width, drawingCanvas.height);
        ctx.globalCompositeOperation = 'source-over';
        
        link.href = drawingCanvas.toDataURL('image/png');
        link.click();
        
        // Re-render without the video frame for a clean canvas state
        setTimeout(() => Drawing.renderStrokes(drawingCanvas), 100);
    });

    window.addEventListener('resize', setCanvasSize);

    // --- Initialization ---
    async function main() {
        statusMessage.textContent = 'Initializing camera...';
        try {
            await HandTracker.initialize(videoElement, onHandResults);
            setCanvasSize();
            gameLoop();
        } catch (error) {
            console.error("Initialization failed:", error);
            statusMessage.textContent = 'Error: Could not access webcam. Please grant permission and refresh.';
            loadingSpinner.style.display = 'none';
        }
    }

    main();
});

