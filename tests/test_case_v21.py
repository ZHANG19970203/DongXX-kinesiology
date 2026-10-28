"""Fictional teaching case and local HTTP checks; no provider requests."""
import sys,json,unittest,tempfile,threading,http.client
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import serve_lab
from soap_service import FACTS,local_pick

class CaseV21(unittest.TestCase):
 def test_patient_details(self):
  self.assertEqual(local_pick('什么时候最疼，是什么感觉？'),['pain_quality'])
  self.assertEqual(local_pick('什么时候会打软腿？'),['giving_way'])
  self.assertEqual(local_pick('希望恢复什么活动？'),['goal'])
  self.assertIn('跑步',FACTS['goal'][1]);self.assertNotIn('篮球',str(FACTS));self.assertNotIn('打球',str(FACTS))
  self.assertEqual(local_pick('是不是扁平足导致崴脚？'),['diagnosis'])
 def test_portrait_dialogue_matches_fixed_case(self):
  d=json.loads((serve_lab.ROOT/'soap/interview-dialogue.json').read_text(encoding='utf-8'))
  patient=[t['text'] for t in d['turns'] if t['speaker']=='patient']
  self.assertEqual(patient,[FACTS[k][1] for k in ['pain_quality','giving_way','goal']])
 def test_single_range_media(self):
  with tempfile.TemporaryDirectory(dir='D:/CodexRuntime/clinic-v21') as tmp:
   server=serve_lab.create_server(0,tmp,testing=True)
   thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
   try:
    p=serve_lab.ROOT/'soap/media/intro-playback.mp4';size=p.stat().st_size
    for requested,status,length,offset in [('bytes=0-1023',206,1024,0),('bytes=-128',206,128,size-128),(f'bytes={size}-',416,0,0),('bytes=3-2',416,0,0),('bytes=0-2,4-8',416,0,0)]:
     c=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=10);c.request('GET','/soap/media/intro-playback.mp4',headers={'Range':requested});r=c.getresponse();data=r.read();self.assertEqual(r.status,status);self.assertEqual(len(data),length)
     if status==206:
      self.assertEqual(r.getheader('Accept-Ranges'),'bytes')
      with p.open('rb') as f:f.seek(offset);self.assertEqual(data,f.read(length))
     c.close()
   finally:server.shutdown();server.server_close();thread.join(timeout=2)

if __name__=='__main__':unittest.main()
