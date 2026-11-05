import type { Company } from '../types';
export async function exportReport(
  format: 'pdf' | 'xlsx',
  company: Company,
  title: string,
  headers: string[],
  rows: (string | number)[][],
  period: string,
) {
  const stamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    filename = `${company.tradeName}-${title}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-]/g, '-');
  const logo = company.logo.startsWith('data:')
    ? company.logo
    : company.logo
      ? await fetch(company.logo)
          .then((r) => r.blob())
          .then(
            (b) =>
              new Promise<string>((ok, fail) => {
                const f = new FileReader();
                f.onload = () => ok(String(f.result));
                f.onerror = fail;
                f.readAsDataURL(b);
              }),
          )
      : '';
  if (format === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    const heading = () => {
      if (logo)
        doc.addImage(
          logo,
          logo.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG',
          14,
          10,
          22,
          22,
          undefined,
          'FAST',
        );
      doc.setTextColor('#172b4d');
      doc.setFontSize(16);
      doc.text(company.legalName, logo ? 42 : 14, 17);
      doc.setFontSize(10);
      doc.text(title, logo ? 42 : 14, 24);
      doc.setTextColor('#66758c');
      doc.setFontSize(8);
      doc.text(
        `${period} | ${company.cnpj || 'CNPJ não informado'} | Emitido em ${stamp}`,
        logo ? 42 : 14,
        30,
      );
    };
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 40,
      margin: { top: 40, bottom: 18 },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [23, 43, 77] },
      alternateRowStyles: { fillColor: [246, 248, 252] },
      didDrawPage: () => {
        heading();
        doc.setFontSize(8);
        doc.text('Documento de conferência · DPControl', 14, 202);
      },
    });
    doc.save(`${filename}.pdf`);
  } else {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = company.legalName;
    const ws = wb.addWorksheet('Relatório');
    ws.mergeCells('B1:H1');
    ws.getCell('B1').value = company.legalName;
    ws.getCell('B1').font = { bold: true, size: 18, color: { argb: 'FF172B4D' } };
    ws.getCell('B2').value = title;
    ws.getCell('B3').value = period;
    ws.getCell('B4').value = `${company.cnpj || 'CNPJ não informado'} · Emitido em ${stamp}`;
    ws.getRow(1).height = 32;
    if (logo) {
      const image = wb.addImage({
        base64: logo,
        extension: logo.startsWith('data:image/jpeg') ? 'jpeg' : 'png',
      });
      ws.addImage(image, { tl: { col: 0, row: 0 }, ext: { width: 66, height: 66 } });
    }
    ws.addRow([]);
    ws.addRow(headers);
    for (const row of rows)
      ws.addRow(row.map((c) => (typeof c === 'string' && /^[=+@-]/.test(c) ? `'${c}` : c)));
    ws.getRow(6).eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172B4D' } };
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });
    ws.columns.forEach((c) => {
      c.width = 25;
    });
    ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: headers.length } };
    ws.views = [{ state: 'frozen', ySplit: 6 }];
    const bytes = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(
      new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
