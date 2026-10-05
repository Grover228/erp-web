package ru.alexey.valera

import android.content.Context
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer

class MusicVoiceExecutor(private val context: Context) {
    private var player: ExoPlayer? = null
    private var currentStation: RadioStation? = null

    fun execute(command: MusicVoiceCommand): Result<String> = runCatching {
        when (command) {
            is MusicVoiceCommand.PlayStation -> play(command.station)
            MusicVoiceCommand.Stop -> stop()
            MusicVoiceCommand.Pause -> pause()
            MusicVoiceCommand.Resume -> resume()
        }
    }

    private fun ensurePlayer(): ExoPlayer {
        player?.let { return it }
        return ExoPlayer.Builder(context.applicationContext).build().also { exo ->
            exo.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                true
            )
            exo.addListener(object : Player.Listener {
                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .edit().putString(KEY_LAST_ERROR, error.errorCodeName + ": " + (error.message ?: "ошибка потока")).apply()
                }
            })
            player = exo
        }
    }

    private fun play(station: RadioStation): String {
        val exo = ensurePlayer()
        currentStation = station
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY_LAST_ERROR).apply()
        exo.stop()
        exo.clearMediaItems()
        exo.setMediaItem(MediaItem.fromUri(station.streamUrl))
        exo.prepare()
        exo.playWhenReady = true
        return "Подключаю " + station.name + "."
    }

    private fun stop(): String {
        player?.stop()
        currentStation = null
        return "Музыка выключена."
    }

    private fun pause(): String {
        val exo = player
        return if (exo != null && exo.isPlaying) {
            exo.pause()
            "Пауза."
        } else "Музыка сейчас не играет."
    }

    private fun resume(): String {
        val exo = player
        return if (exo != null && exo.mediaItemCount > 0) {
            exo.play()
            "Продолжаю музыку."
        } else play(MusicVoiceCommands.record)
    }

    fun release() {
        player?.release()
        player = null
        currentStation = null
    }

    companion object {
        const val PREFS = "valera-music"
        const val KEY_LAST_ERROR = "last_error"
    }
}
