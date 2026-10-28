公开研究案例 P1 / NP / 1

来源：An Open Insole-Based Plantar Pressure Dataset at Varying Cadences Compared
Against GAITRite，版本1，2026年4月20日。
https://doi.org/10.5281/zenodo.19662017

这份子集用于观察公开研究中一段正常自选步速行走的左右鞋垫信号。
不需要本校学生先采集设备数据。它不属于LTM-ZDYL-200设备输出。

文件
- case-p1-np-1.json：两侧各249帧，每帧保留32通道值、原copX/copY、原sumP。
- source/P1_NP_1_L.csv、R.csv：原始字节，另含IMU通道。
- source/P1_NP_1_sync_auto.json：来源同步元信息原件，仅供核对。
- source/sensors_map_left.svg、right.svg：Zenodo单独发布的布局原件。
- ../licenses/：署名、修改说明、API许可快照及原ZIP目录许可核对记录。
- ../tools/check_pressure_data.py：使用Python标准库独立核对原值、来源哈希和CoP数值。

坐标和单位
通道没有核定的物理压力单位，此版本不换算为kPa或牛顿。
sumP是32通道值之和，不是已经确认的总力。
CoP是来源的鞋垫绘图坐标，不能标为毫米或厘米，也不是全身质心。
points数组第i项对应PressureSensor i，i从0到31。y较小为趾端，y较大为跟端。
各点是稀疏传感器位置，插值产生的连续热图仅为可视化，不是更多测得传感器。

几何来源
发布SVG含32个圆形电极和完整编号，本子集直接读取圆心与编号进行布局核对。
SVG绘图坐标和导出CoP坐标并非完全相同尺度，不能直接当成物理配准。
为保留来源CoP坐标系统，从公开CSV的values、sumP和copX/copY关系独立还原
32点绘图坐标。249帧的系数矩阵满秩32，结果吻合0.5单位坐标至4e-11以内。
这些坐标也与作者查看程序中的点列表逐项吻合，但没有复制或打包该程序代码。
SVG按编号的布局在仿射显示对齐后最大残差约4.20 SVG单位，属于示意布局核对，
不构成传感器实际测量位置或有效面积的标定。
SVG内部docname/desc保留相反侧的旧命名，本包保留原字节，使用公开文件名、
编号布局和导出数据关系核对侧别，没有为制造吻合而镜像测量值。

数值关系
本例重新计算的是来源通道权重坐标：
  Cx = sum(values[i] * points[i].x) / sum(values[i])
  Cy = sum(values[i] * points[i].y) / sum(values[i])
它能重现原copX/copY，但不能因此宣称这些通道已经具有准确物理压力单位。
一般平面压力阵列的物理公式以p_i*A_i为力权重；本来源有效面积未核定，
不在本例中冒填A_i，也不输出由此推算的真实接触力。

时间和筛选
原CSV没有时间戳。index为0起始帧号，t=index/64只表示按标称64Hz重建的相对时间。
L/R分别回放，不将同帧号当作已验证绝对同步，也不合成双足全局CoP。
原资料没有有效接触标签。低总值时原CoP仍存在，不能直接当作有效接触轨迹。
建议界面默认用“本侧片段峰值sumP的15%”作为可调整的教学分析筛选阈值，
并清楚记录该设置。它选取L154帧、R151帧，不是设备或临床接触判据。
筛选前后均保留原数据；图形应在被排除的帧之间断线，避免补画不存在的连续轨迹。

许可
Zenodo记录API声明数据CC BY 4.0。原ZIP目录4724项中未找到README/LICENSE/
terms/usage/copyright/citation等附加条款文件。见ZIP_LICENSE_REVIEW.json。
本次仅读取ZIP目录及3个小型成员，并没有下载或核验整个1.7GB ZIP。
原件和本子集再分发时应保留原作者、DOI、许可链接及本次选取/转换说明。
没有使用许可冲突尚未厘清的CAD WALK，也没有将其他项目的程序许可套用到数据。
