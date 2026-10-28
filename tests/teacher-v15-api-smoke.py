"""Teacher UI contract smoke test against an isolated loopback test-data server.

No real API key, classroom database or upstream model request is used.
"""
from __future__ import annotations
import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
os.environ.pop('DEEPSEEK_API_KEY',None)
os.environ.pop('SILICONFLOW_API_KEY',None)
spec=importlib.util.spec_from_file_location('teacher_smoke_server',ROOT/'serve_lab.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
OUTPUT=Path(sys.argv[1] if len(sys.argv)>1 else ROOT.parent.parent/'teacher-v15-api-smoke.json').resolve()
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
bank=json.loads((ROOT/'learning/objectives-v15.json').read_text(encoding='utf-8-sig'))
checks=[];provider_calls=[]
def check(name,value):checks.append({'id':name,'passed':bool(value)})
def forbidden_provider(*args):provider_calls.append(True);raise AssertionError('No upstream calls are permitted in this test')
with tempfile.TemporaryDirectory(prefix='teacher-ui-contract-',dir=OUTPUT.parent) as directory:
    data_dir=Path(directory).resolve()
    if not data_dir.is_relative_to(OUTPUT.parent):raise RuntimeError('Unexpected test data path')
    token='fixture-teacher-token-not-real'
    server=module.create_server(0,data_dir=data_dir,token=token,testing=True,provider_transport=forbidden_provider)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    origin=f'http://127.0.0.1:{server.server_address[1]}'
    def call(path,body=None,teacher=False,learner=None):
        headers={'Origin':origin}
        if teacher:headers['X-Teacher-Token']=token
        if learner:headers['X-Learner-Token']=learner
        if body is not None:headers['Content-Type']='application/json'
        req=Request(origin+path,data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None,headers=headers)
        try:
            with urlopen(req,timeout=10) as r:return r.status,json.loads(r.read())
        except HTTPError as e:
            try:data=json.loads(e.read())
            except (ValueError,UnicodeError):data={}
            return e.code,data
    try:
        status,_=call('/api/teacher/learning');check('teacher-auth-required',status==401)
        status,curriculum=call('/api/learning/curriculum');check('public-curriculum-has-no-answer-key',status==200 and len(curriculum['objectives'])==8 and len(curriculum['items'])==16 and all('correctOption' not in q and 'explanation' not in q for q in curriculum['items']))
        status,_=call('/learning/objectives-v15.json');check('private-bank-not-statically-readable',status in (403,404))
        created=[]
        for sid,student in [('teacher-smoke-registered',{'name':'fixture learner','studentId':'FIXTURE-01','teacher':'fixture teacher'}),('teacher-smoke-guest',None)]:
            session={'id':sid,'caseId':'cai','startedAt':'2026-10-18T02:00:00Z','student':student}
            status,data=call('/api/learning/start',{'session':session});created.append((session,data['accessToken']))
            check(sid+'-marked-test',status==200 and data['dataKind']=='test')
        session,learner=created[0]
        status,_=call('/api/learning/events',{'session':session,'events':[
            {'id':'teacher-smoke-node','sessionId':session['id'],'type':'clinic3d_node','at':'2026-10-18T02:00:00Z','payload':{'nodeId':'welcome'}},
            {'id':'teacher-smoke-complete','sessionId':session['id'],'type':'clinic3d_learning_complete','at':'2026-10-18T02:01:00Z','payload':{'notClinicalSkillAssessment':True}}]})
        check('fixture-events-accepted',status==200)
        for i,(kind,n) in enumerate([('baseline',8),('post',12),('post',14)]):
            answers={q['id']:q['correctOption'] if j<n else next(o['id'] for o in q['options'] if o['id']!=q['correctOption']) for j,q in enumerate(bank['items'])}
            status,result=call('/api/learning/assessment',{'session':session,'requestId':f'teacher-smoke-assessment-{i}','kind':kind,'answers':answers},learner=learner)
            check('actual-assessment-'+str(i),status==200 and result['assessment']['complete'] and result['assessment']['score']['correct']==n)
        guest,guest_token=created[1];first=bank['items'][0]
        status,result=call('/api/learning/assessment',{'session':guest,'requestId':'teacher-smoke-partial','kind':'post','answers':{first['id']:first['correctOption']}},learner=guest_token)
        check('partial-not-complete',status==200 and result['assessment']['complete'] is False and result['assessment']['score']['rate'] is None)
        status,_=call('/api/learning/discussion',{'session':session,'requestId':'teacher-smoke-no-ai','objectiveId':'O1','mode':'deepen','message':'Fixture discussion for teacher record review.','consent':True},learner=learner)
        check('unconfigured-ai-fails-honestly',status==503 and not provider_calls)
        status,_=call('/api/learning/feedback',{'session':session,'requestId':'teacher-smoke-feedback','rating':4,'category':'usability','text':'Fixture feedback, not classroom data.','consent':True},learner=learner);check('feedback-stored',status==200)
        status,overview=call('/api/teacher/learning',teacher=True)
        registered=next(r for r in overview['sessions'] if r['identityKind']=='registered');summary=registered['assessmentSummary']
        check('overview-session-and-test-schema',status==200 and len(overview['sessions'])==2 and all(r['dataKind']=='test' for r in overview['sessions']) and overview['cohorts']['classroom']['summary']['eligibleSessions']==0)
        check('first-latest-baseline-preserved',summary['baseline']['score']['correct']==8 and summary['firstPost']['score']['correct']==12 and summary['latestPost']['score']['correct']==14)
        check('registered-dedup-summary-available',len(overview['registeredLearners'])==1 and overview['registeredSummary']['test']['completePostLearners']==1)
        check('activity-counts-received-events-not-ai',registered['activity']['eventCount']==2 and registered['activity']['learningCompleteCount']==1 and registered['activity']['firstReceivedAt'] is not None and registered['activity']['lastReceivedAt']>=registered['activity']['firstReceivedAt'])
        check('post-partial-attempt-count-available',next(r for r in overview['sessions'] if r['identityKind']=='guest')['assessmentSummary']['postPartialAttempts']==1)
        status,detail=call('/api/teacher/learning?sessionId='+session['id'],teacher=True)
        check('detail-has-original-question-failure-feedback',status==200 and len(detail['conversations'])==1 and detail['conversations'][0]['messages'][0]['text']=='Fixture discussion for teacher record review.' and detail['conversations'][0]['requests'][0]['status']=='failed' and detail['feedback'][0]['rating']==4)
        status,config=call('/api/teacher/ai-config',teacher=True);check('no-key-no-live-state',status==200 and config['configured'] is False and config['liveVerified'] is False)
        check('provider-contract-keeps-both-platforms',set(config.get('allowedProviders',[]))=={'deepseek','siliconflow'} and {p['id'] for p in config.get('providers',[])}=={'deepseek','siliconflow'})
        fixture_key='sk-fixture-only-not-a-real-key-000'
        status,config=call('/api/teacher/ai-config',{'apiKey':fixture_key,'model':'deepseek-flash','enabled':False},teacher=True)
        check('local-config-does-not-return-secret-or-connect',status==200 and config['configured'] and fixture_key not in json.dumps(config) and not provider_calls and config['liveVerified'] is False)
        status,config=call('/api/teacher/ai-config',{'provider':'siliconflow','model':'deepseek-ai/DeepSeek-V4.1-Flash','enabled':False},teacher=True)
        check('siliconflow-exact-model-fixed-endpoint',status==200 and config.get('provider')=='siliconflow' and config.get('model')=='deepseek-ai/DeepSeek-V4.1-Flash' and config.get('endpoint')=='https://api.siliconflow.cn/v1/chat/completions')
        check('platform-switch-does-not-reuse-other-platform-key',config.get('configured') is False and config.get('liveVerified') is False)
        sf_fixture='sk-siliconflow-fixture-not-a-real-key-000'
        status,config=call('/api/teacher/ai-config',{'provider':'siliconflow','model':'deepseek-ai/DeepSeek-V4.1-Flash','apiKey':sf_fixture,'enabled':False},teacher=True)
        check('siliconflow-fixture-secret-not-returned-or-tested',status==200 and config.get('configured') is True and sf_fixture not in json.dumps(config) and not provider_calls)
        status,config=call('/api/teacher/ai-config',{'provider':'deepseek','model':'deepseek-v4-pro','enabled':False},teacher=True)
        check('official-platform-models-preserved',status==200 and config.get('provider')=='deepseek' and config.get('model')=='deepseek-v4-pro' and config.get('configured') is False and 'deepseek-flash' in config.get('allowedModels',[]))
        status,config=call('/api/teacher/ai-config',{'clearKey':True,'enabled':False},teacher=True);check('fixture-key-cleared',status==200 and config['configured'] is False)
        check('zero-upstream-provider-calls',not provider_calls)
    finally:
        server.shutdown();server.server_close();thread.join(timeout=3)
report={'schema':'dxx-teacher-v15-api-smoke','passed':all(x['passed'] for x in checks),'total':len(checks),'passedCount':sum(x['passed'] for x in checks),'checks':checks,'upstreamRequests':len(provider_calls),'scope':'Real local HTTP API against an isolated testing=True server and temporary database, fixture-only identities, assessments, feedback and invalid key. No classroom state or real DeepSeek requests. Temporary database/config removed after shutdown.'}
OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report['passed']:raise SystemExit(1)
