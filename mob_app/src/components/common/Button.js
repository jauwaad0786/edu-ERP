// mob_app/src/components/common/Button.js
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export default function Button({
  title,
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
}) {
  const label = title || children;

  const getVariant = () => {
    switch (variant) {
      case 'secondary':
        return { bg: colors.surfaceSubtle, text: colors.text, border: colors.border };
      case 'outline':
        return { bg: 'transparent', text: colors.primary, border: colors.primary };
      case 'danger':
        return { bg: colors.error, text: '#ffffff', border: colors.error };
      case 'success':
        return { bg: colors.success, text: '#ffffff', border: colors.success };
      case 'primary':
      default:
        return { bg: colors.primary, text: '#ffffff', border: colors.primary };
    }
  };

  const v = getVariant();
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          paddingVertical: isSm ? 8 : isLg ? 16 : 12,
          paddingHorizontal: isSm ? 14 : 20,
          opacity: disabled ? 0.6 : 1,
        },
        fullWidth && styles.fullWidth,
        variant === 'primary' && styles.primaryShadow,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <View style={styles.contentRow}>
          {icon && (
            <Ionicons
              name={icon}
              size={isSm ? 15 : isLg ? 20 : 18}
              color={v.text}
              style={{ marginRight: 8 }}
            />
          )}
          <Text
            style={[
              styles.text,
              {
                color: v.text,
                fontSize: isSm ? 12.5 : isLg ? 16 : 14.5,
              },
              textStyle,
            ]}
          >
            {label}
          </Text>
          {iconRight && (
            <Ionicons
              name={iconRight}
              size={isSm ? 15 : isLg ? 20 : 18}
              color={v.text}
              style={{ marginLeft: 8 }}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  primaryShadow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
