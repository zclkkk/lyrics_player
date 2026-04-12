# 歌词录制页

一个基于 `Vite 8 + Vanilla TypeScript` 的单页歌词录制工具，用来做翻唱投稿、歌词同步和录屏展示。

## 技术栈

- `Vite 8`
- `TypeScript`
- 原生 `HTML / CSS / DOM API`
- `ffmpeg.wasm` 官方 ESM 包

## 开发要求

- `Node.js`：`^20.19.0 || >=22.12.0`
- `npm`：建议使用随 Node 一起安装的最新版本

## 启动方式

```bash
npm install
npm run dev
```

启动后访问终端里输出的本地地址，通常是 `http://localhost:5173`。

## 生产构建

```bash
npm run build
npm run preview
```

构建产物会输出到 `dist/`。

## 使用说明

导入封面、音频和 LRC 后即可预览；切到录制模式后，可以配合 OBS 或系统录屏使用。

点击“导出视频（保留原音频）”后，页面会先录制画面，再在浏览器内自动把你导入的原始音频封装进最终视频文件。

首次导出会联网加载 FFmpeg 内核；为尽量保留原始音频，当前默认导出为 `MKV`。
