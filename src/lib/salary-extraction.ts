import { GoogleGenAI } from "@google/genai";

const EXTRACTION_PROMPT = `You are a payroll document analyst. Extract the employee's monthly salary from this labor contract or employment document.

Return ONLY valid JSON with this exact shape (no markdown fences):
{"monthly_salary": 3200}

Rules:
- Use the monthly net or gross salary stated in the contract (prefer net if both exist).
- Return a plain number in USD without currency symbols.
- If multiple amounts exist, pick the primary recurring monthly compensation.
- If you cannot determine a salary, return {"monthly_salary": null}`;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function parseSalaryJson(text: string): number | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { monthly_salary?: number | null };
    if (typeof parsed.monthly_salary === "number" && parsed.monthly_salary > 0) {
      return Math.round(parsed.monthly_salary * 100) / 100;
    }
  } catch {
    const match = cleaned.match(/"monthly_salary"\s*:\s*([0-9]+(?:\.[0-9]+)?)/);
    if (match) return Number(match[1]);
  }
  return null;
}

export async function extractMonthlySalaryFromContract(file: File): Promise<number> {
  const client = getGeminiClient();
  if (!client) {
    throw new Error("Gemini API key is not configured.");
  }

  const base64 = await fileToBase64(file);
  const mimeType = file.type || "application/pdf";

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  const text = response.text ?? "";
  const salary = parseSalaryJson(text);

  if (!salary) {
    throw new Error(
      "Could not extract a monthly salary from this document. Try a clearer PDF or image.",
    );
  }

  return salary;
}
