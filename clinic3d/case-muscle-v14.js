// Original knowledge/method exercises. This module does not measure a patient,
// assign an MMT grade, compute joint torque, or generate muscle activation data.
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

export const MUSCLE_ITEMS = freeze([
  {
    id: 'dorsiflexion', label: '踝关节背屈', motion: '足背靠近小腿前侧',
    muscles: ['胫骨前肌'], groupLabel: '背屈肌群 · 以胫骨前肌为代表',
    contributors: ['趾长伸肌', '拇长伸肌', '第三腓骨肌'],
    position: '可采用有支撑的坐位；固定小腿并观察踝背屈，避免只伸脚趾或抬起整条腿。',
    limits: ['不能把伸趾动作当成完成踝背屈。', '非标准减重体位的表现不能直接套用抗重力体位等级。', '本项只做肌群与检查条件匹配，不给陈女士生成肌力分数。'],
    sourceIds: ['mmt_mrc', 'mmt_nih']
  },
  {
    id: 'plantarflexion', label: '踝关节跖屈', motion: '足背远离小腿前侧',
    muscles: ['腓肠肌', '比目鱼肌'], groupLabel: '跖屈肌群 · 腓肠肌与比目鱼肌',
    contributors: ['胫骨后肌', '腓骨长肌', '腓骨短肌', '趾长屈肌', '拇长屈肌'],
    position: '按既定方案选择非负重检查或有保护的站立提踵；记录膝屈伸位置，不能把两种方法的结果直接混用。',
    limits: ['腓肠肌跨膝，改变膝角会改变检查条件；屈膝不能理解为完全孤立比目鱼肌。', '站立提踵也受体重、平衡、疼痛和动作策略影响，不等同于单块肌肉的定量力量。', '不愿负重或不稳时先选择可耐受的方法，不强行完成单腿提踵。'],
    sourceIds: ['mmt_mrc', 'mmt_nih', 'rom_knee2016']
  },
  {
    id: 'inversion', label: '足内翻', motion: '足底朝向身体内侧',
    muscles: ['胫骨后肌', '胫骨前肌'], groupLabel: '内翻相关肌群 · 胫骨后肌与胫骨前肌',
    contributors: [],
    position: '小腿获得支撑并固定；按目标肌选择内翻伴跖屈或内翻伴背屈，避免髋旋转代替足部运动。',
    limits: ['胫骨后肌和胫骨前肌都参与内翻，踝位改变会影响检查侧重。', '足内翻是踝足复合运动，不能说成距小腿关节独立三轴中的一个自由转轴。', '手动抵抗只能按指定方法解释，不能据此直接读出内翻力矩。'],
    sourceIds: ['mmt_mrc', 'rom_openstax', 'rom_in_vivo1989']
  },
  {
    id: 'eversion', label: '足外翻', motion: '足底朝向身体外侧',
    muscles: ['腓骨长肌', '腓骨短肌'], groupLabel: '外翻相关肌群 · 腓骨长肌与腓骨短肌',
    contributors: ['第三腓骨肌'],
    position: '小腿获得支撑并固定；按同一足位观察外翻与抵抗表现，避免髋旋转或单纯伸趾代偿。',
    limits: ['外翻相关肌群不只一种作用，也参与踝足稳定控制。', '一次手动抵抗不能推算外翻力矩数值、反应潜伏期或步行中的EMG激活时序。', '虚拟肌肉显隐用于认结构，颜色和网格形变不等于肌肉激活测量。'],
    sourceIds: ['mmt_mrc', 'mmt_quantitative1997', 'emg_seniam']
  }
]);

export const MUSCLE_GROUP_OPTIONS = freeze(MUSCLE_ITEMS.map(item => ({ id: item.id, label: item.groupLabel })));

export const MUSCLE_CONDITIONS = freeze([
  { id: 'consent_stop', label: '先说明、确认愿意；疼痛增加或要求停止就结束。' },
  { id: 'position_knee', label: '按目标肌群选体位，记录膝角、踝足起始位与负重条件。' },
  { id: 'stabilize', label: '统一固定与阻力方向，观察代偿；不突然增加阻力。' },
  { id: 'same_method', label: '左右及复评用同一方法，记录疼痛、疲劳和必要休息。' },
  { id: 'scope', label: '区分知识练习与实际测力，不由MMT推算力矩或EMG。' }
]);

export const MUSCLE_DIALOGUE = freeze([
  { speaker: '林治疗师', text: '先认清肌群，再按动作选择体位和阻力。' },
  { speaker: '陈女士', text: '右边觉得没劲，能直接说肌肉弱吗？' },
  { speaker: '林治疗师', text: '还要按方法比较，也要看疼痛和代偿。先把检查条件弄清楚。' }
]);

export const ROM_DIALOGUE = freeze([
  { speaker: '林治疗师', text: '先坐稳，做小幅背屈和跖屈；哪里紧或痛就告诉我。' },
  { speaker: '陈女士', text: '右边往上时发紧。' },
  { speaker: '林治疗师', text: '坐位和站立的方法不同。统一膝角、足位，再比较左右。发紧不等于骨头错位。' }
]);

export const MUSCLE_LESSON = freeze({
  id: 'ankle-muscle-method-v14', sourceType: 'authored_knowledge_and_method_exercise',
  title: '肌群、动作与检查条件',
  purpose: '解释动作由哪些肌群参与，为什么肌力比较要统一方法。',
  steps: ['将四个动作匹配到主要肌群。', '核对检查体位、固定与患者感受。', '判断哪些结论目前仍不能得出。'],
  completionMeaning: '完成知识与方法判断；不代表已在患者身上完成徒手肌力测试。',
  unsupportedInferences: [
    '从角色动作、一次抵抗或主观乏力直接写出陈女士的MMT等级。',
    '把MRC等级当成等距百分数，例如4级等于80%的正常力量。',
    '由MMT或足底压力推算外翻力矩、EMG振幅或肌肉激活先后。',
    '要求所有踝足肌群全程俯卧检查，或把不同体位的结果直接相减。'
  ],
  patientMeasurementPerformed: false, patientMmtGrade: null, patientTorqueNm: null,
  patientEmgRecorded: false, clinicalApproved: false,
  sourceFile: 'docs/v14-rom-mmt-sources.json'
});
