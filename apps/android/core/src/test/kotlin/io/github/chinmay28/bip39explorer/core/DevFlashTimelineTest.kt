package io.github.chinmay28.bip39explorer.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DevFlashTimelineTest {
    private val eps = 1e-3f

    @Test
    fun itIsThreeSeconds() {
        assertEquals(3000L, DevFlashTimeline.DURATION_MS)
    }

    @Test
    fun theVeilFadesInHoldsAndFadesOut() {
        assertEquals(0f, DevFlashTimeline.veilAlpha(0f), eps)
        assertEquals(1f, DevFlashTimeline.veilAlpha(0.07f), eps)
        assertEquals(1f, DevFlashTimeline.veilAlpha(0.5f), eps)
        assertEquals(1f, DevFlashTimeline.veilAlpha(0.82f), eps)
        assertEquals(0f, DevFlashTimeline.veilAlpha(1f), eps)
        val fadingIn = DevFlashTimeline.veilAlpha(0.035f)
        assertTrue(fadingIn > 0.2f && fadingIn < 0.8f)
    }

    @Test
    fun theBadgeLandsWithAnOvershootAndDriftsOut() {
        assertEquals(0.82f, DevFlashTimeline.badgeScale(0f), eps)
        assertEquals(1.02f, DevFlashTimeline.badgeScale(0.14f), eps)
        assertEquals(1f, DevFlashTimeline.badgeScale(0.22f), eps)
        assertEquals(1f, DevFlashTimeline.badgeScale(0.6f), eps)
        assertEquals(1.06f, DevFlashTimeline.badgeScale(1f), eps)
        // Fast out of the gate, as cubic-bezier(0.22, 1, 0.36, 1) is.
        assertTrue(DevFlashTimeline.badgeScale(0.05f) > 0.95f)
    }

    @Test
    fun outOfRangeIsClamped() {
        assertEquals(DevFlashTimeline.veilAlpha(0f), DevFlashTimeline.veilAlpha(-1f), eps)
        assertEquals(DevFlashTimeline.badgeScale(1f), DevFlashTimeline.badgeScale(2f), eps)
    }

    @Test
    fun cubicBezierMatchesKnownCurves() {
        val linear = CubicBezier(0f, 0f, 1f, 1f)
        for (x in listOf(0f, 0.25f, 0.5f, 0.75f, 1f)) assertEquals(x, linear.at(x), eps)
        val ease = CubicBezier(0.42f, 0f, 0.58f, 1f)
        assertEquals(0.5f, ease.at(0.5f), eps)
        assertTrue(ease.at(0.25f) < 0.25f)
        assertTrue(ease.at(0.75f) > 0.75f)
    }
}
