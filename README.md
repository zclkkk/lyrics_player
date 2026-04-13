# 歌词录制页

AppleMusic 风格歌词录制页，用于翻唱投稿、歌词同步和录屏展示。

## 技术栈

- **Vite 8** — Rolldown 统一打包、LightningCSS
- **TypeScript 6** — strict 模式、ES2025 target
- **Biome 2** — 统一 lint + format
- **@ffmpeg/ffmpeg** — 浏览器端视频导出

## 目录结构

```
src/
├── app.ts        核心应用逻辑（歌词、UI、播放）
├── color.ts      封面取色与主题色提取
├── export.ts     视频导出逻辑
├── lrc.ts        LRC 歌词解析
├── main.ts       入口：初始化、事件绑定
├── text.ts       UI 文案常量
├── types.ts      类型定义与常量
├── utils.ts      工具函数
├── vite-env.d.ts Vite 类型声明
└── styles/
    └── main.css  页面样式
```

## 使用方式

```bash
npm install
npm run dev
```

导入封面、音频和 LRC 后即可预览；切到录制模式后，可以配合 OBS 或系统录屏使用。

点击"导出视频（保留原音频）"后，页面会先录制画面，再在浏览器内自动把你导入的原始音频封装进最终视频文件。

首次导出会联网加载 FFmpeg 内核（约 31 MB）；为尽量保留原始音频，当前默认导出为 `MKV`。
