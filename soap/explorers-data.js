// Original teaching descriptions. Quantities below are synthetic, never clinical measurements.
export const MUSCLES = [
 {id:'tibialisAnterior',name:'胫骨前肌',origin:'胫骨外侧髁、外侧面近端及骨间膜',insertion:'内侧楔骨与第1跖骨基底内侧/跖侧',action:'踝背屈、足内翻；步行初触地后可离心控制前足下放。',motion:'dorsi'},
 {id:'tibialisPosterior',name:'胫骨后肌',origin:'胫骨与腓骨后面、骨间膜',insertion:'主要至舟骨粗隆，分支至楔骨、骰骨和第2–4跖骨基底等',action:'足内翻、辅助跖屈；参与内侧纵弓动态支撑。',motion:'invert'},
 {id:'fibularisLongus',name:'腓骨长肌',origin:'腓骨头与腓骨外侧面近端',insertion:'经足底至内侧楔骨、第1跖骨基底',action:'足外翻、辅助跖屈；参与第一跖列与横弓的动态稳定。',motion:'evert'},
 {id:'fibularisBrevis',name:'腓骨短肌',origin:'腓骨外侧面远端约2/3',insertion:'第5跖骨基底粗隆',action:'足外翻、辅助跖屈；参与外侧稳定。',motion:'evert'},
 {id:'gastrocnemiusM',name:'腓肠肌内侧头',origin:'股骨内侧髁后上方',insertion:'经跟腱至跟骨后面',action:'踝跖屈、辅助屈膝；跨膝踝，作用受膝位影响。',motion:'plantar'},
 {id:'gastrocnemiusL',name:'腓肠肌外侧头',origin:'股骨外侧髁外侧/后方',insertion:'经跟腱至跟骨后面',action:'踝跖屈、辅助屈膝；与内侧头和比目鱼肌共同参与推进。',motion:'plantar'},
 {id:'soleus',name:'比目鱼肌',origin:'腓骨头及近端后面、胫骨比目鱼肌线及内侧缘',insertion:'经跟腱至跟骨后面',action:'踝跖屈；负重时控制胫骨前移，不跨膝关节。',motion:'plantar'}
];
export const JOINTS=[
 ['距小腿关节（距上关节）','滑膜关节 · 滑车/铰链型','胫腓骨踝穴与距骨滑车；主要背屈、跖屈，真实轴为斜轴。','hinge'],
 ['距下关节','滑膜关节 · 后距跟关节通常列为平面型','狭义指后距跟关节；功能性距下复合体还涉及前方距跟舟关节。绕斜轴耦合运动，不能等同简单平面滑移或一概称鞍状关节。','plane'],
 ['距跟舟关节','滑膜关节 · 球窝样复合关节','距骨头与舟骨、跟骨关节面和足底跟舟韧带共同构成的关节窝配合；参与旋前/旋后。','ball'],
 ['跟骰关节','滑膜关节 · 鞍状关节','与距舟部分共同构成跗横关节；足部适应地面与推进的协同结构。','saddle'],
 ['楔舟、楔间与跗跖关节','多数为滑膜平面关节','小幅滑动，参与足弓适应与载荷传递；不是完全不动。','plane'],
 ['跖趾关节','滑膜关节 · 椭圆/髁状关节','屈伸及一定内收外展；拇趾背伸与推进、跖腱膜张紧有关。','ellipse'],
 ['趾间关节','滑膜关节 · 滑车/铰链型','主要屈伸，拇趾仅有一个趾间关节。','hinge'],
 ['下胫腓联合','纤维连结 · 韧带联合','维持踝穴稳定，允许小幅顺应；不属于滑膜铰链。','tie']
];
export const ARCHES=[
 {name:'内侧纵弓',bones:'跟骨 → 距骨 → 舟骨 → 3块楔骨 → 第1–3跖骨',text:'较高、富有弹性。跖腱膜、足底跟舟韧带等与肌腱共同支持，承担缓冲和能量储存/释放。',kind:'medial'},
 {name:'外侧纵弓',bones:'跟骨 → 骰骨 → 第4–5跖骨',text:'较低、相对稳定。提供外侧支撑并与内侧纵弓共同适应地面。',kind:'lateral'},
 {name:'横弓',bones:'跗骨远侧（楔骨、骰骨）与跖骨基底区域横向排列',text:'横跨内外侧，帮助分配载荷。横弓沿足长有所变化，不能画成所有跖骨头始终悬空的一条固定弧。',kind:'transverse'}
];
export const LIGAMENTS=[
 {id:'atfl',name:'距腓前韧带 ATFL',ends:'外踝前缘 ↔ 距骨颈外侧',role:'限制距骨过度前移等；内翻扭伤常累及。',view:'lateral',path:'M240 156 L310 180'},
 {id:'cfl',name:'跟腓韧带 CFL',ends:'外踝 ↔ 跟骨外侧',role:'跨距小腿与距下区域，参与限制过度内翻。',view:'lateral',path:'M240 160 L204 240'},
 {id:'ptfl',name:'距腓后韧带 PTFL',ends:'外踝后内侧 ↔ 距骨后部',role:'后方稳定结构；图中虚线表示深部走行的投影。',view:'lateral',path:'M240 156 L195 182'},
 {id:'deltoid',name:'三角韧带复合体',ends:'内踝 ↔ 距骨、跟骨、舟骨等',role:'内侧浅深层共同参与稳定；限制过度外翻和旋转。',view:'medial',path:'M240 155 L204 238 M240 155 L310 180 M240 155 L350 215'},
 {id:'spring',name:'足底跟舟韧带（弹簧韧带）',ends:'跟骨载距突 ↔ 舟骨足底侧',role:'托持距骨头，参与内侧纵弓静态支持。',view:'medial',path:'M226 220 Q285 247 350 215'},
 {id:'achilles',name:'跟腱（不是韧带）',ends:'腓肠肌/比目鱼肌腱性部分 → 跟骨后面',role:'传递小腿三头肌的跖屈拉力；肌腱连接肌肉与骨，韧带连接骨与骨。',view:'lateral',path:'M150 58 Q138 150 166 240'}
];
export const CASE_EVIDENCE=[
 {id:'inspection',stage:'joint',title:'视诊与触诊',method:'双侧暴露、同一光线；观察颜色、肿胀、皮肤、局部压痛。',result:'教学设定：皮肤完整，无明显红斑、瘀斑或肉眼肿胀；右外踝前下方轻度压痛。未做围度测量，不写“肿胀为零”。',meaning:'与当前无新伤的主诉相符；外侧压痛与内侧负荷后酸胀应分开记录。'},
 {id:'rom',stage:'joint',title:'负重背屈 · 同法双侧比较',method:'赤足膝触墙，足跟保持接触，膝沿第2趾方向；记录趾墙距离，双侧同法3次均值。',result:'教学设定：右6.0 cm，左9.0 cm；右侧末端发紧。未设跖屈/内翻角度，不补造角度。',meaning:'提示本任务中右侧负重背屈较小；不能换算成视频量角值，也不能单凭此定位限制组织。'},
 {id:'drawer',stage:'joint',title:'踝关节前抽屉试验',method:'受训者先排除需转诊的新伤；膝放松、踝轻度跖屈，固定远端胫腓骨，握跟骨使距骨相对胫骨向前移动。对侧同法比较松弛、终末感和症状；不猛拉。',result:'教学设定：右侧前向松弛较左侧明显、终末感较软；无剧痛，患者愿意继续。',meaning:'支持外侧机械性松弛的可能；不能单凭一次阳性断言韧带完全断裂或确诊CAI。'},
 {id:'tilt',stage:'joint',title:'内翻应力 / 距骨倾斜试验',method:'由受训者固定小腿，踝接近中立，控制后足内翻，记录相对松弛、终末感与疼痛；足位会改变受累结构。疼痛加重或要求停止即结束。',result:'教学设定：双侧未见明确差异，右侧有担心；未量化倾斜角度。',meaning:'未发现明确差异不能排除韧带损伤；前抽屉与倾斜试验检测侧重不同。'},
 {id:'control',stage:'muscle',title:'肌群与功能观察',method:'有支撑条件下，同样膝位、速度与提示比较双侧提踵；再选择标准化外翻测力。',result:'教学设定：右侧重复提踵时高度较早下降并需要扶持；未取得有效测力值或规范MMT等级。',meaning:'支持右侧功能耐力/控制表现不足的线索；疼痛、平衡与信心也影响表现，不能归因于单块肌肉。'},
 {id:'arch',stage:'arch',title:'负重与非负重足弓',method:'比较坐位与站立的内侧纵弓，配合可耐受的双足提踵及足形观察。',result:'教学设定：坐位可见右内侧纵弓；站立时降低；扶持下双足提踵时足弓部分恢复。',meaning:'与柔韧性低足弓特征相符。不是仅凭合成足印指数下诊断，更不能推断它造成了全部扭伤。'}
];
export function caseConclusion(reviewed=[]){const has=id=>reviewed.includes(id);return [
 'S：已知虚构病史为右踝一年内反复扭伤、发软和活动担心；目标为安心步行并逐步恢复跑步。是否已追问，应另看本轮问诊覆盖。',
 has('inspection')?'O：已阅视诊/触诊：皮肤完整，无明显红斑瘀斑或肉眼肿胀，外踝前下方轻压痛；未量化围度。':'O：视诊、肿胀和局部压痛资料尚未查阅。',
 has('rom')?'O：已阅右侧负重背屈较小的病例资料（膝触墙右6.0 cm、左9.0 cm，虚构教学设定）。':'O：背屈病例资料尚未查阅，暂不纳入本轮推理。',
 has('drawer')?'O：已阅前抽屉相对松弛线索，提示可能存在机械性成分。':'O：尚未核对外侧机械性松弛线索。',
 has('tilt')?'O：内翻应力试验未发现明确双侧差异；这不能单独排除损伤。':'O：内翻应力试验资料尚未查阅。',
 has('control')?'O：功能控制/耐力表现需进一步标准化测力。':'O：肌群功能资料尚未查阅。',
 has('arch')?'O：已阅符合柔韧性低足弓特征的观察；仅为伴随发现。':'O：足弓病例资料尚未查阅，不能自行补为扁平足。',
 'A：工作判断为右踝反复扭伤伴持续不稳症状，需进一步评估慢性踝关节不稳。不是已经证明的“低足弓致病链”。',
 '仍缺：规范功能量表（如CAIT/FAAM）、完整损伤时间与频率核对、必要鉴别检查及真实力量/平衡资料。最近一次伤仅1个月，不能冒称已满足研究入组常用的最近伤后>3个月条件。',
 'P：围绕症状和功能缺口，讨论活动度、肌力/控制、平衡及步行到跑步进阶；不能承诺只矫正足弓就治愈。'
 ];}
export function gaitCOM(p){const a=2*Math.PI*(p-.05);return {vertical:-1.5*Math.cos(2*a),lateral:2*Math.sin(a)};}
export function gaitCOP(p,bias=0){return {x:10*Math.cos(Math.PI*p)-10*p+bias*Math.sin(Math.PI*p),y:15+210*p};}
export function contractionState(mode,p){const q=mode==='eccentric'?1-p:p;return {length:mode==='isometric'?100:120-40*q,angle:mode==='isometric'?15:30*q};}
