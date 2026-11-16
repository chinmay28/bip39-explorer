package io.github.chinmay28.bip39explorer

import android.content.res.AssetManager
import android.net.Uri
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import io.github.chinmay28.bip39explorer.core.AppOrigin
import io.github.chinmay28.bip39explorer.core.PageAssets
import java.io.ByteArrayInputStream
import java.io.IOException

/**
 * Answers every request the web view makes, from inside the APK.
 *
 * The app's origin is served by WebViewAssetLoader with one handler on "/",
 * which knows one page ([PageAssets]) and answers anything else with a 404.
 * A request for any other origin is answered with a 403 here, before the web
 * view could try the network — which it could not reach anyway: the app has
 * no network permission and the web view blocks network loads.
 */
class PageServer(private val assets: AssetManager) {
    private val loader = WebViewAssetLoader.Builder()
        .setDomain(AppOrigin.HOST)
        .addPathHandler("/") { path -> page(path) }
        .build()

    fun answer(url: Uri): WebResourceResponse =
        if (AppOrigin.contains(url.toString())) {
            loader.shouldInterceptRequest(url) ?: empty(404, "Not Found")
        } else {
            empty(403, "Forbidden")
        }

    private fun page(path: String): WebResourceResponse {
        val asset = PageAssets.assetFor(path) ?: return empty(404, "Not Found")
        val stream = try {
            assets.open(asset)
        } catch (_: IOException) {
            return empty(404, "Not Found")
        }
        return WebResourceResponse(PageAssets.MIME_TYPE, PageAssets.ENCODING, 200, "OK", PageAssets.headers, stream)
    }

    private fun empty(status: Int, reason: String) =
        WebResourceResponse("text/plain", "utf-8", status, reason, PageAssets.headers, ByteArrayInputStream(ByteArray(0)))
}
