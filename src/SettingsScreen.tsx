import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Switch, TextInput } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { AppDataState, AuthUser, CloudSyncStatus, TabTheme } from './constants';
import { preferences } from './profileModel';
import { GlassMaterial, GlowFill } from './AuroraGlass';
import { withAlpha } from './motion';
import ProfileScreenLayout from './ProfileScreenLayout';

type Page = 'root' | 'membership' | 'notifications' | 'language' | 'cloud' | 'backup' | 'profile';
type IconName = 'user' | 'membership' | 'bell' | 'language' | 'cloud' | 'backup' | 'power' | 'back' | 'arrow' | 'check';
export function settingsTheme(base: TabTheme): TabTheme {
  return {
    ...base,
    accent: base.isDark ? '#00D9F5' : '#0878C7',
    accentGradientEnd: '#005BFF',
    accentInk: '#FFFFFF',
    accentSoft: base.isDark ? '#008EFF26' : '#167BDB14',
    bg: base.isDark ? '#030C27' : base.bg,
    surface: base.isDark ? 'rgba(13,35,83,.40)' : base.surface,
    surfaceGlass: base.isDark ? 'rgba(16,44,98,.40)' : base.surfaceGlass,
    text: base.isDark ? '#F5F8FF' : base.text,
    muted: base.isDark ? '#8AAAE5' : base.muted,
    cardBorderColor: base.isDark ? '#6CA9F666' : '#94AFD760',
  };
}
function Icon({name,color,size=24}: {name:IconName;color:string;size?:number}) {
  const paths: Record<IconName, React.ReactNode> = {
    user:<><Circle cx={12} cy={8} r={4}/><Path d="M4 22v-2a8 8 0 0 1 16 0v2"/></>,
    membership:<><Rect x={3} y={5} width={18} height={15} rx={3}/><Path d="M7 10h10M7 15h4M8 5V3m8 2V3"/></>,
    bell:<><Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    language:<Path d="M3 5h12M9 3v2M5 5c1 5 4 8 8 10M13 5c-1 5-5 9-10 11m10 5 4-10 4 10m-6-3h4"/>,
    cloud:<Path d="M6 18a5 5 0 0 1-1-9 7 7 0 0 1 13-2 5.5 5.5 0 0 1 0 11M12 12v10m-3-3 3 3 3-3"/>,
    backup:<><Path d="M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6"/></>,
    power:<Path d="M12 2v10M5.6 5.6a9 9 0 1 0 12.8 0"/>,
    back:<Path d="m14 5-7 7 7 7"/>, arrow:<Path d="M4 12h16m-6-6 6 6-6 6"/>, check:<Path d="m5 12 4 4L19 6"/>,
  };
  return <View pointerEvents="none" style={{position:'relative',zIndex:1,flexShrink:0}}><Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round">{paths[name]}</Svg></View>;
}
type Props = {
  state:AppDataState; theme:TabTheme; authUser:AuthUser|null; cloudStatus:CloudSyncStatus; cloudNotice:string;
  close:()=>void; update:(fn:(state:AppDataState)=>AppDataState,sync?:boolean)=>void;
  signIn:()=>void; signOut:()=>Promise<void>; cloudBackup:()=>Promise<void>; cloudRestore:()=>Promise<void>;
  exportBackup:()=>Promise<void>; importBackup:()=>Promise<void>; notifications:(enabled:boolean)=>Promise<boolean>;
};
export default function SettingsScreen(props:Props) {
  const {state,authUser,update} = props, t=settingsTheme(props.theme), p=preferences(state), en=p.language==='en';
  const tr=(a:string,b:string)=>en?b:a;
  const [page,setPage]=useState<Page>('root'), [notice,setNotice]=useState(''), [busy,setBusy]=useState(false);
  const [first,setFirst]=useState(state.profile?.firstName||authUser?.firstName||''), [last,setLast]=useState(state.profile?.lastName||authUser?.lastName||'');
  const [deleting,setDeleting]=useState(false), [previous,setPrevious]=useState<AppDataState['profile']>();
  const connected=!!authUser && authUser.provider!=='guest';
  const titles:Record<Page,string>={root:tr('Ayarlar','Settings'),membership:tr('Üyelik','Membership'),notifications:tr('Bildirimler','Notifications'),language:tr('Dil','Language'),cloud:tr('Bulut yedekleme','Cloud backup'),backup:tr('Yedekleme ve geri yükleme','Backup & restore'),profile:tr('Profili düzenle','Edit profile')};
  const go=(next:Page)=>{setNotice('');setDeleting(false);setPage(next);};
  const setPref=(value:Partial<typeof p>)=>update(old=>({...old,preferences:{...preferences(old),...value}}),false);
  const run=async(action:()=>Promise<void>)=>{setBusy(true);setNotice('');try{await action();}catch(error){setNotice(error instanceof Error?error.message:tr('İşlem tamamlanamadı. Yeniden dene.','Unable to complete this action. Try again.'));}finally{setBusy(false);}};
  const row=(label:string,icon:IconName,action:()=>void,value?:string,selected?:boolean,_lastRow=false)=>{
    const accent=icon==='power'?'#FF2448':t.accent;
    return <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:busy,...(selected===undefined?{}:{selected})}} disabled={busy} onPress={action}
      style={({pressed})=>[s.row,{backgroundColor:selected?t.accentSoft:t.surface,borderColor:withAlpha(selected?accent:'#7FAEFF',selected?.8:t.isDark?.32:.25),borderTopColor:withAlpha(t.isDark?'#BDE8FF':'#7B9DCC',.65),borderLeftColor:withAlpha(t.isDark?'#8BDAFF':'#7B9DCC',.65),shadowColor:selected?accent:'#001644',shadowOpacity:selected?.24:.12,opacity:busy?.5:pressed?.8:1}]}>
      <GlassMaterial accent={accent} radius={22} light={!t.isDark}/>
      <View style={[s.iconBadge,{backgroundColor:withAlpha(accent,t.isDark?.12:.07),borderColor:withAlpha(accent,.65),shadowColor:accent}]}>{t.isDark&&<GlowFill color={icon==='power'?'#C43859':'#007FFF'} radius={14}/>}<Icon name={icon} color={icon==='power'?'#FF718D':t.isDark?'#9AF5FF':accent} size={24}/></View>
      <Text style={[s.rowLabel,{color:icon==='power'?accent:t.text}]}>{label}</Text>
      {!!value&&<Text numberOfLines={1} style={[s.value,{color:t.muted,backgroundColor:t.accentSoft}]}>{value}</Text>}
      <Icon name={selected===undefined?'arrow':selected?'check':'arrow'} color={accent} size={19}/>
    </Pressable>;
  };
  const group=(label:string)=><Text style={[s.group,{color:t.accent}]}>{label}</Text>;
  const info=(label:string,value:string)=><View style={[s.info,{borderColor:t.cardBorderColor,backgroundColor:t.surface}]}><GlassMaterial accent={t.accent} radius={18} light={!t.isDark}/><Text style={{color:t.muted,fontSize:13,flex:1}}>{label}</Text><Text style={{color:t.text,fontSize:13,flex:1,textAlign:'right'}}>{value}</Text></View>;
  const action=(label:string,fn:()=>void,danger=false)=><Pressable accessibilityRole="button" disabled={busy} onPress={fn} style={({pressed})=>[s.action,{borderColor:danger?'#FF718D99':withAlpha(t.accent,.72),backgroundColor:t.isDark?'#0067CE33':t.surface,shadowColor:danger?'#FF2448':t.accent,opacity:busy?.5:pressed?.8:1}]}><GlassMaterial accent={danger?'#FF2448':t.accent} radius={21} light={!t.isDark}/><Text style={{color:danger?'#FF718D':t.text,fontSize:15,fontWeight:'600'}}>{label}</Text></Pressable>;
  const paragraph=(value:string)=><Text style={{color:t.muted,fontSize:15,lineHeight:23,marginBottom:24}}>{value}</Text>;
  return <ProfileScreenLayout theme={t} title={titles[page]} backLabel={tr('Geri','Back')} onBack={()=>page==='root'?props.close():go('root')}>
    <ScrollView key={page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      {page==='root'&&<>
        {group(tr('HESAP','ACCOUNT'))}
        {!!(state.profile?.firstName||state.profile?.lastName)&&row(titles.profile,'user',()=>go('profile'))}
        {row(titles.membership,'membership',()=>go('membership'),undefined,undefined,true)}
        {group(tr('UYGULAMA','APPLICATION'))}
        {row(titles.notifications,'bell',()=>go('notifications'))}
        {row(titles.language,'language',()=>go('language'),en?'English':'Türkçe',undefined,true)}
        {group(tr('VERİLER','YOUR DATA'))}
        {row(titles.cloud,'cloud',()=>go('cloud'))}
        {row(titles.backup,'backup',()=>go('backup'),undefined,undefined,true)}
        <View style={{marginTop:24}}>{row(tr('Çıkış yap','Sign out'),'power',()=>run(props.signOut),undefined,undefined,true)}</View>
      </>}
      {page==='membership'&&<>
        {paragraph(connected?tr('Hesabın bağlı. Verilerini farklı cihazlarda kullanabilirsin.','Your account is connected. Access your data across devices.'):tr('Misafir olarak kullanıyorsun. Verilerin bu cihazda saklanıyor.','You are using guest mode. Your data is saved on this device.'))}
        {connected&&info(tr('E-posta','Email'),authUser?.email||'—')}
        {info(tr('Oturum','Session'),connected?tr('Hesap bağlı','Account connected'):tr('Misafir','Guest'))}
        {action(connected?tr('Hesap değiştir','Switch account'):tr('Giriş yap / Üye ol','Sign in / Sign up'),props.signIn)}
      </>}
      {page==='notifications'&&<>
        {paragraph(tr('Zamanı gelen görevlerin için hatırlatma al. Bildirimleri istediğin zaman kapatabilirsin.','Get reminders for scheduled tasks. You can turn notifications off at any time.'))}
        <View style={[s.row,{backgroundColor:t.surface,borderColor:t.cardBorderColor}]}><GlassMaterial accent={t.accent} radius={22} light={!t.isDark}/><View style={[s.iconBadge,{backgroundColor:t.accentSoft,borderColor:withAlpha(t.accent,.65),shadowColor:t.accent}]}>{t.isDark&&<GlowFill color="#007FFF" radius={14}/>}<Icon name="bell" color={t.isDark?'#9AF5FF':t.accent} size={24}/></View><Text style={[s.rowLabel,{color:t.text}]}>{titles.notifications}</Text>
          <Switch accessibilityLabel={titles.notifications} value={p.notifications} disabled={busy} trackColor={{false:t.isDark?'#233D6A':'#C2D0E6',true:'#008EFF'}} thumbColor={p.notifications?'#D4F8FF':t.isDark?'#8AAAE5':'#FFFFFF'} onValueChange={value=>run(async()=>{
            if(await props.notifications(value))setPref({notifications:value});else setNotice(tr('Bildirim izni verilmedi. Cihaz veya tarayıcı ayarlarından izin verebilirsin.','Notification permission was not granted. Enable it in device or browser settings.'));
          })}/></View>
      </>}
      {page==='language'&&<>{row('Türkçe','language',()=>setPref({language:'tr'}),undefined,!en)}{row('English','language',()=>setPref({language:'en'}),undefined,en,true)}</>}
      {page==='cloud'&&<>
        {paragraph(tr('Hesabınla giriş yaptığında verilerin internet bağlantısıyla buluta yedeklenir.','When you sign in, your data is backed up to the cloud when connected to the internet.'))}
        {info(tr('Durum','Status'),!connected?tr('Misafir','Guest'):props.cloudStatus==='synced'?tr('Eşitlendi','Synced'):props.cloudStatus==='syncing'?tr('Eşitleniyor…','Syncing…'):props.cloudStatus==='offline-pending'?tr('İnternet bekleniyor','Waiting for internet'):props.cloudStatus==='error'?tr('Bağlantı hatası','Connection error'):tr('Hazır','Ready'))}
        {info(tr('Son eşitleme','Last sync'),state.profile?.lastCloudSyncAt||'—')}
        {!!props.cloudNotice&&paragraph(props.cloudNotice)}
        {connected?<>{action(tr('Şimdi buluta yedekle','Back up to cloud'),()=>run(props.cloudBackup))}{action(tr('Buluttan geri yükle','Restore from cloud'),()=>run(props.cloudRestore))}</>:action(tr('Giriş yap','Sign in'),props.signIn)}
      </>}
      {page==='backup'&&<>
        {paragraph(tr('Alışkanlıklarını, görevlerini, zincirlerini ve profilini bir dosyaya yedekleyebilir, istediğin zaman geri yükleyebilirsin.','Export your habits, tasks, streaks and profile to a file and restore them whenever you need.'))}
        {info(tr('Alışkanlıklar','Habits'),String(state.habits.length))}{info(tr('Görevler','Tasks'),String(state.tasks?.length||0))}
        {info(tr('Son yedekleme','Last backup'),state.profile?.lastBackupAt||'—')}{info(tr('Son geri yükleme','Last restore'),state.profile?.lastRestoreAt||'—')}
        {action(tr('Yedekle (Dışa aktar)','Export backup'),()=>run(props.exportBackup))}{action(tr('Yedekten yükle','Restore backup'),()=>run(props.importBackup))}
      </>}
      {page==='profile'&&<>
        <Text style={[s.fieldLabel,{color:t.muted}]}>{tr('Ad','First name')}</Text><TextInput accessibilityLabel={tr('Ad','First name')} value={first} onChangeText={setFirst} maxLength={40} selectionColor={t.accent} style={[s.input,{color:t.text,borderColor:t.cardBorderColor,backgroundColor:t.surface}]}/>
        <Text style={[s.fieldLabel,{color:t.muted}]}>{tr('Soyad','Last name')}</Text><TextInput accessibilityLabel={tr('Soyad','Last name')} value={last} onChangeText={setLast} maxLength={40} selectionColor={t.accent} style={[s.input,{color:t.text,borderColor:t.cardBorderColor,backgroundColor:t.surface}]}/>
        {action(tr('Kaydet','Save'),()=>{if(!first.trim()){setNotice(tr('Lütfen adını gir.','Please enter your first name.'));return;}update(old=>({...old,profile:{...old.profile,firstName:first.trim(),lastName:last.trim(),deleted:false}}));setNotice(tr('Profil kaydedildi.','Profile saved.'));})}
        {deleting?<>{paragraph(tr('Profil bilgilerin silinsin mi? Alışkanlıkların ve hesabın korunur.','Remove your profile details? Your habits and account are kept.'))}{action(tr('Evet, profili sil','Yes, delete profile'),()=>{setPrevious(state.profile);update(old=>({...old,profile:{...old.profile,firstName:'',lastName:'',photoUri:'',avatar:'',deleted:true}}));setFirst('');setLast('');setDeleting(false);},true)}{action(tr('Vazgeç','Cancel'),()=>setDeleting(false))}</>:action(tr('Profili sil','Delete profile'),()=>setDeleting(true),true)}
        {previous&&action(tr('Silmeyi geri al','Undo deletion'),()=>{update(old=>({...old,profile:previous}));setFirst(previous.firstName);setLast(previous.lastName);setPrevious(undefined);})}
      </>}
      {!!notice&&<Text accessibilityLiveRegion="polite" style={{color:t.muted,lineHeight:22,marginTop:20}}>{notice}</Text>}
    </ScrollView>
  </ProfileScreenLayout>;
}
const s=StyleSheet.create({content:{width:'100%',maxWidth:728,alignSelf:'center',paddingHorizontal:20,paddingBottom:40,paddingTop:8},group:{fontSize:10,fontWeight:'700',letterSpacing:1.7,marginTop:20,marginBottom:12,marginLeft:7},row:{flexDirection:'row',gap:12,alignItems:'center',minHeight:74,paddingVertical:13,paddingHorizontal:13,borderWidth:1,borderRadius:22,marginBottom:10,overflow:'hidden',shadowOffset:{width:0,height:5},shadowRadius:16},iconBadge:{width:44,height:44,borderRadius:14,borderWidth:1,alignItems:'center',justifyContent:'center',overflow:'hidden',shadowOffset:{width:0,height:0},shadowOpacity:.22,shadowRadius:10},rowLabel:{flex:1,fontSize:16,fontWeight:'600',letterSpacing:-.2},value:{fontSize:11,maxWidth:100,paddingHorizontal:9,paddingVertical:6,borderRadius:12,overflow:'hidden'},info:{flexDirection:'row',gap:16,paddingVertical:17,paddingHorizontal:15,borderWidth:1,borderRadius:18,marginBottom:9,overflow:'hidden'},action:{alignItems:'center',padding:17,borderRadius:21,borderWidth:1,marginTop:16,overflow:'hidden',shadowOffset:{width:0,height:0},shadowOpacity:.15,shadowRadius:13},fieldLabel:{fontSize:13,marginTop:20,marginBottom:8,marginLeft:4},input:{borderWidth:1,borderRadius:18,padding:15,fontSize:17}});
