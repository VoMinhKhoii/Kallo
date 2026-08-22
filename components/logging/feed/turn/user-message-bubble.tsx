/**
 * The user's meal, as a sent chat message.
 *
 * Umber (`kallo-btn`), not the tan accent: this bubble carries running text, and
 * the palette rule is that tan "survives only on non-text moments" and never
 * colours running text. Tan would also fail contrast against the cream
 * (2.1:1); umber clears AA at 5.9:1.
 */
export function UserMessageBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-[18px] rounded-br-md bg-kallo-btn px-3.5 py-2.5 font-sans-display text-[13px] text-kallo-surface leading-relaxed">
        {text}
      </p>
    </div>
  );
}
