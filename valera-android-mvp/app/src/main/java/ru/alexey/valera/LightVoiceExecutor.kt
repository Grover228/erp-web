package ru.alexey.valera

import android.Manifest
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper

class LightVoiceExecutor(
    private val context: Context
) {

    private val handler = Handler(Looper.getMainLooper())
    private var activeController: BleLedController? = null
    private var activeTimeout: Runnable? = null

    fun execute(
        command: LightVoiceCommand,
        callback: (success: Boolean, message: String) -> Unit
    ) {
        closeActive()

        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            callback(
                false,
                "Нужен доступ к Bluetooth. Открой «Свет BLE» и дай разрешение."
            )
            return
        }

        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val address = prefs.getString(KEY_LAST_LIGHT_ADDRESS, null)

        if (address.isNullOrBlank()) {
            callback(
                false,
                "Лента ещё не выбрана. Один раз подключи её в разделе «Свет BLE»."
            )
            return
        }

        val manager = context.getSystemService(BluetoothManager::class.java)
        val adapter = manager?.adapter

        if (adapter == null || !adapter.isEnabled) {
            callback(false, "Bluetooth выключен")
            return
        }

        val device = try {
            adapter.getRemoteDevice(address)
        } catch (_: Throwable) {
            callback(false, "Не удалось открыть сохранённую ленту")
            return
        }

        var finished = false
        var commandSent = false
        lateinit var led: BleLedController

        fun finish(success: Boolean, message: String) {
            if (finished) return
            finished = true

            activeTimeout?.let(handler::removeCallbacks)
            activeTimeout = null

            callback(success, message)

            handler.postDelayed(
                {
                    if (activeController === led) {
                        led.close()
                        activeController = null
                    }
                },
                700L
            )
        }

        led = BleLedController(context) { state ->
            if (!finished) {
                if (state.ready && !commandSent) {
                    commandSent = true
                    val queued = performCommand(led, command)

                    if (queued) {
                        finish(true, LightVoiceCommands.describe(command))
                    } else {
                        finish(false, "Команда света не отправилась")
                    }
                } else if (
                    !state.connected &&
                    !state.ready &&
                    commandSent.not() &&
                    (
                        state.message.contains("разорвано", ignoreCase = true) ||
                        state.message.contains("ошиб", ignoreCase = true)
                    )
                ) {
                    finish(false, state.message)
                }
            }
        }

        activeController = led

        val timeout = Runnable {
            finish(false, "Не удалось подключиться к ленте")
        }
        activeTimeout = timeout
        handler.postDelayed(timeout, CONNECT_TIMEOUT_MS)

        try {
            led.connect(device)
        } catch (exception: Throwable) {
            finish(
                false,
                exception.message ?: "Ошибка подключения к ленте"
            )
        }
    }

    fun closeActive() {
        activeTimeout?.let(handler::removeCallbacks)
        activeTimeout = null

        activeController?.close()
        activeController = null
    }

    private fun performCommand(
        controller: BleLedController,
        command: LightVoiceCommand
    ): Boolean =
        when (command) {
            is LightVoiceCommand.Power ->
                if (command.on) {
                    controller.powerOn()
                } else {
                    controller.powerOff()
                }

            is LightVoiceCommand.Color ->
                controller.setColor(
                    command.red,
                    command.green,
                    command.blue
                )

            is LightVoiceCommand.Brightness ->
                controller.setBrightness(command.percent)

            else -> false
        }

    companion object {
        private const val PREFS = "valera-light"
        private const val KEY_LAST_LIGHT_ADDRESS = "last_address"
        private const val CONNECT_TIMEOUT_MS = 9000L
    }
}
