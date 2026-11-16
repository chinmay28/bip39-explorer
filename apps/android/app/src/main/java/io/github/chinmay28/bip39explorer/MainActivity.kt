package io.github.chinmay28.bip39explorer

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import io.github.chinmay28.bip39explorer.core.AppOrigin
import io.github.chinmay28.bip39explorer.core.BridgeCommand
import io.github.chinmay28.bip39explorer.core.Navigation
import io.github.chinmay28.bip39explorer.core.NavigationPolicy
import io.github.chinmay28.bip39explorer.core.TextZoom

/**
 * The app: the explorer's own page, served from inside the APK.
 *
 * There is no server, no address and no setup. The page is the single-file
 * build of apps/web — the same one that runs from a USB stick — answered on
 * https://appassets.androidplatform.net by [PageServer]. The app adds what a
 * phone does better than a page: dark mode and text size that follow the
 * system, a keyboard told not to learn what is typed ([PrivateKeyboardWebView]),
 * and a native About screen with the developer badge.
 *
 * FLAG_SECURE is deliberately not set. Everything on screen is the public
 * BIP-39 list and a graph of what its words mean; there is nowhere to type a
 * phrase. Blocking screenshots would protect nothing, would get in the way of
 * sharing what the explorer shows, and would suggest the screen holds a secret
 * when the whole design is that it never does.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var web: PrivateKeyboardWebView
    private lateinit var server: PageServer

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        web = findViewById(R.id.web)
        server = PageServer(assets)

        // The page lays itself out for the screen it is given; the bars, the
        // cutout and the keyboard are kept out of it here.
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root)) { v, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime(),
            )
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack() else finish()
            }
        })

        setUpWebView()
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(AppOrigin.START_URL)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        web.settings.textZoom = TextZoom.percent(newConfig.fontScale)
    }

    override fun onDestroy() {
        (web.parent as? ViewGroup)?.removeView(web)
        web.destroy()
        super.onDestroy()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setUpWebView() {
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            // Nothing outside the APK, by any route.
            blockNetworkLoads = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setGeolocationEnabled(false)
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            mediaPlaybackRequiresUserGesture = true
            builtInZoomControls = false
            // The page is laid out for the phone (its viewport tag says
            // device-width); overview mode would zoom out to its widest part.
            loadWithOverviewMode = false
            useWideViewPort = true
            textZoom = TextZoom.percent(resources.configuration.fontScale)
        }
        // The page has its own dark theme, chosen by prefers-color-scheme,
        // which the web view takes from this activity's DayNight theme. It
        // must not also be darkened by the web view.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(web.settings, false)
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SAFE_BROWSING_ENABLE)) {
            WebSettingsCompat.setSafeBrowsingEnabled(web.settings, false)
        }

        PageBridge.install(this, web) { command ->
            when (command) {
                BridgeCommand.ABOUT -> startActivity(Intent(this, AboutActivity::class.java))
            }
        }

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse =
                server.answer(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                route(request.url.toString())

            // A renderer that crashed or was reclaimed takes the page with
            // it; start the screen again rather than the whole app.
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                recreate()
                return true
            }
        }
    }

    /** Where a navigation goes; true when the web view must not follow it. */
    private fun route(url: String): Boolean =
        when (NavigationPolicy.decide(url)) {
            Navigation.IN_APP -> false
            Navigation.BROWSER -> {
                openInBrowser(this, url)
                true
            }
            Navigation.BLOCK -> true
        }
}

/**
 * Hands an http(s) address to the phone's browser — a visible hand-off the
 * person makes, from an app that has no network of its own.
 */
fun openInBrowser(activity: AppCompatActivity, url: String) {
    try {
        activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE))
    } catch (_: ActivityNotFoundException) {
        Toast.makeText(activity, R.string.no_browser, Toast.LENGTH_SHORT).show()
    }
}
