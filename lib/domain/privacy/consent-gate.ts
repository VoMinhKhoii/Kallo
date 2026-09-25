/**
 * The client-side face of the AI-processing consent gate, as the hooks that
 * start an AI request consume it. The provider that implements it lives in
 * `components/privacy/`; hooks receive it as an argument rather than reading
 * the context, so `hooks/` never imports from `components/`.
 *
 * The server stays the enforcement point (403 `ai_consent_required`); this
 * only decides when to ask, so the first AI action asks instead of failing.
 */
export interface AiConsentGate {
  /**
   * Resolve true when consent is on record — asking first when it is not.
   * False means the user chose "Not now": send nothing.
   */
  ensure: () => Promise<boolean>;
  /**
   * The server refused with `ai_consent_required` (consent withdrawn on
   * another device, or a stale page): forget the cached answer and ask again.
   * Resolves with the answer, so the caller can re-send on true.
   */
  onRequired: () => Promise<boolean>;
}
