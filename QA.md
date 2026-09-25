# 横屏版本验收记录

验证日期：2026-09-25。本机 macOS、Node.js 20.20.2、Chromium 1243、Playwright CLI。此记录取代 9 月 22 日竖屏版本的验收结论。

## 规则与构建

- `npm run build`：TypeScript 检查与 Vite 生产构建通过。
- `npm test`：**33 项全部通过**（包含 5 项阵容预选测试）。输出见 [规则日志](./output/lineup-tests.log)。
- 原有 24 个英雄的技能、被动、控制、召唤、复苏、羁绊、升星、满席换位和确定性战斗继续通过。
- 新增验证：阶段与强化节点、最高 10 人口和概率、36 种对称合成配方、三装备槽、库存/英雄合成、升星继承与溢出返装、出售返还与重复操作保护。
- 36 种成装分别进入真实战斗，血量/伤害均有效、战斗均结束；单独验证灼烧、额外回蓝、复苏和中立野怪不继承对手强化。
- 验证共享卡池的商店占用、升星占用、售出返还、淘汰返还和缺货行为；同费用英雄按剩余张数加权抽取。
- 验证按血量选秀、AI 先选、刷新恢复、满备战席保留奖励、选秀仅发放一次。
- 验证强化单项刷新次数、金币强化仅发放一次、战斗中备战席出售、双方平局受伤、v2 迁移备份及损坏装备校验。
- 两组整局测试共运行 6 局，逐阶段校验存档；其中 3 局额外核对全部英雄的卡池实际占用没有超过库存。

## 阵容预选增量验收

生产预览 `localhost:4173`，脚本见 [lineup-qa.js](./output/playwright/lineup-qa.js)，结果见 [验证记录](./output/playwright/lineup-validation.json)。

- 新对局自动打开可跳过的阵容预选；选择期间准备倒计时停止。跳过后刷新不再重复弹出，重开时重新选择。
- 8 套流派在 667×375、844×390、1440×900 三种尺寸完整显示。详情可查看英灵技能再返回确认，也可将流派作为自选基础。
- 自选 1–10 位英灵，空阵容不能启用，第 11 位提供弹窗内的上限提示；关闭未确认草稿保留原预选。
- 切换立即更新“核心推荐 / 补强推荐 / 自选推荐”，取消后移除标识。锁店、金币、随机状态和实际阵容保持一致。
- 收集进度包含棋盘与备战席，同名棋子和升星均不重复计数；招募和出售后更新。
- 真实战斗中打开选阵会暂停，确认后恢复；战斗刷新回到准备阶段时仍保留预选。
- 旧 v3 存档缺少预选字段时，原有棋子、经济与对局进度完整保留。
- 浏览器触屏仿真验证预选、自选、招募，以及在带推荐标识的寻仙区拖售：返还金币和装备，无穿透误购买。
- 修复竖屏启动的页面最小宽度触发浏览器缩放的问题；转横屏保持 1× 视口，预选确认可正常点按。
- 推荐标签与升星提示、羁绊、售价没有重叠。生产缓存完成后断网刷新，仍保留阵容与商店推荐。
- 本次生产浏览器验证无页面脚本错误。构建输出见 [构建日志](./output/lineup-build.log)。

## 多局模拟

`npm run simulate` 固定 16 个初始种子，八种流派各两局。完整输出：[模拟结果](./output/simulation-landscape.json)。

- 16 局均结束，玩家侧共 **351 场战斗**。
- 对局在内部第 **19–33 回合**结束（计入选秀）。
- 平均战斗 **25 秒**；60 秒平局 **1 场**。
- 其余七位 AI 的对抗和野怪也使用同一战斗计算器。
- 该样本验证流程与明显异常；不表示已完成长期竞技平衡。

## 真实输入与移动端布局

鼠标流程保留在 [landscape-qa.js](./output/playwright/landscape-qa.js)，触屏流程在 [touch-qa.js](./output/playwright/touch-qa.js)。两者是 Playwright CLI `run-code` 脚本。

- 在 844×390、932×430、667×375 及 1440×900 下检查页面无横纵溢出，九个备战格、五张商店牌、八位弈者均在屏内。
- 鼠标真实拖动：库存装备 → 备战英灵、库存装备 → Pixi 棋子、备战席 → 棋盘、棋盘二星棋子 → 商店出售。
- 出售区显示“松手出售”和正确售价；松手返还金币与装备，下方卡牌没有误购买。
- 移出区域、Escape 和浏览器原生 `touchCancel` 都取消出售，存档保持不变，无拖影残留。
- 触屏使用独立 context，`isMobile: true`、`hasTouch: true`、2 倍像素比，以 `touchscreen.tap` 和 CDP `Input.dispatchTouchEvent` 驱动。
- 触屏招募、点选、拖装、拖售和战斗中出售备战单位通过；旋转为竖屏时战斗停止计时，转回可继续；在强化弹窗内旋转也能恢复原选择，竖屏全屏入口不被隐藏弹窗阻挡。
- 30 秒准备自动开战、5 秒战绩停留后自动进入下一轮通过；查看弹窗和手动暂停时不消耗准备时间。
- 手动连续完成 1-1 至 2-3，经过 2-1 强化选择及单项刷新，进入 2-4 共选仙缘，再进入 2-5。刷新战绩与选秀页面不重复收益或改变选项。

## 生产、离线与完整界面

[production-qa.js](./output/playwright/production-qa.js) 使用全新移动 context 访问生产预览 `localhost:4173`，等待 Service Worker 接管。

- 24 位图鉴、8 条流派、侦察棋盘、10 级概率表、44 项装备图鉴可打开。
- 手机选秀九个候选同屏可见；第三次强化可以选择并加入持有列表。
- 真实战斗可暂停；战斗中刷新回到准备阶段，未增加金币。
- 冠军结算、最终排名、侦察、返回结算和再弈一局通过。刷新不会重复记录战绩。
- 断网刷新后可加载棋盘、图片与操作；离线招募、二星合成、出售正常，第二次离线刷新保留完整状态。
- 生产流程没有页面脚本错误。
- 中期阵容、第三次强化与冠军页面使用 `scripts/qa-fixtures.ts` 生成并由 `validateSave` 验证的场景；冠军由真实结算方法生成。它们用于界面验收，不冒充人工完整夺冠。

## 当前截图

- [手机阵容预选](./output/playwright/lineup-picker-667.png)
- [商店推荐与升星提示](./output/playwright/lineup-shop-touch-844.png)
- [自选阵容](./output/playwright/lineup-custom-844.png)
- [横屏手机中期阵容](./output/playwright/landscape-production-932.png)
- [桌面中期阵容](./output/playwright/landscape-production-desktop.png)
- [拖入寻仙出售](./output/playwright/landscape-sale.png)
- [触屏拖售](./output/playwright/landscape-touch-sale.png)
- [一屏九位选秀](./output/playwright/landscape-carousel-final.png)
- [天命强化](./output/playwright/landscape-augment-final.png)
- [装备与合成](./output/playwright/landscape-equipment.png)
- [实际战斗](./output/playwright/landscape-battle-final.png)
- [终局测试场景](./output/playwright/landscape-champion-final.png)
- [断网运行](./output/playwright/landscape-offline.png)
- [竖屏引导](./output/playwright/landscape-portrait-guide.png)

## 验证边界

当前交付为横屏浏览器/PWA 单机手游，尚未验证实体 Android/iPhone、iOS Safari、原生安装包和应用商店签名。横屏锁定取决于浏览器/系统能力；不支持时显示旋转提示。已检验代码安全区与多个视口，但没有将浏览器触屏模拟写成实体设备验收。没有进行长期平衡性与大规模机型性能测试。
