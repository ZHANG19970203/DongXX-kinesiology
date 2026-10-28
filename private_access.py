"""Teacher password authentication and SQLite online backups. No secret in site files."""
from pathlib import Path
from http.cookies import SimpleCookie
import hashlib,hmac,secrets,time,json,sqlite3,threading,zipfile,io
from datetime import datetime,timezone
from contextlib import closing
from learning_service import ServiceError

class PrivateAccess:
    teacher_id='026870'
    teacher_name='张积众'
    cookie='dxx_teacher_session'
    def __init__(self,server):
        self.server=server;self.root=server.learning.data_dir;self.lock=threading.RLock()
        with server.store.connect() as c:
            c.executescript('''CREATE TABLE IF NOT EXISTS teacher_account(id TEXT PRIMARY KEY,name TEXT NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL,changed_at REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS teacher_sessions(token_hash TEXT PRIMARY KEY,expires_at REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS teacher_login_attempts(peer TEXT PRIMARY KEY,failures INTEGER NOT NULL,window_start REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS teacher_comments(turn_id TEXT PRIMARY KEY,body TEXT NOT NULL,updated_at TEXT NOT NULL);''')
        self.proof_path=self.root/'teacher-setup-secret.txt'
        if not self.proof_path.exists():self.proof_path.write_text(secrets.token_urlsafe(36),encoding='utf-8')
        self.backups=self.root/'backups';self.backups.mkdir(exist_ok=True)
        self.last_backup=0
    @staticmethod
    def hash_token(value):return hashlib.sha256(value.encode()).hexdigest()
    @staticmethod
    def password(value,salt):return hashlib.pbkdf2_hmac('sha256',value.encode(),bytes.fromhex(salt),600000).hex()
    def configured(self):
        with self.server.store.connect() as c:return bool(c.execute('SELECT 1 FROM teacher_account WHERE id=?',(self.teacher_id,)).fetchone())
    def write_entry(self,path=None):
        dest=Path(path) if path else self.root/'teacher-first-setup.html'
        base='http://127.0.0.1:'+str(self.server.server_address[1])+'/teacher/login.html'
        url=base if self.configured() else base+'#setup='+self.proof_path.read_text(encoding='utf-8').strip()
        dest.write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>教师首次设置 · 仅本人</title><style>body{font:18px/1.9 system-ui;max-width:700px;margin:70px auto;color:#24513a}a{display:inline-block;background:#246946;color:white;padding:14px 24px;border-radius:12px;text-decoration:none}</style><h1>动小学 · 教师专用入口</h1><p>工号026870，姓名张积众。首次从这里验证身份并设置个人密码；以后直接使用网页教师入口。</p><p>此文件含首次设置凭据，请本人保管，不要发给学生或加入公开网站压缩包。</p><a href="'+url+'">进入教师登录与首次设置 →</a></html>',encoding='utf-8')
        return dest
    def valid(self,header):
        try:
            cookies=SimpleCookie();cookies.load(header or '');token=cookies[self.cookie].value
        except (KeyError,TypeError):return False
        with self.server.store.connect() as c:return bool(c.execute('SELECT 1 FROM teacher_sessions WHERE token_hash=? AND expires_at>?',(self.hash_token(token),time.time())).fetchone())
    def status(self,header):return {'configured':self.configured(),'authenticated':self.valid(header),'teacherId':self.teacher_id,'name':self.teacher_name if self.valid(header) else '', 'storageMode':'本机服务器持久数据库'}
    def auth(self,data,peer,setup=False):
        if not isinstance(data,dict):raise ServiceError(422,'登录信息无效。')
        identity=str(data.get('teacherId',''));name=str(data.get('name','')).strip();pw=data.get('password','')
        if not isinstance(pw,str) or len(pw)>256:raise ServiceError(422,'密码格式无效。')
        with self.lock,self.server.store.connect() as c:
            attempt=c.execute('SELECT * FROM teacher_login_attempts WHERE peer=?',(peer,)).fetchone()
            if attempt and time.time()-attempt['window_start']<900 and attempt['failures']>=8:raise ServiceError(429,'尝试次数较多，请15分钟后重试。')
            def fail():
                start=attempt['window_start'] if attempt and time.time()-attempt['window_start']<900 else time.time()
                count=attempt['failures']+1 if attempt and start==attempt['window_start'] else 1
                c.execute('INSERT OR REPLACE INTO teacher_login_attempts VALUES(?,?,?)',(peer,count,start));c.commit()
                raise ServiceError(401,'身份或验证信息不匹配。')
            if identity!=self.teacher_id or name!=self.teacher_name:fail()
            account=c.execute('SELECT * FROM teacher_account WHERE id=?',(self.teacher_id,)).fetchone()
            if setup:
                if account:raise ServiceError(409,'教师账户已设置，请使用密码登录。')
                proof=data.get('setupProof','')
                if not isinstance(proof,str) or not hmac.compare_digest(proof,self.proof_path.read_text(encoding='utf-8').strip()):fail()
                if len(pw)<12:raise ServiceError(422,'请设置至少12个字符的个人密码。')
                salt=secrets.token_hex(16)
                c.execute('INSERT INTO teacher_account VALUES(?,?,?,?,?)',(identity,name,salt,self.password(pw,salt),time.time()))
            elif not account or not hmac.compare_digest(account['password_hash'],self.password(pw,account['salt'])):fail()
            c.execute('DELETE FROM teacher_login_attempts WHERE peer=?',(peer,))
            c.execute('DELETE FROM teacher_sessions WHERE expires_at<?',(time.time(),))
            token=secrets.token_urlsafe(36)
            c.execute('INSERT INTO teacher_sessions VALUES(?,?)',(self.hash_token(token),time.time()+12*3600))
            return {'authenticated':True,'teacherId':identity,'name':name}, f'{self.cookie}={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200'
    def logout(self,header):
        try:
            cookies=SimpleCookie();cookies.load(header or '');token=cookies[self.cookie].value
            with self.server.store.connect() as c:c.execute('DELETE FROM teacher_sessions WHERE token_hash=?',(self.hash_token(token),))
        except KeyError:pass
        return f'{self.cookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
    def backup(self,force=False):
        with self.lock:
            if not force and time.time()-self.last_backup<3600:return
            stamp=datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S-%f');dest=self.backups/('learning-'+stamp+'.sqlite3')
            with self.server.store.connect() as src,closing(sqlite3.connect(dest)) as target:
                src.backup(target)
                if target.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise RuntimeError('备份校验失败')
            manifest={'file':dest.name,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'bytes':dest.stat().st_size,'createdAt':datetime.now(timezone.utc).isoformat(),'integrity':'ok'}
            (self.backups/'latest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8');self.last_backup=time.time()
            return manifest
    def storage(self):
        try:last=json.loads((self.backups/'latest.json').read_text(encoding='utf-8'))
        except (ValueError,OSError):last=None
        return {'database':str(self.server.store.path),'backupDirectory':str(self.backups),'lastBackup':last,'cloudConnected':False,'policy':'服务启动及运行中每小时在线备份；可随时下载完整备份。备份与原库在同一磁盘，建议再存至学校受控存储或移动硬盘。'}
    def archive(self):
        m=self.backup(True);b=io.BytesIO()
        with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:
            z.write(self.backups/m['file'],'learning.sqlite3');z.writestr('manifest.json',json.dumps(m,ensure_ascii=False,indent=2))
            z.writestr('恢复说明.txt','此备份包含学生学习与讨论记录，应仅由教师保管。停止服务后，先保留原数据库副本，再将learning.sqlite3复制到后台显示的数据目录。恢复时不要保留原库的-wal/-shm文件。恢复后核对人数、会话数和讨论记录。API密钥与首次设置凭据不在此备份中。')
        return b.getvalue()
    def comment(self,data):
        turn=str(data.get('turnId',''));body=str(data.get('text','')).strip()
        if not body or len(body)>2000:raise ServiceError(422,'点评需为1–2000字。')
        body=self.server.learning.redact(body)
        with self.server.store.connect() as c:
            if not c.execute('SELECT 1 FROM learning_turns WHERE id=?',(turn,)).fetchone():raise ServiceError(404,'讨论记录不存在。')
            c.execute('INSERT OR REPLACE INTO teacher_comments VALUES(?,?,?)',(turn,body,datetime.now(timezone.utc).isoformat()))
        return {'saved':True}
