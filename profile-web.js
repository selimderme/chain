'use strict';

// The standalone client shares its existing habits, marks and backup storage.
(() => {
  let photoMenu = false, photoPrevious = '', settingsPage = 'root';
  let section = null, editing = false, confirming = false, undo = null, message = '';
  const prefs = () => {
    const p = state.preferences || {};
    return {theme: ['light', 'system'].includes(p.theme) ? p.theme : 'dark', language: p.language === 'en' ? 'en' : 'tr', notifications: p.notifications !== false};
  };
  const t = (tr, en) => prefs().language === 'en' ? en : tr;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const button = (label, action, selected = false, extra = '') => `<button type="button" class="pill" data-profile-action="${action}" aria-pressed="${selected}" ${extra}>${label}</button>`;
  function applyAppearance() {
    const p = prefs();
    document.body.dataset.appearance = p.theme === 'system' ? (media.matches ? 'dark' : 'light') : p.theme;
    document.documentElement.lang = p.language;
    document.body.dataset.profileSection = profileOpen && !state.sessionLocked ? section || '' : '';
    document.body.dataset.settings = profileOpen && (section === 'settings' || section === 'stats') && !state.sessionLocked ? 'true' : 'false';
  }
  function renderSession() {
    if (!state.sessionLocked) return false;
    $('#tabs').hidden = true; $('#mainFoot').hidden = true;
    $('#panel').innerHTML = '<article class="card session-card"><div class="profile-avatar-lg">🌱</div><h2>'+t('Görüşmek üzere','See you soon')+'</h2><p>'+t('Yerel oturumun kapatıldı. Kayıtların bu cihazda saklanıyor.','Your local session is closed. Your data is saved on this device.')+'</p>'+button(t('Yerel profille devam et','Continue with local profile'),'return')+'</article>';
    return true;
  }
  media.addEventListener('change', () => { if (prefs().theme === 'system') render(); });

  function stats() {
    const today = keyOf(new Date());
    return state.habits.map(h => ({ ...h, ...streaks(h.id, today), completed: Object.entries(state.marks[h.id] || {}).filter(([d, m]) => d <= today && m === 'g').length }))
      .sort((a, b) => b.cur - a.cur || b.best - a.best || a.name.localeCompare(b.name, 'tr'));
  }
  function radar(rows) {
    const count = Math.max(3, rows.length), scale = Math.max(7, Math.ceil(Math.max(0, ...rows.map(h => h.best)) / 7) * 7);
    const point = (i, value, radius = 98) => { const angle = -Math.PI / 2 + i * 2 * Math.PI / count; return [180 + Math.cos(angle) * radius * value / scale, 155 + Math.sin(angle) * radius * value / scale]; };
    const points = values => Array.from({ length: count }, (_, i) => point(i, values[i] || 0).join(',')).join(' ');
    return `<svg class="streak-radar" viewBox="0 0 360 310" role="img" aria-label="${t('Alışkanlık zincirleri radar grafiği', 'Habit streak radar chart')}">
      ${[.25, .5, .75, 1].map(r => `<polygon points="${points(Array(count).fill(scale * r))}" class="radar-grid"/>`).join('')}
      ${Array.from({ length: count }, (_, i) => { const [x, y] = point(i, scale); return `<line x1="180" y1="155" x2="${x}" y2="${y}" class="radar-grid"/>`; }).join('')}
      <polygon points="${points(rows.map(h => h.best))}" class="radar-best"/>
      <polygon points="${points(rows.map(h => h.cur))}" class="radar-current"/>
      ${rows.map((h, i) => { const [x, y] = point(i, h.cur), [lx, ly] = point(i, scale, 126); return `<circle cx="${x}" cy="${y}" r="3.5" fill="#d4f5ff" stroke="#36bfe7"><title>${esc(h.name)}: ${h.cur} / ${h.best} ${t('gün', 'days')}</title></circle><text x="${lx}" y="${ly}" text-anchor="middle">${i + 1}. ${esc(h.name.length > 15 ? h.name.slice(0, 13) + '…' : h.name)}</text>`; }).join('')}
      <text x="185" y="48" class="radar-scale">${scale} ${t('gün', 'days')}</text></svg>`;
  }

  function settingsIcon(name) {
    const paths={user:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',membership:'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M7 10h10M7 15h4M8 5V3m8 2V3"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',language:'<path d="M3 5h12M9 3v2M5 5c1 5 4 8 8 10M13 5c-1 5-5 9-10 11m10 5 4-10 4 10m-6-3h4"/>',backup:'<path d="M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6"/>',power:'<path d="M12 2v10M5.6 5.6a9 9 0 1 0 12.8 0"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',camera:'<path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/>',back:'<path d="m14 5-7 7 7 7"/>',check:'<path d="m5 12 4 4L19 6"/>'};
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>';
  }
  function renderSettingsPage() {
    const p=prefs(),name=[state.profile?.firstName,state.profile?.lastName].filter(Boolean).join(' ');
    const titles={root:t('Ayarlar','Settings'),membership:t('Üyelik','Membership'),notifications:t('Bildirimler','Notifications'),language:t('Dil','Language'),backup:t('Yedekleme ve geri yükleme','Backup & restore'),profile:t('Profili düzenle','Edit profile')};
    const row=(label,icon,action,value='',selected)=>'<button type="button" class="settings-list-row" data-profile-action="'+action+'"'+(selected===undefined?'':' aria-pressed="'+selected+'"')+'><span class="settings-icon-badge">'+settingsIcon(icon)+'</span><span class="settings-list-label">'+label+'</span>'+(value?'<small>'+value+'</small>':'')+settingsIcon(selected?'check':'arrow')+'</button>';
    let content='';
    if(settingsPage==='root')content='<h3 class="settings-group-label">'+t('HESAP','ACCOUNT')+'</h3>'+(name?row(titles.profile,'user','settings-profile'):'')+row(titles.membership,'membership','settings-membership')+'<h3 class="settings-group-label">'+t('UYGULAMA','APPLICATION')+'</h3>'+row(titles.notifications,'bell','settings-notifications')+row(titles.language,'language','settings-language',p.language==='en'?'English':'Türkçe')+'<h3 class="settings-group-label">'+t('VERİLER','YOUR DATA')+'</h3>'+row(titles.backup,'backup','settings-backup')+'<div class="settings-exit-row">'+row(t('Çıkış yap','Sign out'),'power','logout')+'</div>';
    if(settingsPage==='membership')content='<p class="settings-paragraph">'+t('Misafir olarak kullanıyorsun. Verilerin bu cihazda saklanıyor. Hesapla giriş ve bulut eşitleme mobil uygulamada kullanılabilir.','You are using a local profile on this device. Account sign-in and cloud sync are available in the mobile app.')+'</p>';
    if(settingsPage==='notifications')content='<p class="settings-paragraph">'+t('Zamanı gelen görevlerin için hatırlatma al.','Get reminders for scheduled tasks.')+'</p><div class="settings-list-row"><span class="settings-icon-badge">'+settingsIcon('bell')+'</span><span class="settings-list-label">'+titles.notifications+'</span><button type="button" role="switch" aria-checked="'+p.notifications+'" class="settings-switch '+(p.notifications?'on':'')+'" data-profile-action="notifications" aria-label="'+titles.notifications+'"><span></span></button></div><p id="notificationNotice" class="settings-paragraph" role="status"></p>';
    if(settingsPage==='language')content=row('Türkçe','language','lang-tr','',p.language==='tr')+row('English','language','lang-en','',p.language==='en');
    if(settingsPage==='backup')content='<p class="settings-paragraph">'+t('Alışkanlıklarını, görevlerini, zincirlerini ve profilini bir dosyaya yedekleyebilir, istediğin zaman geri yükleyebilirsin.','Export your habits, tasks, streaks and profile to a file and restore them whenever you need.')+'</p><div class="settings-info"><span>'+t('Son yedekleme','Last backup')+'</span><b>'+esc(state.profile?.lastBackupAt||'—')+'</b></div><div class="settings-info"><span>'+t('Son geri yükleme','Last restore')+'</span><b>'+esc(state.profile?.lastRestoreAt||'—')+'</b></div><button class="settings-action" data-export-backup>'+t('Yedekle (Dışa aktar)','Export backup')+'</button><button class="settings-action" data-import-backup>'+t('Yedekten yükle','Restore backup')+'</button>';
    if(settingsPage==='profile')content='<form id="profileEditorForm" class="profile-editor"><label>'+t('Ad','First name')+'<input id="profFirstName" name="first" value="'+esc(state.profile?.firstName||'')+'" maxlength="40" required></label><label>'+t('Soyad','Last name')+'<input name="last" value="'+esc(state.profile?.lastName||'')+'" maxlength="40"></label><button class="settings-action" type="submit">'+t('Kaydet','Save')+'</button></form>'+button(t('Profili sil','Delete profile'),'delete')+(confirming?'<p class="settings-paragraph">'+t('Profil bilgilerin silinsin mi? Alışkanlıkların ve hesabın korunur.','Remove your profile details? Your habits and account are kept.')+'</p>'+button(t('Evet, profili sil','Yes, delete profile'),'confirm-delete')+button(t('Vazgeç','Cancel'),'cancel-delete'):'')+(undo?button(t('Silmeyi geri al','Undo deletion'),'undo'):'')+(message?'<p class="settings-paragraph" role="status">'+esc(message)+'</p>':'');
    return '<section class="settings-page"><header class="settings-page-header"><button type="button" data-profile-action="settings-back" aria-label="'+t('Geri','Back')+'">'+settingsIcon('back')+'</button><h2>'+titles[settingsPage]+'</h2><span></span></header><div class="settings-page-content">'+content+'</div></section>';
  }
  function renderStatisticsPage() {
    const rows=stats();
    return '<section class="settings-page statistics-page"><header class="settings-page-header"><h2>'+t('İstatistikler','Statistics')+'</h2></header><div class="settings-page-content"><article class="card profile-radar-card"><div class="radar-gallery" data-radar-gallery>'+Array.from({length:Math.max(1,Math.ceil(rows.length/6))},(_,i)=>'<div class="radar-page">'+radar(rows.slice(i*6,i*6+6))+'</div>').join('')+'</div>'+(rows.length>6?button('‹','previous',false,'aria-label="'+t('Önceki grafik','Previous chart')+'"')+button('›','next',false,'aria-label="'+t('Sonraki grafik','Next chart')+'"'):'')+'</article></div></section>';
  }
  function renderProfilePage() {
    if(section==='stats'){ $('#panel').removeAttribute('aria-labelledby'); $('#panel').innerHTML=renderStatisticsPage(); return; }
    if(section==='settings'){ $('#panel').removeAttribute('aria-labelledby'); $('#panel').innerHTML=renderSettingsPage(); return; }
    const fullName = [state.profile?.firstName, state.profile?.lastName].filter(Boolean).join(' ').trim();
    const initials = getInitials(state.profile?.firstName,state.profile?.lastName);
    const all = stats(), p = prefs(), rows = all;
    const done = state.habits.filter(h => getMark(h.id, keyOf(new Date())) === 'g').length;
    $('#panel').removeAttribute('aria-labelledby');
    $('#panel').innerHTML = `<div class="profile-page">
      <div class="profile-page-heading">${button('‹ ' + t('Geri', 'Back'), 'back')}<h2>${t('Profil', 'Profile')}</h2><span class="profile-eyebrow">GÜNLÜK RUTİN</span></div>
      <article class="card profile-hero">
        <button type="button" class="profile-avatar-lg profile-photo-button" data-profile-action="photo" aria-label="${t('Profil fotoğrafını yönet','Manage profile photo')}">${state.profile?.photoUri ? '<img src="'+esc(state.profile.photoUri)+'" alt="'+t('Profil fotoğrafı','Profile photo')+'">' : initials ? esc(initials) : settingsIcon('user')}<span class="photo-camera" aria-hidden="true">${settingsIcon('camera')}</span></button>
        <h3>${esc(fullName || t('Kendi yolculuğunu başlat', 'Start your own journey'))}</h3>
        ${state.profile?.email ? '<p class="profile-subtitle">'+esc(state.profile.email)+'</p>' : ''}
        <div class="profile-stats-grid"><div class="profile-stat-box"><b>${state.habits.length}</b><small>${t('Alışkanlık', 'Habits')}</small></div><div class="profile-stat-box"><b>${done}/${state.habits.length}</b><small>${t('Bugün tamam', 'Done today')}</small></div><div class="profile-stat-box"><b>${Math.max(0, ...all.map(h => h.best))}</b><small>${t('En uzun zincir · gün', 'Best streak · days')}</small></div></div>
      </article>
      ${photoMenu ? `<div class="profile-photo-backdrop"><section class="profile-photo-dialog" role="dialog" aria-modal="true" aria-label="${t('Profil fotoğrafı','Profile photo')}"><h3>${t('Profil fotoğrafı','Profile photo')}</h3>${button(state.profile?.photoUri?t('Fotoğrafı değiştir','Change photo'):t('Fotoğraf ekle','Add photo'),'pick-photo')}${state.profile?.photoUri?button(t('Fotoğrafı sil','Remove photo'),'remove-photo'):''}${photoPrevious&&!state.profile?.photoUri?button(t('Silmeyi geri al','Undo removal'),'undo-photo'):''}<input type="file" id="profilePhotoInput" accept="image/*" hidden><p id="photoNotice" role="status"></p>${button(t('Kapat','Close'),'close-photo')}</section></div>`:''}
    </div>`;
  };

  panel.addEventListener('submit', e => {
    if (e.target.id !== 'profileEditorForm') return;
    e.preventDefault();
    const data = new FormData(e.target), first = String(data.get('first') || '').trim();
    if (!first) { $('#profFirstName').setCustomValidity(t('Lütfen adını gir.', 'Please enter your first name.')); $('#profFirstName').reportValidity(); return; }
    state.profile = { ...state.profile, firstName: first, lastName: String(data.get('last') || '').trim(), deleted: false };
    editing = false; message = t('Profil kaydedildi.', 'Profile saved.'); undo = null; save(); render();
  });
  panel.addEventListener('input', e => { if (e.target.id === 'profFirstName') e.target.setCustomValidity(''); });
  panel.addEventListener('change', async e => {
    if (e.target.id === 'profilePhotoInput') {
      const file=e.target.files?.[0]; if(!file) return;
      e.target.value='';
      let bitmap;
      try {
        if(!file.type.startsWith('image/') || file.size>20*1024*1024) throw Error('image');
        bitmap=await createImageBitmap(file);
        const side=Math.min(bitmap.width,bitmap.height),canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;
        canvas.getContext('2d').drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,320,320);
        const photoUri=canvas.toDataURL('image/jpeg',.75);
        if(photoUri.length>350050) throw Error('image');
        state.profile={firstName:'',lastName:'',...state.profile,photoUri};photoPrevious='';photoMenu=false;save();render();
      } catch { const notice=$('#photoNotice');if(notice)notice.textContent=t('Fotoğraf açılamadı. Başka bir görsel seçmeyi dene.','Unable to open this photo. Try another image.'); }
      finally { bitmap?.close(); }
      return;
    }
  });
  panel.addEventListener('click', async e => {
    const action = e.target.closest('[data-profile-action]')?.dataset.profileAction;
    if (!action) return;
    if (action === 'return') { state.sessionLocked = false; profileOpen = true; }
    else if (state.sessionLocked) return;
    else if (action === 'back') profileOpen = false;
    else if (action === 'edit') { editing = true; confirming = false; message = ''; }
    else if (action === 'cancel') editing = false;
    else if (action === 'delete') { confirming = true; editing = false; }
    else if (action === 'cancel-delete') confirming = false;
    else if (action === 'confirm-delete') { undo = { ...state.profile }; state.profile = { ...state.profile, firstName: '', lastName: '', avatar: '', photoUri: '', deleted: true }; confirming = false; message = t('Profil silindi.', 'Profile deleted.'); }
    else if (action === 'undo') { state.profile = undo; undo = null; message = ''; }
    else if (action === 'stats' || action === 'settings') { section = section === action ? null : action; settingsPage='root'; }
    else if (action === 'settings-back') {
      if(settingsPage==='root') {
        section=null; profileOpen=false; state.section='rutin';
        reorderMode=false; taskReorderMode=false; monthlyViewMode=false;
        window.AuroraWeb?.resetHomeView();
      } else settingsPage='root';
    }
    else if (action.startsWith('settings-')) { settingsPage=action.slice(9); message=''; }
    else if (action === 'previous' || action === 'next') { const gallery=$('[data-radar-gallery]'); gallery.scrollBy({left:gallery.clientWidth*(action==='next'?1:-1),behavior:'smooth'}); return; }
    else if (action === 'photo') photoMenu = true;
    else if (action === 'close-photo') photoMenu = false;
    else if (action === 'pick-photo') { $('#profilePhotoInput').click(); return; }
    else if (action === 'remove-photo') { photoPrevious=state.profile?.photoUri||''; state.profile={firstName:'',lastName:'',...state.profile,photoUri:''}; }
    else if (action === 'undo-photo') { state.profile={...state.profile,photoUri:photoPrevious}; photoPrevious=''; }
    else if (action.startsWith('lang-')) state.preferences = { ...prefs(), language: action.slice(5) };
    else if (action === 'notifications') {
      const enabled = !prefs().notifications;
      if (enabled) {
        const permission = 'Notification' in window ? (Notification.permission === 'default' ? await Notification.requestPermission().catch(() => 'denied') : Notification.permission) : 'denied';
        if (permission !== 'granted') { $('#notificationNotice').textContent = t('Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsin.', 'Notification permission was not granted. Enable it in browser settings.'); return; }
      }
      state.preferences = { ...prefs(), notifications: enabled };
    }
    else if (action === 'logout') { state.sessionLocked = true; editing = false; }
    save(); render();
    if (action === 'edit') $('#profFirstName')?.focus();
  });
  const openSection = key => { if (!['stats','settings'].includes(key)) return; section=key; settingsPage='root'; profileOpen=true; reorderMode=false; taskReorderMode=false; render(); };
  const closeSection = () => { section=null; settingsPage='root'; profileOpen=false; };
  window.ProfileWeb = { applyAppearance, renderSession, renderProfilePage, openSection, closeSection };
  render();
})();
