/**
 * GOOGLE APPS SCRIPT - PLANILHA DE VIZINHOS (OPCIONAL)
 * 
 * Se você preferir usar uma Planilha do Google (Google Sheets) em vez do Firebase, siga estes passos:
 * 
 * 1. Crie uma nova planilha no Google Sheets (planilhas.google.com).
 * 2. Na primeira linha (cabeçalho), coloque:
 *    A1: ID | B1: Bloco | C1: Lote | D1: Nome | E1: Telefone | F1: Status | G1: Mensagem | H1: Data
 * 3. Vá no menu "Extensões" > "Apps Script".
 * 4. Apague tudo o que estiver lá e cole este código abaixo.
 * 5. Clique em "Implantar" (Deploy) > "Nova Implantação" (New Deployment).
 * 6. Selecione o tipo "Aplicativo da Web" (Web App).
 * 7. Em "Quem tem acesso" (Who has access), escolha "Qualquer pessoa" (Anyone).
 * 8. Copie a URL gerada e cole nas Configurações do Mapa!
 */

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var result = {};
  
  // Linha 0 é o cabeçalho
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var id = row[0];
    if (id) {
      result[id] = {
        id: id,
        block: row[1],
        lot: Number(row[2]),
        name: row[3],
        phone: String(row[4]),
        status: row[5],
        message: row[6],
        registeredAt: row[7]
      };
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var contents = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    
    if (contents.action === 'set' && contents.lot) {
      var lot = contents.lot;
      var foundRow = -1;
      
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] == lot.id) {
          foundRow = i + 1; // 1-based index
          break;
        }
      }
      
      var rowData = [lot.id, lot.block, lot.lot, lot.name, lot.phone, lot.status, lot.message, lot.registeredAt];
      
      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, 8).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }
    } else if (contents.action === 'delete' && contents.id) {
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] == contents.id) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
