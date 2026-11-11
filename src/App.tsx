import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Plus,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  FileCheck,
  ChevronRight,
  Database,
  Pill,
  HeartPulse,
  Upload,
  Download,
  Trash2,
  FileText,
  RotateCcw,
  Bot,
  Smartphone,
  Laptop,
  PanelLeftClose,
  PanelRightClose,
  PanelLeft,
  PanelRight,
} from 'lucide-react';
import { SafetyCase, PvStage, SignalMetric } from './types/pv';
import {
  INITIAL_SAFETY_CASES,
  INITIAL_SIGNALS,
  SAMPLE_SAFETY_CASES,
  SAMPLE_ACTIVE_SIGNALS,
} from './data/mockPvData';
import { evaluateCaseDdiSummary } from './utils/ddiEngine';
import { showToast } from './utils/toast';
import { ToastContainer } from './components/ToastContainer';
import { SafetyEscalationBanner } from './components/SafetyEscalationBanner';
import { PvWorkflowBar } from './components/PvWorkflowBar';
import { CaseDetailView } from './components/CaseDetailView';
import { CaseIntakeModal } from './components/CaseIntakeModal';
import { PvAgentConsole } from './components/PvAgentConsole';
import { DrugInteractionChecker } from './components/DrugInteractionChecker';
import { MedicationErrorChecker } from './components/MedicationErrorChecker';
import { DailyCasesheetAnalysis } from './components/DailyCasesheetAnalysis';
import { AerixAssistant } from './components/AerixAssistant';
import { AuthModal } from './components/AuthModal';
import { UserProfileHistoryModal } from './components/UserProfileHistoryModal';
import { MobileAppView } from './components/MobileAppView';
import { useDeviceMode } from './hooks/useDeviceMode';
import { authService } from './services/authService';
import { historyService } from './services/historyService';
import { AppUser } from './types/auth';
import { useAppNavigation } from './hooks/useAppNavigation';

export interface FastMedication {
  id: string;
  drugName: string;
  dose: string;
  frequency: string;
}

export const PRESET_SCENARIOS = [
  {
    id: 'methotrexate',
    name: 'Daily Methotrexate Hazard',
    subtitle: 'Fatal daily schedule vs weekly protocol',
    meds: [
      { id: 'sc-1', drugName: 'Methotrexate', dose: '15 mg', frequency: 'Daily (Dosing Error - Should be Weekly)' },
      { id: 'sc-2', drugName: 'Folic Acid', dose: '5 mg', frequency: 'Weekly' },
    ],
    targetView: 'med_errors' as const,
    warning: 'Severe Prescribing Error: Inadvertent daily administration of methotrexate instead of weekly dosing triggers fatal myelosuppression and severe mucositis.',
  },
  {
    id: 'lasa',
    name: 'LASA Identification Audit',
    subtitle: 'Hydralazine vs Hydroxyzine mix-up',
    meds: [
      { id: 'sc-3', drugName: 'Hydralazine', dose: '25 mg', frequency: 'TID' },
      { id: 'sc-4', drugName: 'Hydroxyzine', dose: '25 mg', frequency: 'HS' },
    ],
    targetView: 'med_errors' as const,
    warning: 'Look-Alike Sound-Alike Alert: Confusion between arterial vasodilator Hydralazine and antihistamine/anxiolytic Hydroxyzine.',
  },
  {
    id: 'statin',
    name: 'Dual Statin Toxicity',
    subtitle: 'Atorvastatin + Gemfibrozil rhabdomyolysis',
    meds: [
      { id: 'sc-5', drugName: 'Atorvastatin', dose: '40 mg', frequency: 'Daily' },
      { id: 'sc-6', drugName: 'Gemfibrozil', dose: '600 mg', frequency: 'BID' },
    ],
    targetView: 'ddi' as const,
    warning: 'Severe DDI Hazard: Concomitant Atorvastatin + Gemfibrozil dramatically elevates systemic statin exposure, inducing acute rhabdomyolysis.',
  },
  {
    id: 'metformin',
    name: 'Metformin Renal Cutoff',
    subtitle: 'Metformin in severe CKD (eGFR < 30)',
    meds: [
      { id: 'sc-7', drugName: 'Metformin', dose: '1000 mg', frequency: 'BID' },
      { id: 'sc-8', drugName: 'Lisinopril', dose: '20 mg', frequency: 'Daily' },
    ],
    targetView: 'med_errors' as const,
    warning: 'Contraindication Alert: Metformin contraindicated with eGFR < 30 mL/min due to life-threatening lactic acidosis hazard.',
  },
  {
    id: 'warfarin',
    name: 'Warfarin Monitoring',
    subtitle: 'Warfarin + Fluconazole CYP2C9 inhibition',
    meds: [
      { id: 'sc-9', drugName: 'Warfarin', dose: '5 mg', frequency: 'Daily' },
      { id: 'sc-10', drugName: 'Fluconazole', dose: '200 mg', frequency: 'Daily' },
    ],
    targetView: 'ddi' as const,
    warning: 'Critical CYP2C9 Interaction: Fluconazole potently inhibits S-warfarin breakdown, precipitating supratherapeutic INR and hemorrhage.',
  },
];

export default function App() {
  // Authentication session
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => authService.getCurrentUser());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Subscribe to auth changes
  useEffect(() => {
    const unsub = authService.subscribe((session) => {
      setCurrentUser(session.user);
    });
    return unsub;
  }, []);

  // Determine user-scoped storage key
  const userStorageSuffix = currentUser ? `_${currentUser.id}` : '';
  const casesStorageKey = `vigilytics_user_cases${userStorageSuffix}`;
  const signalsStorageKey = `vigilytics_user_signals${userStorageSuffix}`;

  // Load saved cases from localStorage or start with default
  const [cases, setCases] = useState<SafetyCase[]>(() => {
    try {
      const u = authService.getCurrentUser();
      const key = `vigilytics_user_cases${u ? `_${u.id}` : ''}`;
      const saved = localStorage.getItem(key) || localStorage.getItem('vigilytics_user_cases') || localStorage.getItem('aegispv_user_cases');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load saved cases', e);
    }
    return INITIAL_SAFETY_CASES;
  });

  // Reload cases when user logs in/out to enforce user data privacy isolation
  useEffect(() => {
    try {
      const key = `vigilytics_user_cases${currentUser ? `_${currentUser.id}` : ''}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCases(parsed);
          setSelectedCaseId(parsed[0]?.id || null);
          return;
        }
      }
      if (currentUser) {
        // Fresh account starts with empty or sample based on user's preference
        setCases([]);
        setSelectedCaseId(null);
      } else {
        setCases(INITIAL_SAFETY_CASES);
        setSelectedCaseId(INITIAL_SAFETY_CASES[0]?.id || null);
      }
    } catch (e) {
      console.error('Failed to switch user cases storage', e);
    }
  }, [currentUser?.id]);

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => {
    return cases[0]?.id || null;
  });

  // Load saved signals from localStorage
  const [signals, setSignals] = useState<SignalMetric[]>(() => {
    try {
      const u = authService.getCurrentUser();
      const key = `vigilytics_user_signals${u ? `_${u.id}` : ''}`;
      const saved = localStorage.getItem(key) || localStorage.getItem('vigilytics_user_signals') || localStorage.getItem('aegispv_user_signals');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load saved signals', e);
    }
    return INITIAL_SIGNALS;
  });

  // Active Main Navigation View
  const [activeView, setActiveView] = useState<'agent' | 'cases' | 'ddi' | 'med_errors' | 'casesheet'>('agent');

  // Case Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  // Modals
  const [showIntakeModal, setShowIntakeModal] = useState(false);

  // High Density Dashboard Panes & Fast Regimen State
  const [showLeftPane, setShowLeftPane] = useState(true);
  const [showRightPane, setShowRightPane] = useState(true);
  const [fastRegimen, setFastRegimen] = useState<FastMedication[]>([
    { id: 'fast-1', drugName: 'Methotrexate', dose: '15 mg', frequency: 'Weekly' },
    { id: 'fast-2', drugName: 'Atorvastatin', dose: '40 mg', frequency: 'Daily' },
  ]);
  const [fastDrugName, setFastDrugName] = useState('');
  const [fastDose, setFastDose] = useState('Standard');
  const [fastFrequency, setFastFrequency] = useState('Daily');

  const handleLoadScenario = (sc: typeof PRESET_SCENARIOS[0]) => {
    setFastRegimen(sc.meds);
    setActiveView(sc.targetView);
    showToast(`Loaded "${sc.name}". ${sc.warning}`, 'info');
  };

  const handleAppendFastMed = () => {
    if (!fastDrugName.trim()) {
      showToast('Enter a drug name to append to the regimen.', 'info');
      return;
    }
    const newMed: FastMedication = {
      id: `fast-${Date.now()}`,
      drugName: fastDrugName.trim(),
      dose: fastDose.trim() || 'Standard',
      frequency: fastFrequency.trim() || 'Daily',
    };
    setFastRegimen((prev) => [...prev, newMed]);
    setFastDrugName('');
    showToast(`Appended ${newMed.drugName} to regimen overview.`, 'success');
  };

  const handleRemoveFastMed = (id: string) => {
    setFastRegimen((prev) => prev.filter((m) => m.id !== id));
  };

  const handleRunAiAudit = () => {
    if (fastRegimen.length === 0) {
      showToast('No medications indexed. Select a scenario or append medications first.', 'error');
      return;
    }
    showToast(`Running AI Prescribing Safety Audit on ${fastRegimen.length} medication(s)...`, 'info');
    const hasMethotrexate = fastRegimen.some((m) => m.drugName.toLowerCase().includes('methotrexate'));
    const hasLasa = fastRegimen.some((m) => m.drugName.toLowerCase().includes('hydralazine') || m.drugName.toLowerCase().includes('hydroxyzine'));
    if (hasMethotrexate || hasLasa) {
      setActiveView('med_errors');
    } else {
      setActiveView('ddi');
    }
  };

  // App Back-Button Navigation Hook: manages browser and device back button
  const { pushNavState, goBack } = useAppNavigation({
    activeView,
    selectedCaseId,
    activeModal: showAuthModal ? 'auth' : showHistoryModal ? 'history' : showIntakeModal ? 'intake' : null,
    onNavigateView: (view) => setActiveView(view),
    onCloseModal: () => {
      setShowAuthModal(false);
      setShowHistoryModal(false);
      setShowIntakeModal(false);
    },
    onCloseDetail: () => {
      setSelectedCaseId(null);
    },
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(casesStorageKey, JSON.stringify(cases));
    } catch (e) {
      console.error('Failed to save cases to localStorage', e);
    }
  }, [cases, casesStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(signalsStorageKey, JSON.stringify(signals));
    } catch (e) {
      console.error('Failed to save signals to localStorage', e);
    }
  }, [signals, signalsStorageKey]);

  // Keep selectedCaseId synchronized
  useEffect(() => {
    if (cases.length > 0 && (!selectedCaseId || !cases.some((c) => c.id === selectedCaseId))) {
      setSelectedCaseId(cases[0].id);
    } else if (cases.length === 0) {
      setSelectedCaseId(null);
    }
  }, [cases, selectedCaseId]);

  // Urgent P1 Count for Top Banner
  const urgentCount = useMemo(() => {
    return cases.filter((c) => c.priority.startsWith('P1')).length;
  }, [cases]);

  // Current selected case object
  const currentCase = useMemo(() => {
    return cases.find((c) => c.id === selectedCaseId) || cases[0] || null;
  }, [cases, selectedCaseId]);

  // Filtered cases list for left pane
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = c.caseNumber.toLowerCase().includes(q);
        const matchesDrug = c.drugs.some((d) => d.drugName.toLowerCase().includes(q) || d.activeSubstance.toLowerCase().includes(q));
        const matchesEvent = c.events.some((e) => e.term.toLowerCase().includes(q));
        const matchesPatient = c.patient.initials.toLowerCase().includes(q);
        if (!matchesNumber && !matchesDrug && !matchesEvent && !matchesPatient) return false;
      }

      // Priority Filter
      if (priorityFilter !== 'ALL') {
        if (!c.priority.startsWith(priorityFilter)) return false;
      }

      // Stage Filter
      if (stageFilter !== 'ALL') {
        if (c.pegaStage !== stageFilter) return false;
      }

      return true;
    });
  }, [cases, searchQuery, priorityFilter, stageFilter]);

  // Case Handlers
  const handleUpdateCase = (updated: SafetyCase) => {
    setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleAdvanceStage = (nextStage: PvStage, nextStep: string) => {
    if (!currentCase) return;
    const updated: SafetyCase = {
      ...currentCase,
      pegaStage: nextStage,
      pegaStep: nextStep,
      workflowHistory: [
        ...currentCase.workflowHistory,
        {
          timestamp: new Date().toISOString(),
          fromStage: currentCase.pegaStage,
          toStage: nextStage,
          step: nextStep,
          operator: 'Authorized Reviewer',
          actionTaken: `Advanced to ${nextStage}`,
          rationale: 'Stage completion checklist verified.',
        },
      ],
    };
    handleUpdateCase(updated);
  };

  const handleCaseCreated = (newCase: SafetyCase) => {
    setCases((prev) => [newCase, ...prev]);
    setSelectedCaseId(newCase.id);
    setActiveView('cases');
  };

  const handleDeleteCase = (caseId: string) => {
    setCases((prev) => prev.filter((c) => c.id !== caseId));
    showToast('Safety case removed from workspace.', 'info');
  };

  const handleClearAllCases = () => {
    setCases([]);
    setSelectedCaseId(null);
    localStorage.removeItem('vigilytics_user_cases');
    localStorage.removeItem('aegispv_user_cases');
    showToast('Workspace reset: all safety cases cleared.', 'info');
  };

  const handleLoadSampleCases = () => {
    setCases(SAMPLE_SAFETY_CASES);
    setSelectedCaseId(SAMPLE_SAFETY_CASES[0].id);
    showToast('Sample regulatory cases loaded into workspace.', 'success');
  };

  // Signal Handlers
  const handleAddSignal = (newSignal: SignalMetric) => {
    setSignals((prev) => [newSignal, ...prev]);
    showToast(`Signal for ${newSignal.drugName} registered.`, 'success');
  };

  const handleUpdateSignal = (updated: SignalMetric) => {
    setSignals((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    showToast('Signal updated.', 'info');
  };

  const handleDeleteSignal = (signalId: string) => {
    setSignals((prev) => prev.filter((s) => s.id !== signalId));
    showToast('Signal removed from workspace.', 'info');
  };

  const handleLoadSampleSignals = () => {
    setSignals(SAMPLE_ACTIVE_SIGNALS);
    showToast('Sample signals loaded.', 'success');
  };

  const handleEscalateSignal = (signalId: string) => {
    setSignals((prev) =>
      prev.map((s) =>
        s.id === signalId
          ? {
              ...s,
              status: 'Escalated to SRB' as const,
              regulatoryActionProposed: 'Safety Review Board emergency dossier convened.',
            }
          : s
      )
    );
    showToast('Signal successfully escalated to Executive Safety Review Board.', 'success');
  };

  const handleExportAllJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(cases, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `AegisPV-Cases-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const { currentMode, preferredMode, detectedMode, setMode, isStandalone } = useDeviceMode();

  // If in Mobile Interface Mode, render MobileAppView
  if (currentMode === 'mobile') {
    return (
      <div className="min-h-screen w-full bg-[#0c0c0e] text-slate-100 flex flex-col items-center justify-start overflow-x-hidden selection:bg-emerald-500 selection:text-white">
        <MobileAppView
          currentUserProfile={currentUser}
          onOpenAuthModal={() => setShowAuthModal(true)}
          onOpenHistoryModal={() => setShowHistoryModal(true)}
          cases={cases}
          selectedCaseId={selectedCaseId}
          onSelectCase={(id) => setSelectedCaseId(id)}
          onUpdateCase={handleUpdateCase}
          onAdvanceStage={handleAdvanceStage}
          onCaseCreated={handleCaseCreated}
          onDeleteCase={handleDeleteCase}
          onOpenIntakeModal={() => setShowIntakeModal(true)}
          signals={signals}
          onAddSignal={handleAddSignal}
          onUpdateSignal={handleUpdateSignal}
          onDeleteSignal={handleDeleteSignal}
          onEscalateSignal={handleEscalateSignal}
          onLoadSampleSignals={handleLoadSampleSignals}
          onSwitchToPcView={() => setMode('pc')}
          preferredMode={preferredMode}
          onSetMode={setMode}
          isStandalone={isStandalone}
        />
        {showIntakeModal && (
          <CaseIntakeModal
            existingCases={cases}
            onClose={() => setShowIntakeModal(false)}
            onCaseCreated={handleCaseCreated}
          />
        )}
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onSuccess={(user) => {
              setCurrentUser(user);
              setShowAuthModal(false);
            }}
          />
        )}
        {showHistoryModal && (
          <UserProfileHistoryModal
            isOpen={showHistoryModal}
            onClose={() => setShowHistoryModal(false)}
            currentUser={currentUser}
            onSignOut={() => {
              authService.signOut();
              setShowHistoryModal(false);
            }}
          />
        )}
        <AerixAssistant />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#111113] text-[#f2f2f2] flex flex-col font-geist overflow-hidden antialiased selection:bg-indigo-500 selection:text-white">
      {/* Show urgent escalation banner only when urgent cases exist */}
      {urgentCount > 0 && (
        <SafetyEscalationBanner
          urgentCount={urgentCount}
          onFilterUrgent={() => {
            setActiveView('cases');
            setPriorityFilter('P1');
          }}
        />
      )}

      {/* Variation 3 High Density Header */}
      <header className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-white/8 bg-[#111113] shrink-0 z-40">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-7 h-7 bg-[#6366f1] rounded-md grid place-items-center shadow-xs">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 21l-9-9 9-9 9 9-9 9z" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold uppercase tracking-wider text-sm text-[#f2f2f2]">
              Vigilytics
            </span>
            <span className="hidden xl:inline text-[11px] text-white/40 font-geist-mono">
              // Clinical AI
            </span>
          </div>
        </div>

        {/* Navigation Segments */}
        <nav className="hidden lg:flex items-center p-1 bg-[#1a1a1c] border border-white/8 rounded-md text-xs font-medium">
          <button
            onClick={() => setActiveView('agent')}
            className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeView === 'agent'
                ? 'bg-[#6366f1] text-white font-semibold shadow-xs'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Bot className="w-3 h-3" />
            <span>Workspace</span>
          </button>

          <button
            onClick={() => setActiveView('cases')}
            className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeView === 'cases'
                ? 'bg-[#6366f1] text-white font-semibold shadow-xs'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Safety Cases ({cases.length})</span>
          </button>

          <button
            onClick={() => setActiveView('ddi')}
            className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeView === 'ddi'
                ? 'bg-[#6366f1] text-white font-semibold shadow-xs'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Drug Interactions</span>
          </button>

          <button
            onClick={() => setActiveView('med_errors')}
            className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeView === 'med_errors'
                ? 'bg-[#6366f1] text-white font-semibold shadow-xs'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Medication Errors</span>
          </button>

          <button
            onClick={() => setActiveView('casesheet')}
            className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeView === 'casesheet'
                ? 'bg-[#6366f1] text-white font-semibold shadow-xs'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <FileCheck className="w-3 h-3" />
            <span>Casesheet Analysis</span>
          </button>
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* Pane toggles */}
          <div className="hidden sm:flex items-center bg-[#1a1a1c] border border-white/8 rounded p-0.5 mr-1">
            <button
              onClick={() => setShowLeftPane(!showLeftPane)}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                showLeftPane ? 'text-[#6366f1] bg-white/5' : 'text-white/40 hover:text-white'
              }`}
              title={showLeftPane ? 'Hide Control Panel' : 'Show Control Panel'}
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowRightPane(!showRightPane)}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                showRightPane ? 'text-[#6366f1] bg-white/5' : 'text-white/40 hover:text-white'
              }`}
              title={showRightPane ? 'Hide Case Entry' : 'Show Case Entry'}
            >
              <PanelRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Interface Mode Segmented Switcher */}
          <div className="flex items-center bg-[#1a1a1c] rounded p-0.5 border border-white/8">
            <button
              onClick={() => setMode('pc')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold transition-all cursor-pointer bg-white/10 text-white"
              title="Active in PC High Density Dashboard"
            >
              <Laptop className="w-3 h-3" />
              <span className="hidden md:inline">PC</span>
            </button>
            <button
              onClick={() => setMode('mobile')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer text-white/50 hover:text-white hover:bg-white/5"
              title="Switch to Mobile App View"
            >
              <Smartphone className="w-3 h-3" />
              <span className="hidden md:inline">Mobile</span>
            </button>
          </div>

          {/* User Sign In / Profile Button */}
          {currentUser ? (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1a1a1c] hover:bg-[#242428] text-white border border-white/10 rounded text-xs font-medium transition-colors cursor-pointer shadow-xs"
              title="View your account, searches, and analysis history"
            >
              <div className="w-4 h-4 rounded bg-[#6366f1] text-white flex items-center justify-center text-[10px] font-bold">
                {(currentUser.displayName || currentUser.name || 'U').charAt(0).toUpperCase()}
              </div>
              <span className="max-w-[85px] truncate hidden sm:inline">{currentUser.displayName || currentUser.name}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-3 py-1.5 bg-transparent hover:bg-white/5 text-white border border-white/10 rounded text-xs font-medium transition-colors cursor-pointer"
              title="Sign in with Mobile OTP, Google, Facebook, or Email"
            >
              Sign In
            </button>
          )}

          <button
            onClick={() => {
              setActiveView('agent');
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#6366f1] hover:bg-indigo-600 text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">+ New Case</span>
          </button>
        </div>
      </header>

      {/* 3-Pane High Density Workstation Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Control Panel */}
        {showLeftPane && (
          <aside className="w-60 shrink-0 border-r border-white/8 bg-[#111113] flex flex-col overflow-hidden">
            <div className="h-9 px-3.5 border-b border-white/8 flex items-center justify-between shrink-0">
              <span className="font-geist-mono text-[10px] uppercase tracking-wider text-white/50 font-bold">
                Control Panel
              </span>
              <button
                onClick={() => setShowLeftPane(false)}
                className="text-white/40 hover:text-white p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                title="Collapse Control Panel"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3.5 overflow-y-auto flex-1 space-y-4">
              {/* Patient Data */}
              <div className="space-y-1.5">
                <span className="block text-[10px] uppercase text-white/50 font-semibold tracking-wider font-geist-mono">
                  Patient Data
                </span>
                <button
                  onClick={() => {
                    if (currentUser) {
                      setShowHistoryModal(true);
                    } else {
                      setShowAuthModal(true);
                    }
                  }}
                  className="w-full text-left p-2.5 rounded bg-[#1a1a1c] hover:bg-[#222226] border border-white/8 text-white/90 text-xs font-medium transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate">
                    {currentUser ? currentUser.displayName || currentUser.name : 'Profile Configuration'}
                  </span>
                  <span className="text-[10px] text-white/40 font-geist-mono">
                    {currentUser ? 'Active' : 'Guest'}
                  </span>
                </button>
              </div>

              {/* Safety Scenarios */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="block text-[10px] uppercase text-white/50 font-semibold tracking-wider font-geist-mono">
                    Safety Scenarios
                  </span>
                  <span className="text-[9px] text-white/30 font-geist-mono">
                    Click to Load
                  </span>
                </div>
                <div className="space-y-1">
                  {PRESET_SCENARIOS.map((sc) => (
                    <button
                      key={sc.id}
                      onClick={() => handleLoadScenario(sc)}
                      className="scenario-pill"
                      title={sc.warning}
                    >
                      <div className="font-semibold text-xs text-white/90">{sc.name}</div>
                      <div className="text-[10px] text-white/40 truncate">{sc.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Workspace Tools */}
              <div className="space-y-1.5 pt-2 border-t border-white/8">
                <span className="block text-[10px] uppercase text-white/50 font-semibold tracking-wider font-geist-mono">
                  Workspace Tools
                </span>
                <div className="space-y-1">
                  <button
                    onClick={handleLoadSampleCases}
                    className="w-full text-left px-2.5 py-1.5 rounded bg-[#1a1a1c] hover:bg-[#222226] border border-white/8 text-white/70 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    Load Sample Cases
                  </button>
                  <button
                    onClick={handleExportAllJson}
                    className="w-full text-left px-2.5 py-1.5 rounded bg-[#1a1a1c] hover:bg-[#222226] border border-white/8 text-white/70 hover:text-white text-xs font-medium transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Export JSON</span>
                    <Download className="w-3 h-3 text-white/40" />
                  </button>
                  <button
                    onClick={handleClearAllCases}
                    className="w-full text-left px-2.5 py-1.5 rounded bg-[#1a1a1c] hover:bg-rose-950/40 border border-white/8 text-rose-400 hover:text-rose-300 text-xs font-medium transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Reset Cases</span>
                    <Trash2 className="w-3 h-3 text-rose-400/60" />
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Center Pane: Analysis Workspace */}
        <section className="flex-1 flex flex-col overflow-hidden bg-[#111113]">
          <div className="h-9 px-4 border-b border-white/8 bg-[#111113] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {!showLeftPane && (
                <button
                  onClick={() => setShowLeftPane(true)}
                  className="text-white/40 hover:text-white p-1 rounded hover:bg-white/5 transition-colors cursor-pointer mr-1"
                  title="Open Control Panel"
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="font-geist-mono text-[10px] uppercase tracking-wider text-white/50 font-bold">
                Analysis Workspace
              </span>
              <span className="text-white/30 text-[10px] font-geist-mono hidden sm:inline">
                // {activeView.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center text-[10px] text-emerald-400 font-medium font-geist-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1.5 animate-pulse"></span>
                AERIX Clinical AI Active
              </div>
              {!showRightPane && (
                <button
                  onClick={() => setShowRightPane(true)}
                  className="text-white/40 hover:text-white p-1 rounded hover:bg-white/5 transition-colors cursor-pointer ml-1"
                  title="Open Case Entry Pane"
                >
                  <PanelRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Pane Body with dot grid */}
          <div className="flex-1 overflow-y-auto workspace-grid-bg p-3 sm:p-5">
            {/* VIEW 0: PV MULTI-AGENT HUB (PRIMARY WORKSPACE FOR USER DATA ANALYSIS) */}
        {activeView === 'agent' && (
          <PvAgentConsole
            existingCases={cases}
            onSaveCaseToWorkspace={(newCase) => {
              handleCaseCreated(newCase);
            }}
          />
        )}

        {/* VIEW 1: CASES & CLINICAL TRIAGE */}
        {activeView === 'cases' && (
          <div>
            {cases.length > 0 && currentCase ? (
              <div className="space-y-6">
                {/* Top Stage Tracker for Current Active Case */}
                <PvWorkflowBar
                  currentCase={currentCase}
                  onAdvanceStage={handleAdvanceStage}
                />

                {/* Main Console Split Layout */}
                <div className="grid grid-cols-12 gap-6">
                  {/* Left Column: Filterable Case Queue */}
                  <div className="col-span-12 lg:col-span-4 space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search your cases..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Priority Filter Buttons */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-500 uppercase">Priority:</span>
                        <div className="flex items-center gap-1">
                          {['ALL', 'P1', 'P2', 'P3', 'P4'].map((p) => (
                            <button
                              key={p}
                              onClick={() => setPriorityFilter(p)}
                              className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                                priorityFilter === p
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Stage Filter */}
                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                        <span className="font-bold text-slate-500 uppercase">Stage:</span>
                        <select
                          value={stageFilter}
                          onChange={(e) => setStageFilter(e.target.value)}
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-700 text-xs"
                        >
                          <option value="ALL">All Stages</option>
                          <option value="Intake">Stage 1: Intake</option>
                          <option value="Triage">Stage 2: Triage</option>
                          <option value="ClinicalAssessment">Stage 3: Clinical</option>
                          <option value="SignalReview">Stage 4: Signal</option>
                          <option value="GovernanceEscalation">Stage 5: Governance</option>
                        </select>
                      </div>

                      {/* Export / Clear buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                        <button
                          onClick={handleExportAllJson}
                          className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Export JSON</span>
                        </button>
                        <button
                          onClick={handleClearAllCases}
                          className="text-slate-400 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear Cases</span>
                        </button>
                      </div>
                    </div>

                    {/* Cases List */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-semibold">
                        <span>Your Cases ({filteredCases.length})</span>
                        <button
                          onClick={() => setShowIntakeModal(true)}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold"
                        >
                          + Add Case
                        </button>
                      </div>

                      {filteredCases.map((c) => {
                        const isSelected = c.id === currentCase?.id;
                        const isUrgent = c.priority.startsWith('P1');

                        return (
                          <div
                            key={c.id}
                            onClick={() => setSelectedCaseId(c.id)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-white border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-xs text-slate-900">{c.caseNumber}</span>
                                  <span
                                    className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                      isUrgent
                                        ? 'bg-rose-100 text-rose-800'
                                        : c.priority.startsWith('P2')
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {c.priority.split(' ')[0]}
                                  </span>
                                  {c.isDuplicateFlagged && (
                                    <span className="text-[9px] font-bold bg-amber-100 text-amber-900 px-1 py-0.2 rounded">
                                      DUP MATCH
                                    </span>
                                  )}
                                  {(() => {
                                    const ddiSum = evaluateCaseDdiSummary(c.drugs, c.events);
                                    if (ddiSum.adrMayBeCausedByDdi) {
                                      return (
                                        <span
                                          className="text-[9px] font-black bg-rose-100 text-rose-900 border border-rose-300 px-1.5 py-0.2 rounded flex items-center gap-0.5"
                                          title="DDI identified as likely reason for the adverse reaction"
                                        >
                                          DDI ADR CAUSE
                                        </span>
                                      );
                                    }
                                    if (ddiSum.totalInteractions > 0) {
                                      return (
                                        <span
                                          className="text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded"
                                          title="DDI identified in patient regimen"
                                        >
                                          DDI CAUTION
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>

                                <div className="text-xs font-bold text-slate-800 mt-1 line-clamp-1">
                                  {c.drugs[0]?.drugName || 'Suspect Product'} · {c.events[0]?.term || 'Adverse Event'}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Patient: {c.patient?.initials || 'PT'} ({c.patient?.age || 'Unknown'}yo {c.patient?.sex || 'Unknown'}) · {c.country}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCase(c.id);
                                  }}
                                  className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                                  title="Delete Case"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                                <div className="text-xs font-bold text-indigo-700 font-mono mt-0.5">
                                  {c.pegaSLA?.hoursRemaining ?? 24}h
                                </div>
                              </div>
                            </div>

                            {/* Stage progress ticker */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                              <span className="font-medium text-indigo-900 bg-indigo-50 px-1.5 py-0.2 rounded">
                                {c.pegaStage}
                              </span>
                              <span className="text-slate-400 truncate max-w-[140px]">{c.assignedOperator}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Deep Clinical Review Console */}
                  <div className="col-span-12 lg:col-span-8">
                    <CaseDetailView
                      safetyCase={currentCase}
                      allCases={cases}
                      onUpdateCase={handleUpdateCase}
                      onAdvancePegaStage={handleAdvanceStage}
                      onSelectCaseById={(id) => setSelectedCaseId(id)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Clean Empty State: Guides User to Input Their Own Data */
              <div className="max-w-3xl mx-auto my-12 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                  <HeartPulse className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    Pharmacovigilance Workspace Ready
                  </h2>
                  <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                    No pre-loaded data is active. Input your own individual case safety reports (ICSR), clinical narratives, or JSON files to run automated causality assessments, seriousness classifications, and duplicate detection.
                  </p>
                </div>

                {/* Primary Action CTAs */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveView('agent')}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-white" />
                    <span>Start New Case Analysis</span>
                  </button>

                  <button
                    onClick={handleLoadSampleCases}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Load Demo Sample Case</span>
                  </button>
                </div>

                {/* What AegisPV Will Analyze for You */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left pt-6 border-t border-slate-100">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Causality Scoring</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Automated & interactive 10-question Naranjo Algorithm and WHO-UMC causality category evaluation.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>ICH E2A Seriousness</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Immediate prioritization of life-threatening (P1), serious unlisted (P2), and labeled (P3/P4) outcomes.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span>Deduplication & Quality</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Fuzzy demographic and drug-event matching across cases, plus targeted follow-up query letter drafting.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: DRUG INTERACTIONS CHECKER */}
        {activeView === 'ddi' && (
          <DrugInteractionChecker
            onSaveAsCase={(newCase) => {
              handleCaseCreated(newCase);
            }}
          />
        )}

        {/* VIEW 3: MEDICATION ERRORS & PRESCRIBING SAFETY AUDITOR */}
        {activeView === 'med_errors' && (
          <MedicationErrorChecker
            onSaveAsCase={(newCase) => {
              handleCaseCreated(newCase);
            }}
          />
        )}

        {/* VIEW 4: DAILY CASESHEET ANALYSIS */}
        {activeView === 'casesheet' && (
          <DailyCasesheetAnalysis
            onSaveAsCase={(newCase) => {
              handleCaseCreated(newCase);
            }}
          />
        )}
          </div>
        </section>

        {/* Right Pane: Case Entry */}
        {showRightPane && (
          <aside className="w-75 shrink-0 border-l border-white/8 bg-[#111113] flex flex-col overflow-hidden">
            <div className="h-9 px-3.5 border-b border-white/8 flex items-center justify-between shrink-0">
              <span className="font-geist-mono text-[10px] uppercase tracking-wider text-white/50 font-bold">
                Case Entry
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/40 font-geist-mono">
                  {fastRegimen.length} Indexed
                </span>
                <button
                  onClick={() => setShowRightPane(false)}
                  className="text-white/40 hover:text-white p-1 rounded hover:bg-white/5 transition-colors cursor-pointer ml-1"
                  title="Collapse Case Entry"
                >
                  <PanelRightClose className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-3.5 overflow-y-auto flex-1 space-y-3.5">
              {/* Quick Drug Entry Card */}
              <div className="bg-[#1a1a1c] border border-white/8 rounded-lg p-3 space-y-2.5">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase text-white/50 font-semibold tracking-wider font-geist-mono">
                    Drug Name
                  </label>
                  <input
                    type="text"
                    placeholder="Search pharmacy database..."
                    value={fastDrugName}
                    onChange={(e) => setFastDrugName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAppendFastMed();
                    }}
                    className="dark-input w-full px-2.5 py-1.5 text-xs rounded"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase text-white/50 font-semibold tracking-wider font-geist-mono">
                      Dose
                    </label>
                    <input
                      type="text"
                      value={fastDose}
                      onChange={(e) => setFastDose(e.target.value)}
                      className="dark-input w-full px-2 py-1.5 text-xs rounded"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase text-white/50 font-semibold tracking-wider font-geist-mono">
                      Frequency
                    </label>
                    <input
                      type="text"
                      value={fastFrequency}
                      onChange={(e) => setFastFrequency(e.target.value)}
                      className="dark-input w-full px-2 py-1.5 text-xs rounded"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAppendFastMed}
                  className="w-full py-2 bg-[#202024] hover:bg-[#28282c] border border-white/8 text-white rounded text-xs font-semibold cursor-pointer transition-colors"
                >
                  Append Medication
                </button>
              </div>

              {/* Regimen Overview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="block text-[10px] uppercase text-white/50 font-semibold tracking-wider font-geist-mono">
                    Regimen Overview ({fastRegimen.length})
                  </span>
                  {fastRegimen.length > 0 && (
                    <button
                      onClick={() => setFastRegimen([])}
                      className="text-[10px] text-white/40 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {fastRegimen.length === 0 ? (
                  <div className="p-4 border border-dashed border-white/10 rounded-lg text-center text-xs text-white/40 space-y-1">
                    <div className="font-medium">No medications indexed</div>
                    <div className="text-[10px] text-white/30">Select a scenario or append above</div>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {fastRegimen.map((m) => (
                      <div
                        key={m.id}
                        className="p-2 bg-[#1a1a1c] border border-white/8 rounded flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate text-xs">{m.drugName}</div>
                          <div className="text-[10px] text-white/50 truncate font-geist-mono">
                            {m.dose} · {m.frequency}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFastMed(m.id)}
                          className="text-white/40 hover:text-rose-400 p-1 rounded hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
                          title="Remove medication"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Run AI Audit Button */}
              <button
                onClick={handleRunAiAudit}
                className="w-full h-12 bg-[#6366f1] hover:bg-indigo-600 text-white font-bold text-xs rounded cursor-pointer transition-all flex items-center justify-center gap-2"
                style={{ boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)' }}
              >
                <Sparkles className="w-4 h-4" />
                <span>Run AI Audit</span>
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Case Intake Modal */}
      {showIntakeModal && (
        <CaseIntakeModal
          existingCases={cases}
          onClose={() => setShowIntakeModal(false)}
          onCaseCreated={handleCaseCreated}
        />
      )}

      {/* User Authentication Modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={(user) => {
            setCurrentUser(user);
            setShowAuthModal(false);
          }}
        />
      )}

      {/* User Profile & Saved History Modal */}
      {showHistoryModal && (
        <UserProfileHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          currentUser={currentUser}
          onSignOut={() => {
            authService.signOut();
            setShowHistoryModal(false);
          }}
        />
      )}

      {/* Variation 3 High Density Footer */}
      <footer className="h-10 px-4 sm:px-6 flex items-center justify-between bg-[#1a1a1c] border-t border-white/8 font-geist-mono text-[10px] text-white/50 shrink-0">
        <div>Vigilytics Decision Support // Pharmacovigilance Intelligence</div>
        <div className="hidden md:inline">Compliant with ICH E2A, ICH E2B(R3), CIOMS I, 21 CFR Part 11</div>
      </footer>
      <AerixAssistant />
      <ToastContainer />
    </div>
  );
}
