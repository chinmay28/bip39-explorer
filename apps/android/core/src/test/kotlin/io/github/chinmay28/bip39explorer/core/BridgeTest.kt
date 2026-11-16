package io.github.chinmay28.bip39explorer.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BridgeTest {
    private val origin = "https://appassets.androidplatform.net"

    @Test
    fun aboutFromThePageOpensAbout() {
        assertEquals(BridgeCommand.ABOUT, Bridge.parse("about", origin, isMainFrame = true))
        assertEquals(BridgeCommand.ABOUT, Bridge.parse("about", "$origin/", isMainFrame = true))
    }

    @Test
    fun anythingElseIsIgnored() {
        assertNull(Bridge.parse("save", origin, true))
        assertNull(Bridge.parse("about ", origin, true))
        assertNull(Bridge.parse("", origin, true))
        assertNull(Bridge.parse(null, origin, true))
    }

    @Test
    fun onlyTheAppsTopFrameIsHeard() {
        assertNull(Bridge.parse("about", origin, isMainFrame = false))
        assertNull(Bridge.parse("about", "https://example.com", true))
        assertNull(Bridge.parse("about", "http://appassets.androidplatform.net", true))
        assertNull(Bridge.parse("about", "null", true))
    }
}
