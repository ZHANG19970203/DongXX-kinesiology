"""Verify a local migration release. Python 3.9+, Node.js for executable JS checks.

Usage: python tools/verify.py [--archive ../release.zip] [--output result.json]
Optional: --html5lib-path <folder containing html5lib> enables HTML5 conformance parsing.
The release pipeline uses html5lib 1.1; without it, stdlib HTML structure checks still run.
"""
from pathlib import Path, PurePosixPath
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import argparse, hashlib, json, re, shutil, struct, subprocess, sys, tempfile, zipfile, mmap

parser=argparse.ArgumentParser()
parser.add_argument('--root',default=str(Path(__file__).resolve().parents[1]))
parser.add_argument('--archive')
parser.add_argument('--output')
parser.add_argument('--html5lib-path')
args=parser.parse_args();root=Path(args.root).resolve()
if args.html5lib_path:sys.path.insert(0,str(Path(args.html5lib_path).resolve()))
try:import html5lib
except ImportError:html5lib=None
issues=[];checks={};htmls={};scripts=[];refs=[];importmaps={};module_sources=[]
def require(ok,msg):
    if not ok:issues.append(msg)
def sha(data):return hashlib.sha256(data).hexdigest()

class InspectHTML(HTMLParser):
    void=set('area base br col embed hr img input link meta param source track wbr'.split())
    def __init__(self,path):super().__init__(convert_charrefs=True);self.path=path;self.stack=[];self.ids=set();self.in_script=False;self.code=[];self.script_type=''
    def handle_starttag(self,tag,attrs):
        at=dict(attrs)
        if 'id' in at:
            require(at['id'] not in self.ids,f'{self.path}: duplicate id {at["id"]}');self.ids.add(at['id'])
        for key in ['src','href','poster']:
            if at.get(key):refs.append((self.path,at[key]))
        if at.get('srcset'):
            for val in at['srcset'].split(','):refs.append((self.path,val.strip().split()[0]))
        if tag=='script':
            self.in_script=True;self.code=[];self.script_type=at.get('type','').strip().lower()
            if self.script_type=='module' and at.get('src'):module_sources.append((self.path,at['src']))
        if tag not in self.void:self.stack.append(tag)
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag not in self.void:self.handle_endtag(tag)
    def handle_data(self,data):
        if self.in_script:self.code.append(data)
    def handle_endtag(self,tag):
        if tag=='script':
            self.in_script=False
            if ''.join(self.code).strip():scripts.append((self.path,''.join(self.code),self.script_type))
        require(bool(self.stack) and self.stack[-1]==tag,f'{self.path}: unexpected closing {tag}')
        if self.stack and self.stack[-1]==tag:self.stack.pop()

for file in sorted(root.rglob('*.html')):
    name=file.relative_to(root).as_posix();data=file.read_text('utf-8-sig');p=InspectHTML(name)
    try:p.feed(data);p.close();require(not p.stack,f'{name}: unclosed tags {p.stack}')
    except Exception as e:issues.append(f'{name}: HTML parse: {e}')
    htmls[name]=p
    if html5lib:
        hp=html5lib.HTMLParser();hp.parse(data)
        for position,code,details in hp.errors:issues.append(f'{name}:{position}: HTML5 {code} {details}')
checks['html']={'files':len(htmls),'engine':'html5lib '+html5lib.__version__+' and stdlib structure' if html5lib else 'stdlib structure only'}

for name,ref in refs:
    u=urlsplit(ref)
    if u.scheme or u.netloc or ref.startswith(('data:','mailto:','tel:')):continue
    target=(root/name).parent/unquote(u.path) if u.path else root/name
    target=target.resolve()
    require(target.is_relative_to(root),f'{name}: escaping reference {ref}')
    if target.is_dir():target=target/'index.html' # Normal static-server directory index URL.
    require(target.is_file(),f'{name}: missing reference {ref}')
    if target.is_file() and u.fragment and target.suffix=='.html':
        rel=target.relative_to(root).as_posix()
        require(u.fragment in htmls.get(rel,InspectHTML(rel)).ids,f'{name}: missing fragment {ref}')
checks['htmlReferences']=len(refs)

def local_module_target(base_name,reference):
    """Resolve a local browser URL; None means an external URL, not a file."""
    u=urlsplit(reference)
    if u.scheme or u.netloc:return None
    part=unquote(u.path)
    target=(root/part.lstrip('/')) if part.startswith('/') else (root/base_name).parent/part
    if not part:target=root/base_name
    target=target.resolve()
    require(target.is_relative_to(root),f'{base_name}: escaping module reference {reference}')
    return target if target.is_relative_to(root) else None

js_types={'','module','text/javascript','application/javascript','text/ecmascript','application/ecmascript'}
executable_scripts=[];importmap_count=0;data_script_count=0
for name,code,kind in scripts:
    if kind=='importmap':
        importmap_count+=1
        try:document=json.loads(code)
        except Exception as e:issues.append(f'{name}: importmap JSON {e}');continue
        if not isinstance(document,dict):issues.append(f'{name}: importmap must be an object');continue
        imports=document.get('imports',{});scopes=document.get('scopes',{})
        require(isinstance(imports,dict),f'{name}: importmap imports must be an object')
        require(isinstance(scopes,dict),f'{name}: importmap scopes must be an object')
        if not isinstance(imports,dict) or not isinstance(scopes,dict):continue
        normalized_scopes={}
        mappings=[('imports',imports)]
        for scope,values in scopes.items():
            if not isinstance(scope,str) or not isinstance(values,dict):
                issues.append(f'{name}: invalid importmap scope {scope}');continue
            scope_target=local_module_target(name,scope)
            if scope_target is not None:
                normalized_scopes['/'+scope_target.relative_to(root).as_posix()+('/' if scope.endswith('/') else '')]=values
            mappings.append(('scope '+scope,values))
        for section,values in mappings:
            for key,address in values.items():
                require(isinstance(key,str) and bool(key),f'{name}: empty importmap key in {section}')
                if address is None:continue # A null entry deliberately blocks this specifier.
                if not isinstance(address,str):issues.append(f'{name}: invalid importmap address {key}');continue
                require(bool(urlsplit(address).scheme or address.startswith(('./','../','/'))),f'{name}: importmap address is not a URL {address}')
                if key.endswith('/'):require(address.endswith('/'),f'{name}: importmap prefix {key} must map to a directory URL')
                target=local_module_target(name,address)
                if target is not None:
                    require(target.is_dir() if key.endswith('/') else target.is_file(),f'{name}: missing importmap {"directory" if key.endswith("/") else "file"} {address}')
        previous=importmaps.setdefault(name,{'imports':{},'scopes':{}})
        previous['imports'].update(imports);previous['scopes'].update(normalized_scopes)
    elif kind in js_types:executable_scripts.append((name,code,kind))
    else:data_script_count+=1
checks['importmaps']={'blocks':importmap_count,'documents':len(importmaps),'engine':'json.loads and local file/directory checks'}

node=shutil.which('node');require(bool(node),'Node.js is required for JS syntax checks')
jsfiles=sorted([*root.rglob('*.js'),*root.rglob('*.cjs'),*root.rglob('*.mjs')])
if node:
    for file in jsfiles:
        run=subprocess.run([node,'--check',str(file)],capture_output=True,text=True,encoding='utf-8')
        require(run.returncode==0,f'{file.relative_to(root)}: JS parse {run.stderr[:600]}')
    with tempfile.TemporaryDirectory() as td:
        for i,(name,code,kind) in enumerate(executable_scripts):
            file=Path(td)/f'inline-{i}.{ "mjs" if kind=="module" else "js" }';file.write_text(code,'utf-8')
            run=subprocess.run([node,'--check',str(file)],capture_output=True,text=True,encoding='utf-8')
            require(run.returncode==0,f'{name}: inline JS parse {run.stderr[:600]}')
checks['javascript']={'files':len(jsfiles),'inlineBlocks':len(executable_scripts),'dataBlocksSkipped':data_script_count,'engine':'node --check' if node else 'unavailable'}

# Ask Node's module parser for static dependencies. This does not execute code,
# and correctly ignores comments, quoted examples and dynamic import(expr).
# A regular-expression scan would mistake these for missing resource files.
module_records=[{'id':f.relative_to(root).as_posix(),'base':f.relative_to(root).as_posix(),'source':f.read_text('utf-8-sig')} for f in jsfiles]
for i,(name,code,kind) in enumerate(executable_scripts):
    if kind=='module':module_records.append({'id':f'{name}#inline-module-{i}','base':name,'source':code})
module_dependencies={};module_bases={r['id']:r['base'] for r in module_records}
if node:
    extractor="""const fs=require('node:fs'),vm=require('node:vm');
const records=JSON.parse(fs.readFileSync(0,'utf8'));
const out=records.map(r=>{try{const m=new vm.SourceTextModule(r.source,{identifier:r.id});
return {id:r.id,dependencies:Array.from(m.dependencySpecifiers)};
}catch(e){return {id:r.id,error:e.message};}});process.stdout.write(JSON.stringify(out));"""
    run=subprocess.run([node,'--experimental-vm-modules','-e',extractor],input=json.dumps(module_records,ensure_ascii=False),capture_output=True,text=True,encoding='utf-8')
    require(run.returncode==0,'Static module dependency extraction failed: '+run.stderr[:600])
    if run.returncode==0:
        try:
            for item in json.loads(run.stdout):
                if item.get('error'):issues.append(f'{item["id"]}: module dependency parse {item["error"]}')
                else:module_dependencies[item['id']]=item['dependencies']
        except Exception as e:issues.append('Static module dependency report: '+str(e))

def mapped_address(page,specifier,importer):
    document=importmaps.get(page,{})
    importer_url='/'+importer
    choices=[values for scope,values in sorted(document.get('scopes',{}).items(),key=lambda x:len(x[0]),reverse=True) if importer_url.startswith(scope)]
    choices.append(document.get('imports',{}))
    for values in choices:
        if specifier in values:return True,values[specifier]
        keys=[key for key in values if key.endswith('/') and specifier.startswith(key)]
        if keys:
            key=max(keys,key=len);address=values[key]
            return True,address+specifier[len(key):] if isinstance(address,str) else None
    return False,None

def is_bare(specifier):
    u=urlsplit(specifier)
    return not (u.scheme or u.netloc or specifier.startswith(('./','../','/')))

validated=set();contextual_modules=set();pending=[]
def check_module_reference(identifier,specifier,page=None):
    base=module_bases.get(identifier,identifier)
    key=(identifier,specifier,page)
    if key in validated:return None
    validated.add(key)
    address=specifier
    if specifier.startswith('node:'):return None
    if is_bare(specifier):
        found,address=mapped_address(page,specifier,base)
        require(found,f'{identifier}: unresolved bare module {specifier}'+(f' in {page}' if page else ''))
        if not found:return None
        require(isinstance(address,str),f'{identifier}: importmap blocks module {specifier}')
        if not isinstance(address,str):return None
        base=page
    target=local_module_target(base,address)
    if target is not None:
        require(target.is_file(),f'{identifier}: missing module reference {specifier}'+(f' -> {address}' if address!=specifier else ''))
        if target.is_file():return target.relative_to(root).as_posix()
    return None

# Local relative imports are checked even in JS files not reached from HTML.
for identifier,dependencies in module_dependencies.items():
    for specifier in dependencies:
        if not is_bare(specifier):check_module_reference(identifier,specifier)
for page,src in module_sources:
    target=local_module_target(page,src)
    if target is not None and target.is_file():pending.append((target.relative_to(root).as_posix(),page))
for record in module_records:
    if '#inline-module-' in record['id']:pending.append((record['id'],record['base']))
while pending:
    identifier,page=pending.pop()
    if (identifier,page) in contextual_modules:continue
    contextual_modules.add((identifier,page))
    for specifier in module_dependencies.get(identifier,[]):
        dependency=check_module_reference(identifier,specifier,page)
        if dependency in module_dependencies:pending.append((dependency,page))

# A vendor module may be shipped without an HTML entry point. Its bare imports
# still need a matching supplied importmap; do not guess a Node package path.
reached={identifier for identifier,page in contextual_modules}
for identifier,dependencies in module_dependencies.items():
    if identifier in reached:continue
    for specifier in dependencies:
        if not is_bare(specifier) or specifier.startswith('node:'):continue
        candidates=[page for page in importmaps if mapped_address(page,specifier,module_bases[identifier])[0]]
        if candidates:check_module_reference(identifier,specifier,candidates[0])
        else:require(False,f'{identifier}: unresolved bare module {specifier}; no supplied importmap')
checks['moduleReferences']={'staticSpecifiers':sum(map(len,module_dependencies.values())),'parsedFilesAndInlineModules':len(module_dependencies),'htmlModuleContexts':len(contextual_modules),'engine':'Node vm.SourceTextModule static dependency parser; relative URLs and supplied importmaps','dynamicImports':'Expressions and generated URLs are not treated as static file references'}

for file in root.rglob('*.json'):
    try:json.loads(file.read_text('utf-8-sig'))
    except Exception as e:issues.append(f'{file.relative_to(root)}: JSON {e}')

catalog=(root/'assembly/assets/catalog.js').read_text('utf-8-sig')
catalog=json.loads(catalog.split('=',1)[1].strip().rstrip(';'))
manifest=json.loads((root/'assembly/assets/geometry-manifest.json').read_text('utf-8-sig'))
# Stream the same full chunk and combined digests; avoid duplicating all geometry
# and millions of Python integer objects on machines with little free memory.
cursor=0;combined=hashlib.sha256();geometry_temp=tempfile.TemporaryFile(dir=root.parent)
for ch in manifest['chunks']:
    require(ch['offset']==cursor,'Geometry chunk offsets are not contiguous')
    digest=hashlib.sha256();length=0
    with (root/'assembly'/ch['path']).open('rb') as chunk:
        while block:=chunk.read(1024*1024):
            digest.update(block);combined.update(block);geometry_temp.write(block);length+=len(block)
    require(length==ch['bytes'],'Geometry chunk length mismatch');require(digest.hexdigest()==ch['sha256'],'Geometry chunk hash mismatch');cursor+=length
geometry_temp.flush();geometry_map=mmap.mmap(geometry_temp.fileno(),0,access=mmap.ACCESS_READ);raw=memoryview(geometry_map)
require(len(raw)==manifest['bytes'],'Geometry total length mismatch');require(combined.hexdigest()==manifest['sha256'],'Geometry combined hash mismatch')
for key,a in catalog['assets'].items():
    for field,count in [('positions',a['vertexCount']*3),('normals',a['vertexCount']*3),('indices',a['indexCount'])]:
        require(a[field]%4==0 and a[field]+count*4<=len(raw),f'{key}: geometry offset out of range')
    maximum=max((i[0] for i in struct.iter_unpack('<I',raw[a['indices']:a['indices']+a['indexCount']*4])),default=0)
    require(maximum<a['vertexCount'],f'{key}: invalid vertex index')
    require(a['indexCount']%3==0,f'{key}: incomplete triangles')
    # Each asset digest is over positions, normals, indices in that order.
    asset_digest=hashlib.sha256()
    for f,n in [('positions',a['vertexCount']*3),('normals',a['vertexCount']*3),('indices',a['indexCount'])]:asset_digest.update(raw[a[f]:a[f]+n*4])
    if a.get('sha256'):require(asset_digest.hexdigest()==a['sha256'],f'{key}: asset digest mismatch')
for group in ['bones','muscles']:
    for key,item in catalog[group].items():
        for side,ids in item['sides'].items():
            require(bool(ids),f'{key}/{side}: empty source geometry')
            for key2 in ids:require(key2 in catalog['assets'],f'{key}/{side}: missing {key2}')
for chapter in catalog['chapters']:
    for listkey,table in [('bones','bones'),('muscles','muscles'),('context','bones')]:
        for key in chapter.get(listkey,[]):require(key in catalog[table],f'{chapter["id"]}: missing {table}/{key}')
    for g in chapter.get('muscleGroups',[]):
        for key in g['keys']:require(key in chapter['muscles'],f'{chapter["id"]}: invalid muscle group {key}')
checks['geometry']={'assets':len(catalog['assets']),'chapters':len(catalog['chapters']),'bytes':len(raw),'sha256':sha(raw)}
raw.release();geometry_map.close();geometry_temp.close()

courses=json.loads((root/'lab/courses.json').read_text('utf-8-sig'))
course_list=courses if isinstance(courses,list) else courses.get('courses',courses.get('modules',[]))
require(len(course_list)==13,'Expected 13 curriculum navigation entries')
checks['curriculumEntries']=len(course_list)

pressure_checker=root/'pressure/tools/check_pressure_data.py'
require(pressure_checker.is_file(),'Missing independent plantar-pressure source checker')
if pressure_checker.is_file():
    run=subprocess.run([sys.executable,'-X','utf8',str(pressure_checker)],capture_output=True,text=True,encoding='utf-8')
    require(run.returncode==0,'Pressure source/numerical check failed: '+run.stderr[:800])
    if run.returncode==0:
        try:
            pressure_result=json.loads(run.stdout)
            require(pressure_result.get('passed') is True,'Pressure checker did not pass')
            checks['pressureData']=pressure_result
        except Exception as e:issues.append('Pressure checker report: '+str(e))
for course_id in [11,13]:
    course=next((c for c in course_list if c['sourceId']==course_id),{})
    require(course.get('related',{}).get('href')=='../pressure/index.html',f'Course {course_id} pressure case entry absent')

inquiry_checker=root/'pressure/tools/check_inquiry_case.py'
require(inquiry_checker.is_file(),'Missing inquiry-case arithmetic acceptance check')
if inquiry_checker.is_file():
    run=subprocess.run([sys.executable,'-X','utf8',str(inquiry_checker)],capture_output=True,text=True,encoding='utf-8')
    require(run.returncode==0,'Inquiry reference-case check failed: '+run.stderr[:800])
    if run.returncode==0:
        try:
            inquiry_result=json.loads(run.stdout)
            require(inquiry_result.get('status')=='passed','Inquiry checker did not pass')
            checks['inquiryCase']=inquiry_result
        except Exception as e:issues.append('Inquiry checker report: '+str(e))

forbidden=re.compile(r'MuscleMimic|MyoSim|MoBL[-_]ARMS|myo_sim|myoarm|myolegs',re.I)
for f in list(root.rglob('*.js'))+list(root.rglob('*.html')):
    if f.name in ('teacher-review.html','teacher-restoration.html'):continue
    require(not forbidden.search(f.read_text('utf-8-sig')),f'{f.relative_to(root)}: prohibited runtime identifier')
for name in ['lab/assets/native-01.bin','lab/assets/native-02.bin','guide/assets/model.json']:
    require(not (root/name).exists(),f'Excluded legacy path exists: {name}')
denyfile=root/'docs/excluded-file-hashes.json'
if denyfile.exists():
    deny=json.loads(denyfile.read_text('utf-8-sig'))
    denyhash={f['sha256'] for f in deny['files']}
    for f in root.rglob('*'):
        if f.is_file():require(sha(f.read_bytes()) not in denyhash,f'{f.relative_to(root)}: excluded legacy payload hash')
checks['runtimeExclusionScan']='completed'

fm=root/'file-manifest.json'
if fm.exists():
    data=json.loads(fm.read_text('utf-8-sig'));seen=set()
    for f in data['files']:
        name=f['path'];seen.add(name);p=root/name;require(p.is_file(),f'Manifest file missing: {name}')
        if p.is_file():b=p.read_bytes();require(len(b)==f['bytes'] and sha(b)==f['sha256'],f'Manifest hash mismatch: {name}')
    actual={f.relative_to(root).as_posix() for f in root.rglob('*') if f.is_file() and f!=fm}
    require(seen==actual,'File manifest coverage mismatch');checks['fileManifest']={'files':len(seen),'selfExcluded':'file-manifest.json'}
else:checks['fileManifest']='not yet generated'

if args.archive:
    arc=Path(args.archive).resolve()
    with zipfile.ZipFile(arc) as z:
        require(z.testzip() is None,'ZIP CRC failed');names=z.namelist();require(len(names)==len(set(names)),'ZIP duplicate paths')
        for name in names:
            pp=PurePosixPath(name);require(not pp.is_absolute() and '..' not in pp.parts and ':' not in name and '\\' not in name,f'Unsafe ZIP path: {name}')
        actual={p.relative_to(root).as_posix():p for p in root.rglob('*') if p.is_file()};require(set(names)==set(actual),'ZIP contents differ from release folder')
        for name in names:
            if name in actual:require(sha(z.read(name))==sha(actual[name].read_bytes()),f'ZIP payload hash mismatch: {name}')
        checks['archive']={'entries':len(names),'bytes':arc.stat().st_size,'sha256':sha(arc.read_bytes()),'crc':'passed'}
result={'passed':not issues,'checks':checks,'issues':issues,'limits':['Checks do not certify clinical kinematics, legal ownership or national application readiness.','UI smoke tests are recorded separately; this script parses and verifies local payloads.']}
text=json.dumps(result,ensure_ascii=False,indent=2)
if args.output:Path(args.output).write_text(text,'utf-8')
print(text)
sys.exit(0 if not issues else 1)
