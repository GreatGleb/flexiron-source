"""Закрыть строки журнала сверки: отметка, перенос в архив, снятие из очереди.
Вызов: python3 close.py '<domain>' '<mark>|<file.md>|<evidence>' ...
mark: 📦 (в архив) | ✅ (остаётся) | 🗑 (удалить)"""
import io,os,re,subprocess,sys
L='roo_code/plans/general/audit-ledger.md'; Q='roo_code/plans/general/implementation-queue.md'
dom=sys.argv[1]; items=[a.split('|',2) for a in sys.argv[2:]]
s=io.open(L,encoding='utf-8').read()
for mark,fn,ev in items:
    old='| ⬜ | `%s` |'%fn
    if old not in s: print('НЕТ В ЖУРНАЛЕ:',fn); continue
    i=s.index(old); j=s.index('\n',i); pr=s[i:j].split('|')
    pr[1]=' %s '%mark; pr[4]=' %s '%ev; s=s[:i]+'|'.join(pr)+s[j:]
rows=[l for l in s.split('\n') if re.match(r'^\| (⬜|📦|✅|🗑) \| `',l)]
done=sum(1 for l in rows if not l.startswith('| ⬜'))
s=re.sub(r'\*\*Проверено \d+ из \d+\.\*\*','**Проверено %d из %d.**'%(done,len(rows)),s,count=1)
io.open(L,'w',encoding='utf-8').write(s)
A='roo_code/plans/archive/2026-08/roo_code/'+dom
os.makedirs(A,exist_ok=True); moved=[]
for mark,fn,ev in items:
    src='roo_code/plans/%s/%s'%(dom,fn)
    if mark=='📦' and os.path.exists(src):
        subprocess.run(['git','mv',src,A+'/'+fn],check=True); moved.append(fn)
        p=A+'/'+fn; t=io.open(p,encoding='utf-8').read()
        t=re.sub(r'\]\((\.\./){2,5}frontend_vue/','](../../../../../../frontend_vue/',t)
        io.open(p,'w',encoding='utf-8').write(t)
    elif mark=='🗑' and os.path.exists(src):
        subprocess.run(['git','rm','-q',src],check=True); moved.append(fn)
gone={fn for mark,fn,_ in items if mark in ('📦','🗑')}
q=io.open(Q,encoding='utf-8').read(); out=[];r=0
for l in q.split('\n'):
    if l.startswith('| `roo_code/plans/%s/'%dom) and any('/%s`'%fn in l for fn in gone): r+=1; continue
    out.append(l)
q='\n'.join(out); q=re.sub(r'Задач \*\*(\d+)\*\*',lambda m:'Задач **%d**'%(int(m.group(1))-r),q,count=1)
def waves(q):
    ls=q.split('\n');c={};cur=None
    for i,l in enumerate(ls):
        if l.startswith('## Волна'): cur=i;c[cur]=0
        elif l.startswith('| `roo_code/plans/') and cur is not None: c[cur]+=1
    return ls,c
ls,c=waves(q); drop=set()
for i,n in c.items():
    if n==0:
        j=next((k for k in range(i+1,len(ls)) if ls[k].startswith('## Волна ')),len(ls)); drop|=set(range(i,j))
q='\n'.join(l for i,l in enumerate(ls) if i not in drop); n=[0]
q=re.sub(r'## Волна \d+ — ',lambda m:(n.__setitem__(0,n[0]+1),'## Волна %d — '%n[0])[1],q)
ls,c=waves(q)
for i,k in c.items():
    w='задача' if k==1 else('задачи' if 2<=k<=4 else 'задач')
    ls[i]=re.sub(r'— \d+ задач.*$','— %d %s'%(k,w),ls[i])
io.open(Q,'w',encoding='utf-8').write(re.sub(r'Волн \d+\.','Волн %d.'%n[0],'\n'.join(ls),count=1))
print('журнал: %d/%d | перенесено/удалено: %d | снято из очереди: %d'%(done,len(rows),len(moved),r))
