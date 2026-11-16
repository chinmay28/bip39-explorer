package io.github.chinmay28.bip39explorer.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppOriginTest {
    @Test
    fun theStartPageIsOnTheOrigin() {
        assertEquals("https://appassets.androidplatform.net/", AppOrigin.START_URL)
        assertTrue(AppOrigin.contains(AppOrigin.START_URL))
        assertTrue(AppOrigin.contains("https://appassets.androidplatform.net/index.html?x=1#top"))
        assertTrue(AppOrigin.contains("HTTPS://AppAssets.AndroidPlatform.net/"))
        assertTrue(AppOrigin.contains("https://appassets.androidplatform.net:443/"))
    }

    @Test
    fun lookalikesAreSomewhereElse() {
        assertFalse(AppOrigin.contains("http://appassets.androidplatform.net/"))
        assertFalse(AppOrigin.contains("https://appassets.androidplatform.net:8443/"))
        assertFalse(AppOrigin.contains("https://appassets.androidplatform.net.example.com/"))
        assertFalse(AppOrigin.contains("https://evil.example/appassets.androidplatform.net/"))
        assertFalse(AppOrigin.contains("https://x@appassets.androidplatform.net/"))
        assertFalse(AppOrigin.contains("file:///android_asset/web/index.html"))
        assertFalse(AppOrigin.contains("not a url at all"))
        assertFalse(AppOrigin.contains(""))
    }
}
