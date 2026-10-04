package ru.alexey.valera

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.AudioManager

class MusicVoiceExecutor(private val context: Context) {
    private var player: MediaPlayer? = null
    private var currentStation: RadioStation? = null
    private var pendingStation: RadioStation? = null

    fun execute(command: MusicVoiceCommand): Result<String> = runCatching {
        when (command) {
            is MusicVoiceCommand.PlayStation -> play(command.station)
            MusicVoiceCommand.Stop -> stop()
            MusicVoiceCommand.Pause -> pause()
            MusicVoiceCommand.Resume -> resume()
        }
    }

    private fun play(station: RadioStation): String {
        releasePlayer()
        val newPlayer = MediaPlayer()
        player = newPlayer
        currentStation = station
        newPlayer.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
        )
        @Suppress("DEPRECATION")
        newPlayer.setAudioStreamType(AudioManager.STREAM_MUSIC)
        newPlayer.setDataSource(station.streamUrl)
        pendingStation = station
        newPlayer.setOnPreparedListener {
            it.start()
            it.setVolume(1.0f, 1.0f)
            pendingStation = null
        }
        newPlayer.setOnErrorListener { _, _, _ ->
            pendingStation = null
            releasePlayer()
            true
        }
        newPlayer.prepareAsync()
        return "Подключаю " + station.name + "."
    }

    private fun stop(): String {
        releasePlayer()
        return "Музыка выключена."
    }

    private fun pause(): String {
        val current = player
        if (current != null && current.isPlaying) {
            current.pause()
            return "Пауза."
        }
        return "Музыка сейчас не играет."
    }

    private fun resume(): String {
        val current = player
        if (current != null) {
            current.start()
            return "Продолжаю музыку."
        }
        return play(MusicVoiceCommands.record)
    }

    fun release() = releasePlayer()

    private fun releasePlayer() {
        try { player?.stop() } catch (_: Exception) {}
        try { player?.release() } catch (_: Exception) {}
        player = null
        currentStation = null
        pendingStation = null
    }
}
