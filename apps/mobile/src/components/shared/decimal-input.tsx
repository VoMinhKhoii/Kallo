import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { parseDecimalInput } from '~/lib/dashboard/logic/format';
import { colors, fonts, radii, space } from '~/theme/tokens';

type DecimalInputProps = Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'keyboardType'
> & {
  value: number | undefined;
  onValueChange: (value: number | undefined) => void;
  /** Restrict the reported value to a whole number (e.g. height, age). */
  integer?: boolean;
};

function valueToText(value: number | undefined): string {
  return value === undefined || Number.isNaN(value) ? '' : String(value);
}

function textToValue(text: string, integer?: boolean): number | undefined {
  if (text.trim() === '') return undefined;
  const parsed = parseDecimalInput(text);
  if (integer && Number.isFinite(parsed)) return Math.trunc(parsed);
  return parsed;
}

/**
 * RN port of web `components/shared/decimal-input.tsx`. Keeps the user's raw
 * text locally while reporting a parsed number upstream, so an in-progress
 * decimal separator ("65,") isn't erased on each keystroke. Tolerates the comma
 * separator iOS/VN keyboards emit (via `parseDecimalInput`).
 */
export const DecimalInput = forwardRef<TextInput, DecimalInputProps>(
  function DecimalInput(
    { value, onValueChange, integer, onBlur, style, ...props },
    ref
  ) {
    const [text, setText] = useState(() => valueToText(value));
    const [syncedValue, setSyncedValue] = useState(value);

    // Sync external value changes (form reset, async load) into the text
    // without clobbering an in-progress entry that parses to the same value.
    if (!Object.is(value, syncedValue)) {
      setSyncedValue(value);
      if (!Object.is(textToValue(text, integer), value)) {
        setText(valueToText(value));
      }
    }

    return (
      <TextInput
        ref={ref}
        value={text}
        keyboardType={integer ? 'number-pad' : 'decimal-pad'}
        onChangeText={(raw) => {
          setText(raw);
          onValueChange(textToValue(raw, integer));
        }}
        onBlur={(e) => {
          const parsed = textToValue(text, integer);
          if (parsed !== undefined && Number.isFinite(parsed)) {
            setText(valueToText(parsed));
          }
          onBlur?.(e);
        }}
        placeholderTextColor={colors.textWarm}
        style={[styles.input, style]}
        {...props}
      />
    );
  }
);

const styles = StyleSheet.create({
  input: {
    width: '100%',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.elev,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.text,
  },
});
