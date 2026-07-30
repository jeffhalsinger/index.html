import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../theme';

/**
 * Two-phase progress. Finding video clips takes noticeably longer than writing
 * the guide, so the user is told which phase is running rather than staring at
 * an unexplained spinner.
 */
export default function LoadingScreen({ phase }) {
  const steps = [
    { key: 'guide', label: 'Writing your repair guide' },
    { key: 'videos', label: 'Watching repair videos to find each step' },
  ];
  const activeIndex = steps.findIndex((s) => s.key === phase);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.heading}>Working on it</Text>

      <View style={styles.list}>
        {steps.map((step, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <View key={step.key} style={styles.row}>
              <Text style={[styles.bullet, done && styles.bulletDone, active && styles.bulletActive]}>
                {done ? '✓' : '•'}
              </Text>
              <Text
                style={[styles.rowText, done && styles.rowTextDone, active && styles.rowTextActive]}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.note}>
        This usually takes 30 to 60 seconds. Keep the app open.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  heading: {
    color: colors.text,
    fontSize: fonts.title,
    fontWeight: '900',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  list: { alignSelf: 'stretch', paddingHorizontal: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  bullet: {
    color: colors.textMuted,
    fontSize: fonts.body,
    width: 30,
    fontWeight: '900',
  },
  bulletDone: { color: colors.success },
  bulletActive: { color: colors.accent },
  rowText: { color: colors.textMuted, fontSize: fonts.label, flex: 1, lineHeight: 25 },
  rowTextDone: { color: colors.textMuted },
  rowTextActive: { color: colors.text, fontWeight: '800' },
  note: {
    color: colors.textMuted,
    fontSize: fonts.small,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
