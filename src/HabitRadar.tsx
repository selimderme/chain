import React, { useRef, useState } from 'react';
import { View, ScrollView, Pressable, Text } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg';
import { AppDataState, TabTheme } from './constants';
import { habitStatistics, preferences, radarPoint } from './profileModel';

export default function HabitRadar({state, theme: t, today}: {state: AppDataState; theme: TabTheme; today: string}) {
  const all = habitStatistics(state, today), en = preferences(state).language === 'en';
  const pages = Array.from({length: Math.max(1, Math.ceil(all.length / 6))}, (_, i) => all.slice(i*6, i*6+6));
  const [width, setWidth] = useState(320), [page, setPage] = useState(0);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const jump = (delta: number) => { const next = Math.max(0, Math.min(pages.length-1, page+delta)); scroll.current?.scrollTo({x: next*width, animated: true}); setPage(next); };
  return <View onLayout={event => {const next = Math.max(1, event.nativeEvent.layout.width); setWidth(next); scroll.current?.scrollTo({x: page*next, animated:false});}}
    style={{backgroundColor:t.surface,borderWidth:1,borderColor:t.cardBorderColor,borderRadius:22,overflow:'hidden'}}>
    <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
      onScroll={event => setPage(Math.max(0,Math.min(pages.length-1,Math.round(event.nativeEvent.contentOffset.x/width))))} scrollEventThrottle={32}>
      {pages.map((rows, index) => {
        const count = Math.max(3, rows.length), scale = Math.max(7, Math.ceil(Math.max(0,...rows.map(h => h.best))/7)*7);
        const points = (values: number[]) => Array.from({length:count},(_,i) => {const v=radarPoint(i,count,values[i]||0,scale);return `${v.x},${v.y}`;}).join(' ');
        return <View key={index} style={{width, paddingVertical:12}}>
          <Svg width="100%" height={340} viewBox="0 0 360 310" accessibilityLabel={en ? `Habit streak radar chart, ${index+1} of ${pages.length}` : `Alışkanlık zincirleri radar grafiği, ${index+1} / ${pages.length}`}>
            {[.25,.5,.75,1].map(r => <Polygon key={r} points={points(Array(count).fill(scale*r))} fill="none" stroke={t.muted} strokeOpacity={.23}/>)}
            {Array.from({length:count},(_,i)=>{const v=radarPoint(i,count,scale,scale);return <Line key={i} x1={180} y1={155} x2={v.x} y2={v.y} stroke={t.muted} strokeOpacity={.2}/>;})}
            <Polygon points={points(rows.map(h=>h.best))} fill={t.accent} fillOpacity={.05} stroke={t.muted} strokeDasharray="5 4"/>
            <Polygon points={points(rows.map(h=>h.cur))} fill="#36BFE7" fillOpacity={.32} stroke="#36BFE7" strokeWidth={2}/>
            {rows.map((h,i)=>{const v=radarPoint(i,count,h.cur,scale),angle=-Math.PI/2+i*Math.PI*2/count;
              const x=180+Math.cos(angle)*123,y=150+Math.sin(angle)*120;
              return <React.Fragment key={h.id}><Circle cx={v.x} cy={v.y} r={3.5} fill="#D4F5FF" stroke="#36BFE7"/>
                <SvgText x={x} y={y} fill={t.text} fontSize={11} textAnchor="middle">{h.name.length>16?h.name.slice(0,14)+'…':h.name}</SvgText>
                <SvgText x={x} y={y+15} fill={t.muted} fontSize={10} textAnchor="middle">{h.cur} / {h.best} {en?'days':'gün'}</SvgText></React.Fragment>;
            })}
            <SvgText x={185} y={53} fill={t.muted} fontSize={9}>{scale}</SvgText>
            <SvgText x={180} y={298} fill={t.muted} fontSize={10} textAnchor="middle">{rows.length ? (en?'● Current  /  ┄ Best':'● Güncel  /  ┄ Rekor') : (en?'No habits yet':'Henüz alışkanlık yok')}</SvgText>
          </Svg>
        </View>;
      })}
    </ScrollView>
    {pages.length>1 && <>
      {[-1,1].map(delta=><Pressable key={delta} accessibilityRole="button" accessibilityLabel={en?(delta<0?'Previous chart':'Next chart'):(delta<0?'Önceki grafik':'Sonraki grafik')}
        disabled={delta<0?page===0:page===pages.length-1} onPress={()=>jump(delta)}
        style={{position:'absolute',top:155,...(delta<0?{left:2}:{right:2}),padding:10,opacity:(delta<0?page===0:page===pages.length-1)?.2:1}}>
        <Text style={{color:t.text,fontSize:24}}>{delta<0?'‹':'›'}</Text>
      </Pressable>)}
    </>}
  </View>;
}
