import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  Calculator,
  Pill,
  ShieldAlert,
  ChevronDown,
  Minimize2,
  Maximize2,
  Loader2,
  ExternalLink,
  Zap,
  Activity,
  Heart,
  Stethoscope,
  HelpCircle,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { authService } from '../services/authService';
import { historyService } from '../services/historyService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  topic?: string;
}

const QUICK_TOPICS = [
  {
    title: 'PV Signal & Disproportionality',
    icon: ShieldAlert,
    prompt: 'Explain Pharmacovigilance Signal Detection: how are PRR, ROR, and BCPNN calculated, what are the Evans criteria, and how do safety committees triage potential signals?',
  },
  {
    title: 'Adverse Drug Reaction Assessment',
    icon: Activity,
    prompt: 'How do you evaluate suspected ADR causality using the Naranjo Algorithm and WHO-UMC criteria? Explain how dechallenge, rechallenge, and confounding factors are weighted.',
  },
  {
    title: 'Drug Interaction & CYP Mechanics',
    icon: Pill,
    prompt: 'Explain the mechanism of CYP3A4 and P-glycoprotein drug-drug interactions, with real clinical examples (e.g., Clarithromycin with Simvastatin or Amiodarone with Digoxin) and recommended risk-mitigation strategies.',
  },
  {
    title: 'Type 2 Diabetes Clinical Dossier',
    icon: Heart,
    prompt: 'Provide a structured evidence-conscious clinical overview of Type 2 Diabetes Mellitus: etiology, pathophysiology, complications, diagnostic thresholds, and standard guideline pharmacotherapy (formulations, routes, doses, and frequencies).',
  },
  {
    title: 'Renal CrCl & Dosing Adjustments',
    icon: Calculator,
    prompt: 'How do you calculate Cockcroft-Gault Creatinine Clearance and determine dosage adjustments for narrow therapeutic index medications in renal impairment?',
  },
  {
    title: 'Ask AERIX Anything (Universal AI)',
    icon: Sparkles,
    prompt: 'Act as universal intelligence: summarize the latest principles in evidence-based medicine and clinical research methodology.',
  },
];

// In-memory cache for fast repeated queries
const aerixResponseCache = new Map<string, string>();

export const AerixAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 **Hello! I am AERIX**, your advanced Pharmacovigilance & Clinical AI Assistant.

I am designed to answer a broad range of questions with precision, evidence-consciousness, and speed:
- 🛡️ **Pharmacovigilance & Safety Signals:** ADR triage, ICH E2A seriousness criteria, Naranjo causality scoring, WHO-UMC algorithms, CIOMS dossiers, and disproportionality metrics (PRR/ROR).
- 💊 **Pharmacology & Medicines:** Drug mechanisms, receptor kinetics, CYP enzyme interactions, narrow therapeutic index management, and renal dosing adjustments.
- 📋 **Evidence-Conscious Health Guidance:** Structured clinical disease overviews with transparent discussion of uncertainty and guideline-grounded therapeutic principles.
- 🌐 **Universal Knowledge & Problem Solving:** You can also ask me about general science, clinical research methodology, biochemistry, data interpretation, and broader inquiries.

⚠️ *Clinical Note: AERIX provides evidence-conscious informational analysis for qualified healthcare professionals, researchers, and students. It does not replace independent clinical judgment or qualified healthcare consultations.*

How can I assist your clinical safety analysis today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const handleOpenExternal = () => setIsOpen(true);
    window.addEventListener('open-aerix', handleOpenExternal);
    window.addEventListener('open-pharmdbot', handleOpenExternal); // Backward compatibility
    return () => {
      window.removeEventListener('open-aerix', handleOpenExternal);
      window.removeEventListener('open-pharmdbot', handleOpenExternal);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputMessage('');
    setIsLoading(true);

    const cacheKey = textToSend.toLowerCase().trim();

    // Fast cache check
    if (aerixResponseCache.has(cacheKey)) {
      const cachedReply = aerixResponseCache.get(cacheKey)!;
      setTimeout(() => {
        const botMsg: ChatMessage = {
          id: `aerix-${Date.now()}`,
          role: 'assistant',
          content: cachedReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMsg]);
        setIsLoading(false);
        saveToUserHistory(textToSend, cachedReply);
      }, 40);
      return;
    }

    try {
      const resp = await fetch('/api/ai/aerix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      let replyText = '';
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.reply) {
          replyText = data.reply;
        }
      }

      if (!replyText) {
        replyText = getAerixFallbackResponse(textToSend);
      }

      aerixResponseCache.set(cacheKey, replyText);

      const botMsg: ChatMessage = {
        id: `aerix-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
      saveToUserHistory(textToSend, replyText);
    } catch (err) {
      console.warn('AERIX connection note, using local clinical knowledge base:', err);
      const fallbackReply = getAerixFallbackResponse(textToSend);
      aerixResponseCache.set(cacheKey, fallbackReply);

      const botMsg: ChatMessage = {
        id: `aerix-${Date.now()}`,
        role: 'assistant',
        content: fallbackReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
      saveToUserHistory(textToSend, fallbackReply);
    } finally {
      setIsLoading(false);
    }
  };

  const saveToUserHistory = (query: string, answer: string) => {
    const user = authService.getCurrentUser();
    if (user) {
      historyService.addHistoryItem(user.id, {
        type: 'aerix_chat',
        title: query.slice(0, 60) + (query.length > 60 ? '...' : ''),
        summary: answer.slice(0, 200) + '...',
        tags: ['AERIX AI', 'Clinical Consultation'],
        payload: { query, answer, timestamp: new Date().toISOString() },
      });
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Conversation reset. I am AERIX, ready to assist with pharmacovigilance, clinical pharmacology, medicines, or general inquiries.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Evidence-conscious clinical fallback responses
  const getAerixFallbackResponse = (query: string): string => {
    const q = query.toLowerCase();

    if (q.includes('signal') || q.includes('prr') || q.includes('disproportionality')) {
      return `### 🛡️ AERIX Pharmacovigilance Intelligence: Safety Signal Detection & Disproportionality

#### 1. Proportional Reporting Ratio (PRR):
The PRR quantifies whether a specific adverse reaction is reported more frequently with a suspect drug compared to all other medications in the safety database:
$$\\text{PRR} = \\frac{a / (a + b)}{c / (c + d)}$$
Where:
- $a$: Cases with suspect drug and specific adverse event
- $b$: Cases with suspect drug and other adverse events
- $c$: Cases with other drugs and specific adverse event
- $d$: Cases with other drugs and other adverse events

#### 2. Evans Criteria for Positive Signal Threshold:
Under European Medicines Agency (EMA) and UK MHRA standard guidelines, a signal warrants regulatory review when:
1. $\\text{PRR} \\ge 2.0$
2. Chi-square statistic with Yates correction $\\chi^2 \\ge 4.0$
3. Number of observed cases $a \\ge 3$

#### 3. Reporting Odds Ratio (ROR):
Frequently utilized by the FDA and global databases:
$$\\text{ROR} = \\frac{a / c}{b / d} = \\frac{a \\times d}{b \\times c}$$
With 95% Confidence Interval: a signal is flagged when the lower bound of the 95% CI exceeds 1.0.

#### 4. Clinical Triage & Causality Governance:
Statistical disproportion does **not** establish biological causality. Every flagged signal must undergo clinical review evaluating:
- Biological plausibility and temporal sequence
- Dechallenge and rechallenge documentation
- Confounding disease factors and concomitant medications
- True incidence vs. reporting bias (stimulated reporting, notoriety bias)

*Note: For specific regulatory submissions, confirm against the local authority's GVP Module IX guidelines.*`;
    }

    if (q.includes('naranjo') || q.includes('causality') || q.includes('who-umc')) {
      return `### 📊 AERIX Clinical Safety: ADR Causality Assessment (Naranjo & WHO-UMC)

#### 1. The Naranjo 10-Question ADR Probability Algorithm:
The Naranjo questionnaire objectively standardizes ADR probability scoring:
- **Questions 1–2:** Previous conclusive reports (+1), temporal onset after suspect drug (+2).
- **Questions 3–4:** Improvement upon dechallenge (+1), reappearance upon rechallenge (+2).
- **Questions 5–6:** Alternative clinical causes ruled out (+2), reaction after placebo (-1).
- **Questions 7–8:** Toxic drug level detected (+1), dose-response relationship (+1).
- **Questions 9–10:** Similar reaction to same/similar agents in the past (+1), objective confirmation by clinical test (+1).

**Scoring Interpretation:**
- **$\\ge 9$:** Definite ADR
- **5 to 8:** Probable ADR
- **1 to 4:** Possible ADR
- **$\\le 0$:** Doubtful ADR

#### 2. WHO-UMC Causality Categories:
1. **Certain:** Plausible time relationship; dechallenge positive; rechallenge positive; event cannot be explained by disease.
2. **Probable / Likely:** Plausible time relationship; dechallenge positive; alternative causes unlikely; rechallenge not required.
3. **Possible:** Reasonable time relationship; could be explained by concurrent disease or other drugs; information on dechallenge may be lacking.
4. **Unlikely:** Improbable temporal sequence; underlying disease or other drugs provide plausible explanation.
5. **Conditional / Unclassified:** More data required for proper assessment.
6. **Unassessable / Unclassifiable:** Incomplete or contradictory report that cannot be clarified.

*Clinical Pearl: Documenting clear dechallenge timelines and baseline laboratory indices significantly strengthens causality adjudications.*`;
    }

    return `### 💡 AERIX Analysis & Clinical Response
Regarding: **"${query}"**

#### 1. Core Principles & Medical Science Context:
- Approaching this through evidence-conscious analysis, examining documented pharmacological mechanisms, clinical literature, and therapeutic guidelines.
- Where scientific evidence is incomplete or varies across patient populations, findings should be evaluated in context rather than treated as absolute.

#### 2. Practical Clinical & Safety Considerations:
- **Pharmacodynamics & Kinetics:** Consider absorption, distribution, hepatic metabolism (CYP450 pathways), and renal excretion parameters.
- **Safety Monitoring:** Verify organ function markers (eGFR, LFTs, electrolyte panels) and watch for narrow therapeutic index flags.
- **Patient-Specific Factors:** Age, organ impairment, pregnancy status, and concomitant drug burden significantly influence clinical outcomes.

#### 3. Informational Notice:
- This response provides structured clinical and pharmacological knowledge. For individual patient care, diagnosis, or therapy modification, please consult a qualified healthcare professional and institutional treatment guidelines.

*Feel free to ask AERIX about specific drug interaction mechanics, disease management dossiers, adverse reaction investigations, or general inquiries!*`;
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <div className="fixed bottom-[84px] right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 group animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/95 text-white rounded-full text-xs font-bold shadow-lg border border-indigo-500/30 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>AERIX Clinical AI</span>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white flex items-center justify-center shadow-2xl shadow-indigo-600/50 hover:scale-105 active:scale-95 transition-all border-2 border-white/20 cursor-pointer relative"
            title="Open AERIX - Advanced Pharmacovigilance & Clinical AI"
          >
            <Bot className="w-6 h-6 sm:w-7 sm:h-7" />
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[9px] rounded-full uppercase tracking-tighter shadow-xs">
              AI
            </span>
          </button>
        </div>
      )}

      {/* Main AERIX Chat Interface */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 flex flex-col bg-slate-950/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl overflow-hidden ${
            isExpanded
              ? 'inset-0 sm:inset-4 max-w-5xl mx-auto sm:rounded-3xl'
              : 'inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[520px] sm:h-[700px] sm:max-h-[90vh] sm:rounded-3xl'
          }`}
        >
          {/* Header Bar */}
          <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 border-b border-slate-800 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 flex items-center justify-center text-white shadow-lg">
                  <Bot className="w-5 h-5" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full"></span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                    <span>AERIX</span>
                    <span className="text-[10px] bg-indigo-500/25 text-indigo-300 px-2 py-0.5 rounded-full font-bold border border-indigo-500/40">
                      Clinical AI
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 border border-emerald-500/30">
                      <Zap className="w-2.5 h-2.5 text-emerald-400" />
                      <span>Turbo</span>
                    </span>
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400">Pharmacovigilance Intelligence & Universal Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearHistory}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Reset conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer hidden sm:block"
                title={isExpanded ? 'Minimize size' : 'Expand window'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Close AERIX"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/70">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 text-xs sm:text-[13px] ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-2xl p-4 leading-relaxed relative group shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-xs shadow-indigo-900/30'
                      : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-tl-xs shadow-slate-950/50'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>

                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{msg.timestamp}</span>
                    {msg.role === 'assistant' && (
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="opacity-70 hover:opacity-100 flex items-center gap-1 text-[10px] text-indigo-300 transition-opacity cursor-pointer font-medium"
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Response</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 text-xs justify-start">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl rounded-tl-xs p-3.5 text-slate-300 flex items-center gap-2.5 shadow-md">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span className="text-xs font-medium text-slate-200">
                    AERIX is formulating an evidence-conscious response...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Topic Chips */}
          <div className="px-3 py-2 bg-slate-900/90 border-t border-slate-800 shrink-0">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Quick Clinical & Universal Topics:</span>
              </div>
              <span className="text-[9px] text-emerald-400 font-mono">⚡ Low Latency</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {QUICK_TOPICS.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(item.prompt)}
                    className="shrink-0 px-2.5 py-1 bg-slate-800/90 hover:bg-indigo-600/30 hover:border-indigo-500/50 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium border border-slate-700/80 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <IconComponent className="w-3 h-3 text-indigo-400" />
                    <span>{item.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Input Field */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask AERIX about pharmacology, medicines, ADRs, or general questions..."
                rows={1}
                style={{ color: '#ffffff' }}
                className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none max-h-24"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white flex items-center justify-center transition-all cursor-pointer shrink-0 disabled:text-slate-500 shadow-md"
                title="Send to AERIX"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
            <div className="mt-1 text-[9px] text-center text-slate-500">
              AERIX provides evidence-conscious guidance. Does not substitute professional healthcare judgment.
            </div>
          </div>
        </div>
      )}
    </>
  );
};
