#!/usr/bin/env python3
"""
Meteor 本地下载引擎
------------------
在手机本地（DSH Go 的 Ubuntu 运行时）里跑 yt-dlp，对 App 暴露一个 127.0.0.1 的
HTTP 接口。没有云服务器、没有账号，所有流量只经过本机。

接口（全部返回 JSON）：
  GET  /health                 健康检查
  GET  /info?url=...           视频元数据（标题/封面/作者/可用清晰度）
  POST /download               开始下载 {url, quality: best|2160|1440|1080|720|480|360|audio}
  GET  /jobs                   任务列表（含进度）
  GET  /cancel?id=...          取消任务
  GET  /file?id=...            播放/下载已完成的文件（支持 Range）

启动：python3 server/ytdlp_server.py --port 8791
"""
import argparse
import glob
import re
import hashlib
import json
import os
import re
import shutil
import subprocess
import threading
import time
import traceback
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

try:
    import yt_dlp
    from yt_dlp.utils import DownloadError
except Exception as exc:  # pragma: no cover
    yt_dlp = None
    DownloadError = Exception
    YTDLP_IMPORT_ERROR = str(exc)
else:
    YTDLP_IMPORT_ERROR = None

ROOT = os.path.dirname(os.path.abspath(__file__))
JOBS_FILE = os.path.join(ROOT, "jobs.json")
FFMPEG_DIR = os.path.join(ROOT, "bin")
DEFAULT_OUT = "/sdcard/Download/Meteor"
OLD_OUT = "/sdcard/Download/DSH-Go/Meteor"
FALLBACK_OUT = os.path.join(ROOT, "downloads")
VERSION = "1.0.0"

JOBS = {}
JOBS_LOCK = threading.Lock()
QUEUE = []
QUEUE_LOCK = threading.Condition()
CACHE = {}
CACHE_LOCK = threading.Lock()
CONFIG = {"port": 8791, "out": DEFAULT_OUT, "token": ""}


def migrate_old_out():
    """把旧目录 DSH-Go/Meteor 里的文件迁移到 下载/Meteor。"""
    try:
        if not os.path.isdir(OLD_OUT):
            return
        os.makedirs(DEFAULT_OUT, exist_ok=True)
        for name in os.listdir(OLD_OUT):
            src = os.path.join(OLD_OUT, name)
            if not os.path.isfile(src):
                continue
            dst = os.path.join(DEFAULT_OUT, name)
            if os.path.exists(dst):
                continue
            shutil.move(src, dst)
        try:
            os.rmdir(OLD_OUT)
        except Exception:
            pass
    except Exception:
        pass


def pick_out_dir():
    for candidate in (CONFIG["out"], FALLBACK_OUT):
        try:
            os.makedirs(candidate, exist_ok=True)
            probe = os.path.join(candidate, ".meteor-write-test")
            with open(probe, "w") as f:
                f.write("ok")
            os.remove(probe)
            return candidate
        except Exception:
            continue
    return FALLBACK_OUT


def log(*args):
    line = "[meteor-engine] " + " ".join(str(a) for a in args)
    print(line, flush=True)
    try:
        with open(os.path.join(ROOT, "engine.log"), "a") as f:
            f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + line + "\n")
        if os.path.getsize(os.path.join(ROOT, "engine.log")) > 2 * 1024 * 1024:
            os.remove(os.path.join(ROOT, "engine.log"))
    except Exception:
        pass


def persist_jobs():
    try:
        with JOBS_LOCK:
            data = []
            for job in JOBS.values():
                data.append({
                    "id": job.get("id"),
                    "url": job.get("url"),
                    "quality": job.get("quality"),
                    "status": job.get("status"),
                    "title": job.get("title"),
                    "thumbnail": job.get("thumbnail"),
                    "uploader": job.get("uploader"),
                    "extractor": job.get("extractor"),
                    "webpage": job.get("webpage"),
                    "filename": job.get("filename"),
                    "filepath": job.get("filepath"),
                    "total": job.get("total"),
                    "downloaded": job.get("downloaded"),
                    "error": job.get("error"),
                    "startedAt": job.get("startedAt"),
                    "finishedAt": job.get("finishedAt"),
                    "createdAt": job.get("createdAt"),
                    "duration": job.get("duration"),
                })
        with open(JOBS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
    except Exception:
        pass


MEDIA_EXTS = {".mp4", ".webm", ".mkv", ".mov", ".m4v", ".mp3", ".m4a", ".aac",
              ".flac", ".wav", ".ogg", ".opus", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"}
INTERMEDIATE_RE = re.compile(r"\.f[0-9A-Za-z_-]+\.(mp4|webm|m4a|mp3|opus|aac|wav|flac|mkv|mov)$", re.I)


def is_intermediate(name):
    return bool(INTERMEDIATE_RE.search(name))


def scan_existing_files():
    """把输出目录里已存在的文件导入为已完成任务，App 能看到并播放/分享。"""
    try:
        for jid in list(JOBS.keys()):
            fp = JOBS.get(jid, {}).get("filepath") or ""
            if fp and is_intermediate(os.path.basename(fp)):
                JOBS.pop(jid, None)
        out = pick_out_dir()
        for name in sorted(os.listdir(out)):
            path = os.path.join(out, name)
            if not os.path.isfile(path):
                continue
            ext = os.path.splitext(name)[1].lower()
            if ext not in MEDIA_EXTS:
                continue
            if name.endswith(".compat720.mp4"):
                continue
            if is_intermediate(name):
                try:
                    os.remove(path)
                except Exception:
                    pass
                continue  # yt-dlp 分离音视频的中间文件
            size = os.path.getsize(path)
            if size <= 0:
                continue
            jid = "file-" + hashlib.md5(path.encode("utf-8")).hexdigest()[:10]
            existing_paths = {(j.get("filepath") or "") for j in JOBS.values()}
            if jid in JOBS or path in existing_paths:
                continue
            height = 0
            width = 0
            if ext in (".mp4", ".webm", ".mkv", ".mov", ".m4v"):
                try:
                    ffprobe = os.path.join(FFMPEG_DIR, "ffprobe")
                    if os.path.isfile(ffprobe):
                        out = subprocess.run([ffprobe, "-v", "error", "-select_streams", "v:0",
                                              "-show_entries", "stream=width,height",
                                              "-of", "csv=p=0", path],
                                             capture_output=True, text=True, timeout=10).stdout.strip()
                        if out:
                            parts = out.split(",")
                            width = int(parts[0]) if parts and parts[0].isdigit() else 0
                            height = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
                except Exception:
                    height = 0
            # 已有记录：补齐宽高
            existing = next((j for j in JOBS.values() if (j.get("filepath") or "") == path), None)
            if existing is not None:
                if not existing.get("height"):
                    existing["height"] = height
                    existing["width"] = width
                continue
            mtime = os.path.getmtime(path)
            base = os.path.splitext(name)[0]
            clean_title = re.sub(r"\s*\[[^\]]+\]$", "", base)
            job = {
                "id": jid,
                "url": "",
                "quality": "file",
                "title": clean_title,
                "thumbnail": "",
                "uploader": "本地文件",
                "extractor": "已下载",
                "webpage": "",
                "filename": name,
                "filepath": path,
                "total": size,
                "downloaded": size,
                "status": "done",
                "error": "",
                "startedAt": int(mtime * 1000),
                "finishedAt": int(mtime * 1000),
                "createdAt": int(mtime * 1000),
                "duration": 0,
                "width": width,
                "height": height,
            }
            JOBS[jid] = job
    except Exception:
        pass


def load_jobs():
    try:
        with open(JOBS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        seen_paths = set()
        for job in data:
            if not isinstance(job, dict) or not job.get("id"):
                continue
            if job.get("status") in ("queued", "running", "downloading", "processing"):
                job["status"] = "canceled"
                job["error"] = "engine restarted"
            fp = job.get("filepath") or ""
            if fp and not os.path.isfile(fp):
                continue
            if fp and fp in seen_paths:
                continue
            if fp:
                seen_paths.add(fp)
            JOBS[job["id"]] = job
    except Exception:
        pass


def job_public(job):
    out = {
        "id": job["id"],
        "url": job["url"],
        "title": re.sub(r"\s*\[[^\]]+\]$", "", job.get("title") or ""),
        "thumbnail": job.get("thumbnail") or "",
        "uploader": job.get("uploader") or "",
        "quality": job["quality"],
        "status": job["status"],
        "downloaded": int(job.get("downloaded") or 0),
        "total": int(job.get("total") or 0),
        "speed": float(job.get("speed") or 0),
        "eta": job.get("eta"),
        "percent": round(float(job.get("percent") or 0), 1),
        "filename": job.get("filename") or "",
        "error": job.get("error") or "",
        "startedAt": job.get("startedAt") or 0,
        "finishedAt": job.get("finishedAt") or 0,
        "duration": job.get("duration") or 0,
        "width": job.get("width") or 0,
        "height": job.get("height") or 0,
        "path": job.get("filepath") or "",
        "uploader": job.get("uploader") or "",
        "extractor": job.get("extractor") or "",
        "webpage": job.get("webpage") or "",
    }
    return out


def ytdlp_base_opts():
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "noprogress": True,
        "retries": 3,
        "fragment_retries": 3,
        "socket_timeout": 20,
        "outtmpl": os.path.join(pick_out_dir(), "%(title).120B [%(id)s].%(ext)s"),
        "restrictfilenames": False,
    }
    if os.path.isdir(FFMPEG_DIR):
        opts["ffmpeg_location"] = FFMPEG_DIR
    return opts


def build_format(quality):
    """手机解码更稳的格式：高度上限 1080，优先 H.264 + AAC。"""
    q = str(quality or "best").lower()
    if q in ("audio", "mp3", "m4a"):
        return "bestaudio/best", True
    h = 1080
    if q.isdigit():
        h = min(1080, max(240, int(q)))
    return (
        "bv*[height<=%d][vcodec^=avc1]+ba[acodec^=mp4a]/"
        "bv*[height<=%d][ext=mp4]+ba[ext=m4a]/"
        "b[height<=%d]/b" % (h, h, h)
    ), False


def fetch_info(url):
    if yt_dlp is None:
        raise RuntimeError("yt-dlp 未安装: " + str(YTDLP_IMPORT_ERROR))
    opts = ytdlp_base_opts()
    opts["skip_download"] = True
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    if info.get("_type") == "playlist":
        entries = info.get("entries") or []
        if entries:
            info = entries[0]
    heights = set()
    for fmt in info.get("formats") or []:
        h = fmt.get("height")
        if h:
            heights.add(int(h))
    heights = sorted(heights, reverse=True)
    return {
        "title": info.get("title") or "",
        "thumbnail": info.get("thumbnail") or "",
        "uploader": info.get("uploader") or info.get("channel") or "",
        "duration": info.get("duration") or 0,
        "webpage_url": info.get("webpage_url") or url,
        "extractor": info.get("extractor_key") or info.get("extractor") or "",
        "is_live": bool(info.get("is_live")),
        "heights": heights[:8],
    }


def find_output_file(job):
    if job.get("filepath") and os.path.exists(job["filepath"]):
        return job["filepath"]
    if job.get("filename") and os.path.exists(job["filename"]):
        return job["filename"]
    pattern = os.path.join(job["outdir"], "*" + job.get("ytid") + "*") if job.get("ytid") else None
    if pattern:
        files = [f for f in glob.glob(pattern) if os.path.isfile(f)]
        if files:
            return max(files, key=os.path.getmtime)
    return ""


def run_job(job):
    job["status"] = "running"
    job["startedAt"] = int(time.time() * 1000)

    def hook(d):
        if job.get("cancel"):
            raise Exception("canceled")
        if d.get("status") == "downloading":
            job["status"] = "downloading"
            job["downloaded"] = d.get("downloaded_bytes") or 0
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            if total:
                job["total"] = total
            job["speed"] = d.get("speed") or 0
            job["eta"] = d.get("eta")
            if total:
                job["percent"] = min(99.9, job["downloaded"] * 100.0 / total)
            if d.get("filename"):
                job["filename"] = d["filename"]
        elif d.get("status") == "finished":
            job["status"] = "processing"
            job["percent"] = 99.9
            job["speed"] = 0
            if d.get("filename"):
                job["filename"] = d["filename"]

    try:
        outdir = pick_out_dir()
        job["outdir"] = outdir
        fmt, audio_only = build_format(job["quality"])
        opts = ytdlp_base_opts()
        opts["format"] = fmt
        opts["progress_hooks"] = [hook]
        opts["outtmpl"] = os.path.join(outdir, "%(title).120B [%(id)s].%(ext)s")
        opts["postprocessors"] = []
        if audio_only:
            opts["postprocessors"].append({
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            })
        else:
            opts["merge_output_format"] = "mp4"

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(job["url"], download=False)
            if info.get("_type") == "playlist":
                entries = info.get("entries") or []
                if entries:
                    info = entries[0]
            job["title"] = info.get("title") or job.get("title") or ""
            job["thumbnail"] = info.get("thumbnail") or ""
            job["uploader"] = info.get("uploader") or ""
            job["duration"] = info.get("duration") or 0
            job["width"] = info.get("width") or 0
            job["height"] = info.get("height") or 0
            job["uploader"] = info.get("uploader") or info.get("channel") or ""
            job["extractor"] = info.get("extractor_key") or info.get("extractor") or ""
            job["webpage"] = info.get("webpage_url") or job.get("url") or ""
            job["ytid"] = info.get("id") or ""
            info = ydl.extract_info(job["url"], download=True)
            if info.get("_type") == "playlist":
                entries = info.get("entries") or []
                if entries:
                    info = entries[0]
            job["filename"] = info.get("requested_downloads", [{}])[0].get("filepath") or info.get("filepath") or job.get("filename") or ""
        time.sleep(0.4)
        path = find_output_file(job)
        job["filepath"] = path
        job["filename"] = os.path.basename(path) if path else job.get("filename") or ""
        if not path:
            raise RuntimeError("下载完成但找不到输出文件")
        try:
            job["total"] = os.path.getsize(path)
            job["downloaded"] = job["total"]
        except Exception:
            pass
        job["status"] = "done"
        job["percent"] = 100
        job["finishedAt"] = int(time.time() * 1000)
        try:
            if job.get("ytid"):
                for extra in glob.glob(os.path.join(job["outdir"], "*" + job["ytid"] + "*")):
                    if os.path.isfile(extra) and extra != path and is_intermediate(os.path.basename(extra)):
                        os.remove(extra)
        except Exception:
            pass
        persist_jobs()
        log("done", job["id"], job["title"], "->", path)
    except Exception as exc:
        msg = str(exc)
        if job.get("cancel") or "canceled" in msg.lower():
            job["status"] = "canceled"
            job["error"] = "canceled"
        else:
            job["status"] = "error"
            job["error"] = msg[:500]
            log("error", job["id"], msg)
            try:
                log(traceback.format_exc()[-1000:])
            except Exception:
                pass
        job["finishedAt"] = int(time.time() * 1000)
        job["speed"] = 0
        persist_jobs()


COMPAT = {}
COMPAT_LOCK = threading.Lock()


def compat_file(src):
    return src + ".compat720.mp4"


def run_compat(job):
    src = job.get("filepath") or ""
    if not src or not os.path.isfile(src):
        return {"ok": False, "status": "error", "error": "file missing"}
    target = compat_file(src)
    if os.path.isfile(target) and os.path.getsize(target) > 0:
        return {"ok": True, "status": "done", "path": target}
    with COMPAT_LOCK:
        st = COMPAT.get(job["id"])
        if st and st.get("status") == "running":
            return {"ok": True, "status": "running"}
        COMPAT[job["id"]] = {"status": "running"}

    def work():
        status = "error"
        try:
            ffmpeg = os.path.join(FFMPEG_DIR, "ffmpeg")
            if not os.path.isfile(ffmpeg):
                ffmpeg = "ffmpeg"
            cmd = [ffmpeg, "-y", "-i", src,
                   "-vf", "scale=-2:720",
                   "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26",
                   "-c:a", "aac", "-b:a", "128k",
                   "-movflags", "+faststart", target]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1800)
            if os.path.isfile(target) and os.path.getsize(target) > 0:
                status = "done"
        except Exception:
            status = "error"
        with COMPAT_LOCK:
            COMPAT[job["id"]] = {"status": status}

    threading.Thread(target=work, daemon=True).start()
    return {"ok": True, "status": "running"}


def worker_loop():
    while True:
        with QUEUE_LOCK:
            while not QUEUE:
                QUEUE_LOCK.wait()
            job_id = QUEUE.pop(0)
        job = JOBS.get(job_id)
        if job:
            run_job(job)


class Handler(BaseHTTPRequestHandler):
    server_version = "MeteorLocal/" + VERSION

    def log_message(self, fmt, *args):
        pass

    # ---------- helpers ----------
    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Meteor-Token")
        self.send_header("Access-Control-Max-Age", "86400")

    def authorized(self):
        token = CONFIG.get("token") or ""
        if not token:
            return True
        return self.headers.get("X-Meteor-Token", "") == token

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.cors()
        self.end_headers()
        try:
            self.wfile.write(body)
        except Exception:
            pass

    # ---------- routes ----------
    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if not self.authorized():
            return self.send_json({"ok": False, "error": "unauthorized"}, 401)
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        route = parsed.path.rstrip("/") or "/"

        if route == "/health":
            return self.send_json({
                "ok": True,
                "service": "meteor-local",
                "version": VERSION,
                "ytdlp": getattr(getattr(yt_dlp, "version", None), "__version__", None),
                "ffmpeg": os.path.isfile(os.path.join(FFMPEG_DIR, "ffmpeg")),
                "out": pick_out_dir(),
                "jobs": len(JOBS),
                "tokenRequired": bool(CONFIG.get("token")),
                "time": int(time.time()),
            })

        if route in ("/config", "/"):
            return self.send_json({
                "ok": True,
                "service": "meteor-local",
                "version": VERSION,
                "out": pick_out_dir(),
                "tokenRequired": bool(CONFIG.get("token")),
            })

        if route == "/info":
            url = (qs.get("url") or [""])[0]
            if not url:
                return self.send_json({"ok": False, "error": "missing url"}, 400)
            cached = CACHE.get(url)
            if cached and time.time() - cached[0] < 600:
                return self.send_json({"ok": True, "cached": True, **cached[1]})
            try:
                info = fetch_info(url)
                with CACHE_LOCK:
                    CACHE[url] = (time.time(), info)
                    if len(CACHE) > 100:
                        CACHE.pop(next(iter(CACHE)))
                return self.send_json({"ok": True, **info})
            except Exception as exc:
                return self.send_json({"ok": False, "error": str(exc)[:500]})

        if route == "/jobs":
            with JOBS_LOCK:
                jobs = sorted(JOBS.values(), key=lambda j: j.get("startedAt") or 0, reverse=True)
            return self.send_json({"ok": True, "jobs": [job_public(j) for j in jobs[:40]]})

        if route == "/cancel":
            jid = (qs.get("id") or [""])[0]
            job = JOBS.get(jid)
            if not job:
                return self.send_json({"ok": False, "error": "not found"}, 404)
            job["cancel"] = True
            if job["status"] in ("queued",):
                job["status"] = "canceled"
            persist_jobs()
            return self.send_json({"ok": True})

        if route == "/compat":
            jid = (qs.get("id") or [""])[0]
            job = JOBS.get(jid)
            if not job:
                return self.send_json({"ok": False, "status": "error", "error": "not found"}, 404)
            return self.send_json(run_compat(job))

        if route == "/play":
            raw_path = unquote((qs.get("p") or [""])[0])
            try:
                real = os.path.realpath(raw_path)
                out = os.path.realpath(pick_out_dir())
                if not (real == out or real.startswith(out + os.sep)):
                    return self.send_json({"ok": False, "error": "forbidden"}, 403)
                if not os.path.isfile(real):
                    return self.send_json({"ok": False, "error": "missing"}, 404)
            except Exception:
                return self.send_json({"ok": False, "error": "bad path"}, 400)
            return self.serve_file(real)

        if route == "/file":
            jid = (qs.get("id") or [""])[0]
            job = JOBS.get(jid)
            if not job:
                return self.send_json({"ok": False, "error": "not found"}, 404)
            path = job.get("filepath") or find_output_file(job)
            if not path or not os.path.isfile(path):
                return self.send_json({"ok": False, "error": "file missing"}, 404)
            return self.serve_file(path)

        return self.send_json({"ok": False, "error": "not found"}, 404)

    def do_POST(self):
        if not self.authorized():
            return self.send_json({"ok": False, "error": "unauthorized"}, 401)
        parsed = urlparse(self.path)
        route = parsed.path.rstrip("/") or "/"
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            data = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            data = {}

        if route == "/download":
            url = (data.get("url") or "").strip()
            quality = str(data.get("quality") or "best")
            if not url:
                return self.send_json({"ok": False, "error": "missing url"}, 400)
            if yt_dlp is None:
                return self.send_json({"ok": False, "error": "yt-dlp 未安装: " + str(YTDLP_IMPORT_ERROR)})
            job_id = uuid.uuid4().hex[:12]
            job = {
                "id": job_id,
                "url": url,
                "quality": quality,
                "status": "queued",
                "title": "",
                "percent": 0,
                "downloaded": 0,
                "total": 0,
                "speed": 0,
                "eta": None,
                "outdir": pick_out_dir(),
                "createdAt": int(time.time() * 1000),
            }
            with JOBS_LOCK:
                JOBS[job_id] = job
                # 只保留最近 100 条
                if len(JOBS) > 100:
                    oldest = sorted(JOBS.values(), key=lambda j: j["createdAt"])[:20]
                    for old in oldest:
                        JOBS.pop(old["id"], None)
            with QUEUE_LOCK:
                QUEUE.append(job_id)
                QUEUE_LOCK.notify()
            persist_jobs()
            return self.send_json({"ok": True, "id": job_id, "job": job_public(job)})

        if route == "/info":
            url = (data.get("url") or "").strip()
            if not url:
                return self.send_json({"ok": False, "error": "missing url"}, 400)
            try:
                info = fetch_info(url)
                return self.send_json({"ok": True, **info})
            except Exception as exc:
                return self.send_json({"ok": False, "error": str(exc)[:500]})

        return self.send_json({"ok": False, "error": "not found"}, 404)

    # ---------- file streaming (Range) ----------
    def serve_file(self, path):
        try:
            size = os.path.getsize(path)
            ctype = guess_mime(path)
            rng = self.headers.get("Range")
            start, end = 0, size - 1
            partial = False
            if rng and rng.startswith("bytes="):
                try:
                    spec = rng[6:].split(",")[0]
                    a, _, b = spec.partition("-")
                    if a:
                        start = int(a)
                    if b:
                        end = int(b)
                    end = min(end, size - 1)
                    if start > end:
                        start = 0
                    partial = True
                except Exception:
                    start, end, partial = 0, size - 1, False
            length = end - start + 1
            self.send_response(206 if partial else 200)
            self.send_header("Content-Type", ctype)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(length))
            if partial:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.cors()
            self.end_headers()
            with open(path, "rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(262144, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except Exception:
            pass


def guess_mime(path):
    ext = os.path.splitext(path)[1].lower()
    return {
        ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm",
        ".mkv": "video/x-matroska", ".mov": "video/quicktime",
        ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac",
        ".flac": "audio/flac", ".wav": "audio/wav", ".ogg": "audio/ogg",
        ".opus": "audio/opus", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
        ".pdf": "application/pdf",
    }.get(ext, "application/octet-stream")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8791)
    parser.add_argument("--out", default=os.environ.get("METEOR_OUT", DEFAULT_OUT))
    parser.add_argument("--token", default=os.environ.get("METEOR_TOKEN", ""))
    args = parser.parse_args()
    CONFIG["port"] = args.port
    CONFIG["out"] = args.out
    CONFIG["token"] = args.token
    migrate_old_out()
    pick_out_dir()
    load_jobs()
    scan_existing_files()
    persist_jobs()

    for _ in range(2):
        t = threading.Thread(target=worker_loop, daemon=True)
        t.start()

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.daemon_threads = True
    log("listening on http://127.0.0.1:%d" % args.port,
        "| out:", pick_out_dir(),
        "| yt-dlp:", "yes" if yt_dlp else "NO",
        "| ffmpeg:", os.path.isfile(os.path.join(FFMPEG_DIR, "ffmpeg")))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
