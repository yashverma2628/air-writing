#include <emscripten.h>

extern "C" {

/**
 * A high-performance function to translate a large number of 2D points.
 * This is compiled to WebAssembly to be called from JavaScript.
 * * @param points A pointer to a flat array of floats (x1, y1, x2, y2, ...).
 * @param numPoints The total number of points (not the array size).
 * @param deltaX The amount to shift on the X-axis.
 * @param deltaY The amount to shift on the Y-axis.
 */
EMSCRIPTEN_KEEPALIVE
void translatePoints(float* points, int numPoints, float deltaX, float deltaY) {
    for (int i = 0; i < numPoints * 2; i += 2) {
        points[i] = points[i] + deltaX;
        points[i + 1] = points[i + 1] + deltaY;
    }
}

}

