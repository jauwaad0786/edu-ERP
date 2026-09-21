// mob_app/src/components/common/GradientHero.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

let LinearGradient;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch (e) {
  LinearGradient = null;
}

export default function GradientHero({
  tagline = 'EduERP Mobile',
  title = '',
  subtitle = '',
  avatarText = '',
  gradientColors = colors.primaryGradient,
  rightElement = null,
  children,
  style,
}) {
  const initial = (avatarText || title || 'E').charAt(0).toUpperCase();

  const renderContent = () => (
    <View style={styles.inner}>
      <View style={styles.topRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
        </View>

        {rightElement || (
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        )}
      </View>

      {children ? <View style={styles.childContainer}>{children}</View> : null}
    </View>
  );

  if (LinearGradient) {
    return (
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, style]}
      >
        {renderContent()}
      </LinearGradient>
    );
  }

  // Fallback if LinearGradient is not present
  return (
    <View style={[styles.container, { backgroundColor: gradientColors[0] || colors.primaryDark }, style]}>
      <View style={[styles.overlay, { backgroundColor: gradientColors[1] || colors.primary }]} />
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.55,
  },
  inner: {
    position: 'relative',
    zIndex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagline: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.75)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 18,
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  childContainer: {
    marginTop: 16,
  },
});
