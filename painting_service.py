"""Teaching-only body projection scoring and auditable experience certificates."""
import json, math, uuid, hashlib
from pathlib import Path
from PIL import Image,ImageDraw
from learning_service import ServiceError,check_object,ident,now,dumps

class PaintingService:
 def __init__(self,learning):
  self.l=learning;self.catalog=json.loads((learning.root/'painting/catalog.json').read_text(encoding='utf8')) if hasattr(learning,'root') else None
  if self.catalog is None:self.catalog=json.loads((Path(__file__).parent/'painting/catalog.json').read_text(encoding='utf8'))
  with self.l.store.connect() as c:
   c.executescript('''CREATE TABLE IF NOT EXISTS painting_attempts(session_id TEXT,request_id TEXT,kind TEXT,muscle TEXT,side TEXT,input_json TEXT,result_json TEXT,received_at TEXT,PRIMARY KEY(session_id,request_id));
   CREATE TABLE IF NOT EXISTS experience_certificates(id TEXT PRIMARY KEY,owner_json TEXT,scope TEXT,evidence_hash TEXT,evidence_json TEXT,issued_at TEXT,UNIQUE(owner_json,scope,evidence_hash));''')
 def detail(self,sid):
  with self.l.store.connect() as c:rows=c.execute('SELECT * FROM painting_attempts WHERE session_id=? ORDER BY rowid',(sid,)).fetchall()
  return [{'requestId':r['request_id'],'kind':r['kind'],'muscle':r['muscle'],'side':r['side'],'result':json.loads(r['result_json']),'at':r['received_at']} for r in rows]
 def target(self,muscle,side):
  mask=self.catalog['muscles'][muscle]['masks'].get(side)
  if not mask:raise ServiceError(422,'这项没有可评分的独立模型，进入知识辨认即可。')
  im=Image.new('1',(600,1000));dr=ImageDraw.Draw(im)
  for row in mask['rows']:
   for a,b in zip(row[1::2],row[2::2]):dr.line((a,row[0],b-1,row[0]),fill=1)
  return im
 def grade(self,muscle,side,strokes):
  if not isinstance(strokes,list) or not 1<=len(strokes)<=100:raise ServiceError(422,'请先绘画；每次最多100笔。')
  count=0
  for s in strokes:
   check_object(s,('points','width'),('erase',))
   if not isinstance(s['points'],list) or not s['points']:raise ServiceError(422,'笔迹为空或格式无效。')
   if 'erase' in s and not isinstance(s['erase'],bool):raise ServiceError(422,'擦除标记无效。')
   count+=len(s['points'])
  if count>2400:raise ServiceError(422,'笔迹过多，请清空后分区域重新绘制。')
  im=Image.new('1',(600,1000));dr=ImageDraw.Draw(im)
  for s in strokes:
   check_object(s,('points','width'),('erase',));w=s['width'];pts=s['points']
   if isinstance(w,bool) or not isinstance(w,(float,int)) or not math.isfinite(w) or not 1<=w<=70:raise ServiceError(422,'画笔宽度无效。')
   if not isinstance(pts,list) or not pts:raise ServiceError(422,'笔迹为空。')
   for p in pts:
    if not isinstance(p,list) or len(p)!=2 or any(isinstance(v,bool) or not isinstance(v,(float,int)) or not math.isfinite(v) for v in p) or not 0<=p[0]<600 or not 0<=p[1]<1000:raise ServiceError(422,'笔迹坐标无效。')
   fill=0 if s.get('erase') is True else 1;r=w/2;points=[tuple(p) for p in pts];dr.line(points,fill=fill,width=max(1,round(w)),joint='curve')
   for x,y in [points[0],points[-1]]:dr.ellipse((x-r,y-r,x+r,y+r),fill=fill)
  target=self.target(muscle,side);t=target.tobytes();a=im.tobytes();area=sum(v.bit_count() for v in t);paint=sum(v.bit_count() for v in a);hit=sum((x&y).bit_count() for x,y in zip(a,t));coverage=hit/area;spill=(paint-hit)/paint if paint else 1;iou=hit/(area+paint-hit) if area+paint-hit else 0
  passed=coverage>=.70 and spill<=.25
  feedback='位置基本正确，肌肉已显现。再判断它的功能。' if passed else '范围偏大，请擦去目标区域之外的部分。' if spill>.25 else '覆盖还不够，请检查近端、远端和肌腹的走向。'
  return {'passed':passed,'coverage':round(coverage,4),'spill':round(spill,4),'iou':round(iou,4),'paintedPixels':paint,'targetPixels':area,'hitPixels':hit,'feedback':feedback,'rubricVersion':'projection-70-25-v1','scope':'二维投影教学判定；不是临床精度'}
 def run(self,data,token):
  check_object(data,('session','requestId','action'),('muscle','side','strokes','choice'))
  session=self.l.validate_session(data['session']);sid=session['id'];self.l.auth(sid,token,session);rid=ident(data['requestId']);kind=data['action']
  if kind=='state':return {'attempts':self.detail(sid)},200
  key=data.get('muscle');side=data.get('side');m=self.catalog['muscles'].get(key)
  if side not in ('R','L'):raise ServiceError(422,'请先选择人体左侧或右侧，再提交。')
  if not m or kind not in ('paint','function','reference'):raise ServiceError(422,'学习项目无效。')
  with self.l.store.connect() as c:
   old=c.execute('SELECT * FROM painting_attempts WHERE session_id=? AND request_id=?',(sid,rid)).fetchone()
   if old:
    if old['input_json']!=dumps(data):raise ServiceError(409,'请求编号已使用。')
    return {'result':json.loads(old['result_json']),'attempts':self.detail(sid),'duplicate':True},200
  previous=self.detail(sid);assisted=any(r['muscle']==key and r['side']==side and r['kind']=='reference' for r in previous)
  if kind=='paint':result=self.grade(key,side,data.get('strokes'));result['assisted']=assisted
  elif kind=='reference':result={'assisted':True,'passed':False,'feedback':'已记为参考学习。查看参考本身不算完成。'}
  else:
   choice=data.get('choice');correct=choice=='function:'+key;painted=not m['geometryAvailable'] or any(r['muscle']==key and r['side']==side and r['kind']=='paint' and r['result']['passed'] for r in previous)
   result={'passed':correct and painted,'functionCorrect':correct,'feedback':m['function'] if correct else '再想一想它跨过的位置与牵拉方向。','needsPainting':not painted,'assisted':assisted,'scope':'功能辨认，不是肌力评估'}
  at=now()
  with self.l.store.connect() as c:c.execute('INSERT INTO painting_attempts VALUES (?,?,?,?,?,?,?,?)',(sid,rid,kind,key,side,dumps(data),dumps(result),at))
  self.l.store.save(session,[{'id':'paint.'+rid,'sessionId':sid,'type':'painting_'+kind,'at':at,'payload':{'module':'肌肉彩绘', 'muscle':m['name'],'key':key,'side':side,**result}}])
  return {'result':result,'attempts':self.detail(sid)},200
 def certificate(self,data):
  check_object(data,('sessions','scope','action'))
  if data['scope'] not in ('painting','clinic','lab','all') or data['action'] not in ('status','issue'):raise ServiceError(422,'证书请求无效。')
  credentials=data['sessions']
  if not isinstance(credentials,list) or not 1<=len(credentials)<=80:raise ServiceError(422,'请先登录并完成学习，记录同步后再查看。')
  ids=[];owner=None
  for item in credentials:
   check_object(item,('id','token'));row=self.l.auth(item['id'],item['token']);student=json.loads(row['identity_json'])
   if not student or not student.get('studentId'):raise ServiceError(422,'请先登记姓名和学号。')
   if owner is not None and student!=owner:raise ServiceError(403,'只能合并本人同一登记信息的记录。')
   owner=student;ids.append(item['id'])
  ids=sorted(set(ids));events=[];attempts=[]
  for sid in ids:events.extend(self.l.store.detail(sid)['events']);attempts.extend(self.detail(sid))
  done={r['muscle'] for r in attempts if r['kind']=='function' and r['result'].get('passed')};muscles=self.catalog['muscles'];painting=[{'id':k,'label':m['name'],'done':k in done,'kind':'彩绘与功能' if m['geometryAvailable'] else '知识辨认（模型缺项）'} for k,m in muscles.items()]
  tasks={e['payload'].get('nodeId') for e in events if e['type']=='clinic3d_task_completed'};choices={e['payload'].get('nodeId') or e['payload'].get('node') for e in events if e['type']=='clinic3d_choice'}
  clinical=[('history','病史、安全与意愿',{'history','safety','consent_reply'}.issubset(choices)),('arch','足弓坐站比较','arch_compare' in tasks),('muscle','肌群与运动配对','muscle_match' in tasks),('joint','关节活动与同法测量','alignment' in tasks and 'trial' in choices),('pressure','足弓指数','arch_index' in tasks),('balance','静态COP','static_cop' in tasks),('gait','步态观察与标记','gait_events' in tasks),('plan','证据、计划与反思',any(e['type']=='clinic3d_learning_complete' and len(str(e['payload'].get('reflection','')).strip())>=8 for e in events) and any(e['type']=='clinic3d_evidence_review' for e in events) and any(e['type']=='clinic3d_choice' and (e['payload'].get('nodeId') or e['payload'].get('node'))=='plan' for e in events))]
  # SOAP route has existing server-evaluated task receipts; a full submitted round also qualifies.
  soap_done=any(self.l.soap.detail(sid)['complete'] for sid in ids)
  clinic=[{'id':k,'label':n,'done':bool(v or soap_done),'kind':'病例体验'} for k,n,v in clinical]
  # Unanswered patient concerns remain an unfinished experience item, not a moral score.
  pending_communication={}
  for e in sorted(events,key=lambda x:x.get('receivedAt',x.get('at',''))):
   if e['type'] in ('clinic3d_communication_reaction','clinic3d_communication_repaired'):
    key=(e.get('sessionId',''),e['payload'].get('nodeId',''))
    pending_communication[key]=e['type']=='clinic3d_communication_reaction'
  if any(pending_communication.values()) and not soap_done:
   clinic[-1]['done']=False;clinic[-1]['label']='证据、计划与反思（尚有患者顾虑待回应）'
  obs=set();explain=set()
  for e in events:
   p=e['payload'];mid=p.get('module');mid=mid.get('id') if isinstance(mid,dict) else mid
   if mid is None:mid=str(p.get('action','')).split('-')[0]
   try:mid=int(mid)
   except (TypeError,ValueError):continue
   if e['type']=='lab_observation_saved':obs.add(mid)
   if e['type']=='lab_explanation_saved' and len(str(p.get('record',{}).get('text',p.get('record',{}).get('answer',''))).strip())>=4:explain.add(mid)
  lab=[{'id':str(i),'label':f'实验{i:02} · 保存观察与解释','done':i in obs and i in explain,'kind':'13实验学习路径'} for i in range(1,14)]
  blocks={'painting':painting,'clinic':clinic,'lab':lab,'all':clinic+lab+painting};items=blocks[data['scope']];count=sum(i['done'] for i in items);progress={'scope':data['scope'],'done':count,'total':len(items),'percent':int(count*100/len(items)),'items':items,'eligible':count==len(items),'criteriaVersion':'experience-v26.1','owner':owner,'knowledgeGradeSeparate':True}
  if data['action']=='issue':
   if not progress['eligible']:raise ServiceError(409,'体验尚未达到100%，请完成清单中的待学习项目。',progress=progress)
   evidence={'sessions':ids,'items':items,'criteriaVersion':progress['criteriaVersion'],'paintingAssistedItems':sorted({r['muscle'] for r in attempts if r['result'].get('assisted')}),'eventIds':sorted({e['id'] for e in events}),'paintingRequests':sorted(r['requestId'] for r in attempts)};finger=hashlib.sha256(dumps(evidence).encode()).hexdigest()
   with self.l.store.connect() as c:
    old=c.execute('SELECT * FROM experience_certificates WHERE owner_json=? AND scope=? AND json_extract(evidence_json,\'$.criteriaVersion\')=? ORDER BY issued_at LIMIT 1',(dumps(owner),data['scope'],progress['criteriaVersion'])).fetchone()
    if old:cert=dict(old)
    else:
     cert={'id':'DXX-'+uuid.uuid4().hex[:16].upper(),'owner_json':dumps(owner),'scope':data['scope'],'evidence_hash':finger,'evidence_json':dumps(evidence),'issued_at':now()};c.execute('INSERT INTO experience_certificates VALUES (?,?,?,?,?,?)',tuple(cert[k] for k in ['id','owner_json','scope','evidence_hash','evidence_json','issued_at']))
   progress['certificate']={k:cert[k] for k in ['id','scope','issued_at','evidence_hash']}
   s=self.l.detail(ids[0])['session'];session={k:s[k] for k in ['id','caseId','startedAt','student']}
   self.l.store.save(session,[{'id':'certificate.'+cert['id'],'sessionId':ids[0],'type':'experience_certificate_issued','at':cert['issued_at'],'payload':{'module':'学习荣誉','scope':data['scope'],'certificateId':cert['id'],'completion':1,'criteriaVersion':progress['criteriaVersion']}}])
  return progress
