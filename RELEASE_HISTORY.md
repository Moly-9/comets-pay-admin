# 8771 发布版本记录

这里只记录发布包的文件名、哈希和拉取时间。包含业务字段和演示凭据的原始发布包
保存在被 Git 忽略的 `remote-snapshot/` 中，不进入提交历史。

## 2026-07-31 18:48:42

- 本地目录：`remote-snapshot/current`
- 压缩包：`remote-snapshot/muse-pay-8771-20260731-184842.tar.gz`
- 压缩包 SHA-256：`6cf9b33071fa7a6c30c68839ed24bfdf2322cd8cfaca59a8156f72cf2bd90c35`
- 远端文件数：11
- 未变化：Node 服务入口、LaunchDaemon 配置、字体、合同模板、二维码模块
- 已变化：前端入口 JS、样式 CSS、Invoice 生成模块、`index.html`

当前关键文件：

```text
11f14f66801b9f63774ec7f0ab160121217255def00cca96b491ad222911dc73  deploy/server.mjs
5d564d2f531184c656b9e5900552b7be097ed7d4c777ba23672f39aeeabe6e51  deploy/com.muse-pay-8771.plist
3463980bf56c4f59eec39dd5cc49ac78756f260b97209f22b66ad8a11abf32a7  dist/assets/index-B-24fHpc.js
f8820cdaa82f8debd32b39076775460095b9f6c08261967d96cd29ac2295f091  dist/assets/index-ByWHgIJv.css
c82856d3856a9e66c6b3dac67dc4125cbb182da09f7672b00b7da73ebe3016e9  dist/assets/generateInvoice-DUos0P8H.js
e940f76180bf3d4efc93817d08de54af6bede44c9978099aaf9665af209cbb66  dist/index.html
```

## 2026-07-30 初始快照

- 本地目录：`remote-snapshot/20260730-initial`
- `dist/index.html` SHA-256：`4e88dd750116ef7b2a7eb227048d6d8a3edb3e2db03249865697cbb36a0e5ca4`
- 前端入口：`dist/assets/index-D5J_DbO4.js`
- 样式入口：`dist/assets/index-rLDSQHMq.css`
- Invoice 模块：`dist/assets/generateInvoice-CiFhQl9_.js`
