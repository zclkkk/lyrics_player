# Lyrics Next

AppleMusic 风格歌词录制页 - 翻唱投稿、歌词同步、录屏展示工具。

## 快速开始

```bash
npm install
npm run dev
```

访问 http://localhost:5173

## 功能

- 导入封面、音频、LRC 歌词
- AppleMusic 风格歌词动效
- 歌词校准（整体偏移 / 单句对齐）
- 视频录制导出（保留原始音频）

## 技术栈

- Vite 8
- TypeScript 6
- Biome

## 项目结构

```
src/
├── app.ts      # 主应用逻辑
├── color.ts    # 封面取色
├── export.ts   # 视频导出
├── lrc.ts      # 歌词解析
├── main.ts     # 入口
├── text.ts     # 静态文本
├── types.ts    # 类型定义
├── utils.ts    # 工具函数
└── styles/
    └── main.css
```

## 使用方式

1. 导入封面图片、音频文件、LRC 歌词
2. 点击播放预览效果
3. 切到录制模式后使用 OBS 或系统录屏采集
4. 或使用内置导出功能录制视频

首次导出需联网加载 FFmpeg 内核（约 31MB）。