package io.github.chinmay28.bip39explorer

import android.content.Context
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import io.github.chinmay28.bip39explorer.core.AppOrigin
import io.github.chinmay28.bip39explorer.core.Bridge
import io.github.chinmay28.bip39explorer.core.BridgeCommand

/**
 * The page's one way to reach the app: `window.bip39explorerApp.about()`.
 *
 * `assets/bip39-bridge.js` is added at document start, before the page's own
 * scripts, and the [Bridge.OBJECT_NAME] object it posts to is injected —
 * both for the app's origin alone. On a web view too old for either, nothing
 * is installed and the page simply shows no About button; the launcher
 * shortcut still opens the screen.
 */
object PageBridge {
    fun install(context: Context, web: WebView, onCommand: (BridgeCommand) -> Unit): Boolean {
        // The script is useless without the object it posts to, so both
        // features or neither.
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return false
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return false
        val rules = setOf(AppOrigin.ORIGIN)
        val script = context.assets.open("bip39-bridge.js").bufferedReader().use { it.readText() }
        WebViewCompat.addWebMessageListener(web, Bridge.OBJECT_NAME, rules) {
                _: WebView, message: WebMessageCompat, sourceOrigin: android.net.Uri, isMainFrame: Boolean, _: JavaScriptReplyProxy ->
            Bridge.parse(message.data, sourceOrigin.toString(), isMainFrame)?.let(onCommand)
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, script, rules)
        }
        return true
    }
}
