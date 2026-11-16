package io.github.chinmay28.bip39explorer.core

import org.junit.Assert.assertEquals
import org.junit.Test

class NavigationPolicyTest {
    @Test
    fun theAppsOwnPageStays() {
        assertEquals(Navigation.IN_APP, NavigationPolicy.decide("https://appassets.androidplatform.net/"))
        assertEquals(Navigation.IN_APP, NavigationPolicy.decide("https://appassets.androidplatform.net/#word=bird"))
    }

    @Test
    fun theWebGoesToTheBrowser() {
        assertEquals(Navigation.BROWSER, NavigationPolicy.decide("https://github.com/chinmay28/bip39-explorer"))
        assertEquals(Navigation.BROWSER, NavigationPolicy.decide("http://example.com/"))
        assertEquals(Navigation.BROWSER, NavigationPolicy.decide("HTTPS://example.com/"))
        // Looks like the app's origin, is not.
        assertEquals(Navigation.BROWSER, NavigationPolicy.decide("http://appassets.androidplatform.net/"))
    }

    @Test
    fun everythingElseIsRefused() {
        for (url in listOf(
            "intent://scan/#Intent;scheme=zxing;package=com.example;end",
            "javascript:alert(1)",
            "file:///sdcard/seed.txt",
            "content://com.android.contacts/contacts",
            "data:text/html,hi",
            "blob:https://appassets.androidplatform.net/1234",
            "about:blank",
            "mailto:someone@example.com",
            "market://details?id=x",
            "",
            "no-scheme-here",
        )) {
            assertEquals(url, Navigation.BLOCK, NavigationPolicy.decide(url))
        }
    }
}
