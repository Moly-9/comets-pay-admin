# 合同字段识别插件

这是一个独立的 React/Vite 增强模块。它保留旧管理端的合同首页和数据，只接管页面
原有的“上传合同”按钮，并叠加上传弹窗与合同字段核对页。它不修改旧系统的压缩
JavaScript Bundle，也不向外部服务上传合同。

## 实现位置

- `src/parsing/`：PDF、DOCX 解析和 Web Worker
- `src/core/`：字段别名、标准化、识别候选、优先级和冲突规则
- `src/components/`：上传、原文预览、字段审核和确认
- `src/repositories/`：浏览器 IndexedDB 合同仓库
- `src/legacy-entry.tsx`：旧管理端挂载适配器，正式源码接入时可整体删除
- `../../scripts/build-local-preview.mjs`：发布包组装脚本

## 数据流

```text
File[] -> 本地校验 -> Web Worker -> PDF/DOCX 文档块
       -> 字段候选 -> 优先级与冲突处理 -> 人工编辑/确认
       -> IndexedDB -> 保存人工确认结果
```

原始文件 Blob、解析结果和人工确认状态只保存在当前浏览器 IndexedDB，不会写入当前
静态原型的合同列表。PDF 预览通过本地 Blob URL 定位页码；DOCX 通过解析后的段落编号
定位原文。

## 依赖

- `pdfjs-dist`：PDF 文字层、坐标和页码
- `jszip`、`fast-xml-parser`：DOCX Open XML 段落、标题、表格和单元格
- `react`、`react-dom`：上传和核对界面
- `vitest`、Testing Library：识别规则和确认交互测试

## 本地运行

```bash
pnpm install
pnpm dev
```

独立开发页默认使用 `http://127.0.0.1:4176/`。

构建插件并装配进旧管理端副本：

```bash
pnpm run build:plugin
node ../../scripts/build-local-preview.mjs
```

组装输出位于 `local-preview/dist`。发布时应使用相同的组装方式生成完整暂存目录，
然后原子替换远端 `dist`，不能把文件逐个复制进线上目录。

## 原型边界

插件能完成浏览器本地识别、来源定位、人工确认和本地持久化，但 IndexedDB 数据仅属于
单个浏览器。多人共享、服务端权限、正式合同编号、审计和跨模块一致性仍需后端支持。
