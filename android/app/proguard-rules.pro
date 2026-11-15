# Thinkable Vault — ProGuard / R8 Rules
# Keep all public methods in MainActivity (WebView JS Bridge safety)
-keep class com.thinkable.vault.** { *; }

# Keep WebView JavaScript interface annotations
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# AndroidX WebKit
-keep class androidx.webkit.** { *; }

# Material Components
-keep class com.google.android.material.** { *; }

# Remove logging in release builds
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int i(...);
    public static int w(...);
    public static int d(...);
    public static int e(...);
}
