import React, { useState } from 'react';
import {
  Layers,
  Upload,
  Camera,
  Trash2,
  Plus,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Pill,
  RefreshCw,
  FolderPlus,
  FileText,
} from 'lucide-react';
import { DrugAutocompleteInput } from './DrugAutocompleteInput';
import { DocumentCameraModal } from './DocumentCameraModal';
import { showToast } from '../utils/toast';
import { assessPairwiseDdi, DDI_KNOWLEDGE_BASE } from '../utils/ddiEngine';
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

export interface InteractionItem {
  id: string;
  drugA: string;
  drugB: string;
  severity: 'Contraindicated / Severe' | 'Major / High Risk' | 'Moderate / Caution' | 'Minor';
  mechanismType: string;
  mechanism: string;
  simpleExplanation: string; // Neat, clear, and simple description of how interaction occurs
  clinicalAdvice: string;
  evidenceLevel: string;
  potentialAdrs: string[];
}

export interface DdiCheckerResult {
  drugsIdentified: string[];
  totalInteractions: number;
  highestSeverity: string;
  summaryText: string;
  interactions: InteractionItem[];
  overallSafetyRecommendation: string;
}

interface DrugInteractionCheckerProps {
  onSaveAsCase?: (safetyCase: SafetyCase) => void;
}

export const DrugInteractionChecker: React.FC<DrugInteractionCheckerProps> = ({
  onSaveAsCase,
}) => {
  // Input Method: Manual typing vs Uploading a File / Camera Scan
  const [inputMethod, setInputMethod] = useState<'manual' | 'upload'>('manual');

  // Drug List for Manual Input
  const [drugs, setDrugs] = useState<string[]>([]);
  const [newDrugInput, setNewDrugInput] = useState('');

  // Patient Clinical Context
  const [patientContext, setPatientContext] = useState({
    age: '65',
    renalImpairment: false,
    hepaticImpairment: false,
    pregnant: false,
    allergies: '',
    clinicalNotes: '',
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

  // Document Camera Modal State
  const [showCameraModal, setShowCameraModal] = useState(false);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<DdiCheckerResult | null>(null);
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
        const item = await readFileToUploadItem(file, 'ddi');
        setUploadedFiles((prev) => [...prev, item]);
      } catch (err: any) {
        setFileValidationErrors((prev) => [...prev, err.message || `Failed to read ${file.name}`]);
      }
    }

    showToast(`Loaded ${validation.validFiles.length} file(s) (PDFs/Images) for DDI screening.`, 'success');
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
      const newItem = await readFileToUploadItem(newFile, 'ddi-rep');
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
          id: `camera-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name && !file.name.startsWith('blob') ? file.name : `Casesheet_Photo_Page_${uploadedFiles.length + index + 1}.jpg`,
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
        ? `Added 1 photo to DDI screening batch! Total: ${uploadedFiles.length + 1}`
        : `Added ${files.length} photos to DDI screening batch! Total: ${uploadedFiles.length + files.length}`,
      'success'
    );
  };

  const handleRemoveFile = (idToRemove: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== idToRemove));
    showToast('File removed from screening batch.', 'info');
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
  const loadPreset = (presetDrugs: string[], renal = false, hepatic = false, notes = '') => {
    setDrugs(presetDrugs);
    setUploadedFiles([]);
    setInputMethod('manual');
    setPatientContext({
      ...patientContext,
      renalImpairment: renal,
      hepaticImpairment: hepatic,
      clinicalNotes: notes,
    });
    setAnalysisResult(null);
    showToast(`Loaded DDI preset: ${presetDrugs.join(' + ')}`, 'info');
  };

  // Run AI & Algorithmic Screening
  const handleRunScreen = async () => {
    if (inputMethod === 'manual' && drugs.length < 2) {
      showToast('Please add at least two medications to screen for drug-drug interactions.', 'warning');
      return;
    }
    if (inputMethod === 'upload' && uploadedFiles.length === 0) {
      showToast('Please select or scan at least one casesheet photo/file first.', 'warning');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/ddi/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drugs: inputMethod === 'manual' ? drugs : [],
          files: uploadedFiles.map((f) => ({ name: f.name, type: f.type, base64: f.base64 })),
          fileData: uploadedFiles[0]?.base64,
          fileMimeType: uploadedFiles[0]?.type,
          fileName: uploadedFiles[0]?.name,
          patientContext,
          checkMode: 'ddi_only',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          const resObj = {
            drugsIdentified: data.result.drugsIdentified || [],
            totalInteractions: data.result.totalInteractions || (data.result.interactions?.length || 0),
            highestSeverity: data.result.highestSeverity || 'Regimen Compatible',
            summaryText: data.result.summaryText || 'Screening completed.',
            interactions: data.result.interactions || [],
            overallSafetyRecommendation: data.result.overallSafetyRecommendation || 'Monitor therapy.',
          };
          setAnalysisResult(resObj);
          if (inputMethod === 'upload' && Array.isArray(data.result.drugsIdentified) && data.result.drugsIdentified.length > 0) {
            setDrugs(data.result.drugsIdentified);
          }

          // Save to user private history if user is authenticated
          const activeUser = authService.getCurrentUser();
          if (activeUser) {
            const drugListStr = (data.result.drugsIdentified || drugs).join(', ');
            historyService.addHistoryItem(activeUser.id, {
              type: 'ddi_check',
              title: `DDI Screen: ${drugListStr || 'Prescription Regimen'}`,
              summary: `${resObj.highestSeverity} · Found ${resObj.totalInteractions} interaction(s). ${resObj.summaryText}`,
              tags: ['DDI', resObj.highestSeverity],
              metadata: {
                drugNames: data.result.drugsIdentified || drugs,
                severity: resObj.highestSeverity,
                fileNames: uploadedFiles.map((f) => f.name),
                fileCount: uploadedFiles.length,
              },
              payload: resObj,
            });
          }

          showToast(
            `AI DDI Screening Complete: Found ${resObj.totalInteractions} interaction(s).`,
            'success'
          );
          return;
        }
      }

      // Local Deterministic Clinical Engine Fallback
      const localResult = runLocalClinicalFallback(drugs);
      setAnalysisResult(localResult);

      const activeUser = authService.getCurrentUser();
      if (activeUser) {
        historyService.addHistoryItem(activeUser.id, {
          type: 'ddi_check',
          title: `DDI Screen: ${drugs.join(', ')}`,
          summary: `${localResult.highestSeverity} · ${localResult.totalInteractions} interaction(s) found.`,
          tags: ['DDI', localResult.highestSeverity],
          metadata: { drugNames: drugs, severity: localResult.highestSeverity },
          payload: localResult,
        });
      }

      showToast(
        `DDI screening completed using Clinical Pharmacology Engine. Found ${localResult.totalInteractions} interaction(s).`,
        'info'
      );
    } catch (err: any) {
      console.warn('API error, using local clinical engine fallback:', err);
      const localResult = runLocalClinicalFallback(drugs);
      setAnalysisResult(localResult);
      showToast('Screening completed with offline Clinical Pharmacology Engine.', 'info');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Local Clinical Engine Fallback
  const runLocalClinicalFallback = (drugList: string[]): DdiCheckerResult => {
    const interactions: InteractionItem[] = [];

    for (let i = 0; i < drugList.length; i++) {
      for (let j = i + 1; j < drugList.length; j++) {
        const dA = drugList[i];
        const dB = drugList[j];
        const rule = assessPairwiseDdi(dA, dB);
        if (rule && rule.hasInteraction) {
          const matchingRule = DDI_KNOWLEDGE_BASE.find(
            (r) =>
              (r.drugAKeywords.some((k) => dA.toLowerCase().includes(k)) &&
                r.drugBKeywords.some((k) => dB.toLowerCase().includes(k))) ||
              (r.drugAKeywords.some((k) => dB.toLowerCase().includes(k)) &&
                r.drugBKeywords.some((k) => dA.toLowerCase().includes(k)))
          );
          const typicalAdrs = matchingRule?.typicalAdrs || ['Adverse Reaction', 'Toxicity Risk'];

          let simpleExplanation = '';
          if (rule.mechanismType.includes('CYP450')) {
            simpleExplanation = `Step-by-step: 1. ${dB} shuts down the liver enzyme (${rule.cypOrTarget || 'CYP450'}) required to clear ${dA}. 2. Because ${dA} cannot be broken down, its concentration in the blood surges (often 5x to 10x higher). 3. This massive buildup damages vital tissues, causing acute toxic complications such as ${typicalAdrs[0] || 'severe organ toxicity'}.`;
          } else if (rule.mechanismType.includes('Additive') || rule.mechanismType.includes('Synergistic')) {
            simpleExplanation = `Step-by-step: 1. Both ${dA} and ${dB} attack the same physiological pathway (${rule.cypOrTarget || 'synergistic toxicity'}). 2. When taken concurrently, their harmful effects multiply exponentially rather than just adding up. 3. This dramatically escalates the probability of ${typicalAdrs[0] || 'severe hemorrhage or depression'}.`;
          } else if (rule.mechanismType.includes('Renal')) {
            simpleExplanation = `Step-by-step: 1. ${dB} competes with and blocks kidney tubular filtration pumps that eliminate ${dA}. 2. ${dA} cannot be flushed out in urine and accumulates dangerously in the kidneys and blood. 3. This leads to acute renal insufficiency and drug poisoning.`;
          } else {
            simpleExplanation = `Step-by-step: 1. When administered together, ${dB} alters how ${dA} is absorbed, distributed, or cleared. 2. Blood levels become unpredictable. 3. ${rule.mechanism}`;
          }

          interactions.push({
            id: `int-${i}-${j}`,
            drugA: dA,
            drugB: dB,
            severity:
              rule.severity === 'Contraindicated / Severe'
                ? 'Contraindicated / Severe'
                : rule.severity === 'Major / High Risk'
                ? 'Major / High Risk'
                : 'Moderate / Caution',
            mechanismType: rule.mechanismType,
            mechanism: rule.mechanism,
            simpleExplanation,
            clinicalAdvice: rule.clinicalAdvice,
            evidenceLevel: rule.evidenceLevel,
            potentialAdrs: typicalAdrs.slice(0, 4),
          });
        }
      }
    }

    const highestSeverity = interactions.some((i) => i.severity === 'Contraindicated / Severe')
      ? 'Contraindicated / Severe'
      : interactions.some((i) => i.severity === 'Major / High Risk')
      ? 'Major / High Risk'
      : interactions.length > 0
      ? 'Moderate / Caution'
      : 'Regimen Compatible';

    return {
      drugsIdentified: drugList,
      totalInteractions: interactions.length,
      highestSeverity,
      summaryText:
        interactions.length > 0
          ? `Screened ${drugList.length} medications. Identified ${interactions.length} significant drug-drug interaction(s).`
          : `Screened ${drugList.length} medications. No established high-risk pharmacokinetic or pharmacodynamic interactions identified.`,
      interactions,
      overallSafetyRecommendation:
        interactions.some((i) => i.severity === 'Contraindicated / Severe')
          ? 'URGENT CLINICAL REVIEW REQUIRED: Regimen contains contraindicated combination. Suspend or substitute therapy immediately before administration.'
          : interactions.length > 0
          ? 'CAUTION ADVISED: Clinical monitoring advised. Space administration times, check labs/vitals, and instruct patient on red-flag warning signs.'
          : 'REGIMEN COMPATIBLE: No known high-impact pharmacokinetic or pharmacodynamic interactions among evaluated agents.',
    };
  };

  // Copy Plain Text Report to Clipboard
  const handleCopyReport = () => {
    if (!analysisResult) return;
    const lines: string[] = [
      '====================================================',
      'VIGILYTICS PHARMACOVIGILANCE SAFETY REPORT',
      'DRUG-DRUG INTERACTIONS SCREENING DOSSIER',
      '====================================================',
      `Date: ${new Date().toLocaleString()}`,
      `Screened Regimen: ${analysisResult.drugsIdentified.join(', ')}`,
      `Overall Status: ${analysisResult.highestSeverity}`,
      `Total Interactions: ${analysisResult.totalInteractions}`,
      `Summary: ${analysisResult.summaryText}`,
      `Safety Recommendation: ${analysisResult.overallSafetyRecommendation}`,
      '',
      '--- DRUG-DRUG INTERACTIONS (HOW INTERACTIONS OCCUR) ---',
    ];

    if (analysisResult.interactions.length === 0) {
      lines.push('No significant drug-drug interactions detected.');
    } else {
      analysisResult.interactions.forEach((int, idx) => {
        lines.push(`\n[#${idx + 1}] ${int.drugA} + ${int.drugB} (${int.severity})`);
        lines.push(`HOW IT OCCURS: ${int.simpleExplanation}`);
        lines.push(`Mechanism Type: ${int.mechanismType}`);
        lines.push(`Pharmacological Detail: ${int.mechanism}`);
        lines.push(`Clinical Advice & Safer Alternative: ${int.clinicalAdvice}`);
        if (int.potentialAdrs?.length) {
          lines.push(`ADRs to Monitor: ${int.potentialAdrs.join(', ')}`);
        }
      });
    }

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedReport(true);
    showToast('DDI screening report copied to clipboard!', 'success');
    setTimeout(() => setCopiedReport(false), 3000);
  };

  // Transfer Finding to Pharmacovigilance Workspace as a Case
  const handleTransferToWorkspace = () => {
    if (!analysisResult) return;
    const suspectDrug = analysisResult.interactions[0]?.drugA || analysisResult.drugsIdentified[0] || 'Unknown Drug';
    const primaryReaction =
      analysisResult.interactions[0]?.potentialAdrs?.[0] || 'Suspected Drug-Drug Interaction Reaction';

    const isSerious = analysisResult.highestSeverity === 'Contraindicated / Severe';

    const newSafetyCase: SafetyCase = {
      id: `case-ddi-${Date.now()}`,
      caseNumber: `ICSR-DDI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      version: 1,
      initialReceivedDate: new Date().toISOString().split('T')[0],
      mostRecentUpdateDate: new Date().toISOString().split('T')[0],
      country: 'Global Safety Network',
      reporterQualification: 'Physician',
      reportType: 'Spontaneous HCP',
      primarySource: 'Clinical Investigation',
      priority: isSerious ? 'P1 - Urgent (24h Expedited)' : 'P3 - Medium (7d Standard)',
      priorityRationale: `Automated intake from Drug-Drug Interaction Screening: ${analysisResult.summaryText}`,
      riskClassification: 'Known Labeled Risk',
      naranjoScore: isSerious ? 6 : 4,
      naranjoCategory: isSerious ? 'Probable' : 'Possible',
      naranjoAnswers: { q1: 1, q2: 2, q3: 1, q4: 0, q5: 1 },
      whoUmcCategory: isSerious ? 'Probable / Likely' : 'Possible',
      narrativeText: `Safety case generated from Vigilytics AI Drug-Drug Interaction Checker.\nScreened Regimen: ${analysisResult.drugsIdentified.join(', ')}.\nIdentified Interactions: ${analysisResult.totalInteractions}.\nSummary: ${analysisResult.summaryText}\nAction Advice: ${analysisResult.overallSafetyRecommendation}`,
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
        id: `pat-ddi-${Date.now()}`,
        initials: 'PT-DDI',
        age: parseInt(patientContext.age, 10) || 65,
        ageGroup: (parseInt(patientContext.age, 10) || 65) >= 65 ? 'Elderly (65+y)' : 'Adult (18-64y)',
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
        name: 'Clinical Safety Officer',
        qualification: 'Physician',
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
          socTerm: 'General disorders and administration site conditions',
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
          smPCDetails: 'Reported in product monograph safety section',
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
          description: 'Automated intake from Drug-Drug Interaction Screening',
        },
      ],
      workflowHistory: [
        {
          timestamp: new Date().toISOString(),
          fromStage: 'Intake',
          toStage: 'Triage',
          step: 'Initial Case Intake',
          operator: 'AI Drug Interaction Engine',
          actionTaken: 'Automated Case Intake from DDI Screening',
          rationale: 'Severe interaction flagged for pharmacovigilance oversight.',
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
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white border border-indigo-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Dedicated AI Drug-Drug Interaction Intelligence</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Drug-Drug Interaction (DDI) Checker</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Screen multi-drug combinations by typing medications or uploading hospital prescriptions & medication charts. Vigilytics AI delivers a <strong>neat, clear, and simple description of exactly how each interaction will occur</strong>, enzyme pathways, and safer clinical alternatives.
            </p>
          </div>

          {/* Quick Preset Selector Buttons */}
          <div className="flex flex-col gap-2 self-start md:self-center shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Quick DDI Scenarios:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => loadPreset(['Simvastatin', 'Clarithromycin'], false, false, 'Patient with high LDL')}
                className="px-2.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
                title="Statin + Macrolide: CYP3A4 blockade & rhabdomyolysis"
              >
                Statin + Macrolide
              </button>
              <button
                type="button"
                onClick={() => loadPreset(['Warfarin', 'Fluconazole', 'Aspirin'], false, false, 'supratherapeutic INR bleed')}
                className="px-2.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
                title="Warfarin + Fluconazole + Aspirin: Catastrophic hemorrhage risk"
              >
                Warfarin Hemorrhage
              </button>
              <button
                type="button"
                onClick={() => loadPreset(['Methotrexate', 'Ibuprofen'], false, false, 'Renal clearance block')}
                className="px-2.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
                title="Methotrexate + NSAID: Bone marrow suppression"
              >
                Methotrexate + NSAID
              </button>
              <button
                type="button"
                onClick={() => loadPreset(['Ciprofloxacin', 'Theophylline'], false, false, 'CYP1A2 inhibition')}
                className="px-2.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
                title="Ciprofloxacin + Theophylline: Seizures"
              >
                Quinolone + Theophylline
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
                      ? 'bg-white text-indigo-700 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Pill className="w-3.5 h-3.5" />
                  <span>Enter Drugs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMethod('upload')}
                  className={`flex-1 py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    inputMethod === 'upload'
                      ? 'bg-white text-indigo-700 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File / Scan</span>
                </button>
              </div>
            </div>

            {/* INPUT METHOD 1: MANUAL DRUG LIST ENTRY */}
            {inputMethod === 'manual' && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Add Medication (Global Clinical Formulary)
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <DrugAutocompleteInput
                        value={newDrugInput}
                        onChange={setNewDrugInput}
                        onSelectDrug={(item) => handleAddDrug(item.drugName)}
                        placeholder="Type medication name (e.g. Warfarin, Simvastatin, Paxlovid, Digoxin)..."
                        className="w-full text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddDrug()}
                      disabled={!newDrugInput.trim()}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Drug Pills List */}
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
                    <span>Current Regimen to Screen ({drugs.length} medications)</span>
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
                      No drugs added yet. Use the autocomplete search above to add at least 2 medications, or pick a Quick Scenario above.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {drugs.map((drug, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-900 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-extrabold text-black !text-black text-xs sm:text-sm" style={{ color: '#000000' }}>
                              {drug}
                            </span>
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

            {/* INPUT METHOD 2: MULTIPLE FILE UPLOAD OR MULTIPLE CAMERA SCANS */}
            {inputMethod === 'upload' && (
              <div className="space-y-3.5">
                <div
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      processFiles(e.dataTransfer.files);
                    }
                  }}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-5 text-center bg-slate-50/60 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 mx-auto flex items-center justify-center mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-xs text-slate-800">
                    Upload Multiple Casesheet Photos, Prescriptions & EHR Charts
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    Select <strong>multiple files at a time</strong> (PDFs, Images, Word Docs, TXT, CSV) or drag & drop files here. All pages and documents are screened together by Multimodal AI.
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

                    <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Multiple Files (PDFs, Images, Docs)</span>
                      <input
                        type="file"
                        multiple
                        accept={ACCEPTED_DOCUMENT_TYPES}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
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
                    <label className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer">
                      <Plus className="w-3 h-3" />
                      <span>+ Add more files (PDFs, Images, Docs)</span>
                      <input
                        type="file"
                        multiple
                        accept={ACCEPTED_DOCUMENT_TYPES}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
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

            {/* Optional Patient Context / Organ Impairment Modifiers */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowContextOptions(!showContextOptions)}
                className="flex items-center justify-between w-full text-xs font-bold text-slate-700 hover:text-indigo-600 transition-colors py-1 cursor-pointer"
              >
                <span>Patient Clinical Context & Organ Impairment (Optional)</span>
                <span className="text-[11px] text-indigo-600">{showContextOptions ? 'Hide ▲' : 'Show ▼'}</span>
              </button>

              {showContextOptions && (
                <div className="mt-2.5 space-y-2.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={patientContext.renalImpairment}
                        onChange={(e) => setPatientContext({ ...patientContext, renalImpairment: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      <span className="text-[11px] font-semibold text-slate-700">Renal Impairment (eGFR &lt; 30)</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={patientContext.hepaticImpairment}
                        onChange={(e) => setPatientContext({ ...patientContext, hepaticImpairment: e.target.checked })}
                        className="rounded text-indigo-600"
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
                        placeholder="e.g. 68"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pregnancy Status</label>
                      <label className="flex items-center gap-2 p-1.5 bg-white border border-slate-200 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={patientContext.pregnant}
                          onChange={(e) => setPatientContext({ ...patientContext, pregnant: e.target.checked })}
                          className="rounded text-indigo-600"
                        />
                        <span className="text-[11px] text-slate-700 font-medium">Pregnant / Lactating</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Allergies / Special Notes</label>
                    <input
                      type="text"
                      value={patientContext.allergies}
                      onChange={(e) => setPatientContext({ ...patientContext, allergies: e.target.value })}
                      placeholder="e.g. Penicillin allergy, history of peptic ulcer..."
                      className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Run AI DDI Screening Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRunScreen}
                disabled={
                  isAnalyzing ||
                  (inputMethod === 'manual' && drugs.length < 2) ||
                  (inputMethod === 'upload' && uploadedFiles.length === 0)
                }
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 disabled:from-slate-300 disabled:to-slate-300 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Analyzing Drug-Drug Interactions with AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Run AI Drug-Drug Interaction Screen</span>
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
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                <Layers className="w-7 h-7" />
              </div>
              <h3 className="font-black text-slate-800 text-base">Awaiting Medications to Screen</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Add at least two medications on the left or upload a prescription or clinical note. Vigilytics AI will explain <strong>how each interaction occurs in neat, clear, and simple terms</strong>, its biochemical pathway, and safe clinical alternatives.
              </p>
            </div>
          )}

          {isAnalyzing && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <div className="font-black text-sm text-slate-900">
                Evaluating Pharmacokinetics, Enzyme Blockades & Transporters...
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Analyzing CYP450 metabolism pathways, P-gp transporter competition, additive bleeding, and QT prolongation synergy.
              </p>
            </div>
          )}

          {analysisResult && !isAnalyzing && (
            <div className="space-y-4">
              {/* Back navigation button to return to input */}
              <div className="flex items-center justify-between pb-1">
                <button
                  type="button"
                  onClick={() => setAnalysisResult(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  <span>← Back to Medications / Files</span>
                </button>
                <span className="text-[11px] text-slate-500 font-medium">
                  Screened {analysisResult.drugsIdentified?.length || drugs.length} drug(s)
                </span>
              </div>

              {/* Overall Executive Safety Status Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3.5 shadow-2xs ${
                  analysisResult.highestSeverity === 'Contraindicated / Severe'
                    ? 'bg-rose-50 border-rose-300 text-rose-950'
                    : analysisResult.highestSeverity === 'Major / High Risk'
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : analysisResult.totalInteractions > 0
                    ? 'bg-sky-50 border-sky-300 text-sky-950'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                }`}
              >
                {analysisResult.highestSeverity === 'Contraindicated / Severe' ? (
                  <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                ) : analysisResult.highestSeverity === 'Major / High Risk' ? (
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
                        {analysisResult.totalInteractions} Interaction(s) Detected
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
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
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
                    <strong>Clinical Recommendation:</strong> {analysisResult.overallSafetyRecommendation}
                  </div>
                </div>
              </div>

              {/* Identified Regimen Drugs Pills */}
              {analysisResult.drugsIdentified?.length > 0 && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-2 flex-wrap text-xs shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Evaluated Regimen:
                  </span>
                  {analysisResult.drugsIdentified.map((d, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-indigo-50 text-indigo-800 rounded-lg font-bold border border-indigo-200 text-xs flex items-center gap-1"
                    >
                      <Pill className="w-3 h-3 text-indigo-600" />
                      <span>{d}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* DRUG-DRUG INTERACTIONS (HOW IT OCCURS IN NEAT, CLEAR, SIMPLE TERMS) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-black text-xs text-slate-800 uppercase tracking-wider">
                      Drug-Drug Interactions ({analysisResult.interactions.length})
                    </h3>
                  </div>
                  <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    Step-by-Step Simple Breakdown
                  </span>
                </div>

                {analysisResult.interactions.length === 0 ? (
                  <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>No adverse drug-drug interactions detected among the evaluated medications.</span>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {analysisResult.interactions.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border text-xs space-y-3 ${
                          item.severity === 'Contraindicated / Severe'
                            ? 'bg-rose-50/40 border-rose-200'
                            : item.severity === 'Major / High Risk'
                            ? 'bg-amber-50/40 border-amber-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {/* Drug Pair & Severity Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 font-black text-slate-900 shadow-2xs">
                              {item.drugA}
                            </span>
                            <span className="text-slate-400 font-bold">+</span>
                            <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 font-black text-slate-900 shadow-2xs">
                              {item.drugB}
                            </span>
                          </div>

                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                              item.severity === 'Contraindicated / Severe'
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : item.severity === 'Major / High Risk'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-slate-200 text-slate-800 border-slate-300'
                            }`}
                          >
                            {item.severity}
                          </span>
                        </div>

                        {/* HOW THE INTERACTION WILL OCCUR: NEAT, CLEAR, SIMPLE EXPLANATION */}
                        <div className="p-3.5 bg-white rounded-xl border border-indigo-200 shadow-2xs space-y-1.5">
                          <div className="flex items-center gap-1.5 text-indigo-700 font-extrabold text-[11px] uppercase tracking-wider">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>How This Interaction Occurs (Simple Explanation):</span>
                          </div>
                          <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                            {item.simpleExplanation}
                          </p>
                        </div>

                        {/* Technical Pharmacological Details */}
                        <div className="text-[11px] text-slate-600 space-y-1">
                          <div className="font-bold text-slate-700">
                            Pharmacological Details: <span className="font-normal text-slate-600">{item.mechanism}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span><strong>Mechanism Type:</strong> {item.mechanismType}</span>
                            {item.evidenceLevel && (
                              <span className="text-[10px] text-slate-500 font-medium">({item.evidenceLevel})</span>
                            )}
                          </div>

                          {item.potentialAdrs?.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              <strong className="text-[10px] text-slate-700">Adverse Reactions to Watch:</strong>
                              {item.potentialAdrs.map((adr, aIdx) => (
                                <span
                                  key={aIdx}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 text-slate-800 font-semibold"
                                >
                                  {adr}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Clinical Advice */}
                        <div className="pt-2 border-t border-slate-200/80 flex items-start gap-1.5 text-[11px]">
                          <strong className="text-slate-800 shrink-0">Clinical Action & Alternatives:</strong>
                          <span className="text-slate-700 font-medium">{item.clinicalAdvice}</span>
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
        title="Scan Prescription / Drug Chart for Interaction Check"
      />
    </div>
  );
};
