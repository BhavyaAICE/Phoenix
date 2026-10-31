import os
import zipfile
import io
import urllib.request
import json
import time
import sys

def build_zip():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        for folder in ['phoenix-backend', 'phoenix-frontend', 'phoenix-ci']:
            for root, dirs, files in os.walk(folder):
                dirs[:] = [d for d in dirs if d not in ['node_modules', '.next', 'dist', 'build', 'coverage', '.git', '.vercel', '.turbo']]
                for f in files:
                    if f.startswith('.env') and not f.endswith('.example'):
                        continue
                    if f.endswith('.tsbuildinfo') or f == '.DS_Store':
                        continue
                    full = os.path.join(root, f)
                    arc = full.replace('\\', '/')
                    zinfo = zipfile.ZipInfo(arc)
                    zinfo.date_time = time.localtime(os.path.getmtime(full))[:6]
                    zinfo.compress_type = zipfile.ZIP_DEFLATED
                    if f.endswith('.sh'):
                        zinfo.external_attr = 0o100755 << 16
                    else:
                        zinfo.external_attr = 0o100644 << 16
                    with open(full, 'rb') as fp:
                        z.writestr(zinfo, fp.read())
        for doc in ['README.md', 'REPORT.md', 'docker-compose.yml']:
            if os.path.exists(doc):
                zinfo = zipfile.ZipInfo(doc)
                zinfo.date_time = time.localtime(os.path.getmtime(doc))[:6]
                zinfo.compress_type = zipfile.ZIP_DEFLATED
                zinfo.external_attr = 0o100644 << 16
                with open(doc, 'rb') as fp:
                    z.writestr(zinfo, fp.read())
    return buf.getvalue()

def submit_and_poll(team="Frankenstein-Team"):
    data = build_zip()
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    header_part = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="team"\r\n\r\n'
        f'{team}\r\n'
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="submission.zip"\r\n'
        f'Content-Type: application/zip\r\n\r\n'
    ).encode('utf-8')
    footer_part = f'\r\n--{boundary}--\r\n'.encode('utf-8')
    body = header_part + data + footer_part

    req = urllib.request.Request('http://13.233.41.22:7070/api/submit', data=body, headers={
        'Content-Type': f'multipart/form-data; boundary={boundary}'
    })
    try:
        with urllib.request.urlopen(req) as res:
            res_json = json.loads(res.read().decode('utf-8'))
            print('Job ID:', res_json.get('jobId'), flush=True)
            jobId = res_json.get('jobId')
    except Exception as e:
        print('Submit error:', e, flush=True)
        return

    while True:
        time.sleep(3)
        try:
            with urllib.request.urlopen(f'http://13.233.41.22:7070/api/jobs/{jobId}') as r:
                job = json.loads(r.read().decode('utf-8'))
                status = job.get('status')
                elapsed = job.get('elapsedSeconds', 0)
                pos = job.get('position', 0)
                if status == 'queued':
                    print(f'Waiting in queue (position {pos})...', flush=True)
                elif status == 'running':
                    print(f'Running tests... {elapsed}s', flush=True)
                elif status == 'done':
                    print(f'Finished in {elapsed}s:', flush=True)
                    print(json.dumps(job.get('summary'), indent=2), flush=True)
                    return job.get('summary')
                else:
                    print('Grader error:', job, flush=True)
                    return job
        except Exception as e:
            print('Poll error:', e, flush=True)

if __name__ == '__main__':
    team = sys.argv[1] if len(sys.argv) > 1 else "Frankenstein-Team"
    submit_and_poll(team)
