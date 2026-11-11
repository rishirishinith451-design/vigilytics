import { UserHistoryItem, HistoryItemType } from '../types/auth';

class HistoryService {
  private getStorageKey(userId: string): string {
    return `vigilytics_user_history_${userId}`;
  }

  // Load all history items strictly for the specified userId
  public getHistory(userId: string, typeFilter?: HistoryItemType | 'ALL'): UserHistoryItem[] {
    if (!userId) return [];
    try {
      const raw = localStorage.getItem(this.getStorageKey(userId));
      if (!raw) return [];
      const items: UserHistoryItem[] = JSON.parse(raw);
      if (!Array.isArray(items)) return [];

      // Sort newest first
      const sorted = items.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      if (typeFilter && typeFilter !== 'ALL') {
        return sorted.filter((i) => i.type === typeFilter);
      }
      return sorted;
    } catch (e) {
      console.warn('Failed to read user history:', e);
      return [];
    }
  }

  // Save an item to the user's private history
  public addHistoryItem(
    userId: string,
    item: Omit<UserHistoryItem, 'id' | 'userId' | 'timestamp'>
  ): UserHistoryItem | null {
    if (!userId) return null;

    const newItem: UserHistoryItem = {
      ...item,
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      timestamp: new Date().toISOString(),
    };

    try {
      const existing = this.getHistory(userId);
      // Limit to 200 items per user to manage storage size
      const updated = [newItem, ...existing.filter((e) => e.title !== newItem.title || e.type !== newItem.type)].slice(0, 200);
      localStorage.setItem(this.getStorageKey(userId), JSON.stringify(updated));

      // Asynchronously sync to server
      fetch('/api/user/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, item: newItem }),
      }).catch(() => {});

      return newItem;
    } catch (e) {
      console.error('Failed to save history item:', e);
      return null;
    }
  }

  // Delete a single history item for the user
  public deleteHistoryItem(userId: string, itemId: string): boolean {
    if (!userId || !itemId) return false;
    try {
      const existing = this.getHistory(userId);
      const filtered = existing.filter((i) => i.id !== itemId);
      localStorage.setItem(this.getStorageKey(userId), JSON.stringify(filtered));

      // Asynchronously notify server
      fetch(`/api/user/history/${itemId}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      }).catch(() => {});

      return true;
    } catch (e) {
      console.error('Failed to delete history item:', e);
      return false;
    }
  }

  // Clear all history items for the user
  public clearAllHistory(userId: string): boolean {
    if (!userId) return false;
    try {
      localStorage.removeItem(this.getStorageKey(userId));
      fetch(`/api/user/history?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      }).catch(() => {});
      return true;
    } catch (e) {
      console.error('Failed to clear user history:', e);
      return false;
    }
  }

  // Search through user's history
  public searchHistory(userId: string, query: string, typeFilter?: HistoryItemType | 'ALL'): UserHistoryItem[] {
    const all = this.getHistory(userId, typeFilter);
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSummary = item.summary.toLowerCase().includes(q);
      const matchTags = item.tags?.some((t) => t.toLowerCase().includes(q));
      const matchDrugs = item.metadata?.drugNames?.some((d) => d.toLowerCase().includes(q));
      return matchTitle || matchSummary || matchTags || matchDrugs;
    });
  }
}

export const historyService = new HistoryService();
