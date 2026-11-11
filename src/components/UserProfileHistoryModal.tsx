import React, { useState, useMemo } from 'react';
import {
  X,
  User,
  History,
  Trash2,
  Search,
  Layers,
  FileCheck,
  AlertTriangle,
  Bot,
  Calendar,
  LogOut,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Phone,
  Mail,
  KeyRound,
  FileText,
  Clock,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { AppUser, UserHistoryItem, HistoryItemType } from '../types/auth';
import { historyService } from '../services/historyService';
import { showToast } from '../utils/toast';

interface UserProfileHistoryModalProps {
  isOpen: boolean;
  user?: AppUser | null;
  currentUser?: AppUser | null;
  onClose: () => void;
  onSignOut: () => void;
  onOpenRecovery?: () => void;
  onLoadHistoryItem?: (item: UserHistoryItem) => void;
}

export const UserProfileHistoryModal: React.FC<UserProfileHistoryModalProps> = ({
  isOpen,
  user,
  currentUser,
  onClose,
  onSignOut,
  onOpenRecovery,
  onLoadHistoryItem,
}) => {
  const activeUser = user || currentUser || null;
  const [activeTab, setActiveTab] = useState<'all' | 'search' | 'casesheet' | 'ddi_check' | 'med_error' | 'aerix_chat'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedItemDetail, setSelectedItemDetail] = useState<UserHistoryItem | null>(null);

  // Trigger re-render on history mutations
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const userHistory = useMemo(() => {
    if (!activeUser) return [];
    const filter = activeTab === 'all' ? 'ALL' : activeTab;
    return historyService.searchHistory(activeUser.id, searchQuery, filter as any);
  }, [activeUser, activeTab, searchQuery, refreshTrigger]);

  const allCounts = useMemo(() => {
    if (!activeUser) return { all: 0, search: 0, casesheet: 0, ddi_check: 0, med_error: 0, aerix_chat: 0 };
    const all = historyService.getHistory(activeUser.id);
    return {
      all: all.length,
      search: all.filter((i) => i.type === 'search').length,
      casesheet: all.filter((i) => i.type === 'casesheet').length,
      ddi_check: all.filter((i) => i.type === 'ddi_check').length,
      med_error: all.filter((i) => i.type === 'med_error').length,
      aerix_chat: all.filter((i) => i.type === 'aerix_chat').length,
    };
  }, [activeUser, refreshTrigger]);

  if (!isOpen || !activeUser) return null;

  const handleDeleteItem = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    historyService.deleteHistoryItem(activeUser.id, itemId);
    if (selectedItemDetail?.id === itemId) setSelectedItemDetail(null);
    setRefreshTrigger((prev) => prev + 1);
    showToast('History record removed.', 'info');
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear your entire history? This action cannot be undone.')) {
      historyService.clearAllHistory(activeUser.id);
      setSelectedItemDetail(null);
      setRefreshTrigger((prev) => prev + 1);
      showToast('All user history cleared.', 'info');
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('Summary copied to clipboard.', 'success');
  };

  const getTypeIcon = (type: HistoryItemType) => {
    switch (type) {
      case 'casesheet':
        return <FileCheck className="w-3.5 h-3.5 text-emerald-600" />;
      case 'ddi_check':
        return <Layers className="w-3.5 h-3.5 text-indigo-600" />;
      case 'med_error':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
      case 'aerix_chat':
        return <Bot className="w-3.5 h-3.5 text-purple-600" />;
      case 'search':
        return <Search className="w-3.5 h-3.5 text-blue-600" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  const getTypeBadge = (type: HistoryItemType) => {
    switch (type) {
      case 'casesheet':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Casesheet</span>;
      case 'ddi_check':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">DDI Check</span>;
      case 'med_error':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Med Error</span>;
      case 'aerix_chat':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">AERIX AI</span>;
      case 'search':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Search</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200">History</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Profile Section */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg overflow-hidden border-2 border-white/20">
                {activeUser.avatar ? (
                  <img src={activeUser.avatar} alt={activeUser.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{(activeUser.displayName || activeUser.name || 'U').charAt(0).toUpperCase()}</span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">{activeUser.displayName || activeUser.name}</h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    {activeUser.provider.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-300 mt-1 flex-wrap">
                  {activeUser.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{activeUser.email}</span>
                    </div>
                  )}
                  {activeUser.phoneNumber && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{activeUser.phoneNumber}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Member since {new Date(activeUser.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Account Actions Bar */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-indigo-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Private Isolated History Active</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onOpenRecovery && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenRecovery();
                  }}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Account Recovery / Password</span>
                </button>
              )}

              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to sign out?')) {
                    onSignOut();
                    onClose();
                    showToast('Successfully signed out.', 'info');
                  }
                }}
                className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* History Search & Filter Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* History Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search previous searches, medicines, casesheets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Clear All History Button */}
          {allCounts.all > 0 && (
            <button
              onClick={handleClearAll}
              className="px-2.5 py-1 text-slate-500 hover:text-rose-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0 self-end sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History ({allCounts.all})</span>
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-3 sm:px-4 gap-1 overflow-x-auto shrink-0 py-1.5">
          {[
            { id: 'all', label: 'All History', count: allCounts.all },
            { id: 'search', label: 'Searches', count: allCounts.search },
            { id: 'casesheet', label: 'Casesheets', count: allCounts.casesheet },
            { id: 'ddi_check', label: 'DDI Checks', count: allCounts.ddi_check },
            { id: 'med_error', label: 'Med Errors', count: allCounts.med_error },
            { id: 'aerix_chat', label: 'AERIX AI', count: allCounts.aerix_chat },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                activeTab === tab.id
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Main Content Area: Split View if Item Selected */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* History List Pane */}
          <div
            className={`overflow-y-auto p-4 space-y-2.5 ${
              selectedItemDetail ? 'w-full md:w-1/2 border-r border-slate-200' : 'w-full'
            }`}
          >
            {userHistory.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">No Saved History Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Your searches, drug interaction checks, medication error audits, casesheet analyses, and AERIX AI sessions will be securely saved here under your account.
                  </p>
                </div>
              </div>
            ) : (
              userHistory.map((item) => {
                const isSelected = selectedItemDetail?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemDetail(item)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/50 border-indigo-400 ring-1 ring-indigo-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(item.type)}
                        {getTypeBadge(item.type)}
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.timestamp).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => handleDeleteItem(e, item.id)}
                          className="p-1 text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete history item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 mt-1.5 line-clamp-1">{item.title}</h4>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {item.summary}
                    </p>

                    {item.metadata?.drugNames && item.metadata.drugNames.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-2 pt-2 border-t border-slate-100">
                        {item.metadata.drugNames.slice(0, 4).map((d, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium"
                          >
                            {d}
                          </span>
                        ))}
                        {item.metadata.drugNames.length > 4 && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            +{item.metadata.drugNames.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Item Detail Inspector Pane */}
          {selectedItemDetail && (
            <div className="w-full md:w-1/2 p-4 bg-slate-50 overflow-y-auto flex flex-col justify-between border-t md:border-t-0">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {getTypeBadge(selectedItemDetail.type)}
                      <span className="text-xs text-slate-500">
                        {new Date(selectedItemDetail.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1.5">{selectedItemDetail.title}</h3>
                  </div>

                  <button
                    onClick={() => setSelectedItemDetail(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                    title="Close detail"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
                  <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block">
                    Analysis Summary:
                  </span>
                  <p className="whitespace-pre-wrap leading-relaxed">{selectedItemDetail.summary}</p>
                </div>

                {/* Additional Metadata */}
                {selectedItemDetail.metadata && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 text-xs">
                    <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block">
                      Parameters & Clinical Context:
                    </span>
                    {selectedItemDetail.metadata.drugNames && (
                      <div>
                        <span className="text-slate-500 text-[11px]">Medications: </span>
                        <span className="font-semibold text-slate-800">
                          {selectedItemDetail.metadata.drugNames.join(', ')}
                        </span>
                      </div>
                    )}
                    {selectedItemDetail.metadata.severity && (
                      <div>
                        <span className="text-slate-500 text-[11px]">Risk Grade: </span>
                        <span className="font-semibold text-slate-800">
                          {selectedItemDetail.metadata.severity}
                        </span>
                      </div>
                    )}
                    {selectedItemDetail.metadata.fileNames && selectedItemDetail.metadata.fileNames.length > 0 && (
                      <div>
                        <span className="text-slate-500 text-[11px]">Attached Files: </span>
                        <span className="font-mono text-slate-700 text-[11px]">
                          {selectedItemDetail.metadata.fileNames.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Actions for Selected History Item */}
              <div className="pt-4 mt-4 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleCopy(selectedItemDetail.id, selectedItemDetail.summary)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedId === selectedItemDetail.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>

                {onLoadHistoryItem && (
                  <button
                    onClick={() => {
                      onLoadHistoryItem(selectedItemDetail);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Re-open Full Analysis</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
