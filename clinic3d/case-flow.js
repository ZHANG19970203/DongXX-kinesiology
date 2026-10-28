import { EIGHT_ACT_EDUCATION, CLINICAL_SOURCE_LINKS } from './case-lesson-v14.js';
// Original fixed teaching dialogue. No remote model, diagnosis engine, or measured patient data.
export const START_NODE = 'welcome';

export const CASE_DATA = {
  id: 'chen-right-ankle-v12',
  title: '再次安心走上不平的路',
  patient: '陈女士', patientGender: 'female', age: 22,
  therapist: '林治疗师', therapistGender: 'male',
  label: '虚构教学病例',
  intakeSummary: '因反复崴脚和不稳感就诊；具体病史在询问后逐步展开。',
  historyInitiallyLocked: true,
  presentation: '一年前右踝扭伤，此后又有两次扭伤；变向和不平路面时偶有打软腿。',
  goal: '先安心走不平路面，再逐步讨论回到跑步活动。',
  premise: '反复扭伤与不稳感需要综合评估。负重低足弓是逐步发现的足形特征，不能预设为唯一病因。',
  source: '课程原创病例与受控教学示意；不是患者实测资料。',
  acts: [
    {id:'act1',title:'接诊问诊与共同目标',shortTitle:'问诊',zone:'接诊区'},
    {id:'act2',title:'踝足活动与测量方法',shortTitle:'活动度',zone:'诊查床与墙边'},
    {id:'act3',title:'肌群与检查方法',shortTitle:'肌力',zone:'诊查床'},
    {id:'act4',title:'静态足弓形态比较',shortTitle:'足弓',zone:'静态评估区'},
    {id:'act5',title:'步态周期与双侧差异',shortTitle:'步态',zone:'中央观察带'},
    {id:'act6',title:'足底负荷与压力中心',shortTitle:'足压',zone:'连续压力板'},
    {id:'act7',title:'平衡与感觉信息',shortTitle:'平衡',zone:'扶手旁'},
    {id:'act8',title:'综合解释与共同计划',shortTitle:'计划',zone:'接诊区'},
    {id:'debrief',title:'证据复盘',shortTitle:'复盘',zone:'教学证据板'}
  ]
};

export const EVIDENCE_CATALOG = {
  triggers: {label: '变向及不平路面不稳', status: 'patient_report', text: '患者报告的触发情境，不是运动捕捉结果。'},
  injury_history: {label: '右踝反复扭伤史', status: 'patient_report', text: '一年前首次扭伤，此后两次扭伤；口述不能重建受伤时的关节角度。'},
  screening: {label: '本病例当前安全询问', status: 'patient_report', text: '本病例回答无近期新伤、明显加重症状或当前不能负重；不能等同完成所有医学筛查。'},
  goal: {label: '安心走不平路面', status: 'patient_report', text: '共同活动目标，恢复跑步需要后续任务评估。'},
  consent: {label: '已解释并获本轮同意', status: 'communication', text: '同意可随时撤回；每次新增接触或任务仍需说明。'},
  alignment: {label: '量角器对线教学', status: 'authored_demonstration', text: '识别本教学图标示的轴心和两条参考线，不是患者实测角度。'},
  valid_trial: {label: '识别同方法有效试次', status: 'authored_demonstration', text: '足跟落地、足与膝方向符合设定、同一方法的试次可用于比较。'},
  local_record: {label: '虚构病例的活动表现记录', status: 'fictional_case_record', text: '病例设定右侧负重背屈表现较小；未显示测量值，不据此定位某组织病变。'},
  gait_events: {label: '同一示意片段的接触/离地事件', status: 'authored_demonstration', text: '学习用事件区分支撑与摆动；时标由作者编排，不是正常阈值或真实患者步态。'},
  gait_observation: {label: '将步态观察与机制推断分开', status: 'reasoning', text: '记录可见事件和患者感受；动画不提供力矩、肌力、韧带状态或病理诊断。'},
  arch_record: {label: '虚构病例的负重低足弓特征', status: 'fictional_case_record', text: '病例设定坐站时足弓外观不同；不能单凭两幅示意确诊柔韧性扁平足或证明因果。'},
  pressure_conditions: {label: '先核对足压比较条件', status: 'reasoning', text: '区分静态/动态、足侧、单位、色标与有效接触时段。'},
  pressure_record: {label: '同条件负荷分布教学比较', status: 'synthetic_teaching_data', text: '使用合成教学图，不是设备采集；颜色表示该色标下的相对负荷，不等同疼痛或损伤。'},
  cop_scope: {label: 'COP解释及其限度', status: 'reasoning', text: 'COP是接触合力作用位置；不是身体重心、骨移动轨迹或扭伤病因证明。'},
  balance_setup: {label: '先选可保护的低难度任务', status: 'safety_decision', text: '稳定地面、睁眼、稳定扶手与保护位置；不能以按钮替代真实保护手法。'},
  balance_record: {label: '虚构平衡试次的终止记录', status: 'fictional_case_record', text: '患者另一脚落地并要求停止，试次结束；未获得真实时长或感觉通路诊断。'},
  stopped_safely: {label: '停止、回稳与询问感受', status: 'safety_decision', text: '不强迫继续，不把退出算配合差，不把暂停动画算已实施临床搀扶。'},
  plan_shared: {label: '围绕目标讨论方案', status: 'shared_plan', text: '可选择不同合理组合；仅为教学计划，不是处方或恢复运动的许可。'},
  teachback: {label: '患者复述暂停与复评', status: 'communication', text: '核对理解，不以动画播放完表示功能恢复。'},
  uncertainty: {label: '保留尚未证明的机制', status: 'reasoning', text: '未证明低足弓是唯一病因，未证明韧带松弛、距骨移位或某条感觉通路损伤。'},
  declined: {label: '患者选择不继续检查', status: 'not_performed', text: '尊重意愿；未做检查不记为正常或阴性。'},
  referral: {label: '进一步医学评估分支', status: 'not_performed', text: '教学替代情境出现新伤与明显不能负重，退出全部体能任务；不是本病例默认既有事实。'}
};

export const TEACHER_LIMITATIONS = [
  {id: 'clinical', status: 'pending_review', title: '专业审查', text: '固定对白、检查顺序、动作及对线尚需足踝专业教师逐项签审；本内容不作真实患者诊断或恢复运动的许可。'},
  {id: 'gait_metrics', status: 'hypothetical_case', title: '双侧步态教学设定', text: '右支撑56%、左64%，右步长0.48m、左0.40m、步宽0.14m、周期1.20s；步速由0.88/1.20计算。均为原创教学参数，不是患者测量、正常阈值或CAI通用模式。骨盆参考点不等于全身重心。'},
  {id: 'motion', status: 'authored_demo', title: '动作与事件', text: '场景中的角色、时间轴和动作是作者编排的教学示意，未作患者级运动学配准；事件位置须与实际播放片段一同核对，不能套用为正常步态比例。'},
  {id: 'goniometer', status: 'pending_review', title: '量角器', text: '坐位矢状面示意使用外踝、腓骨外侧与第五跖骨外侧参考线；考察标志识别，不从通用角色骨架输出患者角度或宣称测量准确。'},
  {id: 'pressure', status: 'synthetic', title: '压力与COP', text: '当前仅为合成教学演示。未接传感器，不反演彩图为精确压力或COP，不显示肌肉力、韧带拉力或真实压力单位。'},
  {id: 'arch', status: 'case_record', title: '低足弓', text: '低足弓为虚构病例记录。专门足部形变和坐站动作未完成审核时，使用病例资料判读，不把通用角色外形当作已检查结果。'},
  {id: 'balance', status: 'pending_review', title: '平衡与保护', text: '分级、停止及回稳是教学流程。真实搀扶、保护接触与完整动作仍须审核；无真实力板或时间成绩，不诊断本体感觉损伤。'},
  {id: 'funding', status: 'not_submission_ready', title: '交付范围', text: '这是净化迁移项目中的互动病例原型，非临床验证成品、医院建筑验收或国家项目申报认证。'},
  {id: 'heygen', status: 'no_generation', title: '付费制作', text: '本内容文件无HeyGen请求、上传、视频或语音生成。锁定角色、台词、首片费用后再单独制作对话素材。'}
];

const N = (id, act, kind, speaker, text, extra = {}) => ({id, act, kind, speaker, text, options: [], next: null, visualMode: act === 'act1' || act === 'act6' ? 'consult' : act, patientCue: '自然呼吸，面向交流对象', ...extra});
const O = (id, label, next, feedback, extra = {}) => ({id, label, next, feedback, good: true, safe: true, ...extra});
const retry = (id, label, next, feedback, extra = {}) => O(id, label, next, feedback, {good: false, retry: true, ...extra});

export const FLOW = {
  welcome: N('welcome', 'act1', 'dialogue', '林治疗师', '陈女士，你好，我是林治疗师。请坐。先说说脚踝的困扰，我们再商量检查。', {next: 'history', visualMode: 'arrival', patientCue: '面向患者点头示意，留出通道；患者停稳后落座，治疗师待其坐稳再交流'}),
  history: N('history', 'act1', 'choice', '邀请她说一说', '什么时候容易不稳？请先听她描述。', {task: {type: 'history', instructions: '先听患者怎么描述，再追问受伤经过和具体情境。'}, options: [
    O('ask_trigger', '什么情况下不稳？受伤经过怎样？', 'trigger_answer', '用开放提问了解她的经历；听完再追问，不急着给病因标签。'),
    retry('assume_arch', '先认定低足弓就是病因。', 'history', '尚未检查足形，更不能把它认作唯一原因。请先听病史。'),
    retry('challenge_first', '直接闭眼单脚站。', 'history', '还不了解症状、安全和意愿，不能直接增加体能挑战。', {safe: false})
  ]}),
  trigger_answer: N('trigger_answer', 'act1', 'dialogue', '陈女士', '快一年前跑步扭了右脚，后来又崴过两次，最近是一个月前跑步变向。走不平路时，总怕撑不住。', {next: 'safety', patientCue: '看向治疗师，说到再次扭伤时略显担心', evidence: ['triggers', 'injury_history']}),
  safety: N('safety', 'act1', 'choice', '回应担心，先问安全', '先问近期变化，判断是否适合活动。', {task: {type: 'history'}, options: [
    O('ask_screening', '近期有新伤、疼肿加重、麻木或不能负重吗？', 'safety_answer', '承认担心，再核对近期变化。回答会影响接下来的检查选择。'),
    retry('skip_screening', '您都能走进来了，我们就直接做单脚站立吧。', 'safety', '来到诊室不等于已经排除不宜挑战的情况。', {safe: false}),
    O('alternate_alert', '替代情境：新伤后明显不能负重。', 'medical_stop', '这个分支应结束体能任务，转进一步医学评估。', {record: {scenario: 'new_injury_alternative'}, evidence: ['referral']})
  ]}),
  safety_answer: N('safety_answer', 'act1', 'dialogue', '陈女士', '最近没有新伤、麻木或明显肿胀，能走路。久站后右脚内侧有点酸。', {next: 'goal', evidence: ['screening']}),
  goal: N('goal', 'act1', 'choice', '找到她最在意的事', '她最想先恢复什么活动？', {options: [
    O('ask_goal', '之前怎样处理？最想先改善什么？', 'goal_answer', '给出生活例子帮助表达，但由患者确定优先目标。'),
    retry('cosmetic_goal', '只把足弓外观变标准。', 'goal', '外观不能代替功能目标；请了解她真正受影响的活动。')
  ]}),
  goal_answer: N('goal_answer', 'act1', 'dialogue', '陈女士', '当时说没骨折，休息后没系统练过。我想先安心走不平路，再慢慢跑步。', {next: 'consent', evidence: ['goal']}),
  consent: N('consent', 'act1', 'choice', '先解释，再邀请', '说明目的和暂停方式，再征求同意。', {options: [
    O('explain_consent', '先看活动、步态与负荷，每步先说明，随时可停。愿意吗？', 'consent_reply', '把检查和患者目标连接起来，并留下提问、调整和拒绝的空间。'),
    retry('command_only', '按要求做完，先别问。', 'consent', '患者需要知道目的，也可以选择暂停或不做。')
  ]}),
  consent_reply: N('consent_reply', 'act1', 'choice', '陈女士', '可以。但我怕又崴，会很疼吗？', {patientCue: '微向前倾，等待解释', options: [
    O('reassure_without_guarantee', '先做能耐受的小幅动作。有支撑，你说停就停。', 'local_intro', '回应具体顾虑，说明可控的保护和暂停方式，不作绝对安全保证。', {evidence: ['consent']}),
    O('respect_decline', '也可以今天先交流，下次再决定检查。', 'decline_stop', '尊重拒绝，未做检查不补成正常结果。', {evidence: ['declined']}),
    retry('guarantee_no_pain', '保证不会疼，也不会再崴。', 'consent_reply', '不要作无法兑现的安全保证。应说明可调整和随时停止。')
  ]}),
  local_intro: N('local_intro', 'act2', 'dialogue', '林治疗师', '请坐稳，先脱鞋袜。我们看踝关节背屈、跖屈，再看负重背屈。不舒服就停。', {next: 'tool', visualMode: 'exam', patientCue: '先邀请患者坐稳并确认舒服；双脚落地，说明后才尝试小幅踝关节背屈、跖屈'}),
  tool: N('tool', 'act2', 'task', '准备观察脚踝活动', '先选量角器，认识对线标志。', {visualMode: 'goniometer', task: {type: 'goniometer', stage: 'tool', instructions: '选择用于角度对线的教具；这一步先学会放在哪里、看哪两条线。'}, options: [
    O('choose_goniometer', '通用量角器：轴心与两臂', 'alignment', '刻度分辨率不等于测量准确度；先统一体位和标志。'),
    retry('choose_tape', '软皮尺：直接读关节角度', 'tool', '软尺可量长度，不能直接替代本项角度对线。'),
    O('skip_contact', '患者不愿检查：记录未做，进入步态。', 'gait_intro', '可继续讨论已知信息；不能把活动度写成已测或正常。', {evidence: ['declined'], record: {localCheck: 'not_performed'}})
  ]}),
  alignment: N('alignment', 'act2', 'task', '看懂量角器的三处对线', '依次核对外踝、腓骨外侧与第五跖骨外侧。', {visualMode: 'goniometer', task: {type: 'goniometer', stage: 'alignment', instructions: '依次确认：轴心在外踝；固定臂沿腓骨外侧；移动臂沿第五跖骨外侧。', checklist: ['轴心对应外踝标志', '固定臂沿腓骨外侧参考线', '移动臂沿第五跖骨外侧参考线'], target: {axis: 'lateral_malleolus', proximalArm: 'lateral_fibula', distalArm: 'lateral_fifth_metatarsal'}, measurePatientAngle: false}, options: [
    O('alignment_checked', '三处已核对，进入试次判断', 'trial', '这是标志对线练习，不据通用角色读取患者真实角度。', {evidence: ['alignment'], requiresTask: true}),
    retry('max_angle', '动画转到最大，就完成测量。', 'alignment', '动画旋转值不等于患者关节角度；需要体位、固定和标志一致。')
  ]}),
  trial: N('trial', 'act2', 'task', '怎样让左右比较有意义', '左右同方法、足跟落地，比较才有意义。请选择有效试次。', {visualMode: 'wall', patientCue: '先解释小腿前移与背屈关系；取得同意后面墙扶稳，小幅前移；主动询问感受', task: {type: 'trial', instructions: '先看脚跟是否落地，再核对足与膝的方向、左右方法和不适记录。', criteria: ['脚跟持续落地', '足与膝方向符合本次设定', '左右使用相同方法', '记录症状并尊重停止']}, options: [
    O('valid_pair', '同方法、足跟落地，无明显足外转代偿。', 'local_record', '方法一致、代偿受控后才比较；仍需记录试次与症状。', {evidence: ['valid_trial']}),
    retry('heel_lift', '足跟抬起碰得更远，就选这次。', 'trial', '脚跟抬起改变了任务条件，不能拿它证明背屈更大。'),
    retry('different_method', '右膝触墙、左坐位，直接比最大值。', 'trial', '不同体位和方法的结果不能直接互换。'),
    O('pain_stop', '不适加重并要求停止：停止这个动作。', 'symptom_stop', '暂停和稳定优先，不为完成记录继续做这个动作。', {record: {stopReason: 'increased_discomfort'}})
  ]}),
  local_record: N('local_record', 'act2', 'dialogue', '陈女士', '右边到这里就紧，再往前脚跟要抬。我怕骨头错位了。', {visualMode: 'wall', next: 'local_explain', patientCue: '停止前移，保留双手支撑'}),
  local_explain: N('local_explain', 'act2', 'choice', '回应患者', '发紧是否等于骨头错位？', {visualMode: 'exam', options: [
    O('limited_inference', '右侧负重背屈较小；发紧不等于错位，还需综合判断。', 'gait_intro', '先回应恐惧，再解释可见发现；把活动表现与尚未证实的组织机制分开。', {evidence: ['local_record']}),
    retry('talus_out', '一定是距骨移位，把它推回去就能根治。', 'local_explain', '当前没有证据支持脱位或唯一修复方法，不能这样承诺。')
  ]}),
  gait_intro: N('gait_intro', 'act3', 'dialogue', '陈女士', '保持赤足走就可以吗？要踩准每一块板吗？', {visualMode: 'gait', next: 'gait_instruction', patientCue: '在观察带起点停稳，等待说明'}),
  gait_instruction: N('gait_instruction', 'act3', 'choice', '给予指令', '说明自然行走的方法。', {visualMode: 'gait', options: [
    O('natural_walk', '保持赤足，按平常走法，不凑步踩板；不舒服就停。', 'gait_events', '解释观察什么，再给简单指令；起停、直线和转身分开记录。'),
    retry('force_target', '每一步必须踩准板中心。', 'gait_instruction', '刻意凑脚可能改变任务表现；不同片段要分别记录。')
  ]}),
  gait_events: N('gait_events', 'act3', 'task', '看懂一步中的承重过程', '比较双侧支撑时间与足印间距。先标记右足初始接触，再标记足离地。', {visualMode: 'gait', task: {type: 'gait', instructions: '先播放观察；在右脚开始接地时暂停并标记，再找到它离地的时刻。可以拖动进度复看。', events: [{id: 'initial_contact', label: '开始接地', targetPhase: 0, tolerance: 0.035}, {id: 'toe_off', label: '足离地', targetPhase: 0.56, tolerance: 0.035}], origin: 'authored_animation', compareNormalThresholds: false}, options: [
    O('events_done', '标记完成，解释双侧差异', 'gait_interpret', '已记录事件。比较本例双侧比例，不能把设定值当成实测或统一正常值。', {evidence: ['gait_events'], requiresTask: true})
  ]}),
  gait_interpret: N('gait_interpret', 'act3', 'choice', '解释观察', '本例右支撑期较短、左右步长不同。还能推断什么？', {visualMode: 'gait', options: [
    O('observe_only', '描述双侧差异并询问感受；力量等原因另行检查。', 'arch_intro', '把“看到了什么”和“为什么会这样”分开，才不会让一个画面承担所有诊断。', {evidence: ['gait_observation']}),
    retry('power_from_picture', '看着蹬地小，就证明跖屈肌力弱。', 'gait_interpret', '外观变化可能受任务和策略等影响，不能直接等同肌力结果。'),
    retry('arch_to_sprain', '足弓变低，就证明韧带一直高张力。', 'gait_interpret', '足形、关节运动和韧带负荷不能凭画面连成必然因果链。')
  ]}),
  arch_intro: N('arch_intro', 'act4', 'dialogue', '林治疗师', '先双脚自然站稳，看静态足压；再走过连续压力板，观察负荷转移。', {next: 'arch_concern', visualMode: 'pressure', evidence: ['arch_record']}),
  arch_concern: N('arch_concern', 'act4', 'choice', '陈女士', '是不是脚弓低才总崴？垫高就行吗？', {visualMode: 'pressure', options: [
    O('arch_not_cause', '低足弓不能单独解释崴脚，要结合负荷、控制和感受。', 'pressure_conditions', '避免用足形给患者贴标签；保留多因素解释和后续验证。'),
    retry('arch_cure', '垫高足弓，保证不再崴。', 'arch_concern', '不能从形态直接承诺因果和疗效。')
  ]}),
  pressure_conditions: N('pressure_conditions', 'act4', 'task', '先看懂足底负荷图', '先区分站立与行走，再核对足侧、色标和接触时段。', {visualMode: 'pressure', task: {type: 'pressure', stage: 'conditions', instructions: '先看静态站立，再切换行走；核对足侧、色标与有效接触时段。', checklist: ['同一种任务', '同一足侧和方向', '同一单位与色标', '有效接触时段']}, options: [
    O('conditions_match', '核对同足侧、同任务、同色标，再比较', 'pressure_compare', '匹配条件后才解释负荷差异。', {evidence: ['pressure_conditions'], requiresTask: true}),
    O('request_conditions', '条件不全：先补资料', 'pressure_compare', '正确地拒绝不合条件的比较，也是有效推理。', {evidence: ['pressure_conditions'], record: {comparisonDecision: 'requested_conditions'}}),
    retry('red_always_worse', '更红，就说明损伤更重。', 'pressure_conditions', '不同色标会改变颜色；红色也不是损伤或疼痛的同义词。')
  ]}),
  pressure_compare: N('pressure_compare', 'act4', 'task', '看负荷怎样经过足底', '站立看双足负荷；行走看各脚接触过程。选择区域，观察压力变化。', {visualMode: 'pressure', task: {type: 'pressure', stage: 'regions', instructions: '选择足跟、中足或前足；再切到行走并播放，观察连续板与实时COP。脚离地后不显示该足COP。', regions: ['足跟', '中足', '前足'], provenance: 'synthetic_teaching_data', showMeasuredUnits: false}, options: [
    O('distribution', '记录负荷分布，结合症状与其他发现。', 'cop_explain', '足底是分布接触；中足接触不能单独定义病变。', {evidence: ['pressure_record'], requiresTask: true}),
    retry('three_points', '中足只要接触就异常。', 'pressure_compare', '三点支撑是简化概念，足底多区域都会参与负荷。')
  ]}),
  cop_explain: N('cop_explain', 'act4', 'choice', '陈女士', '压力中心往内走，就能解释我为什么崴吗？', {visualMode: 'pressure', options: [
    O('cop_limit', 'COP表示接触合力作用位置，不是身体重心，也不能单独解释崴脚。', 'balance_intro', '先用“合力落点”建立直观理解，再区分压力中心与重心；不要求人人画出固定S形。', {evidence: ['cop_scope']}),
    retry('cop_cause', '一条COP线就能锁定根因。', 'cop_explain', 'COP不能单独定位韧带、神经或足形病因。')
  ]}),
  balance_intro: N('balance_intro', 'act5', 'dialogue', '陈女士', '单脚站有点怕，必须闭眼站软垫吗？', {visualMode: 'balance', next: 'balance_choice', patientCue: '双脚站稳，扶手在侧，等待说明'}),
  balance_choice: N('balance_choice', 'act5', 'task', '让患者安心地开始', '先安排稳定、可保护、患者愿意尝试的条件。', {visualMode: 'balance', task: {type: 'balance', stage: 'setup', instructions: '逐项确认安全条件；先睁眼、稳定地面和可及扶手，再与患者商量是否增加挑战。', checklist: ['稳定地面', '睁眼', '扶手可及', '治疗师保护侧清楚', '患者同意且知道暂停方式']}, options: [
    O('easy_start', '先睁眼、稳定地面，有扶手；愿意才单脚，随时可落脚。', 'balance_trial', '先回应恐惧，交代起点与退出方式；难度按表现和意愿调整。', {evidence: ['balance_setup'], requiresTask: true}),
    O('decline_balance', '不愿尝试：记录未做，讨论计划。', 'plan_intro', '未做平衡试次不写成平衡正常或异常。', {evidence: ['declined'], record: {balanceCheck: 'not_performed'}}),
    retry('hard_start', '直接闭眼加软垫，越晃越好。', 'balance_choice', '难度和跌倒风险增加，且多个条件同时变化难以解释。', {safe: false})
  ]}),
  balance_trial: N('balance_trial', 'act5', 'dialogue', '陈女士', '睁眼可以……另一只脚落地了，我想停一下。', {visualMode: 'balance', next: 'balance_stop', patientCue: '结束试次，双脚回到地面并保持可扶稳', evidence: ['balance_record']}),
  balance_stop: N('balance_stop', 'act5', 'choice', '立即回应', '患者已落脚并请求停止。请选择处理方式。', {visualMode: 'balance', options: [
    O('stop_stabilize', '好的，停下、双脚放稳、扶好。现在是疼、紧，还是担心？', 'balance_explain', '立即尊重停止，回稳后关心感受；停止是重要信息，不是配合差。', {evidence: ['stopped_safely'], record: {balanceTrial: 'stopped', stopReason: 'opposite_foot_contact_and_patient_request'}}),
    O('increasing_symptoms', '新症状或明显加重：退出体能任务。', 'symptom_stop', '新情况需要重新判断，不沿原任务表硬做。', {record: {stopReason: 'new_symptoms'}}),
    retry('force_repeat', '闭眼重做，直到计时完成。', 'balance_stop', '停止请求有效；不能用完成秒数压过安全与意愿。', {safe: false})
  ]}),
  balance_explain: N('balance_explain', 'act5', 'dialogue', '林治疗师', '先停稳。平衡需要感觉、肌肉和动作策略配合；一次落脚不能定位某条感觉通路损伤。', {next: 'plan_intro', visualMode: 'balance'}),
  plan_intro: N('plan_intro', 'act6', 'dialogue', '林治疗师', '谢谢你的配合。先围绕安心走不平路，一起选愿意开始的下一步，再按同方法复评。', {visualMode: 'consult', next: 'plan', patientCue: '确认患者回座舒适，治疗师与其平视，指向已取得的资料并留出提问时间'}),
  plan: N('plan', 'act6', 'task', '把方案连到证据', '选择一个有证据支持的优先方向。', {visualMode: 'plan', task: {type: 'plan', instructions: '从自己的证据板选择依据。未做检查不能当依据；辅助支持按症状和使用反应讨论。', allowMultiple: true, minimumSelections: 1, evidenceLinksRequired: true, acceptsReasonableAlternatives: true, optionsAreComponents: true}, options: [
    O('graded_control', '围绕不稳，逐步练习力量与稳定控制。', 'plan_patient', '与反复不稳和活动目标对应；进阶看表现和感受，不只按天数。', {evidence: ['plan_shared'], planDomain: 'control', supports: ['triggers', 'goal']}),
    O('mobility_recheck', '有活动差异证据：安排相应处理并同法复评。', 'plan_patient', '需要能指向已获取的活动记录；未完成检查时先补评估。', {evidence: ['plan_shared'], planDomain: 'mobility', supports: ['local_record'], requiresEvidence: ['local_record']}),
    O('load_support_trial', '讨论负荷调整或辅助支持，观察试用反应。', 'plan_patient', '鞋垫或护踝不是人人必选，也不能承诺矫正足形就根治。', {evidence: ['plan_shared'], planDomain: 'load', supports: ['arch_record', 'pressure_record']}),
    O('complete_missing', '证据不足：先补评估与复评。', 'plan_patient', '补齐证据是合理路径，不必为了通关把所有治疗工具都选上。', {evidence: ['plan_shared'], planDomain: 'assessment'}),
    retry('guaranteed_orthosis', '只配足弓垫，保证永不再崴。', 'plan', '没有证据支持这样的因果和保证；计划需要对应功能与症状。'),
    retry('return_today', '做完动画就立即回球场。', 'plan', '播放和完成练习不等于恢复；恢复运动需要后续任务评估。')
  ]}),
  plan_patient: N('plan_patient', 'act6', 'dialogue', '陈女士', '明白了，先解决走路的问题，不只看脚弓。我愿意从简单的开始。不舒服时怎么办？', {visualMode: 'consult', next: 'teachback'}),
  teachback: N('teachback', 'act6', 'choice', '一起确认下一步', '约定暂停与复评，再请患者复述。', {visualMode: 'consult', options: [
    O('shared_stop', '不适或不稳先停并扶稳；新伤或明显加重及时就医。你能复述吗？', 'debrief', '邀请复述是在检查解释是否清楚，不是在考患者；后续依据实际表现和感受调整。', {evidence: ['teachback']}),
    retry('push_through', '必须忍着做完，不能改计划。', 'teachback', '计划应随症状和任务反应调整，不能要求硬撑。', {safe: false})
  ]}),
  debrief: N('debrief', 'debrief', 'summary', '回看这次接诊', '回看一项有依据的发现，以及一项还不能确定的解释。', {visualMode: 'evidence', next: 'uncertainty', task: {type: 'evidence', instructions: '把来源分开：患者报告、虚构病例记录、教学示意、自己的解释；未做检查单列。', useCollectedEvidenceOnly: true}}),
  uncertainty: N('uncertainty', 'debrief', 'task', '保留不确定性', '哪一句仍然尚未证明？', {visualMode: 'evidence', task: {type: 'evidence', stage: 'classify'}, options: [
    O('unproven_cause', '低足弓是本例反复崴脚的唯一根因。', 'transfer', '它是尚未证明的因果解释，不能提升为已确认发现。', {evidence: ['uncertainty']}),
    retry('patient_report_unproven', '患者报告不平路面时担心、不稳。', 'uncertainty', '这是已获得的患者报告；报告的存在和某个病因是否成立是两件事。')
  ]}),
  transfer: N('transfer', 'debrief', 'choice', '换一位患者再想', '下一位患者是高足弓，还能照搬本例结论吗？', {visualMode: 'evidence', options: [
    O('reassess', '沿用评估框架，重新检查，重新解释。', 'finish', '迁移的是推理方法，而不是固定病因或一套相同处方。'),
    retry('invert_cause', '把内侧换外侧，结论全部反过来。', 'transfer', '足形不同不代表所有机制和处理都能机械反转。')
  ]}),
  finish: N('finish', 'debrief', 'summary', '本次学习记录', '本轮完成。请保留实际证据、未做项目与复评计划，区分观察和病因解释。', {visualMode: 'evidence', terminal: true, task: {type: 'evidence', useCollectedEvidenceOnly: true}, record: {completion: 'teaching_route', clinicalValidation: false}}),
  medical_stop: N('medical_stop', 'act1', 'choice', '新情况需要改变流程', '替代情境：新近扭伤、明显不能负重。此时结束体能任务。', {visualMode: 'consult', options: [
    O('medical_evaluation', '安全休息，进一步医学评估；未做如实记录。', 'safe_finish', '改变流程是恰当决定，不因为尚未完成所有任务而扣除安全评价。', {evidence: ['referral', 'stopped_safely'], record: {completion: 'medical_evaluation_route', physicalTasks: 'not_performed'}}),
    retry('test_anyway', '先单脚站，看看是否真的不能负重。', 'medical_stop', '不应用额外挑战来检验这个警示线索。', {safe: false})
  ]}),
  symptom_stop: N('symptom_stop', 'debrief', 'dialogue', '林治疗师', '好的，先停。请先扶好、站稳，我再问清新症状，安排进一步评估。未做项目如实记录。', {visualMode: 'consult', next: 'safe_finish', evidence: ['stopped_safely'], record: {completion: 'symptom_stop_route', remainingPhysicalTasks: 'not_performed'}}),
  decline_stop: N('decline_stop', 'act1', 'dialogue', '陈女士', '谢谢，我想先聊清楚，检查下次再决定。', {visualMode: 'consult', next: 'safe_finish', evidence: ['declined'], record: {completion: 'patient_declined_route', physicalTasks: 'not_performed'}}),
  safe_finish: N('safe_finish', 'debrief', 'summary', '这也是有效的接诊结局', '本轮体能任务已结束。记录停止或拒绝原因与下一步；未做不写成正常。', {visualMode: 'evidence', terminal: true, safeExit: true, task: {type: 'evidence', useCollectedEvidenceOnly: true, showUnperformed: true}, record: {clinicalValidation: false}})
};

// Source summaries are paraphrased. Original teaching dialogue and fictional case
// details are not reproduced guideline text, validated assessment, or patient advice.
export const CONTENT_SOURCES = [
  {id: 'jospt_las_cai_2021', title: 'JOSPT：踝关节外侧韧带扭伤与慢性踝关节不稳临床实践指南（2021）', url: 'https://www.jospt.org/doi/10.2519/jospt.2021.0302', publisher: 'Journal of Orthopaedic & Sports Physical Therapy', doi: '10.2519/jospt.2021.0302', checked: '2026-10-18', supports: '结合既往处理、扭伤次数、功能和动态任务综合评估；依据检查发现选择干预，并复评。未据此证明本虚构病例的具体病因。'},
  {id: 'nice_shared_decision_ng197', title: 'NICE NG197：共同决策建议', url: 'https://www.nice.org.uk/guidance/ng197/chapter/recommendations', publisher: 'NICE', checked: '2026-10-18', supports: '围绕患者在意的目标讨论检查与选择，分段解释并邀请复述；患者可以选择不接受某项处理。'},
  {id: 'original_teaching_design', title: '本课程原创教学设计与虚构病例', url: null, publisher: '本地课程制作', checked: '2026-10-18', supports: '病例、事件时标、交互任务、合成足压与对白为教学编排，不是临床采集数据。'}
];

// v14 keeps node IDs for saved progress; acts and edges change without granting unseen evidence.
for(const node of Object.values(FLOW)) {
  if(node.act==='act3')node.act='act5';
  else if(node.act==='act4')node.act=['arch_intro','arch_concern'].includes(node.id)?'act4':'act6';
  else if(node.act==='act5')node.act='act7';
  else if(node.act==='act6')node.act='act8';
}
FLOW.local_explain.options.find(o=>o.id==='limited_inference').next='muscle_intro';
FLOW.tool.options.find(o=>o.id==='skip_contact').next='muscle_intro';
FLOW.tool.options.find(o=>o.id==='skip_contact').label='不愿接触检查：记未做，先学习肌群。';
FLOW.gait_interpret.options.find(o=>o.id==='observe_only').next='pressure_intro';
FLOW.arch_intro.text='先坐着，再自然站稳，比较足弓外观。这样能了解负重时的变化。';
FLOW.arch_intro.visualMode='exam';FLOW.arch_intro.next='arch_compare';delete FLOW.arch_intro.evidence;
FLOW.arch_concern.visualMode='exam';
FLOW.arch_concern.options.find(o=>o.id==='arch_not_cause').next='gait_intro';
FLOW.plan_intro.text='谢谢你的配合。我们把活动、控制和负荷的资料放在一起，围绕安心走路商量下一步。';
FLOW.plan_intro.next='synthesis';
FLOW.balance_explain.text='先停稳。闭眼会减少视觉信息；平衡还需要体感、前庭和肌肉配合，不能仅凭晃动判断哪处受损。';
Object.assign(FLOW,{
 synthesis:N('synthesis','act8','choice','怎样把资料连起来？','从发现走向方案，哪一种解释更有依据？',{visualMode:'consult',options:[
  O('evidence_problem_plan','病史与各项发现 → 活动中的问题 → 可选措施 → 同法复评。','plan','连的是证据与决策，不把同时出现的发现自动串成已证实病因。',{evidence:['synthesis']}),
  retry('single_cause_chain','天生低足弓 → 骨头歪 → 感应器坏，矫正后一定痊愈。','synthesis','未取得先天足形、组织损伤或完整因果证据，不能这样下结论或保证疗效。')
 ]}),
 muscle_intro:N('muscle_intro','act3','dialogue','林治疗师','接下来认识控制脚踝的肌群，再了解怎样检查。力量、耐力和反应时序，要用不同方法判断。',{next:'muscle_match',visualMode:'exam'}),
 muscle_match:N('muscle_match','act3','task','哪些肌肉参与这些动作？','将四种动作与主要肌群配对。需要时打开解剖窗。',{visualMode:'exam',task:{type:'muscle',stage:'match',instructions:'依次选择主要肌群。这里学习动作关系，不生成陈女士的肌力等级。'},options:[
  O('muscle_match_done','配对完成，讨论检查方法','muscle_method','理解主要肌群不等于其他肌肉不参与；随后还需统一体位和阻力。',{requiresTask:true,evidence:['muscle_knowledge']}),
  O('muscle_defer','暂不完成：记录待补，继续足弓比较','arch_intro','肌群学习本轮未完成，不能补记患者肌力。',{record:{muscleLearning:'not_performed'}})
 ]}),
 muscle_method:N('muscle_method','act3','choice','怎样检查才有意义？','测试不同肌群，都保持俯卧、用同一种阻力就行吗？',{visualMode:'exam',options:[
  O('standardize_muscle','按动作调整体位、固定与施阻，记录疼痛、代偿和分级依据。','muscle_explain','不同测试需要相应体位和方法；跖屈高等级评定常涉及负重提踵，不能四项都照搬俯卧施阻。',{evidence:['muscle_method']}),
  retry('one_prone','全部俯卧，动画用力越大就代表等级越高。','muscle_method','角色动作幅度不等于肌力等级；体位、固定、施阻和标准应分别核对。')
 ]}),
 muscle_explain:N('muscle_explain','act3','choice','陈女士','如果往外用力发软，就能断定是哪块肌肉坏了吗？',{visualMode:'exam',options:[
  O('muscle_scope','这是需要检查的线索；先记录感受，不能直接定位损伤或反应延迟。','arch_intro','徒手肌力为分级评定；不能代替定量力矩或肌电时序测量。',{evidence:['muscle_scope']}),
  retry('infer_emg','能直接算出外翻力矩，并证明肌肉激活延迟。','muscle_explain','没有测力或肌电资料，不能从配对、外观或发软感算出这些结果。')
 ]}),
 arch_compare:N('arch_compare','act4','task','足弓怎样随负重变化？','切换坐位和自然站立，观察病例中的足弓外观。',{visualMode:'exam',task:{type:'arch',stage:'compare',instructions:'依次观察非负重和负重病例示意；外观差异只是一项记录，结合功能继续评估。'},options:[
  O('arch_observed','记录负重前后外观差异，结合症状继续判断','arch_concern','本虚构病例负重时足弓较低；还需相应检查确认柔韧性及其与症状的关系。',{requiresTask:true,evidence:['arch_record']}),
  retry('arch_root','负重足弓低，证明这是所有不稳的根源。','arch_compare','足形与症状同时存在不等于因果；也不能仅凭外观确定骨移位或韧带张力。')
 ]}),
 pressure_intro:N('pressure_intro','act6','dialogue','林治疗师','刚才看了怎么走，现在看负荷怎样经过足底。先看站立，再看行走；读图要核对条件。',{next:'pressure_conditions',visualMode:'pressure'})
});
Object.assign(EVIDENCE_CATALOG,{
 synthesis:{label:'证据—问题—计划—复评的综合解释',status:'reasoning',text:'结合本轮实际资料提出可选方向，保留未知机制，不把相关特征写成唯一致病链。'},
 muscle_knowledge:{label:'踝足动作与主要肌群配对',status:'authored_demonstration',text:'完成四项主要肌群知识配对，不代表已测得患者肌力等级。'},
 muscle_method:{label:'选择相应肌力检查条件',status:'reasoning',text:'体位、固定、施阻、症状和分级依据应与所测动作匹配；当前未实施规范施阻或读出患者肌力。'},
 muscle_scope:{label:'区分肌力分级与力矩/激活时序',status:'reasoning',text:'发软感或徒手分级不能直接给出定量力矩，也不能证明肌电激活延迟。'}
});
TEACHER_LIMITATIONS.push({id:'muscle',status:'pending_review',title:'肌力幕与临床动作',text:'v14新增主要肌群配对和检查方法推理。规范施阻、固定、跖屈提踵计数及真实肌力分级未重建；没有患者等级、定量力矩或EMG时序。不可把角色坐姿当作全部肌群MMT体位。'},{id:'script_v14',status:'revised_not_signed',title:'八幕脚本科学性修订',text:'保留用户八幕结构，删除低足弓单一根因、万能角度阈值、统一S形、感受器损坏和彻底治愈等无依据结论。参考来源支持一般概念，不验证虚构病例或三维动作；需专业教师逐项签审。'});
CONTENT_SOURCES.push(...CLINICAL_SOURCE_LINKS);

const ACT_EDUCATION = {
  act1: {
    why: '先理解她为什么来，再一起决定查什么。',
    concept: '功能目标：人体运动学要解释一个人在具体活动中遇到的困难。',
    patientMeaning: '她需要先安心走路；“脚看起来怎样”不能代替这个目标。',
    steps: ['先听完整经历和担心', '核对近期变化与当前能力', '说明目的，邀请选择'],
    care: '平视交流、留出回答时间；担心值得被认真听见。',
    sourceIds: ['nice_shared_decision_ng197', 'jospt_las_cai_2021']
  },
  act2: {
    why: '了解脚踝在活动、承重时怎样移动，为后续比较留下一致的起点。',
    concept: '背屈是足背向小腿靠近；负重时也可表现为小腿在足上方向前移动。',
    patientMeaning: '这能帮助描述“哪里紧、怎样动”，不会仅凭一次发紧就诊断骨头错位。',
    steps: ['先说明动作并确认舒适体位', '统一标志和任务方法', '同时记录活动表现与感受'],
    care: '新增接触先解释并询问意愿；只在可耐受范围内，不追求最大幅度。',
    sourceIds: ['jospt_las_cai_2021', 'original_teaching_design']
  },
  act3: {
    why: '把“走着不放心”拆成能观察、能复看的具体事件。',
    concept: '支撑阶段从同一只脚开始接地到它离地；离地后进入摆动阶段。',
    patientMeaning: '在连续压力板上观察赤足行走，再结合感受判断还需检查什么。',
    steps: ['保持赤足自然行走，不凑步踩板', '在同一只脚上找接地和离地', '描述所见，再讨论可能解释'],
    care: '先确认愿意行走；起步、转身时留出空间，不催促或要求忍痛。',
    sourceIds: ['original_teaching_design']
  },
  act4: {
    why: '把足弓外观与足底承重过程放在一起理解。',
    concept: '足弓形态、区域接触和压力中心是不同信息，不能相互替代。',
    patientMeaning: '帮助解释久站和走路中的负荷问题，避免把“脚平”直接等同于病因。',
    steps: ['先核对任务、足侧和色标', '比较同一条件下的区域与时刻', '结合症状、活动和其他发现'],
    care: '不把足形说成“坏了”；先回应患者对原因和辅助支持的疑问。',
    sourceIds: ['original_teaching_design']
  },
  act5: {
    why: '在可保护的任务里，了解维持稳定时的表现与感受。',
    concept: '姿势控制需要感觉信息、力量和动作策略共同参与。',
    patientMeaning: '重点是找到能安心开始的难度，不是用摇晃或秒数给她贴标签。',
    steps: ['先确认支撑、保护位置和意愿', '从愿意尝试的简单条件开始', '触发停止条件后回稳并询问感受'],
    care: '停止请求立即有效；不把害怕、扶手或落脚说成不配合。',
    sourceIds: ['jospt_las_cai_2021', 'nice_shared_decision_ng197']
  },
  act6: {
    why: '把今天取得的信息转成她听得懂、愿意开始的下一步。',
    concept: '评估—计划—复评：用同一方法和目标表现观察变化。',
    patientMeaning: '先选适合当前能力的一步，再依据感受和表现调整，而不是一次完成所有治疗。',
    steps: ['回到她优先的生活目标', '把计划与已有证据相连', '共同确认暂停方式和复评'],
    care: '邀请意见，询问实际困难；复述是在检查我们是否讲清楚。',
    sourceIds: ['jospt_las_cai_2021', 'nice_shared_decision_ng197']
  },
  debrief: {
    why: '看清本次真正知道了什么，还缺少什么。',
    concept: '患者报告、观察记录和病因解释属于不同层次的证据。',
    patientMeaning: '如实记录未做和未知，才能避免不必要的标签与不合适的承诺。',
    steps: ['只保留实际取得的资料', '把发现与解释分开', '写清未做、停止原因和下一步'],
    care: '尊重选择和停止也是有效的接诊结果。',
    sourceIds: ['original_teaching_design', 'nice_shared_decision_ng197']
  }
};

const NODE_EDUCATION = {
  history: {why: '先弄清“什么时候撑不住”，检查才有要回答的问题。', concept: '活动与参与：同一只脚在平地、变向和不平路面的要求不同。', patientMeaning: '让她的真实困难决定观察重点。', steps: ['开放提问', '听取受伤和再次扭伤经过', '追问最困扰的活动'], care: '先听完再回应，避免从外观猜病因。'},
  safety: {why: '现在的症状和近期变化，会改变今天适合做的事情。', concept: '安全询问在体能任务之前；新的情况出现时需要重新判断。', patientMeaning: '先保护她，再决定是否需要进一步评估。', steps: ['回应担心', '询问新伤及症状变化', '依回答决定继续或停止'], care: '不要因为能走进诊室就省略询问。'},
  goal: {why: '先问最想恢复什么，避免替患者决定成功标准。', concept: '功能目标要具体到活动，后续才有可讨论的变化。', patientMeaning: '“安心走不平路面”比单纯改变脚形更贴近她的需求。', steps: ['了解既往处理', '邀请说出优先活动', '用自己的话复述并确认'], care: '给例子帮助表达，但不代替患者选择。'},
  consent: {why: '知道目的、过程和选择，患者才能决定是否参与。', concept: '解释与同意是持续交流，每次增加任务仍需确认。', patientMeaning: '她可以问、可以调整，也可以选择不做。', steps: ['把检查连到生活目标', '说明怎样开始和怎样暂停', '等待提问与选择'], care: '不用“必须完成”或绝对安全保证换取同意。'},
  consent_reply: {why: '先回应“会不会又崴”的恐惧，再商量可控的起点。', concept: '担心与回避是需要了解的信息，不能被“放心就行”替代。', patientMeaning: '知道有人认真倾听，也知道停止会被尊重。', steps: ['确认听到担心', '说明支撑和小幅开始', '保留暂停或拒绝'], care: '不保证绝对不疼，不以通关要求压过意愿。'},
  tool: {why: '选合适教具，是为了让观察有明确方法。', concept: '量角器比较两条参考方向的夹角；软尺记录长度，二者不能直接互换。', patientMeaning: '测量有方法，重复时才更容易比较。', steps: ['选择角度教具', '认识轴心与两臂', '进入标志对线'], care: '先说明工具用途；不把刻度细就说成一定准确。'},
  alignment: {why: '相同体位、相同标志，是前后记录能比较的基础。', concept: '本项侧面参考线：外踝为轴心标志，小腿与第五跖骨外侧提供两臂方向。', patientMeaning: '这是认识测量方法，不是让患者尽力踝关节背屈到最大。', steps: ['找外踝标志', '沿腓骨外侧放固定臂', '沿第五跖骨外侧放移动臂'], care: '接触前询问；遮盖与体位照顾患者舒适。'},
  trial: {why: '抬脚跟、转脚或换方法，都可能让数字看似更好却失去可比性。', concept: '负重背屈观察的是任务中的相对运动；代偿会改变任务条件。', patientMeaning: '比较自己的实际表现，比追求更远距离有意义。', steps: ['核对脚跟落地', '核对足与膝方向', '左右同法并记录症状'], care: '先扶稳；疼痛增加或要求停止就停止这个动作。'},
  local_explain: {why: '纠正“发紧等于错位”的担心，同时承认目前确实有活动表现差异。', concept: '功能表现与组织病因是两层问题，一项观察不能完成所有定位。', patientMeaning: '不轻率贴标签，也不否认她的真实感受。', steps: ['先回应担心', '描述已取得的活动记录', '说明仍需结合其他检查'], care: '避免“推回去就根治”等无法支持的承诺。'},
  gait_instruction: {why: '自然任务更能回答她平时怎样走，而不是怎样踩准标记。', concept: '起步、直线行走和转身有不同任务要求，应分开观察。', patientMeaning: '不需要为了配合设备改变每一步。', steps: ['确认愿意尝试', '用日常方式走直线', '不适即停，转身另看'], care: '用短句说明，给患者熟悉空间的时间。'},
  gait_events: {why: '先定位接地和离地，后面的承重与摆动解释才有共同依据。', concept: '初始接触→离地为该侧支撑期，离地→再次接触为摆动期；同时观察对侧、步长、步宽与步速。', patientMeaning: '把“一步”拆开看，才能清楚讨论哪里需要继续观察。', steps: ['对照左右支撑与摆动', '拖动看足印和躯干参考', '标记右足初始接触与离地'], care: '可反复看，不催促；这一步不评判患者走得好坏。'},
  gait_interpret: {why: '把看见的事件与想解释的原因分开，避免过早下结论。', concept: '运动学描述怎样运动；画面本身不能直接给出肌力、力矩或韧带状态。', patientMeaning: '不因为一步看着不同，就被告知某块肌肉或韧带一定坏了。', steps: ['描述可见事件', '联系患者当时感受', '列出需另行验证的问题'], care: '描述具体表现，少用带评价的“异常姿势”标签。'},
  arch_concern: {why: '回答“是不是脚平造成的”，同时避免用一个外观解释一切。', concept: '足弓形态、负荷分布和控制表现相互有关，但观察到同时存在不等于已证明因果。', patientMeaning: '辅助支持是否适合，需要结合症状、任务和使用反应讨论。', steps: ['承认想找到原因的愿望', '区分形态与症状', '邀请结合其他资料判断'], care: '不用“塌了、坏了”等语言制造恐惧。'},
  pressure_conditions: {why: '先看资料条件，才不会把站立和走路的颜色差别误当作病情变化。', concept: '任务、足侧、方向、色标和接触时段共同决定怎样读图。', patientMeaning: '同一种颜色在不同图中可能含义不同。', steps: ['切换站立与行走看标签', '确认同一足侧与方向', '核对色标和有效接触'], care: '先解释颜色在表达什么，不用“越红越坏”吓人。'},
  pressure_compare: {why: '用区域和时刻观察负荷转移，而不是只找一块红色。', concept: '足底是分布接触；足跟、中足和前足都可能参与不同阶段的承重。', patientMeaning: '读图需要结合她的活动和感受，颜色不是疼痛或损伤位置。', steps: ['选一个区域', '播放有效接触过程', '暂停比较不同时刻'], care: '让患者也看得懂关注哪里、为什么看。'},
  cop_explain: {why: '把图上的线解释成有边界的信息。', concept: 'COP是接触合力作用位置；轨迹表达其随时间的变化。它与身体重心不同。', patientMeaning: '这条线提供负荷转移线索，不能单独解释反复崴脚。', steps: ['先解释“合力落点”', '只看有效接触时段', '结合任务和其他发现'], care: '不用固定S形或一条线给患者下病因结论。'},
  balance_choice: {why: '先找到能安心尝试的条件，再观察怎样保持稳定。', concept: '改变视觉、支撑面或单/双脚，会改变任务要求；一次只改变一个条件更便于解释。', patientMeaning: '可以扶、可以落脚、可以不做，起点不必最难。', steps: ['确认睁眼和稳定地面', '确认扶手与保护位置', '说明暂停方式并等待同意'], care: '不把害怕视作意志问题；先问愿不愿意。'},
  balance_stop: {why: '停止本身就是需要尊重和记录的结果。', concept: '落脚改变了试次条件；继续计时不能补成一个有效连续试次。', patientMeaning: '及时说不适会得到帮助，不会受到责备。', steps: ['立即结束本次试次', '双脚回稳并使用支撑', '询问感受，记录终止原因'], care: '谢谢患者及时表达，不催促重做或升级难度。'},
  plan: {why: '每个计划方向都要回答一个已有问题，而不是把所有工具都选上。', concept: '依据活动、控制和负荷等已有资料选择下一步，再用同法复评。', patientMeaning: '先选愿意开始的一步，并讨论现实时间、困难与偏好。', steps: ['回看实际取得的证据', '选择一个合理优先方向', '说明依据与还需补充的评估'], care: '共同商量；未做的检查不能当作已知依据。'},
  teachback: {why: '用患者自己的话确认，看看解释是否足够清楚。', concept: '复述帮助核对理解；计划应含暂停、联系评估和复评安排。', patientMeaning: '离开诊室后知道遇到不适该怎么做，而不是只记住一串术语。', steps: ['用短句约定暂停方式', '邀请用自己的话复述', '补充不清楚处并确认问题'], care: '说“为了确认我讲清楚了”，不说“考考你记住没有”。'},
  debrief: {why: '把自己的推理过程讲清楚，才能迁移到下一位患者。', concept: '报告、病例记录、教学示意和解释需要分开标记。', patientMeaning: '透明说明已知与未知，避免不必要承诺。', steps: ['指出一项有依据的发现', '指出一项尚未证明的解释', '列出未做项目和下一步'], care: '不把拒绝和停止从记录里抹去。'},
  uncertainty: {why: '没有证明的因果关系，应保留为问题，不能写成结论。', concept: '有一个特征，不等于它是全部症状的唯一原因。', patientMeaning: '不会仅因低足弓被固定到一套治疗里。', steps: ['核对证据来源', '区分观察与因果', '保留需要验证的问题'], care: '诚实解释不确定，不用夸大确定性安慰人。'},
  medical_stop: {why: '新的受伤情况会改变原计划，体能任务不应机械继续。', concept: '安全决策先于完成检查清单；停止后仍要记录与安排下一步。', patientMeaning: '先在安全位置休息并接受进一步医学评估。', steps: ['结束体能任务', '安排安全休息', '记录未做项目与进一步评估'], care: '说明为什么改变流程，不责备患者没能完成。'},
  symptom_stop: {why: '新症状出现时先停下，重新了解情况。', concept: '评估是动态过程，不是不能修改的任务清单。', patientMeaning: '表达不适会改变计划，安全与意愿会被认真对待。', steps: ['停止并回稳', '询问新的感受', '安排进一步判断并记录'], care: '明确感谢及时表达；不以完成进度要求继续。'},
  decline_stop: {why: '今天选择不检查，也可以完成认真、有帮助的交流。', concept: '未实施不等于正常或阴性，信息要如实留在记录中。', patientMeaning: '保留以后再决定的机会，今天也能谈清担心与下一步。', steps: ['尊重决定', '确认还有哪些问题', '记录未做并讨论后续选择'], care: '不惩罚拒绝，不把未做视为不配合。'}
};

for (const node of Object.values(FLOW)) {
  node.education = {...ACT_EDUCATION[node.act], ...(EIGHT_ACT_EDUCATION[node.act] || {}), ...(NODE_EDUCATION[node.id] || {})};
  node.purpose = node.education.why;
  if (node.task) node.task.education = node.education;
}

export const CONTENT_CONTRACT = {
  version: 'v14-eight-act-evidence-aware-1', startNode: START_NODE,
  fields: 'FLOW[nodeId] nodes; next and options.next are node IDs. No network or generation is performed.',
  onEnter: 'Append node.evidence only on entering that node; merge node.record into the session. Never collect evidence from unseen nodes.',
  onChoose: 'Append the chosen option.evidence and record, then use option.next. Bad retry options do not create supporting clinical evidence.',
  tasks: 'requiresTask must be gated by renderer task completion. Task success verifies a teaching operation only, never a real clinical measurement.',
  plan: 'Allow a reasonable subset; keep selected planDomain and supporting evidence IDs. Enforce requiresEvidence or offer complete_missing. Never require every component.',
  resume: 'Persist current node, seen nodes, evidence IDs, chosen options, task receipts and exit reason. A safe exit must not auto-resume physical tasks.',
  pressure: 'Synthetic source badge remains visible. No measured pressure units, force, angle, COP diagnosis or clinical thresholds.',
  finalBoard: 'Render only collected evidence with its status. Unseen tests are not_performed; show referral/decline/stop reasons. No diagnosis or clinical clearance.',
  education: 'Every node has purpose and education {why,concept,patientMeaning,steps,care,sourceIds}; task.education is the same object. Show manageable explanations before action. Sources support broad teaching principles, not patient-specific causal conclusions.',
  communication: 'Acknowledge concerns, explain purpose in daily language, invite questions and choice, stop when requested, and check understanding through teach-back. Never treat completing a teaching interaction as a clinical result.'
};

// Short choice labels; selecting one speaks its complete response one utterance at a time.
const choiceLabels={
explain_consent:'我先说明检查目的，你随时可以停。愿意试试吗？',
reassure_without_guarantee:'先做小幅动作，我会询问感受；你说停就停。',
limited_inference:'我理解你担心。发紧不等于错位，还要综合判断。',
natural_walk:'保持赤足，按平常方式走，不必踩线。不舒服就停。',
observe_only:'先描述双侧差异，再结合感受与相应检查。',
arch_not_cause:'足弓低不能单独解释崴脚，我们一起看其他因素。',
cop_limit:'这条线帮助看负荷转移，不能单凭它判断病因。',
easy_start:'先睁眼、稳定地面、扶手在旁；愿意再试单脚。',
stop_stabilize:'好的，我们停。双脚放稳，扶好；现在感觉怎样？',
shared_stop:'不适先停，回到安全支撑。你能复述怎么做吗？',
graded_control:'结合不稳与活动目标，讨论分级力量和控制练习。',
mobility_recheck:'根据已有活动差异，讨论处理与同方法复评。',
load_support_trial:'结合久站不适，讨论负荷调整或辅助支持试用。',
complete_missing:'先补足缺失评估，再讨论具体措施。',
medical_evaluation:'先安全休息，安排进一步医学评估。'
};
for(const node of Object.values(FLOW))for(const option of node.options||[])if(choiceLabels[option.id])option.shortLabel=choiceLabels[option.id];

// v20 applied at import for all consumers, including tests and audio inventory.
import {applySOAPRoute} from "./soap-route-v20.js";
applySOAPRoute(FLOW,CASE_DATA,EVIDENCE_CATALOG);

import {normalizeFlow} from './communication-v26.js';
normalizeFlow(FLOW);
import {applyNaturalFlow} from './natural-language-v26.js';
applyNaturalFlow(FLOW);
