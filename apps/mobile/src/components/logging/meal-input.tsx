import { ArrowUp, Square } from 'lucide-react-native';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts, radii, space } from '~/theme/tokens';

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
    const [contentHeight, setContentHeight] = useState(40);
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
      <View style={styles.bar}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            { height: Math.min(120, Math.max(40, contentHeight)) },
          ]}
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Describe your meal…"
          placeholderTextColor={colors.stone}
          editable={!disabled}
          onContentSizeChange={(e) =>
            setContentHeight(e.nativeEvent.contentSize.height + 16)
          }
        />
        {disabled && onCancel ? (
          <Pressable style={styles.btn} onPress={onCancel} hitSlop={8}>
            <Square color="#ffffff" size={16} fill="#ffffff" />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.btn, !canSubmit && styles.btnDisabled]}
            onPress={submit}
            disabled={!canSubmit}
            hitSlop={8}
          >
            <ArrowUp color="#ffffff" size={20} />
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
    gap: space[2],
    padding: space[2],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii['2xl'],
    backgroundColor: colors.elev,
  },
  input: {
    flex: 1,
    fontFamily: fonts.sansRegular,
    fontSize: 16,
    color: colors.text,
    paddingHorizontal: space[2],
    paddingTop: space[2],
    textAlignVertical: 'top',
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    backgroundColor: colors.btn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
});
