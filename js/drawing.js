// A higher factor means less smoothing and more "instant" drawing.
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
    // Reset but keep color/width settings
    currentStroke = { points: [], color: currentStroke.color, width: currentStroke.width };
    lastPoint = null;
}

function addPoint(point) {
    if (lastPoint) {
        const smoothedPoint = {
            x: SMOOTHING_FACTOR * point.x + (1 - SMOOTHING_FACTOR) * lastPoint.x,
            y: SMOOTHING_FACTOR * point.y + (1 - SMOOTHING_FACTOR) * lastPoint.y,
        };
        currentStroke.points.push(smoothedPoint);
        lastPoint = smoothedPoint;
    } else {
        currentStroke.points.push(point);
        lastPoint = point;
    }
}

function undoLastStroke() {
    strokes.pop();
}

function clearCanvas() {
    strokes = [];
    currentStroke.points = [];
    lastPoint = null;
}

function renderStrokes(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const allStrokes = [...strokes, currentStroke];

    allStrokes.forEach(stroke => {
        if (stroke.points.length < 2) return;

        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        
        ctx.beginPath();
        
        // Flip the X coordinate to match the mirrored video
        const firstPointX = canvas.width - stroke.points[0].x;
        ctx.moveTo(firstPointX, stroke.points[0].y);

        for (let i = 1; i < stroke.points.length; i++) {
            const point = stroke.points[i];
            const mirroredX = canvas.width - point.x;
            ctx.lineTo(mirroredX, point.y);
        }
        ctx.stroke();
    });
}

export { startStroke, endStroke, addPoint, undoLastStroke, clearCanvas, renderStrokes };

