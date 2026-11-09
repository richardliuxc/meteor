# Meteor · 流星下载（Android）

> 基于 [OpenSelena/omniget](https://github.com/OpenSelena/omniget) 的界面与产品理念重制的 Android App。
> **一个 APK、纯原生界面、零云端后端**：直连下载 + 本地 yt-dlp 引擎（手机本机 127.0.0.1）。

![Meteor](</root/workspace/omniget-studio/docs/brand-banner.png>)

---

## 一、这一版改了什么（重要）

上一版用 WebView 承载界面，在华为/部分旧 WebView 上出现「输入框点不了、按钮没反应」。**v1.2.0 已彻底移除 WebView**，界面改为 Android 原生控件（Java + 系统 View）：

- 输入框、按钮、下拉、列表全部是原生控件，点击/输入一定响应；
- 启动时会做异常兜底：即使 UI 构建出错，也会显示「Meteor 启动异常 + 错误信息」，不会白屏；
- 崩溃日志写到 `Android/data/com.meteor.download/files/crash.log`。

包名仍是 `com.meteor.download`（和 v1.1 相同，可直接覆盖安装）。
如果你手机里还留着旧的 **OmniGet Studio**，请卸载它，避免打开错 App。

---

### v1.4.0 更新（播放黑屏修复）
- 平台下载默认限制 **1080p 以内**，并优先 **H.264 + AAC**（手机解码兼容性最好）；
- 播放器增加黑屏/首帧检测：8 秒无画面会提示；
- 遇到超分辨率/编码不支持时，可一键让本地引擎**转码为 720p 兼容格式**再播放；
- 新增引擎接口 `/compat?id=`（转码）与 `/play?p=`（范围流），并保留「用系统播放器打开」兜底；
- 播放器加「正在加载 / 正在转码」状态提示。

### v1.3.0 更新
- 底部导航改为「图标 + 文字」横排，间距收紧；
- 下载卡片新增「来源 / 开始时间 / 完成时间」；
- 新增 **App 内播放器**（视频/音频，带进度条），不再跳系统下载目录；
- 新增 **分享按钮**（任务卡片 + 播放器内）；
- 引擎任务历史持久化 + 自动导入下载目录里已有的文件；
- 本地引擎启动脚本增加健康检查重试。

## 二、交付物

| 文件 | 说明 |
|---|---|
| `dist/Meteor.apk` | Android 安装包（约 311 KB，minSdk 26 / target 34，debug 自签名） |
| `dist/Meteor.html` | 网页版（浏览器打开即用，含本地引擎客户端） |
| `server/` | 本地引擎：yt-dlp HTTP 服务 + 启动/停止脚本 |
| `docs/app-icon.png` / `docs/brand-banner.png` | Logo 与品牌图 |

安装：文件管理器点开 APK → 允许「安装未知应用」→ 打开。

---

## 三、使用

### 1）直连下载（不需要任何服务）
首页粘贴 http/https 直链（mp4 / mp3 / 图片 / PDF / zip…）→「解析链接」→ 看到文件名/大小 →「开始下载」。
下载交给 Android 系统 DownloadManager：有进度/速度/剩余时间，可取消，文件写入系统「下载」目录。

### 下载列表（v1.3.0 新增）
每个任务卡片显示：来源（域名 / 上传者）、大小、已下载量、速度、剩余时间、**开始/完成时间**；
操作按钮：取消、重试、**打开（App 内播放）**、**分享**。
引擎下载的文件通过本地 HTTP Range 流在 App 内播放，不再需要去文件管理器里翻目录。

### 2）YouTube / B 站等：本地 yt-dlp 引擎
在 DSH Go 的 Ubuntu 本地环境启动引擎：

```bash
bash /root/workspace/omniget-studio/server/start-engine.sh
```

App 顶栏会显示「● 引擎在线」；首页粘贴 YouTube 链接 → 显示标题/封面/清晰度（1080p/720p/仅音频…）→「用本地引擎下载」。
文件保存到 `下载/DSH-Go/Meteor/`；下载完成后在 App 里点「打开」直接播放（或「分享」发给其他 App）。
引擎重启后会从 `server/jobs.json` 恢复历史，并自动扫描该目录里已下载的文件，所以之前的视频也会出现在列表里。
引擎只监听 `127.0.0.1:8791`，不经过云服务器。

停止引擎：`server/stop-engine.sh`。DSH Go 退出后引擎会停，重新启动即可。

### 3）其他
- **分享链接**：其他 App 分享链接给 Meteor，自动填入并解析；
- **三个页签**：首页 / 下载 / 设置；
- **设置**：引擎地址与检测、下载目录、版本信息；
- 下载记录会持久化（重启 App 仍在）；已下载文件在系统下载目录。

---

## 四、本地引擎接口（127.0.0.1:8791）

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/health` | 健康检查（yt-dlp / ffmpeg / 输出目录） |
| GET | `/info?url=` | 视频元数据（标题、封面、作者、时长、清晰度） |
| POST | `/download` | `{url, quality}` → 任务 id |
| GET | `/jobs` | 任务与实时进度 |
| GET | `/cancel?id=` | 取消任务 |
| GET | `/file?id=` | 播放/下载已完成文件（支持 Range） |
| GET | `/compat?id=` | 把高分辨率/特殊编码转成 720p H.264 兼容格式 |
| GET | `/play?p=` | 按路径流式播放输出目录内的文件（Range） |

依赖：python3 + yt-dlp（已安装）、`server/bin/ffmpeg`（已放置静态二进制）。

---

## 五、排障

| 现象 | 处理 |
|---|---|
| 打开后提示「Meteor 启动异常」 | 把错误信息截图发我；同时可看 `Android/data/com.meteor.download/files/crash.log` |
| 顶栏「引擎离线」 | 运行 `server/start-engine.sh`，或在设置里点「检测」 |
| 下载失败 | 直链失败多为 CORS/链接失效或需要登录；平台链接看引擎日志 `server/engine.out` |
| 打开的是旧界面 | 确认 App 图标是深色+橙色流星、名字是 Meteor；卸载旧的 OmniGet Studio |
| 安装被拦 | 设置 → 安全 → 安装未知应用 → 允许文件管理器 |

---

## 六、构建

```bash
# APK（纯原生界面）
android/build-android.sh          # → dist/Meteor.apk

# 网页版（可选）
node build.mjs                    # → dist/Meteor.html

# 本地引擎
python3 server/ytdlp_server.py --port 8791
```

工具链：Temurin JDK 17、Debian `aapt`/`zipalign`、Android build-tools 34 的 `d8.jar`/`apksigner.jar`、`platform-34/android.jar`。
签名密钥首次自动生成在 `android/meteor-debug.jks`（store/key 密码均为 `android`）。

---

## 七、测试

| 测试 | 结果 |
|---|---|
| `node --test test/engine.test.mjs`（网页版下载引擎） | 29 / 29 |
| `node --test test/tools.test.mjs`（16 个离线工具） | 28 / 28 |
| jsdom 端到端（网页版 + 真实本地引擎） | 33 / 33 |
| APK `apksigner verify` | v2 + v3 通过 |
| APK `aapt dump badging` | 包名/SDK/图标/启动 Activity 正确 |

> 本机（Android 10 华为）无法直接安装 APK 做真机验证；原生界面已尽量做静态与构建校验。真机若异常，App 会显示错误而非白屏，把截图/崩溃日志发我。

---

## 八、目录

```
omniget-studio/
├── android/          Android 原生工程（Java、Manifest、res、assets、构建脚本）
├── server/           本地 yt-dlp 引擎（HTTP 服务、启动脚本、ffmpeg）
├── src/              网页版前端（core/engine/tools/local-engine/views）
├── dist/             Meteor.apk + Meteor.html
├── test/             网页版引擎/工具单测
├── docs/             图标与横幅
└── build.mjs         网页版单文件构建
```

---

## 九、限制

- 本地引擎依赖 DSH Go 的 Ubuntu 运行时存活，App 不能自行启动它（后续可做一键启动）。
- 平台下载受站点/网络限制；不绕过 DRM、不破解付费墙。
- debug 自签名，未做商店签名与隐私政策。
- 原生版目前聚焦「下载」主流程；网页版仍保留 16 个离线工具与更丰富的视觉界面。

---

## 十、许可

界面与产品理念来自 GPL-3.0 的 [OpenSelena/omniget](https://github.com/OpenSelena/omniget)；
本项目为独立重制实现，仅供学习与个人使用，请遵守内容平台条款与当地法律。
