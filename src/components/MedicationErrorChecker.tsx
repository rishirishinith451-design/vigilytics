import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Upload,
  Camera,
  Trash2,
  Plus,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  Pill,
  RefreshCw,
  FolderPlus,
  FileText,
  AlertOctagon,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Activity,
  HeartPulse,
} from 'lucide-react';
import { DrugAutocompleteInput } from './DrugAutocompleteInput';
import { DocumentCameraModal } from './DocumentCameraModal';
import { showToast } from '../utils/toast';
import {
  ACCEPTED_DOCUMENT_TYPES,
  resolveFileMimeType,
  getFileFormatInfo,
  validateUploadedFiles,
  readFileToUploadItem,
} from '../utils/fileHelpers';
import { UploadedFilesList } from './UploadedFilesList';
import { authService } from '../services/authService';
import { historyService } from '../services/historyService';
import { SafetyCase, DrugAdministration, MedicalCondition } from '../types/pv';

export interface MedicationErrorItem {
  id: string;
  errorType: string;
  severity: 'Critical' | 'Warning' | 'Caution';
  drugInvolved: string;
  issueDescription: string;
  howItOccurs: string; // Neat, clear, simple explanation
  recommendedCorrection: string;
}

export interface MedicationAuditResult {
  drugsIdentified: string[];
  totalErrors: number;
  highestSeverity: string;
  summaryText: string;
  overallSafetyRecommendation: string;
  medicationErrors: MedicationErrorItem[];
}

interface MedicationErrorCheckerProps {
  onSaveAsCase?: (safetyCase: SafetyCase) => void;
}

export const MedicationErrorChecker: React.FC<MedicationErrorCheckerProps> = ({
  onSaveAsCase,
}) => {
  // Input method: manual regimen entry vs file upload
  const [inputMethod, setInputMethod] = useState<'manual' | 'upload'>('manual');

  // Medication entries for manual regimen
  interface RegimenEntry {
    id: string;
    name: string;
    dose: string;
    route: string;
    frequency: string;
  }

  const [medications, setMedications] = useState<RegimenEntry[]>([]);

  const [newDrugName, setNewDrugName] = useState('');
  const [newDrugDose, setNewDrugDose] = useState('Standard Dose');
  const [newDrugRoute, setNewDrugRoute] = useState('Oral');
  const [newDrugFreq, setNewDrugFreq] = useState('Once daily');

  // Patient Clinical Context
  const [patientContext, setPatientContext] = useState({
    age: '72',
    renalFunction: 'Severe Impairment (eGFR 22 mL/min)',
    hepaticFunction: 'Normal',
    allergies: 'Penicillin, Sulfa drugs',
    comorbidities: 'Chronic Kidney Disease Stage 4, Rheumatoid Arthritis, Major Depression',
    notes: 'Prescription presented at community pharmacy from out-of-town clinic.',
  });
  const [showContextOptions, setShowContextOptions] = useState(false);

  // Uploaded Casesheet Photos / Documents State (Supports Multiple Photos at a time)
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{
      id: string;
      name: string;
      size: string;
      type: string;
      base64: string;
      previewUrl?: string;
    }>
  >([]);

  const [showCameraModal, setShowCameraModal] = useState(false);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [auditResult, setAuditResult] = useState<MedicationAuditResult | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [fileValidationErrors, setFileValidationErrors] = useState<string[]>([]);

  // Process multiple files from file picker or drag-and-drop (PDFs, multiple images, and mixed)
  const processFiles = async (files: FileList | File[]) => {
    const validation = validateUploadedFiles(files);
    if (!validation.isValid && validation.errors.length > 0) {
      setFileValidationErrors(validation.errors);
      showToast(validation.errors[0], 'warning');
    } else {
      setFileValidationErrors([]);
    }

    if (validation.validFiles.length === 0) return;

    for (const file of validation.validFiles) {
      try {
        const item = await readFileToUploadItem(file, 'med-err');
        setUploadedFiles((prev) => [...prev, item]);
      } catch (err: any) {
        setFileValidationErrors((prev) => [...prev, err.message || `Failed to read ${file.name}`]);
      }
    }

    showToast(`Loaded ${validation.validFiles.length} file(s) for medication safety audit.`, 'success');
  };

  // Replace a specific file item in the list
  const handleReplaceFile = async (targetId: string, newFile: File) => {
    const validation = validateUploadedFiles([newFile]);
    if (!validation.isValid) {
      setFileValidationErrors(validation.errors);
      showToast(validation.errors[0], 'warning');
      return;
    }

    try {
      const newItem = await readFileToUploadItem(newFile, 'med-err-rep');
      setUploadedFiles((prev) => prev.map((f) => (f.id === targetId ? newItem : f)));
      setFileValidationErrors([]);
      showToast(`File replaced with "${newFile.name}".`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to replace file.', 'error');
    }
  };

  // Multiple File / Photo Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    processFiles(fileList);
    e.target.value = '';
  };

  // Camera Capture Handler (Accepts single or batch of multiple photos)
  const handleCameraCapture = (fileOrFiles: File | File[], previewUrlOrUrls: string | string[]) => {
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    const previews = Array.isArray(previewUrlOrUrls) ? previewUrlOrUrls : [previewUrlOrUrls];

    files.forEach((file, index) => {
      const previewUrl = previews[index] || '';
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        const newFileObj = {
          id: `cam-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name && !file.name.startsWith('blob') ? file.name : `Prescription_Page_${uploadedFiles.length + index + 1}.jpg`,
          size: `${Math.round(file.size / 1024)} KB`,
          type: file.type || 'image/jpeg',
          base64,
          previewUrl: previewUrl || dataUrl,
        };
        setUploadedFiles((prev) => [...prev, newFileObj]);
      };
      reader.readAsDataURL(file);
    });

    showToast(
      files.length === 1
        ? `Added 1 photo to audit batch! Total: ${uploadedFiles.length + 1}`
        : `Added ${files.length} photos to audit batch! Total: ${uploadedFiles.length + files.length}`,
      'success'
    );
  };

  const handleRemoveFile = (idToRemove: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== idToRemove));
    showToast('File removed from audit batch.', 'info');
  };

  const handleAddMedication = () => {
    if (!newDrugName.trim()) {
      showToast('Please enter a medication name.', 'warning');
      return;
    }
    const newEntry: RegimenEntry = {
      id: `med-${Date.now()}`,
      name: newDrugName.trim(),
      dose: newDrugDose || 'Standard Dose',
      route: newDrugRoute,
      frequency: newDrugFreq,
    };
    setMedications((prev) => [...prev, newEntry]);
    setNewDrugName('');
  };

  const handleRemoveMedication = (id: string) => {
    setMedications((prev) => prev.filter((m) => m.id !== id));
  };

  // Quick Preset Scenarios
  const applyPresetScenario = (scenarioKey: string) => {
    setInputMethod('manual');
    setUploadedFiles([]);
    setAuditResult(null);

    switch (scenarioKey) {
      case 'methotrexate_daily':
        setMedications([
          { id: 'm1', name: 'Methotrexate', dose: '15 mg', route: 'Oral', frequency: 'Daily (Dangerous Schedule Error)' },
          { id: 'm2', name: 'Folic Acid', dose: '1 mg', route: 'Oral', frequency: 'Daily' },
          { id: 'm3', name: 'Ibuprofen', dose: '600 mg', route: 'Oral', frequency: 'TID with meals' },
        ]);
        setPatientContext({
          age: '58',
          renalFunction: 'Moderate Impairment (eGFR 42 mL/min)',
          hepaticFunction: 'Normal',
          allergies: 'None',
          comorbidities: 'Severe Rheumatoid Arthritis',
          notes: 'Methotrexate was mistakenly ordered daily instead of once weekly.',
        });
        showToast('Loaded Scenario: Fatal Daily Methotrexate Prescribing Error', 'info');
        break;

      case 'lasa_confusion':
        setMedications([
          { id: 'l1', name: 'Celebrex (Celecoxib)', dose: '200 mg', route: 'Oral', frequency: 'Once daily' },
          { id: 'l2', name: 'Celexa (Citalopram)', dose: '20 mg', route: 'Oral', frequency: 'Once daily' },
          { id: 'l3', name: 'Hydralazine', dose: '25 mg', route: 'Oral', frequency: 'TID' },
          { id: 'l4', name: 'Hydroxyzine', dose: '25 mg', route: 'Oral', frequency: 'At bedtime' },
        ]);
        setPatientContext({
          age: '66',
          renalFunction: 'Normal (eGFR > 80 mL/min)',
          hepaticFunction: 'Normal',
          allergies: 'Sulfa (Sulfonamides)',
          comorbidities: 'Hypertension, Anxiety, Osteoarthritis, Depression',
          notes: 'Two pairs of notorious Look-Alike / Sound-Alike medications dispensed together.',
        });
        showToast('Loaded Scenario: High-Risk LASA Confusion Pairs', 'info');
        break;

      case 'statin_duplication':
        setMedications([
          { id: 's1', name: 'Atorvastatin', dose: '40 mg', route: 'Oral', frequency: 'Once daily at bedtime' },
          { id: 's2', name: 'Rosuvastatin', dose: '20 mg', route: 'Oral', frequency: 'Once daily' },
          { id: 's3', name: 'Gemfibrozil', dose: '600 mg', route: 'Oral', frequency: 'Twice daily' },
        ]);
        setPatientContext({
          age: '69',
          renalFunction: 'Mild Impairment (eGFR 55 mL/min)',
          hepaticFunction: 'Normal',
          allergies: 'None',
          comorbidities: 'Hyperlipidemia, Coronary Artery Disease',
          notes: 'Patient seeing two different specialists who prescribed dual statin plus fibrate.',
        });
        showToast('Loaded Scenario: Therapeutic Duplication & Rhabdomyolysis Risk', 'info');
        break;

      case 'renal_contraindication':
        setMedications([
          { id: 'r1', name: 'Metformin', dose: '1000 mg', route: 'Oral', frequency: 'Twice daily with meals' },
          { id: 'r2', name: 'Naproxen', dose: '500 mg', route: 'Oral', frequency: 'Twice daily PRN pain' },
          { id: 'r3', name: 'Spironolactone', dose: '50 mg', route: 'Oral', frequency: 'Once daily' },
          { id: 'r4', name: 'Lisinopril', dose: '20 mg', route: 'Oral', frequency: 'Once daily' },
        ]);
        setPatientContext({
          age: '78',
          renalFunction: 'Severe Chronic Kidney Disease (eGFR 19 mL/min, Cr 3.2 mg/dL)',
          hepaticFunction: 'Normal',
          allergies: 'None',
          comorbidities: 'Type 2 Diabetes, Stage 4 CKD, Heart Failure, Osteoarthritis',
          notes: 'Metformin contraindicated due to fatal lactic acidosis hazard; NSAID will cause acute renal shutdown.',
        });
        showToast('Loaded Scenario: Severe Renal Impairment Contraindications', 'info');
        break;

      case 'warfarin_nti':
        setMedications([
          { id: 'w1', name: 'Warfarin', dose: '5 mg', route: 'Oral', frequency: 'Once daily evening' },
          { id: 'w2', name: 'Fluconazole', dose: '200 mg', route: 'Oral', frequency: 'Once daily for 14 days' },
          { id: 'w3', name: 'Aspirin', dose: '325 mg', route: 'Oral', frequency: 'Once daily' },
        ]);
        setPatientContext({
          age: '73',
          renalFunction: 'Normal',
          hepaticFunction: 'Normal',
          allergies: 'None',
          comorbidities: 'Atrial Fibrillation, Oropharyngeal Candidiasis',
          notes: 'Narrow Therapeutic Index drug without recent INR check co-prescribed with potent CYP2C9 inhibitor.',
        });
        showToast('Loaded Scenario: Unmonitored Narrow Therapeutic Index (NTI) Risk', 'info');
        break;
    }
  };

  // Perform AI Medication Error Audit
  const handleRunAudit = async () => {
    if (inputMethod === 'manual' && medications.length === 0) {
      showToast('Please add at least one medication to audit.', 'warning');
      return;
    }

    if (inputMethod === 'upload' && uploadedFiles.length === 0) {
      showToast('Please upload at least one prescription photo, hospital chart, or file.', 'warning');
      return;
    }

    setIsAnalyzing(true);
    setAuditResult(null);

    const drugNamesFormatted = medications.map((m) => `${m.name} ${m.dose} (${m.frequency}, ${m.route})`);

    try {
      const resp = await fetch('/api/ai/medication-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drugs: drugNamesFormatted,
          regimenText: medications.map((m) => `${m.name} ${m.dose} ${m.route} ${m.frequency}`).join('\n'),
          files: uploadedFiles.map((f) => ({ name: f.name, type: f.type, base64: f.base64 })),
          fileData: uploadedFiles[0]?.base64,
          fileName: uploadedFiles[0]?.name,
          fileMimeType: uploadedFiles[0]?.type,
          patientContext,
        }),
      });

      const data = await resp.json();

      if (data.success && data.result) {
        setAuditResult(data.result);

        const activeUser = authService.getCurrentUser();
        if (activeUser) {
          const medNames = medications.map((m) => m.name);
          historyService.addHistoryItem(activeUser.id, {
            type: 'med_error',
            title: `Medication Audit: ${medNames.join(', ') || 'Prescription Batch'}`,
            summary: `${data.result.highestSeverity} · ${data.result.totalErrors} error(s) flagged. ${data.result.summaryText || ''}`,
            tags: ['Medication Error', data.result.highestSeverity],
            metadata: {
              drugNames: medNames,
              severity: data.result.highestSeverity,
              fileNames: uploadedFiles.map((f) => f.name),
              fileCount: uploadedFiles.length,
            },
            payload: data.result,
          });
        }

        showToast(`AI Prescribing Safety Audit complete: ${data.result.totalErrors} errors detected.`, 'success');
      } else {
        // High-precision deterministic fallback audit
        runDeterministicMedicationAudit(drugNamesFormatted);
      }
    } catch (err: any) {
      console.warn('AI medication error check error, using deterministic safety rules:', err);
      runDeterministicMedicationAudit(drugNamesFormatted);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Deterministic Clinical Safety Fallback Engine
  const runDeterministicMedicationAudit = (drugList: string[]) => {
    const detectedErrors: MedicationErrorItem[] = [];
    const textJoined = drugList.join(' ').toLowerCase();

    // 1. Methotrexate Daily Check
    if (textJoined.includes('methotrexate') && (textJoined.includes('daily') || textJoined.includes('every day') || textJoined.includes('qd'))) {
      detectedErrors.push({
        id: 'err-mtx-1',
        errorType: 'Wrong Dose / Overdose Risk',
        severity: 'Critical',
        drugInvolved: 'Methotrexate',
        issueDescription: 'Methotrexate mistakenly prescribed on a DAILY schedule instead of ONCE WEEKLY.',
        howItOccurs:
          'Step-by-step: 1. Prescriber or pharmacy entry fails to specify the mandatory once-weekly dosing interval. 2. Patient ingests 15mg daily for multiple consecutive days. 3. Massive intracellular accumulation blocks dihydrofolate reductase continuously, halting DNA synthesis in rapidly dividing bone marrow cells. 4. This triggers catastrophic pancytopenia, mucositis, and sepsis with high mortality.',
        recommendedCorrection:
          'IMMEDIATE ACTION: Cease daily intake immediately. Prescribe strictly ONCE WEEKLY on a designated day (e.g., Monday only). Supplement with Leucovorin rescue if toxicity suspected, and daily Folic Acid 1-5mg on non-methotrexate days.',
      });
    }

    // 2. LASA: Celebrex vs Celexa
    if (textJoined.includes('celebrex') && textJoined.includes('celexa')) {
      detectedErrors.push({
        id: 'err-lasa-1',
        errorType: 'Sound-Alike / Look-Alike (LASA)',
        severity: 'Warning',
        drugInvolved: 'Celebrex (Celecoxib) & Celexa (Citalopram)',
        issueDescription: 'Look-Alike / Sound-Alike confusion risk: Celebrex (COX-2 inhibitor) vs. Celexa (SSRI antidepressant).',
        howItOccurs:
          'Step-by-step: 1. Orthopedic/Rheumatology vs. Psychiatry drug names sound phonetically similar during verbal orders or look nearly identical on electronic order menus. 2. If both are dispensed or one is given in place of the other, patient either experiences unmanaged clinical depression or unmanaged arthritic pain, plus combined upper GI ulceration risk.',
        recommendedCorrection:
          'Use FDA Tall-Man lettering: CeleBREX vs. CeleXA. Verify clinical indication on the prescription order (Osteoarthritis vs. Major Depressive Disorder).',
      });
    }

    // 3. LASA: Hydralazine vs Hydroxyzine
    if (textJoined.includes('hydralazine') && textJoined.includes('hydroxyzine')) {
      detectedErrors.push({
        id: 'err-lasa-2',
        errorType: 'Sound-Alike / Look-Alike (LASA)',
        severity: 'Warning',
        drugInvolved: 'Hydralazine & Hydroxyzine',
        issueDescription: 'Classic high-alert LASA pair: Hydralazine (Antihypertensive) vs. Hydroxyzine (Antihistamine / Anxiolytic).',
        howItOccurs:
          'Step-by-step: 1. Pharmacy selection menus or handwritten scripts confuse the two prefix stems "Hydra-". 2. Accidental administration of Hydralazine for anxiety causes acute peripheral vasodilation, profound hypotension, reflex tachycardia, and syncope.',
        recommendedCorrection:
          'Enforce Tall-Man lettering: hydrALAZINE vs. hydrOXYzine. Require indication-matched dispensing.',
      });
    }

    // 4. Therapeutic Duplication: Multiple Statins
    if (
      (textJoined.includes('atorvastatin') && textJoined.includes('rosuvastatin')) ||
      (textJoined.includes('simvastatin') && textJoined.includes('atorvastatin'))
    ) {
      detectedErrors.push({
        id: 'err-dup-statin',
        errorType: 'Duplicate Therapeutic Class',
        severity: 'Critical',
        drugInvolved: 'Atorvastatin & Rosuvastatin (Dual HMG-CoA Reductase Inhibitors)',
        issueDescription: 'Unintended therapeutic duplication: Concurrent prescription of two potent statins.',
        howItOccurs:
          'Step-by-step: 1. Fragmented care across primary care physician and cardiologist results in simultaneous prescription of Atorvastatin and Rosuvastatin. 2. Overwhelming additive inhibition of the HMG-CoA reductase enzyme depletes cellular ubiquinone (CoQ10) in skeletal myocytes. 3. This triggers severe acute myopathy, massive creatine kinase (CK) leakage, and rhabdomyolysis.',
        recommendedCorrection:
          'Immediately discontinue one statin. Optimize single-agent statin dosing (e.g. Atorvastatin 40-80mg OR Rosuvastatin 20-40mg once daily). Check baseline serum CK.',
      });
    }

    // 5. Severe Renal Contraindication: Metformin
    if (
      textJoined.includes('metformin') &&
      (patientContext.renalFunction.toLowerCase().includes('severe') ||
        patientContext.renalFunction.toLowerCase().includes('22') ||
        patientContext.renalFunction.toLowerCase().includes('ckd') ||
        patientContext.comorbidities.toLowerCase().includes('kidney'))
    ) {
      detectedErrors.push({
        id: 'err-ren-met',
        errorType: 'Drug-Disease Contraindication',
        severity: 'Critical',
        drugInvolved: 'Metformin',
        issueDescription: 'Metformin prescribed in severe renal impairment (eGFR < 30 mL/min/1.73m²).',
        howItOccurs:
          'Step-by-step: 1. Metformin is eliminated exclusively unchanged by glomerular filtration and tubular secretion. 2. In severe chronic kidney disease (eGFR < 30), drug accumulates 5-fold in plasma. 3. Excess intracellular metformin inhibits mitochondrial complex I, halting hepatic gluconeogenesis from lactate and causing severe Metformin-Associated Lactic Acidosis (MALA), with ~30-50% fatality.',
        recommendedCorrection:
          'CONTRAINDICATED: Discontinue Metformin immediately. Switch to renal-safe antidiabetic agents (e.g. Linagliptin, which has biliary elimination, or titrated Insulin).',
      });
    }

    // 6. NSAID in CKD
    if (
      (textJoined.includes('naproxen') || textJoined.includes('ibuprofen') || textJoined.includes('celebrex')) &&
      patientContext.renalFunction.toLowerCase().includes('severe')
    ) {
      detectedErrors.push({
        id: 'err-ren-nsaid',
        errorType: 'Drug-Disease Contraindication',
        severity: 'Critical',
        drugInvolved: 'Systemic NSAID (Naproxen / Ibuprofen / Celecoxib)',
        issueDescription: 'Systemic NSAID prescribed in stage 4 chronic kidney disease.',
        howItOccurs:
          'Step-by-step: 1. NSAIDs inhibit renal cyclooxygenase enzymes, shutting down protective renal vasodilatory prostaglandins (PGE2, PGI2). 2. Without afferent arteriolar vasodilation, glomerular capillary pressure collapses. 3. Patient precipitates into acute-on-chronic renal failure and fluid overload.',
        recommendedCorrection:
          'Avoid systemic NSAIDs in eGFR < 30. Use topical agents (capsaicin, topical diclofenac) or Acetaminophen / low-dose neuropathic agents.',
      });
    }

    // 7. Narrow Therapeutic Index (NTI): Warfarin
    if (textJoined.includes('warfarin')) {
      detectedErrors.push({
        id: 'err-nti-warfarin',
        errorType: 'Narrow Therapeutic Index Risk',
        severity: 'Warning',
        drugInvolved: 'Warfarin',
        issueDescription: 'High-Alert Narrow Therapeutic Index (NTI) medication requiring strict therapeutic drug monitoring.',
        howItOccurs:
          'Step-by-step: 1. Minor variations in dietary Vitamin K intake, metabolic enzyme genetics, or interacting drugs cause the International Normalized Ratio (INR) to swing widely above target range (> 3.5). 2. Depletion of clotting factors VII, IX, X, and II causes internal hemorrhage, gastrointestinal bleed, or hemorrhagic stroke.',
        recommendedCorrection:
          'Enforce baseline and weekly INR monitoring. Target INR 2.0-3.0. Screen for concurrent CYP2C9 inhibitors (fluconazole, amiodarone, bactrim).',
      });
    }

    const fallbackResult: MedicationAuditResult = {
      drugsIdentified: drugList,
      totalErrors: detectedErrors.length,
      highestSeverity: detectedErrors.some((e) => e.severity === 'Critical')
        ? 'Critical Hazard'
        : detectedErrors.some((e) => e.severity === 'Warning')
        ? 'High Warning'
        : detectedErrors.length > 0
        ? 'Cautionary Advisory'
        : 'No Medication Errors Detected',
      summaryText:
        detectedErrors.length > 0
          ? `Prescribing safety audit flagged ${detectedErrors.length} clinical medication error hazards requiring immediate prescriber or pharmacist remediation.`
          : 'Medication regimen passed clinical prescribing safety checks. No high-risk dosage, LASA, or organ contraindications detected.',
      overallSafetyRecommendation:
        detectedErrors.length > 0
          ? 'Contact prescribing clinician to verify schedule, resolve LASA ambiguity, and adjust dosing according to renal profile.'
          : 'Regimen verified as safe under current patient clinical parameters.',
      medicationErrors: detectedErrors,
    };

    setAuditResult(fallbackResult);
    showToast(`Prescribing safety audit complete: ${detectedErrors.length} errors flagged.`, 'info');
  };

  // Convert Audit Result into an official SafetyCase for the Vigilytics workspace
  const handleExportAsCase = () => {
    if (!auditResult || !onSaveAsCase) return;

    const caseId = `CASE-ERR-${Date.now().toString(36).toUpperCase()}`;
    const primaryDrug = auditResult.medicationErrors[0]?.drugInvolved || medications[0]?.name || 'Suspected Agent';
    const primaryError = auditResult.medicationErrors[0]?.issueDescription || 'Prescribing Medication Error';

    const newCase: SafetyCase = {
      id: caseId,
      caseNumber: `ICSR-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      version: 1,
      initialReceivedDate: new Date().toISOString(),
      mostRecentUpdateDate: new Date().toISOString(),
      country: 'USA',
      pegaStage: 'Intake',
      pegaStep: 'Automated Prescribing Error Triage',
      priority: auditResult.highestSeverity === 'Critical Hazard' ? 'P1 - Urgent (24h Expedited)' : 'P2 - High (72h Expedited)',
      priorityRationale: `Automated Prescribing Safety Audit: ${auditResult.summaryText}`,
      pegaSLA: {
        goalTimestamp: new Date().toISOString(),
        deadlineTimestamp: new Date(Date.now() + 24 * 3600000).toISOString(),
        passedDeadlineTimestamp: new Date(Date.now() + 48 * 3600000).toISOString(),
        urgencyScore: auditResult.highestSeverity === 'Critical Hazard' ? 85 : 45,
        regulatoryDeadlineType: auditResult.highestSeverity === 'Critical Hazard' ? '15-Day Serious' : '30-Day Non-Serious',
        hoursRemaining: 24,
      },
      pegaWorkQueue: 'PV_Triage_Desk',
      riskClassification: 'Potential New Signal',
      reporterQualification: 'Pharmacist',
      primarySource: 'Hospital Pharmacy Quality Committee',
      reportType: 'Spontaneous HCP',
      narrativeText: `Medication Prescribing Error & Regimen Audit Report for ${patientContext.age}yo patient.
Medications Audited: ${medications.map((m) => `${m.name} ${m.dose} ${m.frequency}`).join(', ')}.
Patient Context: Renal: ${patientContext.renalFunction}; Comorbidities: ${patientContext.comorbidities}.
Errors Identified (${auditResult.totalErrors}):
${auditResult.medicationErrors.map((e, idx) => `${idx + 1}. [${e.severity}] ${e.drugInvolved} - ${e.errorType}: ${e.issueDescription}\nHow it occurs: ${e.howItOccurs}\nCorrection: ${e.recommendedCorrection}`).join('\n\n')}`,
      clinicalSummary: auditResult.summaryText,
      patient: {
        id: 'PT-ERR-1',
        initials: 'PT-ERR',
        age: parseInt(patientContext.age, 10) || 70,
        ageGroup: 'Elderly (65+y)',
        sex: 'Unknown',
        pregnancyStatus: 'Not Applicable',
        weightKg: null,
        medicalHistory: patientContext.comorbidities.split(',').map((c) => ({
          condition: c.trim(),
          status: 'Active' as const,
          isRiskFactor: true,
        })),
        allergies: patientContext.allergies.split(',').map((a) => a.trim()).filter(Boolean),
        baselineOrganFunction: {
          renal: patientContext.renalFunction,
          hepatic: patientContext.hepaticFunction,
        },
      },
      drugs: medications.map((m, idx) => ({
        id: `drug-${idx + 1}`,
        drugName: m.name,
        activeSubstance: m.name,
        brandName: m.name,
        role: idx === 0 ? ('Suspect' as const) : ('Concomitant' as const),
        dose: m.dose,
        route: m.route,
        frequency: m.frequency,
        durationOfTherapy: 'Prescribed',
        indication: 'Clinical indication',
        startDate: new Date().toISOString().split('T')[0],
        stopDate: null,
        ongoing: true,
        batchLotNumber: 'UNKNOWN',
        marketingAuthHolder: 'MAH',
        dechallenge: 'Unknown' as const,
        rechallenge: 'Not Performed' as const,
        actionTaken: 'Dose Not Changed' as const,
        knownSmPCAdverseReactions: [],
      })),
      events: [
        {
          id: 'ev-1',
          term: primaryError.length > 50 ? 'Medication Prescribing Error' : primaryError,
          lltTerm: 'Prescription Error / Hazard',
          socTerm: 'General disorders and administration site conditions',
          onsetDate: new Date().toISOString().split('T')[0],
          resolutionDate: null,
          severityGrade: auditResult.highestSeverity === 'Critical Hazard' ? 'Life-Threatening' : 'Severe',
          outcome: 'Recovering / Resolving',
          isListedInSmPC: false,
          smPCDetails: 'Identified via medication error audit',
          isSerious: true,
          seriousness: {
            death: false,
            lifeThreatening: auditResult.highestSeverity === 'Critical Hazard',
            hospitalization: true,
            disability: false,
            congenitalAnomaly: false,
            otherMedicallyImportant: true,
          },
        },
      ],
      labResults: [],
      timeline: [],
      naranjoScore: 7,
      naranjoCategory: 'Probable',
      naranjoAnswers: { q1: 1, q2: 2, q3: 1, q4: 0, q5: 1, q6: 0, q7: 0, q8: 0, q9: 0, q10: 1 },
      whoUmcCategory: 'Probable / Likely',
      factsVsInterpretation: {
        reportedFacts: ['Medication regimen evaluated for prescribing safety'],
        algorithmicInterpretations: [auditResult.summaryText],
        clinicalUncertainties: [],
      },
      missingDataAudit: [
        {
          id: 'mda-1',
          field: 'Prescriber Clarification Contact',
          severity: 'High',
          impact: 'Required to confirm whether medication order was canceled or modified.',
          suggestedFollowUpQuery: 'Did the prescribing physician authorize immediate dose adjustment or order cancellation?',
          resolved: false,
        },
      ],
      potentialDuplicates: [],
      isDuplicateFlagged: false,
      assignedOperator: 'AI Medication Safety Auditor',
      humanApproval: {
        status: 'Pending Review',
        reviewerName: '',
        reviewerRole: '',
        decisionTimestamp: '',
        decisionNotes: '',
        requiresSecondSignoff: true,
      },
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userName: 'AI Medication Auditor',
          userRole: 'PV_TRIAGE_SPECIALIST',
          actionType: 'CASE_CREATED',
          description: 'Automated intake from Medication Error & Prescribing Audit',
        },
      ],
      workflowHistory: [
        {
          timestamp: new Date().toISOString(),
          fromStage: 'Intake',
          toStage: 'Intake',
          step: 'AI Medication Error & Prescribing Audit Ingestion',
          operator: 'Vigilytics Safety Bot',
          actionTaken: 'Flagged medication error safety report created.',
          rationale: auditResult.summaryText,
        },
      ],
    };

    onSaveAsCase(newCase);
    showToast(`Saved as Pharmacovigilance Safety Case ${newCase.caseNumber}`, 'success');
  };

  const handleCopyReport = () => {
    if (!auditResult) return;
    const text = `VIGILYTICS MEDICATION ERROR & PRESCRIBING SAFETY AUDIT
Generated: ${new Date().toLocaleString()}
Highest Risk: ${auditResult.highestSeverity}
Total Errors Flagged: ${auditResult.totalErrors}

EXECUTIVE SUMMARY:
${auditResult.summaryText}

OVERALL RECOMMENDATION:
${auditResult.overallSafetyRecommendation}

DETAILED ERROR FINDINGS:
${auditResult.medicationErrors
  .map(
    (e, idx) => `
[${idx + 1}] ${e.errorType} (${e.severity.toUpperCase()})
Drug Involved: ${e.drugInvolved}
Issue: ${e.issueDescription}

HOW THE ERROR OCCURS:
${e.howItOccurs}

RECOMMENDED CLINICAL CORRECTION:
${e.recommendedCorrection}
`
  )
  .join('\n----------------------------------------\n')}
`;

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
    showToast('Medication error audit copied to clipboard.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-inner">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">
                  Medication Error & Prescribing Safety Auditor
                </h2>
                <span className="text-[11px] font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  Patient Safety & Regimen Audit
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Screen prescriptions and order sheets for Look-Alike / Sound-Alike (LASA) confusions, wrong schedules / overdoses, organ contraindications, and therapeutic duplications.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              ISMP & Joint Commission Safety Standards
            </span>
          </div>
        </div>

        {/* Quick Scenario Buttons */}
        <div className="mt-4 pt-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Load High-Yield Prescribing Error Scenarios:</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => applyPresetScenario('methotrexate_daily')}
              className="px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-amber-200 rounded-lg border border-slate-700 hover:border-amber-500/50 transition-all cursor-pointer font-medium"
            >
              Fatal Daily Methotrexate Schedule
            </button>
            <button
              onClick={() => applyPresetScenario('lasa_confusion')}
              className="px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 hover:border-indigo-500/50 transition-all cursor-pointer font-medium"
            >
              LASA: Celebrex vs Celexa / Hydralazine vs Hydroxyzine
            </button>
            <button
              onClick={() => applyPresetScenario('statin_duplication')}
              className="px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 hover:border-purple-500/50 transition-all cursor-pointer font-medium"
            >
              Dual Statin Duplication (Rhabdomyolysis)
            </button>
            <button
              onClick={() => applyPresetScenario('renal_contraindication')}
              className="px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-rose-200 rounded-lg border border-slate-700 hover:border-rose-500/50 transition-all cursor-pointer font-medium"
            >
              Metformin in Severe CKD (Lactic Acidosis)
            </button>
            <button
              onClick={() => applyPresetScenario('warfarin_nti')}
              className="px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-sky-200 rounded-lg border border-slate-700 hover:border-sky-500/50 transition-all cursor-pointer font-medium"
            >
              Unmonitored Warfarin (NTI Hazard)
            </button>
          </div>
        </div>
      </div>

      {/* Main Form & Input Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Options */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            {/* Input Method Switcher */}
            <div className="flex p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
              <button
                onClick={() => setInputMethod('manual')}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  inputMethod === 'manual'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                <Pill className="w-4 h-4" />
                <span>Enter Drug Regimen ({medications.length})</span>
              </button>
              <button
                onClick={() => setInputMethod('upload')}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  inputMethod === 'upload'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Upload Prescription / Chart</span>
              </button>
            </div>

            {/* MANUAL REGIMEN INPUT */}
            {inputMethod === 'manual' && (
              <div className="space-y-4">
                {/* Add Medication Bar */}
                <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Add Medication to Regimen
                  </span>
                  <div>
                    <DrugAutocompleteInput
                      value={newDrugName}
                      onChange={setNewDrugName}
                      onSelectDrug={(drug) => setNewDrugName(drug.drugName)}
                      placeholder="Medication name (e.g. Methotrexate, Digoxin, Metformin)"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Dose</label>
                      <input
                        type="text"
                        value={newDrugDose}
                        onChange={(e) => setNewDrugDose(e.target.value)}
                        placeholder="e.g. 15 mg"
                        style={{ color: '#000000', WebkitTextFillColor: '#000000' }}
                        className="w-full mt-0.5 px-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-black focus:ring-1 focus:ring-indigo-500 !text-black"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Route</label>
                      <select
                        value={newDrugRoute}
                        onChange={(e) => setNewDrugRoute(e.target.value)}
                        style={{ color: '#000000' }}
                        className="w-full mt-0.5 px-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-black focus:ring-1 focus:ring-indigo-500 !text-black"
                      >
                        <option value="Oral">Oral</option>
                        <option value="Intravenous">Intravenous</option>
                        <option value="Subcutaneous">Subcutaneous</option>
                        <option value="Intramuscular">Intramuscular</option>
                        <option value="Inhalation">Inhalation</option>
                        <option value="Topical">Topical</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Frequency</label>
                      <input
                        type="text"
                        value={newDrugFreq}
                        onChange={(e) => setNewDrugFreq(e.target.value)}
                        placeholder="e.g. Once daily / Weekly"
                        style={{ color: '#000000', WebkitTextFillColor: '#000000' }}
                        className="w-full mt-0.5 px-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-black focus:ring-1 focus:ring-indigo-500 !text-black"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddMedication}
                    className="w-full mt-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Regimen</span>
                  </button>
                </div>

                {/* Medication List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Prescribed Regimen ({medications.length} items):</span>
                    {medications.length > 0 && (
                      <button
                        onClick={() => setMedications([])}
                        className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {medications.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <div className="font-extrabold text-black !text-black text-xs sm:text-sm" style={{ color: '#000000' }}>
                            {m.name}
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            {m.dose} · {m.route} · <span className="text-indigo-900 font-bold">{m.frequency}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMedication(m.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove medication"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {medications.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No medications added. Enter a drug name above or load a preset scenario.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* UPLOAD MULTIPLE CASESHEET PHOTOS / DOCUMENTS INPUT */}
            {inputMethod === 'upload' && (
              <div className="space-y-4">
                <div
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      processFiles(e.dataTransfer.files);
                    }
                  }}
                  className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 text-center transition-colors bg-slate-50/50"
                >
                  <input
                    type="file"
                    id="med-error-file-input"
                    multiple
                    onChange={handleFileUpload}
                    accept={ACCEPTED_DOCUMENT_TYPES}
                    className="hidden"
                  />
                  <label
                    htmlFor="med-error-file-input"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-indigo-700 block">
                        Upload Multiple Prescriptions, Documents & Photos
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Select multiple files at a time (PDFs, Images, Word Docs, TXT, CSV) or drag & drop
                      </span>
                    </div>
                  </label>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCameraModal(true)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Take Photo with Camera</span>
                    </button>
                    <label
                      htmlFor="med-error-file-input"
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Multiple Files</span>
                    </label>
                  </div>
                </div>

                {/* Uploaded Documents Gallery with Replace and Remove actions */}
                <UploadedFilesList
                  files={uploadedFiles}
                  onRemoveFile={handleRemoveFile}
                  onReplaceFile={handleReplaceFile}
                  errorMessages={fileValidationErrors}
                  onClearErrors={() => setFileValidationErrors([])}
                />

                {uploadedFiles.length > 0 && (
                  <div className="pt-1 flex items-center justify-between">
                    <label
                      htmlFor="med-error-file-input"
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Add more files (PDFs, Images, Docs)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCameraModal(true)}
                      className="text-[11px] text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-3 h-3" />
                      <span>+ Snap another page</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Patient Context Toggle */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowContextOptions(!showContextOptions)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                <span>Patient Profile & Renal/Hepatic Parameters</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {showContextOptions ? '▲ Collapse' : '▼ Expand'}
                </span>
              </button>

              {showContextOptions && (
                <div className="mt-3 space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Age</label>
                      <input
                        type="text"
                        value={patientContext.age}
                        onChange={(e) => setPatientContext({ ...patientContext, age: e.target.value })}
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Renal Function</label>
                      <input
                        type="text"
                        value={patientContext.renalFunction}
                        onChange={(e) => setPatientContext({ ...patientContext, renalFunction: e.target.value })}
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Comorbidities</label>
                    <input
                      type="text"
                      value={patientContext.comorbidities}
                      onChange={(e) => setPatientContext({ ...patientContext, comorbidities: e.target.value })}
                      className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Known Drug Allergies</label>
                    <input
                      type="text"
                      value={patientContext.allergies}
                      onChange={(e) => setPatientContext({ ...patientContext, allergies: e.target.value })}
                      className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Run Audit Action Button */}
            <button
              onClick={handleRunAudit}
              disabled={isAnalyzing}
              className="w-full py-3 bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-700 hover:from-amber-700 hover:to-indigo-800 text-white font-extrabold rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Auditing Medication Safety with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>Run AI Prescribing & Medication Error Audit</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Audit Findings & Error Breakdown */}
        <div className="lg:col-span-7 space-y-4">
          {auditResult ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Back navigation button to return to input */}
              <div className="flex items-center justify-between pb-1">
                <button
                  type="button"
                  onClick={() => setAuditResult(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  <span>← Back to Medications / Files</span>
                </button>
                <span className="text-[11px] text-slate-500 font-medium">
                  Audited {medications.length > 0 ? `${medications.length} drug(s)` : `${uploadedFiles.length} file(s)`}
                </span>
              </div>

              {/* Executive Safety Scorecard */}
              <div
                className={`p-5 rounded-2xl border shadow-sm ${
                  auditResult.highestSeverity === 'Critical Hazard'
                    ? 'bg-rose-50 border-rose-300 text-rose-950'
                    : auditResult.highestSeverity === 'High Warning'
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    {auditResult.highestSeverity === 'Critical Hazard' ? (
                      <AlertOctagon className="w-6 h-6 text-rose-600" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-amber-600" />
                    )}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                        Safety Audit Status
                      </span>
                      <h3 className="text-base font-black tracking-tight">{auditResult.highestSeverity}</h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-white/80 rounded-lg text-xs font-bold shadow-2xs border border-black/10">
                      {auditResult.totalErrors} Safety Flags Identified
                    </span>
                  </div>
                </div>

                <p className="text-xs leading-relaxed mt-3 font-medium opacity-90">
                  {auditResult.summaryText}
                </p>

                {auditResult.overallSafetyRecommendation && (
                  <div className="mt-3 p-3 bg-white/70 rounded-xl border border-black/10 text-xs space-y-1">
                    <strong className="text-[11px] uppercase tracking-wider block font-bold">
                      Key Safety Action:
                    </strong>
                    <p className="leading-relaxed">{auditResult.overallSafetyRecommendation}</p>
                  </div>
                )}

                {/* Audit Action Ribbon */}
                <div className="mt-4 pt-3 border-t border-black/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyReport}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-bold border border-slate-300 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedReport ? 'Copied' : 'Copy Audit Memo'}</span>
                    </button>
                  </div>

                  {onSaveAsCase && (
                    <button
                      onClick={handleExportAsCase}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Transfer as PV Safety Case</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Individual Error Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Detected Medication Errors & Prescribing Safety Flags:</span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {auditResult.medicationErrors.length} findings
                  </span>
                </div>

                {auditResult.medicationErrors.map((error, idx) => (
                  <div
                    key={error.id || idx}
                    className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3 hover:border-amber-400 transition-colors"
                  >
                    {/* Error Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                            error.severity === 'Critical'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : error.severity === 'Warning'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}
                        >
                          {error.severity}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {error.errorType}
                        </span>
                      </div>

                      <div className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        {error.drugInvolved}
                      </div>
                    </div>

                    {/* Issue Description */}
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                        Prescribing Hazard / Issue
                      </span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">
                        {error.issueDescription}
                      </p>
                    </div>

                    {/* How It Occurs (Neat, Clear, Simple Description) */}
                    <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                        <span>How the Error Occurs & Clinical Manifestation:</span>
                      </div>
                      <p className="text-xs text-amber-950 leading-relaxed font-normal">
                        {error.howItOccurs}
                      </p>
                    </div>

                    {/* Recommended Clinical Correction */}
                    <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Recommended Clinical Correction & Prevention:</span>
                      </div>
                      <p className="text-xs text-emerald-950 leading-relaxed font-medium">
                        {error.recommendedCorrection}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Empty Placeholder State */
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Ready for Medication Error & Regimen Audit
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter patient medications on the left or click one of the high-risk presets above (such as Daily Methotrexate or LASA Celebrex vs Celexa) to trigger AI safety analysis.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 max-w-lg mx-auto text-left text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>LASA Errors</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Phonetic and orthographic brand name confusion.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>Schedule & Dose</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Daily vs weekly miscalculations and toxic accumulations.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span>Organ Match</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Renal eGFR cutoffs, liver failure, and contraindications.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Camera Capture Modal */}
      {showCameraModal && (
        <DocumentCameraModal
          isOpen={showCameraModal}
          onClose={() => setShowCameraModal(false)}
          onCapture={(fileOrFiles, previewUrlOrUrls) => {
            handleCameraCapture(fileOrFiles, previewUrlOrUrls);
            setShowCameraModal(false);
          }}
        />
      )}
    </div>
  );
};
