// mob_app/src/components/common/KPICard.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export default function KPICard({
  label,
  value,
  sublabel,
  icon,
  accentColor = colors.primary,
  badgeText,
  badgeVariant = 'info',
  onPress,
  style,
}) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.card,
        { borderLeftColor: accentColor },
        style,
      ]}
    >
      <View style={styles.topRow}>
        {icon ? (
          <View style={[styles.iconBox, { backgroundColor: `${accentColor}15` }]}>
            <Ionicons name={icon} size={18} color={accentColor} />
          </View>
        ) : null}
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </View>

      <Text style={styles.value} numberOfLines={1}>{value}</Text>

      <View style={styles.footerRow}>
        {sublabel ? <Text style={styles.sublabel} numberOfLines={1}>{sublabel}</Text> : null}
        {badgeText ? (
          <View style={[styles.badge, { backgroundColor: `${accentColor}18` }]}>
            <Text style={[styles.badgeText, { color: accentColor }]}>{badgeText}</Text>
          </View>
        ) : null}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    flex: 1,
  },
  value: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  sublabel: {
    fontSize: 11,
    color: colors.textSubtle,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
