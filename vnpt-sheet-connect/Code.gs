
/**
 * FILE 2: CORE LOGIC
 * Chứa các hàm xử lý API, Login, và thao tác với Spreadsheet.
 */

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getSheets') return getAllVirtualSheets();
  if (action === 'getData') return getDataFromMonthSheet(e.parameter.sheetName);
  return responseJSON({ error: "Invalid GET Action" });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(10000)) return responseJSON({ error: 'Server busy' });
    if (!e.postData) return responseJSON({ error: "No data" });

    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var result = {};

    if (action === 'getConfig') { lock.releaseLock(); return getConfig(); }
    if (action === 'saveConfig') { var res = saveConfig(body); lock.releaseLock(); return res; }

    switch (action) {
      case 'login': result = handleLogin(body.username, body.password); break;
      case 'register': result = handleRegister(body.user); break;
      case 'getAllUsers': result = handleGetAllUsers(); break;
      case 'adminUpdateUser': result = handleAdminUpdateUser(body.type, body.user); break;
      case 'createMonthSheets': result = createMonthSheets(body.month, body.year); break;
      case 'createNVSheets': result = createNVSheets(); break;
      case 'saveRow': result = saveRowToMonthFile(body.sheetName, body.row, body.matchColumn); break;
      case 'saveTableConfig': result = saveTableConfig(body.sheetName, body.config); break;
      case 'getTableConfig': result = getTableConfig(body.sheetName); break;
      default: result = { error: "Invalid Action" };
    }

    lock.releaseLock();
    return responseJSON(result);

  } catch (err) {
    lock.releaseLock();
    return responseJSON({ error: "Server Error: " + err.toString() });
  }
}

function handleLogin(username, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(USERS_SHEET);
  if (!sheet) return { error: "System not initialized" };
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase() && String(data[i][1]) === String(password)) {
      if (data[i][7] === "BLOCKED") return { error: "Tài khoản bị khóa" };
      return {
        success: true,
        user: { username: data[i][0], fullName: data[i][2], role: data[i][3], email: data[i][4], phone: data[i][5], address: data[i][6], status: data[i][7] }
      };
    }
  }
  return { error: "Sai tài khoản hoặc mật khẩu" };
}

function handleRegister(user) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(USERS_SHEET);
  if (!sheet) setupInitialUsers();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(user.username).toLowerCase()) return { error: "User đã tồn tại" };
  }
  sheet.appendRow([user.username, user.password, user.fullName, user.role || "INSTRUCTOR", user.email, user.phone, user.address, "BLOCKED"]);
  return { success: true };
}

function handleGetAllUsers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(USERS_SHEET);
  const data = sheet.getDataRange().getValues();
  const users = [];
  for (let i = 1; i < data.length; i++) {
    users.push({ username: data[i][0], fullName: data[i][2], role: data[i][3], email: data[i][4], phone: data[i][5], address: data[i][6], status: data[i][7] });
  }
  return { users };
}

function handleAdminUpdateUser(type, user) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(USERS_SHEET);
  var data = sheet.getDataRange().getValues();
  
  if (type === 'ADD') {
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == user.username) return { error: "User đã tồn tại" };
    }
    sheet.appendRow([user.username, user.password, user.fullName, user.role, user.email, user.phone, user.address, user.status || 'ACTIVE']);
    return { success: true };
  }
  
  var foundIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == user.username) { foundIndex = i + 1; break; }
  }
  if (foundIndex === -1) return { error: "User not found" };
  
  if (type === 'UPDATE_STATUS') {
    sheet.getRange(foundIndex, 8).setValue(user.status);
    if (user.role) sheet.getRange(foundIndex, 4).setValue(user.role);
  } else if (type === 'RESET_PASS') {
    sheet.getRange(foundIndex, 2).setValue(user.password);
  }
  return { success: true };
}

function getOrCreateIndexSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(INDEX_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(INDEX_SHEET_NAME);
    sheet.appendRow(["Month", "Year", "FileID", "FileURL"]);
    sheet.hideSheet();
  }
  return sheet;
}

function getAllVirtualSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const index = getOrCreateIndexSheet();
  const data = index.getDataRange().getDisplayValues();
  let list = [];

  for (let i = 1; i < data.length; i++) {
    const month = data[i][0]; 
    const year = data[i][1]; 
    if (month && year) {
      const mm = ("0" + parseInt(month)).slice(-2);
      const sheetSuffix = `${mm}-${year}`;
      list.push(`BC-T${sheetSuffix}`);
      list.push(`BF-T${sheetSuffix}`);
      list.push(`TH-T${sheetSuffix}`);
      list.push(`KH-T${sheetSuffix}`);
    }
  }
  
  const nvData = getNVDataFromIndex();
  if (nvData.fileId) {
     list.push('NV_DIDONG', 'NV_BRCD', 'NV_CNTT', 'NV_ONLINE');
  }

  list.sort();
  return responseJSON({ sheets: [...new Set(list)], spreadsheetUrl: ss.getUrl() });
}

function getNVDataFromIndex() {
  const index = getOrCreateIndexSheet();
  const data = index.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(String(data[i][0]) === 'NV' && String(data[i][1]) === 'ALL') {
       return { fileId: data[i][2], fileUrl: data[i][3] };
    }
  }
  return {};
}

function createNVSheets() {
   const indexSheet = getOrCreateIndexSheet();
   const existing = getNVDataFromIndex();
   if(existing.fileId) return { success: true, message: "Đã tồn tại" };
   const file = SpreadsheetApp.create("VNPT - Nghiệp Vụ Đào Tạo");
   const nvTabs = ['NV_DIDONG', 'NV_BRCD', 'NV_CNTT', 'NV_ONLINE'];
   nvTabs.forEach(name => {
      let s = file.getSheetByName(name);
      if(!s) s = file.insertSheet(name);
      if(s.getLastRow() === 0) {
        s.appendRow(HEADERS_BC); 
        s.getRange(1,1,1,HEADERS_BC.length).setFontWeight("bold").setBackground("#cfe2f3");
      }
   });
   if(file.getSheetByName("Sheet1")) file.deleteSheet(file.getSheetByName("Sheet1"));
   indexSheet.appendRow(['NV', 'ALL', file.getId(), file.getUrl()]);
   return { success: true };
}

function createMonthSheets(month, year) {
  const mm = ("0" + month).slice(-2);
  const yyyy = String(year);
  const indexSheet = getOrCreateIndexSheet();
  const data = indexSheet.getDataRange().getValues();
  
  let fileId = null;
  for (let i = 1; i < data.length; i++) {
    if (parseInt(data[i][0]) === parseInt(mm) && parseInt(data[i][1]) === parseInt(yyyy)) {
      fileId = data[i][2];
      break;
    }
  }

  let file;
  if (fileId) {
    try { file = SpreadsheetApp.openById(fileId); } catch (e) { return { error: "File đã xóa" }; }
  } else {
    file = SpreadsheetApp.create(`VNPT - Tháng ${mm} - ${yyyy}`);
    indexSheet.appendRow([mm, yyyy, file.getId(), file.getUrl()]);
  }

  const suffix = `-${yyyy}`; 
  const configs = [
    { name: `BC-T${mm}${suffix}`, headers: HEADERS_BC },
    { name: `TH-T${mm}${suffix}`, headers: HEADERS_TH },
    { name: `KH-T${mm}${suffix}`, type: "KH" },
    { name: `BF-T${mm}${suffix}`, type: "BF" }
  ];

  configs.forEach(conf => {
    let sheet = file.getSheetByName(conf.name);
    if (!sheet) {
      sheet = file.insertSheet(conf.name);
      let headers = conf.headers;
      if (conf.type === "BF" || conf.type === "KH") {
        const daysInMonth = new Date(parseInt(yyyy), parseInt(mm), 0).getDate();
        const dArr = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString().padStart(2, '0'));
        headers = [...HEADERS_BF, ...dArr];
      }
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#cfe2f3");
    }
  });
  if(file.getSheetByName("Sheet1")) file.deleteSheet(file.getSheetByName("Sheet1"));

  return { success: true, url: file.getUrl(), spreadsheetUrl: file.getUrl() };
}

function getDataFromMonthSheet(sheetName) {
  if (sheetName.startsWith('NV_')) {
     const nv = getNVDataFromIndex();
     if(!nv.fileId) return responseJSON({ error: "Chưa khởi tạo NV" });
     try {
       const f = SpreadsheetApp.openById(nv.fileId);
       const s = f.getSheetByName(sheetName);
       if(!s) return responseJSON({ headers: [], rows: [], fileUrl: f.getUrl() });
       const vals = s.getDataRange().getDisplayValues();
       if(vals.length === 0) return responseJSON({ headers: [], rows: [], fileUrl: f.getUrl() });
       const h = vals[0];
       const r = [];
       for(let i=1; i<vals.length; i++){ let obj = {}; h.forEach((k,j)=> obj[k]=vals[i][j]); r.push(obj); }
       return responseJSON({ headers: h, rows: r, fileUrl: f.getUrl() });
     } catch(e) { return responseJSON({error: e.message}); }
  }

  const match = sheetName.match(/T(\d{1,2})(?:-(\d{4}))?/);
  if (!match) return responseJSON({ error: "Invalid name" });

  const month = parseInt(match[1]);
  const year = match[2] || new Date().getFullYear().toString();
  const indexSheet = getOrCreateIndexSheet();
  const data = indexSheet.getDataRange().getValues();

  let fileId = null;
  let fileUrl = null;

  for (let i = 1; i < data.length; i++) {
    if (parseInt(data[i][0]) === month && parseInt(data[i][1]) === parseInt(year)) {
      fileId = data[i][2];
      fileUrl = data[i][3];
      break;
    }
  }

  if (!fileId) return responseJSON({ error: `Chưa có dữ liệu T${month}/${year}` });

  try {
    const file = SpreadsheetApp.openById(fileId);
    
    // Improved Matching Logic: Avoid cross-month pollution by checking the exact month number in the name
    let sheets = file.getSheets();
    let sheet = null;
    
    // Try exact match first
    sheet = file.getSheetByName(sheetName);
    
    // Fallback searching with strict month pattern
    if (!sheet) {
      for (let s of sheets) {
        let name = s.getName().toUpperCase();
        // Regex ensures the month number is isolated (not T11 matching T1)
        let pattern = new RegExp(`T(0?${month})(\\b|-)`);
        if (pattern.test(name)) {
          sheet = s;
          break;
        }
      }
    }

    if (!sheet) return responseJSON({ error: "Không tìm thấy sheet", fileUrl: fileUrl });

    const values = sheet.getDataRange().getDisplayValues();
    if (values.length === 0) return responseJSON({ headers: [], rows: [], fileUrl: fileUrl });

    const headers = values[0];
    const rows = [];
    for (let i = 1; i < values.length; i++) {
      let obj = {};
      headers.forEach((h, j) => { if (h) obj[h] = values[i][j]; });
      rows.push(obj);
    }
    return responseJSON({ headers, rows, fileUrl: fileUrl });

  } catch (e) {
    return responseJSON({ error: "Lỗi mở file: " + e.message });
  }
}

function saveRowToMonthFile(sheetName, rowObj, matchColumn) {
   if (sheetName.startsWith('NV_')) {
      const nv = getNVDataFromIndex();
      if(!nv.fileId) return { error: "Lỗi file NV" };
      return appendOrUpdate(SpreadsheetApp.openById(nv.fileId).getSheetByName(sheetName), rowObj, matchColumn);
   }

  const match = sheetName.match(/T(\d{1,2})(?:-(\d{4}))?/);
  if (!match) return { error: "Invalid Name" };
  const month = parseInt(match[1]);
  const year = match[2] || new Date().getFullYear().toString();
  const indexSheet = getOrCreateIndexSheet();
  const data = indexSheet.getDataRange().getValues();
  let fileId = null;

  for (let i = 1; i < data.length; i++) {
    if (parseInt(data[i][0]) === month && parseInt(data[i][1]) === parseInt(year)) {
      fileId = data[i][2];
      break;
    }
  }

  if (!fileId) return { error: "File chưa tạo" };

  try {
    const file = SpreadsheetApp.openById(fileId);
    let sheets = file.getSheets();
    let sheet = file.getSheetByName(sheetName);
    
    if (!sheet) {
      for (let s of sheets) {
        let name = s.getName().toUpperCase();
        let pattern = new RegExp(`T(0?${month})(\\b|-)`);
        if (pattern.test(name)) {
          sheet = s;
          break;
        }
      }
    }
    
    if (!sheet) return { error: "Sheet không tồn tại" };
    return appendOrUpdate(sheet, rowObj, matchColumn);
  } catch(e) { return { error: e.message }; }
}

function appendOrUpdate(sheet, rowObj, matchColumn) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRowVals = headers.map(h => rowObj[h] !== undefined ? "'" + rowObj[h] : "");

    if (matchColumn && rowObj[matchColumn]) {
       const data = sheet.getDataRange().getValues();
       const colIdx = headers.indexOf(matchColumn);
       if (colIdx > -1) {
           for(let i=1; i<data.length; i++) {
               if(String(data[i][colIdx]) === String(rowObj[matchColumn])) {
                   const range = sheet.getRange(i+1, 1, 1, headers.length);
                   const currentRow = range.getValues()[0];
                   const updatedRow = headers.map((h, idx) => rowObj[h] !== undefined ? "'" + rowObj[h] : currentRow[idx]);
                   range.setValues([updatedRow]);
                   return { success: true };
               }
           }
       }
    }
    sheet.appendRow(newRowVals);
    return { success: true };
}

function saveTableConfig(sheetName, config) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("TABLE_CONFIGS");
    if (!sheet) {
        sheet = ss.insertSheet("TABLE_CONFIGS");
        sheet.appendRow(["SheetName", "ConfigJSON"]);
        sheet.hideSheet();
    }
    const data = sheet.getDataRange().getValues();
    const json = JSON.stringify(config);
    for(let i=1; i<data.length; i++) {
        if(data[i][0] === sheetName) {
            sheet.getRange(i+1, 2).setValue(json);
            return { success: true };
        }
    }
    sheet.appendRow([sheetName, json]);
    return { success: true };
}

function getTableConfig(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("TABLE_CONFIGS");
    if (!sheet) return { tableConfig: null };
    const data = sheet.getDataRange().getValues();
    for(let i=1; i<data.length; i++) {
        if(data[i][0] === sheetName) {
            try {
                return { tableConfig: JSON.parse(data[i][1]) };
            } catch(e) { return { tableConfig: null }; }
        }
    }
    return { tableConfig: null };
}

function setupInitialUsers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(USERS_SHEET)) {
    const s = ss.insertSheet(USERS_SHEET);
    s.appendRow(["Username","Password","FullName","Role","Email","Phone","Address","Status"]);
    s.appendRow(["admin","admin123","Super Admin","ADMIN","admin@vnpt.vn","","Hanoi","ACTIVE"]);
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
