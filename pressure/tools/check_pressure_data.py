"""Independent source-preservation and numerical checks; Python standard library only.

Run from any directory: python pressure/tools/check_pressure_data.py
Optional: --report path/to/result.json
This checker does not import the preparation script or the teaching UI.
"""
import argparse
import csv
from decimal import Decimal, getcontext
import hashlib
import json
import math
from pathlib import Path
import re
from xml.etree import ElementTree as ET

getcontext().prec = 40
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
EXPECTED_SOURCE_SHA256 = {
    'source/P1_NP_1_L.csv':'9b97000f31a9b34781d59066fda83c81fec71b21984e9ec873e6ef4a9964c1e3',
    'source/P1_NP_1_R.csv':'290c83f57bbb89cd26b43af9ec44afadbbe11e6eacdb4aad211493f3f25b8289',
    'source/P1_NP_1_sync_auto.json':'bd00e5d8616d49bc4b777b72204c73c19d0184e10b68046c6ed2c60e2013df96',
    'source/sensors_map_left.svg':'c9dedfce3561b92d8fe0795ca17072330cb5e021474514542982792f79beaa36',
    'source/sensors_map_right.svg':'54e8df5d8337c0efbd6d3fc4747c5a9a5120ae3b946b36fb90398256a1b2e6e3',
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def finite_number(value):
    return isinstance(value, (int,float)) and not isinstance(value,bool) and math.isfinite(value)


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def check():
    path = DATA / 'case-p1-np-1.json'
    case = json.loads(path.read_text(encoding='utf-8'))
    require(case['schemaVersion'] == 'dxx-pressure-case-v1', 'Schema version')
    require(case['dataset']['doi'] == '10.5281/zenodo.19662017', 'Dataset identity')
    require(case['dataset']['caseId'] == 'P1/NP/1', 'Case identity')
    require(case['dataset']['nominalHz'] == 64, 'Nominal sampling rate')
    require(case['dataset']['units']['area'] is None, 'Unknown effective areas must not be invented')
    require(case['dataset']['license']['id'] == 'CC-BY-4.0', 'Data licence')
    require(set(case['sides']) == {'L','R'}, 'Exactly two independent side files')
    sources = {entry['path']:entry for entry in case['sources']}
    checks=[]
    for name, expected in EXPECTED_SOURCE_SHA256.items():
        source = DATA / name
        require(source.is_file(), 'Missing acquired source '+name)
        require(digest(source) == expected, 'Acquired source changed '+name)
        require(sources[name]['sha256'] == expected, 'Manifest disagrees with independently recorded source hash '+name)
    for entry in case['sources']:
        source=(DATA/entry['path']).resolve()
        require(source.is_relative_to(ROOT), 'Source path leaves pressure module')
        require(source.stat().st_size == entry['bytes'], 'Source byte count '+entry['path'])
        require(digest(source) == entry['sha256'], 'Source manifest SHA '+entry['path'])
    checks.append({'name':'Source file hashes and byte counts','passed':True,'files':len(case['sources'])})

    record=json.loads((ROOT/'licenses/zenodo-api-record-snapshot.json').read_text(encoding='utf-8'))
    require(record['id'] == 19662017, 'Archived API record identity')
    require(record['metadata']['license']['id'] == 'cc-by-4.0', 'Archived API licence differs')
    require(record['metadata']['access_right'] == 'open', 'Archived access status')
    api_files={f['key']:f for f in record['files']}
    for side_name in ['left','right']:
        filename='sensors_map_'+side_name+'.svg'
        md5=hashlib.md5((DATA/'source'/filename).read_bytes()).hexdigest()
        require(api_files[filename]['checksum'] == 'md5:'+md5, 'Published SVG checksum')
    index_path=ROOT/'licenses/source-zip-file-index.json'
    index=json.loads(index_path.read_text(encoding='utf-8'))
    require(len(index) == 4724, 'ZIP index count')
    terms=[item['path'] for item in index if any(w in Path(item['path']).name.lower() for w in ['readme','license','licence','terms','usage','copyright','citation'])]
    require(not terms, 'Additional source terms require review')
    required_members={f'P1/NP/1/{name}' for name in ['L.csv','R.csv','sync_auto.json']}
    require(required_members.issubset({x['path'] for x in index}), 'Selected CSV members not in indexed ZIP')
    checks.append({'name':'Licence snapshot, published SVG checksums and ZIP terms search','passed':True,'indexedEntries':len(index),'termsMatches':terms})

    side_results={}
    for side, longname in [('L','left'),('R','right')]:
        data=case['sides'][side]
        require(data['frameCount'] == 249 and len(data['frames']) == 249, 'Frame count '+side)
        require(len(data['points']) == 32, 'Point count '+side)
        require(data['channelOrder'] == ['PressureSensor '+str(i) for i in range(32)], 'Channel order '+side)
        for point in data['points']:
            require(set(point) == {'x','y'} and all(finite_number(x) for x in point.values()), 'Finite point coordinates '+side)
        source_name='source/P1_NP_1_'+side+'.csv'
        require(data['sourceSHA256'] == EXPECTED_SOURCE_SHA256[source_name], 'Side source hash '+side)
        with (DATA/source_name).open(encoding='utf-8-sig',newline='') as source:
            reader=csv.DictReader(source)
            require(len(reader.fieldnames) == 41, 'Source field count '+side)
            require(not any('time' in h.lower() for h in reader.fieldnames), 'Source timestamp claim changed')
            rows=list(reader)
        require(len(rows) == 249, 'Source row count '+side)
        max_error=Decimal(0)
        min_sum,max_sum=Decimal('Infinity'),Decimal('-Infinity')
        for index,(frame,row) in enumerate(zip(data['frames'],rows)):
            require(frame['index'] == index, 'Zero-based frame index '+side)
            require(len(frame['values']) == 32, 'Channel array shape '+side)
            require(all(finite_number(v) and v>=0 for v in frame['values']), 'Nonnegative finite channels '+side)
            require(len(frame['cop']) == 2 and all(finite_number(v) for v in frame['cop']), 'Finite CoP pair '+side)
            require(finite_number(frame['sum']) and frame['sum']>0, 'Finite source sum '+side)
            weights=[Decimal(row['PressureSensor '+str(i)]) for i in range(32)]
            original_sum=Decimal(row['sumP'])
            require(sum(weights) == original_sum, 'Source sumP not channel sum '+side)
            require(all(Decimal(str(frame['values'][i])) == weights[i] for i in range(32)), 'Source channel altered '+side)
            require(Decimal(str(frame['sum'])) == original_sum, 'Original sumP altered '+side)
            for axis,source_name_axis in enumerate(['copX','copY']):
                # Compare JSON to source at the numeric precision representable in JSON.
                require(frame['cop'][axis] == float(row[source_name_axis]), 'Original CoP altered '+side)
                coordinate_key=['x','y'][axis]
                numerator=sum(weight*Decimal(str(point[coordinate_key])) for weight,point in zip(weights,data['points']))
                calculated=numerator/original_sum
                error=abs(calculated-Decimal(row[source_name_axis]))
                max_error=max(max_error,error)
                require(error < Decimal('0.000000001'), 'CoP reference mismatch '+side+' frame '+str(index))
            min_sum=min(min_sum,original_sum);max_sum=max(max_sum,original_sum)
        # Independent original SVG label check; source half-unit drawing coordinates
        # are only a display frame, and remain explicitly distinct from SVG units.
        svg=ET.fromstring((DATA/'source'/f'sensors_map_{longname}.svg').read_text(encoding='utf-8'))
        labels=[''.join(t.itertext()).strip() for t in svg.iter('{http://www.w3.org/2000/svg}text')]
        numbered=[int(label) for label in labels if label.isdigit()]
        require(sorted(numbered) == list(range(32)), 'SVG sensor labels '+side)
        pads=data['coordinateProvenance']['svgPadCenters']
        require(len(pads)==32 and len({p['sourcePathId'] for p in pads})==32, 'Unique source pad geometry '+side)
        svg_ids={el.attrib.get('id') for el in svg.iter()}
        require(all(p['sourcePathId'] in svg_ids and p['sourceTextId'] in svg_ids for p in pads), 'Geometry IDs absent from original SVG '+side)
        threshold=Decimal(str(case['teachingAnalysis']['defaultRelativeSumThreshold']))*max_sum
        included=sum(Decimal(str(frame['sum']))>=threshold for frame in data['frames'])
        side_results[side]={'frames':249,'channels':32,'originalSourceValuesUnchanged':True,'originalCoPAndSumUnchanged':True,'maxCoPAbsoluteErrorDrawingUnits':str(max_error),'minimumSum':str(min_sum),'maximumSum':str(max_sum),'defaultTeachingRatio':case['teachingAnalysis']['defaultRelativeSumThreshold'],'defaultIncludedFrames':included,'svgLabels':len(numbered),'sourceSHA256':data['sourceSHA256']}
    checks.append({'name':'All 498 frames and 15,936 source channel values retained; independent Decimal CoP recomputation','passed':True,'sides':side_results})
    return {'passed':True,'schemaVersion':case['schemaVersion'],'caseSHA256':digest(path),'checkerSHA256':digest(Path(__file__)),'checks':checks,'limits':['These checks establish source preservation and numerical consistency in drawing coordinates.','They do not establish pressure calibration, sensor effective area, physical CoP distance, contact-event accuracy, L/R synchronization or clinical validity.']}


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report',type=Path)
    args=parser.parse_args()
    result=check()
    text=json.dumps(result,ensure_ascii=False,indent=2)
    if args.report:
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(text+'\n',encoding='utf-8')
    print(text)
