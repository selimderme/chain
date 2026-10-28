import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit, STORAGE_KEY } from './constants';
import { HabitTimer, HabitTimers } from './habitTimers';
import { useStableCallback } from './useStableCallback';

const TIMER_STORAGE_KEY = `${STORAGE_KEY}:timers`;

export function useHabitTimers(
  enabled: boolean,
  habits: Habit[],
  onProgress: (habit: Habit, dateKey: string, elapsed: number, sync: boolean) => void,
) {
  const [ready, setReady] = useState(false);
  const [, render] = useState(0);
  const mounted = useRef(false);
  const writes = useRef(Promise.resolve());
  const lastDeadlines = useRef(new Map<string, number | null>());
  const progress = useStableCallback((timer: HabitTimer, elapsed: number) => {
    const habit = habits.find(item => item.id === timer.habitId);
    const sync = timer.endsAt === null || !lastDeadlines.current.has(timer.habitId) || lastDeadlines.current.get(timer.habitId) !== timer.endsAt;
    lastDeadlines.current.set(timer.habitId, timer.endsAt);
    if (habit?.goal?.type === 'timer') onProgress(habit, timer.dateKey, elapsed, sync);
  });
  const [timers] = useState(() => new HabitTimers(Date.now, progress,
    () => { if (mounted.current) render(value => value + 1); },
    values => {
      // Persist transitions immediately, in order; ticks never overwrite a deadline.
      const json = JSON.stringify(values);
      writes.current = writes.current.then(() => AsyncStorage.setItem(TIMER_STORAGE_KEY, json)).catch(() => {});
    },
  ));

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    AsyncStorage.getItem(TIMER_STORAGE_KEY).then(raw => {
      if (cancelled) return;
      try { timers.restore(raw ? JSON.parse(raw) : []); } catch { timers.restore([]); }
      setReady(true);
    }).catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [enabled, timers]);

  useEffect(() => {
    if (!ready) return;
    timers.retain(timer => habits.some(habit => habit.id === timer.habitId &&
      habit.goal?.type === 'timer' && habit.goal.target === timer.targetSec));
    timers.tick();
  }, [ready, habits, timers]);

  useEffect(() => {
    if (!ready) return;
    const refresh = () => timers.tick();
    const interval = setInterval(refresh, 1000);
    const subscription = AppState.addEventListener('change', refresh);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', refresh);
      window.addEventListener('pageshow', refresh);
    }
    return () => {
      clearInterval(interval); subscription.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', refresh);
        window.removeEventListener('pageshow', refresh);
      }
    };
  }, [ready, timers]);

  return { timers, ready };
}
