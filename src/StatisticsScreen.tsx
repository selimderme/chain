import React from 'react';
import { ScrollView } from 'react-native';
import { AppDataState, TabTheme } from './constants';
import { preferences } from './profileModel';
import HabitRadar from './HabitRadar';
import ProfileScreenLayout from './ProfileScreenLayout';

export default function StatisticsScreen({state,theme,today}:{state:AppDataState;theme:TabTheme;today:string}) {
  const en=preferences(state).language==='en';
  return <ProfileScreenLayout theme={theme} title={en?'Statistics':'İstatistikler'} backdrop={false}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{width:'100%',maxWidth:728,alignSelf:'center',padding:20,paddingTop:24,paddingBottom:40}}>
      <HabitRadar state={state} theme={theme} today={today}/>
    </ScrollView>
  </ProfileScreenLayout>;
}
