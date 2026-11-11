export type AuthProviderType = 'mobile_otp' | 'google' | 'facebook' | 'email_password';

export interface AppUser {
  id: string;
  name: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  avatar?: string;
  provider: AuthProviderType;
  createdAt: string;
  lastLoginAt: string;
  role?: string;
  organization?: string;
}

export type HistoryItemType =
  | 'search'
  | 'casesheet'
  | 'ddi_check'
  | 'med_error'
  | 'case_analysis'
  | 'aerix_chat';

export interface UserHistoryItem {
  id: string;
  userId: string;
  type: HistoryItemType;
  title: string;
  summary: string;
  timestamp: string;
  tags?: string[];
  metadata?: {
    drugNames?: string[];
    adverseEvent?: string;
    severity?: string;
    fileNames?: string[];
    fileCount?: number;
    caseNumber?: string;
  };
  payload?: any; // Full data payload for re-opening/viewing
}

export interface AuthSession {
  user: AppUser | null;
  token: string | null;
  isAuthenticated: boolean;
}
