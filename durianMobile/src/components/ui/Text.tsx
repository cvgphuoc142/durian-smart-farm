import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, fontFamily, typography, type ColorToken, type TextVariant } from '@/theme';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  /** A colour token, or a raw colour (e.g. from `tones`). */
  color?: ColorToken | (string & {});
}

export function Text({ variant = 'body', color = 'text', style, ...rest }: TextProps) {
  const t = typography[variant];
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: fontFamily[t.weight],
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          color: color in colors ? colors[color as ColorToken] : color,
          fontVariant:
            variant === 'number' || variant === 'numberLg' ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  );
}
