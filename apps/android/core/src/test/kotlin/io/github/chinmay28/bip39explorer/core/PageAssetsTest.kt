package io.github.chinmay28.bip39explorer.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PageAssetsTest {
    @Test
    fun theRootAndIndexAreThePage() {
        assertEquals("web/index.html", PageAssets.assetFor(""))
        assertEquals("web/index.html", PageAssets.assetFor("/"))
        assertEquals("web/index.html", PageAssets.assetFor("index.html"))
    }

    @Test
    fun everythingElseIsNotFound() {
        // The single-file page asks for nothing; a service worker, a manifest
        // or a stray asset path gets a 404 from the app, not a fetch.
        for (path in listOf("sw.js", "manifest.webmanifest", "assets/app.js", "favicon.ico",
            "../index.html", "web/index.html", "index.html/", "INDEX.HTML")) {
            assertNull(path, PageAssets.assetFor(path))
        }
    }

    @Test
    fun thePolicyForbidsEveryFetch() {
        val csp = PageAssets.headers.getValue("Content-Security-Policy").split("; ")
        assertTrue(csp.contains("default-src 'none'"))
        assertTrue(csp.contains("connect-src 'none'"))
        assertTrue(csp.contains("worker-src 'none'"))
        assertTrue(csp.contains("form-action 'none'"))
        // No source list anywhere names a scheme or host that could be reached.
        assertTrue(csp.none { it.contains("http") || it.contains("*") || it.contains("'self'") })
        assertEquals("no-referrer", PageAssets.headers["Referrer-Policy"])
    }
}
