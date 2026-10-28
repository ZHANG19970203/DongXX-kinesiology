import sys,tempfile,uuid,json,hashlib
from pathlib import Path
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root))
import serve_lab
from learning_service import ServiceError
checks=[]
def check(name,condition):
 assert condition,name
 checks.append(name)
with tempfile.TemporaryDirectory() as temp:
 server=serve_lab.create_server(0,Path(temp),testing=True)
 session={'id':'qa28.'+uuid.uuid4().hex,'caseId':'cai','startedAt':serve_lab.now(),'student':{'name':'隔离验收','studentId':'QA28','teacher':'张积众'}}
 token=server.learning.start({'session':session},'')['accessToken']
 request={'session':session,'requestId':uuid.uuid4().hex,'action':'paint','muscle':'scm','strokes':[{'points':[[20,20]],'width':4}]}
 for side in [None,'','X']:
  try:server.painting.run({**request,**({'side':side} if side is not None else {})},token);raise AssertionError('invalid side accepted')
  except ServiceError as e:check('side required '+str(side),e.status==422)
 mask=server.painting.catalog['muscles']['scm']['masks']['R'];strokes=[]
 for row in mask['rows'][::2]:
  for a,b in zip(row[1::2],row[2::2]):
   if b-a>2:strokes.append({'width':3,'points':[[a+1,row[0]],[b-2,row[0]]]})
 check('right target passes on right',server.painting.grade('scm','R',strokes[:100])['passed'])
 check('same drawing does not pass on left',not server.painting.grade('scm','L',strokes[:100])['passed'])
 server.store.save(session,[{'id':str(uuid.uuid4()),'sessionId':session['id'],'type':'orthosis_design_saved','at':serve_lab.now(),'payload':{'module':'矫形鞋垫设计','source':'合成教学模型，非临床测量','settings':{'height':1,'target':'arch'},'reflection':'隔离验收示例'}}])
 from excel_export import tables
 sheets=tables(server)['sheets'];check('orthosis details available in teacher export', 'orthosis_design_saved' in json.dumps(sheets,ensure_ascii=False))
 server.server_close()
old=Path('D:/CodexDeliveries/dongxiaoxue/20261027-v27/site/pressure/data')
check('public source recordings unchanged',all((root/'pressure/data'/p.relative_to(old)).read_bytes()==p.read_bytes() for p in old.rglob('*') if p.is_file()))
print(json.dumps({'passed':True,'checks':checks},ensure_ascii=False))
