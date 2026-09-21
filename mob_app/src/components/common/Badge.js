// mob_app/src/components/common/Badge.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export default function Badge({
  label,
  children,
  variant = 'info',
  size = 'sm',
  showDot = false,
  style,
}) {
  const content = label || children;

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return { bg: colors.successBg, text: colors.success, border: colors.successBorder, dot: colors.success };
      case 'warning':
        return { bg: colors.warningBg, text: colors.warningDark, border: colors.warningBorder, dot: colors.warning };
      case 'error':
      case 'danger':
        return { bg: colors.errorBg, text: colors.error, border: colors.errorBorder, dot: colors.error };
      case 'neutral':
        return { bg: colors.surfaceSubtle, text: colors.muted, border: colors.border, dot: colors.muted };
      case 'primary':
        return { bg: colors.primaryLight, text: colors.primary, border: colors.primaryLighter, dot: colors.primary };
      case 'info':
      default:
        return { bg: colors.infoBg, text: colors.info, border: colors.infoBorder, dot: colors.info };
    }
  };

  const v = getVariantStyles();
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          paddingVertical: isSm ? 3 : 5,
          paddingHorizontal: isSm ? 8 : 12,
        },
        style,
      ]}
    >
      {showDot && <View style={[styles.dot, { backgroundColor: v.dot }]} />}
      <Text
        style={[
          styles.text,
          {
            color: v.text,
            fontSize: isSm ? 10.5 : 12,
          },
        ]}
      >
        {content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 99,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
