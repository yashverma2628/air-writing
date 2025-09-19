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
    const saveBtn = document.getElementById('saveBtn'); // Assuming this exists from previous steps
    const loadBtn = document.getElementById('loadBtn'); // Assuming this exists

   // --- State Management ---
    let penColor = colorPicker.value;
    let penWidth = strokeWidthSlider.value;
    let currentMode = 'PEN_UP'; 
    let lastMode = 'PEN_UP';
    let panStartPosition = null; // <<< This line is the fix
    let canvasOffset = { x: 0, y: 0 };
    let globalHandLandmarks = null;
    
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
            statusMessage.textContent = '1 finger to draw, 2 to lift, 4 to erase, fist to clear.';
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
            currentMode = 'PEN_UP';
            lastMode = 'PEN_UP';
        }
    }

    // This function is no longer needed as panning is removed.
    // function handlePanEnd() { ... }

    function handlePanEnd() {
        if (!panStartPosition) return;
        // Pan gesture is over. Reset panning state but DO NOT clear the drawing.
        panStartPosition = null;
        canvasOffset = { x: 0, y: 0 };
    }

function handleGesture(position) {
         switch (currentMode) {
            case 'DRAW':
            case 'ERASE':
                const strokeColor = currentMode === 'ERASE' ? 'ERASER_STROKE' : penColor;
                const strokeWidth = currentMode === 'ERASE' ? penWidth * 2 : penWidth; // Make eraser thicker
                if (lastMode !== currentMode) {
                    Drawing.endStroke(); // End previous stroke if mode changed
                    if(position) Drawing.startStroke(position, strokeColor, strokeWidth);
                } else if (position) {
                    Drawing.addPoint(position);
                }
                break;
            
            case 'FIST':
                // Add a null check for position to prevent crash
                if (lastMode !== 'FIST' && position) {
                    panStartPosition = position;
                } else if (panStartPosition && position) {
                    canvasOffset.x = position.x - panStartPosition.x;
                    canvasOffset.y = position.y - panStartPosition.y;
                }
                break;
            
            // --- NEW GESTURE HANDLER ---
            case 'CLEAR':
                Drawing.clearAllStrokes();
                canvasOffset = { x: 0, y: 0 }; 
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
        // Since panning is removed, we don't need to translate the canvas anymore
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height); 
        Drawing.renderStrokes(drawingCanvas); 
        requestAnimationFrame(gameLoop);
    }
    
    // (The rest of your script.js file remains the same)
    // ... Gemini functions, event listeners, main function, etc.

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
    });
    // Add other button listeners if they exist (save, load, etc.)
    
    window.addEventListener('resize', setCanvasSize);

    main();
});
