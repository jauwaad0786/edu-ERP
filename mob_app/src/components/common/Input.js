// mob_app/src/components/common/Input.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secureTextEntry,
  error,
  helperText,
  keyboardType = 'default',
  autoCapitalize = 'none',
  style,
  inputStyle,
  ...rest
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSecure = secureTextEntry && !showPassword;

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          error ? styles.inputWrapperError : null,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={isFocused ? colors.primary : error ? colors.error : colors.muted}
            style={styles.icon}
          />
        )}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[styles.input, inputStyle]}
          {...rest}
        />

        {secureTextEntry ? (
          <TouchableOpacity
            onPress={() => setShowPassword(p => !p)}
            style={styles.eyeBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.muted}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
    backgroundColor: '#ffffff',
  },
  inputWrapperError: {
    borderColor: colors.error,
    backgroundColor: colors.errorBg,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14.5,
    color: colors.text,
    fontWeight: '500',
  },
  eyeBtn: {
    padding: 6,
  },
  errorText: {
    fontSize: 11.5,
    color: colors.error,
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 2,
  },
  helperText: {
    fontSize: 11.5,
    color: colors.textSubtle,
    marginTop: 4,
    marginLeft: 2,
  },
});
