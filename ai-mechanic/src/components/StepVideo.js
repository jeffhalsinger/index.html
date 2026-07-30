import { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { colors, fonts, radius, spacing } from '../theme';

function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

const CONFIDENCE_LABEL = {
  high: 'Close match for your vehicle',
  medium: 'Similar vehicle or procedure',
  low: 'Loose match — check it applies to yours',
};

/**
 * The embedded clip for one step.
 *
 * The player is remounted whenever the video or start time changes (see the
 * `key` on <YoutubePlayer>). YouTube's `start` parameter only applies when the
 * player is created, so remounting is what guarantees every step opens at its
 * own timestamp rather than wherever the previous step left off.
 */
export default function StepVideo({ match }) {
  const { width } = useWindowDimensions();
  const [failed, setFailed] = useState(false);

  // 16:9, minus the screen padding on both sides.
  const playerWidth = width - spacing.md * 2;
  const height = Math.round((playerWidth * 9) / 16);

  // No clip for this step: say so plainly and let the written step stand alone.
  if (!match || !match.videoId) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderTitle}>No video clip for this step</Text>
        <Text style={styles.placeholderBody}>
          {match?.note || 'Follow the written instructions below.'}
        </Text>
      </View>
    );
  }

  if (failed) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderTitle}>The video would not load</Text>
        <Text style={styles.placeholderBody}>
          It may be blocked from embedding, or your connection dropped. The written
          instructions below still apply.
        </Text>
      </View>
    );
  }

  const start = match.startSeconds || 0;
  const hasClipLength = match.endSeconds > start;

  return (
    <View>
      <View style={[styles.playerFrame, { height }]}>
        <YoutubePlayer
          // Remount per step so the clip always opens at the right second.
          key={`${match.videoId}@${start}`}
          height={height}
          width={playerWidth}
          videoId={match.videoId}
          play={false}
          initialPlayerParams={{ start, rel: false, controls: true }}
          onError={() => setFailed(true)}
          webViewProps={{ allowsInlineMediaPlayback: true }}
          webViewStyle={styles.webView}
        />
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaTime}>
          Starts at {formatTime(start)}
          {hasClipLength ? ` · about ${formatTime(match.endSeconds - start)} long` : ''}
        </Text>
        {!!match.videoTitle && (
          <Text style={styles.metaTitle} numberOfLines={2}>
            {match.videoTitle}
            {match.channel ? ` — ${match.channel}` : ''}
          </Text>
        )}
        {!!CONFIDENCE_LABEL[match.confidence] && (
          <Text
            style={[
              styles.metaConfidence,
              match.confidence === 'low' && styles.metaConfidenceWeak,
            ]}
          >
            {CONFIDENCE_LABEL[match.confidence]}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  playerFrame: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  webView: { backgroundColor: '#000' },
  placeholder: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  placeholderTitle: {
    color: colors.textMuted,
    fontSize: fonts.label,
    fontWeight: '800',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  placeholderBody: {
    color: colors.textMuted,
    fontSize: fonts.small,
    textAlign: 'center',
    lineHeight: 22,
  },
  meta: { marginTop: spacing.sm },
  metaTime: { color: colors.accent, fontSize: fonts.label, fontWeight: '800' },
  metaTitle: { color: colors.textMuted, fontSize: fonts.small, marginTop: 4, lineHeight: 20 },
  metaConfidence: { color: colors.success, fontSize: fonts.small, marginTop: 4, fontWeight: '700' },
  metaConfidenceWeak: { color: colors.warning },
});
