"""Local-only static preview; no uploads or data collection."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse

parser=argparse.ArgumentParser(description='动小学本机预览')
parser.add_argument('--port',type=int,default=8765)
args=parser.parse_args()
root=Path(__file__).resolve().parent
handler=partial(SimpleHTTPRequestHandler,directory=str(root))
with ThreadingHTTPServer(('127.0.0.1',args.port),handler) as server:
    print(f'动小学本机预览: http://127.0.0.1:{args.port}/',flush=True)
    print('关闭本窗口或按 Ctrl+C 停止；记录保存在当前浏览器。',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
