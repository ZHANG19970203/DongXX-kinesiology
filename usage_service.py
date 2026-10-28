"""Read-only auditable activity aggregation. No client event grants a grade."""
from datetime import datetime
from collections import defaultdict
import json

def seconds(value):
    return datetime.fromisoformat(value.replace('Z','+00:00')).timestamp()

def valid_interval(payload):
    try:
        a,b=seconds(payload['from']),seconds(payload['to'])
        if not 0 < b-a <= 30 or abs((b-a)-float(payload['seconds']))>.1:
            return None
        if payload.get('method')!='visible_recent_input_120s_v23':return None
        if not isinstance(payload.get('module'),str) or len(payload['module'])>120:return None
        return a,b
    except (ValueError,TypeError,KeyError,AttributeError,OverflowError):return None

def union_seconds(intervals):
    total=0.;end=None
    for a,b in sorted(intervals):
        total+=max(0,b-max(a,end if end is not None else a));end=max(b,end if end is not None else b)
    return round(total,3)

def activity(events):
    all_intervals=[];modules=defaultdict(list);visits=set();actions=[];resolved=[]
    for e in events:
        p=e['payload'];kind=e['type']
        if kind=='learning_active_interval':
            v=valid_interval(p)
            if v:all_intervals.append(v);modules[p['module']].append(v)
        if kind in ('clinic3d_node','soap_stage_open','lab_module_open','learning_module_open'):
            visits.add(str(p.get('act') or p.get('task') or p.get('module') or '未标注'))
        if kind in ('clinic3d_concept_open','clinic3d_case_evidence_read','clinic3d_evidence_review','clinic3d_task_completed','clinic3d_choice','soap_reasoning_choice','soap_task_review','lab_operation','lab_observation_saved','lab_explanation_saved','lab_embedded_record','learning_module_action','painting_paint','painting_function','painting_reference','clinic3d_free_study_open','clinic3d_free_study_return','clinic3d_communication_reaction','clinic3d_communication_repaired'):
            actions.append(e)
        if kind=='learning_problem_outcome':resolved.append(e)
    return {'activeSeconds':union_seconds(all_intervals),'moduleSeconds':{k:union_seconds(v) for k,v in modules.items()},'visitedModules':sorted(visits),'actions':actions,'problemOutcomes':resolved,'intervals':all_intervals}

def report(server,full=False):
    with server.store.connect() as c:
        ids=[r[0] for r in c.execute('SELECT id FROM sessions ORDER BY updated_at DESC,id')]
    rows=[];people={}
    for sid in ids:
        raw=server.store.detail(sid);d=server.learning.detail(sid);a=activity(raw['events']);s=d['session'];student=s.get('student') or {}
        key=(student.get('teacher',''),student.get('studentId','')) if student.get('studentId') else ('guest',sid)
        bucket=people.setdefault(key,{'student':student,'sessions':0,'sessionIds':[],'intervals':[],'modules':set(),'registered':bool(student.get('studentId'))})
        bucket['sessionIds'].append(sid)
        bucket['sessions']+=1;bucket['intervals'].extend(a['intervals']);bucket['modules'].update(a['visitedModules'])
        a.pop('intervals')
        row={'session':s,'activity':a,'assessmentSummary':d['assessmentSummary'],'discussions':d['conversations'],'feedback':d['feedback'],'soap':d['soap'],'dataKind':d['dataKind']}
        if hasattr(server,'painting'):row['painting']=server.painting.detail(sid)
        if full:row['events']=raw['events'];row['assessments']=d['assessments']
        rows.append(row)
    students=[]
    for p in people.values():students.append({'student':p['student'],'sessions':p['sessions'],'sessionIds':p['sessionIds'],'activeSeconds':union_seconds(p['intervals']),'modules':sorted(p['modules']),'registered':p['registered']})
    return {'schema':'dxx-traceability-v23','storage':str(server.store.path),'localOnly':True,'registeredStudents':sum(p['registered'] for p in students),'guestSessions':sum(not p['registered'] for p in students),'sessionCount':len(rows),'students':students,'rows':rows,'timingDefinition':'页面可见且最近120秒有点击/键盘/滚轮输入的时段估计。10秒采样；切后台停止。同一学生重叠时段取并集。旧版本未采集的时长不补造；不等于注意力或临床能力。','identityDefinition':'学生自行填写姓名/学号/教师，同教师+学号合并；并非学校认证。教师工号026870配合专用密码验证，教师会话与学生入口分开。学生登记尚非学校学籍认证。','achievementDefinition':'正式知识后测8目标各2题，以服务端评分为准；浏览、资料阅读、视频播放和AI聊天不增加目标达成率。未参加后测显示未评。'}
