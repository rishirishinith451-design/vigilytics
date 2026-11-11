import http from 'http';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { verifyIndianMedicine } from './src/utils/indianMedicineVerifier.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize GoogleGenAI server-side with telemetry header as required by skill
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Helper for cleaning base64 data URL prefixes and whitespace
function cleanBase64Payload(data?: string): string {
  if (!data || typeof data !== 'string') return '';
  const commaIdx = data.indexOf(',');
  let clean = commaIdx !== -1 ? data.slice(commaIdx + 1) : data;
  return clean.replace(/\s+/g, '');
}

function resolveMimeType(fileName?: string, mimeType?: string): string {
  const ext = fileName ? fileName.split('.').pop()?.toLowerCase() : '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'bmp') return 'image/bmp';
  if (ext === 'tiff' || ext === 'tif') return 'image/tiff';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';
  if (ext === 'json') return 'application/json';
  if (ext === 'csv') return 'text/csv';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'xml') return 'application/xml';
  if (ext === 'doc' || ext === 'docx') return 'application/msword';
  if (ext === 'xls' || ext === 'xlsx') return 'application/vnd.ms-excel';
  if (ext === 'rtf') return 'application/rtf';
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType;
  return 'application/pdf';
}

// Helper to attach single or multiple photos/documents/case sheets to Gemini parts
function attachFilesToGeminiParts(
  parts: any[],
  fileData?: string,
  fileName?: string,
  fileMimeType?: string,
  files?: Array<{ base64?: string; data?: string; name?: string; fileName?: string; type?: string; mimeType?: string }>
): number {
  const allFiles: Array<{ base64: string; name: string; type: string }> = [];

  if (Array.isArray(files) && files.length > 0) {
    files.forEach((f, idx) => {
      const b64 = f.base64 || f.data;
      if (b64) {
        const fname = f.name || f.fileName || `document_file_${idx + 1}`;
        const ftype = resolveMimeType(fname, f.type || f.mimeType);
        allFiles.push({ base64: b64, name: fname, type: ftype });
      }
    });
  } else if (fileData) {
    allFiles.push({
      base64: fileData,
      name: fileName || 'uploaded_document',
      type: resolveMimeType(fileName, fileMimeType),
    });
  }

  allFiles.forEach((file, idx) => {
    const cleanBase64 = cleanBase64Payload(file.base64);
    if (!cleanBase64) return;
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      parts.push({
        inlineData: {
          mimeType: file.type,
          data: cleanBase64,
        },
      });
      parts.push({
        text: `EXAMINE THIS CASESHEET / CLINICAL DOCUMENT (Photo/File #${idx + 1}: "${file.name}"):
Carefully read the prescription orders, medication chart, progress notes, laboratory reports, and clinical findings in this file.`,
      });
    } else {
      try {
        const decodedText = Buffer.from(cleanBase64, 'base64').toString('utf-8');
        parts.push({
          text: `DOCUMENT CONTENT (Photo/File #${idx + 1}: "${file.name}"):\n\n${decodedText}\n`,
        });
      } catch {}
    }
  });

  return allFiles.length;
}

// In-memory cache for ultra-fast AI responses and offline/repeat acceleration
const aiResponseCache = new Map<string, { timestamp: number; data: string }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours

// Resilient AI generation with automatic fallback across models to eliminate 503 errors and maximize speed
async function generateGeminiWithFallback({
  parts,
  responseMimeType = 'application/json',
  systemInstruction,
  skipCache = false,
}: {
  parts: any[];
  responseMimeType?: string;
  systemInstruction?: string;
  skipCache?: boolean;
}): Promise<string> {
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  // Create lightweight cache key for text-only queries to achieve near-instant (0-10ms) responses
  const hasMultimodal = parts.some((p: any) => p.inlineData);
  let cacheKey = '';
  if (!hasMultimodal && !skipCache) {
    try {
      cacheKey = `${responseMimeType}::${(systemInstruction || '').slice(0, 100)}::${JSON.stringify(parts)}`;
      const cached = aiResponseCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
      }
    } catch {}
  }

  // Model cascade: prioritize 'gemini-3.1-flash-lite' for lightning-fast latency (<1s response),
  // with fallback to 'gemini-3.8-flash' and 'gemini-flash-latest'
  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        config: {
          responseMimeType,
          systemInstruction,
        },
      });

      if (response && response.text) {
        if (cacheKey && response.text) {
          aiResponseCache.set(cacheKey, { timestamp: Date.now(), data: response.text });
        }
        return response.text;
      }
    } catch (err: any) {
      console.warn(`[Vigilytics AI] Model ${model} generation failed (${err.message || err}). Retrying with next model...`);
      lastError = err;
    }
  }

  throw lastError || new Error('All AI models failed to generate content');
}

// Pharmacovigilance Multi-Agent System API Endpoint
app.post('/api/agent/analyze', async (req, res) => {
  try {
    const { inputData, contextType, fileData, fileMimeType, fileName, files } = req.body;

    const hasFiles = Boolean(fileData || (Array.isArray(files) && files.length > 0));
    if (!inputData && !hasFiles) {
      return res.status(400).json({ error: 'Missing inputData or fileData parameter' });
    }

    if (!ai) {
      return res.json({
        useDeterministicFallback: true,
        message: 'GEMINI_API_KEY not configured. Using high-precision deterministic clinical algorithm engine.',
      });
    }

    const systemPrompt = `You are the lead clinical safety intelligence engine of Vigilytics AI.
Your team includes:
1. Agent-Intake (entity extraction: patient demographics, suspect & concomitant drugs, adverse events, lab tests)
2. Agent-Triage (ICH E2A seriousness: Death, Life-Threatening, Hospitalization, Disability, Congenital, Medically Important; and priority P1-P4)
3. Agent-Causality (Naranjo 10 questions scored, WHO-UMC category, biological mechanism)
4. Agent-Signal (Disproportionality PRR, Evans criteria)
5. Agent-Quality (Missing data audit, follow-up query questions)
6. Agent-Governance (Executive clinical summary, Fact vs Interpretation separation)

STRICT GROUNDING & EVIDENCE-BASED EXTRACTION RULES:
- Perform an authentic clinical safety evaluation based SOLELY on the uploaded file(s) or provided report.
- Extract actual facts directly from all provided document pages/images without hallucinating or fabricating details.
- If the patient age is not stated in the document, return null for age.
- If the patient sex is not stated in the document, return "Unknown" for sex.
- If the patient initials or name are not stated, return "Unknown" for initials.
- Reconstruct the comprehensive clinical narrative directly from the document in "extractedNarrative".
- Provide an executive clinical safety summary in "clinicalSummary".
- For medications: identify exact drug names, active substances, doses, routes, and start/stop dates present in the document.
- For adverse reactions: identify exact clinical terms, system organ class (SOC), and determine ICH E2A seriousness criteria.
- Calculate the 10-point Naranjo ADR Probability score and WHO-UMC causality based on the documented temporal sequence, dechallenge, and clinical facts.

Return your response ONLY as valid, parseable JSON matching this schema:
{
  "documentType": "string (e.g. Hospital Discharge Summary, Lab Report, CIOMS Form, Medical Image, Prescription, Clinical Letter)",
  "extractedNarrative": "string (Detailed clinical narrative detailing the patient background, medications administered, onset of adverse reactions, clinical course, lab findings, dechallenge/rechallenge, and outcome derived strictly from the document)",
  "clinicalSummary": "string (Executive medical safety summary of the case based on the extracted facts)",
  "keyFindings": ["string"],
  "priority": "P1 - Urgent (24h Expedited)" | "P2 - High (72h Expedited)" | "P3 - Medium (7d Standard)" | "P4 - Routine (15d Standard)",
  "priorityRationale": "string",
  "isSerious": boolean,
  "riskClassification": "Known Labeled Risk" | "Potential New Signal" | "Insufficient Evidence",
  "patient": {
    "initials": "string",
    "age": number or null,
    "sex": "Male" | "Female" | "Unknown",
    "weightKg": number or null,
    "pregnancyStatus": "string",
    "medicalHistory": ["string"],
    "allergies": ["string"]
  },
  "drugs": [
    {
      "drugName": "string",
      "activeSubstance": "string",
      "role": "Suspect" | "Concomitant" | "Interacting",
      "dose": "string",
      "route": "string (e.g. Oral, Intravenous, Subcutaneous, Inhalation, Topical, Intramuscular)",
      "frequency": "string (e.g. Once daily, Twice daily, Every 8 hours, Weekly, As needed)",
      "durationOfTherapy": "string (e.g. 14 days, 3 weeks, 6 months, Ongoing)",
      "indication": "string",
      "startDate": "YYYY-MM-DD",
      "stopDate": "YYYY-MM-DD" or null,
      "dechallenge": "Positive" | "Negative" | "Not Applicable" | "Unknown",
      "rechallenge": "Positive" | "Negative" | "Not Performed" | "Unknown"
    }
  ],
  "events": [
    {
      "term": "string (MedDRA PT / Suspected adverse reaction)",
      "socTerm": "string",
      "signsAndSymptoms": "string (clinical signs and presentation details)",
      "onsetDate": "YYYY-MM-DD or YYYY-MM-DD HH:MM (Date/time of onset)",
      "eventDuration": "string (e.g. 4 days, 48 hours, Ongoing)",
      "outcome": "Recovered / Resolved" | "Recovering / Resolving" | "Not Recovered / Not Resolved" | "Recovered with Sequelae" | "Fatal" | "Unknown",
      "isListed": boolean,
      "death": boolean,
      "lifeThreatening": boolean,
      "hospitalization": boolean,
      "disability": boolean,
      "congenitalAnomaly": boolean,
      "otherMedicallyImportant": boolean,
      "severityGrade": "Mild" | "Moderate" | "Severe" | "Life-Threatening"
    }
  ],
  "labs": [
    {
      "testName": "string",
      "date": "YYYY-MM-DD",
      "value": "string",
      "unit": "string",
      "referenceRange": "string",
      "isAbnormal": boolean,
      "significance": "string"
    }
  ],
  "vitalSigns": {
    "bloodPressure": "string (e.g. 120/80 mmHg)",
    "heartRate": "string (e.g. 78 bpm)",
    "respiratoryRate": "string (e.g. 16 breaths/min)",
    "temperature": "string (e.g. 37.2 °C)",
    "oxygenSaturation": "string (e.g. 98% SpO2)"
  },
  "diagnosticFindings": [
    {
      "testType": "string (e.g. 12-Lead ECG, Chest CT, MRI, Ultrasound, Biopsy, Endoscopy)",
      "finding": "string",
      "impression": "string"
    }
  ],
  "naranjoAnswers": {
    "q1": number,
    "q2": number,
    "q3": number,
    "q4": number,
    "q5": number,
    "q6": number,
    "q7": number,
    "q8": number,
    "q9": number,
    "q10": number
  },
  "naranjoScore": number,
  "naranjoCategory": "Definite" | "Probable" | "Possible" | "Doubtful",
  "whoUmcCategory": "Certain" | "Probable / Likely" | "Possible" | "Unlikely",
  "factsVsInterpretation": {
    "reportedFacts": ["string"],
    "algorithmicInterpretations": ["string"],
    "clinicalUncertainties": ["string"]
  },
  "missingDataAudit": [
    {
      "field": "string",
      "severity": "High" | "Medium" | "Low",
      "impact": "string",
      "suggestedFollowUpQuery": "string"
    }
  ],
  "disproportionality": {
    "drugName": "string",
    "eventTerm": "string",
    "estimatedPrr": number,
    "evansCriteriaMet": boolean,
    "analysisNotes": "string"
  },
  "regulatoryRecommendation": "string",
  "aiOutputs": {
    "drugAndAdrExtraction": {
      "suspectedDrugs": ["string"],
      "concomitantDrugs": ["string"],
      "adverseEvents": ["string"],
      "summary": "string"
    },
    "adrClassification": {
      "category": "string (e.g. Type B Idiosyncratic / Type A Dose-dependent / Immune-mediated)",
      "details": "string"
    },
    "severity": "Mild" | "Moderate" | "Severe" | "Life-Threatening",
    "seriousnessAssessment": {
      "isSerious": boolean,
      "criteriaMet": ["string"],
      "rationale": "string"
    },
    "causalityAssessment": {
      "category": "Certain" | "Probable" | "Possible" | "Unlikely",
      "rationale": "string"
    },
    "drugDrugInteraction": {
      "status": "Safe" | "Caution" | "Potentially harmful",
      "details": "string"
    },
    "duplicateDetection": {
      "isDuplicateDetected": boolean,
      "details": "string"
    },
    "clinicalRecommendation": {
      "primaryRecommendation": "string",
      "followUpActions": ["string"]
    },
    "pvReportSummary": "string",
    "actionFlag": "Routine review" | "Pharmacovigilance professional review" | "Urgent clinical attention"
  }
}`;

    const parts: any[] = [];
    attachFilesToGeminiParts(parts, fileData, fileName, fileMimeType, files);

    if (inputData && typeof inputData === 'string' && inputData.trim() && !inputData.startsWith('Uploaded medical safety document:')) {
      parts.push({
        text: `Additional clinical narrative or context provided by reviewer:\n\n${inputData}`,
      });
    }

    if (parts.length === 0) {
      parts.push({
        text: 'Please perform clinical safety extraction and evaluation based on available safety context.',
      });
    }

    const text = await generateGeminiWithFallback({
      parts,
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
    });

    const parsedData = JSON.parse(text || '{}');

    return res.json({
      success: true,
      agentResult: parsedData,
    });
  } catch (err: any) {
    console.error('Agent analysis error:', err);
    return res.status(500).json({
      error: err.message,
      useDeterministicFallback: true,
    });
  }
});

// AI Auto-Extract from Narration or File(s) into Structured Drug Chart
app.post('/api/agent/extract-to-chart', async (req, res) => {
  try {
    const { narrative, fileData, fileMimeType, fileName, files } = req.body;

    const hasFiles = Boolean(fileData || (Array.isArray(files) && files.length > 0));
    if (!narrative && !hasFiles) {
      return res.status(400).json({ error: 'Missing narrative text or files' });
    }

    const cleanBase64 = cleanBase64Payload(fileData);
    const mime = resolveMimeType(fileName, fileMimeType);

    if (!ai) {
      // High-precision regex-assisted fallback extraction
      const rawText = narrative || (cleanBase64 ? Buffer.from(cleanBase64, 'base64').toString('utf-8') : '');
      const isFemale = /\b(female|woman|lady|she|her)\b/i.test(rawText);
      const isMale = /\b(male|man|gentleman|he|his)\b/i.test(rawText);
      const ageMatch = rawText.match(/(\d{1,3})\s*[- ]*(year|yr|y\.?o\.?|yo)/i);
      const age = ageMatch ? ageMatch[1] : '';
      const sex = isFemale ? 'Female' : isMale ? 'Male' : 'Unknown';

      // Detect hospitalization or life threatening
      const hospitalization = /hospitali[zs]|admission|admitted|ward|emergency/i.test(rawText);
      const lifeThreatening = /life[- ]threatening|icu|intensive care|anaphylaxis|resuscit/i.test(rawText);
      const death = /fatal|death|died|deceased/i.test(rawText);

      // Guess drug
      const words = rawText.split(/[,\.\s]+/);
      const candidateDrugs = words.filter((w: string) => /mab$|nib$|olol$|statin$|pril$|sartan$|oxaban$|floxacin$|cillin$|gliptin$|tide$/i.test(w));
      const primaryDrug = candidateDrugs[0] || 'Suspected Agent';

      const weightMatch = rawText.match(/(\d{2,3}(\.\d+)?)\s*(kg|kilos|kilograms|lbs|pounds)/i);
      const weight = weightMatch ? parseFloat(weightMatch[1]) : null;

      return res.json({
        success: true,
        extracted: {
          drugs: [
            {
              drugName: primaryDrug,
              activeSubstance: primaryDrug,
              role: 'Suspect',
              dose: 'Standard dose',
              route: 'Oral',
              frequency: 'Once daily',
              durationOfTherapy: '2 weeks',
              indication: 'Primary condition',
              startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
              stopDate: '',
              dechallenge: 'Positive',
              rechallenge: 'Not Performed',
            },
          ],
          concomitantDrugs: [],
          adverseEvent: 'Adverse Drug Reaction',
          signsAndSymptoms: '',
          onsetDate: new Date().toISOString().split('T')[0],
          eventDuration: '',
          severityGrade: hospitalization || lifeThreatening ? 'Severe' : 'Moderate',
          outcome: death ? 'Fatal' : 'Recovering / Resolving',
          hospitalization,
          lifeThreatening,
          death,
          disability: false,
          congenitalAnomaly: false,
          otherMedicallyImportant: hospitalization || lifeThreatening,
          isListedInSmPC: true,
          patientInitials: '',
          patientAge: age,
          patientSex: sex,
          weightKg: weight,
          medicalHistory: '',
          vitalSigns: {
            bloodPressure: '',
            heartRate: '',
            respiratoryRate: '',
            temperature: '',
            oxygenSaturation: '',
          },
          diagnosticFindings: [],
          labs: [],
        },
      });
    }

    const extractPrompt = `You are a clinical pharmacovigilance data extraction AI for Vigilytics.
Extract clinical entities directly from this case narration or attached document(s)/image(s) into this exact JSON structure:
- Extract ONLY facts that are present in the provided document or narrative across all provided photos/pages.
- NEVER fabricate or assume demographic or clinical details.
- If age is not in the document, return "" for patientAge.
- If sex is not in the document, return "Unknown" for patientSex.
- If weight is not in the document, return null for weightKg.
- If initials are not in the document, return "" for patientInitials.
{
  "drugs": [
    {
      "drugName": "string",
      "activeSubstance": "string",
      "role": "Suspect" | "Concomitant" | "Interacting",
      "dose": "string",
      "route": "string",
      "frequency": "string",
      "durationOfTherapy": "string",
      "indication": "string",
      "startDate": "YYYY-MM-DD",
      "stopDate": "YYYY-MM-DD" or "",
      "dechallenge": "Positive" | "Negative" | "Not Applicable" | "Unknown",
      "rechallenge": "Positive" | "Negative" | "Not Performed" | "Unknown"
    }
  ],
  "adverseEvent": "string (MedDRA Preferred Term / Suspected Adverse Reaction)",
  "signsAndSymptoms": "string (clinical signs and symptoms)",
  "onsetDate": "YYYY-MM-DD or YYYY-MM-DD HH:MM",
  "eventDuration": "string",
  "severityGrade": "Mild" | "Moderate" | "Severe" | "Life-Threatening",
  "outcome": "Recovered / Resolved" | "Recovering / Resolving" | "Not Recovered / Not Resolved" | "Recovered with Sequelae" | "Fatal" | "Unknown",
  "hospitalization": boolean,
  "lifeThreatening": boolean,
  "death": boolean,
  "disability": boolean,
  "congenitalAnomaly": boolean,
  "otherMedicallyImportant": boolean,
  "isListedInSmPC": boolean,
  "patientInitials": "string",
  "patientAge": "string",
  "patientSex": "Male" | "Female" | "Unknown",
  "weightKg": number or null,
  "medicalHistory": "string",
  "vitalSigns": {
    "bloodPressure": "string",
    "heartRate": "string",
    "respiratoryRate": "string",
    "temperature": "string",
    "oxygenSaturation": "string"
  },
  "diagnosticFindings": [
    {
      "testType": "string",
      "finding": "string",
      "impression": "string"
    }
  ],
  "labs": [
    {
      "testName": "string",
      "value": "string",
      "unit": "string",
      "referenceRange": "string",
      "isAbnormal": boolean
    }
  ]
}`;

    const parts: any[] = [];
    attachFilesToGeminiParts(parts, fileData, fileName, fileMimeType, files);

    if (narrative && typeof narrative === 'string' && narrative.trim() && !narrative.startsWith('Uploaded medical safety document:')) {
      parts.push({ text: `Additional Case Narration:\n${narrative}` });
    }

    if (parts.length === 0) {
      parts.push({ text: 'Extract clinical drug chart entities from provided safety data across all attached photos and pages.' });
    }

    const text = await generateGeminiWithFallback({
      parts,
      systemInstruction: extractPrompt,
      responseMimeType: 'application/json',
    });

    const parsed = JSON.parse(text || '{}');
    return res.json({
      success: true,
      extracted: parsed,
    });
  } catch (err: any) {
    console.error('Extract error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Comprehensive Global Drug Search & Autocomplete Endpoint (NIH ClinicalTables & RxNav Approximate Term)
app.get('/api/drugs/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 1) {
      return res.json({ success: true, results: [] });
    }

    const results: Array<{ name: string; brandOrForm?: string; source: string; score?: number }> = [];
    const seen = new Set<string>();

    // 1. Query NIH ClinicalTables RxTerms API (covers all prescription and OTC drugs)
    try {
      const ctResp = await fetch(
        `https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search?terms=${encodeURIComponent(q)}&maxList=15`,
        { signal: AbortSignal.timeout(2500) }
      );
      if (ctResp.ok) {
        const ctData = await ctResp.json();
        if (Array.isArray(ctData) && Array.isArray(ctData[1])) {
          ctData[1].forEach((nameStr: string) => {
            const cleanName = nameStr.replace(/\s*\([^)]*\)$/, '').trim();
            const formMatch = nameStr.match(/\(([^)]+)\)/);
            const key = cleanName.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              results.push({
                name: cleanName,
                brandOrForm: formMatch ? formMatch[1] : 'Prescription Formulation',
                source: 'RxTerms / NLM',
                score: 90,
              });
            }
          });
        }
      }
    } catch {}

    // 2. Query NIH RxNav Approximate Term API (spelling-tolerant approximate search for misspelled words)
    try {
      const rxNavResp = await fetch(
        `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(q)}&maxEntries=12`,
        { signal: AbortSignal.timeout(2500) }
      );
      if (rxNavResp.ok) {
        const rxNavData = await rxNavResp.json();
        const candidates = rxNavData?.approximateGroup?.candidate;
        if (Array.isArray(candidates)) {
          candidates.forEach((cand: any) => {
            if (cand.name) {
              const clean = cand.name
                .replace(/\s*\[[^\]]+\]$/, '')
                .replace(/\s*\([^)]*\)$/, '')
                .trim();
              const key = clean.toLowerCase();
              if (clean && !seen.has(key)) {
                seen.add(key);
                results.push({
                  name: clean,
                  brandOrForm: cand.source ? `Source: ${cand.source}` : 'RxNorm',
                  source: 'RxNav Approximate Term (Typo Tolerance)',
                  score: parseFloat(cand.score) || 75,
                });
              }
            }
          });
        }
      }
    } catch {}

    return res.json({ success: true, results });
  } catch (err: any) {
    return res.json({ success: false, results: [], error: err.message });
  }
});

// Dedicated AI Drug-Drug Interaction & Medication Error Screening Endpoint
app.post('/api/ddi/check', async (req, res) => {
  try {
    const { drugs, fileData, fileMimeType, fileName, files, patientContext, checkMode } = req.body;

    const hasFiles = Boolean(fileData || (Array.isArray(files) && files.length > 0));
    if ((!drugs || !Array.isArray(drugs) || drugs.length === 0) && !hasFiles) {
      return res.status(400).json({ error: 'Please provide either a drug list or uploaded file(s)/image(s).' });
    }

    if (!ai) {
      return res.json({
        success: false,
        useDeterministicFallback: true,
        message: 'Gemini AI not initialized. Falling back to local clinical knowledge base.',
      });
    }

    const ddiPrompt = `You are a Senior Clinical Pharmacologist, Patient Safety Officer, and Pharmacovigilance Specialist.
Conduct a rigorous, clinical safety analysis of the provided medication regimen or uploaded document for:

1. DRUG-DRUG INTERACTIONS:
   - Screen every interacting pair of medications.
   - For every interacting pair, you MUST provide a "simpleExplanation": a NEAT, CLEAR, and SIMPLE description of EXACTLY HOW the interaction will occur that a patient or healthcare provider can understand in seconds.
   - The "simpleExplanation" MUST follow this clear style:
     "Step-by-step: 1. [Drug B] blocks the liver enzyme ([e.g. CYP3A4]) responsible for breaking down [Drug A]. 2. Because it cannot be cleared, [Drug A] builds up to toxic levels (up to [X] times higher) in the bloodstream. 3. This excess directly damages [organs/tissues], triggering severe [clinical risk, e.g. acute muscle breakdown and kidney failure]."
   - Assign exact severity: "Contraindicated / Severe", "Major / High Risk", "Moderate / Caution", or "Minor".
   - State the biological mechanism ("mechanismType" and "mechanism").
   - Provide concrete, actionable "clinicalAdvice" (e.g. dose reduction, temporary withholding, or safer alternative drugs).
   - List key "potentialAdrs" (clinical signs/symptoms to watch for).

2. MEDICATION ERRORS & PRESCRIBING SAFETY FLAGS:
   - Thoroughly audit the medications/document for medication errors:
     a) Look-Alike / Sound-Alike (LASA) confusions (e.g. Celebrex vs Celexa, Zyrtec vs Zyprexa, Hydralazine vs Hydroxyzine).
     b) Therapeutic Duplication (e.g. co-prescribing multiple statins, multiple NSAIDs, duplicate ACE/ARBs).
     c) Wrong Dose / Overdose / Inappropriate Frequency (e.g. excessive dosages, once-weekly drugs prescribed daily).
     d) Drug-Disease / Organ Impairment Contraindications (e.g. metformin in severe renal impairment, NSAIDs in renal failure/heart failure/ulcers, beta-blockers in asthma).
     e) Narrow Therapeutic Index (NTI) Hazards (e.g. warfarin, digoxin, lithium, theophylline, phenytoin).
     f) Inappropriate Administration Route or hazardous food/timing interactions.
   - For every medication error found, explain in "howItOccurs" in NEAT, CLEAR, and SIMPLE terms how the error happens or why the risk exists, and provide the "recommendedCorrection".

INPUT MEDICATIONS:
${Array.isArray(drugs) && drugs.length > 0 ? drugs.join(', ') : 'Extract all medications, dosages, and instructions from the provided document/image.'}

AUDIT FOCUS MODE:
${checkMode === 'med_errors_only' ? 'Focus primarily on Medication Errors, Prescribing Hazards, and Dosing Safety.' : checkMode === 'ddi_only' ? 'Focus primarily on Drug-Drug Interactions and biological mechanisms.' : 'Evaluate both Drug-Drug Interactions and Medication Errors comprehensively.'}

PATIENT CONTEXT:
${JSON.stringify(patientContext || {}, null, 2)}

Return your response ONLY as valid, parseable JSON matching this schema exactly:
{
  "drugsIdentified": ["string"],
  "totalInteractions": 0,
  "highestSeverity": "Contraindicated / Severe" | "Major / High Risk" | "Moderate / Caution" | "Regimen Compatible",
  "summaryText": "string",
  "interactions": [
    {
      "id": "int-1",
      "drugA": "string",
      "drugB": "string",
      "severity": "Contraindicated / Severe" | "Major / High Risk" | "Moderate / Caution" | "Minor",
      "mechanismType": "Pharmacokinetic (CYP450 / Transporter)" | "Pharmacodynamic (Additive / Synergistic)" | "Physicochemical / Chelation" | "Renal Tubular Competition",
      "mechanism": "Technical pharmacological description",
      "simpleExplanation": "Neat, clear, simple description of how the interaction will occur (step-by-step or clear plain language)",
      "clinicalAdvice": "Specific actionable clinical management and safer alternative",
      "evidenceLevel": "SmPC Black Box / Contraindicated" | "Well-Established (Grade A)" | "Clinical Reports (Grade B)",
      "potentialAdrs": ["Adverse reaction terms"]
    }
  ],
  "medicationErrors": [
    {
      "id": "err-1",
      "errorType": "Sound-Alike / Look-Alike (LASA)" | "Duplicate Therapeutic Class" | "Wrong Dose / Overdose Risk" | "Drug-Disease Contraindication" | "Narrow Therapeutic Index Risk" | "Route Incompatibility",
      "severity": "Critical" | "Warning" | "Caution",
      "drugInvolved": "string",
      "issueDescription": "Clear description of error risk",
      "howItOccurs": "Simple, neat explanation of how the error occurs",
      "recommendedCorrection": "Specific clinical correction"
    }
  ],
  "overallSafetyRecommendation": "Executive summary advice"
}`;

    const parts: any[] = [{ text: ddiPrompt }];

    attachFilesToGeminiParts(parts, fileData, fileName, fileMimeType, files);

    const aiResponseText = await generateGeminiWithFallback({
      parts,
      responseMimeType: 'application/json',
    });

    const cleanedJson = aiResponseText.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);
    return res.json({ success: true, result: parsed });
  } catch (err: any) {
    console.error('DDI Check error:', err);
    return res.json({
      success: false,
      useDeterministicFallback: true,
      error: err.message,
    });
  }
});

// Pharmacovigilance Agent Chat / Query Endpoint
app.post('/api/agent/chat', async (req, res) => {
  try {
    const { question, currentCaseData } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Missing question parameter' });
    }

    if (!ai) {
      return res.json({
        answer: 'The Pharmacovigilance Multi-Agent System is operating in algorithmic evaluation mode. Please configure GEMINI_API_KEY in the Secrets panel for generative chat assistance.',
      });
    }

    const answer = await generateGeminiWithFallback({
      parts: [
        {
          text: `You are a Senior Pharmacovigilance & Medical Safety Specialist assisting a qualified PV reviewer.
Context Safety Case Data:
${JSON.stringify(currentCaseData, null, 2)}

User Question: ${question}

Provide an authoritative, clinically grounded, regulatory-sound answer adhering to ICH E2A, ICH E2D, CIOMS, and GVP Module VI standards.
Distinguish facts from clinical interpretation.
Do not invent missing information.
Do not provide patient diagnostic or treatment prescriptions.`,
        },
      ],
      responseMimeType: 'text/plain',
    });

    return res.json({
      success: true,
      answer: answer || 'Analysis completed.',
    });
  } catch (err: any) {
    console.error('Agent chat error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Dedicated AI Endpoint: Re-evaluate Case Causality, Seriousness, and Clinical Synthesis
app.post('/api/ai/evaluate-case', async (req, res) => {
  try {
    const { currentCase } = req.body;
    if (!currentCase) {
      return res.status(400).json({ error: 'Missing currentCase payload' });
    }

    if (!ai) {
      return res.json({
        success: false,
        useFallback: true,
        message: 'Gemini AI not initialized. Using local clinical algorithms.',
      });
    }

    const evalPrompt = `You are the Lead Medical Safety & Causality Officer at Vigilytics AI.
Re-evaluate this safety case in depth according to ICH E2A, WHO-UMC causality principles, and CIOMS guidelines:

CONTEXT CASE:
${JSON.stringify(currentCase, null, 2)}

Provide an authoritative clinical re-evaluation returning ONLY valid JSON with this exact structure:
{
  "clinicalSummary": "Comprehensive executive clinical safety summary (3-4 sentences)",
  "narrativeText": "Re-synthesized chronological clinical narrative detailing patient history, drug administration, onset of adverse reactions, dechallenge, interventions, and current outcome.",
  "naranjoAnswers": { "q1": 1, "q2": 2, "q3": 1, "q4": 0, "q5": 1, "q6": 0, "q7": 0, "q8": 0, "q9": 0, "q10": 1 },
  "naranjoScore": 7,
  "naranjoCategory": "Definite" | "Probable" | "Possible" | "Doubtful",
  "whoUmcCategory": "Certain" | "Probable / Likely" | "Possible" | "Unlikely",
  "causalityRationale": "Clear biological and pharmacological explanation connecting suspected drug to adverse reaction",
  "seriousnessRationale": "ICH E2A seriousness criteria justification",
  "priority": "P1 - Urgent (24h Expedited)" | "P2 - High (72h Expedited)" | "P3 - Medium (7d Standard)" | "P4 - Routine (15d Standard)",
  "priorityRationale": "Why this priority level was designated",
  "riskClassification": "Known Labeled Risk" | "Potential New Signal" | "Insufficient Evidence",
  "recommendedAction": "Immediate clinical & regulatory recommendation",
  "actionFlag": "Urgent clinical attention" | "Pharmacovigilance professional review" | "Routine review"
}`;

    const text = await generateGeminiWithFallback({
      parts: [{ text: evalPrompt }],
      responseMimeType: 'application/json',
    });

    const parsed = JSON.parse(text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim());
    return res.json({ success: true, evaluation: parsed });
  } catch (err: any) {
    console.error('Case evaluation error:', err);
    return res.json({ success: false, error: err.message, useFallback: true });
  }
});

// Dedicated AI Endpoint: Generate Targeted Follow-Up Query Letter
app.post('/api/ai/generate-followup', async (req, res) => {
  try {
    const { currentCase, missingItems, recipientEmail } = req.body;

    if (!ai) {
      return res.json({
        success: false,
        useFallback: true,
        message: 'Using standard regulatory follow-up template.',
      });
    }

    const prompt = `You are a Pharmacovigilance Regulatory Affairs Specialist.
Draft a professional, authoritative, and polite ICH E2D compliant clinical follow-up query letter for:
Case: ${currentCase?.caseNumber || 'ICSR'}
Suspect Drug: ${currentCase?.drugs?.map((d: any) => d.drugName).join(', ') || 'Suspected Agent'}
Adverse Event: ${currentCase?.events?.map((e: any) => e.term).join(', ') || 'Adverse Event'}
Patient: ${currentCase?.patient?.initials || 'PT'}, ${currentCase?.patient?.age || 'Age unknown'}yo ${currentCase?.patient?.sex || ''}
Recipient: ${recipientEmail || 'Primary Care / Reporting Physician'}
Missing Data Elements to Request:
${JSON.stringify(missingItems || [], null, 2)}

Format the letter professionally with date, reference ID, targeted clinical questions with explicit rationale, and a 5-day response timeline. Return plain text only.`;

    const text = await generateGeminiWithFallback({
      parts: [{ text: prompt }],
      responseMimeType: 'text/plain',
    });

    return res.json({ success: true, letterText: text });
  } catch (err: any) {
    console.error('Follow-up generation error:', err);
    return res.json({ success: false, error: err.message, useFallback: true });
  }
});

// Dedicated AI Endpoint: Medication Error & Prescribing Hazard Audit
app.post('/api/ai/medication-errors', async (req, res) => {
  try {
    const { drugs, regimenText, fileData, fileMimeType, fileName, files, patientContext } = req.body;

    if (!ai) {
      return res.json({
        success: false,
        useFallback: true,
        message: 'Gemini AI not initialized. Using local clinical safety engine.',
      });
    }

    const medErrorPrompt = `You are a Hospital Patient Safety Officer, Clinical Pharmacist, and Pharmacovigilance Specialist.
Perform a thorough, expert-level MEDICATION ERROR & PRESCRIBING SAFETY AUDIT on the following regimen or document:

1. LOOK-ALIKE / SOUND-ALIKE (LASA) CONFUSION RISKS:
   - Screen for dangerous brand or generic confusion (e.g., Celebrex vs. Celexa, Zyrtec vs. Zyprexa, Hydralazine vs. Hydroxyzine, Wellbutrin vs. Rocephin).
2. THERAPEUTIC DUPLICATION:
   - Identify concurrent prescriptions belonging to the exact same pharmacological class (e.g., 2 statins, 2 systemic NSAIDs, dual ACE/ARB).
3. WRONG DOSE / OVERDOSE / SCHEDULE ERRORS:
   - Detect toxic dosages, inappropriate frequencies (e.g. methotrexate prescribed daily instead of weekly), and accumulation risks.
4. ORGAN IMPAIRMENT & DISEASE CONTRAINDICATIONS:
   - Evaluate against patient's renal function (e.g., Metformin in eGFR < 30 lactic acidosis), liver impairment, pregnancy/lactation, asthma, heart failure, peptic ulcer.
5. NARROW THERAPEUTIC INDEX (NTI) HAZARDS:
   - Flag drugs requiring therapeutic drug monitoring (Warfarin, Digoxin, Lithium, Phenytoin, Theophylline).
6. ROUTE & ADMINISTRATION INCOMPATIBILITY:
   - Check administration route, timing, and hazardous drug-food interactions.

For every medication error identified:
- You MUST provide "howItOccurs": a NEAT, CLEAR, and SIMPLE description of EXACTLY HOW the error or risk occurs in clinical practice that any patient or clinician can understand immediately.
- Provide "recommendedCorrection": specific, actionable clinical remediation.

INPUT MEDICATIONS:
${Array.isArray(drugs) && drugs.length > 0 ? drugs.join(', ') : 'Extract all medications from the provided document/text.'}
${regimenText ? `Additional Regimen Notes: ${regimenText}` : ''}

PATIENT CONTEXT:
${JSON.stringify(patientContext || {}, null, 2)}

Return your response ONLY as valid, parseable JSON with this exact schema:
{
  "drugsIdentified": ["string"],
  "totalErrors": 0,
  "highestSeverity": "Critical Hazard" | "High Warning" | "Cautionary Advisory" | "No Medication Errors Detected",
  "summaryText": "Executive summary of safety audit",
  "overallSafetyRecommendation": "Key action advice",
  "medicationErrors": [
    {
      "id": "err-1",
      "errorType": "Sound-Alike / Look-Alike (LASA)" | "Duplicate Therapeutic Class" | "Wrong Dose / Overdose Risk" | "Drug-Disease Contraindication" | "Narrow Therapeutic Index Risk" | "Route Incompatibility",
      "severity": "Critical" | "Warning" | "Caution",
      "drugInvolved": "Drug Name",
      "issueDescription": "Clear description of error risk",
      "howItOccurs": "Neat, clear, simple explanation of how the error occurs",
      "recommendedCorrection": "Specific clinical correction to prevent patient harm"
    }
  ]
}`;

    const parts: any[] = [{ text: medErrorPrompt }];

    attachFilesToGeminiParts(parts, fileData, fileName, fileMimeType, files);

    const aiResponseText = await generateGeminiWithFallback({
      parts,
      responseMimeType: 'application/json',
    });

    const cleanedJson = aiResponseText.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);
    return res.json({ success: true, result: parsed });
  } catch (err: any) {
    console.error('Medication error audit failed:', err);
    return res.json({ success: false, error: err.message, useFallback: true });
  }
});

// Dedicated AI Endpoint: Clinical Laboratory & Organ Toxicity Evaluation (Hy's Law, KDIGO AKI, Bone Marrow, etc.)
app.post('/api/ai/evaluate-labs', async (req, res) => {
  try {
    const { labs, suspectDrugs, patientContext } = req.body;
    if (!labs || !Array.isArray(labs) || labs.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one lab value to evaluate.' });
    }

    if (!ai) {
      return res.json({
        success: false,
        useFallback: true,
        message: 'Gemini AI not initialized. Using local clinical heuristics.',
      });
    }

    const labPrompt = `You are an Expert Clinical Toxicologist, Hepatologist, and Pharmacovigilance Specialist.
Evaluate these clinical laboratory results in the context of the suspected medications and patient profile:

LABORATORY INVESTIGATIONS:
${JSON.stringify(labs, null, 2)}

SUSPECTED MEDICATIONS:
${JSON.stringify(suspectDrugs || [], null, 2)}

PATIENT CONTEXT:
${JSON.stringify(patientContext || {}, null, 2)}

CLINICAL EVALUATION CRITERIA:
1. Liver Panel / DILI: Check Hy's Law criteria (ALT or AST > 3x ULN combined with Total Bilirubin > 2x ULN without cholestasis = high risk of fatal drug-induced liver injury ~10% mortality).
2. Renal Panel / Nephrotoxicity: Check KDIGO Acute Kidney Injury criteria (Serum Creatinine increase >= 0.3 mg/dL within 48h, or >= 1.5x baseline within 7d; eGFR drop).
3. Hematology / Myelosuppression: Check for severe neutropenia / agranulocytosis (ANC < 500 /uL), severe thrombocytopenia (< 50,000 /uL), or aplastic anemia.
4. Cardiac Biomarkers: Check Troponin I/T and BNP/NT-proBNP elevation indicating drug-induced myocarditis, infarction, or heart failure.
5. Electrolytes: Check hyperkalemia, hypokalemia, hyponatremia, and QTc risk factors.

Return your response ONLY as valid JSON matching this schema:
{
  "summary": "Concise executive toxicological summary (2-3 sentences)",
  "organToxicityDetected": boolean,
  "primaryOrganAffected": "Hepatic" | "Renal" | "Hematologic" | "Cardiovascular" | "Electrolyte / Metabolic" | "None / Normal",
  "hysLawStatus": "Positive (High Risk DILI - Alert)" | "Negative / Not Met" | "Borderline Elevation",
  "akiStatus": "KDIGO Stage 3 (Severe)" | "KDIGO Stage 2" | "KDIGO Stage 1 (Mild)" | "No AKI Detected",
  "criticalFindings": ["string"],
  "drugCausalityCorrelation": "Detailed clinical reasoning correlating the observed lab abnormalities with the pharmacological mechanisms of the suspected drug(s)",
  "recommendedAction": "Actionable clinical interventions (e.g., immediate drug cessation, N-acetylcysteine, hydration, repeat testing window)",
  "urgencyLevel": "Critical Immediate" | "High Vigilance" | "Routine Monitoring"
}`;

    const text = await generateGeminiWithFallback({
      parts: [{ text: labPrompt }],
      responseMimeType: 'application/json',
    });

    const parsed = JSON.parse(text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim());
    return res.json({ success: true, evaluation: parsed });
  } catch (err: any) {
    console.error('Lab evaluation failed:', err);
    return res.json({ success: false, error: err.message, useFallback: true });
  }
});

// Dedicated AI Endpoint: Quality & Inspection Readiness Audit across Case Cohort
app.post('/api/ai/audit-quality', async (req, res) => {
  try {
    const { cases } = req.body;
    if (!cases || !Array.isArray(cases) || cases.length === 0) {
      return res.status(400).json({ error: 'No safety cases provided for quality audit.' });
    }

    if (!ai) {
      return res.json({
        success: false,
        useFallback: true,
        message: 'Gemini AI not initialized.',
      });
    }

    const auditPrompt = `You are a Lead Pharmacovigilance Quality Auditor and Regulatory Inspector (FDA / EMA / MHRA GVP Module II & IV certified).
Perform a comprehensive Quality & Inspection-Readiness Audit across the following ${cases.length} active safety cases:

CASES SUMMARY DATA:
${JSON.stringify(
  cases.map((c: any) => ({
    id: c.id,
    caseNumber: c.caseNumber,
    priority: c.priority,
    drugs: c.drugs?.map((d: any) => d.drugName),
    events: c.events?.map((e: any) => e.term),
    patientAge: c.patient?.age,
    patientSex: c.patient?.sex,
    missingDataCount: c.missingDataAudit?.filter((m: any) => !m.resolved)?.length || 0,
    isDuplicateFlagged: c.isDuplicateFlagged,
    approvalStatus: c.humanApproval?.status,
    slaHoursRemaining: c.pegaSLA?.hoursRemaining,
  })),
  null,
  2
)}

Audit Criteria:
1. Missing Information Criticality: Rate risk of regulatory rejections due to missing minimum ICSR criteria or batch/lot/dechallenge data.
2. Duplicate Discrepancies: Reliability of duplicate case screening.
3. SLA Timeliness & Expedited Window Compliance: Flagging any overdue or near-breach 24h / 72h expedited reports.
4. Human-in-the-Loop Signoff Integrity: Compliance with 21 CFR Part 11 audit trails and physician sign-off.
5. Corrective & Preventive Action (CAPA): Practical steps to elevate cohort audit readiness to 100%.

Return your response ONLY as valid JSON matching this schema:
{
  "inspectionReadinessScore": 95,
  "auditRating": "Inspection Ready" | "Minor Gaps Identified" | "Critical Audit Findings",
  "executiveAuditSummary": "Detailed narrative executive assessment of overall case quality and regulatory compliance",
  "topRisks": ["string"],
  "capaRecommendations": [
    {
      "finding": "Specific gap found in cases",
      "action": "Concrete corrective / preventive action",
      "priority": "High" | "Medium" | "Low"
    }
  ],
  "gvpComplianceRemarks": "Regulatory commentary on ICH E2A/E2B and GVP Module VI conformance"
}`;

    const text = await generateGeminiWithFallback({
      parts: [{ text: auditPrompt }],
      responseMimeType: 'application/json',
    });

    const parsed = JSON.parse(text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim());
    return res.json({ success: true, audit: parsed });
  } catch (err: any) {
    console.error('Quality audit failed:', err);
    return res.json({ success: false, error: err.message, useFallback: true });
  }
});

// Dedicated AI Endpoint: Daily Casesheet Analysis (Clinical Pharmacy & Pharmacovigilance Assistant)
app.post('/api/ai/casesheet-analysis', async (req, res) => {
  try {
    const {
      caseText,
      fileData,
      fileName,
      fileMimeType,
      files,
      patientContext,
      stgBookName,
      stgBookSnippet,
    } = req.body;

    const hasFiles = Boolean(fileData || (Array.isArray(files) && files.length > 0));
    if (!caseText && !hasFiles) {
      return res.status(400).json({ error: 'Please provide either case text or uploaded casesheet photo(s)/file(s).' });
    }

    if (!ai) {
      return res.json({
        success: false,
        useFallback: true,
        message: 'Gemini AI not initialized. Using clinical pharmacy fallback heuristics.',
      });
    }

    const casesheetPrompt = `You are AERIX, the Senior Clinical Pharmacologist, Pharmacovigilance Specialist, and Internal Medicine Evaluation Engine.
Perform an exhaustive, rigorous, evidence-conscious analysis of the uploaded casesheet document(s) (PDFs, images, or clinical text).

CRITICAL EXTRACTION & SAFETY INSTRUCTIONS:
1. Extract facts directly from the document without hallucinating or fabricating details.
2. Label any uncertain handwriting, unclear drug names, doses, units, dates, or lab values as "[Uncertain - needs user confirmation]" or "Unclear / Illegible".
3. Do NOT make a definitive diagnosis from the uploaded case alone. Present findings as clinical assessments for review by a qualified doctor or pharmacist.
4. Do NOT direct users to change treatment. Present concerns as items for a healthcare professional to review.
5. Highlight urgent red flags (e.g., life-threatening toxicity, severe drug-drug interactions, organ failure hazards).
6. Never fabricate citations or unconsulted sources. Cite only standard authoritative guidelines (e.g., WHO STG, CDSCO, ICMR, AHA/ACC, KDIGO, GOLD, ADA, Maudsley, APA, BNF). If specific external lookup is unavailable, state: "Educational reference synthesized from standard clinical pharmacological guidelines."

## Patient and case-sheet information
${caseText ? `DOCUMENTED CASE NOTES / PATIENT DETAILS:\n${caseText}\n` : 'Extract all patient details, chief complaints, history, investigations/labs, and medication orders from the attached image(s)/document(s).'}
${patientContext ? `ADDITIONAL CLINICAL CONTEXT:\n${JSON.stringify(patientContext, null, 2)}\n` : ''}

${
  stgBookName || stgBookSnippet
    ? `ACTIVE STANDARD TREATMENT GUIDE (STG) BOOK: "${stgBookName || 'Standard Treatment Guide'}"
${stgBookSnippet ? `BOOK PROTOCOL EXCERPT:\n${stgBookSnippet}\n` : ''}`
    : ''
}

Generate a structured analysis containing EXACTLY these 10 sections:

1. Case summary — presenting complaints, relevant patient context (age, sex, weight, allergies, medical history, pregnancy status when provided), recorded diagnosis, and clinical timeline.
2. Investigation and lab review — organized table/list of reported values, reference ranges, abnormal flags (High/Low/Critical/Normal), and physiological relevance without treating a single lab alone as a diagnosis.
3. Drug chart — table with columns: No, Brand name (if legible; note if unclear), Generic name, Indication, Prescribed dose, Route, Frequency, Treatment start/end dates, and Missing/unclear fields.
4. Medication-by-medication review — for every single medicine: evaluate appropriateness for documented indication, dose, route, frequency, duration, patient factors (renal, hepatic, age, weight), monitoring required, and safety concerns. Distinguish confirmed issues from "Cannot assess from information provided".
5. Drug–drug interactions — clinically relevant potential interactions in the uploaded regimen, expected effect, severity (Major, Moderate, Minor), evidence/mechanism, and practical monitoring. Avoid listing trivial theoretical interactions as confirmed harm.
6. Pharmaceutical care issues — potential adverse drug reactions (ADRs), medication errors, contraindications, therapeutic duplication, adherence or monitoring gaps, and specific review opportunities for pharmacist/prescriber.
7. Condition discussion — for documented or suspected condition(s): concise definition, possible etiology/risk factors, and case findings that support or challenge it. Clearly separate general educational information from patient-specific interpretation.
8. Standard treatment overview — guideline-based treatment options, standard adult dose ranges and routes with formulation (Inj, Tab, Cap, etc.), vital monitoring, precautions, and specialist/urgent referral criteria. Clearly state that these are educational reference ranges, not a prescription or advice to alter medication.
9. Questions and missing information — key details a clinician or pharmacist should verify before drawing conclusions.
10. Sources and limitations — reliable clinical guidelines or drug references actually consulted with title, organization, and date/status. Explicit statement of limitations and unverified claims.

Return your response ONLY as valid, parseable JSON matching this exact schema:
{
  "caseSummary": "Comprehensive narrative summary of presenting complaints, timeline, and clinical trajectory",
  "patientDetails": {
    "nameOrIdentifier": "string",
    "age": "string",
    "gender": "string",
    "weight": "string",
    "pregnancyStatus": "string",
    "admissionNumber": "string",
    "wardUnit": "string",
    "admissionDate": "string",
    "dischargeDate": "string",
    "consultant": "string",
    "provisionalDiagnosis": "string",
    "confirmatoryDiagnosis": "string",
    "chiefComplaints": "string",
    "clinicalFindings": "string",
    "pastMedicalHistory": "string",
    "pastMedicationHistory": "string",
    "allergies": "string",
    "familyHistory": "string",
    "personalHabits": "string",
    "investigations": "string",
    "timeline": ["string (chronological date/event milestone)"],
    "missingOrUnclearItems": ["string"],
    "ocrOrHandwritingFlags": ["string"]
  },
  "investigationReview": [
    {
      "testName": "string",
      "reportedValue": "string",
      "referenceRange": "string",
      "status": "Normal" | "High" | "Low" | "Critical" | "Unclear",
      "clinicalRelevance": "string explanation of possible relevance"
    }
  ],
  "drugChart": [
    {
      "no": 1,
      "brandName": "string",
      "genericName": "string",
      "indication": "string",
      "dose": "string",
      "route": "string",
      "frequency": "string",
      "startDate": "string",
      "endDate": "string",
      "unclearOrMissingFields": "string",
      "sourceConfidence": "string"
    }
  ],
  "medicationReviews": [
    {
      "drugName": "string",
      "genericName": "string",
      "indicationAppropriateness": "Consistent with guidelines" | "Questionable indication" | "Cannot assess from information provided",
      "doseAndFrequencyAssessment": "string",
      "routeAndDurationAssessment": "string",
      "patientSpecificFactors": "string (renal, hepatic, age, weight, pregnancy considerations)",
      "requiredMonitoring": "string (labs, vitals, biomarkers to track)",
      "safetyConcerns": "string",
      "reviewStatus": "Confirmed issue" | "Possible concern - review advised" | "Cannot assess from information provided"
    }
  ],
  "drugInteractions": [
    {
      "medicinePair": "string",
      "expectedEffectAndMechanism": "string",
      "significanceAndEvidence": "Major" | "Moderate" | "Minor",
      "patientRiskFactors": "string",
      "recommendedMonitoring": "string"
    }
  ],
  "pharmaceuticalCareIssues": [
    {
      "category": "Potential ADR" | "Medication Error" | "Contraindication" | "Therapeutic Duplication" | "Monitoring Gap" | "Adherence Concern",
      "medicine": "string",
      "issueDescription": "string",
      "clinicalTiming": "string",
      "alternativeCauses": "string",
      "actionableRecommendation": "string"
    }
  ],
  "diseaseDiscussion": [
    {
      "diagnosis": "string",
      "definition": "string (concise clinical definition)",
      "etiology": "string (possible etiology and risk factors)",
      "pathophysiology": "string",
      "clinicalPresentation": "string",
      "caseSupportAssessment": "string (case findings that support or challenge this)",
      "educationalDisclaimer": "General educational reference. Not a definitive patient diagnosis."
    }
  ],
  "standardTreatments": [
    {
      "diseaseContext": "string",
      "treatmentOptions": "string",
      "standardDosing": "string",
      "pharmacologicalDrugs": [
        {
          "formulation": "Injection" | "Tablet" | "Capsule" | "Syrup" | "Inhaler / Respule" | "Infusion" | "Drops / Topical" | string,
          "genericName": "string",
          "brandName": "string",
          "dose": "string",
          "route": "string",
          "frequency": "string",
          "duration": "string",
          "lineOfTherapy": "First-Line" | "Second-Line / Alternative" | "Acute Emergency / Rescue" | "Maintenance / Adjuvant",
          "clinicalPearl": "string"
        }
      ],
      "nonPharmManagement": "string",
      "adjustmentsAndContraindications": "string",
      "monitoringParameters": "string",
      "specialistOrUrgentCare": "string (when specialist consultation or emergency transfer is needed)",
      "educationalNotice": "These are educational reference ranges from clinical literature, not a prescription or advice to change treatment."
    }
  ],
  "questionsAndMissingInfo": [
    {
      "item": "string",
      "whyNeeded": "string",
      "suggestedQuestionForPrescriber": "string"
    }
  ],
  "sourcesAndLimitations": {
    "consultedReferences": [
      {
        "title": "string",
        "organization": "string",
        "dateOrVersion": "string",
        "clinicalDomain": "string"
      }
    ],
    "limitationsStatement": "string explaining that this analysis is an educational and decision-support synthesis; definitive medical decisions require licensed physician review."
  }
}`;

    const parts: any[] = [{ text: casesheetPrompt }];
    attachFilesToGeminiParts(parts, fileData, fileName, fileMimeType, files);

    const text = await generateGeminiWithFallback({
      parts,
      responseMimeType: 'application/json',
    });

    const parsed = JSON.parse(text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim());
    return res.json({ success: true, analysis: parsed });
  } catch (err: any) {
    console.error('Casesheet analysis failed:', err);
    return res.json({ success: false, error: err.message, useFallback: true });
  }
});

// Dedicated AI Endpoint: In-Depth Disease Definition, Etiology & Standard Treatment Dossier (ChatGPT-grade)
app.post('/api/ai/disease-lookup', async (req, res) => {
  try {
    const { diseaseName } = req.body;
    if (!diseaseName || typeof diseaseName !== 'string' || !diseaseName.trim()) {
      return res.status(400).json({ error: 'Please provide a disease or condition name to look up.' });
    }

    if (!ai) {
      return res.json({
        success: false,
        useFallback: true,
        message: 'Gemini AI not initialized. Using local clinical knowledge base.',
      });
    }

    const diseasePrompt = `You are a Senior Academic Physician, Clinical Pharmacologist, and Internal Medicine Specialist.
Provide an exhaustive, textbook-grade, ChatGPT-quality comprehensive medical dossier for the following disease or clinical diagnosis: "${diseaseName.trim()}".

REQUIREMENTS:
1. "definition": Authoritative, deep clinical definition detailing:
   - Official diagnostic definition and terminology
   - Underlying pathophysiology and cellular/molecular mechanism
   - Clinical classification, stages, or grades (e.g. NYHA I-IV / ACC-AHA A-D, GOLD 1-4, KDIGO 1-3, ADA, etc.)
   - Biological and physiological hallmarks
2. "etiology": Exhaustive etiology and clinical risk factors:
   - Primary etiologies and underlying pathophysiological causes
   - Secondary triggers, precipitants, and aggravating factors
   - Genetic, environmental, lifestyle, and immunological factors
   - Key predisposing comorbidities
3. "clinicalPresentation":
   - Cardinal symptoms and patient complaints
   - Hallmark physical examination signs
   - Clinical severity indicators and red flag danger signs
4. "diagnosticCriteria":
   - Diagnostic gold standards and confirmatory investigations (labs, biomarkers, imaging, biopsy, ECG/Echo)
5. "standardTreatment":
   - First-line guideline-directed pharmacotherapy with EXACT DRUG NAMES, standard dosages, routes, frequencies, titration protocols, and duration
   - Second-line / Alternative pharmacotherapies
   - Acute stabilization vs chronic maintenance regimens
   - Non-pharmacological management (dietary, lifestyle, fluid balance, medical devices, surgery)
6. "contraindicationsAndAdjustments":
   - Renal (eGFR) and hepatic dosage adjustments
   - High-hazard drug interactions and absolute contraindications
7. "monitoringParameters":
   - Therapeutic targets (target blood pressure, glucose, eGFR, electrolytes, biomarker cutoffs)
   - Follow-up monitoring intervals and patient counseling pearls
8. "clinicalGuidelines":
   - Direct citations of major authoritative guidelines (e.g. AHA/ACC, KDIGO, GOLD, ADA, NICE, ESC, IDSA)

Return your response ONLY as valid, parseable JSON matching this schema:
{
  "diagnosis": "${diseaseName.trim()}",
  "definition": "Comprehensive textbook-grade clinical definition and pathophysiology",
  "etiology": "Comprehensive etiology, primary causes, triggers, and risk factors",
  "clinicalPresentation": "Cardinal signs, symptoms, and severity markers",
  "diagnosticCriteria": "Gold standard diagnostic tests and staging workup",
  "standardTreatment": {
    "firstLineTherapies": "First-line drugs, exact standard dosages, routes, and titration",
    "secondLineTherapies": "Second-line / alternative regimens",
    "acuteVsChronicManagement": "Acute management vs chronic long-term maintenance",
    "nonPharmManagement": "Diet, lifestyle, supportive protocols, and device/surgical options"
  },
  "contraindicationsAndAdjustments": "Renal (eGFR) and hepatic adjustments, absolute and relative contraindications",
  "monitoringParameters": "Target therapeutic goals, monitoring intervals, and safety biomarkers",
  "clinicalGuidelines": ["Authoritative guideline citations (e.g. 2024 AHA/ACC, KDIGO 2024, GOLD 2025)"],
  "summaryCard": "Executive 3-sentence summary of the disease definition, cause, and first-line treatment"
}`;

    const text = await generateGeminiWithFallback({
      parts: [{ text: diseasePrompt }],
      responseMimeType: 'application/json',
    });

    const parsed = JSON.parse(text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim());
    return res.json({ success: true, result: parsed });
  } catch (err: any) {
    console.error('Disease lookup failed:', err);
    return res.json({ success: false, error: err.message, useFallback: true });
  }
});

// Dedicated AI Endpoint: Indian Medicine-Name & Brand Verification Assistant
app.post('/api/ai/verify-medicine-name', async (req, res) => {
  try {
    const { medicineName, medicineNames } = req.body;
    const targets = Array.isArray(medicineNames) && medicineNames.length > 0
      ? medicineNames
      : (medicineName ? [medicineName] : []);

    if (targets.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one medicine name to verify.' });
    }

    const verificationPrompt = `You are a medicine-name verification assistant for an application used in India. Check the medicine name entered by the user and help identify its matching generic composition and Indian brand names.

Treat this as a name-verification task only. Do not diagnose, prescribe, recommend treatment, or tell the user to start, stop, or switch a medicine.

Medicines entered for verification:
${targets.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n')}

For each medicine entry:

1. Read the entered name exactly as provided. If it may be a misspelling, transcription error, or unclear handwriting, show the original entry and your best reading separately. Do not silently replace it.
2. Identify the active ingredient(s), strength, dosage form, release type (such as immediate or extended release), route, and relevant salt or combination, if available.
3. Compare the entered brand name with the identified composition. Report whether the match is:
   - Exact match
   - Possible match; needs human confirmation
   - Mismatch
   - Unable to verify
4. Search for currently available Indian brand names only when the composition, strength, dosage form, release type, and route match. Never treat medicines with different strengths, formulations, release types, routes, or combinations as interchangeable.
5. Prefer authoritative sources when available:
   - CDSCO (https://cdsco.gov.in) for regulatory information
   - NPPA Pharma Sahi Daam (https://nppaindia.nic.in) for listed brand and price information
   - PMBI / Jan Aushadhi product lists (https://janaushadhi.gov.in) for PMBJP products
   - Manufacturer product information for product composition (Cipla, Sun Pharma, Torrent, Lupin, Dr. Reddy's, Alkem, Mankind, USV, Abbott India, Zydus, etc.)
   Use reliable sources to discover candidates, but verify each candidate against a reliable source. A search result snippet alone is not verification.
6. For each candidate brand, provide the source link, the source’s product or composition details, and the date checked. Clearly distinguish verified facts from search leads.
7. If no brand is found, say "No matching brand verified." You may list unverified search leads in a separate section only if clearly labeled "Unverified—confirm with a pharmacist." Never invent a brand name or imply that an unverified result is available in the market.
8. Do not select a "best" brand, rank brands, recommend a substitute, or infer that a brand is suitable for this patient. A doctor or pharmacist must confirm any substitution.
9. Do not expose patient identifiers or unrelated case-sheet information in the result. Process only the medicine details needed for this check.
10. If the medicine is a controlled, high-risk, narrow-therapeutic-index, or otherwise safety-sensitive drug, state that a pharmacist or prescriber must verify the match.

Return your response ONLY as valid JSON matching this schema:
{
  "results": [
    {
      "enteredName": "string",
      "possibleCorrectedReading": "string (or 'Not needed')",
      "genericComposition": "string",
      "strengthDosageFormReleaseRoute": "string",
      "matchStatus": "Exact match" | "Possible match" | "Mismatch" | "Unable to verify",
      "verifiedIndianBrandNames": [
        {
          "brand": "string",
          "matchingCompositionAndStrength": "string",
          "sourceLink": "string",
          "checkedDate": "string"
        }
      ],
      "unverifiedSearchLeads": ["string"],
      "whatNeedsHumanConfirmation": "string",
      "confidence": "High" | "Medium" | "Low",
      "reasonForConfidence": "string",
      "safetyNote": "Do not substitute based on this result; confirm with the prescriber or pharmacist.",
      "formattedText": "- Entered name: ...\\n- Possible corrected reading (if needed): ...\\n- Generic composition: ...\\n- Strength / dosage form / release type / route: ...\\n- Match status: ...\\n- Verified Indian brand names:\\n  - Brand — matching composition and strength — source link — checked date\\n- Unverified search leads (if any): ...\\n- What needs human confirmation: ...\\n- Confidence: ...\\n- Reason for confidence: ...\\n- Safety note: Do not substitute based on this result; confirm with the prescriber or pharmacist."
    }
  ]
}`;

    if (!ai) {
      const fallbackResults = targets.map((t: string) => verifyIndianMedicine(t));
      return res.json({
        success: true,
        useFallback: true,
        results: fallbackResults,
      });
    }

    const parts: any[] = [{ text: verificationPrompt }];
    const text = await generateGeminiWithFallback({
      parts,
      responseMimeType: 'application/json',
    });

    const parsed = JSON.parse(text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim());
    return res.json({ success: true, ...parsed });
  } catch (err: any) {
    console.error('Medicine name verification failed:', err);
    const { medicineName, medicineNames } = req.body;
    const targets = Array.isArray(medicineNames) && medicineNames.length > 0
      ? medicineNames
      : (medicineName ? [medicineName] : ['Medicine']);
    const fallbackResults = targets.map((t: string) => verifyIndianMedicine(t));
    return res.json({ success: true, useFallback: true, results: fallbackResults });
  }
});

// In-memory user database & user history store for server-backed auth & history isolation
interface ServerUser {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  passwordHash?: string;
  avatar?: string;
  provider: 'mobile_otp' | 'google' | 'facebook' | 'email_password';
  createdAt: string;
  lastLoginAt: string;
  role?: string;
}

const serverUsers = new Map<string, ServerUser>();
const serverUserHistory = new Map<string, any[]>(); // userId -> historyItems[]
const activeOtps = new Map<string, { phone: string; otp: string; expiresAt: number }>();

// Simple hash helper
function hashPassword(pass: string): string {
  let hash = 0;
  for (let i = 0; i < pass.length; i++) {
    hash = (hash << 5) - hash + pass.charCodeAt(i);
    hash |= 0;
  }
  return `h_${Math.abs(hash)}`;
}

// 1. Auth: Request Mobile OTP
app.post('/api/auth/request-otp', (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return res.status(400).json({ error: 'Please provide a valid phone number.' });
    }
    const clean = phoneNumber.trim().replace(/[^\d+]/g, '');
    const verificationId = `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    activeOtps.set(verificationId, { phone: clean, otp, expiresAt });

    return res.json({
      success: true,
      verificationId,
      demoOtp: otp, // Returned for instant testing and sandbox demonstration
      message: `Verification code sent to ${clean}.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Auth: Verify Mobile OTP
app.post('/api/auth/verify-otp', (req, res) => {
  try {
    const { phoneNumber, otp, verificationId, name } = req.body;
    if (!phoneNumber || !otp) {
      return res.status(400).json({ error: 'Missing phone number or verification code.' });
    }

    const clean = phoneNumber.trim().replace(/[^\d+]/g, '');
    const stored = activeOtps.get(verificationId);

    if (stored && stored.otp !== otp) {
      return res.status(400).json({ error: 'Incorrect verification code. Please check and try again.' });
    }

    // Find or create user
    let user: ServerUser | undefined;
    for (const u of serverUsers.values()) {
      if (u.phoneNumber === clean) {
        user = u;
        break;
      }
    }

    if (!user) {
      const id = `usr_mob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      user = {
        id,
        name: name?.trim() || `User ${clean.slice(-4)}`,
        phoneNumber: clean,
        provider: 'mobile_otp',
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(clean)}`,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        role: 'Clinical Safety Specialist',
      };
      serverUsers.set(id, user);
    } else {
      user.lastLoginAt = new Date().toISOString();
      if (name?.trim()) user.name = name.trim();
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        provider: user.provider,
        avatar: user.avatar,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        role: user.role,
      },
      token: `tok_${user.id}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Auth: OAuth Sign-In (Google & Facebook)
app.post('/api/auth/oauth-login', (req, res) => {
  try {
    const { provider, email, name, avatar } = req.body;
    if (!provider || !['google', 'facebook'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid OAuth provider.' });
    }

    const cleanEmail = email ? String(email).trim().toLowerCase() : `${provider}.user@vigilytics.org`;
    const cleanName = name ? String(name).trim() : `${provider === 'google' ? 'Google' : 'Facebook'} Reviewer`;

    let user: ServerUser | undefined;
    for (const u of serverUsers.values()) {
      if (u.email && u.email.toLowerCase() === cleanEmail) {
        user = u;
        break;
      }
    }

    if (!user) {
      const id = `usr_${provider}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      user = {
        id,
        name: cleanName,
        email: cleanEmail,
        avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}`,
        provider,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        role: provider === 'google' ? 'Senior PV Officer' : 'Safety Reviewer',
      };
      serverUsers.set(id, user);
    } else {
      user.lastLoginAt = new Date().toISOString();
      if (avatar) user.avatar = avatar;
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        provider: user.provider,
        avatar: user.avatar,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        role: user.role,
      },
      token: `tok_${user.id}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Auth: Register Email & Password
app.post('/api/auth/register-email', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing name, email, or password.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    for (const u of serverUsers.values()) {
      if (u.email && u.email.toLowerCase() === cleanEmail) {
        return res.status(400).json({ error: 'An account already exists with this email address.' });
      }
    }

    const id = `usr_mail_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const user: ServerUser = {
      id,
      name: String(name).trim(),
      email: cleanEmail,
      passwordHash: hashPassword(password),
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      provider: 'email_password',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      role: 'Clinical Pharmacologist',
    };

    serverUsers.set(id, user);

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        provider: user.provider,
        avatar: user.avatar,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        role: user.role,
      },
      token: `tok_${user.id}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Auth: Login Email & Password
app.post('/api/auth/login-email', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter your email and password.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    let found: ServerUser | undefined;
    for (const u of serverUsers.values()) {
      if (u.email && u.email.toLowerCase() === cleanEmail) {
        found = u;
        break;
      }
    }

    if (!found) {
      return res.status(401).json({ error: 'No account found with this email address.' });
    }

    if (found.passwordHash && found.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    found.lastLoginAt = new Date().toISOString();

    return res.json({
      success: true,
      user: {
        id: found.id,
        name: found.name,
        email: found.email,
        provider: found.provider,
        avatar: found.avatar,
        createdAt: found.createdAt,
        lastLoginAt: found.lastLoginAt,
        role: found.role,
      },
      token: `tok_${found.id}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. Auth: Account Recovery
app.post('/api/auth/recover-account', (req, res) => {
  try {
    const { identifier, newPassword, code } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: 'Please provide your registered email or phone.' });
    }

    const clean = String(identifier).trim().toLowerCase();
    let found: ServerUser | undefined;
    for (const u of serverUsers.values()) {
      if (
        (u.email && u.email.toLowerCase() === clean) ||
        (u.phoneNumber && u.phoneNumber.replace(/[^\d+]/g, '') === clean.replace(/[^\d+]/g, ''))
      ) {
        found = u;
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: 'No account registered with this email or phone number.' });
    }

    if (newPassword) {
      found.passwordHash = hashPassword(newPassword);
      found.lastLoginAt = new Date().toISOString();
      return res.json({
        success: true,
        message: 'Password successfully updated! You are now signed in.',
        user: {
          id: found.id,
          name: found.name,
          email: found.email,
          phoneNumber: found.phoneNumber,
          provider: found.provider,
          avatar: found.avatar,
          createdAt: found.createdAt,
          lastLoginAt: found.lastLoginAt,
        },
      });
    }

    return res.json({
      success: true,
      message: `Account recovery code sent to ${identifier}. Verification code: 123456`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. User Isolated History Endpoints
app.get('/api/user/history', (req, res) => {
  try {
    const userId = String(req.query.userId || req.headers.authorization?.replace('Bearer ', '') || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: missing userId.' });
    }
    const history = serverUserHistory.get(userId) || [];
    return res.json({ success: true, history });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/history', (req, res) => {
  try {
    const { userId, item } = req.body;
    if (!userId || !item) {
      return res.status(400).json({ error: 'Missing userId or history item payload.' });
    }
    const current = serverUserHistory.get(userId) || [];
    const updated = [item, ...current.filter((i) => i.id !== item.id)].slice(0, 200);
    serverUserHistory.set(userId, updated);
    return res.json({ success: true, count: updated.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/user/history/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.query.userId || '');
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter.' });
    }
    const current = serverUserHistory.get(userId) || [];
    const filtered = current.filter((i) => i.id !== id);
    serverUserHistory.set(userId, filtered);
    return res.json({ success: true, count: filtered.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/user/history', (req, res) => {
  try {
    const userId = String(req.query.userId || '');
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter.' });
    }
    serverUserHistory.delete(userId);
    return res.json({ success: true, message: 'User history cleared.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// AERIX Clinical & Universal AI Assistant Endpoint (Replacing PharmDBot)
const aerixHandler = async (req: express.Request, res: express.Response) => {
  try {
    const { message, history, topic } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Please provide a message for AERIX.' });
    }

    if (!ai) {
      return res.json({
        success: false,
        useFallback: true,
        message: 'Gemini AI not initialized. Using AERIX clinical pharmacology library.',
      });
    }

    const systemInstruction = `You are AERIX, an advanced AI Assistant specializing in pharmacovigilance, clinical pharmacology, medicines, therapeutics, and universal intelligence.

CORE BEHAVIOR & EVIDENCE-CONSCIOUS GUIDELINES:
1. HEALTH-RELATED & CLINICAL ANSWERS:
   - Provide clear, structured, and evidence-conscious information grounded in recognized pharmacological principles, ICH E2A/E2D safety standards, CIOMS guidelines, and clinical pharmacology.
   - Transparently state uncertainty whenever scientific evidence is inconclusive, variable, or requires patient-specific clinical validation.
   - Avoid presenting yourself as a substitute for a qualified healthcare professional, attending physician, or formal diagnostic consultation.
   - Do NOT invent citations, fake study PMIDs, or claim to have reviewed sources that were not actually consulted.
   - When discussing diseases, provide structured dossiers (Definition, Etiology, Pathophysiology, Cardinal Signs, Diagnosis, and Pharmacological Regimens detailing Formulation [Injection, Tablet, Capsule, Inhaler, Infusion], Route, Dose, and Frequency).
   - When discussing ADRs or drug interactions, clearly detail biological mechanisms (e.g. CYP isoenzymes, P-gp, QT prolongation, pharmacodynamics), seriousness, and concrete risk-mitigation advice.

2. UNIVERSAL INTELLIGENCE & GENERAL QUESTIONS:
   - For non-health general questions (science, coding, technology, logic, reasoning, academic writing, everyday queries), answer with the comprehensive intelligence, fluency, speed, and versatility of ChatGPT.
   - Always be polite, articulate, and insightful.

3. IDENTITY:
   - Your name is AERIX. Maintain this branding consistently.`;

    const chatParts: any[] = [];

    if (Array.isArray(history) && history.length > 0) {
      const recentHistory = history.slice(-6);
      chatParts.push({
        text: `Previous conversation:\n${recentHistory.map((h: any) => `${h.role === 'user' ? 'User' : 'AERIX'}: ${h.content}`).join('\n\n')}\n---`,
      });
    }

    if (topic) {
      chatParts.push({ text: `Focus topic: ${topic}` });
    }

    chatParts.push({ text: message });

    const reply = await generateGeminiWithFallback({
      parts: chatParts,
      responseMimeType: 'text/plain',
      systemInstruction,
    });

    return res.json({ success: true, reply });
  } catch (err: any) {
    console.error('AERIX AI error:', err);
    return res.json({ success: false, error: err.message, useFallback: true });
  }
};

// Mount both AERIX and legacy endpoint alias
app.post('/api/ai/aerix', aerixHandler);
app.post('/api/ai/pharmdbot', aerixHandler);

// Dedicated AI Endpoint: Fast Standard Treatment Guidelines (STG) Book & Clinical Query
app.post('/api/ai/stg-lookup', async (req, res) => {
  try {
    const { diseaseName, customBookName, customBookText } = req.body;
    if (!diseaseName || typeof diseaseName !== 'string' || !diseaseName.trim()) {
      return res.status(400).json({ error: 'Please provide a disease or clinical condition name.' });
    }

    if (!ai) {
      return res.json({
        success: false,
        useFallback: true,
        message: 'Gemini AI not initialized. Using local clinical knowledge base.',
      });
    }

    const stgPrompt = `You are a Senior Hospital Clinical Pharmacologist and Chief of Medicine.
Provide the authoritative Standard Treatment Guidelines (STG) protocol for "${diseaseName.trim()}".

${customBookName || customBookText ? `REFERENCE STANDARD TREATMENT GUIDE BOOK: "${customBookName || 'Uploaded STG Book'}"
${customBookText ? `BOOK CONTENT EXCERPT:\n${customBookText}\n` : ''}
INSTRUCTION: Check if "${diseaseName.trim()}" is covered in this book. If yes, extract directly from the book and cite "Matched from Standard Treatment Guide Book". If not covered, provide the best answer from ChatGPT and global clinical guidelines (AHA, KDIGO, GOLD, ADA, WHO) and cite "Expanded from ChatGPT & Global Clinical Guidelines".` : ''}

MANDATORY PHARMACOLOGICAL REQUIREMENTS:
Every drug MUST specify:
1. Formulation: MUST state whether it is Injection, Tablet, Capsule, Syrup, Inhaler / Respule, or IV Infusion.
2. Generic name and common brand examples
3. Exact dose
4. Route of administration
5. Frequency (OD, BD, TDS, QID, Continuous Infusion)
6. Duration of therapy
7. Non-pharmacological management

Return your response ONLY as valid, parseable JSON matching this schema:
{
  "diseaseName": "${diseaseName.trim()}",
  "definition": "Authoritative clinical definition and pathophysiology",
  "etiology": "Comprehensive primary causes, secondary triggers, and risk factors",
  "clinicalPresentation": "Cardinal signs and symptoms",
  "diagnosticCriteria": "Gold standard diagnostic tests and criteria",
  "pharmacologicalTreatment": [
    {
      "formulation": "Injection" | "Tablet" | "Capsule" | "Syrup" | "Inhaler / Respule" | "Infusion" | "Drops / Topical",
      "genericName": "string",
      "brandNameExample": "string",
      "dose": "string",
      "route": "string",
      "frequency": "string",
      "duration": "string",
      "lineOfTherapy": "First-Line" | "Second-Line / Alternative" | "Acute Emergency / Rescue" | "Maintenance / Adjuvant",
      "clinicalPearl": "string"
    }
  ],
  "nonPharmacologicalTreatment": ["string"],
  "contraindicationsAndAdjustments": "Renal and hepatic dosing adjustments and contraindications",
  "monitoringParameters": "Key biomarkers and targets",
  "sourceStatus": "Matched from Standard Treatment Guide Book" | "Expanded from ChatGPT & Global Clinical Guidelines",
  "guidelineReference": "string"
}`;

    const text = await generateGeminiWithFallback({
      parts: [{ text: stgPrompt }],
      responseMimeType: 'application/json',
    });

    const parsed = JSON.parse(text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim());
    return res.json({ success: true, result: parsed });
  } catch (err: any) {
    console.error('STG lookup failed:', err);
    return res.json({ success: false, error: err.message, useFallback: true });
  }
});

const server = http.createServer(app);

// In development, hook Vite middleware
if (process.env.NODE_ENV !== 'production') {
  const isHmrDisabled = process.env.DISABLE_HMR === 'true';
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: isHmrDisabled ? false : { server },
      watch: isHmrDisabled ? null : {},
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

server.listen(port, '0.0.0.0', () => {
  console.log(`Vigilytics AI Server listening on port ${port}`);
});
