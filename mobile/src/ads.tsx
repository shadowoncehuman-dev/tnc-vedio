/// <reference types="expo/types" />
import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

type AdsLib = typeof import('react-native-google-mobile-ads');

const TEST_UNITS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
};

const PROD_UNITS = {
  banner: process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || TEST_UNITS.banner,
  interstitial: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || TEST_UNITS.interstitial,
  rewarded: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || TEST_UNITS.rewarded,
};

export const AD_UNITS = __DEV__ ? TEST_UNITS : PROD_UNITS;

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const adsSupported = Platform.OS !== 'web' && !isExpoGo;

let lib: AdsLib | null | undefined;

function getLib(): AdsLib | null {
  if (!adsSupported) return null;
  if (lib !== undefined) return lib;
  try {
    lib = require('react-native-google-mobile-ads') as AdsLib;
  } catch {
    lib = null;
  }
  return lib;
}

let initPromise: Promise<void> | null = null;

export function initAds(): Promise<void> {
  const ads = getLib();
  if (!ads) return Promise.resolve();
  if (!initPromise) {
    initPromise = ads
      .default()
      .initialize()
      .then(() => undefined)
      .catch(() => undefined);
  }
  return initPromise;
}

export async function showInterstitial(): Promise<void> {
  const ads = getLib();
  if (!ads) return;
  try {
    const ad = ads.InterstitialAd.createForAdRequest(AD_UNITS.interstitial, {
      requestNonPersonalizedAdsOnly: false,
    });
    await new Promise<void>((resolve) => {
      let settled = false;
      const cleanups: Array<() => void> = [];
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanups.forEach((off) => off());
        resolve();
      };
      cleanups.push(
        ad.addAdEventListener(ads.AdEventType.LOADED, () => {
          ad.show().catch(finish);
        }),
      );
      cleanups.push(ad.addAdEventListener(ads.AdEventType.CLOSED, finish));
      cleanups.push(ad.addAdEventListener(ads.AdEventType.ERROR, finish));
      ad.load();
      setTimeout(finish, 15000);
    });
  } catch {
    return;
  }
}

export async function showRewardedAd(): Promise<boolean> {
  const ads = getLib();
  if (!ads) return false;
  try {
    const ad = ads.RewardedAd.createForAdRequest(AD_UNITS.rewarded);
    return await new Promise<boolean>((resolve) => {
      let earned = false;
      let settled = false;
      const cleanups: Array<() => void> = [];
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        cleanups.forEach((off) => off());
        resolve(value);
      };
      cleanups.push(
        ad.addAdEventListener(ads.RewardedAdEventType.LOADED, () => {
          ad.show().catch(() => finish(false));
        }),
      );
      cleanups.push(ad.addAdEventListener(ads.RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }));
      cleanups.push(ad.addAdEventListener(ads.AdEventType.CLOSED, () => finish(earned)));
      cleanups.push(ad.addAdEventListener(ads.AdEventType.ERROR, () => finish(false)));
      ad.load();
      setTimeout(() => finish(earned), 20000);
    });
  } catch {
    return false;
  }
}

export function AdBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  const ads = useMemo(getLib, []);
  if (!ads) {
    if (!__DEV__) return null;
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.placeholderText}>AD SPACE · banner loads in a dev build</Text>
      </View>
    );
  }
  const { BannerAd, BannerAdSize } = ads;
  return (
    <View style={[styles.wrap, style]}>
      <BannerAd
        unitId={AD_UNITS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdFailedToLoad={() => undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', minHeight: 50 },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDEFEA', minHeight: 50, borderTopWidth: 1, borderColor: '#E5E9E5' },
  placeholderText: { color: '#738087', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
});
