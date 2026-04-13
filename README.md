# 歌词录制页

AppleMusic 风格的歌词录制与展示工具，支持 LRC 歌词同步、视频导出等功能。

## 技术栈

- **Vite 6** - 下一代前端构建工具
- **TypeScript 5.8** - 类型安全的 JavaScript 超集
- **FFmpeg WASM** - 浏览器端音视频处理
- **现代 CSS** - 嵌套语法、@property、容器查询

## 项目结构

```
lyrics_next/
├── src/
│   ├── main.ts          # 应用入口
│   ├── app.ts           # 核心应用逻辑
│   ├── types.ts         # TypeScript 类型定义
│   ├── text.ts          # 文本/本地化内容
│   ├── lrc.ts           # LRC 歌词解析
│   ├── color.ts         # 封面取色与主题
│   ├── export.ts        # 视频导出功能
│   ├── utils.ts         # 工具函数
│   ├── vite-env.d.ts    # Vite 环境类型
│   └── styles/
│       └── main.css     # 样式文件
├── index.html           # 页面入口
├── package.json         # 依赖配置
├── tsconfig.json        # TypeScript 配置
├── vite.config.ts       # Vite 配置
└── biome.json           # 代码质量配置
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查
npm run typecheck

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 功能特性

- 🎵 **LRC 歌词同步** - 支持时间标签解析与实时同步
- 🎨 **动态主题** - 根据封面自动提取主题色
- 📹 **视频导出** - 使用 FFmpeg WASM 在浏览器内导出 MKV 视频
- ⌨️ **键盘快捷键** - 空格播放/暂停、R 切换录制模式、H 隐藏面板
- 📱 **响应式设计** - 桌面端优化，移动端显示提示

## 使用方式

1. 导入封面图片、音频文件和 LRC 歌词
2. 调整歌词字号、封面尺寸、背景效果等参数
3. 点击播放预览效果
4. 使用录制模式配合 OBS 或系统录屏采集
5. 或使用内置导出功能直接生成视频文件

## 浏览器兼容性

本项目使用现代 Web 技术，仅支持最新版本的 Chrome、Edge、Firefox 和 Safari。

## 许可证

MIT
