import React, {useEffect,useId,useRef} from 'react';
import {Animated,Easing,View,Text,Pressable,StyleSheet,useWindowDimensions} from 'react-native';
import Svg,{Circle,Path,Rect,Defs,LinearGradient,RadialGradient,Stop} from 'react-native-svg';
import {Habit,MarkType,TabTheme} from './constants';
import {parseKey,keyOf,addDays,daysInMonth} from './utils';
import {GlassMaterial,GlowFill,LiquidProgress,SoftButton} from './AuroraGlass';
import {PlusIcon} from './NeonDesign';
import {isReduceMotion} from './motion';

export function weekDates(today:string,offset=0) {
  const date=parseKey(today),start=addDays(date,-((date.getDay()+6)%7)+offset*7);
  return Array.from({length:7},(_,i)=>addDays(start,i));
}
const number=(value:number,en=false)=>value.toLocaleString(en?'en-GB':'tr-TR',{maximumFractionDigits:2});
function timer(value:number) {const s=Math.max(0,Math.floor(value));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}

/** Each light accent (text, bar) has a deeper "solid" partner used for filled buttons and today's day circle, as in the reference. */
const SOLID:Record<string,{fill:string;end:string;ink:string}>={
  '#00D9F5':{fill:'#008EFF',end:'#0042FF',ink:'#FFFFFF'},
  '#46D5FF':{fill:'#3B7DFF',end:'#2557E6',ink:'#FFFFFF'},
  '#BA8AFF':{fill:'#8E62FF',end:'#6A3FE6',ink:'#FFFFFF'},
  '#57E3C4':{fill:'#6BEFC6',end:'#2FC895',ink:'#0B2B2A'},
  '#FFBF8A':{fill:'#FF9D57',end:'#E8733A',ink:'#2B1608'},
  '#F5A1D7':{fill:'#F07CC8',end:'#D34FA8',ink:'#FFFFFF'},
};
export const solidOf=(accent:string)=>SOLID[accent.toUpperCase()]||{fill:accent,end:accent,ink:'#FFFFFF'};

function Check({color='#FFFFFF',size=13,width=2.4}:{color?:string;size?:number;width?:number}) {
  return <Svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" accessible={false} pointerEvents="none"><Path d="m3.2 8.4 3.1 3 6.5-6.7"/></Svg>;
}
function Minus({color,size=18}:{color:string;size?:number}) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" accessible={false} pointerEvents="none"><Path d="M5.5 12h13"/></Svg>;
}
function Chevron({dir,color}:{dir:'l'|'r';color:string}) {
  return <Svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false} pointerEvents="none"><Path d={dir==='l'?'M7.5 2.5 4 6l3.5 3.5':'M4.5 2.5 8 6 4.5 9.5'}/></Svg>;
}
function Dots({color}:{color:string}) {
  return <Svg width={18} height={6} viewBox="0 0 18 6" accessible={false} pointerEvents="none"><Circle cx={3} cy={3} r={1.7} fill={color}/><Circle cx={9} cy={3} r={1.7} fill={color}/><Circle cx={15} cy={3} r={1.7} fill={color}/></Svg>;
}

/** Filled solid circle with a soft top highlight: today's day, the "+" button and the completion check. */
export function SolidOrb({fill,end,radius}:{fill:string;end:string;radius:number}) {
  const id=useId().replace(/:/g,'');
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill,{borderRadius:radius,overflow:'hidden'}]}><Svg width="100%" height="100%"><Defs>
    <RadialGradient id={id} cx="40%" cy="35%" r="75%"><Stop offset="0" stopColor={fill}/><Stop offset=".65" stopColor={end}/><Stop offset="1" stopColor={fill}/></RadialGradient>
    <LinearGradient id={id+'h'} x1="0%" y1="0%" x2="0%" y2="100%"><Stop offset="0" stopColor="#B9F5FF" stopOpacity=".52"/><Stop offset=".45" stopColor="#FFFFFF" stopOpacity="0"/></LinearGradient>
  </Defs><Rect width="100%" height="100%" rx={radius} fill={'url(#'+id+')'}/><Rect width="100%" height="100%" rx={radius} fill={'url(#'+id+'h)'}/></Svg></View>;
}

export function AuroraEmblem({habit,color,size=47}:{habit:Habit;color:string;size?:number}) {
  const id=useId().replace(/:/g,''),name=habit.name.toLocaleLowerCase('tr-TR');
  const kind=name.includes('su')&&habit.tab==='beslenme'?'drop':name.includes('protein')||habit.tab==='egzersiz'?'dumbbell':'leaf';
  return <View style={{width:size,height:size,borderRadius:13,borderWidth:1,borderColor:color+'8C',alignItems:'center',justifyContent:'center',overflow:'hidden',shadowColor:color,shadowOpacity:.3,shadowRadius:12,shadowOffset:{width:0,height:0}}}>
    <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}><Defs>
      <LinearGradient id={id+'tile'} x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0" stopColor={color} stopOpacity=".46"/><Stop offset=".55" stopColor={color} stopOpacity=".2"/><Stop offset="1" stopColor={color} stopOpacity=".12"/></LinearGradient>
      <LinearGradient id={id+'shine'} x1="0%" y1="0%" x2="0%" y2="100%"><Stop offset="0" stopColor="#FFFFFF" stopOpacity=".16"/><Stop offset=".45" stopColor="#FFFFFF" stopOpacity="0"/></LinearGradient>
    </Defs><Rect width="100%" height="100%" fill="#0A1A44" fillOpacity=".55"/><Rect width="100%" height="100%" fill={'url(#'+id+'tile)'}/><Rect width="100%" height="100%" fill={'url(#'+id+'shine)'}/></Svg>
    {habit.emoji?<Text style={{fontSize:size*.52}}>{habit.emoji}</Text>:<View><Svg width={size*.64} height={size*.64} viewBox="0 0 32 32" strokeLinecap="round" strokeLinejoin="round" accessible={false}>
      <Defs><LinearGradient id={id+'glyph'} x1="10%" y1="0%" x2="80%" y2="100%"><Stop offset="0" stopColor="#FFFFFF"/><Stop offset=".5" stopColor={color} stopOpacity=".95"/><Stop offset="1" stopColor={color}/></LinearGradient></Defs>
      {kind==='drop'?<><Path d="M16 4.5c-3.6 5.4-8 9.8-8 15a8 8 0 0 0 16 0c0-5.2-4.4-9.6-8-15Z" fill={'url(#'+id+'glyph)'}/><Path d="M12.2 19.5c-.4 2.6 1 4.6 3.4 5.1" fill="none" stroke="#FFFFFF" strokeOpacity=".85" strokeWidth={1.8}/></>
      :kind==='dumbbell'?<Path d="M11.5 16h9M9.5 10.5v11M22.5 10.5v11M5.5 13v6M26.5 13v6" fill="none" stroke={'url(#'+id+'glyph)'} strokeWidth={3.4}/>
      :<><Path d="M26 6C15.5 5.6 7 10.8 7 19.4c0 2.3.6 4.2 1.6 5.6C19 25.6 26.2 18.4 26 6Z" fill={'url(#'+id+'glyph)'}/><Path d="M8.6 25c3.4-5 7.6-9 12.6-12.4" fill="none" stroke="#0E3F3F" strokeOpacity=".75" strokeWidth={1.7}/></>}
    </Svg></View>}
  </View>;
}

const AnimatedCircle=Animated.createAnimatedComponent(Circle);
function ProgressRing({percentage,color}:{percentage:number;color:string}) {
  const progress=useRef(new Animated.Value(percentage/100)).current,id=useId().replace(/:/g,''),r=28,circumference=2*Math.PI*r;
  useEffect(()=>{Animated.timing(progress,{toValue:percentage/100,duration:isReduceMotion()?0:320,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start();},[percentage,progress]);
  return <View style={s.ring}><Svg width={70} height={70} viewBox="0 0 70 70"><Defs><LinearGradient id={id} x1="0%" y1="0%" x2="30%" y2="100%"><Stop offset="0" stopColor="#5CE1FF"/><Stop offset="1" stopColor="#3D86FF"/></LinearGradient></Defs><Circle cx={35} cy={35} r={r} fill="#0A1747" fillOpacity=".35" stroke="#2A3C93" strokeOpacity=".9" strokeWidth={7}/>{percentage>0&&<AnimatedCircle cx={35} cy={35} r={r} fill="none" stroke={'url(#'+id+')'} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={progress.interpolate({inputRange:[0,1],outputRange:[circumference,0]}) as any} rotation={-90} origin="35,35"/>}</Svg>
    <Text style={{position:'absolute',color,fontSize:21,lineHeight:26,fontWeight:'700',letterSpacing:-.4}}><Text style={{fontSize:16,fontWeight:'600'}}>%</Text>{percentage}</Text></View>;
}

export function AuroraSummary({theme:t,date,done,total,english,weekOffset,onWeekChange}:{theme:TabTheme;date:Date;done:number;total:number;english:boolean;weekOffset:number;onWeekChange:(n:number)=>void}) {
  const {width}=useWindowDimensions(),compact=width<370,tiny=width<340,pct=total?Math.round(done/total*100):0,circle=tiny?18:compact?20:22;
  return <View style={s.summary}>
    <View style={s.heading}>
      <View style={{flex:1,minWidth:0}}><Text accessibilityRole="header" numberOfLines={1} style={[s.title,{color:t.text,fontSize:tiny?27:compact?30:34,lineHeight:tiny?33:40}]}>{english?'Today':'Bugün'}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.75} style={{color:t.isDark?'#82A4E1':t.muted,fontSize:tiny?12:compact?13.5:15.5,lineHeight:20,marginTop:2}}>{date.toLocaleDateString(english?'en-GB':'tr-TR',{day:'numeric',month:'long',weekday:'long'})}</Text></View>
      <View style={[s.headerWeek,{gap:tiny?1:compact?2:3}]}>
        <SoftButton accessibilityLabel={english?'Previous week':'Önceki hafta'} onPress={()=>onWeekChange(-1)} hitSlop={6} style={[s.weekArrow,{width:circle,height:circle}]}><View><Chevron dir="l" color="#B9CCF2"/></View></SoftButton>
        {weekDates(keyOf(date),weekOffset).map(d=>{const active=keyOf(d)===keyOf(date);return <View key={keyOf(d)} style={s.headerDay}><View style={[s.headerCircle,{width:circle,height:circle,borderRadius:circle/2,backgroundColor:active?'#006BFF':'#0C1D4E66',borderColor:active?'#38E2FF':'#4172B75C'},active&&{shadowColor:'#008EFF',shadowOpacity:.9,shadowRadius:9,shadowOffset:{width:0,height:0}}]}>{active&&<SolidOrb fill="#008EFF" end="#0042FF" radius={circle/2}/>}<Text style={{color:active?'#FFFFFF':'#DCE5FA',fontSize:tiny?10:compact?11:12,lineHeight:15,fontWeight:active?'700':'500'}}>{d.getDate()}</Text></View><Text style={{color:active?'#FFFFFF':'#92B3E7',fontSize:tiny?8:9.5,lineHeight:12,marginTop:4,fontWeight:active?'700':'400'}}>{d.toLocaleDateString(english?'en-GB':'tr-TR',{weekday:'short'})}</Text></View>})}
        <SoftButton accessibilityLabel={english?'Next week':'Sonraki hafta'} onPress={()=>onWeekChange(1)} hitSlop={6} style={[s.weekArrow,{width:circle,height:circle}]}><View><Chevron dir="r" color="#B9CCF2"/></View></SoftButton>
      </View>
    </View>
    <View style={[s.summaryCard,{borderColor:'transparent'}]} accessibilityRole="progressbar" accessibilityLabel={english?'Daily progress':'Günlük ilerleme'} accessibilityValue={{min:0,max:100,now:pct,text:`${done}/${total}`}}>
      <GlassMaterial accent="#5CBEFF" radius={20} light={!t.isDark}/>
      <View style={s.summaryTop}><View style={s.targetIcon}><Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#E4EDFF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><Circle cx={11} cy={13} r={8}/><Circle cx={11} cy={13} r={4.3}/><Circle cx={11} cy={13} r={1} fill="#E4EDFF"/><Path d="m11 13 7.5-7.5M16.2 3.6l.4 3.8 3.8.4"/></Svg></View><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={{color:t.isDark?'#CCD8F4':t.text,fontSize:13.5,lineHeight:18,marginBottom:2}}>{english?'Daily Progress':'Günlük İlerleme'}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.8} style={{color:t.text,fontSize:tiny?18:22,lineHeight:28,fontWeight:'700'}}>{done} / {total} <Text style={{fontWeight:'500',fontSize:tiny?15:19}}>{english?'completed':'tamamlandı'}</Text></Text></View></View>
      <View style={s.summaryTrack}><LiquidProgress value={pct/100} color="#36D3FA" track="#5B78B84D" height={9}/></View>
      <ProgressRing percentage={pct} color={t.text}/>
    </View>
  </View>;
}

export function AuroraRoutineToolbar({theme,viewMonth,monthly,reordering,canReorder,english,onMonth,onMonthly,onReorder}:{theme:TabTheme;viewMonth:{y:number;m:number};monthly:boolean;reordering:boolean;canReorder:boolean;english:boolean;onMonth:(direction:number|'today')=>void;onMonthly:()=>void;onReorder:()=>void}) {
  const {width}=useWindowDimensions(),compact=width<380,ink=theme.isDark?'#DFECFF':theme.text;
  const now=new Date(),current=viewMonth.y===now.getFullYear()&&viewMonth.m===now.getMonth();
  const control=(kind:'calendar'|'sort',active:boolean,label:string,onPress:()=>void)=><SoftButton onPress={onPress} accessibilityLabel={kind==='calendar'?(english?'Toggle monthly view':'Aylık görünümü aç veya kapat'):(english?'Reorder habits':'Alışkanlıkları sırala')} accessibilityState={{selected:active}} style={[s.routineControl,{borderColor:active?'#65DFFF99':'#93BFFF26',backgroundColor:active?'#0879DC70':'#87B6FF0B'}]}>
    {active&&<GlowFill color="#008EFF" radius={13}/>}
    <View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:compact?7:10}}><Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={active?'#FFFFFF':'#83DFFF'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">{kind==='calendar'?<><Rect x={4} y={5} width={16} height={16} rx={4}/><Path d="M8 3v4m8-4v4M4 10h16m-11 5h2m3 0h2"/></>:<Path d={active?'m5 12 4 4 10-10':'M4 6h16M7 12h10m-7 6h4'}/>}</Svg><Text numberOfLines={1} style={{fontSize:compact?10.5:11.5,lineHeight:16,fontWeight:'600',color:active?'#FFFFFF':ink}}>{label}</Text></View>
  </SoftButton>;
  return <View style={[s.routineToolbar,{backgroundColor:theme.isDark?'#10265328':'#E8F4FF70'}]}>
    <GlassMaterial accent="#68CFFF" radius={20} light={!theme.isDark}/>
    <View style={{flexDirection:'row',alignItems:'center',gap:compact?5:7}}>
      <View style={s.routineMonth}>
        <SoftButton onPress={()=>onMonth(-1)} accessibilityLabel={english?'Previous month':'Önceki ay'} style={s.routineArrow}><View><Chevron dir="l" color={ink}/></View></SoftButton>
        <Pressable onPress={()=>onMonth('today')} accessibilityRole="button" accessibilityLabel={english?'Return to this month':'Bu aya dön'} style={{flex:1,minWidth:0,alignItems:'center'}}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.8} style={{fontSize:compact?11.5:12.5,lineHeight:18,fontWeight:'700',color:theme.text}}>{new Date(viewMonth.y,viewMonth.m,1).toLocaleDateString(english?'en-GB':'tr-TR',{month:'long',year:'numeric'})}</Text></Pressable>
        <SoftButton onPress={()=>onMonth(1)} accessibilityLabel={english?'Next month':'Sonraki ay'} style={s.routineArrow}><View><Chevron dir="r" color={ink}/></View></SoftButton>
      </View>
      {control('calendar',monthly,english?(compact?'Month':'Monthly'):(compact?'Aylık':'Aylık Görünüm'),onMonthly)}
      {canReorder&&control('sort',reordering,reordering?(english?'Done':'Bitti'):(english?'Reorder':'Sırala'),onReorder)}
    </View>
    {(reordering||!current)&&<View style={s.routineHintRow}>{reordering&&<Text style={{flex:1,color:theme.isDark?'#9BBDE9':theme.muted,fontSize:11,lineHeight:16}}>{english?'Hold a card, then drag up or down.':'Kartı basılı tut, yukarı veya aşağı sürükle.'}</Text>}{!current&&<Pressable accessibilityRole="button" onPress={()=>onMonth('today')} hitSlop={6}><Text style={{color:theme.isDark?'#8CDDFF':theme.accent,fontSize:11,lineHeight:16,fontWeight:'600'}}>{english?'This month':'Bu ay'}</Text></Pressable>}</View>}
  </View>;
}

type FaceProps={habit:Habit;theme:TabTheme;progress:number;mark:MarkType|'';today:string;weekOffset:number;marks?:Record<string,MarkType>;monthly:boolean;viewMonth:{y:number;m:number};english:boolean;onEdit:()=>void;onOpen:()=>void;onAdjust:(direction:number)=>void;onMark:(date:string,completeOnly?:boolean)=>void;onLongMark:(date:string)=>void;dragProps:object;consumeLongPress:()=>boolean};
export function AuroraHabitFace({habit:h,theme:t,progress,mark,today,weekOffset,marks,monthly,viewMonth,english,onEdit,onOpen,onAdjust,onMark,onLongMark,dragProps,consumeLongPress}:FaceProps) {
  const {width}=useWindowDimensions(),monthDotSize=Math.min(18,Math.floor((Math.min(width,760)-68)/16));
  const goal=h.goal,has=!!goal&&goal.type!=='none'&&goal.target>0,quantity=has&&goal.type!=='timer',complete=mark==='g',solid=solidOf(t.accent);
  const daySolid={fill:'#008EFF',end:'#0042FF',ink:'#FFFFFF'};
  const litres=goal?.type==='amount'&&goal.unit?.toLowerCase()==='ml'&&goal.target>=1000,amount=litres?progress/1000:progress,target=goal?litres?goal.target/1000:goal.target:0;
  const unit=litres?'L':goal?.type==='reps'?(english?'reps':'tekrar'):goal?.unit||'';
  const [lead,rest]=has?goal.type==='timer'?[timer(progress),` / ${timer(goal.target)}`]:[number(amount,english),` / ${number(target,english)}${unit?' '+unit:''}`]:[h.detail||(complete?(english?'Completed today':'Bugün tamamlandı'):(english?'Daily habit':'Günlük alışkanlık')),''];
  const ratio=has?progress/goal.target:complete?1:0;
  const dayButton=(d:Date,showWeekday:boolean)=>{
    const key=keyOf(d),status=marks?.[key],current=key===today,future=key>today,green=status==='g',red=status==='r',partial=status==='b';
    const filled=current&&!red,compact=!showWeekday,statusLabel=green?(english?'Completed':'Tamamlandı'):partial?(english?'Partial':'Kısmen'):red?(english?'Not completed':'Yapılmadı'):(english?'Unmarked':'İşaretsiz');
    return <View key={key} style={compact?s.monthDay:s.cardDay}><SoftButton disabled={future} accessibilityLabel={`${h.name}, ${d.toLocaleDateString(english?'en-GB':'tr-TR')}, ${statusLabel}${current?english?', today':', bugün':''}`} accessibilityHint={english?'Hold to choose a mark':'İşaret rengi seçmek için basılı tut'} onPress={()=>onMark(key)} onLongPress={()=>onLongMark(key)} delayLongPress={380} style={[s.dayTouch,compact&&s.monthTouch]}>
      <View style={[s.dayCircle,compact&&{width:monthDotSize,height:monthDotSize,borderRadius:monthDotSize/2},
        filled?{borderColor:'#27D9FF',shadowColor:daySolid.fill,shadowOpacity:.8,shadowRadius:8,shadowOffset:{width:0,height:0}}
        :green?{borderColor:'#72EFBE',backgroundColor:'#00845E',shadowColor:'#00D99B',shadowOpacity:.55,shadowRadius:14,shadowOffset:{width:0,height:0}}
        :red?{borderColor:'#FF93AAAA',backgroundColor:'#CE466030'}
        :partial?{borderColor:'#7FB1FFAA',backgroundColor:'#3478FF30'}
        :{borderColor:'#8CA6DA5C',backgroundColor:'#0A19435C'}]}>
        {filled?<SolidOrb fill={daySolid.fill} end={daySolid.end} radius={compact?monthDotSize/2:12}/>:green&&!current?<SolidOrb fill="#21BF91" end="#00845E" radius={compact?monthDotSize/2:12}/>:null}
        {green&&!current&&!compact?<View><Check color="#FFFFFF" size={13}/></View>:<Text style={{color:filled?daySolid.ink:red?'#FFB3C1':partial?'#CFE0FF':green?'#FFFFFF':'#A3C3F0',fontSize:compact?9:filled?12.5:11,lineHeight:compact?12:15,fontWeight:filled?'700':'500'}}>{compact?d.getDate():red?'×':partial?'!':d.getDate()}</Text>}
      </View>
      {showWeekday&&<Text style={{color:current?'#79D9FF':'#97C7EF',fontSize:10,lineHeight:13,marginTop:5,fontWeight:'400'}}>{d.toLocaleDateString(english?'en-GB':'tr-TR',{weekday:'short'})}</Text>}
    </SoftButton></View>;
  };
  const completionControl=(<SoftButton accessibilityLabel={h.name+(goal?.type==='timer'?' sayacını aç':complete?' tamamlandı işaretini kaldır':' bugün tamamla')} accessibilityState={{selected:complete}} onPress={goal?.type==='timer'?onOpen:()=>onMark(today,true)} onLongPress={()=>onLongMark(today)} style={[s.complete,quantity&&width<370&&{width:40,height:40,marginRight:2},complete?{borderColor:'#72EFBE',shadowColor:'#00D99B',shadowOpacity:.55,shadowRadius:14,shadowOffset:{width:0,height:0}}:{borderColor:t.accent+'AA',backgroundColor:t.accent+'14'}]}>{complete&&<SolidOrb fill="#21BF91" end="#00845E" radius={23}/>}{goal?.type==='timer'?<Text style={{color:t.accent,fontSize:22,lineHeight:28}}>▷</Text>:<View><Check color={complete?'#FFFFFF':t.accent} size={complete?24:21} width={complete?2.6:2}/></View>}</SoftButton>);
  return <>
    <View style={[s.cardHeading,quantity&&width<370&&{gap:8}]}>
      <View {...dragProps}><AuroraEmblem habit={h} color={t.accent} size={quantity&&width<370?40:47}/></View>
      <View style={s.cardTitleGroup}>
        <View style={s.cardTitleRow} {...dragProps}>
        <Pressable style={{flex:1,minWidth:0}} accessibilityRole="button" accessibilityLabel={h.name+(english?' goal':' hedefini aç')} accessibilityHint={english?'Hold, then drag to reorder':'Sıralamak için basılı tutup sürükle'} onPress={()=>{if(!consumeLongPress()){if(has)onOpen();else onMark(today);}}}>
          <Text numberOfLines={2} style={{color:t.text,fontSize:18.5,lineHeight:23,fontWeight:'700',letterSpacing:-.3}}>{h.name}</Text>
          {!quantity&&<Text numberOfLines={1} style={{color:t.isDark?t.accent:t.text,fontSize:has?19:15.5,lineHeight:24,marginTop:3,fontWeight:has?'700':'500'}}>{lead}{!!rest&&<Text style={{fontSize:15,fontWeight:'500',opacity:.88}}>{rest}</Text>}</Text>}
        </Pressable>
        </View>
        {quantity&&<View style={s.counter}>
          <View pointerEvents="none" style={s.counterCapsule}/>
          <SoftButton accessibilityLabel={h.name+' miktarını azalt'} onPress={()=>onAdjust(-1)} hitSlop={4} style={s.minusButton}><Minus color="#F2F6FF"/></SoftButton>
          <SoftButton accessibilityLabel={h.name+' miktarını düzenle'} onPress={onOpen} style={s.counterValue}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.7} style={{color:t.text,fontSize:15,lineHeight:19,fontWeight:'600'}}>{number(amount,english)} {unit}</Text></SoftButton>
          <SoftButton accessibilityLabel={h.name+' miktarını artır'} onPress={()=>onAdjust(1)} hitSlop={4} style={[s.plusButton,{borderColor:'#56E7FF',shadowColor:'#008EFF'}]}><SolidOrb fill={solid.fill} end={solid.end} radius={18}/><View><PlusIcon color={solid.ink} size={22}/></View></SoftButton>
        </View>}
      </View>
      <View style={s.cardTopActions}>
        {completionControl}
        <SoftButton accessibilityLabel={h.name+(english?' edit':' düzenle')} onPress={onEdit} hitSlop={6} style={s.more}><Dots color="#BCC8E6"/></SoftButton>
      </View>
    </View>
    {quantity?<View style={s.quantityRow}><LiquidProgress value={ratio} color={t.accent} track="#5B78B84D" height={10} label={h.name}/></View>:has?<View style={{marginTop:10,paddingRight:58}}><LiquidProgress value={ratio} color={t.accent} track="#5B78B84D" label={h.name}/></View>:null}
    {monthly?<View style={s.month}>
      {Array.from({length:daysInMonth(viewMonth.y,viewMonth.m)},(_,i)=>new Date(viewMonth.y,viewMonth.m,i+1)).map(d=>dayButton(d,false))}
    </View>:<View style={s.cardWeek}>{weekDates(today,weekOffset).map(d=>dayButton(d,true))}</View>}
  </>;
}

const s=StyleSheet.create({
  routineToolbar:{padding:8,borderRadius:20,marginTop:3,marginBottom:13,shadowColor:'#0265DD',shadowOpacity:.12,shadowRadius:16,shadowOffset:{width:0,height:5}},
  routineMonth:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',height:38,borderRadius:13,borderWidth:1,borderColor:'#93BFFF26',backgroundColor:'#87B6FF0B'},
  routineArrow:{width:25,height:36,borderRadius:12},routineControl:{height:38,borderWidth:1,borderRadius:13,overflow:'hidden'},routineHintRow:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:4,paddingTop:8,paddingBottom:2},
  summary:{gap:18,marginBottom:11},heading:{flexDirection:'row',alignItems:'flex-start',gap:6},title:{fontWeight:'800',letterSpacing:-1},headerWeek:{flexDirection:'row',alignItems:'flex-start',paddingTop:8},headerDay:{alignItems:'center'},headerCircle:{borderWidth:1,alignItems:'center',justifyContent:'center'},weekArrow:{borderRadius:12,borderWidth:1,borderColor:'#7196DC55',backgroundColor:'#2E5CC21F'},
  summaryCard:{height:88,borderRadius:20,padding:14,shadowColor:'#020A24',shadowOpacity:.3,shadowRadius:18,shadowOffset:{width:0,height:8}},summaryTop:{flexDirection:'row',alignItems:'center',gap:12,paddingRight:76,paddingLeft:2},targetIcon:{width:40,height:40,borderWidth:1,borderColor:'#C5D8FF3D',borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:'#8EA6D62E'},summaryTrack:{position:'absolute',left:16,right:100,bottom:15},ring:{position:'absolute',right:12,top:9,width:70,height:70,alignItems:'center',justifyContent:'center'},
  cardHeading:{flexDirection:'row',alignItems:'flex-start',gap:12},cardTitleGroup:{flex:1,minWidth:0,paddingTop:1},cardTitleRow:{flexDirection:'row',alignItems:'flex-start',gap:6},cardTopActions:{flexDirection:'row',alignItems:'center',gap:7,flexShrink:0},more:{width:22,height:26,borderRadius:13},
  quantityRow:{marginTop:10},counter:{flexDirection:'row',alignItems:'center',alignSelf:'flex-start',flexShrink:0,marginTop:5},counterCapsule:{position:'absolute',left:14,right:16,top:2,bottom:2,borderRadius:16,backgroundColor:'#06112ECC',borderWidth:1,borderColor:'#5E7DC033'},minusButton:{width:32,height:32,borderRadius:16,borderWidth:1,borderColor:'#9FB6E673',backgroundColor:'#0B1A43'},counterValue:{minWidth:50,maxWidth:72,height:32,paddingHorizontal:6},plusButton:{width:36,height:36,borderRadius:18,borderWidth:1.2,overflow:'visible',shadowOpacity:.7,shadowRadius:10,shadowOffset:{width:0,height:0}},complete:{width:46,height:46,borderWidth:1,borderRadius:23,marginRight:6},
  cardWeek:{flexDirection:'row',height:44,marginTop:8,marginLeft:-5},cardDay:{flex:1,minWidth:0,alignItems:'center'},dayTouch:{width:'100%',maxWidth:40,height:44,borderRadius:19},dayCircle:{width:24,height:24,borderWidth:1,borderRadius:12,alignItems:'center',justifyContent:'center'},month:{flexDirection:'row',flexWrap:'wrap',height:44,marginTop:8},monthDay:{width:'6.25%',height:22,alignItems:'center'},monthTouch:{width:'100%',height:22,borderRadius:9}
});
