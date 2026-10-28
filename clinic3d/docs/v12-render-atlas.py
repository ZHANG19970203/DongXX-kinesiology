"""Reproducible original atlas visualizations of the licensed source mesh data.
No source image or medical illustration is copied. Geometry is unmodified.
Run from the project workspace with Python, numpy and Pillow.
"""
import hashlib, json, pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
CLINIC = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'migration-site' / 'assembly'
OUT = CLINIC / 'assets' / 'posters'
OUT.mkdir(parents=True, exist_ok=True)
text = (SOURCE / 'assets/catalog.js').read_text('utf-8')
catalog = json.loads(text[text.index('=')+1:].rstrip(';\n'))
manifest = json.loads((SOURCE / 'assets/geometry-manifest.json').read_text('utf-8'))
parts = []
for chunk in manifest['chunks']:
    b = (SOURCE / chunk['path']).read_bytes()
    assert hashlib.sha256(b).hexdigest() == chunk['sha256']
    parts.append(b)
DATA = b''.join(parts)
assert hashlib.sha256(DATA).hexdigest() == manifest['sha256']
FONT = 'C:/Windows/Fonts/msyh.ttc'
BOLD = 'C:/Windows/Fonts/msyhbd.ttc'
def font(size, bold=False): return ImageFont.truetype(BOLD if bold else FONT,size)
def ids(group, keys=None, side=None):
    result = []
    for key, entry in catalog[group].items():
        if keys is not None and key not in keys: continue
        for which, values in entry['sides'].items():
            if side is not None and which not in [side, 'M']: continue
            result += values
    return list(dict.fromkeys(result))
bone_ids = ids('bones')
muscle_ids = ids('muscles')
def geometry(asset):
    row = catalog['assets'][asset]
    p = np.frombuffer(DATA,dtype='<f4',count=row['vertexCount']*3,offset=row['positions']).reshape(-1,3)
    n = np.frombuffer(DATA,dtype='<f4',count=row['vertexCount']*3,offset=row['normals']).reshape(-1,3)
    idx = np.frombuffer(DATA,dtype='<u4',count=row['indexCount'],offset=row['indices']).reshape(-1,3)
    payload = DATA[row['positions']:row['positions']+p.nbytes]+DATA[row['normals']:row['normals']+n.nbytes]+DATA[row['indices']:row['indices']+idx.nbytes]
    assert hashlib.sha256(payload).hexdigest() == row['sha256']
    return p,n,idx
CACHE={key:geometry(key) for key in set(bone_ids+muscle_ids)}

def render(ids_to_use, box, image, yaw=0, crop=None, muscle=False):
    # Right-handed orthographic camera; painter sorts all triangles across meshes.
    c,s=np.cos(yaw),np.sin(yaw)
    rotation=np.array([[c,0,-s],[0,1,0],[s,0,c]])
    vertices=[]; normals=[]; colors=[]
    used=[]
    for asset in ids_to_use:
        p,n,idx=CACHE[asset]
        tri=p[idx]
        if crop is not None:
            valid=(tri[:,:,1].mean(axis=1)>=crop[0])&(tri[:,:,1].mean(axis=1)<=crop[1])
            idx=idx[valid]
            if not len(idx):continue
        used.append(asset)
        vertices.append(p[idx]@rotation.T)
        normals.append(n[idx].mean(axis=1)@rotation.T)
        base=[194,86,79] if asset in muscle_ids else [224,215,187]
        colors.append(np.tile(base,(len(idx),1)))
    tris=np.concatenate(vertices); norm=np.concatenate(normals); rgb=np.concatenate(colors)
    xy=tris[:,:,:2]
    low=xy.reshape(-1,2).min(axis=0); high=xy.reshape(-1,2).max(axis=0)
    x,y,w,h=box; scale=min(w/(high[0]-low[0]),h/(high[1]-low[1]))
    cx,cy=(high+low)/2
    px=np.stack(((xy[:,:,0]-cx)*scale+x+w/2, -(xy[:,:,1]-cy)*scale+y+h/2),axis=-1)
    # Two broad lights reveal mesh shape while retaining bone/muscle distinction.
    norm/=np.maximum(np.linalg.norm(norm,axis=1,keepdims=True),1e-7)
    light=np.array([-.4,.6,1.]);light/=np.linalg.norm(light)
    shade=.53+.39*np.clip(norm@light,0,1)+.08*np.clip(norm@np.array([.4,0,-.9]),0,1)
    rgb=np.clip(rgb*shade[:,None],0,255).astype(np.uint8)
    draw=ImageDraw.Draw(image)
    for k in np.argsort(tris[:,:,2].mean(axis=1)):
        draw.polygon([tuple(v) for v in px[k]],fill=tuple(rgb[k]))
    return used

def base(title, subtitle):
    im=Image.new('RGB',(900,1350),'#fafaf5');d=ImageDraw.Draw(im)
    d.rectangle((0,0,900,16),fill='#244f63')
    d.text((450,83),title,font=font(44,True),fill='#234858',anchor='mm')
    d.text((450,141),subtitle,font=font(23),fill='#627a7c',anchor='mm')
    d.line((52,1230,848,1230),fill='#d9e2df',width=2)
    d.text((450,1263),'BodyParts3D · © The Database Center for Life Science',font=font(15),fill='#667d7e',anchor='mm')
    d.text((450,1293),'CC BY 4.0 · Somakine 图谱网格 / 本课程原创渲染',font=font(15),fill='#667d7e',anchor='mm')
    d.text((450,1320),'静态解剖识别图 · 标签为结构定位，不表示临床测量',font=font(14),fill='#7c8c8b',anchor='mm')
    return im

records=[]
im=base('人体骨与关节','骨骼前面观 · 结构定位')
used=render(bone_ids,(208,205,484,944),im)
d=ImageDraw.Draw(im)
for label,yy,x1,x2 in [('肩关节',382,532,750),('肘关节',538,564,750),('髋关节',642,492,750),('膝关节',906,496,750),('踝关节',1104,498,750)]:
    d.line((x1,yy,x2-18,yy),fill='#92a7a3',width=2);d.ellipse((x1-4,yy-4,x1+4,yy+4),fill='#367c86')
    d.text((x2,yy),label,font=font(23),fill='#345d65',anchor='lm')
im.save(OUT/'human-skeleton.png',optimize=True)
records.append({'file':'assets/posters/human-skeleton.png','title':'人体骨与关节','assetIds':used,'view':'orthographic anterior'})

im=base('骨骼肌解剖','前面观与后面观 · 表层可见结构')
used=render(bone_ids+muscle_ids,(38,226,398,905),im,muscle=True)
used+=render(bone_ids+muscle_ids,(464,226,398,905),im,yaw=np.pi,muscle=True)
d=ImageDraw.Draw(im)
d.text((235,1171),'前面观',font=font(27,True),fill='#325d64',anchor='mm')
d.text((665,1171),'后面观',font=font(27,True),fill='#325d64',anchor='mm')
im.save(OUT/'human-muscles.png',optimize=True)
records.append({'file':'assets/posters/human-muscles.png','title':'骨骼肌解剖','assetIds':list(dict.fromkeys(used)),'view':'orthographic anterior and posterior; deeper surfaces occluded by nearer meshes'})

foot_ch=catalog['chapters'][6]
footkeys=list(dict.fromkeys(foot_ch['context']+catalog['chapters'][7]['context']))
legbones=ids('bones',[k for k in footkeys if k not in ['femur','patella']],'R');legmuscles=ids('muscles',foot_ch['muscles'],'R')
im=base('小腿与足踝骨肌','右侧解剖 · 前面观 / 外侧观')
used=render(legbones+legmuscles,(35,226,390,830),im,crop=None,muscle=True)
used+=render(legbones+legmuscles,(477,226,390,830),im,yaw=-np.pi/2,crop=None,muscle=True)
d=ImageDraw.Draw(im)
d.text((228,1106),'前面观',font=font(25,True),fill='#325d64',anchor='mm')
d.text((672,1106),'外侧观',font=font(25,True),fill='#325d64',anchor='mm')
d.text((450,1163),'胫骨前肌 · 腓肠肌 · 比目鱼肌 · 腓骨肌群',font=font(23),fill='#657d7d',anchor='mm')
im.save(OUT/'ankle-muscles.png',optimize=True)
records.append({'file':'assets/posters/ankle-muscles.png','title':'小腿与足踝骨肌','assetIds':list(dict.fromkeys(used)),'view':'right-side anterior and lateral; unmodified distal lower limb meshes, excluding femur/patella for composition'})

for r in records:
    f=CLINIC/r['file'];r.update(bytes=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest(),assetCount=len(r['assetIds']))
notice={'format':'dxx-original-anatomy-posters-v12','license':'CC BY 4.0; derived visualizations of BodyParts3D data','attribution':'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International','licenseUrl':'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html','somakineUrl':'https://github.com/ivershuo/somakine','sourceGeometrySha256':manifest['sha256'],'modifications':['Orthographic rendering of unedited licensed positions and indices with original lighting, colors, layout and Chinese structure labels.','No inferred joint registration, muscle activation, patient data or movement model.','Anterior/posterior views share the original atlas anatomy. Foot poster selects the lower-leg and foot bones and seven ankle-crossing muscles; the femur/patella are omitted for composition.'],'posters':records}
(CLINIC/'docs/v12-anatomy-posters.json').write_text(json.dumps(notice,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps([{'file':r['file'],'bytes':r['bytes'],'assetCount':r['assetCount']} for r in records],ensure_ascii=False))

