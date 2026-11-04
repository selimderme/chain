'use strict';

(() => {
  let filter = 'all', query = '', signature = '', notice = '', noticeTab = '';
  let adding = null, simulation = null, frameId = 0, elapsed = 0, started = 0, running = false;
  const t = (tr, en) => state.preferences?.language === 'en' ? en : tr;
  const catalog = () => window.DiscoverCatalog;
  const title = item => t(item.name, item.nameEn);
  const detail = item => t(item.detail, item.detailEn);
  const exists = item => catalog().exists(state.habits, item);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const addDialog = document.createElement('dialog');
  addDialog.className = 'editor discover-dialog'; addDialog.id = 'discoverAddDialog';
  addDialog.setAttribute('aria-labelledby', 'discoverAddTitle'); document.body.append(addDialog);
  const simDialog = document.createElement('dialog');
  simDialog.className = 'editor discover-dialog discover-simulation-dialog'; simDialog.id = 'discoverSimulationDialog';
  simDialog.setAttribute('aria-labelledby', 'discoverSimulationTitle'); document.body.append(simDialog);

  function goalLabel(item) {
    if (item.goalType === 'timer') return Math.round(item.goalTarget / 60) + t(' dk', ' min');
    if (item.goalType === 'reps') return item.goalTarget + t(' tekrar', ' reps');
    if (item.goalType === 'amount') return item.goalTarget + ' ' + (item.goalUnit === 'sayfa' ? t('sayfa', 'pages') : item.goalUnit === 'adım' ? t('adım', 'steps') : item.goalUnit);
    return t('Her gün', 'Daily');
  }
  function card(item) {
    const added = exists(item);
    return '<article class="discover-card aurora-glass" style="--discover-accent:' + ({mind:'#B6A0FF',move:'#64E2C0',care:'#F5A1D7',focus:'#66D9FF'})[item.category] + '"><div class="discover-card-top"><span class="discover-emoji" aria-hidden="true">' + esc(item.emoji) + '</span><span class="discover-goal">' + esc(goalLabel(item)) + '</span></div><h3>' + esc(title(item)) + '</h3><p>' + esc(detail(item)) + '</p><div class="discover-card-actions">' + (item.simulation ? '<button type="button" class="discover-preview" data-discover-preview="' + esc(item.id) + '"><span aria-hidden="true">▷</span> ' + t('Animasyonu aç', 'Open animation') + '</button>' : '') + '<button type="button" class="discover-add-button" data-discover-add="' + esc(item.id) + '" ' + (added ? 'disabled' : '') + '>' + (added ? '✓ ' + t('Rutininde', 'In your routine') : '＋ ' + t('Rutine ekle', 'Add to routine')) + '</button></div></article>';
  }
  function renderResults() {
    const root = document.querySelector('#discoverPage'); if (!root) return;
    const q = query.trim().toLocaleLowerCase('tr-TR');
    const items = catalog().habits.filter(item => (filter === 'all' || item.category === filter) && (!q || [item.name,item.nameEn,item.detail,item.detailEn].join(' ').toLocaleLowerCase('tr-TR').includes(q)));
    root.querySelector('.discover-results').innerHTML = items.length ? items.map(card).join('') : '<div class="discover-empty aurora-glass"><span aria-hidden="true">⌕</span><h3>' + t('Bir eşleşme bulunamadı', 'No matching habits') + '</h3><p>' + t('Başka bir kelime dene veya tüm alışkanlıklara göz at.', 'Try another word or browse all habits.') + '</p><button type="button" data-discover-clear>' + t('Tümünü göster', 'Show all') + '</button></div>';
    root.querySelector('.discover-result-count').textContent = items.length + ' ' + t('hazır alışkanlık', 'ready-made habits');
    root.querySelectorAll('[data-discover-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.discoverFilter === filter)));
  }
  function renderPanel() {
    if (!catalog()) return;
    const next = JSON.stringify([state.preferences?.language, state.habits.map(h => [h.id,h.name,h.templateId]), getTabs().map(tab => [tab.id,tab.name])]);
    if (document.querySelector('#discoverPage') && signature === next) return;
    signature = next;
    document.querySelector('#panel').innerHTML = '<section id="discoverPage" class="discover-page" aria-labelledby="discoverTitle"><header class="discover-heading"><div class="discover-eyebrow">' + t('KÜÇÜK ADIMLAR, YENİ RUTİNLER', 'SMALL STEPS, NEW ROUTINES') + '</div><h1 id="discoverTitle">' + t('Keşfet', 'Discover') + '<span aria-hidden="true">✧</span></h1><p>' + t('Sana iyi gelecek bir alışkanlık bul. Kendi ritminle başla.', 'Find a habit that fits your day. Start at your own pace.') + '</p></header><div class="discover-featured"><button type="button" class="discover-feature aurora-glass" data-discover-feature="breathing"><span class="discover-feature-art discover-breath-art" aria-hidden="true"><i></i><b>◌</b></span><span><small>' + t('BİR DAKİKA KENDİNE', 'ONE MINUTE FOR YOURSELF') + '</small><strong>' + t('Nefesine odaklan', 'Focus on your breath') + '</strong><em>' + t('Animasyonla ritmi yakala', 'Follow the animated rhythm') + ' ↗</em></span></button><button type="button" class="discover-feature aurora-glass" data-discover-feature="pushup"><span class="discover-feature-art discover-move-art" aria-hidden="true">' + pushupSvg('preview') + '</span><span><small>' + t('HAREKETE GEÇ', 'GET MOVING') + '</small><strong>' + t('Bir tekrar daha', 'One more rep') + '</strong><em>' + t('Şınav temposunu keşfet', 'Explore the push-up pace') + ' ↗</em></span></button></div><div class="discover-toolbar"><label class="discover-search"><span aria-hidden="true">⌕</span><input type="search" id="discoverSearch" autocomplete="off" placeholder="' + t('Alışkanlık ara…', 'Search habits…') + '" aria-label="' + t('Hazır alışkanlık ara', 'Search ready-made habits') + '" value="' + esc(query) + '"></label><div class="discover-filters" role="group" aria-label="' + t('Alışkanlık kategorileri', 'Habit categories') + '">' + [{id:'all',name:'Tümü',nameEn:'All'},...catalog().categories].map(category => '<button type="button" data-discover-filter="' + esc(category.id) + '" aria-pressed="' + (filter === category.id) + '">' + esc(t(category.name,category.nameEn)) + '</button>').join('') + '</div></div><div class="discover-library-heading"><h2>' + t('Rutinine ilham kat', 'Inspiration for your routine') + '</h2><span class="discover-result-count"></span></div><div class="discover-notice" role="status" ' + (!notice ? 'hidden' : '') + '><span>' + esc(notice) + '</span><button type="button" data-discover-view-routine>' + t('Rutine git', 'View routine') + ' →</button></div><div class="discover-results"></div></section>';
    renderResults();
  }
  function openAdd(item) {
    if (!item || exists(item)) return;
    if (running) { elapsed=currentElapsed();running=false;cancelAnimationFrame(frameId);drawSimulation(); }
    adding = item;
    const tabs = getTabs(), selected = tabs.some(tab => tab.id === item.tab) ? item.tab : tabs.some(tab => tab.id === state.tab) ? state.tab : tabs[0]?.id;
    addDialog.innerHTML = '<div class="discover-dialog-header"><span class="discover-emoji" aria-hidden="true">' + esc(item.emoji) + '</span><button type="button" class="discover-close" data-discover-close aria-label="' + t('Kapat', 'Close') + '">×</button></div><h2 id="discoverAddTitle">' + esc(title(item)) + '</h2><p class="discover-dialog-detail">' + esc(detail(item)) + '</p><span class="discover-goal">' + esc(goalLabel(item)) + '</span><label class="discover-destination-label" for="discoverDestination">' + t('Hangi rutin sekmesine eklensin?', 'Choose a routine category') + '</label><select id="discoverDestination">' + tabs.map(tab => '<option value="' + esc(tab.id) + '" ' + (tab.id === selected ? 'selected' : '') + '>' + esc(tab.emoji + ' ' + tab.name) + '</option>').join('') + '</select><p class="discover-dialog-hint">' + t('Hedefi ve adını rutininden dilediğin zaman düzenleyebilirsin.', 'You can edit the name and goal in your routine at any time.') + '</p><div class="discover-dialog-actions"><button type="button" data-discover-close>' + t('Vazgeç', 'Cancel') + '</button><button type="button" class="discover-add-button" data-discover-confirm>' + t('Rutine ekle', 'Add to routine') + '</button></div>';
    addDialog.showModal();
  }
  function addHabit() {
    const item = adding, tab = document.querySelector('#discoverDestination')?.value;
    if (!item || !getTabs().some(entry => entry.id === tab)) return;
    if (!exists(item)) {
      state.habits.push({id:uid(),templateId:item.id,tab,name:title(item),detail:detail(item),emoji:item.emoji,...(item.goalType !== 'none' ? {goal:{type:item.goalType,target:item.goalTarget,unit:item.goalUnit}} : {}),subtasks:[]});
      save(); notice = title(item) + t(' rutinine eklendi.', ' was added to your routine.'); noticeTab = tab;
    }
    addDialog.close(); adding = null; signature = ''; render();
    if (simulation) { const button = simDialog.querySelector('[data-simulation-add]'); if (button) { button.disabled = true; button.textContent = '✓ ' + t('Rutininde', 'In your routine'); } }
  }
  function pushupSvg(prefix) {
    return '<svg viewBox="0 0 280 155" fill="none" aria-hidden="true"><path d="M22 125h236" stroke="currentColor" stroke-opacity=".23" stroke-width="2" stroke-linecap="round"/><ellipse cx="144" cy="127" rx="99" ry="7" fill="currentColor" opacity=".07"/><g stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path data-pushup-body d="M36 119 105 88 174 61"/><path data-pushup-arm d="M174 61 174 103 211 119"/><path data-pushup-neck d="m174 61 14-8"/><circle data-pushup-head cx="201" cy="47" r="12" fill="currentColor" stroke-width="2"/><path d="M30 120h15m159 0h15" stroke-width="5"/></g></svg>';
  }
  function totalTime() { return simulation?.simulation === 'breathing' ? 60000 : (simulation?.goalTarget || 10) * 4000; }
  function currentElapsed() { return Math.min(totalTime(), elapsed + (running ? performance.now() - started : 0)); }
  function drawSimulation() {
    if (!simulation || !simDialog.open) return;
    const ms = currentElapsed(), kind = simulation.simulation, f = catalog().simulationFrame(kind,ms), done = ms >= totalTime(), seconds = Math.max(0,Math.ceil((totalTime()-ms)/1000));
    const label = done ? t('Seans tamamlandı', 'Session complete') : kind === 'breathing' ? f.phase === 'inhale' ? t('Nefes al', 'Breathe in') : t('Nefes ver', 'Breathe out') : f.phase === 'down' ? t('Alçal', 'Lower') : t('Yüksel', 'Rise');
    simDialog.querySelector('.discover-phase').textContent = label;
    simDialog.querySelector('.discover-phase-count').textContent = done ? '✓' : String(f.remainingSeconds);
    simDialog.querySelector('.discover-session-value').textContent = kind === 'breathing' ? Math.floor(seconds/60) + ':' + String(seconds%60).padStart(2,'0') : Math.min(simulation.goalTarget || 10,f.cycles) + ' / ' + (simulation.goalTarget || 10) + t(' tekrar', ' reps');
    simDialog.querySelector('.discover-session-progress>i').style.width = (ms/totalTime()*100) + '%';
    let expansion = reducedMotion.matches ? (f.phase === 'inhale' || f.phase === 'up' ? 0 : 1) : f.expansion;
    if (kind === 'breathing') simDialog.querySelector('.discover-breath-orb').style.transform = 'scale(' + (.66 + .34*expansion) + ')';
    else {
      const stage=simDialog.querySelector('.discover-pushup-stage'),x=174+3*expansion,y=61+28*expansion,hx=105,hy=88+10*expansion,wx=211,wy=119,dx=wx-x,dy=wy-y,d=Math.hypot(dx,dy),height=Math.sqrt(Math.max(0,40*40-d*d/4)),ex=(x+wx)/2-dy/d*height,ey=(y+wy)/2+dx/d*height;
      stage.querySelector('[data-pushup-body]').setAttribute('d',`M36 119 ${hx} ${hy} ${x} ${y}`);
      stage.querySelector('[data-pushup-arm]').setAttribute('d',`M${x} ${y} ${ex} ${ey} ${wx} ${wy}`);
      stage.querySelector('[data-pushup-neck]').setAttribute('d',`M${x} ${y} ${x+14} ${y-8}`);
      stage.querySelector('[data-pushup-head]').setAttribute('cx',x+27);stage.querySelector('[data-pushup-head]').setAttribute('cy',y-14);
    }
    if (done && running) { running=false;elapsed=totalTime();cancelAnimationFrame(frameId); }
    simDialog.querySelector('[data-simulation-toggle]').textContent = done ? t('Yeniden başla', 'Start again') : running ? t('Duraklat', 'Pause') : ms ? t('Devam et', 'Resume') : t('Başlat', 'Start');
    simDialog.querySelector('.discover-simulation-note').textContent = done ? t('Bu bir tempo rehberidir. Egzersizi yaptıysan rutininden tamamlandı olarak işaretleyebilirsin.', 'This is a pacing guide. If you did the exercise, you can mark it complete in your routine.') : t('Animasyon bir tempo rehberidir. İlerlemen otomatik işaretlenmez.', 'The animation is a pacing guide. It does not mark your progress automatically.');
    if (running) frameId=requestAnimationFrame(drawSimulation);
  }
  function closeSimulation() { cancelAnimationFrame(frameId); running=false;elapsed=0;simulation=null; }
  function openSimulation(item) {
    if (!item?.simulation) return;
    closeSimulation(); simulation=item;
    const breathing=item.simulation==='breathing';
    simDialog.innerHTML='<div class="discover-dialog-header"><span class="discover-simulation-tag">'+t('ANİMASYONLU EGZERSİZ','ANIMATED EXERCISE')+'</span><button type="button" class="discover-close" data-simulation-close aria-label="'+t('Kapat','Close')+'">×</button></div><h2 id="discoverSimulationTitle">'+esc(title(item))+'</h2><p class="discover-dialog-detail">'+(breathing?t('4 saniye nefes al · 6 saniye nefes ver','Breathe in for 4 seconds · Breathe out for 6 seconds'):t('2 saniye alçal · 2 saniye yüksel','Lower for 2 seconds · Rise for 2 seconds'))+'</p><div class="discover-simulation-stage '+(breathing?'discover-breath-stage':'discover-pushup-stage')+'">'+(breathing?'<div class="discover-breath-ring"></div><div class="discover-breath-orb"></div>':pushupSvg('session'))+'</div><div class="discover-phase" aria-live="off"></div><div class="discover-phase-count" aria-hidden="true"></div><div class="discover-session-meta"><span>'+t('Seans','Session')+'</span><strong class="discover-session-value"></strong></div><div class="discover-session-progress"><i></i></div><div class="discover-dialog-actions discover-simulation-actions"><button type="button" data-simulation-reset>'+t('Sıfırla','Reset')+'</button><button type="button" class="discover-add-button" data-simulation-toggle>'+t('Başlat','Start')+'</button></div><p class="discover-simulation-note"></p><button type="button" class="discover-simulation-add" data-simulation-add '+(exists(item)?'disabled':'')+'>'+(exists(item)?'✓ '+t('Rutininde','In your routine'):'＋ '+t('Bu alışkanlığı rutinime ekle','Add this habit to my routine'))+'</button>';
    simDialog.showModal();drawSimulation();
  }
  document.querySelector('#panel').addEventListener('input',event=>{if(event.target.id==='discoverSearch'){query=event.target.value;renderResults();}});
  document.querySelector('#panel').addEventListener('click',event=>{
    const target=event.target.closest('button');if(!target)return;
    if(target.hasAttribute('data-discover-filter')){filter=target.dataset.discoverFilter;renderResults();}
    else if(target.hasAttribute('data-discover-clear')){filter='all';query='';document.querySelector('#discoverSearch').value='';renderResults();}
    else if(target.dataset.discoverAdd)openAdd(catalog().habits.find(item=>item.id===target.dataset.discoverAdd));
    else if(target.dataset.discoverPreview)openSimulation(catalog().habits.find(item=>item.id===target.dataset.discoverPreview));
    else if(target.dataset.discoverFeature)openSimulation(catalog().habits.find(item=>item.simulation===target.dataset.discoverFeature));
    else if(target.hasAttribute('data-discover-view-routine')){state.tab=getTabs().some(tab=>tab.id===noticeTab)?noticeTab:getTabs()[0].id;state.section='rutin';profileOpen=false;save();render();window.scrollTo({top:0,behavior:reducedMotion.matches?'instant':'smooth'});}
  });
  addDialog.addEventListener('click',event=>{if(event.target===addDialog||event.target.closest('[data-discover-close]'))addDialog.close();else if(event.target.closest('[data-discover-confirm]'))addHabit();});
  addDialog.addEventListener('close',()=>{adding=null;});
  simDialog.addEventListener('click',event=>{
    if(event.target===simDialog||event.target.closest('[data-simulation-close]')){simDialog.close();return;}
    if(event.target.closest('[data-simulation-toggle]')){
      if(running){elapsed=currentElapsed();running=false;cancelAnimationFrame(frameId);}else{if(elapsed>=totalTime())elapsed=0;started=performance.now();running=true;}
      drawSimulation();
    }else if(event.target.closest('[data-simulation-reset]')){cancelAnimationFrame(frameId);running=false;elapsed=0;drawSimulation();}
    else if(event.target.closest('[data-simulation-add]'))openAdd(simulation);
  });
  simDialog.addEventListener('close',closeSimulation);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){elapsed=currentElapsed();running=false;cancelAnimationFrame(frameId);drawSimulation();}});
  function onNavigation(active){
    document.body.dataset.discover=String(active);
    if(active){document.querySelector('#panel').setAttribute('aria-labelledby','discoverTitle');document.querySelector('#mainFoot').hidden=true;document.querySelectorAll('#topModeTabs [data-section]').forEach(button=>button.classList.remove('active'));}
    else{if(simDialog.open)simDialog.close();if(addDialog.open)addDialog.close();}
  }
  window.DiscoverWeb={renderPanel,onNavigation};
})();
