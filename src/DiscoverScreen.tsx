import React, {useEffect, useRef, useState} from 'react';
import {AppState, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import Svg, {Circle, Line, Path} from 'react-native-svg';
import {Habit, TabConfig, TabId, TabTheme} from './constants';
import {DISCOVER_HABITS, DiscoverHabit, discoverHabitExists, simulationFrame} from './discoverCatalog';
import {GlassMaterial, SoftButton} from './AuroraGlass';
import {AuroraActivePill, AuroraIcon} from './AuroraUI';
import {isReduceMotion} from './motion';

type Props = {
  habits: Habit[];
  tabs: TabConfig[];
  initialTab: TabId;
  theme: TabTheme;
  english: boolean;
  onAdd: (habit: DiscoverHabit, tab: TabId) => void;
  onViewRoutine: (tab: TabId) => void;
};

const CATEGORIES = [
  {id:'all',tr:'Tümü',en:'All'},
  {id:'mind',tr:'Zihin',en:'Mind'},
  {id:'move',tr:'Hareket',en:'Movement'},
  {id:'care',tr:'Öz bakım',en:'Self-care'},
  {id:'focus',tr:'Odak',en:'Focus'},
] as const;

const COLOURS: Record<string,string> = {mind:'#BA8AFF',move:'#57E3C4',care:'#46D5FF',focus:'#FFBF8A'};

/** A user-started visual guide. Its elapsed time never writes routine progress. */
function ExerciseGuide({kind,theme:t,english:en}:{kind:'breathing'|'pushup';theme:TabTheme;english:boolean}) {
  const [running,setRunning]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const elapsedRef=useRef(0);
  const isBreath=kind==='breathing',colour=isBreath?'#BA8AFF':'#57E3C4';
  const sessionDuration=isBreath?60000:40000;
  const completed=elapsed>=sessionDuration;
  useEffect(()=>{
    if(!running)return;
    let previous=Date.now();
    const timer=setInterval(()=>{
      const now=Date.now();
      // Use elapsed time so the guide keeps the same pace with reduced motion.
      elapsedRef.current=Math.min(sessionDuration,elapsedRef.current+Math.max(0,now-previous));
      previous=now;
      setElapsed(elapsedRef.current);
      if(elapsedRef.current>=sessionDuration)setRunning(false);
    },isReduceMotion()?200:40);
    const subscription=AppState.addEventListener('change',status=>{if(status!=='active')setRunning(false);});
    return()=>{clearInterval(timer);subscription.remove();};
  },[running,sessionDuration]);
  const frame=simulationFrame(kind,elapsed);
  const inhale=frame.phase==='inhale'||frame.phase==='down';
  const wave=(1-Math.cos(frame.expansion*Math.PI))/2;
  const motion=isReduceMotion()?0:wave;
  const shoulderY=66+motion*40,hipY=91+motion*23,headY=54+motion*40;
  const cycle=frame.cycles;
  const phaseText=isBreath?(inhale?(en?'Breathe in':'Nefes al'):(en?'Breathe out':'Nefes ver')):(inhale?(en?'Lower slowly':'Yavaşça alçal'):(en?'Push up':'Yukarı it'));
  const stageText=completed?(en?'Guide complete':'Rehber tamamlandı'):elapsed===0&&!running?(en?'Ready when you are':'Hazır olduğunda başla'):phaseText;
  const startLabel=running?(en?'Pause guide':'Rehberi duraklat'):completed?(en?'Restart guide':'Rehberi yeniden başlat'):(en?'Start guide':'Rehberi başlat');
  const toggleRunning=()=>{
    if(completed){elapsedRef.current=0;setElapsed(0);setRunning(true);}
    else setRunning(value=>!value);
  };
  const clock=`${Math.floor(elapsed/60000)}:${String(Math.floor(elapsed/1000)%60).padStart(2,'0')}`;
  const remaining=frame.remainingSeconds;
  return <View style={[s.guide,{backgroundColor:t.isDark?'#0B19456B':'#E9F0FF88',borderColor:colour+'50'}]}>
    <View style={s.guideHeading}><View><Text style={[s.eyebrow,{color:colour}]}>{en?'ANIMATED GUIDE':'ANİMASYONLU REHBER'}</Text><Text style={{color:t.text,fontSize:19,fontWeight:'700',marginTop:4}}>{isBreath?(en?'Find your breath':'Nefesine odaklan'):(en?'Follow the movement':'Hareketi takip et')}</Text></View><Text style={{color:t.muted,fontVariant:['tabular-nums'],fontSize:15}}>{clock}</Text></View>
    <View accessible accessibilityLabel={stageText} style={s.stage}>
      {isBreath?<View style={s.breathStage}>
        <View style={[s.breathRing,{width:164,height:164,borderRadius:82,borderColor:colour+'20'}]}/>
        <View style={[s.breathRing,{width:132,height:132,borderRadius:66,borderColor:colour+'45'}]}/>
        <View style={[s.breathOrb,{backgroundColor:colour+'35',borderColor:colour+'B0',transform:[{scale:.72+motion*.3}]}]}><Text style={{color:t.text,fontSize:30,fontWeight:'600',fontVariant:['tabular-nums']}}>{completed?'✓':remaining}</Text></View>
      </View>:<Svg width="100%" height={170} viewBox="0 0 280 170" accessible={false}>
        <Line x1={24} y1={142} x2={256} y2={142} stroke={colour} strokeOpacity={.25} strokeWidth={3} strokeLinecap="round"/>
        <Path d={`M76 ${shoulderY} L156 ${hipY} L226 138`} stroke={colour} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <Path d={`M78 ${shoulderY+3} L${49+motion*8} ${106+motion*5} L78 138`} stroke={colour} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <Line x1={77} y1={shoulderY} x2={65} y2={headY+13} stroke={colour} strokeWidth={7} strokeLinecap="round"/>
        <Circle cx={58} cy={headY} r={14} fill={colour} fillOpacity={.25} stroke={colour} strokeWidth={3}/>
        <Path d="M66 140h24M220 140h16" stroke={colour} strokeWidth={6} strokeLinecap="round"/>
        <Circle cx={78} cy={shoulderY+3} r={4} fill={t.isDark?'#0B1945':'#F0F5FF'} stroke={colour} strokeWidth={2}/>
      </Svg>}
    </View>
    <View style={{alignItems:'center',marginTop:-4}}><Text accessibilityLiveRegion="polite" style={{color:t.text,fontSize:21,lineHeight:27,fontWeight:'700'}}>{stageText}</Text><Text style={{color:t.muted,fontSize:12,marginTop:5,textAlign:'center'}}>{isBreath?(en?'4 seconds in · 6 seconds out':'4 sn al · 6 sn ver'):(en?'2 seconds down · 2 seconds up':'2 sn alçal · 2 sn yüksel')} · {cycle} / {isBreath?6:10} {isBreath?(en?'cycles':'tur'):(en?'demo reps':'örnek tekrar')}</Text></View>
    <View style={s.guideActions}><SoftButton accessibilityLabel={startLabel} onPress={toggleRunning} style={[s.startButton,{backgroundColor:colour+'30',borderColor:colour+'90'}]}><Text style={{color:t.text,fontSize:14,fontWeight:'700'}}>{running?(en?'Ⅱ Pause':'Ⅱ Duraklat'):completed?(en?'↻ Restart':'↻ Tekrar başlat'):(en?'▶ Start':'▶ Başlat')}</Text></SoftButton><SoftButton accessibilityLabel={en?'Reset guide':'Rehberi sıfırla'} onPress={()=>{setRunning(false);elapsedRef.current=0;setElapsed(0);}} style={[s.resetButton,{borderColor:t.muted+'50'}]}><Text style={{color:t.muted,fontSize:13}}>{en?'Reset':'Sıfırla'}</Text></SoftButton></View>
    <Text style={{color:t.muted,fontSize:11,lineHeight:16,textAlign:'center',marginTop:12}}>{en?'Visual guide only. Mark your own practice in your routine.':'Görsel rehberdir. Kendi egzersizini rutinde işaretle.'}</Text>
  </View>;
}

export default function DiscoverScreen({habits,tabs,initialTab,theme:t,english:en,onAdd,onViewRoutine}:Props) {
  const scrollRef=useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [category,setCategory]=useState('all');
  const [query,setQuery]=useState('');
  const [destination,setDestination]=useState<TabId>(initialTab);
  const [guide,setGuide]=useState<'breathing'|'pushup'>('breathing');
  const [notice,setNotice]=useState('');
  const openGuide=(kind:'breathing'|'pushup')=>{setGuide(kind);scrollRef.current?.scrollTo({y:0,animated:!isReduceMotion()});};
  const selectedTab=tabs.find(tab=>tab.id===destination)||tabs[0];
  const search=query.trim().toLocaleLowerCase(en?'en-GB':'tr-TR');
  const filtered=DISCOVER_HABITS.filter(h=>(category==='all'||h.category===category)&&(!search||`${h.name} ${h.nameEn} ${h.detail} ${h.detailEn}`.toLocaleLowerCase(en?'en-GB':'tr-TR').includes(search)));
  return <ScrollView ref={scrollRef} style={{flex:1}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <View style={s.headingRow}><View style={{flex:1}}><Text style={[s.eyebrow,{color:'#78CFFF'}]}>{en?'SMALL STEPS, EVERY DAY':'HER GÜN KÜÇÜK BİR ADIM'}</Text><Text accessibilityRole="header" style={{color:t.text,fontSize:32,lineHeight:40,fontWeight:'700',marginTop:4}}>{en?'Discover':'Keşfet'}</Text></View><View style={[s.compass,{borderColor:'#9AC4FF66'}]}><GlassMaterial radius={18} accent="#78CFFF" light={!t.isDark}/><View style={{zIndex:1}}><AuroraIcon name="discover" color="#78CFFF" size={29}/></View></View></View>
    <Text style={{color:t.muted,fontSize:14,lineHeight:21,marginTop:5,marginBottom:20}}>{en?'Find a habit for you. Add it to your routine and build it at your own pace.':'Sana uygun bir alışkanlık bul. Rutinine ekle, kendi hızında devam et.'}</Text>

    <View style={[s.sectionCard,{borderColor:t.isDark?'#88ABFF44':t.cardBorderColor}]}><GlassMaterial radius={22} accent="#BA8AFF" light={!t.isDark}/>
      <View style={s.guideTabs}>{(['breathing','pushup'] as const).map(kind=><SoftButton key={kind} accessibilityState={{selected:kind===guide}} onPress={()=>setGuide(kind)} style={s.guideTab}>{guide===kind&&<AuroraActivePill radius={12}/>}<Text style={{color:guide===kind?'#FFFFFF':t.muted,fontSize:13,fontWeight:'600'}}>{kind==='breathing'?(en?'◎ Breathing':'◎ Nefes'):(en?'↗ Push-up':'↗ Şınav')}</Text></SoftButton>)}</View>
      <ExerciseGuide key={guide} kind={guide} theme={t} english={en}/>
    </View>

    <Text accessibilityRole="header" style={[s.sectionTitle,{color:t.text}]}>{en?'Ready-made habits':'Hazır alışkanlıklar'}</Text>
    <View style={[s.search,{borderColor:t.isDark?'#94B5FF44':t.cardBorderColor,backgroundColor:t.isDark?'#10245266':t.surface}]}><Text style={{color:t.muted,fontSize:19}}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder={en?'Search habits…':'Alışkanlık ara…'} placeholderTextColor={t.muted} accessibilityLabel={en?'Search habits':'Alışkanlık ara'} style={{flex:1,color:t.text,fontSize:14,paddingVertical:12}} clearButtonMode="while-editing"/></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{CATEGORIES.map(c=><SoftButton key={c.id} onPress={()=>setCategory(c.id)} accessibilityState={{selected:category===c.id}} style={[s.chip,{borderColor:category===c.id?'#82B3FF':'#87A9E23D',backgroundColor:category===c.id?'#2C5EBE77':t.isDark?'#10245044':t.surface}]}><Text style={{color:category===c.id?(t.isDark?'#FFFFFF':t.text):t.muted,fontSize:13,fontWeight:'600'}}>{en?c.en:c.tr}</Text></SoftButton>)}</ScrollView>

    <View style={[s.destination,{borderColor:t.isDark?'#8BABE533':t.cardBorderColor}]}><Text style={{color:t.muted,fontSize:12,marginBottom:10}}>{en?'ADD TO THIS ROUTINE CATEGORY':'EKLENECEK RUTİN SEKMESİ'}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>{tabs.map(tab=><SoftButton key={tab.id} onPress={()=>{setDestination(tab.id);setNotice('');}} accessibilityState={{selected:selectedTab.id===tab.id}} style={[s.destinationChip,{borderColor:selectedTab.id===tab.id?'#9EBAFF':'#8BABE533',backgroundColor:selectedTab.id===tab.id?'#4967B94D':'transparent'}]}><Text numberOfLines={1} style={{color:selectedTab.id===tab.id?t.text:t.muted,fontSize:12,fontWeight:'600'}}>{tab.emoji} {tab.name}</Text></SoftButton>)}</ScrollView></View>

    {!!notice&&<View accessibilityLiveRegion="polite" style={[s.notice,{backgroundColor:'#57E3C41C',borderColor:'#57E3C45C'}]}><Text style={{color:t.text,fontSize:12,flex:1}}>{notice}</Text><SoftButton onPress={()=>onViewRoutine(selectedTab.id)} style={{minHeight:34,paddingHorizontal:5}}><Text style={{color:t.isDark?'#80EFCD':t.accent,fontSize:12,fontWeight:'700'}}>{en?'View routine →':'Rutine git →'}</Text></SoftButton></View>}
    <View style={{gap:10}}>{filtered.map(h=>{
      const added=discoverHabitExists(habits,h),colour=COLOURS[h.category]||'#78CFFF';
      return <View key={h.id} style={[s.habitCard,{borderColor:t.isDark?colour+'44':t.cardBorderColor}]}><GlassMaterial radius={20} accent={colour} light={!t.isDark}/><View style={[s.emojiTile,{backgroundColor:colour+'20',borderColor:colour+'55'}]}><Text style={{fontSize:25}}>{h.emoji}</Text></View><View style={{flex:1,minWidth:0}}><Text style={{color:t.text,fontSize:16,lineHeight:21,fontWeight:'700'}}>{en?h.nameEn:h.name}</Text><Text style={{color:t.muted,fontSize:12,lineHeight:18,marginTop:4}}>{en?h.detailEn:h.detail}</Text>{h.simulation&&<SoftButton onPress={()=>openGuide(h.simulation!)} style={{alignSelf:'flex-start',marginTop:7,minHeight:27}}><Text style={{color:colour,fontSize:11,fontWeight:'600'}}>{en?'Open animated guide ↑':'Animasyonlu rehberi aç ↑'}</Text></SoftButton>}</View><SoftButton disabled={added} accessibilityLabel={`${en?h.nameEn:h.name} ${added?(en?'already in routine':'rutininde mevcut'):(en?'add to routine':'rutinine ekle')}`} onPress={()=>{onAdd(h,selectedTab.id);setNotice(en?`${h.nameEn} added to ${selectedTab.name}.`:`${h.name}, ${selectedTab.name} rutinine eklendi.`);}} style={[s.addButton,{borderColor:added?'#57E3C44D':colour+'77',backgroundColor:added?'#57E3C415':colour+'20'}]}><Text style={{color:added?(t.isDark?'#80EFCD':t.muted):t.text,fontSize:added?11:13,fontWeight:'700'}}>{added?(en?'✓ Added':'✓ Eklendi'):(en?'+ Add':'+ Ekle')}</Text></SoftButton></View>;
    })}</View>
    {filtered.length===0&&<View style={s.empty}><Text style={{color:t.text,fontSize:16,fontWeight:'600'}}>{en?'No matching habits':'Eşleşen alışkanlık yok'}</Text><Text style={{color:t.muted,fontSize:13,marginTop:7}}>{en?'Try another search or category.':'Başka bir kelime veya kategori dene.'}</Text></View>}
  </ScrollView>;
}

const s=StyleSheet.create({
  content:{width:'100%',maxWidth:760,alignSelf:'center',paddingHorizontal:16,paddingTop:18,paddingBottom:118},headingRow:{flexDirection:'row',alignItems:'center',gap:12},eyebrow:{fontSize:10,fontWeight:'700',letterSpacing:1.2},compass:{width:59,height:59,borderRadius:18,borderWidth:1,alignItems:'center',justifyContent:'center'},sectionCard:{borderRadius:22,borderWidth:1,padding:12,overflow:'hidden'},guideTabs:{flexDirection:'row',gap:8,marginBottom:12},guideTab:{flex:1,height:37,borderRadius:12,overflow:'hidden'},guide:{borderRadius:16,borderWidth:1,padding:15},guideHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},stage:{height:180,alignItems:'center',justifyContent:'center'},breathStage:{width:176,height:176,alignItems:'center',justifyContent:'center'},breathRing:{position:'absolute',borderWidth:1},breathOrb:{width:126,height:126,borderRadius:63,borderWidth:1,alignItems:'center',justifyContent:'center'},guideActions:{flexDirection:'row',gap:9,marginTop:17},startButton:{flex:1,height:42,borderRadius:13,borderWidth:1},resetButton:{width:90,height:42,borderRadius:13,borderWidth:1},sectionTitle:{fontSize:21,lineHeight:28,fontWeight:'700',marginTop:25,marginBottom:13},search:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderRadius:14,paddingHorizontal:14},chips:{gap:7,paddingVertical:13},chip:{height:35,paddingHorizontal:16,borderRadius:12,borderWidth:1},destination:{borderRadius:15,borderWidth:1,padding:12,marginBottom:14},destinationChip:{height:34,paddingHorizontal:11,borderRadius:10,borderWidth:1},notice:{flexDirection:'row',alignItems:'center',gap:8,borderRadius:13,borderWidth:1,paddingHorizontal:11,paddingVertical:5,marginBottom:12},habitCard:{flexDirection:'row',alignItems:'center',gap:11,borderRadius:20,borderWidth:1,padding:13,overflow:'hidden'},emojiTile:{width:47,height:47,borderRadius:14,borderWidth:1,alignItems:'center',justifyContent:'center'},addButton:{width:75,height:37,borderRadius:12,borderWidth:1},empty:{padding:30,alignItems:'center'},
});
