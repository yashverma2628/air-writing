const SMOOTHING_FACTOR = 0.7; // Higher value = less smoothing, more instant drawing

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

function clearCanvas() {
    strokes = [];
    currentStroke.points = [];
    lastPoint = null;
}

/**
 * Translates the coordinates of all saved strokes by a given delta.
 * This is used for the pan/shift canvas feature.
 * @param {number} deltaX - The amount to shift on the X-axis.
 * @param {number} deltaY - The amount to shift on the Y-axis.
 */
function translateAllStrokes(deltaX, deltaY) {
    strokes.forEach(stroke => {
        stroke.points.forEach(point => {
            point.x += deltaX;
            point.y += deltaY;
        });
    });
}

function getStrokes() {
    return strokes;
}

function setStrokes(newStrokes) {
    strokes = newStrokes;
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

export { 
    startStroke, endStroke, addPoint, undoLastStroke, clearCanvas, 
    renderStrokes, translateAllStrokes, getStrokes, setStrokes 
};

