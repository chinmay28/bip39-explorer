package io.github.chinmay28.bip39explorer.core

import java.util.Locale

/** What the web view does with an address it was asked to open. */
enum class Navigation {
    /** Show it in the app: the app's own page. */
    IN_APP,

    /** Hand it to the phone's browser, with an ACTION_VIEW the person sees. */
    BROWSER,

    /** Refuse it. */
    BLOCK,
}

/**
 * Decides every navigation, so the web view only ever shows the app's own
 * page. The page has no links out today; if it gains one, it opens in the
 * browser — which has its own network and is the person's choice to follow —
 * never inside the app. Every other scheme (`intent:`, `javascript:`,
 * `file:`, `content:`, `mailto:`…) is refused: the explorer has no business
 * reaching into the phone.
 */
object NavigationPolicy {
    fun decide(url: String): Navigation {
        if (AppOrigin.contains(url)) return Navigation.IN_APP
        val scheme = url.substringBefore(':', "").lowercase(Locale.ROOT)
        return when (scheme) {
            "http", "https" -> Navigation.BROWSER
            else -> Navigation.BLOCK
        }
    }
}
