import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import BigButton from '../components/BigButton';
import { colors, fonts, radius, spacing } from '../theme';

// Tapping one of these fills the box, so the first run needs no typing at all.
const EXAMPLES = [
  '2014 Honda Civic — front brakes squeal and grind when I stop',
  '2011 F-150 5.0, need to change the spark plugs',
  'My Corolla is overdue for an oil change',
];

export default function SetupScreen({ onStart, error, question, initialText = '' }) {
  const [text, setText] = useState(initialText);
  const ready = text.trim().length > 3;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.heading}>AI Mechanic</Text>
        <Text style={styles.sub}>
          Tell me what you're driving and what's wrong. Plain words are fine — I'll work
          out the rest and find the video clips for each step.
        </Text>

        {/* A follow-up question from the AI takes priority over an error, because
            it means the request worked and just needs one more detail. */}
        {!!question && (
          <View style={styles.askBox}>
            <Text style={styles.askLabel}>One more thing</Text>
            <Text style={styles.askText}>{question}</Text>
          </View>
        )}

        {!question && !!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder={'e.g. 2014 Honda Civic, front brakes are grinding'}
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
          autoCapitalize="sentences"
          autoCorrect
          textAlignVertical="top"
        />

        <BigButton
          label="Build my repair guide"
          onPress={() => onStart(text.trim())}
          disabled={!ready}
          style={styles.submit}
        />

        {!text && (
          <View style={styles.examples}>
            <Text style={styles.examplesLabel}>Or tap an example</Text>
            {EXAMPLES.map((example) => (
              <Pressable
                key={example}
                onPress={() => setText(example)}
                style={({ pressed }) => [styles.example, pressed && styles.examplePressed]}
                accessibilityRole="button"
              >
                <Text style={styles.exampleText}>{example}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.footnote}>
          Always use jack stands. Never work under a vehicle held up by a jack alone.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  heading: {
    color: colors.text,
    fontSize: fonts.huge,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  sub: {
    color: colors.textMuted,
    fontSize: fonts.label,
    lineHeight: 25,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: fonts.body,
    lineHeight: 28,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    minHeight: 150,
    marginBottom: spacing.md,
  },
  submit: { marginBottom: spacing.lg },

  examples: { marginBottom: spacing.sm },
  examplesLabel: {
    color: colors.textMuted,
    fontSize: fonts.small,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  example: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    minHeight: 56,
    justifyContent: 'center',
  },
  examplePressed: { backgroundColor: colors.surfaceRaised },
  exampleText: { color: colors.textMuted, fontSize: fonts.label, lineHeight: 24 },

  askBox: {
    backgroundColor: '#123026',
    borderColor: colors.success,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  askLabel: {
    color: colors.success,
    fontSize: fonts.small,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  askText: { color: colors.text, fontSize: fonts.label, lineHeight: 26 },

  errorBox: {
    backgroundColor: '#3A1D1D',
    borderColor: colors.danger,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { color: '#FFD9D9', fontSize: fonts.small, lineHeight: 22 },

  footnote: {
    color: colors.textMuted,
    fontSize: fonts.small,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 21,
  },
});
