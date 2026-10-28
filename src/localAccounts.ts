import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppDataState } from './constants';

const OWNER_KEY = 'gunluk-plan:data-owner:v1';
const ACCOUNT_PREFIX = 'gunluk-plan:device-account:v1:';

/** Keep local data from one authenticated account out of another account's upload. */
export async function prepareLocalAccount(uid: string, current: AppDataState, empty: AppDataState): Promise<AppDataState> {
  const owner = await AsyncStorage.getItem(OWNER_KEY);
  if (!owner || owner === uid) return current;
  await AsyncStorage.setItem(`${ACCOUNT_PREFIX}${owner}`, JSON.stringify(current));
  const cached = await AsyncStorage.getItem(`${ACCOUNT_PREFIX}${uid}`);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed?.habits) && parsed?.marks) return parsed;
    } catch {}
  }
  return empty;
}

export async function activateLocalAccount(uid: string, state: AppDataState): Promise<void> {
  await AsyncStorage.setItem(`${ACCOUNT_PREFIX}${uid}`, JSON.stringify(state));
  await AsyncStorage.setItem(OWNER_KEY, uid);
}
