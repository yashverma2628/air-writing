let strokes = [];
let currentStroke = { points: [], color: '#FFFFFF', width: 5 };
let lastPoint = null;
let grabbedStroke = null;
let grabOffset = { x: 0, y: 0 };

function startStroke(point, color, width) {
    currentStroke = { points: [], color, width };
    addPoint(point);
}

function endStroke() {
    if (currentStroke.points.length > 1) {
        strokes.push(currentStroke);
    }
    currentStroke = { points: [], color: '#FFFFFF', width: 5 };
    lastPoint = null;
}

function addPoint(point) {
    currentStroke.points.push(point);
}

// --- NEW GRAB AND MOVE LOGIC ---
function grabStroke(position) {
    if (grabbedStroke) return; // Already grabbing something

    // Find the closest stroke to the grab position
    // This is a simple implementation; a more robust one would check all points
    let closestStroke = null;
    let minDistance = Infinity;

    strokes.forEach(stroke => {
        const firstPoint = stroke.points[0];
        const distance = Math.hypot(position.x - firstPoint.x, position.y - firstPoint.y);
        if (distance < minDistance) {
            minDistance = distance;
            closestStroke = stroke;
        }
    });

    if (closestStroke && minDistance < 50) { // Grab if close enough
        grabbedStroke = closestStroke;
        grabOffset.x = position.x - closestStroke.points[0].x;
        grabOffset.y = position.y - closestStroke.points[0].y;
    }
}

function moveStroke(position) {
    if (!grabbedStroke) return;

    const newPoints = grabbedStroke.points.map(p => ({
        x: position.x - grabOffset.x + (p.x - grabbedStroke.points[0].x),
        y: position.y - grabOffset.y + (p.y - grabbedStroke.points[0].y)
    }));
    grabbedStroke.points = newPoints;
}

function releaseStroke() {
    grabbedStroke = null;
}


function undoLastStroke() {
    strokes.pop();
}

function clearAllStrokes() {
    strokes = [];
}

function renderStrokes(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    [...strokes, currentStroke].forEach(stroke => {
        if (stroke.points.length < 2) return;
        
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
    });
}

export { startStroke, endStroke, addPoint, undoLastStroke, clearAllStrokes, renderStrokes, grabStroke, moveStroke, releaseStroke };
