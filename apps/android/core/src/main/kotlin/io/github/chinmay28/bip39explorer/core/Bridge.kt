package io.github.chinmay28.bip39explorer.core

/** What the page can ask of the app. */
enum class BridgeCommand {
    /** Open the native About screen. */
    ABOUT,
}

/**
 * The page bridge's protocol: `assets/bip39-bridge.js` defines
 * `window.bip39explorerApp`, whose one method posts a message on the
 * [OBJECT_NAME] object the web view injects. It is a single command on
 * purpose — the bridge carries nothing from the page (no words, no text) and
 * nothing back.
 *
 * Both the script and the object are given to [AppOrigin] only; [parse]
 * checks that again for each message, and that it came from the top frame.
 */
object Bridge {
    const val OBJECT_NAME = "Bip39Android"

    fun parse(message: String?, sourceOrigin: String, isMainFrame: Boolean): BridgeCommand? {
        if (!isMainFrame || sourceOrigin.removeSuffix("/") != AppOrigin.ORIGIN) return null
        return when (message) {
            "about" -> BridgeCommand.ABOUT
            else -> null
        }
    }
}
