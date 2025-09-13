#include <vector>

#ifdef __cplusplus
extern "C" {
#endif

// A simple Exponential Moving Average (EMA) smoother written in C++.
// This is a demonstration of a function that could be compiled to WebAssembly.
//
// @param points - A flat array of x,y coordinates [x1, y1, x2, y2, ...].
// @param numPoints - The number of points (not the array length).
// @param alpha - The smoothing factor (e.g., 0.4).
// @param smoothedPoints - Output array to store the smoothed coordinates.
void simple_ema_smoother(float* points, int numPoints, float alpha, float* smoothedPoints) {
    if (numPoints == 0) {
        return;
    }

    // Initialize the first smoothed point
    smoothedPoints[0] = points[0];
    smoothedPoints[1] = points[1];

    for (int i = 1; i < numPoints; ++i) {
        int currentIndex = i * 2;
        int prevIndex = (i - 1) * 2;

        // Smooth X coordinate
        smoothedPoints[currentIndex] = alpha * points[currentIndex] + (1.0f - alpha) * smoothedPoints[prevIndex];
        
        // Smooth Y coordinate
        smoothedPoints[currentIndex + 1] = alpha * points[currentIndex + 1] + (1.0f - alpha) * smoothedPoints[prevIndex + 1];
    }
}

#ifdef __cplusplus
}
#endif
