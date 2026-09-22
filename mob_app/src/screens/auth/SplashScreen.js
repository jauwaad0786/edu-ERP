// mob_app/src/screens/auth/SplashScreen.js
// Exact match to Screen 1 & Screen 17 of the mockup:
// Educational 3D illustration with school children & modern building,
// EduERP branding, pagination dots, Skip button, and seamless token verification.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const { user } = useAuth();
  const [slide, setSlide] = useState(0); // 0 = Screen 1 (Illustration + Quote), 1 = Screen 17 (Features)
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(20))[0];

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slide, fadeAnim, slideAnim]);

  // Handle Skip or Continue to Login
  const handleProceed = () => {
    if (user) {
      return;
    }
    navigation.replace('Auth');
  };

  const handleNextSlide = () => {
    if (slide === 0) {
      setSlide(1);
    } else {
      handleProceed();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Top Header Row with Skip Button */}
      <View style={styles.topBar}>
        <View style={{ width: 40 }} />
        <TouchableOpacity
          onPress={handleProceed}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.skipBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <Animated.View
        style={[
          styles.contentWrapper,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {slide === 0 ? (
          // ── Slide 1: School Illustration & Tagline (Screen 1 in Reference) ──
          <View style={styles.slideContainer}>
            {/* Branding Header */}
            <View style={styles.brandHeader}>
              <View style={styles.logoBadge}>
                <Ionicons name="school" size={28} color="#2563eb" />
              </View>
              <Text style={styles.brandTitle}>EduERP</Text>
              <Text style={styles.brandSubtitle}>One Platform</Text>
              <Text style={styles.brandSubtitleSmall}>For Smarter Education</Text>

              <View style={styles.taglineRow}>
                <Text style={styles.tagWord}>Learn</Text>
                <Text style={styles.tagDot}>•</Text>
                <Text style={styles.tagWord}>Manage</Text>
                <Text style={styles.tagDot}>•</Text>
                <Text style={styles.tagWord}>Grow</Text>
              </View>
            </View>

            {/* School & Children 3D Illustration */}
            <View style={styles.imageCard}>
              <Image
                source={require('../../../assets/school_splash_illustration.png')}
                style={styles.illustrationImage}
                resizeMode="cover"
              />
            </View>

            {/* Quote Pill Card */}
            <View style={styles.quoteCard}>
              <Text style={styles.quoteText}>“Better Schools</Text>
              <Text style={styles.quoteText}>Brighter Tomorrows”</Text>
            </View>
          </View>
        ) : (
          // ── Slide 2: Enterprise Features (Screen 17 in Reference) ──
          <View style={styles.slideContainer}>
            <View style={styles.brandHeader}>
              <View style={styles.logoBadge}>
                <Ionicons name="school" size={32} color="#2563eb" />
              </View>
              <Text style={styles.brandTitle}>EduERP</Text>
              <Text style={styles.brandSubtitle}>Education Simplified</Text>
              <Text style={styles.brandSubtitleSmall}>Futures Amplified</Text>
            </View>

            {/* 3 Pillar Cards: Students, Teachers, Parents */}
            <View style={styles.pillarsRow}>
              <View style={[styles.pillarCard, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="people" size={26} color="#16a34a" />
                <Text style={[styles.pillarText, { color: '#16a34a' }]}>Students</Text>
              </View>
              <View style={[styles.pillarCard, { backgroundColor: '#ede9fe' }]}>
                <Ionicons name="school" size={26} color="#7c3aed" />
                <Text style={[styles.pillarText, { color: '#7c3aed' }]}>Teachers</Text>
              </View>
              <View style={[styles.pillarCard, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="heart" size={26} color="#2563eb" />
                <Text style={[styles.pillarText, { color: '#2563eb' }]}>Parents</Text>
              </View>
            </View>

            <View style={[styles.quoteCard, { marginTop: 40 }]}>
              <Text style={[styles.quoteText, { fontSize: 16 }]}>
                Stronger Together
              </Text>
              <Text style={[styles.quoteText, { fontSize: 15, fontWeight: '600', color: '#64748b' }]}>
                for a Brighter Tomorrow
              </Text>
            </View>
          </View>
        )}
      </Animated.View>

      {/* Bottom Navigation Row: Indicator Dots + Next/Enter Button */}
      <View style={styles.bottomBar}>
        {/* Pagination Dots */}
        <View style={styles.paginationDots}>
          <View style={[styles.dot, slide === 0 ? styles.dotActive : styles.dotInactive]} />
          <View style={[styles.dot, slide === 1 ? styles.dotActive : styles.dotInactive]} />
        </View>

        {/* Circular Next Button */}
        <TouchableOpacity
          onPress={handleNextSlide}
          style={styles.nextBtnContainer}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#2563eb', '#4f46e5']}
            style={styles.nextGradientBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="arrow-forward" size={22} color="#ffffff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  slideContainer: {
    width: '100%',
    alignItems: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1e3a8a',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 2,
  },
  brandSubtitleSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3b82f6',
    marginTop: 1,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  tagWord: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tagDot: {
    fontSize: 12,
    color: '#94a3b8',
  },
  imageCard: {
    width: width * 0.86,
    height: width * 0.86,
    maxHeight: 330,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
  },
  quoteCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  quoteText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#1e293b',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  pillarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 30,
  },
  pillarCard: {
    width: width * 0.26,
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarText: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 24,
    paddingTop: 12,
  },
  paginationDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 28,
    backgroundColor: '#2563eb',
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#cbd5e1',
  },
  nextBtnContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  nextGradientBtn: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
