/**
 * DrawingController handles all canvas rendering and stroke management.
 */
export class DrawingController {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.strokes = []; // Array to hold all strokes
        this.currentStroke = null;
        this.penColor = '#FFFFFF';
        this.penWidth = 5;
        this.isDrawingLoopActive = false;

        // Smoothing variables
        this.lastSmoothedPoint = null;
        this.smoothingAlpha = 0.4; // Lower value = more smoothing, more lag
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    /**
     * Resizes the canvas to match the dimensions of its parent container.
     */
    resizeCanvas() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        this.redrawAll();
    }

    /**
     * Starts the main drawing loop.
     */
    start() {
        if (this.isDrawingLoopActive) return;
        this.isDrawingLoopActive = true;
        this.drawLoop();
    }

    /**
     * Main rendering loop using requestAnimationFrame.
     */
    drawLoop() {
        this.redrawAll();
        if (this.isDrawingLoopActive) {
            requestAnimationFrame(() => this.drawLoop());
        }
    }

    /**
     * Clears and redraws all completed strokes.
     */
    redrawAll() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.strokes.forEach(stroke => this.drawStroke(stroke));
        if (this.currentStroke) {
            this.drawStroke(this.currentStroke);
        }
    }

    /**
     * Draws a single stroke on the canvas.
     * @param {object} stroke - The stroke object to draw.
     */
    drawStroke(stroke) {
        if (!stroke || stroke.points.length < 2) return;
        
        this.ctx.strokeStyle = stroke.color;
        this.ctx.lineWidth = stroke.width;
        
        this.ctx.beginPath();
        this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

        for (let i = 1; i < stroke.points.length; i++) {
            this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        this.ctx.stroke();
    }
    
    /**
     * Starts a new stroke.
     */
    startStroke() {
        this.currentStroke = {
            points: [],
            color: this.penColor,
            width: this.penWidth
        };
        this.lastSmoothedPoint = null;
    }

    /**
     * Adds a point to the current stroke with smoothing.
     * @param {number} x - The x-coordinate of the new point.
     * @param {number} y - The y-coordinate of the new point.
     */
    addPoint(x, y) {
        if (!this.currentStroke) return;

        let smoothedPoint;
        if (!this.lastSmoothedPoint) {
            smoothedPoint = { x, y };
        } else {
            smoothedPoint = {
                x: this.smoothingAlpha * x + (1 - this.smoothingAlpha) * this.lastSmoothedPoint.x,
                y: this.smoothingAlpha * y + (1 - this.smoothingAlpha) * this.lastSmoothedPoint.y,
            };
        }
        
        this.currentStroke.points.push(smoothedPoint);
        this.lastSmoothedPoint = smoothedPoint;
    }

    /**
     * Finalizes the current stroke and adds it to the list of strokes.
     */
    endStroke() {
        if (this.currentStroke && this.currentStroke.points.length > 1) {
            this.strokes.push(this.currentStroke);
        }
        this.currentStroke = null;
    }

    /**
     * Changes the current pen color.
     * @param {string} color - The new color hex code.
     */
    changeColor(color) {
        this.penColor = color;
    }

    /**
     * Changes the current pen width.
     * @param {number} width - The new width in pixels.
     */
    changeWidth(width) {
        this.penWidth = width;
    }

    /**
     * Removes the last completed stroke.
     */
    undo() {
        this.strokes.pop();
    }
    
    /**
     * Clears the entire canvas.
     */
    clear() {
        this.strokes = [];
        this.currentStroke = null;
    }

    /**
     * Saves the current canvas content as a PNG file.
     */
    save() {
        // Redraw with a black background for saving
        this.ctx.globalCompositeOperation = 'destination-over';
        this.ctx.fillStyle = '#000000'; // Black background
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const link = document.createElement('a');
        link.download = 'air-drawing.png';
        link.href = this.canvas.toDataURL('image/png');
        link.click();
        
        // Reset composite operation
        this.ctx.globalCompositeOperation = 'source-over';
        this.redrawAll();
    }
    
    /**
     * Draws hand landmarks for debugging purposes.
     * @param {Array} multiHandLandmarks - Hand landmarks from MediaPipe.
     */
    debugDraw(multiHandLandmarks) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (multiHandLandmarks) {
            for (const landmarks of multiHandLandmarks) {
                // Flip the landmarks horizontally to match the mirrored video
                const flippedLandmarks = landmarks.map(lm => ({...lm, x: 1 - lm.x }));
                
                window.drawConnectors(this.ctx, flippedLandmarks, window.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
                window.drawLandmarks(this.ctx, flippedLandmarks, { color: '#FF0000', lineWidth: 2 });
            }
        }
    }
}
