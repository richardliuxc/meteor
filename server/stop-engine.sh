#!/usr/bin/env bash
# 停止 Meteor 本地下载引擎
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$DIR/engine.pid"
if [ -f "$PIDFILE" ]; then
  PID="$(cat "$PIDFILE")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    echo "已停止本地引擎 (pid $PID)"
  else
    echo "进程不存在，清理 pid 文件"
  fi
  rm -f "$PIDFILE"
else
  pkill -f "ytdlp_server.py" 2>/dev/null && echo "已停止本地引擎" || echo "本地引擎未在运行"
fi
