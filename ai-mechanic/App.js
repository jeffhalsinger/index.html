import { useState, useCallback, useEffect } from 'react';
import { StyleSheet, BackHandler, Platform, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import SetupScreen from './src/screens/SetupScreen';
import LoadingScreen from './src/screens/LoadingScreen';
import GuideScreen from './src/screens/GuideScreen';
import { fetchGuide, fetchVideoMatches } from './src/api';
import { colors } from './src/theme';

function AppBody() {
  const [screen, setScreen] = useState('setup'); // 'setup' | 'loading' | 'guide'
  const [phase, setPhase] = useState('guide'); // which half of the loading is running
  const [error, setError] = useState('');

  const [guide, setGuide] = useState(null);
  const [matches, setMatches] = useState([]);
  const [videoNotice, setVideoNotice] = useState('');
  const [pageIndex, setPageIndex] = useState(0);

  const restart = useCallback(() => {
    setScreen('setup');
    setGuide(null);
    setMatches([]);
    setVideoNotice('');
    setPageIndex(0);
    setError('');
  }, []);

  // Android's hardware back button should step back through the guide rather
  // than dumping the user out of the app mid-job.
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'guide' && pageIndex > 0) {
        setPageIndex((i) => i - 1);
        return true;
      }
      if (screen === 'guide') {
        restart();
        return true;
      }
      return false; // on the setup screen, let Android close the app as normal
    });
    return () => sub.remove();
  }, [screen, pageIndex, restart]);

  const start = useCallback(async ({ year, make, model, repair }) => {
    setError('');
    setScreen('loading');
    setPhase('guide');

    let builtGuide;
    try {
      builtGuide = await fetchGuide({ year, make, model, repair });
    } catch (err) {
      // Without a guide there is nothing to show, so go back and explain why.
      setError(err.message || 'Could not build the repair guide.');
      setScreen('setup');
      return;
    }

    if (!builtGuide?.steps?.length) {
      setError('The guide came back empty. Try describing the repair a little differently.');
      setScreen('setup');
      return;
    }

    // The written guide is already useful on its own, so from this point on
    // nothing is allowed to send the user back to the setup screen.
    setPhase('videos');

    let videoMatches = [];
    let notice = '';
    try {
      const result = await fetchVideoMatches({
        vehicle: builtGuide.vehicle,
        repair: builtGuide.repair,
        steps: builtGuide.steps,
        searchQueries: builtGuide.searchQueries,
      });
      videoMatches = result?.matches || [];

      const withVideo = videoMatches.filter((m) => m.videoId).length;
      if (withVideo === 0) {
        notice =
          'No matching video clips were found for this job, so this guide is written ' +
          'instructions only.';
      } else if (withVideo < builtGuide.steps.length) {
        notice =
          `Video clips were found for ${withVideo} of ${builtGuide.steps.length} steps. ` +
          'The rest are written instructions only.';
      }
    } catch (err) {
      notice =
        'The video search failed, so this guide is written instructions only. ' +
        `(${err.message})`;
    }

    setGuide(builtGuide);
    setMatches(videoMatches);
    setVideoNotice(notice);
    setPageIndex(0);
    setScreen('guide');
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      {screen === 'setup' && <SetupScreen onStart={start} error={error} />}
      {screen === 'loading' && <LoadingScreen phase={phase} />}
      {screen === 'guide' && guide && (
        <GuideScreen
          guide={guide}
          matches={matches}
          videoNotice={videoNotice}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
          onRestart={restart}
        />
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      {/* Solid backdrop so the area behind the status bar matches the app. */}
      <View style={styles.root}>
        <AppBody />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, backgroundColor: colors.background },
});
