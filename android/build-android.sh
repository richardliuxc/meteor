#!/usr/bin/env bash
# ============================================================
# OmniGet Studio · Android APK 构建脚本
# 在 aarch64 Ubuntu(proot) 上直接用 Debian 的 aapt/zipalign +
# Android build-tools 里的 d8/apksigner jar 打包，无需 Gradle/SDK。
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$(cd "$ROOT/.." && pwd)"
BUILD="$ROOT/build"
DIST="$PROJECT/dist"

JAVA_HOME="${JAVA_HOME:-/opt/jdk17}"
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

ANDTOOLS="${ANDTOOLS:-/opt/andtools/usr/lib/android-sdk/build-tools/debian}"
AAPT="$ANDTOOLS/aapt"
ZIPALIGN="$ANDTOOLS/zipalign"
D8_JAR="${D8_JAR:-/opt/android-buildtools/android-14/lib/d8.jar}"
APKSIGNER_JAR="${APKSIGNER_JAR:-/opt/android-buildtools/android-14/lib/apksigner.jar}"
ANDROID_JAR="${ANDROID_JAR:-/opt/android-platform/android-34/android.jar}"

APP_NAME="Meteor"
VERSION_NAME="1.6.0"
VERSION_CODE="7"

echo "==> 检查工具链"
for f in "$AAPT" "$ZIPALIGN" "$D8_JAR" "$APKSIGNER_JAR" "$ANDROID_JAR" "$JAVA_HOME/bin/javac"; do
  if [ ! -e "$f" ]; then echo "缺少: $f"; exit 1; fi
done
java -version 2>&1 | head -1

echo "==> 清理构建目录"
rm -rf "$BUILD"
mkdir -p "$BUILD/classes" "$BUILD/dex"

echo "==> 生成签名密钥（首次）"
KS="$ROOT/meteor-debug.jks"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -v -keystore "$KS" -storepass android -keypass android \
    -alias meteor -keyalg RSA -keysize 2048 -validity 12000 \
    -dname "CN=Meteor, OU=Dev, O=Meteor, L=Local, ST=Local, C=CN" >/dev/null 2>&1
  echo "    已生成 $KS"
fi

echo "==> 生成 R.java"
rm -rf "$BUILD/gen"
mkdir -p "$BUILD/gen"
"$AAPT" package -f -m -J "$BUILD/gen" -M "$ROOT/AndroidManifest.xml" \
  -S "$ROOT/res" -I "$ANDROID_JAR" 2>&1 | tail -3

echo "==> 编译 Java"
javac -source 8 -target 8 -encoding UTF-8 -classpath "$ANDROID_JAR" \
  -d "$BUILD/classes" \
  $(find "$BUILD/gen" -name '*.java') \
  "$ROOT"/java/com/meteor/download/*.java

echo "==> Dex (d8)"
CLASS_FILES=$(find "$BUILD/classes" -name '*.class')
java -cp "$D8_JAR" com.android.tools.r8.D8 \
  --release --min-api 26 --lib "$ANDROID_JAR" \
  --output "$BUILD/dex" \
  $CLASS_FILES 2>&1 | tail -8

echo "==> 打包资源（aapt）"
"$AAPT" package -f -M "$ROOT/AndroidManifest.xml" \
  -S "$ROOT/res" -A "$ROOT/assets" -I "$ANDROID_JAR" \
  -F "$BUILD/base.apk" 2>&1 | tail -5

echo "==> 加入 classes.dex"
(cd "$BUILD/dex" && zip -q -j "$BUILD/base.apk" classes.dex)

echo "==> zipalign"
"$ZIPALIGN" -f 4 "$BUILD/base.apk" "$BUILD/aligned.apk"

echo "==> 签名"
mkdir -p "$DIST"
java -jar "$APKSIGNER_JAR" sign \
  --ks "$KS" --ks-pass pass:android --key-pass pass:android --ks-key-alias meteor \
  --out "$DIST/$APP_NAME.apk" "$BUILD/aligned.apk"

echo "==> 校验"
java -jar "$APKSIGNER_JAR" verify --verbose "$DIST/$APP_NAME.apk" | head -8
"$AAPT" dump badging "$DIST/$APP_NAME.apk" | grep -E "^(package|application-label|sdkVersion|targetSdkVersion|launchable-activity|uses-permission)" | head -12

ls -lh "$DIST/$APP_NAME.apk"
echo "==> 完成: $DIST/$APP_NAME.apk"
