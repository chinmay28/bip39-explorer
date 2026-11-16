package io.github.chinmay28.bip39explorer.core

import org.junit.Assert.assertEquals
import org.junit.Test

class TextZoomTest {
    @Test
    fun followsTheFontScale() {
        assertEquals(100, TextZoom.percent(1f))
        assertEquals(85, TextZoom.percent(0.85f))
        assertEquals(115, TextZoom.percent(1.15f))
        assertEquals(130, TextZoom.percent(1.3f))
        assertEquals(200, TextZoom.percent(2f))
    }

    @Test
    fun staysWithinWhatAWebViewTakes() {
        assertEquals(TextZoom.MIN, TextZoom.percent(0.1f))
        assertEquals(TextZoom.MAX, TextZoom.percent(9f))
        assertEquals(100, TextZoom.percent(0f))
        assertEquals(100, TextZoom.percent(-1f))
        assertEquals(100, TextZoom.percent(Float.NaN))
    }
}
