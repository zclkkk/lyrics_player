# 项目迁移计划：升级至 Vite 8 + TypeScript 6

## 概述

将现有纯 JavaScript 项目迁移至现代前端工程化架构，采用 Vite 8 和 TypeScript 6 的最新激进特性，完全不考虑向前兼容性。

## 当前项目结构分析

```
lyrics_next/
├── scripts/
│   ├── app.js      (主逻辑，~1500行)
│   ├── color.js    (封面取色)
│   ├── lrc.js      (LRC解析)
│   └── utils.js    (工具函数)
├── styles/
│   └── main.css    (样式)
├── vendor/
│   └── ffmpeg/     (FFmpeg WASM)
├── index.html
└── README.md
```

## 目标项目结构

```
lyrics_next/
├── .gitattributes
├── .gitignore
├── biome.json
├── index.html
├── package-lock.json
├── package.json
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── src/
    ├── app.ts
    ├── color.ts
    ├── export.ts
    ├── lrc.ts
    ├── main.ts
    ├── text.ts
    ├── types.ts
    ├── utils.ts
    ├── vite-env.d.ts
    └── styles/
        └── main.css
```

## 迁移步骤

### Phase 1: 项目初始化与配置

1. **创建 package.json**

   * Vite 8.x

   * TypeScript 6.x

   * @ffmpeg/ffmpeg (最新版，替换 vendor 目录)

   * 移除所有不必要的依赖

2. **TypeScript 配置**

   * `tsconfig.json`: 根配置，使用最新激进选项

   * `tsconfig.app.json`: 应用代码配置

   * `tsconfig.node.json`: Node/Vite 配置

   * 启用严格模式、最新 ECMAScript 特性

3. **Vite 配置**

   * `vite.config.ts`: 使用 Vite 8 最新特性

   * 配置路径别名

   * 优化构建输出

4. **代码质量工具**

   * `biome.json`: 替代 ESLint + Prettier，更轻量快速

### Phase 2: 类型系统重构

1. **创建 types.ts**

   * 定义所有核心类型接口

   * LRC 歌词行类型

   * 应用状态类型

   * DOM 元素引用类型

   * 导出配置类型

2. **类型定义清单**

   ```typescript
   interface LyricLine {
     time: number;
     text: string;
     isError?: boolean;
   }

   interface AppState {
     title: string;
     artist: string;
     coverUrl: string;
     audioUrl: string;
     audioFile: File | null;
     lyrics: LyricLine[];
     originalLyrics: LyricLine[];
     lyricsGlobalOffsetMs: number;
     currentIndex: number;
     recordingMode: boolean;
     panelHidden: boolean;
     objectUrls: string[];
     lastExportUrl: string | null;
     isExporting: boolean;
     isMuxing: boolean;
     mediaRecorder: MediaRecorder | null;
     recordedChunks: Blob[];
     displayStream: MediaStream | null;
     shouldSaveExport: boolean;
     exportBaseName: string;
     exportAudioLeadInMs: number;
     pendingRecordingStartAc: AbortController | null;
     pendingPlaybackStartAc: AbortController | null;
     playbackSyncFrame: number;
     ffmpeg: FFmpeg | null;
     ffmpegLoadPromise: Promise<FFmpeg> | null;
     ffmpegAssetUrls: string[];
     exportJobCount: number;
     exportEndedAc: AbortController | null;
     lyricLineElements: HTMLElement[];
     lastProgressPercent: string;
     lastProgressValue: string;
     lastTimeText: string;
     lastDurationText: string;
   }
   ```

### Phase 3: 模块化重构

将 monolithic 的 app.js 拆分为多个专注模块：

1. **main.ts** - 入口文件

   * 初始化应用

   * 调用各模块初始化函数

2. **app.ts** - 核心应用逻辑

   * DOM 元素引用管理

   * 事件绑定

   * 状态管理

   * 播放控制

3. **lrc.ts** - LRC 解析（已有，需迁移为 TS）

   * 保持现有解析逻辑

   * 添加类型注解

4. **color.ts** - 封面取色（已有，需迁移为 TS）

   * 保持现有算法

   * 添加类型注解

5. **utils.ts** - 工具函数（已有，需迁移为 TS）

   * 格式化函数

   * 防抖函数

   * 文件扩展名获取

6. **export.ts** - 视频导出功能（从 app.js 提取）

   * FFmpeg 集成

   * 屏幕录制

   * 音视频封装

7. **text.ts** - 文本/本地化内容（从 app.js 提取）

   * 所有 UI 文本

   * 提示信息

### Phase 4: 代码精简与现代化

1. **移除冗余代码**

   * 删除未使用的函数

   * 删除过时的注释

   * 删除冗余的类型转换

2. **使用最新 JavaScript/TypeScript 特性**

   * 使用 `Promise.withResolvers()` (ES2024)

   * 使用 `AbortSignal.timeout()` (ES2024)

   * 使用 `structuredClone()` (ES2022)

   * 使用顶层 await  where appropriate

   * 使用 `const` 类型断言

3. **CSS 现代化**

   * 使用 CSS 嵌套语法

   * 使用 `@property` 自定义属性

   * 使用 `color-mix()` 等现代 CSS 函数

   * 使用容器查询 where appropriate

### Phase 5: FFmpeg 迁移

1. **移除 vendor 目录**

   * 删除 `vendor/ffmpeg/`

   * 改用 npm 包 `@ffmpeg/ffmpeg` 和 `@ffmpeg/core`

2. **更新 FFmpeg 调用代码**

   * 使用最新版 FFmpeg WASM API

   * 优化加载策略

### Phase 6: HTML 与资源更新

1. **index.html**

   * 更新 script 引用为 Vite 入口

   * 移除手动 protocol 检查（Vite 开发服务器处理）

   * 保持现有结构和样式类

2. **样式迁移**

   * 将 `styles/main.css` 移至 `src/styles/main.css`

   * 在 main.ts 中导入

### Phase 7: 构建与验证

1. **开发服务器测试**

   * 运行 `npm run dev`

   * 验证所有功能正常

2. **生产构建测试**

   * 运行 `npm run build`

   * 验证输出文件

3. **类型检查**

   * 运行 `tsc --noEmit`

   * 确保无类型错误

## 激进特性使用清单

### TypeScript 6 特性

* `strict: true` - 最严格类型检查

* `noUncheckedIndexedAccess: true` - 数组索引访问检查

* `exactOptionalPropertyTypes: true` - 精确可选属性类型

* `module: "Preserve"` - 保留模块语法

* `moduleResolution: "Bundler"` - Bundler 模块解析

* `target: "ESNext"` - 最新 ECMAScript 目标

* `lib: ["ESNext", "DOM", "DOM.Iterable"]` - 最新库定义

### Vite 8 特性

* 使用 `vite-env.d.ts` 处理环境类型

* 利用 Vite 的优化构建

* 使用 `import.meta.env` 访问环境变量

* 原生 ESM 输出

### 现代 CSS 特性

* CSS 嵌套

* `@property` 注册自定义属性

* `color-mix()` 颜色混合

* `oklch()` 色彩空间

* 容器查询

## 文件变更清单

### 新增文件

* `package.json`

* `package-lock.json`

* `tsconfig.json`

* `tsconfig.app.json`

* `tsconfig.node.json`

* `vite.config.ts`

* `biome.json`

* `.gitignore`

* `.gitattributes`

* `src/main.ts`

* `src/app.ts`

* `src/types.ts`

* `src/export.ts`

* `src/text.ts`

* `src/lrc.ts`

* `src/color.ts`

* `src/utils.ts`

* `src/vite-env.d.ts`

* `src/styles/main.css`

### 修改文件

* `index.html` - 更新为 Vite 入口

* `README.md` - 更新使用说明

### 删除文件

* `scripts/app.js`

* `scripts/color.js`

* `scripts/lrc.js`

* `scripts/utils.js`

* `styles/main.css` (原位置)

* `vendor/ffmpeg/814.ffmpeg.js`

* `vendor/ffmpeg/ffmpeg.js`

## 风险与注意事项

1. **FFmpeg WASM 兼容性**

   * 新版 @ffmpeg/ffmpeg 可能有 API 变化

   * 需要测试视频导出功能

2. **浏览器兼容性**

   * 使用激进 ES 特性可能导致旧浏览器不兼容

   * 这是预期行为，符合要求

3. **类型转换复杂度**

   * 原 JavaScript 代码有大量隐式类型

   * 需要仔细添加类型注解

