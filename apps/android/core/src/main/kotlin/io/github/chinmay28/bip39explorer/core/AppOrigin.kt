package io.github.chinmay28.bip39explorer.core

import java.net.URI
import java.util.Locale

/**
 * The one origin the app's page lives on.
 *
 * `https://appassets.androidplatform.net` is the address androidx.webkit's
 * WebViewAssetLoader reserves for an app's own files: the web view never
 * resolves it, the app answers every request to it from inside the APK. An
 * https origin rather than `file://` gives the page a stable, secure origin of
 * its own — the same one on every launch — and keeps `file://` access off.
 */
object AppOrigin {
    const val HOST = "appassets.androidplatform.net"
    const val ORIGIN = "https://$HOST"
    const val START_URL = "$ORIGIN/"

    /**
     * Is [url] on the app's origin? Exactly https, exactly this host, the
     * default port and no user info: anything else that merely mentions the
     * host (`https://appassets.androidplatform.net.example`, `http://…`,
     * `https://x@appassets…`) is somewhere else.
     */
    fun contains(url: String): Boolean {
        val uri = try {
            URI(url)
        } catch (_: Exception) {
            return false
        }
        return uri.scheme?.lowercase(Locale.ROOT) == "https" &&
            uri.rawUserInfo == null &&
            uri.host?.lowercase(Locale.ROOT) == HOST &&
            (uri.port == -1 || uri.port == 443)
    }
}
