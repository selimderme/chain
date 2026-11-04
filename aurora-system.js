'use strict';
(() => {
  let weekOffset=0,optionsOpen=false;
  const en=()=>state.preferences?.language==='en',t=(tr,eng)=>en()?eng:tr;
  const icon=name=>'<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+({home:'<path d="m4 14 12-10 12 10v14H4Z"/><path d="M12 28V18h8v10"/>',stats:'<path d="M6 28V15m10 13V5m10 23V11" stroke-width="4"/>',discover:'<circle cx="16" cy="16" r="12"/><path d="m21 11-3 7-7 3 3-7Z"/>',calendar:'<rect x="4" y="7" width="24" height="21" rx="4"/><path d="M10 4v6m12-6v6M4 15h24m-17 6h3m4 0h3"/>',settings:'<circle cx="16" cy="16" r="5"/><path d="m12 4-2 4-4 2-2 5 3 3-1 4 4 3 2 4h6l2-4 4-2 3-5-3-3 1-4-4-3-2-4Z"/>',sun:'<path d="M5 25h22M9 21a7 7 0 0 1 14 0M16 2v5M4 8l4 4m20-4-4 4M1 19h5m20 0h5"/>',target:'<circle cx="14" cy="18" r="11"/><circle cx="14" cy="18" r="6"/><path d="m14 18 11-15m-1 0v5h5"/>',water:'<path d="M16 3C12 10 6 15 6 21a10 10 0 0 0 20 0c0-6-6-11-10-18Z" fill="currentColor"/><path d="M11 19c-2 4 1 7 4 7" stroke="#D8FAFF"/>',protein:'<path d="M10 16h12M5 12v8m4-12v16m14-16v16m4-12v8" stroke-width="4"/>',leaf:'<path d="M27 4C9 4 4 13 8 22c13 7 18-7 19-18Z" fill="currentColor"/><path d="m6 27 14-14" stroke="#D8FFF3"/>'}[name]||'')+'</svg>';
  function days() {const d=new Date(),start=addDays(d,-((d.getDay()+6)%7)+weekOffset*7);return Array.from({length:7},(_,i)=>addDays(start,i));}
  function color() {return '#00D9F5';}
  function emblem(h){const n=h.name.toLocaleLowerCase('tr-TR');return h.emoji?esc(h.emoji):icon(n.includes('su')&&h.tab==='beslenme'?'water':n.includes('protein')||h.tab==='egzersiz'?'protein':'leaf');}
  const overview=document.createElement('section');overview.id='auroraOverview';
  const tabs=document.querySelector('#tabs'),categories=document.createElement('div');categories.className='aurora-categories aurora-glass';tabs.before(overview,categories);categories.append(tabs);
  const more=document.createElement('button');more.className='aurora-category-more';more.type='button';more.setAttribute('aria-label','Görünüm ve sıralama');more.textContent='•••';categories.append(more);
  const dock=document.createElement('nav');dock.className='aurora-dock aurora-glass';dock.setAttribute('aria-label','Ana gezinme');document.body.append(dock);
  const brand=document.createElement('div');brand.className='aurora-brand';brand.innerHTML=icon('sun')+'<span></span>';document.querySelector('.topbar-head').prepend(brand);
  document.body.classList.add('aurora-app');
  let tabSignature='',summarySignature='',dockLanguage=null,cardNodes=new Map(),selectedTab='',revealFrame=0;
  function scheduleTabReveal(){cancelAnimationFrame(revealFrame);revealFrame=requestAnimationFrame(centerSelectedTab);}
  new ResizeObserver(scheduleTabReveal).observe(tabs);
  const circumference=2*Math.PI*26;
  function ensurePanel(){
    if(!document.querySelector('#auroraRoutine')){
      document.querySelector('#panel').innerHTML='<div id="auroraRoutine"><div class="aurora-options aurora-glass" hidden></div><div class="list aurora-list"></div><button type="button" class="aurora-add" data-add aria-label="Yeni alışkanlık ekle">+</button></div>';
      cardNodes=new Map();
    }
    return document.querySelector('#auroraRoutine');
  }
  function renderTabs(){
    const all=getTabs(),signature=JSON.stringify(all.map(x=>[x.id,x.name,x.emoji,x.color,x.customIcon]));
    if(tabSignature!==signature||!tabs.querySelector('.tab')){
      tabs.innerHTML=all.map(tab=>'<button type="button" role="tab" class="tab" id="tab-'+esc(tab.id)+'" data-tab="'+esc(tab.id)+'" aria-label="'+esc(tab.name)+'" style="--tab-color:'+tab.color+';--tab-ink:'+tab.ink+'"><span class="t-emoji" aria-hidden="true">'+(tab.id.startsWith('custom-')||tab.customIcon?esc(tab.emoji):categoryIcon(tab.id))+'</span><span>'+esc(!tab.customIcon?({bakim:'Bakım',ogrenme:'Öğrenme'})[tab.id]||tab.name:tab.name)+'</span><span class="t-count"></span></button>').join('')+'<button type="button" class="add-tab-btn" data-add-tab aria-label="Yeni sekme ekle">'+ICONS.plus+'</button>';
      tabSignature=signature;
      scheduleTabReveal();
    }
    tabs.querySelectorAll('.tab').forEach(button=>{const selected=button.dataset.tab===state.tab,h=state.habits.filter(x=>x.tab===button.dataset.tab),count=h.filter(x=>getMark(x.id,todayInfo().key)==='g').length;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;button.querySelector('.t-count').textContent=count+'/'+h.length;});
    if(selectedTab!==state.tab){selectedTab=state.tab;scheduleTabReveal();}
    document.querySelector('#panel').setAttribute('aria-labelledby','tab-'+state.tab);
  }
  function dayMarkup(h,month=false){
    const today=todayInfo().key,dates=month?Array.from({length:daysInMonth(view.y,view.m)},(_,i)=>new Date(view.y,view.m,i+1)):days();
    return dates.map(date=>{const key=keyOf(date);return '<div class="reference-day"><button type="button" class="reference-day-touch" data-cell data-id="'+esc(h.id)+'" data-date="'+key+'" '+(key>today?'disabled':'')+'><span class="reference-day-circle"></span>'+(!month?'<small>'+date.toLocaleDateString(en()?'en-GB':'tr-TR',{weekday:'short'})+'</small>':'')+'</button></div>';}).join('');
  }
  function faceMarkup(h){
    const g=h.goal,has=g&&g.type!=='none'&&g.target>0,quantity=has&&g.type!=='timer';
    const complete=has&&!quantity?'<button type="button" class="reference-complete" data-aurora-goal="'+esc(h.id)+'" aria-label="'+esc(h.name)+' sayacını aç">▷</button>':'<button type="button" class="reference-complete" data-cell data-complete data-id="'+esc(h.id)+'" data-date="'+todayInfo().key+'"></button>';
    const counter=quantity?'<div class="reference-counter"><button type="button" data-quick-adjust="-1" data-habit-id="'+esc(h.id)+'" aria-label="'+esc(h.name)+' miktarını azalt">−</button><button type="button" class="reference-amount" data-aurora-goal="'+esc(h.id)+'" aria-label="'+esc(h.name)+' miktarını düzenle"></button><button type="button" class="reference-plus" data-quick-adjust="1" data-habit-id="'+esc(h.id)+'" aria-label="'+esc(h.name)+' miktarını artır">+</button></div>':'<div class="reference-value"></div>';
    return '<div class="card-head" data-card-head="'+esc(h.id)+'"><span class="reference-emblem">'+emblem(h)+'</span><div class="reference-card-info"><div class="reference-title-row"><h4>'+esc(h.name)+'</h4></div>'+counter+'</div><div class="reference-card-actions">'+complete+'<button type="button" data-edit="'+esc(h.id)+'" class="reference-more" aria-label="'+esc(h.name)+' düzenle">•••</button></div></div>'+(has?'<div class="'+(quantity?'reference-quantity-track':'reference-timer-track')+' aurora-track" role="progressbar" aria-label="'+esc(h.name)+'" aria-valuemin="0" aria-valuemax="100"><i></i></div>':'')+'<div class="reference-calendar"></div>';
  }
  function updateCard(card,h,i){
    const g=h.goal,has=g&&g.type!=='none'&&g.target>0,quantity=has&&g.type!=='timer',today=todayInfo().key,amount=getProgress(h.id,today),mark=getMark(h.id,today),completed=mark==='g';
    const sig=JSON.stringify([h.name,h.detail,h.emoji,g,en(),reorderMode,today]);
    if(card.dataset.structure!==sig){
      card.className='card aurora-habit aurora-glass'+(!has?' no-goal':'')+(reorderMode?' compact':'');
      card.innerHTML=reorderMode?'<span class="handle" data-handle aria-hidden="true">⠿</span><div class="c-name"><h4>'+esc(h.name)+'</h4></div><button type="button" class="icon-btn" data-move="-1" data-id="'+esc(h.id)+'" aria-label="'+esc(h.name)+' yukarı taşı">▲</button><button type="button" class="icon-btn" data-move="1" data-id="'+esc(h.id)+'" aria-label="'+esc(h.name)+' aşağı taşı">▼</button>':faceMarkup(h);
      card.dataset.structure=sig;card.dataset.calendar='';
    }
    card.style.setProperty('--habit-accent',color(h,i));
    if(reorderMode)return;
    const litres=g?.type==='amount'&&g.unit?.toLowerCase()==='ml'&&g.target>=1000,shown=litres?amount/1000:amount,target=g?litres?g.target/1000:g.target:0,unit=litres?'L':g?.type==='reps'?t('tekrar','reps'):g?.unit||'';
    const formatter=new Intl.NumberFormat(en()?'en-GB':'tr-TR',{maximumFractionDigits:2});
    const value=card.querySelector('.reference-value');
    if(value)value.textContent=has?g.type==='timer'?fmtDuration(amount)+' / '+fmtTimerReadable(g.target):formatter.format(shown)+' / '+formatter.format(target)+' '+unit:h.detail||t(completed?'Bugün tamamlandı':'Günlük alışkanlık',completed?'Completed today':'Daily habit');
    const track=card.querySelector('.aurora-track');
    if(track){const percentage=Number.isFinite(amount)?Math.max(0,Math.min(100,amount/g.target*100)):0;track.querySelector('i').style.width=percentage+'%';track.setAttribute('aria-valuenow',Math.round(percentage));}
    if(quantity)card.querySelector('.reference-amount').textContent=formatter.format(shown)+' '+unit;
    if(!has||quantity){const button=card.querySelector('.reference-complete');button.textContent=quantity||completed?'✓':'○';button.classList.toggle('is-complete',completed);button.setAttribute('aria-pressed',String(completed));button.setAttribute('aria-label',h.name+t(completed?' tamamlandı işaretini kaldır':' bugün tamamla',completed?' unmark completion':' complete today'));}
    const calendar=card.querySelector('.reference-calendar'),calendarSig=[monthlyViewMode,view.y,view.m,weekOffset,en(),today].join('|');
    if(card.dataset.calendar!==calendarSig){calendar.className='reference-calendar '+(monthlyViewMode?'reference-month':'reference-week');calendar.innerHTML=dayMarkup(h,monthlyViewMode);card.dataset.calendar=calendarSig;}
    calendar.querySelectorAll('[data-cell]').forEach(button=>{const key=button.dataset.date,status=getMark(h.id,key),current=key===today;button.className='reference-day-touch'+(current?' current':'')+(status?' mark-'+status:'');button.querySelector('.reference-day-circle').textContent=monthlyViewMode?parseKey(key).getDate():status==='g'?'✓':status==='r'?'×':status==='b'?'!':parseKey(key).getDate();button.setAttribute('aria-label',h.name+', '+fmtDay.format(parseKey(key))+': '+(status?MARKS[status].label:'İşaretsiz')+(current?t(', bugün',', today'):''));});
  }
  function renderPanel(){
    if(state.section==='kesfet'&&window.DiscoverWeb){window.DiscoverWeb.renderPanel();return;}
    const root=ensurePanel(),list=root.querySelector('.aurora-list'),habits=state.habits.filter(h=>h.tab===state.tab),ids=new Set(habits.map(h=>h.id));
    if(drag&&drag.list===list&&drag.tab===state.tab)return;
    list.classList.toggle('reordering',reorderMode);
    for(const [id,node] of cardNodes){if(!ids.has(id)){node.remove();cardNodes.delete(id);}}
    habits.forEach((h,i)=>{let node=cardNodes.get(h.id);if(!node){node=document.createElement('article');node.dataset.habit=h.id;node.className='card aurora-habit aurora-glass aurora-card-enter';cardNodes.set(h.id,node);}updateCard(node,h,i);if(!node.isConnected)node.classList.add('aurora-card-enter');if(list.children[i]!==node)list.insertBefore(node,list.children[i]||null);});
    root.querySelector('.aurora-add').hidden=reorderMode;
    let empty=root.querySelector('.aurora-empty');if(!habits.length&&!empty){empty=document.createElement('p');empty.className='empty aurora-empty';empty.textContent=t('Bu sekmede henüz madde yok. ＋ ile başla.','No habits in this category. Start with ＋.');list.append(empty);}else if(habits.length)empty?.remove();
    const options=root.querySelector('.aurora-options'),optionSig=[view.y,view.m,monthlyViewMode,reorderMode,habits.length,en()].join('|');
    options.hidden=!(optionsOpen||reorderMode||monthlyViewMode);
    if(options.dataset.signature!==optionSig){
      const now=new Date(),current=view.y===now.getFullYear()&&view.m===now.getMonth();
      options.innerHTML='<div class="routine-tools-row"><div class="routine-month"><button type="button" data-month="-1" aria-label="'+t('Önceki ay','Previous month')+'">‹</button><button type="button" class="routine-month-title" data-month="today" aria-label="'+t('Bu aya dön','Return to this month')+'">'+new Date(view.y,view.m,1).toLocaleDateString(en()?'en-GB':'tr-TR',{month:'long',year:'numeric'})+'</button><button type="button" data-month="1" aria-label="'+t('Sonraki ay','Next month')+'">›</button></div><button type="button" class="routine-control" data-monthly aria-label="'+t('Aylık görünümü aç veya kapat','Toggle monthly view')+'" aria-pressed="'+monthlyViewMode+'">'+ICONS.calendar+'<span class="routine-label-full">'+t('Aylık Görünüm','Monthly')+'</span><span class="routine-label-short">'+t('Aylık','Month')+'</span></button>'+(habits.length>1||reorderMode?'<button type="button" class="routine-control" data-reorder aria-pressed="'+reorderMode+'">'+(reorderMode?'<span aria-hidden="true">✓</span>':ICONS.sort)+'<span>'+t(reorderMode?'Bitti':'Sırala',reorderMode?'Done':'Reorder')+'</span></button>':'')+'</div>'+((reorderMode||!current)?'<div class="routine-hint-row">'+(reorderMode?'<span>'+t('Kartı basılı tut, yukarı veya aşağı sürükle.','Hold a card, then drag up or down.')+'</span>':'')+(!current?'<button type="button" data-month="today">'+t('Bu ay','This month')+'</button>':'')+'</div>':'');
      options.dataset.signature=optionSig;
    }
  }
  function renderSummary(){
    const today=todayInfo().key,signature=[today,weekOffset,en()].join('|');
    if(summarySignature!==signature){
      overview.innerHTML='<div class="aurora-day-heading"><div><h1>'+t('Bugün','Today')+'</h1><p>'+new Date().toLocaleDateString(en()?'en-GB':'tr-TR',{day:'numeric',month:'long',weekday:'long'})+'</p></div><div class="reference-header-week"><button type="button" data-week-shift="-1" aria-label="Önceki hafta">‹</button>'+days().map(d=>'<div class="reference-header-day '+(keyOf(d)===today?'current':'')+'"><span>'+d.getDate()+'</span><small>'+d.toLocaleDateString(en()?'en-GB':'tr-TR',{weekday:'short'})+'</small></div>').join('')+'<button type="button" data-week-shift="1" aria-label="Sonraki hafta">›</button></div></div><article class="aurora-summary aurora-glass"><div class="reference-summary-top"><span class="reference-target">'+icon('target')+'</span><div><p>'+t('Günlük ilerleme','Daily progress')+'</p><strong><b class="summary-count"></b> <span>'+t('tamamlandı','completed')+'</span></strong></div></div><div class="aurora-track" role="progressbar" aria-label="Günlük ilerleme" aria-valuemin="0" aria-valuemax="100"><i></i></div><div class="aurora-ring"><svg viewBox="0 0 68 68"><defs><linearGradient id="web-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#68dfff"/><stop offset="1" stop-color="#3e8aff"/></linearGradient></defs><circle class="ring-track" cx="34" cy="34" r="26" stroke="#7186ff42" stroke-width="6" fill="none"/><circle class="ring-value" cx="34" cy="34" r="26" stroke="url(#web-ring)" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="'+circumference+' '+circumference+'"/></svg><span></span></div></article>';
      summarySignature=signature;
    }
    const habits=state.habits.filter(h=>h.tab===state.tab),done=habits.filter(h=>getMark(h.id,today)==='g').length,pct=habits.length?Math.round(done/habits.length*100):0;
    overview.querySelector('.summary-count').textContent=done+' / '+habits.length;
    overview.querySelector('.aurora-track').setAttribute('aria-valuenow',pct);
    overview.querySelector('.aurora-track>i').style.width=pct+'%';
    overview.querySelector('.ring-value').style.strokeDashoffset=circumference*(1-pct/100);overview.querySelector('.ring-value').style.opacity=pct?1:0;overview.querySelector('.aurora-ring>span').textContent='%'+pct;
  }
  function renderAurora(){
    const discovering=!profileOpen&&state.section==='kesfet'&&!state.sessionLocked;
    const routine=!profileOpen&&state.section!=='gorevler'&&state.section!=='kesfet'&&!state.sessionLocked;
    window.DiscoverWeb?.onNavigation(discovering);
    overview.hidden=categories.hidden=!routine;dock.hidden=!!state.sessionLocked||document.body.dataset.profileSection==='settings';more.setAttribute('aria-expanded',String(optionsOpen||reorderMode||monthlyViewMode));
    brand.querySelector('span').textContent=t('Günlük Rutin','Daily Routine');const daily=document.querySelector('#topModeTabs [data-section="rutin"]');if(daily)daily.textContent=t('Günlük','Daily');
    if(routine)renderSummary();
    if(dockLanguage!==en()){dock.innerHTML=[['home',t('Bugün','Today')],['stats',t('İstatistikler','Statistics')],['discover',t('Keşfet','Discover')],['settings',t('Ayarlar','Settings')]].map(([key,label])=>'<button type="button" data-aurora-nav="'+key+'" aria-label="'+label+'"><span class="dock-icon">'+icon(key)+'</span><small>'+label+'</small></button>').join('');dockLanguage=en();}
    dock.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String((routine&&button.dataset.auroraNav==='home')||(discovering&&button.dataset.auroraNav==='discover')||(profileOpen&&button.dataset.auroraNav===document.body.dataset.profileSection))));
  }
  more.addEventListener('click',()=>{optionsOpen=!optionsOpen;render();});
  overview.addEventListener('click',e=>{const step=e.target.closest('[data-week-shift]');if(step){weekOffset+=Number(step.dataset.weekShift);render();}});
  dock.addEventListener('click',e=>{const action=e.target.closest('[data-aurora-nav]')?.dataset.auroraNav;if(!action)return;if(action==='stats'||action==='settings'){window.ProfileWeb.openSection(action);return;}window.ProfileWeb.closeSection();state.section=action==='discover'?'kesfet':'rutin';reorderMode=false;taskReorderMode=false;if(action==='home'){monthlyViewMode=false;weekOffset=0;}save();render();window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
  document.querySelector('#panel').addEventListener('click',e=>{const step=e.target.closest('[data-quick-adjust]');if(step){const h=state.habits.find(x=>x.id===step.dataset.habitId);if(h?.goal&&['amount','reps'].includes(h.goal.type))setProgressAndAutoMark(h,todayInfo().key,getProgress(h.id,todayInfo().key)+Number(step.dataset.quickAdjust)*getQuickStepsWeb(h.goal)[0]);return;}const id=e.target.closest('[data-aurora-goal]')?.dataset.auroraGoal;if(id){const h=state.habits.find(x=>x.id===id);if(h)openActionModal(h);}});
  window.AuroraWeb={render:renderAurora,renderPanel,renderTabs,icon,resetHomeView(){weekOffset=0;optionsOpen=false;}};render();
})();
