import * as HandTracker from './handTracker.js';
import * as Drawing from './drawing.js';

document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('webcam');
    const drawingCanvas = document.getElementById('drawingCanvas');
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
    let isDrawing = false;

    function setCanvasSize() {
        const videoRect = videoElement.getBoundingClientRect();
        drawingCanvas.width = videoRect.width;
        drawingCanvas.height = videoRect.height;
    }

    function onHandResults(results) {
        loadingSpinner.style.display = 'none';
        statusMessage.textContent = 'Detection active. Pinch to draw!';

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            const fingerTip = landmarks[8]; // Index finger tip
            const thumbTip = landmarks[4]; // Thumb tip

            const point = {
                x: fingerTip.x * drawingCanvas.width,
                y: fingerTip.y * drawingCanvas.height
            };

            const distance = Math.hypot(fingerTip.x - thumbTip.x, fingerTip.y - thumbTip.y);
            const isPinched = distance < 0.06;

            if (isPinched) {
                if (!isDrawing) {
                    isDrawing = true;
                    Drawing.startStroke(point, penColor, penWidth);
                } else {
                    Drawing.addPoint(point);
                }
            } else {
                if (isDrawing) {
                    isDrawing = false;
                    Drawing.endStroke();
                }
            }
        } else {
            if (isDrawing) {
                isDrawing = false;
                Drawing.endStroke();
            }
        }
    }

    function gameLoop() {
        Drawing.renderStrokes(drawingCanvas);
        requestAnimationFrame(gameLoop);
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
        link.href = drawingCanvas.toDataURL('image/png');
        link.click();
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

