// mob_app/src/screens/auth/LoggedOutSuccessScreen.js
// Exact match to Screen 16 of mockup: Celebratory logged out screen
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoggedOutSuccessScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      {/* Decorative soft circles in background */}
      <View style={[styles.decoCircle, { top: 60, left: 40, backgroundColor: '#fef3c7' }]} />
      <View style={[styles.decoCircle, { top: 120, right: 50, backgroundColor: '#dbeafe' }]} />
      <View style={[styles.decoCircle, { bottom: 180, left: 30, backgroundColor: '#ede9fe' }]} />
      <View style={[styles.decoCircle, { bottom: 140, right: 40, backgroundColor: '#dcfce7' }]} />

      <View style={styles.content}>
        {/* Big Circular Green Check */}
        <View style={styles.checkOuterRing}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={44} color="#ffffff" />
          </View>
        </View>

        <Text style={styles.title}>Logged Out Successfully!</Text>
        <Text style={styles.subtitle}>
          Thank you for using EduERP.{'\n'}See you again!
        </Text>

        <TouchableOpacity
          style={styles.btnWrapper}
          activeOpacity={0.85}
          onPress={() => navigation?.navigate ? navigation.navigate('Auth') : null}
        >
          <LinearGradient
            colors={['#0b57d0', '#083ca8']}
            style={styles.loginGradientBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.btnText}>Back to Login</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  decoCircle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    opacity: 0.6,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    width: '100%',
  },
  checkOuterRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 36,
  },
  btnWrapper: {
    width: '100%',
    maxWidth: 280,
  },
  loginGradientBtn: {
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b57d0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
