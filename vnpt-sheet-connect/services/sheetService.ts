
import { SheetData, SheetRow, SheetListResponse, LoginResponse, User, UserListResponse, AppConfig } from '../types';

// Helper for CORS headers
const POST_HEADERS = {
  'Content-Type': 'text/plain;charset=utf-8',
};

// Login Function
export const loginUser = async (scriptUrl: string, username: string, password: string): Promise<User> => {
  try {
    const payload = JSON.stringify({
      action: 'login',
      username: username.trim(),
      password: password.trim()
    });

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: POST_HEADERS,
      body: payload
    });

    const data: LoginResponse = await response.json();
    
    if (!data.success || !data.user) {
      throw new Error(data.error || "Đăng nhập thất bại");
    }

    return data.user;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

// Register Function
export const registerUser = async (scriptUrl: string, user: User): Promise<{success: boolean}> => {
  try {
    const payload = JSON.stringify({
      action: 'register',
      user: user
    });

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: POST_HEADERS,
      body: payload
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return { success: true };
  } catch (error) {
    console.error("Register error:", error);
    throw error;
  }
};

// Admin: Get All Users
export const getAllUsers = async (scriptUrl: string): Promise<User[]> => {
  try {
    const payload = JSON.stringify({ action: 'getAllUsers' });
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: POST_HEADERS,
      body: payload
    });
    const data: UserListResponse = await response.json();
    if (data.error) throw new Error(data.error);
    return data.users || [];
  } catch (error) {
    console.error("Get Users error:", error);
    throw error;
  }
};

// Admin: Update User (Status, Reset Pass, Add)
export const adminUpdateUser = async (scriptUrl: string, type: 'UPDATE_STATUS' | 'RESET_PASS' | 'ADD', user: User): Promise<boolean> => {
  try {
    const payload = JSON.stringify({
      action: 'adminUpdateUser',
      type: type,
      user: user
    });
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: POST_HEADERS,
      body: payload
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return true;
  } catch (error) {
    console.error("Admin Update error:", error);
    throw error;
  }
};

// Fetch list of sheet names from GAS
export const fetchSheetNames = async (scriptUrl: string): Promise<{ sheetNames: string[], spreadsheetUrl: string }> => {
  try {
    const urlObj = new URL(scriptUrl);
    urlObj.searchParams.append('action', 'getSheets');
    urlObj.searchParams.append('_t', new Date().getTime().toString());
    
    const response = await fetch(urlObj.toString());
    if (!response.ok) throw new Error('Network response was not ok');
    
    const data: SheetListResponse = await response.json();
    return {
      sheetNames: data.sheets || [],
      spreadsheetUrl: data.spreadsheetUrl || ''
    };
  } catch (error) {
    console.error("Error fetching sheet names:", error);
    throw error;
  }
};

// Fetch data for a specific sheet
export const fetchSheetData = async (scriptUrl: string, sheetName: string): Promise<SheetData> => {
  try {
    const urlObj = new URL(scriptUrl);
    urlObj.searchParams.append('action', 'getData');
    urlObj.searchParams.append('sheetName', sheetName);
    urlObj.searchParams.append('_t', new Date().getTime().toString());

    const response = await fetch(urlObj.toString());
    if (!response.ok) throw new Error('Network response was not ok');
    
    const data = await response.json();
    
    if (data.error) throw new Error(data.error);

    return {
      headers: data.headers || [],
      rows: data.rows || [],
      fileUrl: data.fileUrl
    };
  } catch (error) {
    console.error("Sheet fetch error:", error);
    throw error;
  }
};

// Save a row to the sheet
export const saveSheetRow = async (scriptUrl: string, sheetName: string, rowData: SheetRow, matchColumn?: string): Promise<any> => {
  try {
    const payload = JSON.stringify({
      sheetName: sheetName,
      row: rowData,
      matchColumn: matchColumn, // Optional key to identify unique row for update
      action: 'saveRow'
    });

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: POST_HEADERS,
      body: payload,
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return { success: true };
  } catch (error) {
    console.error("Error saving row:", error);
    throw error;
  }
};

// Create Month Sheets
export const createMonthSheets = async (scriptUrl: string, month: string, year: number): Promise<{ success: boolean, spreadsheetUrl?: string }> => {
  try {
    const payload = JSON.stringify({
      action: 'createMonthSheets',
      month: month,
      year: year // ADDED YEAR PARAMETER
    });

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: POST_HEADERS,
      body: payload,
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  } catch (error) {
    console.error("Error creating sheets:", error);
    throw error;
  }
};

// Create Operations (NV) Sheets
export const createNVSheets = async (scriptUrl: string): Promise<{ success: boolean }> => {
  try {
    const payload = JSON.stringify({
      action: 'createNVSheets'
    });

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: POST_HEADERS,
      body: payload,
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return { success: true };
  } catch (error) {
    console.error("Error creating NV sheets:", error);
    throw error;
  }
};

// --- CONFIG API ---

export const fetchAppConfig = async (scriptUrl: string): Promise<AppConfig> => {
  try {
    const payload = JSON.stringify({ action: 'getConfig' });
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: POST_HEADERS,
      body: payload
    });
    const data = await response.json();
    if (data.config) {
        return data.config;
    }
    // Fallback default
    return { classCodes: [], instructors: [], units: [] };
  } catch (error) {
    console.error("Fetch Config error:", error);
    return { classCodes: [], instructors: [], units: [] };
  }
};

export const saveAppConfig = async (scriptUrl: string, user: User, config: AppConfig): Promise<boolean> => {
  try {
    const payload = JSON.stringify({
      action: 'saveConfig',
      user: user,
      config: config
    });
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: POST_HEADERS,
      body: payload
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return true;
  } catch (error) {
    console.error("Save Config error:", error);
    throw error;
  }
};
