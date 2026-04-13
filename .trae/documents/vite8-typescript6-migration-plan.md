# Vite 8 + TypeScript 6 全面迁移计划

## 项目现状分析

当前项目是一个纯 Vanilla JS 项目，无构建工具、无包管理器：
- `scripts/app.js` — 主逻辑（~1488行），包含状态管理、UI绑定、导出逻辑、事件处理
- `scripts/lrc.js` — LRC 歌词解析（~44行）
- `scripts/color.js` — 封面取色与主题色提取（~98行）
- `scripts/utils.js` — 工具函数（~48行）
- `styles/main.css` — 样式（~866行）
- `vendor/ffmpeg/` — 本地打包的 FFmpeg WASM（需替换为 npm 包）
- `index.html` — 页面入口，直接引用脚本

## 目标技术栈

| 技术 | 版本 | 关键特性 |
|------|------|----------|
| Vite | 8.x | Rolldown 统一打包、原生 TS paths 支持、内置 DevTools、LightningCSS |
| TypeScript | 6.x | strict 默认开启、ES2025 target/lib、ESNext 模块、Temporal API 类型 |
| Biome | 2.x | 统一 lint + format，替代 ESLint + Prettier |
| @ffmpeg/ffmpeg | 0.12.x | npm 包替代本地 vendor，ESM 支持 |

## 目标目录结构

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
└── src
    ├── app.ts
    ├── color.ts
    ├── export.ts
    ├── lrc.ts
    ├── main.ts
    ├── text.ts
    ├── types.ts
    ├── utils.ts
    ├── vite-env.d.ts
    └── styles
        └── main.css
```

## 模块拆分策略

将 `app.js`（~1488行）按职责拆分为 6 个模块：

| 新文件 | 职责 | 来源 |
|--------|------|------|
| `types.ts` | 所有类型定义、接口、常量 | app.js 中的 state、TEXT、demo、常量 |
| `text.ts` | UI 文案常量、demo 数据 | app.js 中的 TEXT 对象、demo 对象 |
| `export.ts` | 视频导出相关全部逻辑 | app.js 中的 FFmpeg、MediaRecorder、导出流程 |
| `app.ts` | 核心应用逻辑（歌词、UI、播放） | app.js 中非导出部分的业务逻辑 |
| `main.ts` | 入口：初始化、事件绑定 | app.js 中的 init()、bindEvents() |
| `color.ts` | 封面取色（原样迁移） | color.js |
| `lrc.ts` | LRC 解析（原样迁移） | lrc.js |
| `utils.ts` | 工具函数（原样迁移） | utils.js |

## 详细实施步骤

### 步骤 1：初始化 Vite 8 + TypeScript 6 项目骨架

1. 创建 `package.json`：
   ```json
   {
     "name": "lyrics-next",
     "private": true,
     "type": "module",
     "scripts": {
       "dev": "vite",
       "build": "tsc -b && vite build",
       "preview": "vite preview",
       "check": "biome check src/",
       "format": "biome format --write src/"
     },
     "dependencies": {
       "@ffmpeg/ffmpeg": "^0.12.15",
       "@ffmpeg/util": "^0.12.2"
     },
     "devDependencies": {
       "@biomejs/biome": "^2.4.10",
       "typescript": "^6.0.0",
       "vite": "^8.0.1"
     }
   }
   ```

2. 创建 `vite.config.ts`：
   ```ts
   import { defineConfig } from "vite"

   export default defineConfig({
     build: { target: "esnext" },
     css: { devSourcemap: true },
   })
   ```

3. 创建 `tsconfig.json`：
   ```json
   {
     "files": [],
     "references": [
       { "path": "./tsconfig.app.json" },
       { "path": "./tsconfig.node.json" }
     ]
   }
   ```

4. 创建 `tsconfig.app.json`：
   ```json
   {
     "compilerOptions": {
       "target": "ES2025",
       "lib": ["ES2025", "DOM", "DOM.Iterable"],
       "module": "ESNext",
       "moduleResolution": "bundler",
       "strict": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true,
       "noFallthroughCasesInSwitch": true,
       "noUncheckedIndexedAccess": true,
       "exactOptionalPropertyTypes": true,
       "isolatedModules": true,
       "moduleDetection": "force",
       "skipLibCheck": true
     },
     "include": ["src"]
   }
   ```

5. 创建 `tsconfig.node.json`：
   ```json
   {
     "compilerOptions": {
       "target": "ES2025",
       "lib": ["ES2025"],
       "module": "ESNext",
       "moduleResolution": "bundler",
       "strict": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true,
       "isolatedModules": true,
       "moduleDetection": "force",
       "skipLibCheck": true
     },
     "include": ["vite.config.ts"]
   }
   ```

6. 创建 `src/vite-env.d.ts`：
   ```ts
   /// <reference types="vite/client" />
   ```

7. 创建 `biome.json`：
   ```json
   {
     "$schema": "https://biomejs.dev/schemas/2.4.10/schema.json",
     "organizeImports": { "enabled": true },
     "linter": {
       "enabled": true,
       "rules": {
         "recommended": true,
         "complexity": { "noForEach": "error" },
         "style": { "noNonNullAssertion": "off" },
         "suspicious": { "noExplicitAny": "off" }
       }
     },
     "formatter": {
       "enabled": true,
       "indentStyle": "space",
       "indentWidth": 2
     },
     "javascript": {
       "formatter": { "quoteStyle": "double" }
     }
   }
   ```

8. 创建 `.gitignore`：
   ```
   node_modules
   dist
   .vite
   ```

9. 创建 `.gitattributes`：
   ```
   * text=auto eol=lf
   ```

### 步骤 2：迁移 `utils.js` → `src/utils.ts`

- 添加完整类型注解
- 移除所有注释
- 使用 TypeScript 6 的 `ES2025` 特性
- 导出所有函数

### 步骤 3：迁移 `lrc.js` → `src/lrc.ts`

- 定义 `LyricLine` 接口
- 添加完整类型注解
- 移除所有注释

### 步骤 4：迁移 `color.js` → `src/color.ts`

- 定义 `RGB` 类型别名
- 添加完整类型注解
- 移除所有注释

### 步骤 5：创建 `src/types.ts`

从 `app.js` 提取：
- `AppState` 接口 — 所有状态字段类型化
- `AppElements` 接口 — 所有 DOM 元素类型化
- 常量类型（`FFMPEG_CORE_BASE` 等）
- 导出相关类型

### 步骤 6：创建 `src/text.ts`

从 `app.js` 提取：
- `TEXT` 对象 → `as const` 断言
- `demo` 对象
- 移除所有注释

### 步骤 7：创建 `src/export.ts`

从 `app.js` 提取所有导出相关函数：
- `supportsInlineExport`
- `ensureFfmpeg`
- `muxRecordedVideo`
- `startExporting`
- `stopExporting`
- `finalizeRecordedVideo`
- `handleExportButtonClick`
- `observeMediaRecorderStart`
- `observeAudioPlaybackStart`
- 所有导出辅助函数
- 替换 `window.FFmpegWASM?.FFmpeg` 为 `import { FFmpeg } from "@ffmpeg/ffmpeg"`
- 替换 `createBlobUrlFromRemote` 为 `@ffmpeg/util` 的 `toBlobURL`
- 移除所有注释

### 步骤 8：创建 `src/app.ts`

从 `app.js` 提取核心应用逻辑（非导出部分）：
- 状态管理函数
- 歌词同步与校准
- UI 更新函数
- 文件导入函数
- 播放控制
- 所有 DOM 操作
- 移除所有注释

### 步骤 9：创建 `src/main.ts`

从 `app.js` 提取入口逻辑：
- `init()` 函数
- `bindEvents()` 函数
- 键盘快捷键处理
- 拖放处理
- 窗口事件
- 调用 `init()`

### 步骤 10：迁移样式 `styles/main.css` → `src/styles/main.css`

- 原样迁移，无需修改
- CSS 已使用现代特性（@property、嵌套、@starting-style）

### 步骤 11：重构 `index.html`

- 移除 `file://` 协议检测脚本（Vite 自带开发服务器）
- 移除 `<script src="./vendor/ffmpeg/ffmpeg.js">` （改用 npm 包）
- 将 `<script type="module" src="./scripts/app.js">` 改为 `<script type="module" src="/src/main.ts">`
- 将 `<link rel="stylesheet" href="./styles/main.css" />` 改为 `<link rel="stylesheet" href="/src/styles/main.css" />`
- 移除所有冗余注释

### 步骤 12：清理旧文件

删除以下文件/目录：
- `scripts/` 目录（app.js, color.js, lrc.js, utils.js）
- `styles/` 目录（已迁移到 src/styles/）
- `vendor/` 目录（ffmpeg.js, 814.ffmpeg.js）

### 步骤 13：更新 `README.md`

更新项目说明，反映 Vite 8 + TypeScript 6 架构。

### 步骤 14：安装依赖并验证

1. 运行 `npm install`
2. 运行 `npx tsc -b` 验证类型
3. 运行 `npx biome check src/` 验证代码规范
4. 运行 `npm run dev` 验证开发服务器
5. 运行 `npm run build` 验证生产构建

## TypeScript 6 激进特性应用

- `target: "ES2025"` + `lib: ["ES2025", "DOM", "DOM.Iterable"]`
- `strict: true`（TS6 默认，显式声明）
- `noUnusedLocals: true` — 移除未使用变量
- `noUnusedParameters: true` — 移除未使用参数
- `noUncheckedIndexedAccess: true` — 严格数组索引
- `exactOptionalPropertyTypes: true` — 精确可选属性
- `moduleDetection: "force"` — 强制模块检测
- 使用 `Promise.withResolvers()` 类型（ES2025）
- 使用 `AbortSignal.timeout()` 类型（ES2025）
- 使用 `structuredClone()` 类型
- 使用 `using` 关键字（显式资源管理）

## Vite 8 激进特性应用

- `build.target: "esnext"` — 不考虑旧浏览器兼容
- Rolldown 统一打包（Vite 8 默认）
- 原生 TypeScript paths 支持（无需 vite-tsconfig-paths 插件）
- LightningCSS 作为默认 CSS 处理器（Vite 8 默认）
- `css.devSourcemap: true` — 开发时 CSS 源码映射

## 代码精简原则

1. 移除所有注释（代码即文档）
2. 移除未使用的变量和参数
3. 移除冗余的类型断言（让 TS 推断）
4. 使用 TypeScript 6 的类型推断能力减少显式注解
5. 合并相似逻辑，消除重复代码
6. 使用 `as const` 替代手动类型定义
7. 使用 `satisfies` 运算符进行类型验证
