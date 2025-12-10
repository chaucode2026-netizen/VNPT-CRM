
export interface SheetRow {
  [key: string]: string;
}

export interface SheetData {
  headers: string[];
  rows: SheetRow[];
  fileUrl?: string; // URL of the specific monthly file
}

export interface SheetListResponse {
  sheets: string[];
  spreadsheetUrl?: string;
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

// --- Auth Types ---
export type UserRole = 'ADMIN' | 'LEADER' | 'INSTRUCTOR';
export type UserStatus = 'ACTIVE' | 'BLOCKED';

export interface User {
  username: string;
  role: UserRole;
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: UserStatus;
  password?: string; // Optional, used for registration/reset payload
}

export interface LoginResponse {
  success?: boolean;
  user?: User;
  error?: string;
}

export interface UserListResponse {
  success?: boolean;
  users?: User[];
  error?: string;
}

// --- Configuration Types ---
export interface AppConfig {
  classCodes: string[];
  instructors: string[];
  units: string[];
}

// --- Table Settings Types (New) ---
export interface ConditionalRule {
  condition: 'equals' | 'contains' | 'starts_with' | 'greater_than' | 'less_than';
  value: string;
  backgroundColor: string;
  textColor: string;
  bold: boolean;
}

export interface TableConfig {
  isEnabledAlternating: boolean;
  alternatingColor: {
    headerBg: string;
    headerText: string;
    oddRowBg: string;
    evenRowBg: string;
  };
  conditionalRules: ConditionalRule[];
  instructorColors: Record<string, string>; // Map "Nguyen Van A" -> "#ff0000"
  columnWidths: Record<string, number>;
}
