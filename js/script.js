import { HandTracker } from './handTracker.js';
import { DrawingController } from './drawing.js';

// --- DOM ELEMENTS ---
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('drawingCanvas');
const statusMessage = document.getElementById('status-message');
const loadingSpinner = document.getElementById('loading-spinner');
const colorPicker = document.getElementById('colorPicker');
const strokeWidthSlider = document.getElementById('strokeWidth');
const strokeWidthValue = document.getElementById('strokeWidthValue');
const undoBtn = document.getElementById('undoBtn');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');

// --- CONSTANTS & STATE ---
const PINCH_THRESHOLD = 0.08; // Threshold for pinch gesture (normalized distance)
let isDrawing = false;
let lastKnownHand = null;

// --- INITIALIZATION ---
const drawingController = new DrawingController(canvasElement);
const handTracker = new HandTracker(videoElement);

/**
 * Main application logic runs here.
 */
async function main() {
    setupUI();
    
    // Check for debug mode
    const isDebugMode = window.APP_DEBUG || false;
    if (isDebugMode) {
        document.querySelector('.actions')?.remove();
    }

    try {
        statusMessage.textContent = 'Requesting camera access...';
        await handTracker.initialize(onHandTrackerReady, onHandResults, isDebugMode);
    } catch (error) {
        console.error("Initialization failed:", error);
        statusMessage.textContent = `Error: ${error.message}`;
        loadingSpinner.style.display = 'none';
    }
}

/**
 * Sets up event listeners for UI controls.
 */
function setupUI() {
    if (colorPicker) {
        colorPicker.addEventListener('input', (e) => drawingController.changeColor(e.target.value));
    }
    if (strokeWidthSlider) {
        strokeWidthSlider.addEventListener('input', (e) => {
            const width = parseInt(e.target.value, 10);
            drawingController.changeWidth(width);
            strokeWidthValue.textContent = width;
        });
    }
    if (undoBtn) undoBtn.addEventListener('click', () => drawingController.undo());
    if (clearBtn) clearBtn.addEventListener('click', () => drawingController.clear());
    if (saveBtn) saveBtn.addEventListener('click', () => drawingController.save());
}

/**
 * Callback function when the hand tracker is fully initialized.
 */
function onHandTrackerReady() {
    loadingSpinner.style.display = 'none';
    statusMessage.textContent = 'Show your hand to the camera to begin.';
    drawingController.start();
}

/**
 * Callback function for processing hand tracking results from MediaPipe.
 * @param {object} results - The hand tracking data.
 * @param {boolean} isDebug - Flag for debug mode.
 */
function onHandResults(results, isDebug) {
    // Clear the canvas and draw the hand landmarks if in debug mode.
    if (isDebug) {
        drawingController.debugDraw(results.multiHandLandmarks);
        return; // Don't process drawing logic in debug mode
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const handLandmarks = results.multiHandLandmarks[0];
        lastKnownHand = handLandmarks;
        statusMessage.textContent = 'Pinch index finger and thumb to draw!';
        processDrawingGesture(handLandmarks);
    } else {
        // If no hand is detected, end the current stroke.
        if (isDrawing) {
            drawingController.endStroke();
            isDrawing = false;
        }
        if (lastKnownHand) {
            lastKnownHand = null;
            statusMessage.textContent = 'Hand lost. Show hand to resume.';
        }
    }
}

/**
 * Processes the hand landmarks to detect a drawing gesture.
 * @param {Array<object>} handLandmarks - The array of hand landmarks.
 */
function processDrawingGesture(handLandmarks) {
    const indexTip = handLandmarks[8]; // Index finger tip
    const thumbTip = handLandmarks[4]; // Thumb tip

    // Calculate the 3D distance between the index finger tip and thumb tip.
    const distance = Math.sqrt(
        Math.pow(indexTip.x - thumbTip.x, 2) +
        Math.pow(indexTip.y - thumbTip.y, 2) +
        Math.pow(indexTip.z - thumbTip.z, 2)
    );

    // Get pixel coordinates for the index finger tip, flipping X for mirror effect.
    const canvasX = (1 - indexTip.x) * canvasElement.width;
    const canvasY = indexTip.y * canvasElement.height;
    
    // Check if the pinch gesture is active.
    if (distance < PINCH_THRESHOLD) {
        if (!isDrawing) {
            // Started drawing
            isDrawing = true;
            drawingController.startStroke();
        }
        // Add the current point to the stroke.
        drawingController.addPoint(canvasX, canvasY);
    } else {
        if (isDrawing) {
            // Stopped drawing
            isDrawing = false;
            drawingController.endStroke();
        }
    }
}

// Start the application.
main();
