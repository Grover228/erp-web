plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "ru.alexey.valera"
    compileSdk = 35

    defaultConfig {
        applicationId = "ru.alexey.valera"
        minSdk = 28
        targetSdk = 35
        versionCode = 20
        versionName = "1.0.9"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        jniLibs {
            useLegacyPackaging = true
        }
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("net.java.dev.jna:jna:5.18.1@aar")
    implementation("com.alphacephei:vosk-android:0.3.75@aar")
    implementation("com.auth0:java-jwt:4.5.0")
    implementation("com.auth0:jwks-rsa:0.23.0")
}
