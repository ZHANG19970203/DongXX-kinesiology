"""Small traceable retrieval from this project's course material; no web search."""
import json,re
def retrieve(root,objective,message):
    bank=json.loads((root/'learning/objectives-v15.json').read_text(encoding='utf-8-sig'))
    sources={s['id']:s for s in bank.get('sources',[])};cards=[]
    for item in bank['items']:
        refs=[sources[x] for x in item.get('sourceIds',[]) if x in sources]
        cards.append({'id':item['id']+'-note','title':next(o['title'] for o in bank['objectives'] if o['id']==item['objectiveId']),'text':item['explanation'],'objective':item['objectiveId'],'references':refs})
    # Independently authored course guide. The full archive is not an externally indexed literature database.
    guides=[('LAB01','运动轴与运动面','先指定关节、近端或远端运动、开链或闭链条件，再描述主要运动面和轴。模型轴面是教学近似，不能代替个体关节配准。'),('LAB02','力、力矩与测量条件','力矩需指定转轴及力的垂直力臂。比较实验要保持测量方法、姿势、负荷和速度条件明确；相关性不等于一致性。'),('LAB03','肌肉收缩与训练条件','向心与离心描述活动肌肉缩短与伸长；等长指长度近似不变。等速需要控制角速度，不能把普通恒速动画当成等速测试。肌肉活动不等于直接测得肌力或肌电。'),('LAB10','踝足复合运动','踝关节背屈与跖屈主要描述距小腿关节运动。内翻外翻、旋前旋后需说明关节复合体与坐标系。不要把距下关节简单写成鞍状关节。'),('LAB11','足弓与功能','内侧纵弓、外侧纵弓和横弓共同参与承重与形变。低足弓并不必然导致慢性踝关节不稳；需结合病史、负重与非负重观察及功能评估。'),('LAB12','姿势控制','COP是支撑面上合力作用位置的描述，COM是身体质心；两者不能互换。静态COP轨迹比较需控制时长、站姿、视觉、采样和滤波条件。'),('LAB13','步态周期','一侧足初始接触至该侧再次初始接触构成一个步态周期。支撑与摆动、步长步宽步速和身体质心需各自定义；教学合成曲线不能当成临床实测。')]
    for oid,title,txt in guides:cards.append({'id':oid+'-guide','title':title,'text':txt,'objective':oid,'references':[{'title':'本项目课程与模型边界','url':'/lab/teacher-restoration.html'}]})
    grams=set(re.findall(r'[a-zA-Z]{3,}|[\u4e00-\u9fff]{2}',message.lower()))
    for c in cards:c['score']=(8 if c['objective']==objective else 0)+sum(g in (c['title']+c['text']).lower() for g in grams)
    return sorted([c for c in cards if c['score']>0],key=lambda c:-c['score'])[:4]
