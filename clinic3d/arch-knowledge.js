// Original short teaching text. Pure data: no DOM, network, scoring or case mutation.
// Clinical sources and access limits: docs/arch-v13-sources.json.
export const ARCH_SOURCE_LINKS = [
  {id:'cavus_2014',title:'高足弓与足压原始研究',url:'https://doi.org/10.1016/j.gaitpost.2013.10.018'},
  {id:'standing_2013',title:'站立足弓与足压研究',url:'https://pubmed.ncbi.nlm.nih.gov/23795697/'},
  {id:'speed_2004',title:'步速对足压的影响',url:'https://pubmed.ncbi.nlm.nih.gov/15680109/'},
  {id:'load_2010',title:'附加载荷对足压的影响',url:'https://pubmed.ncbi.nlm.nih.gov/22396809/'},
  {id:'acfas_cavus',title:'ACFAS高足弓说明',url:'https://www.foothealthfacts.org/conditions/cavus-foot-(high-arched-foot)'},
  {id:'rnoh_cavus',title:'RNOH足踝专科说明',url:'https://www.rnoh.nhs.uk/patients-and-visitors/patient-information-guides/post-operative-advice-following-pes-cavus-correction'},
  {id:'foot_type_2013',title:'足型与无症状步态研究',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC3594140/'}
];

export const ARCH_PROFILES = {
  typical:{id:'typical',label:'正常足弓参考',shortLabel:'正常参考',role:'reference',
    summary:'同条件观察中足接触与前后足负荷，作为常见形态的参考。',
    observation:'作为同条件参照，观察中足接触与前后足负荷。',
    meaning:'常见形态的教学参考，不是判定健康的合格模板。'},
  low:{id:'low',label:'低足弓病例',shortLabel:'低足弓',role:'patient_case',patient:'陈女士',
    summary:'本例中足接触较多，但不能由此单独解释反复崴脚。',
    observation:'本例中足接触较多。先描述分布，再结合症状。',
    meaning:'陈女士主线仍为反复右踝扭伤与不稳；低足弓不是已证实的唯一病因。'},
  high:{id:'high',label:'高足弓知识拓展',shortLabel:'高足弓',role:'independent_extension',patient:null,
    summary:'中足接触可能较少，部分区域可能集中承重；需要结合症状和功能判断。',
    points:['接触少不等于不用承重。','不预设人人都有外侧COP。','单凭足印不能确诊或选择统一处方。','疼痛、反复扭伤、明显不对称或新变化时，应进一步评估。'],
    observation:'本教学条件中足接触较少，部分区域可能集中承重。',
    meaning:'这是独立拓展，不改变陈女士病例。高足弓不等于人人同一种COP路线。'}
};

export const ARCH_COACH_HINTS = {
  enter:'先与正常足弓参考同帧比较，再切到高足弓拓展。',
  compare:'保持同任务、同载荷、同步速、同相位与同色标，再看中足和前后足。',
  observe:'先说接触面积和负荷分布变了什么，暂不根据颜色下诊断。',
  question:'选一句最合理的解释。反馈帮助复盘，不计算临床分数。',
  finish:'把方法带回病例：还需了解哪些症状、变化和功能表现？'
};

export const ARCH_PATIENT_EXPLANATIONS = {
  comparison:'我们按相同条件看负荷怎样分布，不是拿您的脚去对一个合格模板。',
  highArch:'脚弓高时，中足可能接触少一些，但体重仍要经过足部传到地面。有些地方会更集中承重。',
  cop:'COP是当下接触载荷的合力落点。足弓高，并不能直接决定它一定走哪一条线。',
  assessment:'若反复扭伤、持续疼痛，或左右差异明显、足形出现新变化，需要进一步查清原因，再商量处理。',
  plan:'鞋具、辅助支持或训练要结合检查和您的感受选择，没有人人通用的一套。'
};

export const ARCH_QUESTIONS = [
  {id:'matched_conditions',title:'先把什么保持一致？',
    prompt:'为什么比较足弓时，要匹配任务、体重／总载荷设定、步速、相位和色标？',
    concept:'控制比较条件',sourceIds:['speed_2004','load_2010','standing_2013'],
    options:[
      {id:'isolate_comparison',label:'减少其他条件影响，才看得清差异。',correct:true,
        feedback:'对。速度、载荷和接触时刻都会改变分布，色标也会改变视觉颜色。固定条件有助比较，仍不能断定差异全部由足弓造成。'},
      {id:'make_diagnosis',label:'条件一致，就能直接确诊扁平足或高足弓。',correct:false,
        feedback:'条件一致只是比较的前提。诊断还要结合病史、站立足形、柔韧性、肌力和步态等检查。'},
      {id:'match_colours',label:'把每张图都调到一样红，才公平。',correct:false,
        feedback:'各图分别拉满颜色会掩盖幅度差异。要用同一色标，并区分瞬时帧和峰值合成图。'}]},
  {id:'high_arch_loading',title:'接触少，负荷去哪了？',
    prompt:'高足弓示意的中足接触较少，最合理的理解是什么？',
    concept:'接触面积与局部负荷',sourceIds:['cavus_2014','acfas_cavus'],
    options:[
      {id:'no_load',label:'中足不接触，脚就不用承受体重。',correct:false,
        feedback:'接触少不等于不承重。接触区仍需传递载荷；面积、载荷及其分配共同影响局部压力。'},
      {id:'possible_concentration',label:'仍需承重，部分接触区可能负荷集中。',correct:true,
        feedback:'对。研究观察到高足弓接触面积与区域压力的差异；具体部位因人、任务而异，不能一律说COP偏外侧。'},
      {id:'fixed_lateral',label:'所有高足弓的COP必然始终在外侧。',correct:false,
        feedback:'足弓高度不能单独决定整条COP路线。还要看当前接触、姿势、任务与个体表现，不能把一种示意当成所有人的规律。'}]},
  {id:'individual_assessment',title:'下一步怎样帮助这个人？',
    prompt:'高足弓者反复扭伤或疼痛，且左右差异明显，或足形近来有变化，应怎样做？',
    concept:'症状、变化与个体化评估',sourceIds:['acfas_cavus','rnoh_cavus'],
    options:[
      {id:'universal_insole',label:'只按足印配同一种鞋垫，保证解决。',correct:false,
        feedback:'仅凭足印不能选出通用处方。需要了解原因、症状、柔韧性与功能，再讨论鞋具、辅助支持或其他措施。'},
      {id:'train_everyone',label:'不再评估，所有人先做同一套高难训练。',correct:false,
        feedback:'反复扭伤、疼痛或新变化需要查清。训练难度与方向应依据能力和评估结果，不能先套统一方案。'},
      {id:'assess_then_share',label:'补充病史与功能检查，再共同决定。',correct:true,
        feedback:'对。先了解变化、既往和家族情况，检查足形、活动、力量及步态；必要时进一步医学评估。不能由一个压力印直接判断病因或保证疗效。'}]}
];

export const ARCH_LESSON = {
  id:'arch-comparison-v13',title:'同条件看足弓，不只看足印',
  intro:'先与正常足弓参考同帧比较，再学习高足弓。陈女士的低足弓主线保持不变。',
  comparisonRule:'匹配任务、体重／总载荷设定、步速、相位、足侧与固定色标，先描述再解释。',
  highArchSummary:'高足弓可能少中足接触并局部集中承重，但不能一律认作外侧COP，也不能凭足印下诊断。',
  patientCase:{name:'陈女士',arch:'low',mainConcern:'反复右踝扭伤与不稳',unchanged:true},
  extension:{arch:'high',independent:true,changesPatientCase:false},
  dataType:'authored_synthetic_teaching_data',measured:false,clinicalScore:false,
  comparisonConditions:['同任务','同体重／总载荷设定','同步速','同一接触相位','同足侧与方向','同单位与固定色标'],
  takeaways:['接触面积、局部压力和COP是不同信息。','正常参考不是人人必须达到的足印模板。','足印不能单独确诊、定位病因或决定统一处方。'],
  professionalBoundary:'脚弓高可有多种背景；若有症状、明显不对称或新进展，应进一步评估，不预设神经病变。',
  gaitReferenceRule:'对称参考也是教学设定，不是正常人必须达到的百分比；不能由足型直接推导某人的步态周期。',
  sourceRecord:'docs/arch-v13-sources.json',
  profiles:ARCH_PROFILES,questions:ARCH_QUESTIONS,coach:ARCH_COACH_HINTS,
  patientExplanations:ARCH_PATIENT_EXPLANATIONS,sources:ARCH_SOURCE_LINKS
};
