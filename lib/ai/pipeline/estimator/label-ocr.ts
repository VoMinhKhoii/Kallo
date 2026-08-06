import { createGeminiClient, resolveGeminiProvider } from '@/lib/ai/gemini';
import {
  nutritionLabelScanSchema,
  type ParsedNutritionLabel,
} from '@/lib/nutrition/ocr-schema';

export const NUTRITION_LABEL_OCR_SYSTEM_PROMPT = `You are a precision Nutrition Label OCR extraction engine for Nhẩm, an AI meal tracking application.
Your task is to analyze packaging photos containing Nutrition Facts tables (Bảng Giá Trị Dinh Dưỡng / Thông tin dinh dưỡng).

Extraction Instructions:
1. Identify product name or brand name if printed near the table.
2. Identify the basis of the label:
   - "per_100g": Numbers are strictly per 100g or 100ml.
   - "per_serving": Numbers are strictly per serving (khẩu phần / phần / gói).
   - "both": Table displays dual columns (Per 100g and Per Serving).
3. Extract weight or volume of one serving if specified (e.g. 45 for "45g bar", 250 for "250ml box").
4. Identify servingSizeUnit as "g" for solid food items or "ml" for liquid items/beverages (sữa, nước ngọt, sinh tố, vv.).
5. Extract nutrition metrics cleanly. Convert values strictly to standard units:
   - Calories: kcal
   - Protein, Carbohydrates, Fat, Dietary Fiber: grams (g)
   - Sodium, Calcium, Iron, Potassium, Vitamin C: milligrams (mg)
   - Vitamin A, Vitamin D: micrograms (mcg)
6. Omit any unmapped or unsupported label fields (e.g. cholesterol, trans fat, added sugars, saturated fat). Return null for any supported field not present in the scan.
7. Rate extraction confidence ('high', 'medium', 'low') based on image clarity, blur, or obstruction.
`;

export interface ScanLabelOptions {
  imageBase64: string;
  mimeType: string;
  model?: string;
}

export async function scanNutritionLabelWithGemini(
  options: ScanLabelOptions
): Promise<ParsedNutritionLabel> {
  const providerConfig = resolveGeminiProvider();
  const gemini = createGeminiClient(providerConfig);
  const model = options.model ?? 'gemini-3.1-flash-lite';

  return gemini.generateStructuredOutput({
    schema: nutritionLabelScanSchema,
    systemPrompt: NUTRITION_LABEL_OCR_SYSTEM_PROMPT,
    userMessage:
      'Extract all nutrition table facts accurately according to the JSON schema.',
    image: {
      mimeType: options.mimeType,
      base64Data: options.imageBase64,
    },
    model,
    temperature: 0.1,
  });
}
