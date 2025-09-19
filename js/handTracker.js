let hands;

async function initialize(videoElement, onResultsCallback) {
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');

    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 2, // --- ENABLE TWO-HAND TRACKING ---
        modelComplexity: 1,
        minDetectionConfidence: 0.4, // Lowered for better distance detection
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

const isFingerUp = (landmarks, tipIndex, mcpIndex) => landmarks[tipIndex].y < landmarks[mcpIndex].y;

function detectGesture(landmarks) {
    const isIndexUp = isFingerUp(landmarks, 8, 5);
    const isMiddleUp = isFingerUp(landmarks, 12, 9);
    const isRingUp = isFingerUp(landmarks, 16, 13);
    const isPinkyUp = isFingerUp(landmarks, 20, 17);
    const isThumbUp = landmarks[4].x < landmarks[3].x; // A simple check for thumb up

    // --- NEW GESTURES ---
    if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) return { gesture: 'VICTORY' };
    if (isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) return { gesture: 'THUMBS_UP' };
    
    // Grab Gesture (Big "C")
    const isThumbOut = landmarks[4].x < landmarks[5].x; // Thumb is to the side
    if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp && isThumbOut) {
        return { gesture: 'GRAB', position: { x: landmarks[9].x, y: landmarks[9].y } }; // Center of palm
    }

    // Existing Gestures
    if (isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
        return { gesture: 'DRAW', position: { x: landmarks[8].x, y: landmarks[8].y } };
    }
    
    return { gesture: 'NONE' };
}

export { initialize, detectGesture };
