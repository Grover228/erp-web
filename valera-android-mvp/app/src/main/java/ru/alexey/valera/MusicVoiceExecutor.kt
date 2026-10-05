package ru.alexey.valera

import android.content.Context
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import android.content.Intent
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
                override fun onPlaybackStateChanged(playbackState: Int) {
                    val state = when (playbackState) {
                        Player.STATE_BUFFERING -> "Подключение к радио…"
                        Player.STATE_READY -> if (exo.playWhenReady) "Радио играет" else "Радио готово"
                        Player.STATE_ENDED -> "Поток завершён"
                        else -> return
                    }
                    publishStatus(state)
                }
                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    if (isPlaying) publishStatus("Радио играет")
                }
                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    val message = "Ошибка радио: " + error.errorCodeName + " • " + (error.cause?.message ?: error.message ?: "неизвестная ошибка")
                    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_LAST_ERROR, message).apply()
                    publishStatus(message)
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

    private fun publishStatus(message: String) {
        context.sendBroadcast(Intent(ACTION_MUSIC_STATUS).setPackage(context.packageName).putExtra(EXTRA_MESSAGE, message))
    }

    fun release() {
        player?.release()
        player = null
        currentStation = null
    }

    companion object {
        const val PREFS = "valera-music"
        const val KEY_LAST_ERROR = "last_error"
        const val ACTION_MUSIC_STATUS = "ru.alexey.valera.MUSIC_STATUS"
        const val EXTRA_MESSAGE = "message"
    }
}
