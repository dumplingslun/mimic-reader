# MimicReader 项目概述与落地架构（中文）

## 1. 核心目标

打造一款**轻量、极速、跨平台**的本地 PDF 电子书阅读器，核心卖点是：

- 高度逼真的物理翻页体验（Realistic Page-Turning Experience）
- 本地优先（离线可用、隐私友好）
- 低资源占用（相较 Electron 更小体积与更低内存）

---

## 2. 技术栈与职责边界

### 前端展现层：Vue 3 + TypeScript

- 负责 UI 渲染：书架、阅读器、目录、设置
- 管理交互状态：当前页、翻页方向、动画阶段、预加载命中状态
- 承担动效实现：CSS 3D / Canvas / WebGL 翻页效果

### 后端引擎层：Rust

- 负责本地文件访问与 PDF 解析
- 承担性能敏感逻辑：页面渲染、缓存、预加载、元数据抽取
- 提供稳定命令接口：页图像、书签、阅读进度等

### 跨平台壳层：Tauri

- 连接 Vue 与 Rust 的 IPC 桥
- 负责窗口、权限、打包与系统集成

---

## 3. 总体架构

```text
┌──────────────────────────────────────────────────────────────┐
│                      Vue 3 Frontend                          │
│  Library / Reader UI  +  Flip Animation State Machine        │
└───────────────────────────────┬──────────────────────────────┘
                                │ invoke / event
┌───────────────────────────────▼──────────────────────────────┐
│                     Tauri IPC Bridge                          │
└───────────────────────────────┬──────────────────────────────┘
                                │ command handlers
┌───────────────────────────────▼──────────────────────────────┐
│                        Rust Engine                            │
│  PDF Parse + Rasterization + Sliding Window Cache + Storage   │
└───────────────────────────────────────────────────────────────┘
```

关键原则：

1. **前端只做展示与交互，不做重计算。**
2. **后端只给“当前需要的页面数据”，避免一次性加载全书。**
3. **IPC 数据结构固定且可版本化。**

---

## 4. 模块设计与技术难点

## 模块 A：PDF 解析与渲染引擎（Rust）

建议方向：

- 在 `src-tauri/Cargo.toml` 引入 `pdfium-render`（或同类方案）
- 对外提供统一接口：
  - `open_book(file_path)`
  - `get_page_image(book_id, page_index, scale)`
  - `get_page_meta(book_id, page_index)`

难点与解法：

- **内存控制**：采用滑动窗口缓存，如当前页为 `n`，保留 `n-1 / n / n+1`
- **异步预加载**：阅读到 `n` 时，后台预渲染 `n+2`
- **快速跳转策略**：用户拖拽速览时，先返回低清预览，再补高精图

---

## 模块 B：拟真翻页动效（Vue）

实现路径：

1. **基础版**：CSS 3D `rotateY` + 阴影遮罩，实现稳定硬翻页
2. **进阶版**：Canvas/WebGL + 曲面形变（贝塞尔）模拟纸张卷曲

难点与解法：

- **状态同步**：动画开始前必须确认目标页图像已就绪
- **防白屏**：翻页状态机中增加 `asset_ready` 关卡
- **防掉帧**：在拖拽过程中分离“视觉层”和“数据层”，避免阻塞主线程

推荐状态机：

```text
IDLE -> PREPARE(next page ready?) -> FLIPPING -> SETTLE -> IDLE
```

---

## 模块 C：本地书库与阅读进度

功能范围：

- 记录导入的 PDF 列表、封面、作者、总页数
- 保存阅读进度（last_page）、书签、最近打开时间
- 支持快速恢复“上次阅读位置”

存储建议：

- 使用 Rust 侧本地 JSON（后续可迁移 sqlite）
- 数据目录按平台标准路径管理（由 Tauri 提供）

示例数据结构：

```json
{
  "book_id": "sha256(file_path)",
  "file_path": "/Users/a/books/demo.pdf",
  "title": "demo",
  "total_pages": 320,
  "last_page": 57,
  "bookmarks": [12, 57, 118],
  "updated_at": 1730000000
}
```

---

## 5. IPC 接口建议（V1）

```ts
invoke('open_book', { filePath })
invoke('get_page_image', { bookId, pageIndex, scale })
invoke('preload_pages', { bookId, centerPage, radius: 1 })
invoke('save_progress', { bookId, pageIndex })
invoke('list_library')
```

返回数据建议包含：

- 页面像素宽高
- 渲染时间（用于性能监控）
- 图像数据（可 base64 / bytes）
- 缓存命中标记

---

## 6. 性能目标（可验收）

- 冷启动到书架可交互：< 1.5s（中端设备）
- 单页翻页动画：稳定 55~60 FPS
- 连续翻页 50 次无明显白屏
- 打开 500 页 PDF，不出现线性增长内存（窗口缓存生效）

---

## 7. 迭代路线图

### Milestone 1（可用）

- 本地导入 PDF
- 基础阅读器 + 硬翻页
- 阅读进度保存

### Milestone 2（好用）

- 滑动窗口缓存 + 异步预加载
- 速览翻页（低清预览）
- 搜索 / 目录 / 书签

### Milestone 3（惊艳）

- 逼真卷页（Canvas/WebGL）
- 动态阴影与纸张材质
- 性能分析面板（FPS、渲染耗时、缓存命中率）

---

## 8. 与现有仓库的对应关系

当前仓库已经具备：

- Vue 3 + Tauri + Rust 的基础结构
- 书库与阅读器基础模块
- 翻页相关组件与状态管理

下一步建议优先补齐：

1. Rust 侧“页面渲染 + 缓存窗口”的明确实现边界
2. 前端翻页状态机与“资源就绪”防白屏机制
3. IPC 协议版本化与性能埋点
