/** SunGuard DEMO — bound to the SunGuard_Products spreadsheet.
 * Deploy > New deployment > Web app > Execute as Me > Anyone.
 * WARNING: Anyone with the URL can submit demo rows. This is NOT an authenticated ordering system.
 * Script project timezone: Asia/Manila (Project Settings).
 */
const ORDERS_TAB = 'Orders';
const PRODUCTS_TAB = 'SunGuard_Products';
const HEADERS = [
  'Order_ID','Order_Date','Customer_Name','Customer_Email','Customer_Phone',
  'Product_ID','Product_Name','Quantity','Unit_Price_PHP','Total_PHP',
  'Order_Status','Stock_Deducted','Notification_Status'
];
function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (String(payload.website || '').trim()) return json_({ok:false,error:'Rejected'});
    const customer = clean_(payload.Customer_Name,100);
    const email = clean_(payload.Customer_Email,150);
    const phone = clean_(payload.Customer_Phone || '',30);
    const productId = clean_(payload.Product_ID,25);
    const qty = Number(payload.Quantity);
    if (!customer || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !productId || !Number.isInteger(qty) || qty < 1 || qty > 20) {
      return json_({ok:false,error:'Invalid demo order'});
    }
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const inventory = book.getSheetByName(PRODUCTS_TAB);
    const sheet = book.getSheetByName(ORDERS_TAB);
    if (!sheet || !inventory) throw new Error('Required sheet missing');
    const ids = inventory.getRange(2,1,Math.max(1,inventory.getLastRow()-1),1)
      .getDisplayValues().flat().map(String);
    if (!ids.includes(productId)) return json_({ok:false,error:'Unknown product'});
    const actualHeaders = sheet.getRange(1,1,1,HEADERS.length).getDisplayValues()[0];
    if (actualHeaders.join('|') !== HEADERS.join('|')) throw new Error('Orders headers mismatch');

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const now = new Date();
      const zone = 'Asia/Manila';
      const prefix = 'DEMO-' + Utilities.formatDate(now,zone,'yyyyMMddHHmmss');
      // Avoid duplicate IDs for two requests arriving in the same second.
      let orderId = prefix;
      const existing = sheet.getLastRow() > 1
        ? sheet.getRange(2,1,sheet.getLastRow()-1,1).getDisplayValues().flat()
        : [];
      if (existing.includes(orderId)) {
        let n = 2;
        while (existing.includes(prefix + '-' + n)) n++;
        orderId = prefix + '-' + n;
      }
      const orderDate = Utilities.formatDate(now,zone,'yyyy-MM-dd HH:mm:ss');
      sheet.appendRow([
        orderId,orderDate,customer,email,phone,productId,'',qty,'','',
        'New','No','Pending'
      ]);
      return json_({ok:true,order_id:orderId});
    } finally { lock.releaseLock(); }
  } catch (err) {
    console.error(err);
    return json_({ok:false,error:'Unable to record demo order'});
  }
}
function clean_(value,maxLen) {
  const text = String(value == null ? '' : value).trim().slice(0,maxLen);
  // Prevent user-supplied spreadsheet formulas, especially strings starting = + - @.
  return /^[=+\-@]/.test(text) ? "'"+text : text;
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
