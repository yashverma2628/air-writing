/**
 * HandTracker class to encapsulate MediaPipe Hands logic.
 */
export class HandTracker {
    constructor(videoElement) {
        this.videoElement = videoElement;
        this.hands = null;
        this.camera = null;
    }

    /**
     * Initializes the MediaPipe Hands model and sets up the camera.
     * @param {function} onReady - Callback when initialization is complete.
     * @param {function} onResults - Callback for each frame's results.
     * @param {boolean} isDebug - Flag for debug mode.
     */
    async initialize(onReady, onResults, isDebug = false) {
        this.hands = new window.Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        this.hands.onResults((results) => onResults(results, isDebug));

        // Setup camera
        this.camera = new window.Camera(this.videoElement, {
            onFrame: async () => {
                await this.hands.send({ image: this.videoElement });
            },
            width: 1280,
            height: 720,
        });

        // Wait for the camera to be ready
        return this.camera.start().then(() => {
            console.log("Camera started successfully.");
            onReady();
        }).catch(err => {
            console.error("Camera start failed:", err);
            if (err.name === 'NotAllowedError') {
                 throw new Error("Camera permission denied. Please allow camera access and refresh.");
            }
            throw err;
        });
    }
}
