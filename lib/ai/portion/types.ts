/**
 * Shared types for the server-side portion / concept resolver (Phase 3).
 *
 * The resolver turns NLP-shaped quantity evidence (count, unit token, size,
 * explicit mass) into a grams band for a food CONCEPT — never a context-free
 * global gram value. Every prior is scoped to concept × unit-type × locale ×
 * form. See `resolver.ts` for the fallback ladder.
 */

/** BCP-47-ish locale tag used to scope units and priors. */
export type Locale = 'vi' | 'en' | 'global';

/**
 * Semantic unit TYPE a surface unit token maps to. NOT grams: "slice"/"bowl"
 * carry no global mass, only a shape of measurement. `mass` is a literal
 * weight; `count` is a discrete whole item; `container`/`volume`/`slice` need
 * a concept-scoped prior to become grams.
 */
export type UnitType = 'count' | 'slice' | 'volume' | 'mass' | 'container';

/** Cooking / physical form a prior is scoped to. */
export type FoodForm = 'raw' | 'cooked' | 'composed' | 'any';

/** Size cue → picks low/mid/high within a prior's band. */
export type SizeModifier = 'small' | 'medium' | 'large';

/** Whether a mass includes bone, shell, rind, or other physical refuse. */
export type MassBasis = 'gross_as_served' | 'edible' | 'unknown';

/** A grams triple: the resolver always returns a distribution, never a point. */
export interface GramsBand {
  low: number;
  mid: number;
  high: number;
}

/**
 * Stable food-concept id. A concept is the anchor a prior is scoped to; it may
 * (optionally) point to a nutrition DB row for verification. Concept ids are
 * kebab-case and locale-agnostic (e.g. `banh-bao`, `quail-egg`).
 */
export type ConceptId = string;

/** A curated food concept: what a normalized surface form resolves to. */
export interface FoodConcept {
  id: ConceptId;
  /** Human label for logs/telemetry. */
  label: string;
  /**
   * Optional link to a real DB `vietnamese_food_composition.name_primary` for
   * nutrition. Verified against the dev DB at authoring time. Absent when no
   * correct row exists yet (the concept still resolves a portion prior).
   */
  dbRowName?: string;
}

/** A locale-tagged unit lexicon entry: token → semantic unit type. */
export interface UnitLexiconEntry {
  token: string;
  locale: Locale;
  unitType: UnitType;
}

/**
 * A portion prior: (concept × unitType × locale × form) → grams band. This is
 * the ONLY layer that carries numeric grams for count/slice/volume/container
 * units, and it is always concept-scoped. `source` documents provenance.
 */
export interface PortionPrior {
  conceptId: ConceptId;
  unitType: UnitType;
  locale: Locale;
  form: FoodForm;
  /** Optional human-readable unit + concept label for prompt rendering. */
  promptLabel?: string;
  /** Grams for ONE unit of this type (per-unit; resolver multiplies by count). */
  perUnit: GramsBand;
  /** Physical basis of every value in `perUnit`. */
  massBasis: Exclude<MassBasis, 'unknown'>;
  confidence: 'high' | 'medium' | 'low';
  /** Free-text provenance note (source + review basis). */
  source: string;
}

/**
 * How the resolver arrived at grams. Mirrors the ladder step ordering so
 * telemetry can attribute the number.
 */
export type PortionProvenance =
  | 'explicit_user_mass' // step 1
  | 'packaged_serving' // step 2
  | 'retrieved_prior' // step 3 (locale/form-matched prior)
  | 'curated_prior' // step 4 (head-of-distribution prior)
  | 'user_prior' // step 5 (SEAM — not implemented)
  | 'llm_range' // step 6 (null → Call 2 estimates)
  | 'unresolved'; // step 7 (ambiguous / interval too wide → clarify)

/** Structured quantity evidence the resolver consumes (from Call 1 schema). */
export interface QuantityEvidence {
  count?: number;
  unitToken?: string;
  sizeModifier?: SizeModifier;
  explicitMass?: { grams: number; basis: MassBasis };
}

/**
 * A matched food concept handed to the resolver. `dbServingSizeG` /
 * `dbServingSizeG` carries the matched row's packaged weight when present
 * (ladder step 2). Both null for the vast majority of FAO rows.
 */
export interface ResolverConceptInput {
  conceptId: ConceptId | null;
  /** True when the surface form mapped to MORE than one concept (ambiguous). */
  ambiguous: boolean;
  locale: Locale;
  form: FoodForm;
  rawName?: string;
  canonicalName?: string;
  /**
   * Serving weight from the matched row (Open Food Facts packaged products).
   * DORMANT SEAM: only ~5 of ~7.5k rows carry serving_size_g today and no
   * caller threads it yet — ladder step 2 activates when packaged-product
   * data lands and the orchestrator passes the accepted row's serving weight.
   */
  dbServingSizeG?: number | null;
}

/** The resolver's verdict for one ingredient. */
export interface PortionResolution {
  /** null → defer to Call 2 (llm_range) or clarify (unresolved). */
  grams: GramsBand | null;
  /** Physical basis of `grams`; null when no grams were resolved. */
  massBasis: MassBasis | null;
  provenance: PortionProvenance;
  confidence: 'high' | 'medium' | 'low' | 'none';
  /** Set when provenance='unresolved'. Diagnostic label; `explicit_zero` is
   *  load-bearing — the bridge withholds the row so a typed 0 never yields
   *  calories. */
  unresolvedReason?: 'ambiguous_food' | 'unresolved_portion' | 'explicit_zero';
  /** Human note for telemetry (which prior, why null, etc.). */
  note: string;
}
