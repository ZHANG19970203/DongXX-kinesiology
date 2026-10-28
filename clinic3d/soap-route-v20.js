// SOAP course adapter. Retains historical node IDs without granting old evidence.
export const SOAP_STAGES=[
 {act:'act1',entry:'welcome',title:'S · 病史与目标',goal:'听清困扰与活动目标',task:'问受伤、症状、既往处理与意愿'},
 {act:'act4',entry:'arch_intro',title:'O · 负重与足形',goal:'比较坐位与站立',task:'脱鞋袜，观察负重前后足弓'},
 {act:'act3',entry:'muscle_intro',title:'O · 踝足肌群',goal:'用解剖位置理解功能',task:'定位肌群，配对四种运动'},
 {act:'act2',entry:'local_intro',title:'O · 活动与轴面',goal:'认识运动方向与测量',task:'看轴面、核对量角器和同法试次'},
 {act:'act6',entry:'pressure_intro',title:'O · 足弓扫描',goal:'区分足印面积与压力',task:'看同条件足压，计算足弓指数'},
 {act:'act7',entry:'balance_intro',title:'O · 静态COP',goal:'理解站立姿势控制',task:'比较同条件轨迹，计算平均速度'},
 {act:'act5',entry:'gait_intro',title:'O · 步态周期',goal:'看支撑、摆动与双侧差异',task:'标记接地与离地，比较时空参数'},
 {act:'act8',entry:'plan_intro',title:'A / P · 解释与计划',goal:'证据对应功能目标',task:'提出解释、选训练靶点与复评'}
];
export const VOICED_TURNS={
 welcome:[['therapist','陈女士，您好。最近哪里不舒服？'],['patient','右脚这一年崴了三次，走路总怕发软。'],['therapist','我理解。我们先聊清楚，再一起检查。']],
 local_intro:[['therapist','现在看踝关节背屈和跖屈。'],['patient','向上动时，右边有点紧。'],['therapist','我们慢慢来，不舒服就停。']],
 muscle_intro:[['therapist','肌肉既产生动作，也帮助稳定脚踝。'],['patient','往外稳住脚，是哪些肌肉呢？'],['therapist','一起看腓骨长肌和短肌。']],
 arch_intro:[['therapist','请坐稳，先脱鞋袜，再比较坐着和站着的足弓。'],['patient','站久了，我的脚内侧会酸。'],['therapist','我们先观察负重前后的变化。']],
 pressure_intro:[['therapist','先看足印，再计算足弓指数。'],['patient','颜色越红，就是越严重吗？'],['therapist','不是。颜色要结合色标、任务和症状看。']],
 balance_intro:[['therapist','请睁眼、双脚自然站稳。我们看静态压力中心。'],['patient','站着没动，这个点也会移动吗？'],['therapist','会有小幅移动。身体一直在调整平衡。']],
 gait_intro:[['therapist','请按平常方式走，不必刻意踩板。'],['patient','我走快或变向时，总担心又崴。'],['therapist','我们先看双侧支撑和摆动的差别。']],
 plan_intro:[['therapist','把实际取得的资料放在一起，再商量计划。'],['patient','我想先安心走路，再慢慢跑步。'],['therapist','好。先定可做到的目标，再安排复评。']]
};
export function applySOAPRoute(flow,data,evidence){
 data.acts=[...SOAP_STAGES.map(s=>({id:s.act,title:s.title,shortTitle:s.title.split(' · ')[1],zone:s.goal})),{id:'debrief',title:'学习复盘',shortTitle:'复盘',zone:'证据板'}];
 const edge=(id,option,next)=>{const o=flow[id].options.find(o=>o.id===option);if(o)o.next=next;};
 edge('consent_reply','reassure_without_guarantee','arch_intro');
 edge('arch_concern','arch_not_cause','muscle_intro');
 for(const o of flow.muscle_match.options){o.next='local_intro';o.label=o.id==='muscle_defer'?'暂记待补，进入关节活动':'完成配对，观察关节活动';o.shortLabel=o.label;}
 flow.local_intro.next='alignment';
 edge('local_explain','limited_inference','pressure_intro');
 edge('gait_interpret','observe_only','plan_intro');
 flow.cop_explain.options.find(o=>o.id==='cop_limit').next='arch_index';
 flow.pressure_intro.text='先看同条件足印与负荷，再计算足弓指数。';
 flow.balance_intro.speaker='林治疗师';flow.balance_intro.text='双脚自然站稳、睁眼，看静态压力中心的小幅变化。';flow.balance_intro.next='static_cop';flow.balance_intro.visualMode='pressure';
 const node=(id,act,text,type,next)=>({id,act,kind:'task',speaker:'动小助',text,visualMode:'pressure',task:{type,instructions:text},options:[{id:id+'_done',label:'完成记录，继续',next,good:true,safe:true,requiresTask:true,evidence:[id]}]});
 flow.arch_index=node('arch_index','act6','不含脚趾：中足面积 ÷ 前足、中足、后足面积之和。','archIndex','balance_intro');
 flow.static_cop=node('static_cop','act7','同样双脚睁眼、30秒，比较轨迹，再计算路径长度 ÷ 时间。','staticCOP','gait_intro');
 evidence.arch_index={label:'足弓指数计算练习',status:'synthetic_teaching_data',text:'原创足印面积：后足30、中足40、前足50平方厘米，AI=0.333；不代表该患者实测或扁平足严重程度。'};
 evidence.static_cop={label:'静态COP同条件计算',status:'synthetic_teaching_data',text:'原创30秒50Hz双足睁眼数据，对照路径169.299毫米、平均速度5.643毫米/秒；不是正常参考阈值或患者实测。'};
 // Remove obsolete clinical challenge nodes, redirect historical bookmarks safely.
 for(const id of ['balance_choice','balance_trial','balance_stop','balance_explain','muscle_method','muscle_explain','tool']){
  const target=id.startsWith('balance')?'static_cop':id==='tool'?'alignment':'muscle_match';
  flow[id]={...flow[target],id,kind:'dialogue',task:undefined,options:[],next:target,text:'这一环节已聚焦到新的运动学任务。',evidence:undefined,record:undefined};
 }
 for(const n of Object.values(flow))for(const o of n.options||[])if(o.next==='tool')o.next='alignment';
 flow.trigger_answer.text='第一次是快一年前跑步时扭了，脚往里面扣。后来走不平的路也扭过，最近一次是一个月前跑步变向。';
 flow.trigger_answer.text+=' '+"走不平的路、走快转弯或跑步变向时，有时脚踝突然一软，像踩空了。那一下不一定很疼，但我会害怕再崴。";
 flow.safety_answer.text='主要是酸胀、发紧，不是一直像针扎那样疼。站久或走多以后更明显，坐下休息会好一些。 最近没有新伤或麻木，能走路。';
 flow.goal_answer.text='第一次拍片说没骨折，休息大约三周恢复了日常活动。后面自己休息，没有系统康复，也没长期用护踝。 我想先安心走不平的路，再逐渐恢复轻松跑步。';
 flow.local_record.text='右边发紧，再往前脚跟就要抬。';
 flow.plan_patient.text='我愿意从简单的开始。不舒服就停，再告诉您。';
 for(const n of Object.values(flow)){
  const stage=SOAP_STAGES.find(s=>s.act===n.act);
  if(stage){n.purpose=stage.goal;n.education={...(n.education||{}),why:stage.goal,steps:[stage.task]};if(n.task)n.task.education=n.education;}
 }
}

export function updateFilmDialogue(sequence){
 const after={
 '01B':[['therapist','检查从小幅动作开始，您随时可以停。'],['patient','好，发紧或害怕时，我会告诉您。']],
 '02B':[['patient','发紧就代表骨头错位了吗？'],['therapist','不一定。先记录活动表现，再综合判断。']],
 '04B':[['patient','脚弓低，就是反复崴脚的原因吗？'],['therapist','不能只看足形。还要结合活动、负荷和控制。']],
 '05B':[['patient','左右走得不一样，就说明肌肉坏了吗？'],['therapist','还不能。先描述支撑、摆动和步长，再查原因。']],
 '06B':[['patient','这条轨迹就是身体重心吗？'],['therapist','这是足底压力中心。重心是另一个概念。']],
 '08B':[['therapist','先从能完成的训练开始，不适就停，再按同法复评。'],['patient','明白了。我先练安心走路，谢谢您。']]
 };

 for(const clip of sequence.clips){
  if(after[clip.id])clip.normal=after[clip.id].map(([speaker,text])=>({speaker,text}));
  if(VOICED_TURNS[clip.anchorNode])clip.normal=VOICED_TURNS[clip.anchorNode].map(([speaker,text])=>({speaker,text}));
  // Obsolete post-MMT and single-leg challenge scenes are no longer part of this course.
  if(['03B','07B'].includes(clip.id))clip.anchorNode='__archived_'+clip.anchorNode;
  if(clip.id==='06A'){clip.evidenceRequirement={all:[]};clip.alternative=clip.alternative.filter(a=>a.condition!=='gait_skipped');}
  if(clip.id==='07A')clip.actionLabel='比较双脚睁眼站立的静态COP';
  for(const branch of [clip.normal,...clip.alternative.map(a=>a.lines)])for(const turn of branch){
   turn.text=turn.text.replaceAll('十四个月前跑步扭了右脚','快一年前跑步扭了右脚').replaceAll('背伸','背屈');
  }
 }
}
