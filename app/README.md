# COMETS Pay 网红支付系统

这是一个独立维护的前端原型项目，使用 Vite、React 和 TypeScript 构建。

## 开始使用

```bash
git clone https://github.com/levison777/comets-pay.git
cd comets-pay
npm install
npm run dev
```

浏览器访问：`http://127.0.0.1:5173/`

## 生产构建

```bash
npm run build
```

构建结果位于 `dist/`。

## 主要目录

- `src/`：React 与 TypeScript 源码
- `src/pages/`：业务页面
- `src/components/`：通用组件
- `design/`：视觉概念图
- `dist/`：生产构建结果，不需要手动维护

当前版本是前端交互原型，使用页面内示例数据，尚未连接真实数据库、飞书 OA 或支付渠道 API。
