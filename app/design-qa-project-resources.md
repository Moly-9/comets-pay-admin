# 项目详情关联资料卡片 Design QA

## 对照基线

- 图一原始参考：`/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-62ba90d8-0415-48ca-808a-70fdbf778410.png`
  - 原图：931 x 395 px。
  - 实现对照：`design-qa-project-resources-summary-comparison-final.png`。
- 图二原始参考：`/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-5bfbe996-c385-4e83-804c-58a4f270044c.png`
  - 原图：683 x 624 px。
  - 实现对照：`design-qa-project-resources-contract-comparison-final.png`。
- 桌面浏览器：1280 x 720 CSS px，截图为 1265 x 712 px，device scale factor 1。
- 窄屏浏览器：390 x 844 CSS px，可见内容截图为 375 x 812 px，device scale factor 1。
- 验收状态：管理员账号，项目 `PRJ-301164`，包含 1 份合同、1 份 Invoice 和 1 份付款清单。

## Full-view 对照

- 聚合区保留现有项目详情双栏结构，将原先按达人展开的资料长列表收敛为合同、Invoice、付款清单三行。
- 三行分别使用蓝、紫、橙弱色边框和同色图标底，信息层级、行间距和入口位置与图一一致。
- 合同弹窗沿用图二的宽列表结构，一行对应一份合同；在原参考基础上增加达人、IO、关联 Invoice 和 CRUD 操作。
- 桌面端弹窗内容独立滚动，页面背景不参与弹窗内容布局。

## Focused 对照

- 字体与排版：沿用系统现有字体；标题、数量、辅助说明和状态形成四级层级。窄屏长标题换行或截断，不遮挡关闭按钮。
- 间距与布局：桌面记录行保持横向扫描；390px 下转换为纵向记录，按钮区独立成行。
- 颜色与 token：使用现有中性灰作为主体，蓝/紫/橙仅承担资源类型区分；状态同时保留文字和竖线，不依赖颜色判断。
- 图标与资产：使用项目现有 Lucide 图标，无自绘 SVG、CSS 图形或占位图片。
- 文案与内容：合同、Invoice、付款清单的数量、达人覆盖、金额、校验状态和空状态均来自当前内存数据。

## 交互验收

- 已验证合同生成前选择项目达人，关联合同/IO 候选只使用稳定 ID 匹配。
- 已验证合同列表展示“已覆盖”“Invoice 未覆盖”“无 Invoice”关系。
- 已验证 Invoice 编辑只允许选择同 engagement 下已确认合同；保存后进入“需重新校验”。
- 已验证付款行编辑、增加和移除入口；移除付款行不会删除 Invoice。
- 已验证管理员修改已提交/已通过项目后转为 `changes_required` 并产生审计记录。
- 已验证 390px 下资料卡、合同列表、Invoice 编辑和付款清单无横向溢出或控件遮挡。
- 浏览器 console：0 warning，0 error。

## 对照迭代记录

- 初次交互验收发现双层 Modal 内的选择控件会在选择后关闭外层流程。
- 已改为单层 Modal 状态切换，并使用可点击候选列表；复验后生成和关联流程可连续完成。
- 初次窄栏检查发现聚合行辅助说明被省略。
- 已允许项目资料卡中的说明文本换行；复验后金额、覆盖关系和来源信息完整可见。

## Findings

- 无 P0、P1 或 P2 问题。
- P3：项目详情现有主栏比图一参考区域更窄，因此桌面聚合行的信息密度更高；当前通过换行保持完整信息，不影响操作。

## Final Result

final result: passed
