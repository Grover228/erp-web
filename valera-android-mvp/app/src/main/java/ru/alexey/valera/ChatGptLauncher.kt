package ru.alexey.valera

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build

data class ChatGptLaunchResult(
    val success: Boolean,
    val usedFallback: Boolean,
    val detail: String
)

object ChatGptLauncher {

    fun launch(context: Context, config: ShellConfig): ChatGptLaunchResult {
        val packageName = config.chatGptPackage
        val activityName = config.chatGptVoiceActivity
        val component = ComponentName(packageName, activityName)

        val activityInfo = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.packageManager.getActivityInfo(
                    component,
                    PackageManager.ComponentInfoFlags.of(0)
                )
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getActivityInfo(component, 0)
            }
        } catch (_: PackageManager.NameNotFoundException) {
            null
        } catch (_: Throwable) {
            null
        }

        if (activityInfo != null && activityInfo.exported) {
            val requiredPermission = activityInfo.permission
            val permissionAllowed =
                requiredPermission.isNullOrBlank() ||
                    context.checkSelfPermission(requiredPermission) ==
                    PackageManager.PERMISSION_GRANTED

            if (permissionAllowed) {
                try {
                    context.startActivity(
                        Intent().apply {
                            component = component
                            addFlags(
                                Intent.FLAG_ACTIVITY_NEW_TASK or
                                    Intent.FLAG_ACTIVITY_CLEAR_TOP
                            )
                        }
                    )

                    return ChatGptLaunchResult(
                        success = true,
                        usedFallback = false,
                        detail = "direct"
                    )
                } catch (_: Throwable) {
                    // Ниже пробуем публичный voice deeplink.
                }
            }
        }

        return launchFallback(context, config)
    }

    private fun launchFallback(
        context: Context,
        config: ShellConfig
    ): ChatGptLaunchResult {
        return try {
            val fallbackIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse(config.chatGptVoiceFallbackUrl)
            ).apply {
                setPackage(config.chatGptPackage)
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
                )
            }

            if (fallbackIntent.resolveActivity(context.packageManager) == null) {
                ChatGptLaunchResult(
                    success = false,
                    usedFallback = true,
                    detail = "ChatGPT voice activity and fallback deeplink are unavailable"
                )
            } else {
                context.startActivity(fallbackIntent)
                ChatGptLaunchResult(
                    success = true,
                    usedFallback = true,
                    detail = "deeplink"
                )
            }
        } catch (exception: Throwable) {
            ChatGptLaunchResult(
                success = false,
                usedFallback = true,
                detail = exception.message ?: "ChatGPT launch failed"
            )
        }
    }
}
