import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import BigButton from '../components/BigButton';
import { colors, fonts, radius, spacing } from '../theme';

function Field({ label, placeholder, value, onChangeText, keyboardType, multiline, autoFocus }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        autoFocus={autoFocus}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="next"
      />
    </View>
  );
}

export default function SetupScreen({ onStart, error }) {
  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [repair, setRepair] = useState('');

  const ready =
    year.trim().length >= 2 &&
    make.trim().length > 0 &&
    model.trim().length > 0 &&
    repair.trim().length > 2;

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
          Tell me your vehicle and the job. I will write the steps and find the exact
          moment in a repair video for each one.
        </Text>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Field
          label="Year"
          placeholder="2014"
          value={year}
          onChangeText={setYear}
          keyboardType="number-pad"
          autoFocus
        />
        <Field label="Make" placeholder="Honda" value={make} onChangeText={setMake} />
        <Field label="Model" placeholder="Civic" value={model} onChangeText={setModel} />
        <Field
          label="What do you need to do?"
          placeholder="Replace the front brake pads"
          value={repair}
          onChangeText={setRepair}
          multiline
        />

        <BigButton
          label="Build my repair guide"
          onPress={() =>
            onStart({
              year: year.trim(),
              make: make.trim(),
              model: model.trim(),
              repair: repair.trim(),
            })
          }
          disabled={!ready}
          style={styles.submit}
        />

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
  field: { marginBottom: spacing.md },
  label: {
    color: colors.text,
    fontSize: fonts.label,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: fonts.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 62,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top', paddingTop: spacing.sm },
  submit: { marginTop: spacing.sm },
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
