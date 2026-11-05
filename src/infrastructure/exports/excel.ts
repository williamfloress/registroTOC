import type { ContributionReportData } from '../../domain/reports'
import type { FinanceReportData } from '../../domain/reports'

import { getOrgName } from '../../settings'
const getTitle = () => `${getOrgName()} · registroTOC`
const moneyFormat = '#,##0.00;[Red]-#,##0.00'

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = fileName; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function decimal(minor: number) { return minor / 100 }
function safeName(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase() }

function prepareSheet(sheet: import('exceljs').Worksheet, title: string, subtitle: string, headers: string[]) {
  sheet.mergeCells(1,1,1,headers.length)
  const titleCell=sheet.getCell(1,1);titleCell.value=getTitle();titleCell.font={bold:true,size:16,color:{argb:'FF2F2816'}}
  sheet.mergeCells(2,1,2,headers.length)
  const subtitleCell=sheet.getCell(2,1);subtitleCell.value=`${title} · ${subtitle}`;subtitleCell.font={size:12,color:{argb:'FF644B0F'}}
  const header=sheet.getRow(4);header.values=[...headers]
  header.height=25
  header.eachCell((cell)=>{cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF644B0F'}};cell.alignment={vertical:'middle',wrapText:true};cell.border={bottom:{style:'thin',color:{argb:'FFAB9E77'}}}})
  sheet.views=[{state:'frozen',ySplit:4}]
  sheet.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,printTitlesRow:'1:4',margins:{left:0.25,right:0.25,top:0.5,bottom:0.5,header:0.2,footer:0.2}}
  sheet.headerFooter.oddFooter=`&L${getTitle()}&R&P de &N`
  sheet.properties.defaultRowHeight=21
}
function finishSheet(sheet: import('exceljs').Worksheet, headerRow=4) {
  const lastRow=Math.max(headerRow,sheet.rowCount)
  const lastColumn=sheet.columnCount
  sheet.autoFilter={from:{row:headerRow,column:1},to:{row:headerRow,column:lastColumn}}
  for(let row=headerRow+1;row<=lastRow;row++){
    const current=sheet.getRow(row)
    if(row%2===0)current.eachCell((cell)=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFAF8F2'}}})
    current.eachCell((cell)=>{cell.border={bottom:{style:'hair',color:{argb:'FFE8E3D8'}}};cell.alignment={vertical:'middle'}})
  }
}

export async function exportFinanceExcel(report: FinanceReportData) {
  const ExcelJS=await import('exceljs')
  const workbook=new ExcelJS.Workbook()
  workbook.creator=getTitle();workbook.subject='Libro financiero';workbook.created=new Date()
  const movementsSheet=workbook.addWorksheet('Movimientos')
  const movementHeaders=['Fecha','Cuenta','Moneda','Concepto','Debe','Haber','Saldo']
  prepareSheet(movementsSheet,'Libro financiero',report.periodLabel,movementHeaders)
  const movementRows=report.accounts.flatMap(({account,movements})=>movements.map((movement)=>({account,movement})))
    .sort((a,b)=>a.movement.date.localeCompare(b.movement.date)||a.account.id.localeCompare(b.account.id)||a.movement.createdAt.localeCompare(b.movement.createdAt))
  for(const {account,movement} of movementRows){
    movementsSheet.addRow([new Date(`${movement.date}T12:00:00`),account.name,account.currency,movement.description,
      movement.type==='income'?decimal(movement.amountMinor):null,movement.type==='expense'?decimal(movement.amountMinor):null,decimal(movement.balanceMinor)])
  }
  movementsSheet.columns=[{width:15,style:{numFmt:'dd/mm/yyyy'}},{width:20},{width:10},{width:42},{width:17,style:{numFmt:moneyFormat}},{width:17,style:{numFmt:moneyFormat}},{width:17,style:{numFmt:moneyFormat}}]
  finishSheet(movementsSheet)

  const summarySheet=workbook.addWorksheet('Resumen del período')
  prepareSheet(summarySheet,'Resumen del período',report.periodLabel,['Cuenta','Moneda','Saldo inicial','Ingresos','Egresos','Saldo final'])
  for(const item of report.accounts)summarySheet.addRow([item.account.name,item.account.currency,decimal(item.opening),decimal(item.income),decimal(item.expense),decimal(item.closing)])
  summarySheet.columns=[{width:24},{width:12},{width:18,style:{numFmt:moneyFormat}},{width:18,style:{numFmt:moneyFormat}},{width:18,style:{numFmt:moneyFormat}},{width:18,style:{numFmt:moneyFormat}}]
  finishSheet(summarySheet)

  const balancesSheet=workbook.addWorksheet('Saldos por cuenta')
  prepareSheet(balancesSheet,'Saldos por cuenta',`Cierre · ${report.periodLabel}`,['Cuenta','Moneda','Saldo inicial','Ingresos','Egresos','Saldo al cierre'])
  for(const item of report.accounts)balancesSheet.addRow([item.account.name,item.account.currency,decimal(item.opening),decimal(item.income),decimal(item.expense),decimal(item.closing)])
  balancesSheet.columns=[{width:24},{width:12},{width:18,style:{numFmt:moneyFormat}},{width:18,style:{numFmt:moneyFormat}},{width:18,style:{numFmt:moneyFormat}},{width:20,style:{numFmt:moneyFormat}}]
  finishSheet(balancesSheet)

  const buffer=await workbook.xlsx.writeBuffer()
  saveBlob(new Blob([buffer as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`libro-financiero-${safeName(report.periodLabel)}.xlsx`)
}

export async function exportContributionsExcel(report: ContributionReportData) {
  const ExcelJS=await import('exceljs')
  const workbook=new ExcelJS.Workbook()
  workbook.creator=getTitle();workbook.subject='Control anual de aportes';workbook.created=new Date()

  const summary=workbook.addWorksheet('Resumen anual')
  prepareSheet(summary,'Resumen anual de aportes',String(report.year),['Mes','Registros pagados','Recibido USD','Recibido VES','Equivalente USD (tasa de cada pago)',...(report.reference?['Equivalente USD (dólar actual)']:[])])
  for(const item of report.months)summary.addRow([new Date(report.year,item.month-1,1),item.paidCount,decimal(item.usdMinor),decimal(item.vesMinor),decimal(item.vesEquivalentUsdMinor),...(report.reference?[decimal(item.vesAtReferenceUsdMinor??0)]:[])])
  summary.addRow(['TOTAL',report.months.reduce((sum,item)=>sum+item.paidCount,0),decimal(report.currencySummary.usdMinor),decimal(report.currencySummary.vesMinor),decimal(report.currencySummary.vesEquivalentUsdMinor),...(report.reference?[decimal(report.currencySummary.vesAtReferenceUsdMinor??0)]:[])])
  summary.columns=[{width:20,style:{numFmt:'mmmm'}},{width:20},{width:20,style:{numFmt:moneyFormat}},{width:20,style:{numFmt:moneyFormat}},{width:34,style:{numFmt:moneyFormat}},{width:30,style:{numFmt:moneyFormat}}]
  summary.getRow(summary.rowCount).font={bold:true,color:{argb:'FF644B0F'}}
  if(report.reference)summary.addRow([]),summary.addRow([`Dólar actual: ${report.reference.label} a Bs.S ${report.reference.rate.toFixed(2)} por USD (actualizado ${new Date(report.reference.updatedAt).toLocaleDateString('es-VE')}). Valor informativo.`])
  finishSheet(summary)

  const matrix=workbook.addWorksheet('Matriz de participantes')
  const matrixHeaders=['Participante','Estado',...report.months.map((item)=>new Date(report.year,item.month-1,1).toLocaleDateString('es-VE',{month:'short'}))]
  prepareSheet(matrix,'Matriz anual',String(report.year),matrixHeaders)
  const paidByParticipantMonth=new Map(report.details.filter((item)=>item.status==='Pagado').map((item)=>[`${item.contribution.participantId}:${item.contribution.month}`,item.contribution.paymentCurrency]))
  for(const person of report.participants)matrix.addRow([`${person.firstName} ${person.lastName}`,person.active?'Activo':'Inactivo',...report.months.map((item)=>paidByParticipantMonth.get(`${person.id}:${item.month}`)??'—')])
  matrix.getColumn(1).width=34;matrix.getColumn(2).width=14;for(let index=3;index<=14;index++)matrix.getColumn(index).width=13
  finishSheet(matrix)

  const details=workbook.addWorksheet('Detalle de pagos')
  prepareSheet(details,'Detalle de pagos',String(report.year),['Fecha de pago','Participante','Mes','Obligación USD','Moneda recibida','Importe recibido','Tasa VES/USD','Fuente de tasa','Estado','Lote'])
  const personById=new Map(report.participants.map((person)=>[person.id,person]))
  for(const line of report.details){const item=line.contribution;const person=personById.get(item.participantId);details.addRow([
    new Date(`${item.paymentDate}T12:00:00`),person?`${person.firstName} ${person.lastName}`:'Participante',
    `${new Date(item.year,item.month-1,1).toLocaleDateString('es-VE',{month:'long'})} ${item.year}`,
    decimal(item.requiredUsdMinor),item.paymentCurrency,decimal(item.amountPaidMinor),item.exchangeRate??'',line.batch?.rateSource??'',line.status,item.paymentBatchId,
  ])}
  details.columns=[{width:17,style:{numFmt:'dd/mm/yyyy'}},{width:28},{width:22},{width:18,style:{numFmt:moneyFormat}},{width:16},{width:20,style:{numFmt:moneyFormat}},{width:17},{width:30},{width:13},{width:38}]
  finishSheet(details)

  const currency=workbook.addWorksheet('Resumen por moneda')
  prepareSheet(currency,'Resumen por moneda',String(report.year),['Moneda recibida','Monto recibido','Moneda del monto','Equivalente USD (tasa de cada pago)',...(report.reference?['Equivalente USD (dólar actual)']:[])])
  currency.addRow(['USD',decimal(report.currencySummary.usdMinor),'USD',decimal(report.currencySummary.usdMinor),...(report.reference?[decimal(report.currencySummary.usdMinor)]:[])])
  currency.addRow(['VES',decimal(report.currencySummary.vesMinor),'VES',decimal(report.currencySummary.vesEquivalentUsdMinor),...(report.reference?[decimal(report.currencySummary.vesAtReferenceUsdMinor??0)]:[])])
  currency.columns=[{width:23},{width:22,style:{numFmt:moneyFormat}},{width:22},{width:34,style:{numFmt:moneyFormat}},{width:30,style:{numFmt:moneyFormat}}]
  finishSheet(currency)

  const buffer=await workbook.xlsx.writeBuffer()
  saveBlob(new Blob([buffer as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`aportes-${report.year}.xlsx`)
}
