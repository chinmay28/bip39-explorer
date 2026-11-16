package io.github.chinmay28.bip39explorer

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.graphics.Outline
import android.graphics.RenderEffect
import android.graphics.Shader
import android.os.Build
import android.view.View
import android.view.ViewOutlineProvider
import android.view.animation.LinearInterpolator
import io.github.chinmay28.bip39explorer.core.DevFlashTimeline
import kotlin.math.min

/**
 * The developer badge thrown up full screen — the native twin of the page's
 * `.dev-flash`: a veil over the screen (the background at 78%, the screen
 * behind it blurred where Android can), the badge over `github.com/chinmay28`
 * landing with a small overshoot, everything on one three-second clock from
 * [DevFlashTimeline]. A tap or Back ends it early.
 *
 * With animations turned off in the phone's settings (the native "reduce
 * motion"), the badge is shown still for the three seconds, as the CSS keeps
 * the cross-fade but drops the scale.
 */
class DevFlash(
    private val veil: View,
    private val lockup: View,
    private val logo: View,
    private val behind: View,
) {
    private var animator: ValueAnimator? = null
    private val hide = Runnable { finish() }

    val showing: Boolean get() = veil.visibility == View.VISIBLE

    init {
        roundOff(logo)
        veil.setOnClickListener { dismiss() }
    }

    fun show() {
        dismiss()
        // min(64vmin, 26rem), as the page sizes it.
        val metrics = veil.resources.displayMetrics
        val side = min(0.64f * min(metrics.widthPixels, metrics.heightPixels), 416f * metrics.density).toInt()
        logo.layoutParams = logo.layoutParams.apply { width = side; height = side }

        veil.visibility = View.VISIBLE
        if (Build.VERSION.SDK_INT >= 31) {
            behind.setRenderEffect(RenderEffect.createBlurEffect(14f * metrics.density, 14f * metrics.density, Shader.TileMode.CLAMP))
        }
        if (!ValueAnimator.areAnimatorsEnabled()) {
            veil.alpha = 1f
            lockup.scaleX = 1f
            lockup.scaleY = 1f
            veil.postDelayed(hide, DevFlashTimeline.DURATION_MS)
            return
        }
        animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = DevFlashTimeline.DURATION_MS
            interpolator = LinearInterpolator()
            addUpdateListener {
                val t = it.animatedFraction
                veil.alpha = DevFlashTimeline.veilAlpha(t)
                val scale = DevFlashTimeline.badgeScale(t)
                lockup.scaleX = scale
                lockup.scaleY = scale
            }
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    if (animator === animation) finish()
                }
            })
            start()
        }
    }

    fun dismiss() {
        val running = animator
        animator = null
        running?.cancel()
        finish()
    }

    private fun finish() {
        veil.removeCallbacks(hide)
        veil.visibility = View.GONE
        if (Build.VERSION.SDK_INT >= 31) behind.setRenderEffect(null)
    }

    companion object {
        /** Clips a badge image to a circle, as `border-radius: 50%` does. */
        fun roundOff(view: View) {
            view.outlineProvider = object : ViewOutlineProvider() {
                override fun getOutline(v: View, outline: Outline) = outline.setOval(0, 0, v.width, v.height)
            }
            view.clipToOutline = true
        }
    }
}
