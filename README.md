# COMETS Pay 8771 维护工作区

本目录用于维护内网服务器上的 COMETS Pay 系统。

## 当前状态

- 访问地址：`http://192.168.88.188:8771`
- SSH 用户：`mac`
- 远端目录：`/Users/mac/Services/muse-pay-8771`
- 守护服务：`system/com.muse-pay-8771`
- 启动入口：`deploy/server.mjs`
- 本地可维护源码：`app`
- 当前发布包快照：`remote-snapshot/current`
- 当前压缩包：`remote-snapshot/muse-pay-8771-20260731-184842.tar.gz`
- 拉取时间：`2026-07-31 18:48:42`（Asia/Shanghai）

当前系统是静态 React 前端原型，不是可用于真实付款的生产系统。认证、权限、
账号、业务记录、审批、渠道连接和付款状态均在浏览器端模拟；页面刷新后会恢复
初始数据。远端没有源工程、`package.json` 或对应 Git 仓库，只有 Vite 构建产物。
可维护的 React/Vite/TypeScript 源码现已单独导入本地 `app/`，以后前端功能和页面
设计以该目录为主；源码来源和基线差异见
[app/SOURCE_BASELINE.md](./app/SOURCE_BASELINE.md)。

完整检查结论见 [SYSTEM_AUDIT.md](./SYSTEM_AUDIT.md)。

后续前端、后端、数据库与外部接口统一遵循
[ID_STANDARD.md](./ID_STANDARD.md)，不再使用姓名、社媒 Handle 或渠道收款人编号
作为跨模块主键。

## 查看每次修改

本工作区使用本地 Git 记录维护文档和后续可维护源码。常用命令：

```bash
# 查看当前有哪些文件被修改
./scripts/show-changes.sh

# 查看具体代码差异
git diff

# 查看提交历史
git log --oneline --decorate

# 比较两个远端发布包
./scripts/compare-releases.sh \
  remote-snapshot/20260730-initial \
  remote-snapshot/current
```

每次修改完成后会提供文件列表、行为变化、验证结果和本地提交编号。原始发布包含有
不应进入 Git 历史的数据，因此保留在 `remote-snapshot/`；它的版本变化记录在
[RELEASE_HISTORY.md](./RELEASE_HISTORY.md)。

## 构建本地前端预览

今后的前端开发以 `app/` 中的可维护源码为主：

```bash
cd app
npm ci
npm run dev
```

浏览器访问 `http://127.0.0.1:5173/`。提交代码前执行：

```bash
cd app
npm run build
```

此前基于 `remote-snapshot/current` 和 `enhancements/` 生成的 `local-preview/`
仍保留为历史兼容路径，不删除、不覆盖，但不再作为新功能的默认开发入口。

本地源码构建结果位于 `app/dist/` 且不进入 Git。只有用户明确要求部署后，才会先
备份 Mac 当前版本，再使用经过验收的 `app/dist/` 更新 `8771`。

## 后续维护原则

1. 不直接把压缩后的 `dist/assets/*.js` 当作长期源码维护。
2. 所有新功能和页面设计在本地 `app/` 源码中完成，不覆盖历史增强源码。
3. 所有改动先在本地构建和验证，再备份远端当前版本并原子替换 `dist`。
4. 部署后检查 `/health`、首页、静态资源、服务状态和错误日志。
5. 不在本目录、Git 历史、脚本或文档中保存 SSH 密码、API Token 或付款密钥。

## 当前快照校验

```text
server.mjs                   11f14f66801b9f63774ec7f0ab160121217255def00cca96b491ad222911dc73
com.muse-pay-8771.plist      5d564d2f531184c656b9e5900552b7be097ed7d4c777ba23672f39aeeabe6e51
dist/index.html              e940f76180bf3d4efc93817d08de54af6bede44c9978099aaf9665af209cbb66
release archive              6cf9b33071fa7a6c30c68839ed24bfdf2322cd8cfaca59a8156f72cf2bd90c35
```
