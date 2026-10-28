from pathlib import Path
import sys,unittest,tempfile,threading,json,urllib.request,urllib.error,uuid
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from usage_service import activity,valid_interval,union_seconds
import serve_lab
class UsageTests(unittest.TestCase):
 def test_union(self):self.assertEqual(union_seconds([(0,10),(4,15),(20,25),(0,10)]),20)
 def test_invalid(self):
  for p in [{},{'from':'x','to':'y'},{'from':'2026-10-26T00:00:00Z','to':'2026-10-26T00:01:00Z','seconds':60,'module':'act1','method':'visible_recent_input_120s_v23'}]:self.assertIsNone(valid_interval(p))
 def test_activity_modules_and_duplicates(self):
  def e(a,b,m):return {'type':'learning_active_interval','payload':{'from':f'2026-10-26T00:00:{a:02d}Z','to':f'2026-10-26T00:00:{b:02d}Z','seconds':b-a,'module':m,'method':'visible_recent_input_120s_v23'}}
  v=activity([e(0,10,'act1'),e(5,15,'act2'),e(0,10,'act1')]);self.assertEqual(v['activeSeconds'],15);self.assertEqual(v['moduleSeconds'],{'act1':10,'act2':10})
 def test_legacy_no_fabricated_time(self):self.assertEqual(activity([{'type':'clinic3d_node','payload':{'act':'act3'}}])['activeSeconds'],0)
class HTTPTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory();cls.server=serve_lab.create_server(0,cls.temp.name,testing=True);cls.port=cls.server.server_port
  # create_server origin list is derived from requested port; ephemeral test corrects it.
  cls.server.allowed_origins={f'http://127.0.0.1:{cls.port}',f'http://localhost:{cls.port}'}
  cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
 @classmethod
 def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.temp.cleanup()
 def request(self,path,token=None,data=None):
  h={'Content-Type':'application/json'}
  if token:h['X-Teacher-Token']=token
  req=urllib.request.Request(f'http://127.0.0.1:{self.port}'+path,headers=h,data=json.dumps(data).encode() if data else None)
  try:
   with urllib.request.urlopen(req) as r:return r.status,json.load(r)
  except urllib.error.HTTPError as e:return e.code,json.load(e)
 def test_private_usage_denies_public(self):self.assertEqual(self.request('/api/teacher/usage')[0],401)
 def test_private_usage_accepts_existing_capability(self):self.assertEqual(self.request('/api/teacher/usage',self.server.teacher_token)[0],200)
 def test_duplicate_event_export(self):
  sid='test23.'+uuid.uuid4().hex;stamp='2026-10-26T00:00:00Z';session={'id':sid,'caseId':'cai','startedAt':stamp,'student':{'name':'合成验收','studentId':'QA23','teacher':'验收'}}
  event={'id':'event.'+uuid.uuid4().hex,'sessionId':sid,'type':'learning_active_interval','at':stamp,'payload':{'from':stamp,'to':'2026-10-26T00:00:10Z','seconds':10,'module':'act1','method':'visible_recent_input_120s_v23'}}
  batch={'session':session,'events':[event]};self.assertEqual(self.request('/api/learning/events',data=batch)[0],200);self.assertEqual(self.request('/api/learning/events',data=batch)[1]['duplicates'],1)
  status,r=self.request('/api/teacher/usage?full=1',self.server.teacher_token);self.assertEqual(status,200);row=next(x for x in r['rows'] if x['session']['id']==sid);self.assertEqual(row['activity']['activeSeconds'],10);self.assertEqual(len(row['events']),1)
 def test_bad_duration_rejected(self):
  sid='test23.'+uuid.uuid4().hex;batch={'session':{'id':sid,'caseId':'cai','startedAt':'2026-10-26T00:00:00Z','student':None},'events':[{'id':sid+'.e','sessionId':sid,'type':'learning_active_interval','at':'2026-10-26T00:00:00Z','payload':{'seconds':9999}}]};self.assertEqual(self.request('/api/learning/events',data=batch)[0],422)
if __name__=='__main__':unittest.main(verbosity=2)
