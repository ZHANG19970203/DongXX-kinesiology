import sys,json,uuid,tempfile,threading,urllib.request,urllib.error,hashlib
from pathlib import Path
from PIL import Image
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root));qa=Path(tempfile.mkdtemp(prefix='dxx-v25-results-'))
import serve_lab
from learning_service import ServiceError
results=[]
def check(name,ok):
 assert ok,name
 results.append({'name':name,'passed':True})
with tempfile.TemporaryDirectory(dir=str(qa)) as tmp:
 s=serve_lab.create_server(0,Path(tmp),testing=True);thread=threading.Thread(target=s.serve_forever,daemon=True);thread.start();p=s.painting
 student={'name':'隔离验证学生','studentId':'QA-v25','teacher':'张积众'};session={'id':'painting.test-v25','caseId':'cai','startedAt':serve_lab.now(),'student':student};start=s.learning.start({'session':session},'');token=start['accessToken']
 def run(action,key='scm',**data):return p.run({'session':session,'requestId':uuid.uuid4().hex,'action':action,'muscle':key,'side':'R',**data},token)[0]
 check('23 groups / 64 items / 59 real projection targets',len(p.catalog['groups'])==23 and len(p.catalog['muscles'])==64 and sum(m['geometryAvailable'] for m in p.catalog['muscles'].values())==59)
 validmasks=[]
 for key,m in p.catalog['muscles'].items():
  for side,mask in m['masks'].items():
   im=p.target(key,side);check('mask-area:'+key+side,sum(b.bit_count() for b in im.tobytes())==mask['area']);validmasks.append((key,side,mask['area']))
 check('blank cannot pass',p.grade('scm','R',[{'width':10,'points':[[20,20],[25,25]]}])['passed'] is False)
 fill=[{'width':70,'points':[[x,0],[x,999]]} for x in range(0,600,50)]
 check('whole-body overpaint cannot pass',p.grade('scm','R',fill)['passed'] is False)
 def exact_strokes(key):
  mask=p.catalog['muscles'][key]['masks']['R'];out=[]
  # Draw at 2px raster spacing, simulating narrow horizontal strokes.
  rows=mask['rows'];step=max(2,(len(rows)+90)//91)
  for row in rows[::step]:
   for a,b in zip(row[1::2],row[2::2]):
    if b-a>2:out.append({'width':step+1,'points':[[a+1,row[0]],[b-2,row[0]]]})
  return out[:100]
 r=run('paint',strokes=exact_strokes('scm'));check('near-target actual strokes pass',r['result']['passed']);check('wrong function is not completion',not run('function',choice='only')['result']['passed']);check('correct function after painting completes',run('function',choice='function:scm')['result']['passed'])
 check('function alone cannot complete a mesh task',not run('function','tibAnt',choice='function:tibAnt')['result']['passed'])
 check('unavailable mesh has separate function task',run('function','rectusAb',choice='function:rectusAb')['result']['passed'])
 run('reference','tibAnt');check('reference has no completed credit',not any(a['muscle']=='tibAnt' and a['kind']=='function' and a['result']['passed'] for a in p.detail(session['id'])))
 for label,bad in [('bad-points',[{'points':1,'width':3}]),('nonfinite',[{'points':[[float('nan'),3]],'width':3}]),('bad-width',[{'points':[[20,20]],'width':71}]),('bad-erase',[{'points':[[20,20]],'width':3,'erase':'yes'}])]:
  try:p.grade('scm','R',bad);raise AssertionError(label)
  except ServiceError as e:check(label+' rejected422',e.status==422)
 erase=exact_strokes('scm')+[{'width':70,'points':[[x,0],[x,999]],'erase':True} for x in range(0,600,50)]
 check('erasing removes the painted area',not p.grade('scm','R',erase)['passed'])
 request={'session':session,'requestId':'same-id-test','action':'reference','muscle':'biceps','side':'R'}
 p.run(request,token);check('identical retry idempotent',p.run(request,token)[0]['duplicate'])
 try:p.run({**request,'muscle':'triceps'},token);raise AssertionError('conflicting retry')
 except ServiceError as e:check('changed retry rejected409',e.status==409)
 creds=[{'id':session['id'],'token':token}];base={'sessions':creds,'scope':'painting','action':'status'};progress=p.certificate(base);check('partial certificate withheld',not progress['eligible'] and progress['done']==2)
 try:p.certificate({**base,'action':'issue'});raise AssertionError('issued incomplete')
 except ServiceError as e:check('incomplete issue returns409',e.status==409)
 try:p.certificate({**base,'sessions':[{'id':session['id'],'token':'bad'}]});raise AssertionError('bad token')
 except ServiceError as e:check('certificate requires owned sessions',e.status==401)
 other={**session,'id':'painting.other','student':{**student,'studentId':'DIFFERENT'}};other_token=s.learning.start({'session':other},'')['accessToken']
 try:p.certificate({**base,'sessions':creds+[{'id':other['id'],'token':other_token}]});raise AssertionError('mixed owner')
 except ServiceError as e:check('mixed students rejected403',e.status==403)
 def event(t,payload):return {'id':uuid.uuid4().hex,'sessionId':session['id'],'type':t,'at':serve_lab.now(),'payload':payload}
 clinical=[event('clinic3d_choice',{'nodeId':k}) for k in ['history','safety','consent_reply','trial','plan']]+[event('clinic3d_task_completed',{'nodeId':k}) for k in ['arch_compare','muscle_match','alignment','arch_index','static_cop','gait_events']]+[event('clinic3d_evidence_review',{})]
 s.store.save(session,clinical);check('clinic requires reflection',not p.certificate({**base,'scope':'clinic'})['eligible'])
 s.store.save(session,[event('clinic3d_learning_complete',{'reflection':'这是隔离验收资料，仅验证发证条件。'})]);check('clinic full experience eligible',p.certificate({**base,'scope':'clinic'})['eligible'])
 s.store.save(session,[event('clinic3d_communication_reaction',{'nodeId':'history','optionId':'assume_arch','attempts':1,'emotion':'questioning','reply':'隔离测试：请先听我说。'})]);check('unanswered concern blocks clinic certificate',not p.certificate({**base,'scope':'clinic'})['eligible'])
 s.store.save(session,[event('clinic3d_communication_repaired',{'nodeId':'history','optionId':'ask_history','attempts':1})]);check('repaired communication restores completion',p.certificate({**base,'scope':'clinic'})['eligible'])
 lab=[event('lab_observation_saved',{'module':i}) for i in range(1,14)]
 s.store.save(session,lab);check('lab observation alone insufficient',p.certificate({**base,'scope':'lab'})['done']==0)
 s.store.save(session,[event('lab_explanation_saved',{'action':str(i)+'-test','record':{'text':'隔离验收解释'}}) for i in range(1,14)])
 check('lab legacy explanation mapping',p.certificate({**base,'scope':'lab'})['eligible'])
 # Explicit test-only fixture: all actual scores at 100%, followed by function receipts.
 with s.store.connect() as c:
  for k,m in p.catalog['muscles'].items():
   rid='fixture-'+k;c.execute('INSERT OR REPLACE INTO painting_attempts VALUES (?,?,?,?,?,?,?,?)',(session['id'],rid,'function',k,'R','{}',json.dumps({'passed':True,'assisted':False}),serve_lab.now()))
 cert=p.certificate({**base,'action':'issue'});check('100% issues numbered scoped certificate',cert['eligible'] and cert['certificate']['id'].startswith('DXX-'));again=p.certificate({**base,'action':'issue'});check('repeat issue should reuse certificate',again['certificate']['id']==cert['certificate']['id'])
 # HTTP framing / privacy / authenticated student endpoint checks.
 baseurl='http://127.0.0.1:'+str(s.server_address[1]);
 for path in ['/painting/index.html','/lab/index.html']:
  r=urllib.request.urlopen(baseurl+path);check('same-origin embedding:'+path,r.headers['X-Frame-Options']=='SAMEORIGIN')
 try:urllib.request.urlopen(baseurl+'/api/teacher/experience');raise AssertionError('teacher data exposed')
 except urllib.error.HTTPError as e:check('teacher experience private',e.code in (401,403))
 from excel_export import generate,tables
 import zipfile,io,xml.etree.ElementTree as ET
 sheets=tables(s)['sheets'];check('Excel painting rows include scoring',any(t['name']=='肌肉彩绘' and any(r[8]==r[8] and isinstance(r[8],float) for r in t['rows']) for t in sheets))
 check('Excel certificate sheet has issued evidence',any(t['name']=='学习证书' and len(t['rows'])==1 for t in sheets))
 check('Excel preserves reaction and repair separately',any(t['name']=='沟通修正' and len(t['rows'])==2 and [r[6] for r in t['rows']]==['患者质疑','重新回应'] for t in sheets))
 output=(qa/'验收数据_非真实学生.xlsx');b=generate(s,output,(qa/'xlsx-previews'))
 with zipfile.ZipFile(io.BytesIO(b)) as z:
  check('Excel ZIP CRC',z.testzip() is None);xml=z.read('xl/workbook.xml').decode();names={e.attrib['name'] for e in ET.fromstring(xml).findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet')};check('Excel 11 worksheets including communication repair',len(names)==11 and {'沟通修正','肌肉彩绘','学习证书'}.issubset(names))
  check('Excel no private access token',all(token.encode() not in z.read(n) for n in z.namelist()))
 check('teacher API authorized',urllib.request.urlopen(urllib.request.Request(baseurl+'/api/teacher/experience',headers={'X-Teacher-Token':s.teacher_token})).status==200)
 s.shutdown();s.server_close()
(qa/'tests-v25.json').write_text(json.dumps({'passed':True,'checks':results,'count':len(results),'clinicalValidation':False},ensure_ascii=False,indent=2),encoding='utf8')
print('Passed',len(results),'checks')
