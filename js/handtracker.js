let hands;

async function initialize(videoElement, onResultsCallback) {
    // Dynamically load the necessary scripts from CDN
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');

    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6, // Increased confidence for better gesture stability
        minTrackingConfidence: 0.6
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

// Helper function to dynamically load scripts
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
 * Analyzes the hand landmarks to detect a specific gesture.
 * @param {Array} landmarks - The array of hand landmarks.
 * @returns {object} An object containing the detected gesture and relevant position.
 */
function detectGesture(landmarks) {
    // Helper to check if a finger is extended (tip is higher than the joint below it)
    const isFingerUp = (tip, pip) => landmarks[tip].y < landmarks[pip].y;

    const isIndexUp = isFingerUp(8, 6);
    const isMiddleUp = isFingerUp(12, 10);
    const isRingUp = isFingerUp(16, 14);
    const isPinkyUp = isFingerUp(20, 18);

    // Four Fingers Up: ERASE
    if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
        // Use the midpoint between index and ring finger for a stable eraser position
        const midX = (landmarks[8].x + landmarks[16].x) / 2;
        const midY = (landmarks[8].y + landmarks[16].y) / 2;
        return { gesture: 'ERASE', position: { x: midX, y: midY } };
    }

    // Two Fingers Up: PAUSE
    if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
        return { gesture: 'PAUSE' };
    }

    // One Finger Up: DRAW
    if (isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
        return { gesture: 'DRAW', position: { x: landmarks[8].x, y: landmarks[8].y } };
    }

    // Default: No specific gesture detected
    return { gesture: 'NONE' };
}

export { initialize, detectGesture };

