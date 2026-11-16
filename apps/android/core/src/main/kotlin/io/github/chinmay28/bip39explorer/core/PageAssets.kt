package io.github.chinmay28.bip39explorer.core

/**
 * What the app serves on its origin: one page, and nothing else.
 *
 * The page is the explorer's single-file build (`dist/bip39-explorer.html`),
 * which carries its script, stylesheet, icons and the whole semantic index
 * inside itself, so there is nothing else for it to ask for. The build copies
 * it to [PAGE_ASSET]; every other path is a 404 answered by the app, never a
 * request that goes anywhere.
 */
object PageAssets {
    /** Where the build puts the page inside the APK's assets. */
    const val PAGE_ASSET = "web/index.html"

    const val MIME_TYPE = "text/html"
    const val ENCODING = "utf-8"

    /**
     * The asset for a request path, as WebViewAssetLoader hands it to a
     * handler registered on "/" (no leading slash, no query), or null for a
     * 404.
     */
    fun assetFor(path: String): String? =
        when (path.removePrefix("/")) {
            "", "index.html" -> PAGE_ASSET
            else -> null
        }

    /**
     * The headers the page is served with. The Content-Security-Policy is the
     * same promise the Go server makes with `connect-src 'none'`, adjusted for
     * a page whose scripts and styles are inline: nothing may be fetched,
     * framed, posted or registered as a worker. It is belt and braces — the
     * app has no network permission and its web view blocks network loads —
     * but it means a regression fails in the page's console as it would in a
     * browser.
     */
    val headers: Map<String, String> = mapOf(
        "Content-Security-Policy" to listOf(
            "default-src 'none'",
            "script-src 'unsafe-inline'",
            "style-src 'unsafe-inline'",
            "img-src data:",
            "font-src data:",
            "connect-src 'none'",
            "worker-src 'none'",
            "manifest-src 'none'",
            "form-action 'none'",
            "frame-ancestors 'none'",
            "base-uri 'none'",
        ).joinToString("; "),
        "X-Content-Type-Options" to "nosniff",
        "Referrer-Policy" to "no-referrer",
        "Cache-Control" to "no-store",
    )
}
