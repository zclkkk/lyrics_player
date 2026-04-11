# 歌词录制页

一个整理过的单页小项目，用来做翻唱投稿、歌词同步和录屏展示。

## 目录结构

`index.html`：页面入口和结构

`styles/main.css`：页面样式

`scripts/app.js`：主交互逻辑、导出和音频同步

`scripts/lrc.js`：LRC 歌词解析

`scripts/utils.js`：格式化、防抖等通用工具函数

`scripts/color.js`：封面取色与主题色提取

`vendor/ffmpeg/`：FFmpeg WASM 前端封装（用于导出视频）

## 使用方式

请用任意本地 HTTP 服务打开项目目录，例如运行 `python -m http.server 8000` 后，在浏览器中访问 `http://127.0.0.1:8000`。

导入封面、音频和 LRC 后即可预览；切到录制模式后，可以配合 OBS 或系统录屏使用。

点击“导出视频（保留原音频）”后，页面会先录制画面，再在浏览器内自动把你导入的原始音频封装进最终视频文件。

首次导出会联网加载 FFmpeg 内核（约 31 MB）；为尽量保留原始音频，当前默认导出为 `MKV`。
