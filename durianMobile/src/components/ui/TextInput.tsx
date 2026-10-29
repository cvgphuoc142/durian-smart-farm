import { forwardRef, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput as RNTextInput,
  View,
  type TextInputProps as RNTextInputProps,
} from 'react-native';

import { colors, fontFamily, radius, sizes } from '@/theme';

import { fieldBorder } from './FormField';
import { Icon } from './Icon';
import { Text } from './Text';

export interface TextInputProps extends RNTextInputProps {
  variant?: 'default' | 'search';
  error?: boolean;
  /** Unit or suffix shown inside the field, e.g. "ha", "₫". */
  suffix?: string;
  /** A control inside the field's right edge, e.g. a send button. */
  trailing?: ReactNode;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { variant = 'default', error = false, suffix, trailing, multiline, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? fieldBorder.error : focused ? fieldBorder.focus : fieldBorder.default;

  return (
    <View
      style={[
        styles.box,
        { borderColor },
        variant === 'search' && styles.search,
        multiline && styles.multiline,
      ]}
    >
      {variant === 'search' ? <Icon name="search" size={20} color="iconMuted" /> : null}
      <RNTextInput
        ref={ref}
        placeholderTextColor={colors.placeholder}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.inputMultiline, style]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {suffix ? (
        <Text variant="body" color="textMuted">
          {suffix}
        </Text>
      ) : null}
      {trailing}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: sizes.input,
    paddingHorizontal: 14,
    borderRadius: radius.input,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  search: { borderRadius: radius.pill, backgroundColor: colors.surface },
  multiline: { alignItems: 'flex-start', paddingVertical: 12 },
  input: {
    flex: 1,
    paddingVertical: 0,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.text,
  },
  inputMultiline: { minHeight: 84 },
});
