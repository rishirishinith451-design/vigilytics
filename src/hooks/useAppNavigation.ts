import { useEffect, useRef, useCallback } from 'react';

export interface AppNavState {
  view: 'agent' | 'cases' | 'ddi' | 'med_errors' | 'casesheet';
  selectedCaseId?: string | null;
  activeModal?: string | null; // e.g. 'auth' | 'history' | 'intake' | 'cioms' | 'followup' | 'aerix'
  viewingDetail?: boolean;
  viewingResult?: boolean;
  historyViewerItem?: string | null;
  step?: number;
}

export function useAppNavigation({
  activeView,
  onNavigateView,
  selectedCaseId,
  onSelectCase,
  activeModal,
  onCloseModal,
  isViewingDetail,
  onCloseDetail,
  isViewingResult,
  onCloseResult,
}: {
  activeView: 'agent' | 'cases' | 'ddi' | 'med_errors' | 'casesheet';
  onNavigateView: (view: 'agent' | 'cases' | 'ddi' | 'med_errors' | 'casesheet') => void;
  selectedCaseId?: string | null;
  onSelectCase?: (id: string | null) => void;
  activeModal?: string | null;
  onCloseModal?: () => void;
  isViewingDetail?: boolean;
  onCloseDetail?: () => void;
  isViewingResult?: boolean;
  onCloseResult?: () => void;
}) {
  const isNavigatingFromPopState = useRef(false);
  const stateStackRef = useRef<AppNavState[]>([]);

  // Initialize root history state on mount
  useEffect(() => {
    const initialState: AppNavState = {
      view: activeView,
      selectedCaseId,
      activeModal: null,
      viewingDetail: false,
      viewingResult: false,
      step: 0,
    };

    try {
      if (!window.history.state || !window.history.state.vigilytics) {
        window.history.replaceState({ vigilytics: true, ...initialState }, '', '');
      }
      stateStackRef.current = [initialState];
    } catch {}
  }, []);

  // Push new state when application location/view/modal changes
  const pushNavState = useCallback(
    (newState: Partial<AppNavState>) => {
      if (isNavigatingFromPopState.current) {
        isNavigatingFromPopState.current = false;
        return;
      }

      const topState = stateStackRef.current[stateStackRef.current.length - 1];
      const merged: AppNavState = {
        view: newState.view || topState?.view || activeView,
        selectedCaseId: newState.selectedCaseId !== undefined ? newState.selectedCaseId : selectedCaseId,
        activeModal: newState.activeModal !== undefined ? newState.activeModal : activeModal,
        viewingDetail: newState.viewingDetail !== undefined ? newState.viewingDetail : isViewingDetail,
        viewingResult: newState.viewingResult !== undefined ? newState.viewingResult : isViewingResult,
        step: (topState?.step || 0) + 1,
      };

      // Check if state actually changed
      if (
        topState &&
        topState.view === merged.view &&
        topState.activeModal === merged.activeModal &&
        topState.viewingDetail === merged.viewingDetail &&
        topState.viewingResult === merged.viewingResult &&
        topState.selectedCaseId === merged.selectedCaseId
      ) {
        return;
      }

      try {
        window.history.pushState({ vigilytics: true, ...merged }, '', '');
        stateStackRef.current.push(merged);
      } catch (e) {
        console.warn('Navigation pushState failed:', e);
      }
    },
    [activeView, selectedCaseId, activeModal, isViewingDetail, isViewingResult]
  );

  // Popstate event handler for device back button and browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      isNavigatingFromPopState.current = true;

      // 1. If any modal is open, back button MUST close the modal first
      if (activeModal && onCloseModal) {
        onCloseModal();
        return;
      }

      // 2. If viewing detail overlay (e.g. mobile case screen), close detail view
      if (isViewingDetail && onCloseDetail) {
        onCloseDetail();
        return;
      }

      // 3. If viewing an analysis result (e.g. in Casesheet, DDI or Med Errors), return to input view
      if (isViewingResult && onCloseResult) {
        onCloseResult();
        return;
      }

      // 4. Handle state from history event
      if (event.state && event.state.vigilytics) {
        const targetView = event.state.view;
        if (targetView && targetView !== activeView) {
          onNavigateView(targetView);
        }
        if (event.state.selectedCaseId !== undefined && onSelectCase) {
          onSelectCase(event.state.selectedCaseId);
        }
      } else {
        // If popped beyond our tracked history, prevent accidental exit by keeping user on home workspace
        if (activeView !== 'agent') {
          onNavigateView('agent');
        }
        try {
          window.history.pushState(
            { vigilytics: true, view: 'agent', step: 0 },
            '',
            ''
          );
        } catch {}
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    activeModal,
    onCloseModal,
    isViewingDetail,
    onCloseDetail,
    isViewingResult,
    onCloseResult,
    activeView,
    onNavigateView,
    onSelectCase,
  ]);

  // Programmatic back button helper for in-app UI back buttons
  const goBack = useCallback(() => {
    if (activeModal && onCloseModal) {
      onCloseModal();
      return;
    }
    if (isViewingDetail && onCloseDetail) {
      onCloseDetail();
      return;
    }
    if (isViewingResult && onCloseResult) {
      onCloseResult();
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    } else if (activeView !== 'agent') {
      onNavigateView('agent');
    }
  }, [
    activeModal,
    onCloseModal,
    isViewingDetail,
    onCloseDetail,
    isViewingResult,
    onCloseResult,
    activeView,
    onNavigateView,
  ]);

  return {
    pushNavState,
    goBack,
  };
}
