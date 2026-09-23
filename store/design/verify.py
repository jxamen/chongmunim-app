from pathlib import Path
import sys, json
here=Path(__file__).resolve().parent
sys.path.insert(0,str(here/'.python'))
from PIL import Image, ImageChops
store=here.parent
report={'images':[], 'checks':[]}
for folder,size,count in [('out',(1320,2868),8),('out/play',(1080,1920),8),('raw',(1170,2532),8)]:
    files=sorted((store/folder).glob('0*.png'))
    assert len(files)==count, (folder,len(files))
    for f in files:
        with Image.open(f) as im:
            im.load()
            assert im.size==size,(f,im.size)
            assert im.mode in ('RGB','RGBA'),(f,im.mode)
            if im.mode=='RGBA': assert im.getextrema()[3]==(255,255)
            report['images'].append({'file':f.relative_to(store).as_posix(),'size':list(im.size),'mode':im.mode,'bytes':f.stat().st_size})
report['checks'].append('16 final PNGs and 8 raw PNGs have exact sizes; all opaque')
cap=json.loads((here/'capture-report.json').read_text(encoding='utf8'))
assert not cap['errors'],cap['errors']
assert all(c['mocked'] for c in cap['calls'])
report['checks'].append('Capture has no page errors; every API call was mocked')
if (here/'pair-reference.png').exists():
    pair=Image.new('RGB',(2640,2868))
    for n in range(2):
        with Image.open(store/'out'/f'{n+1:02d}.png') as im: pair.paste(im.convert('RGB'),(1320*n,0))
    with Image.open(here/'pair-reference.png') as ref: assert ImageChops.difference(pair,ref.convert('RGB')).getbbox() is None
    report['checks'].append('App Store 01+02 are pixel-identical to the uncropped two-panel canvas')
(here/'qa-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(report['checks'],ensure_ascii=False,indent=2))
