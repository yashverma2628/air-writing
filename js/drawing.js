const SMOOTHING_FACTOR = 0.7;

let strokes = [];
let currentStroke = { points: [], color: '#FFFFFF', width: 5 };
let lastPoint = null;

function startStroke(point, color, width) {
    currentStroke = { points: [], color, width };
    addPoint(point);
}

function endStroke() {
    if (currentStroke.points.length > 1) {
        strokes.push(currentStroke);
    }
    currentStroke = { points: [], color: currentStroke.color, width: currentStroke.width };
    lastPoint = null;
}

function addPoint(point) {
    let smoothedPoint = point;
    if (lastPoint) {
        smoothedPoint = {
            x: SMOOTHING_FACTOR * point.x + (1 - SMOOTHING_FACTOR) * lastPoint.x,
            y: SMOOTHING_FACTOR * point.y + (1 - SMOOTHING_FACTOR) * lastPoint.y,
        };
    }
    currentStroke.points.push(smoothedPoint);
    lastPoint = smoothedPoint;
}

function undoLastStroke() {
    strokes.pop();
}

// Renamed for clarity, this is the master reset function now
function clearAllStrokes() {
    strokes = [];
    currentStroke = { points: [] };
    lastPoint = null;
}

function renderStrokes(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const allStrokes = [...strokes, currentStroke];

    allStrokes.forEach(stroke => {
        if (stroke.points.length < 2) return;

        const isEraser = stroke.color === 'ERASER_STROKE';

        // Set the composite operation for the eraser
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        
        // For the eraser, the actual color doesn't matter, but we need one.
        ctx.strokeStyle = isEraser ? '#000000' : stroke.color;
        ctx.lineWidth = stroke.width;
        
        ctx.beginPath();
        
        const firstPointX = canvas.width - stroke.points[0].x;
        ctx.moveTo(firstPointX, stroke.points[0].y);

        for (let i = 1; i < stroke.points.length; i++) {
            const point = stroke.points[i];
            const mirroredX = canvas.width - point.x;
            ctx.lineTo(mirroredX, point.y);
        }
        ctx.stroke();
    });

    // IMPORTANT: Reset to default after rendering all strokes
    ctx.globalCompositeOperation = 'source-over';
}

export { startStroke, endStroke, addPoint, undoLastStroke, clearAllStrokes, renderStrokes };
