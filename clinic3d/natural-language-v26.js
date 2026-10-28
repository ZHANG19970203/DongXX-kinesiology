// Authored everyday dialogue; technical definitions remain in optional learning panels.
const replacements=[['直接加载','直接开始单脚站立检查'],['结束加载','停止这个动作'],['继续加载','继续做这个动作'],['负重挑战','需要站立承重的检查'],['体能任务','站立和行走检查'],['请回稳','请先扶好、站稳'],['回到安全支撑','先扶好、站稳'],['同法复评','用同一种方法再检查一次'],['同方法复评','用同一种方法再检查一次'],['按同方法复评','用同一种方法再检查一次'],['按同法复评','用同一种方法再检查一次'],['返场跑步','恢复跑步'],['返场','恢复运动'],['能耐受的','您感觉舒适的'],['不凑步踩板','不用为了踩准板子特意调整步子']];
export function naturalText(s){for(const [a,b] of replacements)s=String(s||'').replaceAll(a,b);return s;}
const choices={
 ask_history:'您一般在什么情况下觉得脚踝不稳？最初是怎么扭伤的？',
 ask_screening:'最近又扭伤过吗？有没有更疼、更肿、发麻，或痛得不敢踩地？',
 skip_screening:'您都能走进来了，我们就直接做单脚站立吧。',
 alternate_alert:'换一种情况想一想：她刚扭伤，痛得不敢踩地。',
 ask_goal:'之前做过哪些处理？现在最想恢复哪项活动？',
 cosmetic_goal:'只要把脚弓的外形变好看，其他就不用管了。',
 explain_consent:'我想看看您的脚踝怎么活动、平时怎么走路。每一步都会先解释，不舒服随时停，可以吗？',
 command_only:'您先照我说的做完，问题一会儿再问。',
 reassure_without_guarantee:'我们先小幅度活动，我会在旁边保护。您觉得不舒服，我们马上停。',
 guarantee_no_pain:'您放心，保证一点都不疼，以后也不会再崴。',
 respect_decline:'可以，今天先聊清楚。您准备好了，我们再检查。',
 limited_inference:'右脚往上活动时更紧一些。发紧不等于骨头错位，我们还要结合其他检查。',
 natural_walk:'请按平常的方式往前走，不用特意踩准板子。不舒服就告诉我。',
 force_target:'请每一步都踩准板子中间，不要踩偏。',
 observe_only:'右脚踩地的时间较短，两边步长也不同。原因还要结合您的感受和其他检查。',
 arch_not_cause:'脚弓低不一定就是反复崴脚的原因。我们还要看看脚踝的活动和控制情况。',
 cop_limit:'这条线表示脚底受力的中心怎样移动。它能帮助我们观察，但不能单凭这条线确定病因。',
 easy_start:'先睁着眼、双脚站稳，我在旁边保护。您愿意的话，再试单脚站。',
 shared_stop:'如果疼痛加重或站不稳，请先停下、扶稳。为了确认我讲清楚了，您能说说遇到这种情况会怎么做吗？',
 graded_control:'我们先练习您能做到的力量和平衡动作，再根据表现逐渐增加难度。',
 mobility_recheck:'我们先针对刚才发现的活动限制练习，之后用同一种方法再检查。',
 load_support_trial:'针对久站后的不适，可以先调整活动量，再讨论是否需要辅助支撑，并观察效果。',
 complete_missing:'还有些情况没有查清楚，我们先补充检查，再商量具体训练。',
 medical_evaluation:'先别勉强踩地，请坐下休息。需要请医生进一步检查。',
 return_today:'这些动画看完，您今天就可以放心跑步了。',
 pain_stop:'您说越来越不舒服，我们先停下来。',
 evidence_problem_plan:'先说清检查发现了什么、影响了哪些活动，再一起选训练方法，之后复查。'
};
export function applyNaturalFlow(flow){
 for(const n of Object.values(flow)){
  n.text=naturalText(n.text);
  for(const o of n.options||[]){o.label=naturalText(o.label);if(o.shortLabel)o.shortLabel=naturalText(o.shortLabel);if(choices[o.id])o.label=o.shortLabel=choices[o.id];}
 }
 flow.pressure_intro.text='接下来看看脚底哪些地方接触地面、哪些地方受力较多。先看站立，再看走路。';
 flow.balance_intro.text='请睁着眼，双脚自然站好。屏幕上的点表示脚底受力的中心，我们看看它怎样移动。';
 flow.plan_intro.text='谢谢您的配合。我们把刚才了解到的情况放在一起，围绕安心走路的目标商量下一步。';
}
export function applyNaturalFilm(sequence){
 for(const c of sequence.clips)for(const group of [c.normal,...c.alternative.map(a=>a.lines)])for(const t of group)t.text=naturalText(t.text)
  .replaceAll('先记录活动表现，再综合判断。','先看看您怎么活动，再结合其他检查判断。')
  .replaceAll('还要结合活动、负荷和控制。','还要看看脚踝怎么活动、怎样承重，以及能不能稳住。')
  .replaceAll('先描述支撑、摆动和步长，再查原因。','先看看每只脚踩地多久、迈了多远，再结合检查找原因。')
  .replaceAll('颜色要结合色标、任务和症状看。','先看颜色代表什么、当时是在站立还是走路，再结合您的不适来解释。')
  .replaceAll('我们看静态压力中心。','我们看看脚底受力的中心怎样移动。')
  .replaceAll('重心是另一个概念。','身体质心是全身质量的平均位置，和脚底这个点不一样。');
}
