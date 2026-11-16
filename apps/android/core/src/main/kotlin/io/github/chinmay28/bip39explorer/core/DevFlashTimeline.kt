package io.github.chinmay28.bip39explorer.core

import kotlin.math.abs

/**
 * The developer badge's full-screen flash, on one three-second clock — the
 * native copy of the web's `dev-flash-veil` and `dev-flash-badge` keyframes
 * (apps/web/src/styles.css), so the flash on the About screen is the same one
 * the page plays: the veil fades in, holds and fades out; the badge lands with
 * a small overshoot and drifts out as the veil clears.
 */
object DevFlashTimeline {
    const val DURATION_MS = 3000L

    private val easeInOut = CubicBezier(0.42f, 0f, 0.58f, 1f)
    private val landing = CubicBezier(0.22f, 1f, 0.36f, 1f)

    private val veil = Keyframes(
        listOf(0f to 0f, 0.07f to 1f, 0.82f to 1f, 1f to 0f),
        easeInOut,
    )
    private val badge = Keyframes(
        listOf(0f to 0.82f, 0.14f to 1.02f, 0.22f to 1f, 0.82f to 1f, 1f to 1.06f),
        landing,
    )

    /** The veil's opacity at [fraction] of the way through (0..1). */
    fun veilAlpha(fraction: Float): Float = veil.at(fraction)

    /** The badge's scale at [fraction] of the way through (0..1). */
    fun badgeScale(fraction: Float): Float = badge.at(fraction)
}

/**
 * CSS keyframes: values at offsets, with the timing function applied to each
 * interval between them, as a browser does.
 */
class Keyframes(private val frames: List<Pair<Float, Float>>, private val easing: CubicBezier) {
    init {
        require(frames.size >= 2) { "need at least two keyframes" }
        require(frames.first().first == 0f && frames.last().first == 1f) { "keyframes must run from 0 to 1" }
        require(frames.zipWithNext().all { (a, b) -> a.first < b.first }) { "keyframe offsets must increase" }
    }

    fun at(fraction: Float): Float {
        val t = fraction.coerceIn(0f, 1f)
        val i = frames.indexOfLast { it.first <= t }.coerceAtMost(frames.size - 2)
        val (t0, v0) = frames[i]
        val (t1, v1) = frames[i + 1]
        val local = (t - t0) / (t1 - t0)
        return v0 + (v1 - v0) * easing.at(local)
    }
}

/** A CSS `cubic-bezier(x1, y1, x2, y2)` timing function. */
class CubicBezier(private val x1: Float, private val y1: Float, private val x2: Float, private val y2: Float) {
    init {
        require(x1 in 0f..1f && x2 in 0f..1f) { "x control points must lie in 0..1" }
    }

    private fun coordinate(s: Float, p1: Float, p2: Float): Float {
        val u = 1f - s
        return 3f * u * u * s * p1 + 3f * u * s * s * p2 + s * s * s
    }

    /** The eased progress at input progress [x] (0..1). */
    fun at(x: Float): Float {
        if (x <= 0f) return 0f
        if (x >= 1f) return 1f
        // x(s) is monotonic for control points in 0..1, so bisection always
        // finds the parameter; 30 rounds is far below a pixel.
        var lo = 0f
        var hi = 1f
        var s = x
        repeat(30) {
            val e = coordinate(s, x1, x2) - x
            if (abs(e) < 1e-6f) return coordinate(s, y1, y2)
            if (e > 0f) hi = s else lo = s
            s = (lo + hi) / 2f
        }
        return coordinate(s, y1, y2)
    }
}
