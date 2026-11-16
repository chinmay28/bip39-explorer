package io.github.chinmay28.bip39explorer.core

import org.junit.Assert.assertEquals
import org.junit.Test

class KeyboardPrivacyTest {
    private val actionGo = 0x00000002
    private val textVariationUri = 0x00000010
    private val classNumber = 0x00000002

    @Test
    fun everyFieldAsksForIncognitoTyping() {
        assertEquals(actionGo or 0x01000000, KeyboardPrivacy.imeOptions(actionGo))
        assertEquals(0x01000000, KeyboardPrivacy.imeOptions(0))
        // Idempotent: asking twice is the same as once.
        assertEquals(KeyboardPrivacy.imeOptions(actionGo), KeyboardPrivacy.imeOptions(KeyboardPrivacy.imeOptions(actionGo)))
    }

    @Test
    fun textFieldsLoseSuggestions() {
        val text = KeyboardPrivacy.TYPE_CLASS_TEXT or textVariationUri
        assertEquals(text or 0x00080000, KeyboardPrivacy.inputType(text))
    }

    @Test
    fun otherFieldsAreLeftAlone() {
        assertEquals(classNumber, KeyboardPrivacy.inputType(classNumber))
        assertEquals(0, KeyboardPrivacy.inputType(0))
    }
}
