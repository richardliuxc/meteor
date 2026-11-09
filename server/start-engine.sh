#!/usr/bin/env bash
# 启动 Meteor 本地下载引擎（yt-dlp 服务，127.0.0.1）
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8791}"
PIDFILE="$DIR/engine.pid"
LOG="$DIR/engine.out"

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "Meteor 本地引擎已在运行 (pid $(cat "$PIDFILE"))"
  exit 0
fi

if ! python3 -c "import yt_dlp" 2>/dev/null; then
  echo "缺少 yt-dlp，正在安装…"
  pip3 install -q yt-dlp
fi

mkdir -p "$DIR/bin"
if [ ! -x "$DIR/bin/ffmpeg" ]; then
  echo "提示：server/bin/ffmpeg 不存在，合并音视频/转 MP3 会失败。"
fi

nohup python3 "$DIR/ytdlp_server.py" --port "$PORT" >> "$LOG" 2>&1 &
echo $! > "$PIDFILE"
sleep 0.8

python3 - "$PORT" <<'PY'
import sys, urllib.request
port = sys.argv[1]
import time
last = None
for _ in range(20):
    try:
        with urllib.request.urlopen("http://127.0.0.1:%s/health" % port, timeout=2) as r:
            print("[ok] 本地引擎已启动:", r.read().decode())
            raise SystemExit(0)
    except SystemExit:
        raise
    except Exception as e:
        last = e
        time.sleep(0.5)
print("[!] 启动检查失败:", last)
print("    查看日志: server/engine.out")
PY
