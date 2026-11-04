import React, {useEffect, useId, useRef, useState} from 'react';
import {Animated, Easing, Platform, Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {BlurView} from 'expo-blur';
import Svg, {Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop} from 'react-native-svg';
import {useBlurTarget} from './SheetBackdrop';
import {isReduceMotion} from './motion';

/** One material for every panel; decorative layers never receive touches. */
export function GlassMaterial({accent='#78ADFF',radius=23,light=false}:{accent?:string;radius?:number;light?:boolean}) {
  const target=useBlurTarget(),id=useId().replace(/:/g,'');
  const [size,setSize]=useState({width:0,height:0});
  const {width,height}=size;
  return <View pointerEvents="none" onLayout={({nativeEvent:{layout}})=>{
    // Native SVG percentage paths can retain the panel's previous dimensions.
    // Explicit geometry redraws the rim when a picker opens or content changes.
    const {width,height}=layout;
    setSize(previous=>previous.width===width&&previous.height===height?previous:{width,height});
  }} style={[StyleSheet.absoluteFill,{borderRadius:radius,overflow:'hidden'}]}>
    <BlurView pointerEvents="none" blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" intensity={28} tint={light?'systemUltraThinMaterialLight':'systemUltraThinMaterialDark'} style={StyleSheet.absoluteFill}/>
    <View style={[StyleSheet.absoluteFill,{backgroundColor:light?'#F4F8FF70':'#10214B6B'}]}/>
    {width>0&&height>0&&<Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Defs><LinearGradient id={id+'-glass'} x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0" stopColor="#A6D7FF" stopOpacity={light ? .3 : .19}/><Stop offset=".35" stopColor="#3579CD" stopOpacity=".06"/><Stop offset=".68" stopColor="#07132E" stopOpacity=".08"/><Stop offset="1" stopColor="#1745C6" stopOpacity=".24"/></LinearGradient><RadialGradient id={id+'-corner'}><Stop offset="0" stopColor="#174FFF" stopOpacity={light?.03:.22}/><Stop offset="1" stopColor="#174FFF" stopOpacity="0"/></RadialGradient><LinearGradient id={id+'-rim'} x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0" stopColor="#C0F0FF" stopOpacity=".86"/><Stop offset=".3" stopColor="#70AAE5" stopOpacity=".4"/><Stop offset=".6" stopColor="#4D75CD" stopOpacity=".3"/><Stop offset="1" stopColor="#128EFF" stopOpacity=".54"/></LinearGradient></Defs>
      <Rect width={width} height={height} rx={radius} fill={'url(#'+id+'-glass)'}/>
      <Ellipse cx={width} cy={height} rx={width*.45} ry={height*.75} fill={'url(#'+id+'-corner)'}/>
      <Rect x={.5} y={.5} width={Math.max(0,width-1)} height={Math.max(0,height-1)} rx={radius} stroke={'url(#'+id+'-rim)'} strokeWidth="1" fill="none"/>
    </Svg>}
  </View>;
}

type SoftProps=Omit<PressableProps,'style'|'children'> & {style?:StyleProp<ViewStyle>;children:React.ReactNode};
/** The scale stays on the compositor; release/drag cancellation always restores it. */
export function SoftButton({style,children,onPressIn,onPressOut,...props}:SoftProps) {
  const scale=useRef(new Animated.Value(1)).current;
  useEffect(()=>()=>scale.stopAnimation(),[scale]);
  const animate=(value:number)=>{scale.stopAnimation();Animated.spring(scale,{toValue:value,speed:26,bounciness:3,useNativeDriver:true}).start();};
  return <Animated.View style={[style,{transform:[{scale}]}]}>
    <Pressable {...props} accessibilityRole={props.accessibilityRole||'button'} onPressIn={e=>{if(!props.disabled&&!isReduceMotion())animate(.94);onPressIn?.(e);}} onPressOut={e=>{animate(1);onPressOut?.(e);}} style={{flex:1,alignItems:'center',justifyContent:'center',opacity:props.disabled ? .45 : 1}}>{children}</Pressable>
  </Animated.View>;
}

export function GlowFill({color,radius=18}:{color:string;radius?:number}) {
  const id=useId().replace(/:/g,'');
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill,{borderRadius:radius,overflow:'hidden'}]}><Svg width="100%" height="100%"><Defs><LinearGradient id={id} x1="10%" y1="0%" x2="90%" y2="100%"><Stop offset="0" stopColor="#E4FCFF" stopOpacity=".38"/><Stop offset=".35" stopColor={color} stopOpacity=".72"/><Stop offset="1" stopColor={color} stopOpacity=".23"/></LinearGradient></Defs><Rect width="100%" height="100%" rx={radius} fill={'url(#'+id+')'}/></Svg></View>;
}

export function LiquidProgress({value,color,track='#90B2F038',height=8,label}:{value:number;color:string;track?:string;height?:number;label?:string}) {
  const ratio=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
  const progress=useRef(new Animated.Value(ratio)).current,id=useId().replace(/:/g,'');
  const [width,setWidth]=useState(0);
  useEffect(()=>{Animated.timing(progress,{toValue:ratio,duration:isReduceMotion()?0:280,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start();return()=>progress.stopAnimation();},[ratio,progress]);
  return <View accessibilityRole={label?'progressbar':undefined} accessibilityLabel={label} accessibilityValue={label?{min:0,max:100,now:Math.round(ratio*100)}:undefined} onLayout={({nativeEvent:{layout}})=>setWidth(previous=>previous===layout.width?previous:layout.width)} style={{height,borderRadius:height,backgroundColor:track}}>
    {/* Keep SVG geometry fixed while the clipping layer animates. Native SVG can
        retain stale percentage bounds when its animated parent changes width. */}
    {width>0&&<Animated.View style={{height,width:progress.interpolate({inputRange:[0,1],outputRange:[0,width]}),borderRadius:height,backgroundColor:color,shadowColor:color,shadowOpacity:.5,shadowRadius:8,shadowOffset:{width:0,height:2}}}><View style={{height,borderRadius:height,overflow:'hidden'}}><Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}><Defs><LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%"><Stop offset="0" stopColor="#00B9EF"/><Stop offset=".6" stopColor="#6CF7FB"/><Stop offset="1" stopColor="#35B8F5"/></LinearGradient></Defs><Rect width={width} height={height} rx={height} fill={'url(#'+id+')'} stroke="#B6FFFF45" strokeWidth="1"/></Svg></View></Animated.View>}
  </View>;
}

export const glassWebStyle=Platform.OS==='web'?{backdropFilter:'blur(18px) saturate(135%)',WebkitBackdropFilter:'blur(18px) saturate(135%)'} as ViewStyle:undefined;
