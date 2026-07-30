import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import BigButton from '../components/BigButton';
import StepVideo from '../components/StepVideo';
import { colors, fonts, radius, spacing } from '../theme';

/**
 * The guide is paged: page 0 is the overview (tools and safety), pages 1..N are
 * the steps. Only one page is on screen at a time so there is nothing to get
 * lost in while the user is mid-job.
 */
export default function GuideScreen({
  guide,
  matches,
  videoNotice,
  pageIndex,
  onPageChange,
  onRestart,
}) {
  const scrollRef = useRef(null);
  const totalPages = guide.steps.length + 1;
  const isOverview = pageIndex === 0;
  const step = isOverview ? null : guide.steps[pageIndex - 1];
  const match = step ? matches.find((m) => m.stepNumber === step.number) : null;

  // Every page change starts at the top, otherwise the user lands halfway down
  // the next step.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [pageIndex]);

  const isLast = pageIndex === totalPages - 1;

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerVehicle} numberOfLines={1}>
            {guide.vehicle}
          </Text>
          <Text style={styles.headerRepair} numberOfLines={1}>
            {guide.repair}
          </Text>
        </View>
        <Pressable
          onPress={onRestart}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Start a new repair"
        >
          <Text style={styles.headerNew}>New</Text>
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${((pageIndex + 1) / totalPages) * 100}%` }]}
        />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {isOverview ? (
          <Overview guide={guide} videoNotice={videoNotice} />
        ) : (
          <>
            <Text style={styles.stepCounter}>
              Step {pageIndex} of {guide.steps.length}
            </Text>
            <Text style={styles.stepTitle}>{step.title}</Text>

            <View style={styles.videoWrap}>
              <StepVideo match={match} />
            </View>

            <Text style={styles.stepDetail}>{step.detail}</Text>

            {!!step.caution && (
              <View style={styles.cautionBox}>
                <Text style={styles.cautionLabel}>Careful</Text>
                <Text style={styles.cautionText}>{step.caution}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <BigButton
          label="Back"
          variant="secondary"
          onPress={() => onPageChange(pageIndex - 1)}
          disabled={pageIndex === 0}
          style={styles.footerBack}
        />
        <BigButton
          label={isLast ? 'Finish' : isOverview ? 'Start' : 'Next'}
          onPress={() => (isLast ? onRestart() : onPageChange(pageIndex + 1))}
          style={styles.footerNext}
        />
      </View>
    </View>
  );
}

function Overview({ guide, videoNotice }) {
  return (
    <>
      <Text style={styles.stepCounter}>Before you start</Text>
      <Text style={styles.stepTitle}>{guide.repair}</Text>

      <View style={styles.factRow}>
        <Fact label="Difficulty" value={guide.difficulty} />
        <Fact label="Time" value={`${guide.estimatedMinutes} min`} />
        <Fact label="Steps" value={String(guide.steps.length)} />
      </View>

      {!!videoNotice && (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>{videoNotice}</Text>
        </View>
      )}

      {guide.safetyWarnings?.length > 0 && (
        <View style={styles.cautionBox}>
          <Text style={styles.cautionLabel}>Safety</Text>
          {guide.safetyWarnings.map((warning, i) => (
            <Text key={i} style={styles.cautionText}>
              • {warning}
            </Text>
          ))}
        </View>
      )}

      {guide.toolsNeeded?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Tools and parts</Text>
          {guide.toolsNeeded.map((tool, i) => (
            <Text key={i} style={styles.cardItem}>
              • {tool}
            </Text>
          ))}
        </View>
      )}
    </>
  );
}

function Fact({ label, value }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerText: { flex: 1 },
  headerVehicle: { color: colors.text, fontSize: fonts.label, fontWeight: '900' },
  headerRepair: { color: colors.textMuted, fontSize: fonts.small, marginTop: 2 },
  headerNew: {
    color: colors.accent,
    fontSize: fonts.label,
    fontWeight: '900',
    paddingHorizontal: spacing.xs,
  },
  progressTrack: { height: 5, backgroundColor: colors.surface },
  progressFill: { height: 5, backgroundColor: colors.accent },

  content: { padding: spacing.md, paddingBottom: spacing.xl },
  stepCounter: {
    color: colors.accent,
    fontSize: fonts.small,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  stepTitle: {
    color: colors.text,
    fontSize: fonts.title,
    fontWeight: '900',
    lineHeight: 33,
    marginBottom: spacing.md,
  },
  videoWrap: { marginBottom: spacing.md },
  stepDetail: { color: colors.text, fontSize: fonts.body, lineHeight: 31 },

  cautionBox: {
    backgroundColor: '#3A2E12',
    borderLeftWidth: 6,
    borderLeftColor: colors.warning,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  cautionLabel: {
    color: colors.warning,
    fontSize: fonts.small,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  cautionText: { color: '#FFF0CC', fontSize: fonts.label, lineHeight: 26 },

  noticeBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noticeText: { color: colors.textMuted, fontSize: fonts.small, lineHeight: 22 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: fonts.small,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  cardItem: { color: colors.text, fontSize: fonts.label, lineHeight: 28 },

  factRow: { flexDirection: 'row', marginBottom: spacing.xs },
  fact: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginRight: spacing.xs,
  },
  factLabel: { color: colors.textMuted, fontSize: fonts.small - 2, textTransform: 'uppercase' },
  factValue: {
    color: colors.text,
    fontSize: fonts.label,
    fontWeight: '900',
    marginTop: 2,
    textTransform: 'capitalize',
  },

  footer: {
    flexDirection: 'row',
    padding: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  footerBack: { flex: 1, marginRight: spacing.sm },
  footerNext: { flex: 2 },
});
