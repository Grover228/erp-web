package ru.alexey.valera

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.util.AttributeSet
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import kotlin.math.min

class ValeraOrbView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    enum class State { WAITING, AWAKE, LISTENING, THINKING, SPEAKING }

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var phase = 0f
    private var state = State.WAITING

    private val animator = ValueAnimator.ofFloat(0f, 1f).apply {
        duration = 2200L
        repeatCount = ValueAnimator.INFINITE
        repeatMode = ValueAnimator.REVERSE
        interpolator = AccelerateDecelerateInterpolator()
        addUpdateListener {
            phase = it.animatedValue as Float
            invalidate()
        }
    }

    init {
        animator.start()
    }

    fun setState(newState: State) {
        state = newState
        invalidate()
    }

    override fun onDetachedFromWindow() {
        animator.cancel()
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val cx = width / 2f
        val cy = height / 2f
        val base = min(width, height) * 0.23f

        val pulse = when (state) {
            State.WAITING -> 0.05f
            State.AWAKE -> 0.18f
            State.LISTENING -> 0.14f
            State.THINKING -> 0.10f
            State.SPEAKING -> 0.20f
        }
        val radius = base * (1f + pulse * phase)

        val glowRadius = radius * 1.75f
        paint.shader = RadialGradient(
            cx, cy, glowRadius,
            intArrayOf(
                0xCC6EE7FF.toInt(),
                0x995D7CFF.toInt(),
                0x334A28CC.toInt(),
                0x004A28CC
            ),
            floatArrayOf(0f, 0.35f, 0.72f, 1f),
            Shader.TileMode.CLAMP
        )
        canvas.drawCircle(cx, cy, glowRadius, paint)

        paint.shader = RadialGradient(
            cx - radius * 0.25f,
            cy - radius * 0.30f,
            radius * 1.25f,
            intArrayOf(
                0xFFF6FFFF.toInt(),
                0xFF7BE8FF.toInt(),
                0xFF7169FF.toInt(),
                0xFF4720B8.toInt()
            ),
            null,
            Shader.TileMode.CLAMP
        )
        canvas.drawCircle(cx, cy, radius, paint)
        paint.shader = null
    }
}
