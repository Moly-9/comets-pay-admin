# COMETS Pay 8771 维护工作区

本目录用于维护内网服务器上的 COMETS Pay 系统。

## 当前状态

- 访问地址：`http://192.168.88.188:8771`
- SSH 用户：`mac`
- 远端目录：`/Users/mac/Services/muse-pay-8771`
- 守护服务：`system/com.muse-pay-8771`
- 启动入口：`deploy/server.mjs`
- 当前发布包快照：`remote-snapshot/current`
- 当前压缩包：`remote-snapshot/muse-pay-8771-20260731-184842.tar.gz`
- 拉取时间：`2026-07-31 18:48:42`（Asia/Shanghai）

当前系统是静态 React 前端原型，不是可用于真实付款的生产系统。认证、权限、
账号、业务记录、审批、渠道连接和付款状态均在浏览器端模拟；页面刷新后会恢复
初始数据。远端没有源工程、`package.json` 或对应 Git 仓库，只有 Vite 构建产物。

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

远端缺少原始 React/Vite 源工程，因此当前前端改动先以可追踪的增强源码维护，
构建时注入到远端静态快照的副本中，不直接修改压缩后的生产 JS。

```bash
/Users/aria/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  scripts/build-local-preview.mjs

python3 -m http.server 4175 --directory local-preview/dist
```

浏览器访问 `http://127.0.0.1:4175/`。生成的 `local-preview/` 不进入 Git，
每次构建都会由 `remote-snapshot/current/dist` 和 `enhancements/` 重新生成。

合同识别增强模块位于 `enhancements/contract-recognition/`。先在该目录运行
`pnpm run build:plugin`，再运行上面的组装脚本。模块仅接管合同管理页原有的
“上传合同”按钮，合同文件在浏览器本地 Worker 中解析，不会上传到服务器。

## 后续维护原则

1. 不直接把压缩后的 `dist/assets/*.js` 当作长期源码维护。
2. 优先找回原始 React/Vite 源工程；找不到时，在本目录重建可维护源码。
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
