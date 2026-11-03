import concurrent.futures, json, re, sys, urllib.request
from html import unescape
from pathlib import Path

def fetch(kv):
    key, url = kv
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=25) as r:
            raw = r.read().decode('utf-8', errors='replace')
        Path('tmp/assess-'+key+'.html').write_text(raw, encoding='utf-8')
        cleaned = re.sub(r'<(script|style|nav|header|footer)\b[^>]*>.*?</\1>', ' ', raw, flags=re.S|re.I)
        text = unescape(re.sub('<[^>]+>', ' ', cleaned))
        text = re.sub(r'\s+', ' ', text).strip()
        Path('tmp/assess-'+key+'.txt').write_text(text, encoding='utf-8')
        return {'key':key,'url':url,'length':len(text),'text':text[:int(sys.argv[2]) if len(sys.argv)>2 else 9000]}
    except Exception as e:
        return {'key':key,'url':url,'error':str(e)}

if __name__ == '__main__':
    urls = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
    for result in concurrent.futures.ThreadPoolExecutor(8).map(fetch, urls.items()):
        print(json.dumps(result, ensure_ascii=False))
