"""Verify authored case contracts, references and segregation from measured data."""
from pathlib import Path
from collections import Counter
import json
import sys

root=Path(__file__).resolve().parents[1]
data=json.loads((root/'clinic/cases.json').read_text(encoding='utf-8-sig'))
issues=[]
def check(ok,msg):
    if not ok:issues.append(msg)
cases=data.get('cases',[])
check(len(cases)==4,'Expected exactly four authored teaching cases')
check({c.get('id') for c in cases}=={'cai','flatfoot','cavus','sprain'},'Unexpected case IDs')
sources=data.get('sources',[])
source_ids={s.get('id') for s in sources}
check(len(source_ids)==len(sources),'Duplicate source IDs')
for s in sources:
    check(str(s.get('url','')).startswith('https://'),f"Source URL missing: {s.get('id')}")
counts={}
for case in cases:
    cid=case.get('id')
    check(all(case.get('patient',{}).get(k) for k in ['name','age','occupation','chief','goal','concern']),f'{cid}: incomplete patient story')
    for key,minimum in [('questions',10),('exams',4),('evidence',3)]:
        group=case.get(key,[])
        check(len(group)>=minimum,f'{cid}: too few {key}')
        ids=[item.get('id') for item in group]
        check(len(ids)==len(set(ids)) and all(ids),f'{cid}: duplicate/missing {key} IDs')
    for q in case.get('questions',[]):
        check(q.get('category') in ['symptoms','history','function','goals','safety'],f'{cid}: unknown interview group')
        check(all(isinstance(q.get(k),str) and q[k].strip() for k in ['label','answer','why']),f'{cid}: incomplete interview item {q.get("id")}')
        check(type(q.get('essential')) is bool,f'{cid}: essential is not a boolean')
    check(any(q.get('category')=='safety' and q.get('essential') for q in case.get('questions',[])),f'{cid}: no essential safety question')
    for exam in case.get('exams',[]):
        check(all(exam.get(k) for k in ['label','purpose','consentPrompt','patientConcern','explanation','result','interpretation','reason']),f'{cid}: incomplete examination communication')
        check(type(exam.get('appropriate')) is bool,f'{cid}: inappropriate examination flag')
    check(any(not e.get('appropriate') for e in case.get('exams',[])),f'{cid}: missing examination-selection feedback')
    for evidence in case.get('evidence',[]):
        check(evidence.get('kind') in ['fictional','literature','public-practice'],f'{cid}: unknown evidence provenance')
        check(set(evidence.get('sourceIds',[]))<=source_ids,f'{cid}: unknown evidence source')
        check(not any(k in evidence for k in ['frames','copX','copY','rawValues','pressureGrid']),f'{cid}: unexpected fabricated pressure time series')
    for key,child in [('explanation','points'),('plan','options')]:
        options=case.get(key,{}).get(child,[])
        check(len(options)>=4,f'{cid}: insufficient {key} options')
        check(any(o.get('appropriate') for o in options) and any(not o.get('appropriate') for o in options),f'{cid}: feedback options incomplete')
        check(len({o.get('id') for o in options})==len(options),f'{cid}: duplicate {key} IDs')
    check(bool(case.get('review',{}).get('limitations')),f'{cid}: review limits absent')
    counts[cid]={k:len(case.get(k,[])) for k in ['questions','exams','evidence']}
result={'status':'passed' if not issues else 'failed','cases':counts,'sources':len(sources),'issues':issues,
        'scope':'Contract/provenance consistency checks only; clinical expert approval is still pending.'}
print(json.dumps(result,ensure_ascii=False,indent=2))
sys.exit(bool(issues))
