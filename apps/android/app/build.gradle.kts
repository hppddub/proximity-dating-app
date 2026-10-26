plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "ca.proximity.lab"
    compileSdk = 35
    defaultConfig { applicationId = "ca.proximity.lab"; minSdk = 31; targetSdk = 35; versionCode = 1; versionName = "0.1.0" }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")
    implementation("com.google.firebase:firebase-messaging:24.1.1")
}
