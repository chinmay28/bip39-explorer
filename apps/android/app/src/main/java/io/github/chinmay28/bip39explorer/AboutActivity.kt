package io.github.chinmay28.bip39explorer

import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.google.android.material.appbar.MaterialToolbar

/**
 * The app's one native screen: name, version, what the app does and does
 * not do, and the developer badge — tapped, it is thrown up full screen for
 * three seconds ([DevFlash]), as it is in the page's header.
 *
 * Reached from the launcher shortcut and, inside the app, from the page's
 * About button (window.bip39explorerApp.about()).
 */
class AboutActivity : AppCompatActivity() {
    private lateinit var flash: DevFlash

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_about)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root)) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        findViewById<MaterialToolbar>(R.id.toolbar).apply {
            setNavigationIcon(androidx.appcompat.R.drawable.abc_ic_ab_back_material)
            setNavigationContentDescription(androidx.appcompat.R.string.abc_action_bar_up_description)
            setNavigationOnClickListener { finish() }
        }
        findViewById<TextView>(R.id.version).text =
            getString(R.string.about_version, BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE)
        findViewById<View>(R.id.source).setOnClickListener {
            openInBrowser(this, getString(R.string.about_source_url))
        }

        flash = DevFlash(
            veil = findViewById(R.id.flash),
            lockup = findViewById(R.id.flash_lockup),
            logo = findViewById(R.id.flash_logo),
            behind = findViewById(R.id.content),
        )
        DevFlash.roundOff(findViewById(R.id.dev_badge_image))
        findViewById<View>(R.id.dev_badge).setOnClickListener { flash.show() }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (flash.showing) flash.dismiss() else finish()
            }
        })
    }

    override fun onDestroy() {
        flash.dismiss()
        super.onDestroy()
    }
}
