package io.github.chinmay28.bip39explorer

import android.content.Context
import android.util.AttributeSet
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.webkit.WebView
import io.github.chinmay28.bip39explorer.core.KeyboardPrivacy

/**
 * A web view whose text fields ask the keyboard not to learn what is typed
 * into them, nor to suggest — see [KeyboardPrivacy] for why a wordlist
 * explorer, of all apps, should ask.
 */
class PrivateKeyboardWebView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : WebView(context, attrs) {

    override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection? {
        val connection = super.onCreateInputConnection(outAttrs)
        outAttrs.imeOptions = KeyboardPrivacy.imeOptions(outAttrs.imeOptions)
        outAttrs.inputType = KeyboardPrivacy.inputType(outAttrs.inputType)
        return connection
    }

    private companion object {
        init {
            // :core spells Android's values out so it can be tested without
            // Android; they are fixed API, and this is where that is checked.
            check(KeyboardPrivacy.IME_FLAG_NO_PERSONALIZED_LEARNING == EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING)
            check(KeyboardPrivacy.TYPE_MASK_CLASS == EditorInfo.TYPE_MASK_CLASS)
            check(KeyboardPrivacy.TYPE_CLASS_TEXT == EditorInfo.TYPE_CLASS_TEXT)
            check(KeyboardPrivacy.TYPE_TEXT_FLAG_NO_SUGGESTIONS == EditorInfo.TYPE_TEXT_FLAG_NO_SUGGESTIONS)
        }
    }
}
