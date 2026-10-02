package ru.alexey.valera

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.ContextCompat
import java.util.UUID

class LightControlActivity : Activity() {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var adapter: BluetoothAdapter
    private lateinit var controller: BleLedController

    private lateinit var statusText: TextView
    private lateinit var devicesContainer: LinearLayout
    private lateinit var scanButton: Button
    private lateinit var disconnectButton: Button
    private lateinit var lastDeviceButton: Button
    private val controlButtons = mutableListOf<Button>()

    private val foundDevices = linkedMapOf<String, BluetoothDevice>()
    private val deviceRssi = linkedMapOf<String, Int>()
    private var scanning = false
    private var selectedDevice: BluetoothDevice? = null

    private val stopScanRunnable = Runnable {
        stopScan()
        if (foundDevices.isEmpty()) {
            statusText.text =
                "BLEDDM не найден. Проверь, что лента включена и родное приложение закрыто."
        }
    }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            handleScanResult(result)
        }

        override fun onBatchScanResults(results: MutableList<ScanResult>) {
            results.forEach(::handleScanResult)
        }

        override fun onScanFailed(errorCode: Int) {
            scanning = false
            scanButton.text = "ИСКАТЬ BLEDDM"
            statusText.text = "Ошибка BLE-сканирования: $errorCode"
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val manager = getSystemService(BluetoothManager::class.java)
        adapter = manager.adapter

        controller = BleLedController(this) { state ->
            runOnUiThread {
                statusText.text = state.message
                setControlsEnabled(state.ready)
                disconnectButton.isEnabled = state.connected

                if (state.ready) {
                    selectedDevice?.let(::saveLastDevice)
                }
            }
        }

        setContentView(buildUi())
        refreshLastDeviceButton()

        if (!adapter.isEnabled) {
            statusText.text = "Включи Bluetooth"
        }
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        stopScan()
        controller.close()
        super.onDestroy()
    }

    private fun buildUi(): ScrollView {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(Color.rgb(7, 10, 19))
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 40, 28, 44)
        }

        root.addView(
            TextView(this).apply {
                text = "Свет • BLE"
                textSize = 30f
                setTextColor(Color.WHITE)
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }
        )

        root.addView(
            TextView(this).apply {
                text =
                    "BLEDDM / ELK-BLEDOM. После выбора ленты работают голосовые команды: «Валера, включи свет», цвета, яркость и таймер."
                textSize = 14f
                setTextColor(Color.rgb(160, 175, 205))
                setPadding(0, 8, 0, 22)
            }
        )

        statusText = TextView(this).apply {
            text = "Готов к поиску"
            textSize = 16f
            setTextColor(Color.rgb(125, 211, 252))
            setPadding(18, 16, 18, 16)
            setBackgroundColor(Color.rgb(17, 28, 55))
        }
        root.addView(
            statusText,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        )

        scanButton = makeButton("ИСКАТЬ BLEDDM") {
            ensureBlePermissionsAndScan()
        }
        addWithTopMargin(root, scanButton, 18)

        lastDeviceButton = makeButton("ПОДКЛЮЧИТЬ ПОСЛЕДНЮЮ") {
            connectLastDevice()
        }
        addWithTopMargin(root, lastDeviceButton, 10)

        devicesContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        addWithTopMargin(root, devicesContainer, 12)

        root.addView(sectionTitle("Управление"))

        val rowPower = makeRow(
            makeControlButton("ВКЛ") {
                sendCommand("Включение", controller::powerOn)
            },
            makeControlButton("ВЫКЛ") {
                sendCommand("Выключение", controller::powerOff)
            }
        )
        root.addView(rowPower)

        val rowColors = makeRow(
            makeControlButton("КРАСНЫЙ") {
                sendCommand("Красный") {
                    controller.setColor(255, 0, 0)
                }
            },
            makeControlButton("ЗЕЛЁНЫЙ") {
                sendCommand("Зелёный") {
                    controller.setColor(0, 255, 0)
                }
            },
            makeControlButton("СИНИЙ") {
                sendCommand("Синий") {
                    controller.setColor(0, 0, 255)
                }
            }
        )
        addWithTopMargin(root, rowColors, 10)

        val rowWhite = makeRow(
            makeControlButton("БЕЛЫЙ") {
                sendCommand("Белый") {
                    controller.setColor(255, 255, 255)
                }
            },
            makeControlButton("ФИОЛЕТОВЫЙ") {
                sendCommand("Фиолетовый") {
                    controller.setColor(160, 0, 255)
                }
            }
        )
        addWithTopMargin(root, rowWhite, 10)

        root.addView(sectionTitle("Яркость"))

        val rowBrightness = makeRow(
            makeControlButton("25%") {
                sendCommand("Яркость 25%") {
                    controller.setBrightness(25)
                }
            },
            makeControlButton("50%") {
                sendCommand("Яркость 50%") {
                    controller.setBrightness(50)
                }
            },
            makeControlButton("100%") {
                sendCommand("Яркость 100%") {
                    controller.setBrightness(100)
                }
            }
        )
        root.addView(rowBrightness)

        disconnectButton = makeButton("ОТКЛЮЧИТЬСЯ") {
            controller.close()
            selectedDevice = null
            statusText.text = "Отключено"
            setControlsEnabled(false)
        }.apply {
            isEnabled = false
        }
        addWithTopMargin(root, disconnectButton, 18)

        val backButton = makeButton("НАЗАД К ВАЛЕРЕ") {
            finish()
        }
        addWithTopMargin(root, backButton, 10)

        setControlsEnabled(false)
        scroll.addView(root)
        return scroll
    }

    private fun sectionTitle(text: String): TextView =
        TextView(this).apply {
            this.text = text
            textSize = 18f
            setTextColor(Color.WHITE)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, 26, 0, 12)
        }

    private fun makeButton(
        label: String,
        action: () -> Unit
    ): Button =
        Button(this).apply {
            text = label
            setOnClickListener { action() }
        }

    private fun makeControlButton(
        label: String,
        action: () -> Unit
    ): Button =
        makeButton(label, action).also {
            controlButtons += it
        }

    private fun makeRow(vararg buttons: Button): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER

            buttons.forEach { button ->
                addView(
                    button,
                    LinearLayout.LayoutParams(
                        0,
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        1f
                    ).apply {
                        marginEnd = 6
                        marginStart = 6
                    }
                )
            }
        }

    private fun addWithTopMargin(
        parent: LinearLayout,
        view: android.view.View,
        topMargin: Int
    ) {
        parent.addView(
            view,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                this.topMargin = topMargin
            }
        )
    }

    private fun setControlsEnabled(enabled: Boolean) {
        controlButtons.forEach { it.isEnabled = enabled }
    }

    private fun ensureBlePermissionsAndScan() {
        if (!adapter.isEnabled) {
            statusText.text = "Включаю системный запрос Bluetooth…"
            startActivityForResult(
                Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE),
                REQUEST_ENABLE_BLUETOOTH
            )
            return
        }

        val missing = requiredBlePermissions().filter {
            ContextCompat.checkSelfPermission(this, it) !=
                PackageManager.PERMISSION_GRANTED
        }

        if (missing.isNotEmpty()) {
            requestPermissions(
                missing.toTypedArray(),
                REQUEST_BLE_PERMISSIONS
            )
            return
        }

        startScan()
    }

    private fun requiredBlePermissions(): List<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            listOf(
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT
            )
        } else {
            listOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }

    @SuppressLint("MissingPermission")
    private fun startScan() {
        if (scanning) {
            stopScan()
            return
        }

        foundDevices.clear()
        deviceRssi.clear()
        devicesContainer.removeAllViews()

        val scanner = adapter.bluetoothLeScanner
        if (scanner == null) {
            statusText.text = "BLE-сканер недоступен"
            return
        }

        scanning = true
        scanButton.text = "ОСТАНОВИТЬ ПОИСК"
        statusText.text = "Ищу BLEDDM рядом…"

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        scanner.startScan(null, settings, scanCallback)

        handler.removeCallbacks(stopScanRunnable)
        handler.postDelayed(stopScanRunnable, 12000L)
    }

    @SuppressLint("MissingPermission")
    private fun stopScan() {
        if (!scanning) return

        try {
            adapter.bluetoothLeScanner?.stopScan(scanCallback)
        } catch (_: Throwable) {
        }

        scanning = false
        scanButton.text = "ИСКАТЬ BLEDDM"
        handler.removeCallbacks(stopScanRunnable)
    }

    @SuppressLint("MissingPermission")
    private fun handleScanResult(result: ScanResult) {
        val device = result.device
        val name = try {
            result.scanRecord?.deviceName ?: device.name ?: ""
        } catch (_: Throwable) {
            result.scanRecord?.deviceName ?: ""
        }

        val advertisedServices =
            result.scanRecord?.serviceUuids?.map { it.uuid }.orEmpty()

        val looksCompatible =
            name.contains("BLEDDM", ignoreCase = true) ||
                name.contains("BLEDOM", ignoreCase = true) ||
                name.contains("ELK", ignoreCase = true) ||
                advertisedServices.contains(SERVICE_FFF0) ||
                advertisedServices.contains(SERVICE_FFE5)

        if (!looksCompatible) return

        val address = device.address
        val isNew = !foundDevices.containsKey(address)

        foundDevices[address] = device
        deviceRssi[address] = result.rssi

        if (isNew) {
            rebuildDeviceButtons()
        } else {
            updateDeviceButtonLabels()
        }

        statusText.text = "Найдено контроллеров: ${foundDevices.size}"
    }

    @SuppressLint("MissingPermission")
    private fun rebuildDeviceButtons() {
        devicesContainer.removeAllViews()

        foundDevices.forEach { (address, device) ->
            val button = makeButton(deviceLabel(device, address)) {
                stopScan()
                selectedDevice = device
                setControlsEnabled(false)
                controller.connect(device)
            }

            button.tag = address
            addWithTopMargin(devicesContainer, button, 8)
        }
    }

    @SuppressLint("MissingPermission")
    private fun updateDeviceButtonLabels() {
        for (index in 0 until devicesContainer.childCount) {
            val button = devicesContainer.getChildAt(index) as? Button ?: continue
            val address = button.tag as? String ?: continue
            val device = foundDevices[address] ?: continue
            button.text = deviceLabel(device, address)
        }
    }

    @SuppressLint("MissingPermission")
    private fun deviceLabel(
        device: BluetoothDevice,
        address: String
    ): String {
        val name = try {
            device.name ?: "BLEDDM"
        } catch (_: Throwable) {
            "BLEDDM"
        }

        val rssi = deviceRssi[address]
        return if (rssi != null) {
            "$name\n$address • RSSI $rssi"
        } else {
            "$name\n$address"
        }
    }

    private fun sendCommand(
        label: String,
        command: () -> Boolean
    ) {
        val sent = command()

        statusText.text =
            if (sent) {
                "$label • команда отправлена"
            } else {
                "$label • команда не отправлена. Сначала подключись к ленте."
            }
    }

    @SuppressLint("MissingPermission")
    private fun saveLastDevice(device: BluetoothDevice) {
        val name = try {
            device.name ?: "BLEDDM"
        } catch (_: Throwable) {
            "BLEDDM"
        }

        getSharedPreferences(PREFS, MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_LIGHT_ADDRESS, device.address)
            .putString(KEY_LAST_LIGHT_NAME, name)
            .apply()

        refreshLastDeviceButton()
    }

    private fun refreshLastDeviceButton() {
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        val address = prefs.getString(KEY_LAST_LIGHT_ADDRESS, null)
        val name = prefs.getString(KEY_LAST_LIGHT_NAME, "BLEDDM")

        lastDeviceButton.isEnabled = !address.isNullOrBlank()
        lastDeviceButton.text =
            if (address.isNullOrBlank()) {
                "ПОСЛЕДНЯЯ ЛЕНТА НЕ ВЫБРАНА"
            } else {
                "ПОДКЛЮЧИТЬ $name • $address"
            }
    }

    @SuppressLint("MissingPermission")
    private fun connectLastDevice() {
        val missing = requiredBlePermissions().filter {
            ContextCompat.checkSelfPermission(this, it) !=
                PackageManager.PERMISSION_GRANTED
        }

        if (missing.isNotEmpty()) {
            requestPermissions(
                missing.toTypedArray(),
                REQUEST_BLE_PERMISSIONS
            )
            return
        }

        val address = getSharedPreferences(PREFS, MODE_PRIVATE)
            .getString(KEY_LAST_LIGHT_ADDRESS, null)

        if (address.isNullOrBlank()) {
            statusText.text = "Сначала найди и выбери ленту"
            return
        }

        try {
            val device = adapter.getRemoteDevice(address)
            selectedDevice = device
            setControlsEnabled(false)
            controller.connect(device)
        } catch (_: Throwable) {
            statusText.text = "Не удалось открыть сохранённый BLE-адрес"
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(
            requestCode,
            permissions,
            grantResults
        )

        if (requestCode == REQUEST_BLE_PERMISSIONS) {
            val granted = grantResults.isNotEmpty() &&
                grantResults.all { it == PackageManager.PERMISSION_GRANTED }

            if (granted) {
                startScan()
            } else {
                statusText.text = "Нужен доступ к Bluetooth для управления светом"
            }
        }
    }

    @Deprecated("Deprecated in Android API")
    override fun onActivityResult(
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        super.onActivityResult(requestCode, resultCode, data)

        if (
            requestCode == REQUEST_ENABLE_BLUETOOTH &&
            adapter.isEnabled
        ) {
            ensureBlePermissionsAndScan()
        }
    }

    companion object {
        private const val REQUEST_BLE_PERMISSIONS = 300
        private const val REQUEST_ENABLE_BLUETOOTH = 301

        private const val PREFS = "valera-light"
        private const val KEY_LAST_LIGHT_ADDRESS = "last_address"
        private const val KEY_LAST_LIGHT_NAME = "last_name"

        private val SERVICE_FFF0 =
            UUID.fromString("0000fff0-0000-1000-8000-00805f9b34fb")
        private val SERVICE_FFE5 =
            UUID.fromString("0000ffe5-0000-1000-8000-00805f9b34fb")
    }
}
