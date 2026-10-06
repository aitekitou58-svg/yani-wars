"""Extract only geometrically complete MOF product rows (pdfplumber 0.11.9).
Merged cells are resolved by their bounding rectangles, never by fill-down text.
Ambiguous/open cells are quarantined; approvals are not evidence of current sale.
Usage: python scripts/parse-mof.py file.pdf source-url > rows.json
"""
import json, re, sys, unicodedata
import pdfplumber

def normalize(text):
    return unicodedata.normalize('NFKC', text or '').strip()

def parse_pdf(filename, url):
    products, rejected, excluded = [], [], 0
    approved = re.search(r'(20\d{6})', url)
    approval_date = f'{approved[1][:4]}-{approved[1][4:6]}-{approved[1][6:]}' if approved else None
    with pdfplumber.open(filename) as pdf:
      for page_no, page in enumerate(pdf.pages, 1):
        tables = page.find_tables()
        if not tables:
            rejected.append({'page':page_no, 'reason':'No geometric table found'})
        for table in tables:
          cells = [(c,normalize(page.crop(c).extract_text(x_tolerance=1,y_tolerance=2))) for c in table.cells]
          def header(term):
              return next((c for c,t in cells if term in re.sub(r'\s','',t)),None)
          name_box, kind_box, spec_box, country_box = header('名称'),header('製造たばこの区分'),header('製品の区分'),header('製造国')
          price_headers = [(c,t) for c,t in cells if '小売定価' in re.sub(r'\s','',t)]
          date_box = header('変更実施')
          if not all([name_box,kind_box,spec_box,country_box]) or not price_headers:
              rejected.append({'page':page_no,'reason':'Unrecognized table headers'});continue
          price_headers.sort(key=lambda item:item[0][0]); price_box=price_headers[-1][0]
          body_start = max(name_box[3],kind_box[3],spec_box[3])
          ys = sorted(set(c[1] for c,t in cells if c[1]>=body_start) | set(c[3] for c,t in cells if c[3]>body_start))
          def at(box,y):
              x=(box[0]+box[2])/2
              matches=[(c,t) for c,t in cells if c[0]-0.1<=x<c[2]+0.1 and c[1]-0.1<y<c[3]+0.1]
              return matches[0][1] if len(matches)==1 else None
          for a,b in zip(ys,ys[1:]):
            y=(a+b)/2
            kind,spec,country,price=[at(box,y) for box in [kind_box,spec_box,country_box,price_box]]
            if kind and not any(k in kind for k in ['紙巻','加熱式']):
                excluded+=1;continue
            if not all([kind,spec,country,price]):
                rejected.append({'page':page_no,'y':round(y,1),'reason':'Incomplete product fields'});continue
            count_match=re.search(r'(\d+)\s*(?:本|スティック)',spec)
            if not count_match:
                excluded+=1;continue # Grams/capsules/pouches are not sticks.
            components=sorted([(c,t) for c,t in cells if c[0]>=name_box[0]-0.1 and c[2]<=name_box[2]+0.1 and c[1]<y<c[3]],key=lambda item:item[0][0])
            cursor=name_box[0]; complete=True
            for c,t in components:
                if abs(c[0]-cursor)>1:complete=False
                cursor=c[2]
            if abs(cursor-name_box[2])>1:complete=False
            if not complete or not components or any(len(re.findall(r'(?:^|\n)\s*・',t))>1 for c,t in components):
                rejected.append({'page':page_no,'y':round(y,1),'reason':'Ambiguous branched name cell'});continue
            name=''.join(t.replace('\n',' ') for c,t in components).strip()
            if not name or len(name)>200:continue
            price_match=re.fullmatch(r'([\d,]+)\s*円',price.replace('\n',''))
            if not price_match:
                rejected.append({'page':page_no,'y':round(y,1),'reason':'Ambiguous price'});continue
            effective=None
            if date_box:
                date=at(date_box,y)
                m=re.fullmatch(r'(\d+)\s*[.．]\s*(\d+)\s*[.．]\s*(\d+)',date or '')
                if not m or not approval_date:
                    rejected.append({'page':page_no,'y':round(y,1),'reason':'Ambiguous revision date'});continue
                era=2018 if int(approval_date[:4])>=2019 else 1988
                effective=f'{int(m[1])+era:04}-{int(m[2]):02}-{int(m[3]):02}'
            product={'name':name,'type':'加熱式' if '加熱式' in kind else '葉巻' if '葉巻' in kind else '紙巻き',
                     'packPrice':int(price_match[1].replace(',','')),'count':int(count_match[1]),
                     'effectiveFrom':effective,'approvedAt':approval_date,'countries':country.splitlines(),
                     'source':url,'page':page_no,'status':'approved'}
            products.append(product)
    # Same approved SKU may appear with several production countries.
    grouped={}
    for p in products:
        key=(p['name'],p['packPrice'],p['count'],p['effectiveFrom'])
        if key in grouped:grouped[key]['countries']=sorted(set(grouped[key]['countries']+p['countries']))
        else:grouped[key]=p
    return {'products':list(grouped.values()),'quarantine':rejected,'excludedNonStickRows':excluded}

if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(parse_pdf(sys.argv[1],sys.argv[2]),ensure_ascii=False))
