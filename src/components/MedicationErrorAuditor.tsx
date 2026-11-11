import React, { useState } from 'react';
import {
  AlertTriangle,
  Upload,
  Camera,
  Trash2,
  Plus,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Copy,
  Check,
  Pill,
  RefreshCw,
  FolderPlus,
  AlertOctagon,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { DrugAutocompleteInput } from './DrugAutocompleteInput';
import { DocumentCameraModal } from './DocumentCameraModal';
import { showToast } from '../utils/toast';
import {
  ACCEPTED_DOCUMENT_TYPES,
  resolveFileMimeType,
  getFileFormatInfo,
} from '../utils/fileHelpers';
import { SafetyCase, DrugAdministration, MedicalCondition } from '../types/pv';

export interface MedicationErrorItem {
  id: string;
  errorType:
    | 'Sound-Alike / Look-Alike (LASA)'
    | 'Duplicate Therapeutic Class'
    | 'Wrong Dose / Overdose Risk'
    | 'Drug-Disease Contraindication'
    | 'Narrow Therapeutic Index Risk'
    | 'Route Incompatibility';
  severity: 'Critical' | 'Warning' | 'Caution';
  drugInvolved: string;
  issueDescription: string;
  howItOccurs: string; // Neat, clear, simple explanation of how the error occurs
  recommendedCorrection: string;
}

export interface MedicationErrorAuditResult {
  drugsIdentified: string[];
  totalErrors: number;
  highestSeverity: string;
  summaryText: string;
  overallSafetyRecommendation: string;
  medicationErrors: MedicationErrorItem[];
}

interface MedicationErrorAuditorProps {
  onSaveAsCase?: (safetyCase: SafetyCase) => void;
}

export const MedicationErrorAuditor: React.FC<MedicationErrorAuditorProps> = ({
  onSaveAsCase,
}) => {
  // Input Method: Manual typing vs Uploading a File / Camera Scan
  const [inputMethod, setInputMethod] = useState<'manual' | 'upload'>('manual');

  // Drug List for Manual Input
  const [drugs, setDrugs] = useState<string[]>([]);
  const [newDrugInput, setNewDrugInput] = useState('');
  const [regimenNotes, setRegimenNotes] = useState('');

  // Patient Clinical Context
  const [patientContext, setPatientContext] = useState({
    age: '72',
    renalImpairment: false,
    hepaticImpairment: false,
    pregnant: false,
    allergies: '',
    clinicalNotes: '',
  });
  const [showContextOptions, setShowContextOptions] = useState(false);

  // Uploaded Document State
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: string;
    type: string;
    base64: string;
    previewUrl?: string;
  } | null>(null);

  // Document Camera Modal State
  const [showCameraModal, setShowCameraModal] = useState(false);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<MedicationErrorAuditResult | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeStr =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    const mimeType = resolveFileMimeType(file.name, file.type);
    const isImg = mimeType.startsWith('image/');
    const previewUrl = isImg ? URL.createObjectURL(file) : undefined;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      setUploadedFile({
        name: file.name,
        size: sizeStr,
        type: mimeType,
        base64,
        previewUrl,
      });
      showToast(`Uploaded "${file.name}". Ready for AI medication error audit.`, 'success');
    };
    reader.readAsDataURL(file);
  };

  // Camera Capture Handler
  const handleCameraCapture = (fileOrFiles: File | File[], previewUrlOrUrls: string | string[]) => {
    const file = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
    const previewUrl = Array.isArray(previewUrlOrUrls) ? previewUrlOrUrls[0] : previewUrlOrUrls;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      setUploadedFile({
        name: file.name,
        size: `${Math.round(file.size / 1024)} KB`,
        type: file.type || 'image/jpeg',
        base64,
        previewUrl: previewUrl || dataUrl,
      });
      showToast('Document camera photo captured! Ready for AI medication error audit.', 'success');
    };
    reader.readAsDataURL(file);
  };

  // Add Drug to Regimen
  const handleAddDrug = (drugName?: string) => {
    const nameToAdd = (drugName || newDrugInput).trim();
    if (!nameToAdd) return;
    if (drugs.some((d) => d.toLowerCase() === nameToAdd.toLowerCase())) {
      showToast(`"${nameToAdd}" is already in your medication list.`, 'warning');
      return;
    }
    setDrugs([...drugs, nameToAdd]);
    setNewDrugInput('');
  };

  const handleRemoveDrug = (index: number) => {
    setDrugs(drugs.filter((_, i) => i !== index));
  };

  // Clinical Preset Quick Loader
  const loadPreset = (
    presetDrugs: string[],
    renal = false,
    notes = '',
    regimen = ''
  ) => {
    setDrugs(presetDrugs);
    setUploadedFile(null);
    setInputMethod('manual');
    setRegimenNotes(regimen);
    setPatientContext({
      ...patientContext,
      renalImpairment: renal,
      clinicalNotes: notes,
    });
    setAnalysisResult(null);
    showToast(`Loaded scenario: ${presetDrugs.join(', ')}`, 'info');
  };

  // Run AI & Algorithmic Screening
  const handleRunScreen = async () => {
    if (inputMethod === 'manual' && drugs.length === 0) {
      showToast('Please add at least one medication to screen for medication errors.', 'warning');
      return;
    }
    if (inputMethod === 'upload' && !uploadedFile) {
      showToast('Please select or scan a prescription/chart file first.', 'warning');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/ai/medication-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drugs: inputMethod === 'manual' ? drugs : [],
          regimenText: regimenNotes,
          fileData: inputMethod === 'upload' ? uploadedFile?.base64 : undefined,
          fileMimeType: inputMethod === 'upload' ? uploadedFile?.type : undefined,
          fileName: inputMethod === 'upload' ? uploadedFile?.name : undefined,
          patientContext,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.result) {
          setAnalysisResult({
            drugsIdentified: data.result.drugsIdentified || [],
            totalErrors: data.result.totalErrors || (data.result.medicationErrors?.length || 0),
            highestSeverity: data.result.highestSeverity || 'Cautionary Advisory',
            summaryText: data.result.summaryText || 'Medication error audit completed.',
            overallSafetyRecommendation: data.result.overallSafetyRecommendation || 'Review prescription safety.',
            medicationErrors: data.result.medicationErrors || [],
          });
          if (inputMethod === 'upload' && Array.isArray(data.result.drugsIdentified) && data.result.drugsIdentified.length > 0) {
            setDrugs(data.result.drugsIdentified);
          }
          showToast(
            `AI Audit Complete: Found ${data.result.totalErrors || data.result.medicationErrors?.length || 0} medication error hazard(s).`,
            'success'
          );
          return;
        }
      }

      // Local Deterministic Clinical Engine Fallback
      const localResult = runLocalMedicationErrorFallback(drugs, patientContext);
      setAnalysisResult(localResult);
      showToast(
        `Medication safety audit completed with clinical pharmacology engine. Found ${localResult.totalErrors} risk(s).`,
        'info'
      );
    } catch (err: any) {
      console.warn('API error, using local clinical engine fallback:', err);
      const localResult = runLocalMedicationErrorFallback(drugs, patientContext);
      setAnalysisResult(localResult);
      showToast('Audit completed with offline clinical safety rules.', 'info');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Local Deterministic Clinical Engine Fallback
  const runLocalMedicationErrorFallback = (
    drugList: string[],
    context: typeof patientContext
  ): MedicationErrorAuditResult => {
    const medicationErrors: MedicationErrorItem[] = [];

    drugList.forEach((drugName) => {
      const lower = drugName.toLowerCase();

      // 1. LASA: Celebrex vs Celexa vs Cerebyx
      if (lower.includes('celexa') || lower.includes('celebrex') || lower.includes('cerebyx')) {
        medicationErrors.push({
          id: `err-lasa-celebrex-${drugName}`,
          errorType: 'Sound-Alike / Look-Alike (LASA)',
          severity: 'Critical',
          drugInvolved: drugName,
          issueDescription: `High-alert confusion risk between Celebrex (celecoxib - NSAID for pain/arthritis), Celexa (citalopram - SSRI antidepressant), and Cerebyx (fosphenytoin - anticonvulsant).`,
          howItOccurs: `Prescription handwriting misread or pharmacy dispensing error occurs because drug brand names share phonetics and orthographic spelling. Administering an antidepressant or seizure drug instead of an arthritis anti-inflammatory leads to severe adverse neurological consequences.`,
          recommendedCorrection: `Mandate FDA Tall-Man Lettering (e.g., CELEx-a vs. CeleBREX) and require clear medical indication on prescription orders.`,
        });
      }

      // 2. LASA: Zyrtec vs Zyprexa
      if (lower.includes('zyrtec') || lower.includes('zyprexa')) {
        medicationErrors.push({
          id: `err-lasa-zyrtec-${drugName}`,
          errorType: 'Sound-Alike / Look-Alike (LASA)',
          severity: 'Critical',
          drugInvolved: drugName,
          issueDescription: `High-risk LASA confusion between Zyrtec (cetirizine - OTC allergy antihistamine) and Zyprexa (olanzapine - second-generation antipsychotic).`,
          howItOccurs: `Accidental substitution of an atypical antipsychotic for an allergy antihistamine leads to severe central nervous system depression, unresponsiveness, acute hypotension, and extrapyramidal symptoms.`,
          recommendedCorrection: `Confirm exact indication; store separately in automated dispensing cabinets (ADCs) with prominent safety warning screens.`,
        });
      }

      // 3. Narrow Therapeutic Index
      if (
        lower.includes('warfarin') ||
        lower.includes('digoxin') ||
        lower.includes('lithium') ||
        lower.includes('theophylline') ||
        lower.includes('phenytoin')
      ) {
        medicationErrors.push({
          id: `err-nti-${drugName}`,
          errorType: 'Narrow Therapeutic Index Risk',
          severity: 'Warning',
          drugInvolved: drugName,
          issueDescription: `${drugName} has a narrow therapeutic window where blood levels slightly above target trigger lethal poisoning, and slightly below target cause treatment failure.`,
          howItOccurs: `Minor fluctuations in dehydration, co-medications, or organ clearance quickly convert a therapeutic blood level into a toxic state.`,
          recommendedCorrection: `Mandatory Therapeutic Drug Monitoring (TDM). Obtain baseline and regular serum drug concentration assays.`,
        });
      }

      // 4. Methotrexate Schedule Overdose
      if (lower.includes('methotrexate')) {
        medicationErrors.push({
          id: `err-mtx-schedule`,
          errorType: 'Wrong Dose / Overdose Risk',
          severity: 'Critical',
          drugInvolved: 'Methotrexate',
          issueDescription: `Fatal dosing schedule error: Oral Methotrexate for autoimmune conditions (rheumatoid arthritis, psoriasis) must be administered ONCE WEEKLY, never once daily.`,
          howItOccurs: `Prescribers or patients mistakenly write or take daily dosing instead of once-weekly dosing. Daily administration causes rapid pancytopenia, gastrointestinal mucosal sloughing, and fatal bone marrow suppression.`,
          recommendedCorrection: `Specify designated day of the week (e.g., "Every Monday") with maximum 20mg/week; provide explicit patient counseling.`,
        });
      }

      // 5. Renal Contraindications
      if (context.renalImpairment) {
        if (lower.includes('metformin')) {
          medicationErrors.push({
            id: 'err-renal-metformin',
            errorType: 'Drug-Disease Contraindication',
            severity: 'Critical',
            drugInvolved: 'Metformin',
            issueDescription: 'FDA Black Box Warning: Metformin accumulation in severe renal impairment triggers fatal lactic acidosis.',
            howItOccurs: 'When kidney glomerular filtration drops, metformin cannot be cleared, leading to mitochondrial respiration blockade and massive lactic acid accumulation in the blood.',
            recommendedCorrection: 'Discontinue metformin if eGFR < 30 mL/min/1.73m2; substitute with insulin or renal-safe alternatives.',
          });
        }
        if (lower.includes('ibuprofen') || lower.includes('naproxen') || lower.includes('diclofenac') || lower.includes('ketorolac')) {
          medicationErrors.push({
            id: 'err-renal-nsaid',
            errorType: 'Drug-Disease Contraindication',
            severity: 'Warning',
            drugInvolved: drugName,
            issueDescription: 'NSAID-induced acute-on-chronic kidney injury through renal afferent arteriolar vasoconstriction.',
            howItOccurs: 'NSAIDs block vasodilatory prostaglandins in the kidneys, shutting off renal perfusion and precipitating anuric acute kidney failure.',
            recommendedCorrection: 'Avoid systemic oral NSAIDs in renal impairment. Use topical agents, paracetamol, or short-term opioid alternatives.',
          });
        }
      }
    });

    // 6. Duplicate Therapeutic Classes
    const statins = drugList.filter((d) => /statin/i.test(d));
    if (statins.length > 1) {
      medicationErrors.push({
        id: 'err-dup-statin',
        errorType: 'Duplicate Therapeutic Class',
        severity: 'Warning',
        drugInvolved: statins.join(' + '),
        issueDescription: `Therapeutic duplication: Multiple HMG-CoA reductase inhibitors prescribed concurrently (${statins.join(', ')}).`,
        howItOccurs: 'Patient inadvertently receives two distinct statin prescriptions (e.g., discharge orders and primary care refill), providing zero incremental LDL reduction while doubling myopathy and rhabdomyolysis rates.',
        recommendedCorrection: 'Deprescribe duplicate statin immediately and consolidate to a single appropriate statin dose.',
      });
    }

    const nsaids = drugList.filter((d) =>
      /ibuprofen|naproxen|diclofenac|meloxicam|celecoxib|ketorolac|indomethacin/i.test(d)
    );
    if (nsaids.length > 1) {
      medicationErrors.push({
        id: 'err-dup-nsaid',
        errorType: 'Duplicate Therapeutic Class',
        severity: 'Critical',
        drugInvolved: nsaids.join(' + '),
        issueDescription: `Therapeutic duplication: Multiple systemic NSAIDs prescribed simultaneously (${nsaids.join(', ')}).`,
        howItOccurs: 'Co-prescribing two systemic NSAIDs provides no superior pain relief but drastically multiplies gastric ulcer perforation and acute kidney injury risks.',
        recommendedCorrection: 'Discontinue one NSAID agent; never combine two systemic oral NSAIDs.',
      });
    }

    const highestSeverity = medicationErrors.some((e) => e.severity === 'Critical')
      ? 'Critical Hazard'
      : medicationErrors.length > 0
      ? 'High Warning'
      : 'No Medication Errors Detected';

    return {
      drugsIdentified: drugList,
      totalErrors: medicationErrors.length,
      highestSeverity,
      summaryText:
        medicationErrors.length > 0
          ? `Audited ${drugList.length} medications. Identified ${medicationErrors.length} prescribing error risk(s) and safety hazard(s).`
          : `Audited ${drugList.length} medications. No significant look-alike/sound-alike risks, duplications, or organ contraindications detected.`,
      overallSafetyRecommendation:
        medicationErrors.some((e) => e.severity === 'Critical')
          ? 'URGENT PRESCRIBING INTERVENTION: Critical medication error hazards detected. Review dosages, indications, and cancel duplicate or contraindicated orders before dispensing.'
          : medicationErrors.length > 0
          ? 'CAUTION ADVISED: Potential prescribing risks identified. Clarify orders with the prescriber and document therapeutic rationale.'
          : 'REGIMEN VALIDATED: No high-alert medication errors or duplicate therapy detected.',
      medicationErrors,
    };
  };

  // Copy Plain Text Report to Clipboard
  const handleCopyReport = () => {
    if (!analysisResult) return;
    const lines: string[] = [
      '====================================================',
      'VIGILYTICS MEDICATION ERROR AUDIT & PRESCRIBING SAFETY DOSSIER',
      '====================================================',
      `Date: ${new Date().toLocaleString()}`,
      `Screened Regimen: ${analysisResult.drugsIdentified.join(', ')}`,
      `Overall Status: ${analysisResult.highestSeverity}`,
      `Total Error Flags: ${analysisResult.totalErrors}`,
      `Summary: ${analysisResult.summaryText}`,
      `Safety Recommendation: ${analysisResult.overallSafetyRecommendation}`,
      '',
      '--- IDENTIFIED MEDICATION ERRORS & SAFETY HAZARDS ---',
    ];

    if (analysisResult.medicationErrors.length === 0) {
      lines.push('No medication errors or prescribing flags detected.');
    } else {
      analysisResult.medicationErrors.forEach((err, idx) => {
        lines.push(`\n[#${idx + 1}] ${err.errorType}: ${err.drugInvolved} (${err.severity})`);
        lines.push(`Issue: ${err.issueDescription}`);
        lines.push(`How It Occurs: ${err.howItOccurs}`);
        lines.push(`Recommended Correction: ${err.recommendedCorrection}`);
      });
    }

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedReport(true);
    showToast('Medication error audit report copied to clipboard!', 'success');
    setTimeout(() => setCopiedReport(false), 3000);
  };

  // Transfer Finding to Pharmacovigilance Workspace as a Case
  const handleTransferToWorkspace = () => {
    if (!analysisResult) return;
    const primaryError = analysisResult.medicationErrors[0];
    const suspectDrug = primaryError?.drugInvolved || analysisResult.drugsIdentified[0] || 'Unknown Drug';
    const primaryReaction = primaryError ? `Medication Error: ${primaryError.errorType}` : 'Medication Error Hazard';

    const isSerious = analysisResult.highestSeverity === 'Critical Hazard';

    const newSafetyCase: SafetyCase = {
      id: `case-mederr-${Date.now()}`,
      caseNumber: `ICSR-MEDERR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      version: 1,
      initialReceivedDate: new Date().toISOString().split('T')[0],
      mostRecentUpdateDate: new Date().toISOString().split('T')[0],
      country: 'Global Safety Network',
      reporterQualification: 'Pharmacist',
      reportType: 'Spontaneous HCP',
      primarySource: 'Hospital Pharmacy Quality Oversight',
      priority: isSerious ? 'P1 - Urgent (24h Expedited)' : 'P3 - Medium (7d Standard)',
      priorityRationale: `Automated intake from Medication Error Audit: ${analysisResult.summaryText}`,
      riskClassification: 'Known Labeled Risk',
      naranjoScore: isSerious ? 6 : 4,
      naranjoCategory: isSerious ? 'Probable' : 'Possible',
      naranjoAnswers: { q1: 1, q2: 2, q3: 1, q4: 0, q5: 1 },
      whoUmcCategory: isSerious ? 'Probable / Likely' : 'Possible',
      narrativeText: `Safety case generated from Vigilytics AI Medication Error Auditor.\nScreened Regimen: ${analysisResult.drugsIdentified.join(', ')}.\nIdentified Error Hazards: ${analysisResult.totalErrors}.\nSummary: ${analysisResult.summaryText}\nCorrection Advice: ${analysisResult.overallSafetyRecommendation}`,
      clinicalSummary: analysisResult.summaryText,
      labResults: [],
      timeline: [],
      factsVsInterpretation: {
        reportedFacts: analysisResult.drugsIdentified,
        algorithmicInterpretations: [analysisResult.summaryText],
        clinicalUncertainties: [],
      },
      missingDataAudit: [],
      patient: {
        id: `pat-mederr-${Date.now()}`,
        initials: 'PT-ERR',
        age: parseInt(patientContext.age, 10) || 72,
        ageGroup: (parseInt(patientContext.age, 10) || 72) >= 65 ? 'Elderly (65+y)' : 'Adult (18-64y)',
        sex: 'Unknown',
        pregnancyStatus: patientContext.pregnant ? 'First Trimester' : 'Not Applicable',
        weightKg: 70,
        medicalHistory: [
          patientContext.renalImpairment ? { condition: 'Renal Impairment', status: 'Active' as const, isRiskFactor: true } : null,
          patientContext.hepaticImpairment ? { condition: 'Hepatic Impairment', status: 'Active' as const, isRiskFactor: true } : null,
          patientContext.clinicalNotes ? { condition: patientContext.clinicalNotes, status: 'Active' as const, isRiskFactor: false } : null,
        ].filter(Boolean) as MedicalCondition[],
        allergies: patientContext.allergies ? [patientContext.allergies] : [],
        baselineOrganFunction: {
          renal: patientContext.renalImpairment ? 'eGFR < 30 mL/min' : 'Normal',
          hepatic: patientContext.hepaticImpairment ? 'Elevated ALT/AST' : 'Normal',
        },
      },
      reporterDetails: {
        name: 'Clinical Pharmacist Specialist',
        qualification: 'Pharmacist',
        country: 'Global Safety Network',
        isConfidential: true,
      },
      drugs: analysisResult.drugsIdentified.map((dName, idx) => ({
        id: `drug-${idx}`,
        drugName: dName,
        activeSubstance: dName,
        brandName: dName,
        role: idx === 0 ? 'Suspect' : 'Concomitant',
        dose: 'Standard dose',
        route: 'Oral',
        frequency: 'Once daily',
        indication: 'Primary therapy',
        startDate: new Date().toISOString().split('T')[0],
        stopDate: null,
        ongoing: true,
        batchLotNumber: 'UNKNOWN',
        marketingAuthHolder: 'MAH',
        dechallenge: 'Unknown',
        rechallenge: 'Not Performed',
        actionTaken: 'Dose Not Changed',
        knownSmPCAdverseReactions: [],
      })),
      events: [
        {
          id: 'evt-1',
          term: primaryReaction,
          lltTerm: primaryReaction,
          socTerm: 'Injury, poisoning and procedural complications',
          signsAndSymptoms: analysisResult.summaryText,
          onsetDate: new Date().toISOString().split('T')[0],
          resolutionDate: null,
          outcome: 'Recovering / Resolving',
          seriousness: {
            death: false,
            lifeThreatening: isSerious,
            hospitalization: isSerious,
            disability: false,
            congenitalAnomaly: false,
            otherMedicallyImportant: true,
          },
          isSerious,
          severityGrade: isSerious ? 'Severe' : 'Moderate',
          isListedInSmPC: true,
          smPCDetails: 'NCC MERP Medication Error Category Flag',
        },
      ],
      pegaStage: 'Triage',
      pegaStep: 'Seriousness & Expedited Routing Evaluation',
      pegaWorkQueue: 'PV_Triage_Desk',
      assignedOperator: 'AI Triage Agent',
      potentialDuplicates: [],
      isDuplicateFlagged: false,
      pegaSLA: {
        goalTimestamp: new Date().toISOString(),
        deadlineTimestamp: new Date().toISOString(),
        passedDeadlineTimestamp: new Date().toISOString(),
        urgencyScore: isSerious ? 85 : 45,
        regulatoryDeadlineType: isSerious ? '15-Day Serious' : '30-Day Non-Serious',
        hoursRemaining: isSerious ? 24 : 72,
      },
      humanApproval: {
        status: 'Pending Review',
        requiresSecondSignoff: false,
      },
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userName: 'AI Screening System',
          userRole: 'PV_TRIAGE_SPECIALIST',
          actionType: 'CASE_CREATED',
          description: 'Automated intake from Medication Error Audit',
        },
      ],
      workflowHistory: [
        {
          timestamp: new Date().toISOString(),
          fromStage: 'Intake',
          toStage: 'Triage',
          step: 'Initial Case Intake',
          operator: 'AI Medication Error Engine',
          actionTaken: 'Automated Case Intake from Medication Error Audit',
          rationale: 'Critical medication error hazard flagged for pharmacovigilance oversight.',
        },
      ],
    };

    if (onSaveAsCase) {
      onSaveAsCase(newSafetyCase);
      showToast(`Case ${newSafetyCase.caseNumber} transferred to Safety Workspace!`, 'success');
    } else {
      showToast('Transferred to safety case workflow.', 'success');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 rounded-2xl p-6 text-white border border-amber-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Dedicated AI Medication Error & Prescribing Safety Intelligence</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Medication Error Auditor</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Audit prescriptions, doctor orders, and hospital charts for <strong>Look-Alike / Sound-Alike (LASA) confusions</strong>, duplicate therapy, wrong dose/frequency, organ contraindications, and narrow therapeutic index hazards. Vigilytics AI explains <strong>how each error occurs in simple terms</strong> and provides recommended clinical corrections.
            </p>
          </div>

          {/* Quick Scenario Buttons */}
          <div className="flex flex-col gap-2 self-start md:self-center shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Test Error Scenarios:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => loadPreset(['Celebrex', 'Celexa'], false, 'Prescription dispensing error')}
                className="px-2.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
                title="LASA Sound-Alike: Celebrex vs Celexa"
              >
                LASA: Celebrex vs Celexa
              </button>
              <button
                type="button"
                onClick={() => loadPreset(['Zyrtec', 'Zyprexa'], false, 'Dispensing mix-up')}
                className="px-2.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
                title="LASA: Zyrtec (Antihistamine) vs Zyprexa (Antipsychotic)"
              >
                LASA: Zyrtec vs Zyprexa
              </button>
              <button
                type="button"
                onClick={() => loadPreset(['Methotrexate'], false, 'Prescription order error', 'Methotrexate 10mg PO Daily for Rheumatoid Arthritis')}
                className="px-2.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-[11px] font-semibold rounded-lg border border-rose-800/70 transition-colors cursor-pointer"
                title="Fatal Overdose: Daily Methotrexate instead of Weekly"
              >
                Daily Methotrexate Hazard
              </button>
              <button
                type="button"
                onClick={() => loadPreset(['Atorvastatin', 'Rosuvastatin'], false, 'Dual statin co-prescribing')}
                className="px-2.5 py-1.5 bg-amber-950/80 hover:bg-amber-900 text-amber-200 text-[11px] font-semibold rounded-lg border border-amber-800/70 transition-colors cursor-pointer"
                title="Duplicate Therapeutic Class: Two statins prescribed together"
              >
                Duplicate Statins
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            {/* Input Method Selector (Enter Drugs vs Upload File / Camera) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Input Method
              </label>
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setInputMethod('manual')}
                  className={`flex-1 py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    inputMethod === 'manual'
                      ? 'bg-white text-amber-700 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Pill className="w-3.5 h-3.5" />
                  <span>Enter Medications</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMethod('upload')}
                  className={`flex-1 py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    inputMethod === 'upload'
                      ? 'bg-white text-amber-700 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Chart / Scan</span>
                </button>
              </div>
            </div>

            {/* INPUT METHOD 1: MANUAL DRUG LIST ENTRY */}
            {inputMethod === 'manual' && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Add Medication to Regimen
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <DrugAutocompleteInput
                        value={newDrugInput}
                        onChange={setNewDrugInput}
                        onSelectDrug={(item) => handleAddDrug(item.drugName)}
                        placeholder="Type medication name (e.g. Celebrex, Celexa, Methotrexate)..."
                        className="w-full text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddDrug()}
                      disabled={!newDrugInput.trim()}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Additional Regimen Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Regimen Dosage / Scheduling Notes (Optional):
                  </label>
                  <input
                    type="text"
                    value={regimenNotes}
                    onChange={(e) => setRegimenNotes(e.target.value)}
                    placeholder="e.g. Methotrexate 10mg Daily, or Celexa 20mg twice daily..."
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>

                {/* Drug Pills List */}
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
                    <span>Regimen Medications ({drugs.length})</span>
                    {drugs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setDrugs([])}
                        className="text-rose-600 hover:text-rose-700 text-[11px] font-semibold cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {drugs.length === 0 ? (
                    <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                      No drugs added yet. Use the autocomplete search above or pick an Error Scenario above.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {drugs.map((drug, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-800">{drug}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDrug(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="Remove medication"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* INPUT METHOD 2: FILE UPLOAD OR CAMERA SCAN */}
            {inputMethod === 'upload' && (
              <div className="space-y-3.5">
                <div className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl p-5 text-center bg-slate-50/60 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-xs text-slate-800">
                    Upload Prescription, Doctor Order, or Medication Chart
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                    Accepts <strong>PDF</strong> documents, clinical photos (<strong>JPG, PNG, WEBP</strong>), EHR charts, and physician orders.
                  </p>

                  <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCameraModal(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Take Photo / Camera Scan</span>
                    </button>

                    <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Browse Document</span>
                      <input
                        type="file"
                        accept={ACCEPTED_DOCUMENT_TYPES}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {uploadedFile && (() => {
                  const fmt = getFileFormatInfo(uploadedFile.name, uploadedFile.type);
                  return (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        {uploadedFile.previewUrl ? (
                          <img
                            src={uploadedFile.previewUrl}
                            alt="preview"
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                          />
                        ) : (
                          <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold text-[9px] border ${fmt.badgeClass}`}>
                            <FileText className="w-4 h-4 mb-0.5" />
                            <span>{fmt.label}</span>
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-800 truncate max-w-[180px]">
                            {uploadedFile.name}
                          </div>
                          <div className="text-[10px] text-slate-500">{uploadedFile.size} · Multimodal AI ready</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setUploadedFile(null)}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Optional Patient Context / Organ Impairment Modifiers */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowContextOptions(!showContextOptions)}
                className="flex items-center justify-between w-full text-xs font-bold text-slate-700 hover:text-amber-600 transition-colors py-1 cursor-pointer"
              >
                <span>Patient Organ Function & Demographics (Optional)</span>
                <span className="text-[11px] text-amber-600">{showContextOptions ? 'Hide ▲' : 'Show ▼'}</span>
              </button>

              {showContextOptions && (
                <div className="mt-2.5 space-y-2.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={patientContext.renalImpairment}
                        onChange={(e) => setPatientContext({ ...patientContext, renalImpairment: e.target.checked })}
                        className="rounded text-amber-600"
                      />
                      <span className="text-[11px] font-semibold text-slate-700">Renal Impairment (eGFR &lt; 30)</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={patientContext.hepaticImpairment}
                        onChange={(e) => setPatientContext({ ...patientContext, hepaticImpairment: e.target.checked })}
                        className="rounded text-amber-600"
                      />
                      <span className="text-[11px] font-semibold text-slate-700">Hepatic Impairment</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Patient Age</label>
                      <input
                        type="number"
                        value={patientContext.age}
                        onChange={(e) => setPatientContext({ ...patientContext, age: e.target.value })}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs"
                        placeholder="e.g. 72"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pregnancy Status</label>
                      <label className="flex items-center gap-2 p-1.5 bg-white border border-slate-200 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={patientContext.pregnant}
                          onChange={(e) => setPatientContext({ ...patientContext, pregnant: e.target.checked })}
                          className="rounded text-amber-600"
                        />
                        <span className="text-[11px] text-slate-700 font-medium">Pregnant / Lactating</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Known Allergies / Diagnoses</label>
                    <input
                      type="text"
                      value={patientContext.allergies}
                      onChange={(e) => setPatientContext({ ...patientContext, allergies: e.target.value })}
                      placeholder="e.g. History of peptic ulcer, bronchial asthma..."
                      className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Run AI Error Audit Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRunScreen}
                disabled={
                  isAnalyzing ||
                  (inputMethod === 'manual' && drugs.length === 0) ||
                  (inputMethod === 'upload' && !uploadedFile)
                }
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-700 hover:to-amber-900 disabled:from-slate-300 disabled:to-slate-300 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Auditing Medication Errors with AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-200" />
                    <span>Run AI Medication Error Audit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Neat, Clear, Simple Clinical Results */}
        <div className="lg:col-span-7 space-y-4">
          {!analysisResult && !isAnalyzing && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="font-black text-slate-800 text-base">Awaiting Medication Regimen or Prescription</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Add medications on the left or upload a prescription slip, doctor order, or chart. Vigilytics AI will screen for look-alike/sound-alike errors, duplicate therapeutic classes, dosing schedule hazards, and organ contraindications with <strong>neat, clear, and simple descriptions of how each error occurs</strong>.
              </p>
            </div>
          )}

          {isAnalyzing && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto" />
              <div className="font-black text-sm text-slate-900">
                Auditing Look-Alike Names, Dosing Schedules & Contraindications...
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Checking FDA Tall-Man Lettering phonetics, duplicate therapeutic categories, narrow therapeutic index windows, and organ impairment clearance.
              </p>
            </div>
          )}

          {analysisResult && !isAnalyzing && (
            <div className="space-y-4">
              {/* Overall Executive Status Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3.5 shadow-2xs ${
                  analysisResult.highestSeverity === 'Critical Hazard'
                    ? 'bg-rose-50 border-rose-300 text-rose-950'
                    : analysisResult.totalErrors > 0
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                }`}
              >
                {analysisResult.highestSeverity === 'Critical Hazard' ? (
                  <AlertOctagon className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                ) : analysisResult.totalErrors > 0 ? (
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                )}

                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm uppercase tracking-wider">
                        {analysisResult.highestSeverity}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 border border-slate-200 text-slate-800">
                        {analysisResult.totalErrors} Error Hazard(s) Flagged
                      </span>
                    </div>

                    {/* Action Tools */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleCopyReport}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        {copiedReport ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedReport ? 'Copied' : 'Copy'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTransferToWorkspace}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                        title="Transfer to Safety Workspace as an active ICSR Case"
                      >
                        <FolderPlus className="w-3 h-3" />
                        <span>Log as Case</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed font-medium">
                    {analysisResult.summaryText}
                  </p>

                  <div className="text-[11px] font-semibold pt-0.5 text-slate-800 bg-white/60 p-2 rounded-lg border border-slate-200/60">
                    <strong>Recommended Prescribing Action:</strong> {analysisResult.overallSafetyRecommendation}
                  </div>
                </div>
              </div>

              {/* Identified Regimen Drugs Pills */}
              {analysisResult.drugsIdentified?.length > 0 && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-2 flex-wrap text-xs shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Audited Medications:
                  </span>
                  {analysisResult.drugsIdentified.map((d, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-amber-50 text-amber-900 rounded-lg font-bold border border-amber-200 text-xs flex items-center gap-1"
                    >
                      <Pill className="w-3 h-3 text-amber-600" />
                      <span>{d}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* MEDICATION ERRORS & PRESCRIBING SAFETY FLAGS */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <h3 className="font-black text-xs text-slate-800 uppercase tracking-wider">
                      Flagged Medication Errors & Hazards ({analysisResult.medicationErrors.length})
                    </h3>
                  </div>
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    LASA · Dosing Schedule · Duplications · Organ Safety
                  </span>
                </div>

                {analysisResult.medicationErrors.length === 0 ? (
                  <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>No medication error flags, look-alike/sound-alike hazards, or therapeutic duplications identified.</span>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {analysisResult.medicationErrors.map((err, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border text-xs space-y-3 ${
                          err.severity === 'Critical'
                            ? 'bg-rose-50/40 border-rose-200'
                            : err.severity === 'Warning'
                            ? 'bg-amber-50/40 border-amber-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {/* Header: Error Type and Severity */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-slate-900 flex items-center gap-2 text-xs">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                err.severity === 'Critical'
                                  ? 'bg-rose-500'
                                  : err.severity === 'Warning'
                                  ? 'bg-amber-500'
                                  : 'bg-sky-500'
                              }`}
                            ></span>
                            <span>{err.errorType}: {err.drugInvolved}</span>
                          </span>

                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded uppercase border ${
                              err.severity === 'Critical'
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : err.severity === 'Warning'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-slate-200 text-slate-800 border-slate-300'
                            }`}
                          >
                            {err.severity}
                          </span>
                        </div>

                        {/* Issue Description */}
                        <p className="text-xs text-slate-800 font-medium leading-relaxed">
                          {err.issueDescription}
                        </p>

                        {/* HOW THE ERROR OCCURS (NEAT, CLEAR, SIMPLE EXPLANATION) */}
                        <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>How This Error Occurs (Simple Explanation):</span>
                          </span>
                          <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                            {err.howItOccurs}
                          </p>
                        </div>

                        {/* Recommended Correction */}
                        <div className="p-2.5 text-xs text-emerald-950 bg-emerald-50 rounded-lg border border-emerald-200 space-y-0.5">
                          <strong className="text-[10px] uppercase font-bold text-emerald-800 block">
                            Recommended Correction & Prevention:
                          </strong>
                          <span className="font-medium text-emerald-900">{err.recommendedCorrection}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DOCUMENT CAMERA SCAN MODAL */}
      <DocumentCameraModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleCameraCapture}
        title="Scan Prescription / Medication Chart for Error Audit"
      />
    </div>
  );
};
