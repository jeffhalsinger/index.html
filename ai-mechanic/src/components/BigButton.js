import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { colors, fonts, radius, spacing, TAP_TARGET } from '../theme';

/**
 * The only button in the app. Deliberately large, high contrast, and with a
 * clear pressed state so it is obvious the tap registered even at a glance.
 */
export default function BigButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && !isDisabled && (isPrimary ? styles.primaryPressed : styles.secondaryPressed),
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.inner}>
        {loading && (
          <ActivityIndicator
            color={isPrimary ? colors.accentText : colors.text}
            style={styles.spinner}
          />
        )}
        <Text
          style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TAP_TARGET,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  inner: { flexDirection: 'row', alignItems: 'center' },
  spinner: { marginRight: spacing.sm },
  primary: { backgroundColor: colors.accent },
  primaryPressed: { backgroundColor: colors.accentPressed },
  secondary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.border,
  },
  secondaryPressed: { backgroundColor: colors.border },
  disabled: { opacity: 0.45 },
  label: { fontSize: fonts.body, fontWeight: '800', letterSpacing: 0.3 },
  primaryLabel: { color: colors.accentText },
  secondaryLabel: { color: colors.text },
});
