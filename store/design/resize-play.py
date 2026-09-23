"""Resize the 1320 x 2347 Play slices using PIL to exact 1080 x 1920."""
from pathlib import Path
import sys
here=Path(__file__).resolve().parent
sys.path.insert(0,str(here/'.python'))
from PIL import Image
for n in range(1,9):
    file=here.parent/'out'/'play'/f'{n:02d}.png'
    with Image.open(file) as image:
        assert image.size==(1320,2347), (file,image.size)
        result=image.convert('RGB').resize((1080,1920),Image.Resampling.LANCZOS)
    result.save(file,optimize=True)
    print(f'{file.name}: 1080 x 1920 RGB')
