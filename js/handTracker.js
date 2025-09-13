let hands;

async function initialize(videoElement, onResultsCallback) {
    // Dynamically load the necessary scripts from CDN to ensure they are ready.
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');

    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5, // Lowered for faster initial detection
        minTrackingConfidence: 0.7  // Kept high for tracking stability
    });

    hands.onResults(onResultsCallback);

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 1280,
        height: 720
    });

    return camera.start();
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = 'anonymous';
        script.onload = () => resolve(script);
        script.onerror = () => reject(new Error(`Script load error for ${src}`));
        document.head.appendChild(script);
    });
}

/**
 * A more robust check to see if a finger is extended.
 * A finger is "up" if its tip is higher (lower y-value) than its base knuckle (MCP joint).
 */
const isFingerUp = (landmarks, tipIndex, mcpIndex) => landmarks[tipIndex].y < landmarks[mcpIndex].y;

/**
 * Analyzes the hand landmarks to detect a specific gesture.
 * @param {Array} landmarks - The array of hand landmarks.
 * @returns {object} An object containing the detected gesture and relevant position.
 */
function detectGesture(landmarks) {
    const isIndexUp = isFingerUp(landmarks, 8, 5);
    const isMiddleUp = isFingerUp(landmarks, 12, 9);
    const isRingUp = isFingerUp(landmarks, 16, 13);
    const isPinkyUp = isFingerUp(landmarks, 20, 17);

    // FIST gesture: All four fingers are down.
    if (!isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
        // Use the wrist as a stable point for panning.
        return { gesture: 'FIST', position: { x: landmarks[0].x, y: landmarks[0].y } };
    }

    // ERASE gesture: All four fingers are up.
    if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
        // Use the midpoint between index and ring finger for a stable eraser position
        const midX = (landmarks[8].x + landmarks[16].x) / 2;
        const midY = (landmarks[8].y + landmarks[16].y) / 2;
        return { gesture: 'ERASE', position: { x: midX, y: midY } };
    }

    // PEN UP (Pause) gesture: Index and Middle are up.
    if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
        return { gesture: 'PEN_UP' };
    }

    // DRAW gesture: Only Index finger is up.
    if (isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
        return { gesture: 'DRAW', position: { x: landmarks[8].x, y: landmarks[8].y } };
    }

    // Default: No specific gesture detected, treated as pen up.
    return { gesture: 'NONE' };
}

export { initialize, detectGesture };

