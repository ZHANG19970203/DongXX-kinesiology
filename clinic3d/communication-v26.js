// Authored teaching responses, not AI sentiment scoring or clinical findings.
export const REACTIONS = {
 assume_arch:['premature','林治疗师，您还没有问清我的经历，怎么就确定是脚弓的问题？'],
 challenge_first:['safety','林治疗师，我担心站不稳。您能先说明为什么要做、怎样保护我吗？'],
 skip_screening:['safety','林治疗师，能走进来不代表我做动作不会不舒服。您先听听我的情况，好吗？'],
 cosmetic_goal:['goal','林治疗师，我更在意能不能安心走路，不只是脚看起来像不像标准图。'],
 command_only:['consent','林治疗师，我想先知道检查的目的。请您解释清楚，再让我决定。'],
 guarantee_no_pain:['promise','林治疗师，您说一定不会疼，我还是不放心。如果不舒服，我可以停吗？'],
 max_angle:['method','林治疗师，屏幕转到最大，就是我的活动角度吗？我还没有做测量呢。'],
 heel_lift:['method','林治疗师，我已经踮起脚跟了。这样得到的结果还能和刚才比吗？'],
 different_method:['method','林治疗师，两边姿势都不一样，您能说明为什么可以直接比较吗？'],
 talus_out:['premature','林治疗师，听到骨头错位我有点害怕。您是根据哪项检查判断的？'],
 force_target:['method','林治疗师，为了踩准板子，我都不敢按平常的方式走了。这样能看出平时的问题吗？'],
 power_from_picture:['premature','林治疗师，只看我走路就知道是哪块肌肉没力气吗？还需要检查吗？'],
 arch_to_sprain:['premature','林治疗师，您还没有检查韧带，怎么知道它一直受力太大？'],
 arch_cure:['promise','林治疗师，只要垫高脚弓就一定不再崴吗？我想了解您这样判断的依据。'],
 red_always_worse:['premature','林治疗师，红色就表示损伤严重吗？听您这么说，我更担心了。'],
 three_points:['premature','林治疗师，脚心碰到地面就算有病吗？您能结合我的不适解释一下吗？'],
 cop_cause:['premature','林治疗师，这条线就能说明我为什么反复崴脚吗？其他检查还要看吗？'],
 guaranteed_orthosis:['promise','林治疗师，您能保证以后完全不崴吗？我还想知道怎样训练、什么时候复查。'],
 return_today:['safety','林治疗师，我现在还担心发软。没有核对恢复情况，就让我去跑步，我不放心。'],
 push_through:['consent','林治疗师，我已经说了不舒服，也想停下来。请您尊重我的感受。'],
 test_anyway:['safety','林治疗师，我的脚已经疼得不敢踩地了。您还让我单脚站，我不敢，也不愿意。'],
 single_cause_chain:['premature','林治疗师，您说这么多地方都坏了，我很害怕。哪些有检查依据，哪些还不确定？'],
 arch_root:['premature','林治疗师，脚弓低就是所有问题的原因吗？我希望您先把依据讲清楚。']
};
export function polite(text){return String(text||'').replace(/你(?!们)/gu,'您').replaceAll('回球场','恢复跑步').replaceAll('返场','恢复运动');}
export function patientLine(text){const s=polite(text);return /^(林治疗师|医生|谢谢)/u.test(s)?s:'林治疗师，'+s;}
export function normalizeFlow(flow){for(const n of Object.values(flow)){n.text=n.speaker==='陈女士'?patientLine(n.text):polite(n.text);for(const o of n.options||[]){o.label=polite(o.label);if(o.shortLabel)o.shortLabel=polite(o.shortLabel);}}}
export function normalizeFilm(film){for(const c of film.clips)for(const group of [c.normal,...c.alternative.map(a=>a.lines)])for(const t of group)t.text=t.speaker==='patient'?patientLine(t.text):polite(t.text);}
export function reactionFor(optionId,attempt=1){
 const item=REACTIONS[optionId];if(!item)return null;
 const [kind,question]=item,serious=['consent','safety'].includes(kind),repeated=attempt>1;
 const text=repeated?(serious?'林治疗师，我已经表达了担心，您却还在催我做。我有点生气，请您先听我说完。':'林治疗师，刚才的问题还没有解释清楚。我越来越不放心，请您先说明依据和下一步。'):question;
 return {kind,text,emotion:repeated&&serious?'upset':repeated?'concerned':'questioning',attempt};
}
export function repairLabel(option){return option.good===false||option.retry?(option.shortLabel||option.label):'抱歉，刚才没有说清楚。'+(option.shortLabel||option.label);}
export const REPAIR_ACK='谢谢您愿意听我说，也重新解释。接下来我们一步一步来，不舒服时我会告诉您。';
