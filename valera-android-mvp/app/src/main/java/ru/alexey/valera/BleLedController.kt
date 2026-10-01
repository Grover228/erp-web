package ru.alexey.valera

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.os.Build
import java.util.UUID

data class BleLedConnectionState(
    val connected: Boolean,
    val ready: Boolean,
    val message: String
)

class BleLedController(
    private val context: Context,
    private val onState: (BleLedConnectionState) -> Unit
) {

    private var gatt: BluetoothGatt? = null
    private var writeCharacteristic: BluetoothGattCharacteristic? = null

    private val callback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(
            gatt: BluetoothGatt,
            status: Int,
            newState: Int
        ) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                onState(
                    BleLedConnectionState(
                        connected = true,
                        ready = false,
                        message = "Подключено. Читаю GATT…"
                    )
                )
                discoverServices(gatt)
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                writeCharacteristic = null
                onState(
                    BleLedConnectionState(
                        connected = false,
                        ready = false,
                        message = if (status == BluetoothGatt.GATT_SUCCESS) {
                            "Отключено"
                        } else {
                            "Соединение разорвано, GATT status=${status}"
                        }
                    )
                )
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                onState(
                    BleLedConnectionState(
                        connected = true,
                        ready = false,
                        message = "Не удалось прочитать сервисы, status=${status}"
                    )
                )
                return
            }

            val characteristic = findWriteCharacteristic(gatt.services)
            writeCharacteristic = characteristic

            if (characteristic == null) {
                val services = gatt.services.joinToString { service ->
                    service.uuid.toString().substring(4, 8).uppercase()
                }

                onState(
                    BleLedConnectionState(
                        connected = true,
                        ready = false,
                        message = "FFF3/FFE9 не найдены. Сервисы: ${services}"
                    )
                )
            } else {
                val shortUuid = characteristic.uuid.toString()
                    .substring(4, 8)
                    .uppercase()

                onState(
                    BleLedConnectionState(
                        connected = true,
                        ready = true,
                        message = "Готово • характеристика ${shortUuid}"
                    )
                )
            }
        }

        override fun onCharacteristicWrite(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            status: Int
        ) {
            onState(
                BleLedConnectionState(
                    connected = true,
                    ready = writeCharacteristic != null,
                    message = if (status == BluetoothGatt.GATT_SUCCESS) {
                        "Команда подтверждена контроллером"
                    } else {
                        "Ошибка записи GATT: ${status}"
                    }
                )
            )
        }
    }

    @SuppressLint("MissingPermission")
    fun connect(device: BluetoothDevice) {
        close()
        writeCharacteristic = null

        onState(
            BleLedConnectionState(
                connected = false,
                ready = false,
                message = "Подключаюсь к ${safeName(device)} • ${device.address}"
            )
        )

        gatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            device.connectGatt(
                context,
                false,
                callback,
                BluetoothDevice.TRANSPORT_LE
            )
        } else {
            @Suppress("DEPRECATION")
            device.connectGatt(context, false, callback)
        }
    }

    @SuppressLint("MissingPermission")
    fun close() {
        try {
            gatt?.disconnect()
        } catch (_: Throwable) {
        }

        try {
            gatt?.close()
        } catch (_: Throwable) {
        }

        gatt = null
        writeCharacteristic = null
    }

    fun powerOn(): Boolean =
        write(
            bytes(
                0x7E, 0x04, 0x04, 0xF0, 0x00, 0x01, 0xFF, 0x00, 0xEF
            )
        )

    fun powerOff(): Boolean =
        write(
            bytes(
                0x7E, 0x04, 0x04, 0x00, 0x00, 0x00, 0xFF, 0x00, 0xEF
            )
        )

    fun setColor(red: Int, green: Int, blue: Int): Boolean =
        write(
            bytes(
                0x7E,
                0x07,
                0x05,
                0x03,
                red.coerceIn(0, 255),
                green.coerceIn(0, 255),
                blue.coerceIn(0, 255),
                0x10,
                0xEF
            )
        )

    fun setBrightness(percent: Int): Boolean =
        write(
            bytes(
                0x7E,
                0x04,
                0x01,
                percent.coerceIn(0, 100),
                0x00,
                0x00,
                0x00,
                0x00,
                0xEF
            )
        )

    @SuppressLint("MissingPermission")
    private fun write(payload: ByteArray): Boolean {
        val currentGatt = gatt ?: return false
        val characteristic = writeCharacteristic ?: return false

        val supportsNoResponse =
            characteristic.properties and
                BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0

        val supportsWrite =
            characteristic.properties and
                BluetoothGattCharacteristic.PROPERTY_WRITE != 0

        val writeType = when {
            supportsNoResponse ->
                BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
            supportsWrite ->
                BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            else ->
                BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
        }

        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                currentGatt.writeCharacteristic(
                    characteristic,
                    payload,
                    writeType
                ) == BluetoothGatt.GATT_SUCCESS
            } else {
                @Suppress("DEPRECATION")
                characteristic.writeType = writeType
                @Suppress("DEPRECATION")
                characteristic.value = payload
                @Suppress("DEPRECATION")
                currentGatt.writeCharacteristic(characteristic)
            }
        } catch (_: Throwable) {
            false
        }
    }

    @SuppressLint("MissingPermission")
    private fun discoverServices(gatt: BluetoothGatt) {
        try {
            gatt.discoverServices()
        } catch (_: Throwable) {
            onState(
                BleLedConnectionState(
                    connected = true,
                    ready = false,
                    message = "Не удалось запустить discovery GATT"
                )
            )
        }
    }

    private fun findWriteCharacteristic(
        services: List<BluetoothGattService>
    ): BluetoothGattCharacteristic? {
        val preferred = listOf(
            SERVICE_FFF0 to CHAR_FFF3,
            SERVICE_FFE5 to CHAR_FFE9
        )

        for ((serviceUuid, characteristicUuid) in preferred) {
            val characteristic = services
                .firstOrNull { it.uuid == serviceUuid }
                ?.getCharacteristic(characteristicUuid)

            if (characteristic != null) {
                return characteristic
            }
        }

        return services
            .asSequence()
            .flatMap { it.characteristics.asSequence() }
            .firstOrNull { characteristic ->
                val props = characteristic.properties
                props and BluetoothGattCharacteristic.PROPERTY_WRITE != 0 ||
                    props and
                    BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0
            }
    }

    @SuppressLint("MissingPermission")
    private fun safeName(device: BluetoothDevice): String =
        try {
            device.name ?: "BLE-устройство"
        } catch (_: Throwable) {
            "BLE-устройство"
        }

    private fun bytes(vararg values: Int): ByteArray =
        ByteArray(values.size) { index -> values[index].toByte() }

    companion object {
        private val SERVICE_FFF0 =
            UUID.fromString("0000fff0-0000-1000-8000-00805f9b34fb")
        private val CHAR_FFF3 =
            UUID.fromString("0000fff3-0000-1000-8000-00805f9b34fb")
        private val SERVICE_FFE5 =
            UUID.fromString("0000ffe5-0000-1000-8000-00805f9b34fb")
        private val CHAR_FFE9 =
            UUID.fromString("0000ffe9-0000-1000-8000-00805f9b34fb")
    }
}
