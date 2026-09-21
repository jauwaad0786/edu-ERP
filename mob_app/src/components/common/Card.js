// mob_app/src/components/common/Card.js
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export default function Card({
  children,
  style,
  onPress,
  padding = 16,
  leftAccentColor,
  activeOpacity = 0.75,
}) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      activeOpacity={activeOpacity}
      style={[
        styles.card,
        { padding },
        leftAccentColor ? { borderLeftWidth: 4, borderLeftColor: leftAccentColor } : null,
        style,
      ]}
    >
      {children}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
});
