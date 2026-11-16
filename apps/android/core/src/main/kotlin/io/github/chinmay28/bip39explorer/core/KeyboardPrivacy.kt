package io.github.chinmay28.bip39explorer.core

/**
 * What the app tells the keyboard about the page's text fields.
 *
 * Every word typed into the explorer is a BIP-39 word, and somebody exploring
 * the list may well type the words of their own phrase. A keyboard that
 * learns them — and many sync what they learn to a cloud account — would keep
 * a seed in its dictionary. So every field asks for incognito typing
 * (`IME_FLAG_NO_PERSONALIZED_LEARNING`, which Gboard and others honour) and no
 * suggestions. The page's search box already turns off spellcheck and
 * autocomplete; this is the part only the app can say.
 *
 * The values are Android's, which are fixed API; the app checks them against
 * the platform's own constants when it starts.
 */
object KeyboardPrivacy {
    const val IME_FLAG_NO_PERSONALIZED_LEARNING = 0x01000000
    const val TYPE_MASK_CLASS = 0x0000000f
    const val TYPE_CLASS_TEXT = 0x00000001
    const val TYPE_TEXT_FLAG_NO_SUGGESTIONS = 0x00080000

    fun imeOptions(current: Int): Int = current or IME_FLAG_NO_PERSONALIZED_LEARNING

    /** Text fields lose suggestions; numbers, phones and the like are left as they are. */
    fun inputType(current: Int): Int =
        if (current and TYPE_MASK_CLASS == TYPE_CLASS_TEXT) current or TYPE_TEXT_FLAG_NO_SUGGESTIONS else current
}
