package io.github.chinmay28.bip39explorer.core

import kotlin.math.roundToInt

/**
 * The web view's text zoom for the phone's font scale, so the page's words
 * grow with *Settings → Display → Font size* as native text does. Set on
 * creation and again whenever the scale changes while the app is open.
 */
object TextZoom {
    const val MIN = 50
    const val MAX = 300

    fun percent(fontScale: Float): Int {
        if (fontScale.isNaN() || fontScale <= 0f) return 100
        return (fontScale * 100f).roundToInt().coerceIn(MIN, MAX)
    }
}
