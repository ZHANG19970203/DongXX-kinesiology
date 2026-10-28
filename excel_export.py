"""Private teacher-only Excel export, generated from the same persistent report."""
from pathlib import Path
import os,json,tempfile,subprocess
from datetime import datetime,timezone,timedelta
from usage_service import report

LABELS={'act1':'S 病史','act2':'O 关节','act3':'O 肌群','act4':'O 足弓','act5':'O 步态','act6':'O 足压','act7':'O 静态COP','act8':'A/P 判断与计划'}
def when(value):
    if not value:return ''
    try:return datetime.fromisoformat(value.replace('Z','+00:00')).astimezone(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M:%S')
    except (ValueError,TypeError,AttributeError):return str(value)
def text(value):return json.dumps(value,ensure_ascii=False) if isinstance(value,(dict,list)) else value
def tables(server):
    d=report(server,True);sheets=[]
    def add(name,headers,rows,wide=None):
        sheets.append({'name':name,'title':'动小学 · '+name,'note':'导出自本机持久学习数据库；时间为北京时间。未采集不补造；测试/课堂标记见会话表。','headers':headers,'rows':rows,'wideColumns':wide or [],'textColumns':['B']})
    summary=[];sessions=[];modules=[];events=[];chats=[];goals=[];feedback=[]
    for p in d['students']:
        st=p.get('student') or {};matching=[r for r in d['rows'] if r['session']['id'] in p['sessionIds']]
        evaluated=[r['assessmentSummary'].get('latestPost') for r in matching if (r['assessmentSummary'].get('latestPost') or {}).get('complete')]
        latest=max(evaluated,key=lambda a:a.get('receivedAt','')) if evaluated else None
        achieved=sum(bool(o.get('achieved')) for o in latest['objectives']) if latest else None
        summary.append([st.get('name','游客'),st.get('studentId',''),st.get('teacher',''),p['sessions'],round(p['activeSeconds']/60,2),'、'.join(p['modules']),sum(len(c.get('turns',[])) for r in matching for c in r['discussions']),sum(len(r['feedback']) for r in matching),achieved if latest else '未完成后测',achieved/8 if latest else '', '知识后测8目标；不代表13实验临床能力评分'])
    for r in d['rows']:
        se=r['session'];st=se.get('student') or {};who=[st.get('name','游客'),st.get('studentId',''),st.get('teacher',''),se['id']]
        sessions.append(who+[r.get('dataKind',''),when(se.get('startedAt')),round(r['activity']['activeSeconds']/60,2),'、'.join(r['activity']['visitedModules'])])
        for m,t in r['activity']['moduleSeconds'].items():modules.append(who+[LABELS.get(m,m),round(t,3),round(t/60,3)])
        for e in r.get('events',[]):events.append(who+[when(e.get('at') or e.get('receivedAt')),e['type'],text(e['payload'])])
        for c in r['discussions']:
            for t in c.get('turns',[]):chats.append(who+[c.get('objectiveId'),c.get('mode'),when(t.get('receivedAt')),t.get('message'),t.get('reply'),t.get('status'),t.get('provider'),t.get('model'),text(t.get('usage')),text(t.get('retrievedMaterials')),text(t.get('teacherComment'))])
        so=r.get('soap') or {}
        for exchange in so.get('interviews',[]):
            chats.append(who+['SOAP问诊',exchange.get('mode','patient'),when(exchange.get('at')),exchange.get('question'),exchange.get('reply'),'succeeded','siliconflow' if exchange.get('mode')=='deepseek' else 'local',exchange.get('model'),text(exchange.get('usage'))])
        for a in r.get('assessments',[]):
            result=a.get('result') or a.get('result_json') or a
            if not isinstance(result,dict):continue
            for o in result.get('objectives',[]):goals.append(who+[a.get('kind'),when(a.get('receivedAt')),o.get('id') or o.get('objectiveId'),o.get('title'),o.get('correct'),o.get('achieved'),text(o)])
        for f in r['feedback']:feedback.append(who+[when(f.get('receivedAt')),f.get('rating'),f.get('category'),f.get('text'),'使用反馈'])
        for f in r['activity']['problemOutcomes']:feedback.append(who+[when(f.get('at')),'','问题解决自评',text(f.get('payload')),'学生自评'])
    add('学生汇总',['姓名','学号','教师','会话数','有效时间估计分钟','到访模块','问答轮数','反馈数','达成目标数','目标达成率','评价口径'],summary,['F','K'])
    add('学习会话',['姓名','学号','教师','会话ID','数据类别','开始时间','有效时间估计分钟','到访模块'],sessions,['H'])
    add('模块用时',['姓名','学号','教师','会话ID','模块','有效秒数','有效分钟'],modules,['E'])
    add('全部操作',['姓名','学号','教师','会话ID','时间','事件类型','操作详情'],events,['G'])
    add('问答记录',['姓名','学号','教师','会话ID','目标或实验','讨论方式','时间','学生原始问题','AI回复','状态','服务商','模型','用量','参考资料','教师点评'],chats,['H','I'])
    add('知识后测',['姓名','学号','教师','会话ID','测验类型','时间','目标','名称','正确题数','是否达成','原始结果'],goals,['K'])
    add('使用反馈',['姓名','学号','教师','会话ID','时间','评分','类别','内容','来源'],feedback,['H'])
    communication=[]
    for r in d['rows']:
        st=r['session'].get('student') or {}
        for e in r.get('events',[]):
            if e['type'] not in ('clinic3d_communication_reaction','clinic3d_communication_repaired'):continue
            a=e.get('payload') or {};repaired=e['type']=='clinic3d_communication_repaired'
            communication.append([st.get('name','游客'),st.get('studentId',''),st.get('teacher',''),r['session']['id'],when(e.get('receivedAt') or e.get('at')),a.get('nodeId',''),'重新回应' if repaired else '患者质疑',a.get('optionId',''),a.get('attempts',a.get('attempt','')),a.get('emotion',''),a.get('reply',''),'已重新选择合理回应' if repaired else '本次引出质疑','编排情境的沟通练习；不推断品德或临床能力'])
    add('沟通修正',['姓名','学号','教师','会话ID','时间','环节','事件','选项','累计不当选择次数','患者情绪设定','患者回应','本事件状态','评价边界'],communication,['K','M'])
    if hasattr(server,'painting'):
        painted=[];certs=[]
        with server.store.connect() as c:
            for r in c.execute('SELECT a.*,l.identity_json FROM painting_attempts a LEFT JOIN learning_sessions l ON l.session_id=a.session_id ORDER BY a.received_at'):
                st=json.loads(r['identity_json'] or '{}');v=json.loads(r['result_json']);m=server.painting.catalog['muscles'][r['muscle']]
                painted.append([st.get('name',''),st.get('studentId',''),st.get('teacher',''),r['session_id'],when(r['received_at']),m['name'],'人体右侧' if r['side']=='R' else '人体左侧',{'paint':'彩绘','function':'功能辨认','reference':'参考学习'}[r['kind']],v.get('coverage',''),v.get('spill',''),v.get('iou',''),v.get('passed',False),v.get('assisted',False),v.get('feedback','')])
            for r in c.execute('SELECT * FROM experience_certificates ORDER BY issued_at'):
                st=json.loads(r['owner_json']);e=json.loads(r['evidence_json'])
                certs.append([st.get('name',''),st.get('studentId',''),st.get('teacher',''),r['id'],{'painting':'肌肉彩绘23组','clinic':'足踝诊室','lab':'人体运动学13实验','all':'全课程'}[r['scope']],when(r['issued_at']),len(e['items']),len(e['paintingAssistedItems']),r['evidence_hash'],'体验完成100%，不是临床能力认证'])
        add('肌肉彩绘',['姓名','学号','教师','会话ID','时间','肌肉','侧别','操作','覆盖率0至1','外溢率0至1','交并比0至1','是否完成','参考后学习','反馈'],painted,['N'])
        add('学习证书',['姓名','学号','教师','证书编号','完成范围','签发时间','核对项目数','参考学习项数','证据SHA256','说明'],certs,['I','J'])
    sheets.append({'name':'统计说明','title':'记录口径与来源','note':'来源：当前教师受保护接口 /api/teacher/usage?full=1','headers':['项目','说明'],'rows':[['导出时间',when(datetime.now(timezone.utc).isoformat())],['存储方式','本机SQLite数据库；未部署云端'],['时间口径',d['timingDefinition']],['身份口径',d['identityDefinition']],['后测口径',d['achievementDefinition']],['历史范围','旧静态实验记录仍保存在原浏览器；本次恢复后新记录自动同步。仅有本机历史记录且未上报的数据不会出现在服务器导出。'],['13实验评价','实验访问、观察与完成声明分别记录；8目标后测属于足踝知识，不外推为全课程技能评分。']],'wideColumns':['B'],'textColumns':[]})
    return {'sheets':sheets}

def generate(server,save_to=None,previews=None):
    deps=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
    node=Path(os.environ.get('DXX_NODE_EXE',str(deps/'bin/node.exe')))
    if not node.is_file():raise RuntimeError('Excel导出需要Node运行环境，原始JSON导出仍可用。')
    export_dir=server.learning.data_dir/'exports';export_dir.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='xlsx-',dir=export_dir) as tmp:
        src=Path(tmp)/'records.json';dest=Path(tmp)/'records.xlsx'
        src.write_text(json.dumps(tables(server),ensure_ascii=False),encoding='utf-8')
        env={**os.environ,'DXX_NODE_PACKAGES':os.environ.get('DXX_NODE_PACKAGES',str(deps/'node_modules')),'TMP':tmp,'TEMP':tmp}
        args=[str(node),str(server.learning.root/'tools/export-learning.mjs'),str(src),str(dest)]
        if previews:args.append(str(previews))
        try:
            completed=subprocess.run(args,env=env,capture_output=True,timeout=180,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        except subprocess.TimeoutExpired:
            raise RuntimeError('导出超时，请稍后重试或先下载JSON。')
        if completed.returncode or not dest.exists():raise RuntimeError('Excel生成未完成，请使用JSON导出保留记录。')
        data=dest.read_bytes()
        if save_to:Path(save_to).write_bytes(data)
        return data
