import { ArrowUp, Square } from 'lucide-react-native';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts, fontSize, radii, shadow, space } from '~/theme/tokens';

export interface MealInputHandle {
  getText(): string;
  clear(): void;
  focus(): void;
  setText(text: string): void;
}

interface MealInputProps {
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

/** Natural-language meal composer: a growing multiline input + submit/stop. */
export const MealInput = forwardRef<MealInputHandle, MealInputProps>(
  function MealInput({ onSubmit, onCancel, disabled }, ref) {
    const [text, setText] = useState('');
    const [contentHeight, setContentHeight] = useState(32);
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<TextInput>(null);

    useImperativeHandle(
      ref,
      () => ({
        getText: () => text,
        clear: () => setText(''),
        focus: () => inputRef.current?.focus(),
        setText: (next: string) => setText(next),
      }),
      [text]
    );

    const canSubmit = text.trim().length > 0 && !disabled;
    const submit = () => {
      if (canSubmit) onSubmit(text);
    };

    return (
      <View style={[styles.bar, focused && styles.barFocused]}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            disabled && styles.inputDisabled,
            { height: Math.min(200, Math.max(32, contentHeight)) },
          ]}
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Describe your meal…"
          placeholderTextColor={colors.placeholderMuted40}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onContentSizeChange={(e) =>
            setContentHeight(e.nativeEvent.contentSize.height)
          }
        />
        {disabled && onCancel ? (
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              pressed && styles.btnPressed,
            ]}
            onPress={onCancel}
            hitSlop={8}
          >
            <Square color="#ffffff" size={14} fill="#ffffff" />
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              pressed && styles.btnPressed,
              !canSubmit && styles.btnDisabled,
            ]}
            onPress={submit}
            disabled={!canSubmit}
            hitSlop={8}
          >
            <ArrowUp color="#ffffff" size={16} />
          </Pressable>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[3],
    padding: space[3],
    borderWidth: 1,
    borderColor: colors.borderBiscotti40,
    borderRadius: radii.containerLg,
    backgroundColor: colors.elev,
    ...shadow.input,
  },
  barFocused: {
    borderColor: colors.borderAccent40,
    ...shadow.inputFocus,
  },
  input: {
    flex: 1,
    fontFamily: fonts.sansRegular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.text,
    paddingHorizontal: 0,
    paddingVertical: 6,
    textAlignVertical: 'top',
  },
  inputDisabled: { opacity: 0.5 },
  btn: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.btn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    backgroundColor: colors.btnHover,
    transform: [{ scale: 0.95 }],
  },
  btnDisabled: { opacity: 0.3 },
});
