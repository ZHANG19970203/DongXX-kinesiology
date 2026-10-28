# v14 八幕迁移独立审计

审计日期：2026-10-18。起始基线为本轮修改前读取的 v13 文件；本报告区分该基线中的风险与 v14 的最小迁移建议。根代理在审计期间并行实施 app/flow 改动，报告不把初读行号当作最终源码行号。初始任务为只读；随后授权本代理实现的运行文件仅为 `learning-ui.js`、`lesson-coach.js`。其余运行源码未由本代理修改。

## 结论与边界

可以保留原 node ID、事件和证据目录，用八幕重新组织教学。不能只把“6”改为“8”：原代码把 act 编号同时当作章节、空间区域、摄像机与赤足准备的依据，直接重编号会让步态走进诊查床区、平衡使用足压站位或错误复穿鞋。

新肌力幕应是“动作—肌群与方法条件的知识判断”，不能声明已完成规范徒手施阻、给患者 MMT 分数、读取肌力/力矩/EMG。现有量角器仅核对外踝轴心及固定臂、移动臂三处参考，不是患者实测角度。静态足弓的新侧足轮廓是虚构病例示意，不能当作通用人物网格已经发生真实足弓形变。

## 目标结构及旧 ID 的保留

| 新幕 | 教学领域 | 保留节点 | 建议空间键 |
|---|---|---|---|
| 1 | 问诊、安全与共同目标 | welcome、history、trigger_answer、safety、safety_answer、goal、goal_answer、consent、consent_reply | consult |
| 2 | ROM 与试次条件 | local_intro、tool、alignment、trial、local_record、local_explain | exam；trial/local_record 用 wall |
| 3 | 肌力知识与检查条件 | 新增 strength/muscle 系列 ID，不覆盖旧 ID | exam |
| 4 | 静态足弓 | arch_intro、arch_concern；必要时新增 arch_observe | arch/static 对应稳定站位 |
| 5 | 步态周期 | gait_intro、gait_instruction、gait_events、gait_interpret | gait |
| 6 | 足底压力与 COP | pressure_conditions、pressure_compare、cop_explain | pressure |
| 7 | 平衡与停止 | balance_intro、balance_choice、balance_trial、balance_stop、balance_explain | balance |
| 8 | 综合判断与共同计划 | plan_intro、plan、plan_patient、teachback | consult |
| 复盘 | 证据与迁移 | debrief、uncertainty、transfer、finish | consult/evidence |

`medical_stop`、`symptom_stop`、`decline_stop`、`safe_finish` 保留原 ID、终结语义及停止原因；它们不属于必须逐幕通关的物理检查清单。复盘可以是第 8 幕后的独立记录步骤，但进度栏必须统一选择八幕加复盘或八幕内复盘的表达，不能同时出现 `/8` 和九幕计数。

新会话主线的最小接线：`local_explain` 合理分支 → 新肌群方法任务 → `arch_intro` / 静态足弓任务 → `arch_concern` → `gait_intro` → `gait_interpret` 合理分支 → `pressure_conditions` → 原足压、平衡和计划路线。原 v13 的 `gait_interpret → arch_intro` 与 `arch_concern → pressure_conditions` 必须一起改，单改一边会回环或跳过静态足弓。拒绝局部接触的 `tool.skip_contact` 要继续保留“局部未做”的记录，不得因新增幕自动补 `alignment`、`local_record` 或肌力结果。

## 具体硬编码与风险清单

| 文件/位置 | v13 初读状态 | 八幕迁移要求 |
|---|---|---|
| case-flow.js / CASE_DATA.acts | act1…act6 + debrief，旧 act3 是步态，act4 同时包含足弓/足压 | 八幕内容表应为唯一章节定义；静态足弓和足压分开 |
| case-flow.js / N helper | 默认将 act1/act6 设为 consult，其他默认 visualMode=act | 不应再由编号猜区域；每节点明确语义 visualMode 或统一领域配置 |
| case-flow.js / ACT_EDUCATION | 仅六幕的 why/concept/steps/care | 扩为八幕，避免新肌力沿用旧步态教育；node/task 的教育必须同步 |
| case-flow.js / 节点边 | local_explain→gait、gait→arch、arch→pressure | 同步改上述三段；保留旧节点/option ID 以兼容历史 |
| app.js / chapters | 手写七项，与 CASE_DATA.acts 重复 | 从内容元数据导出；不要留下第二套编号 |
| app.js / chapterNumber | 字面量 ` / 6` | 用八幕数或内容元数据计算；debrief 单独处理 |
| app.js / purpose fallback | act1…act6 对应旧教育文字 | 扩为八幕或用节点教育；避免 act3 肌力显示步态目的 |
| app.js / setVisual | act2→exam/wall，act3→gait，act4→pressure，act5→balance，其余 consult | 高风险项：改为语义 mode→zone；新 muscle、arch 与八幕映射均须覆盖 |
| app.js / saved migration | v13 仅识别 v12/v11/v10；只有 v12 保留 taskState | v14 必须优先读取 v13，并原样保留兼容 taskState；不得落入旧版清空分支 |
| app.js / barefootPrepared fallback | 根据旧 act3/4/5/6 判断此前已准备 | 不得用重编号后的 act 推断旧存档；按旧 node ID/visited 与原字段判断 |
| app.js / startPreparation | 用 act2 和 `__preparation`，临时切 exam | 保留独立准备动作与 17.6 秒阻挡，不由新幕反复触发；肌力幕不能另脱一次 |
| app.js / actor/camera | zone 决定姿态、站位、镜头、服装和记录夹 | 使用稳定的 consult/exam/wall/gait/pressure/balance 语义，新增 arch 明确映射 |
| app.js / taskComplete | 只处理 goniometer/gait/pressure/balance，其余默认 true | 必须新增 muscle 全四项正确、arch 两状态已看的实际 gate；否则选项可直接跳过 |
| learning-ui.js | 未知 task 会隐藏 wrap，dock 无 muscle/arch 标题 | 已按追加授权新增两个真实面板与标题；保持小面板、详解折叠 |
| lesson-coach.js | coachStage 用 act3/4 宣称“第3步步态/第4步足压” | 已改为 task.type 决定阶段及控件定位，肌群 select/足弓按钮均为真实控件 |
| test-flow.mjs / rail | 固定断言 buttons.length===7 | 改为内容定义长度；再明确八幕/复盘的计数契约 |
| test-flow.mjs / satisfyTask | 没有 muscle/arch fixture | 新 fixture 填真实任务字段，另测未完成/错误操作不能取得证据 |
| test-flow.mjs / walk | 固定 route 上限 70 | 新增节点后确认上限够用，不能用提高上限掩盖回环 |
| test-flow.mjs / restore coverage | 只测抽出的控制函数，不执行真实版本读取代码 | 必须补 v13→v14 迁移函数测试及浏览器实际存档恢复；控制函数测试不能替代迁移验证 |
| test-flow.mjs / 标识 | v13 schema、默认报告名、“六幕”测试标题 | 报告及断言跟最终结构一致；保留历史报告不覆盖旧交付 |

## 当前 pressure_compare 与十二条证据的兼容方案

本审计不读取或修改用户浏览器存储。根据根代理确认的当前节点 `pressure_compare`、证据数 12，以及 v13 正常路线，十二条应为：

1. triggers
2. injury_history
3. screening
4. goal
5. consent
6. alignment
7. valid_trial
8. local_record
9. gait_events
10. gait_observation
11. arch_record
12. pressure_conditions

这些 ID 的实际列表仍应由根代理浏览器只读核对，不宜只凭数字替换用户数据。`pressure_record` 是当前足压判断完成后才取得的下一条证据，不可在迁移时补进来。

最小迁移对象应复制原 `sessionId`、`startedAt`、`node`、`history`、`evidence`、`events`、`visited`、`taskReceipts`、`records`、`choiceLock`、`exitLock`、`exitReason`、`completedAt`、`reflection`、`barefootPrepared`、`taskState`。`pressure_compare` 的 `taskState.nodeId`、`values.region`、`dynamicMin`、`dynamicMax`、`phase`、`pressureMode` 的语义与 v13 一致，应直接保留。新增版本键不得删除旧键；记录一条迁移元数据即可，不复制成新的“已实施检查”事件。

恢复时继续调用 `goto(saved.node,{restoring:true})`，原恢复逻辑不会再次添加 node.evidence；不要为了八幕顺序把当前用户踢回第 3 幕，也不要把新增肌力/静态足弓交互标记为已完成。可在教师审查记录写“该会话早于新增肌力知识任务，未完成该新增任务”；这不应在学生界面形成打断式技术告警。

新增强度/静态足弓证据的处理：旧 `arch_record` 仍保留它原本的 `fictional_case_record` 来源，不升级为真实测量或新任务完成。新增 muscle 方法/知识证据只有真正走到新任务并正确提交后才添加。计划允许基于现有证据继续与选择“补齐缺失评估”；不能要求旧用户已经取得新肌力结果才能完成整条旧会话，也不能据已完成肌群匹配认定患者力量不足。

`choiceLock` 需要特别保留：旧会话已经选中、尚未继续的 `nextId` 应保持原路线，尤其三个安全分支。不要把旧待提交选择悄悄改成新物理任务。在当前 `pressure_compare` 后未选择时使用新版正常后续即可，因为足压之后的平衡/计划 ID 未变。

已完成旧记录继续归一到原 `finish` 或 `safe_finish`，保持只读和完成事件幂等。`exitLock` 不能因新版本清空；安全结局不得经八幕补课重新进入体能任务。

## 角色、道具、鞋袜与动作/镜头确认点

- 男女角色身份、深蓝治疗师服装及原骨架不依赖 act 编号，八幕无需改 appearance 或基础 rig。新病例文本仍使用“林治疗师/陈女士”，不要触发旧“陈先生”别名误判。
- 记录夹使用 `bindDocumentation` / `setDocumentation`。当前 setVisual 按 zone 为 consult/balance/exam/wall 放桌，gait/pressure 携带。新增肌力涉及施阻/保护时必须双手空闲，不能只把 act3 沿用旧步态 carry。新静态足弓可观察时 carry，接触患者前 desk。
- 患者第一次局部检查前连续脱鞋袜；`barefootPrepared` 保留。新增肌力/静态足弓不会重放动作。当前实际步态/足压为赤足，之后返回接诊区会重新显示鞋；不要把这种状态恢复描述为已有完整穿鞋动画。
- 脱下鞋袜已转为 scene 世界坐标，道具不会跟着患者走；显式重穿会恢复附着。八幕迁移不要重建 actor/root 来达到章节切换，否则会丢这组状态。
- `setGaitPhase(null)` 从手动步态退出时即时清除 walking/walkWeight 并重算静态足位；保留该修复。新静态足弓不得残留前一幕摆动脚或动态压力轨迹。
- 肌力知识任务继续坐位 exam 镜头即可，但不能把“人物保持坐位”说成规范徒手测试动画已经完成。足弓病例图仅作旁证，人物不必伪造形变。
- 五块足压板、COP、步态相位由 task.type / pressureMode 驱动，并非章节编号；保留同一个 sampler。新 arch task 不能误标成 pressure task 而自动走板。
- scene-room.js 的 setActivity 仍含 act3/4/5/6 的旧正则别名。app 若始终传稳定语义 zone 可以兼容；若直接传新幕编号，就必须更新这些别名，不能让 act3 肌力亮步态区域。
- 当前 cameras 只有 consult/exam/wall/gait/pressure/balance。新增 arch 应明确选已有稳定站位镜头或新增语义预设；不能 fallback 到 consult 却让人物在足压区。

## 本代理已实施的两个 UI 任务与独立检查

`learning-ui.js` 的 muscle 使用实际 `MUSCLE_ITEMS`。四个 select 各提供四组主要肌群字符串（muscles 数组用“、”连接）；正确设置 `muscle_<id>=true`，改错删除该 gate，答案另存 `muscle_answer_<id>` 以恢复显示。不会保存患者肌力等级。

arch 提供坐/站两张原创侧足轮廓，默认仅记实际可见的坐位为 `arch_seated=true`，站立必须切换才记 `arch_standing=true`；恢复已有 `arch_mode` 决定回显。图旁说明是病例侧足示意，不对应人物通用网格。三种足弓知识对照和解剖窗可选打开，不替代主任务证据。

同步教学旁白 `education.teacherNarration`（数组）连接成自然段，放在默认折叠的学习说明中；knowledge 数组与已有概念一起显示。不自动朗读长篇。

独立可执行检查为 `docs/v14-new-task-ui-tests.mjs`，输出同名 JSON。它导入真实 learning-ui/lesson-coach/MUSCLE_ITEMS，使用 DOM stub 检查：四个真实 select、正确匹配、改错清除 gate、恢复答案、初始坐位不补站立、切换站立、仅站立恢复不造坐位、coach 指向真实控件及按 task.type 显示八幕编号。解剖/三足弓 viewer 被替身隔离；该检查不声称浏览器画面、临床肌力、真实足弓形变或全流程存档均已验证。

最终集成还应核对：新会话依序经过八领域；原三安全路线立即锁定并正常终结；拒绝局部检查不补结果；实际 v13 pressure_compare 十二条证据/原会话ID/动态区间恢复不丢；完成记录保持只读；新增 muscle 与 arch 的未完成 gate 不可绕过。临床动作与教学稿仍需教师审查。
