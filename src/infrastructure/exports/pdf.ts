import { formatMoney } from '../../domain/finance'
import type { ContributionReportData, FinanceReportData } from '../../domain/reports'
import type { jsPDF } from 'jspdf'
import type { UserOptions } from 'jspdf-autotable'

import { getOrgName, getSettings } from '../../settings'
import logoUrl from '../../assets/escudo-sm.png'
const palette={brown:[100,75,15] as [number,number,number],gold:[176,128,12] as [number,number,number],ink:[47,40,22] as [number,number,number],line:[222,212,187] as [number,number,number]}
const safeName=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase()
const fmtDate=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString('es-VE',{day:'2-digit',month:'2-digit',year:'numeric'})
const monthLabel=(year:number,month:number)=>new Date(year,month-1,1).toLocaleDateString('es-VE',{month:'long',year:'numeric'})

let logoData:string|null=null
async function loadLogo(){
  if(logoData)return
  try{
    const blob=await (await fetch(logoUrl)).blob()
    logoData=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})
  }catch{logoData=null}
}
const LOGO_H=22,LOGO_W=LOGO_H*286/360

function drawHeader(doc:jsPDF,title:string,subtitle:string){
  const width=doc.internal.pageSize.getWidth()
  const textX=logoData?14+LOGO_W+4:14
  if(logoData)doc.addImage(logoData,'PNG',14,10,LOGO_W,LOGO_H)
  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...palette.brown);doc.text(getOrgName(),textX,13)
  doc.setFontSize(15);doc.setTextColor(...palette.ink);doc.text(title,textX,22)
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(85,82,73);doc.text(subtitle,textX,29)
  const responsible=getSettings().responsible
  if(responsible){doc.setFontSize(9);doc.setTextColor(...palette.ink);doc.text(`Responsable del informe: ${responsible}`,width-14,13,{align:'right'})}
  doc.setDrawColor(...palette.line);doc.line(14,34,width-14,34)
}
function makeTable(doc:jsPDF,autoTable:(doc:jsPDF, options:UserOptions)=>void,options:UserOptions,title:string,subtitle:string){
  const original=options.didDrawPage
  const settings:UserOptions={
    margin:{top:39,right:14,bottom:17,left:14},
    styles:{font:'helvetica',fontSize:8,cellPadding:2.4,textColor:palette.ink,lineColor:palette.line,lineWidth:.15,overflow:'linebreak',valign:'middle'},
    headStyles:{fillColor:palette.brown,textColor:[255,255,255],fontStyle:'bold',fontSize:8},
    alternateRowStyles:{fillColor:[250,248,242]},
    theme:'grid',showHead:'everyPage',
    ...options,
    didDrawPage:(data)=>{drawHeader(doc,title,subtitle);original?.(data)},
  }
  autoTable(doc,settings)
}
function finalY(doc:jsPDF){return (doc as unknown as {lastAutoTable?:{finalY:number}}).lastAutoTable?.finalY??44}
function addPageNumbers(doc:jsPDF){
  const total=doc.getNumberOfPages()
  for(let page=1;page<=total;page++){
    doc.setPage(page);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(105,100,90)
    doc.text(`Página ${page} de ${total}`,doc.internal.pageSize.getWidth()-14,doc.internal.pageSize.getHeight()-6,{align:'right'})
  }
}
function addSignatureSpace(doc:jsPDF,startY:number,subtitle:string){
  const pageHeight=doc.internal.pageSize.getHeight();let y=startY+12
  if(y+37>pageHeight-12){doc.addPage();y=45;drawHeader(doc,'Libro de ingresos y egresos',subtitle)}
  doc.setDrawColor(...palette.ink);doc.setLineWidth(.25)
  const width=doc.internal.pageSize.getWidth();const left=18;const gap=18;const section=(width-left*2-gap*2)/3
  for(let index=0;index<3;index++){
    const x=left+index*(section+gap);doc.line(x,y+14,x+section,y+14)
    doc.setFontSize(8);doc.setTextColor(...palette.ink)
    if(index===0&&getSettings().responsible)doc.text(getSettings().responsible,x,y+11)
    doc.text(index===0?'Elaborado por':index===1?'Revisado por':'Aprobado por',x,y+19)
  }
  doc.setFont('helvetica','normal');doc.text('Observaciones:',left,y+31)
  doc.setDrawColor(...palette.line);doc.line(left+28,y+31,width-left,y+31)
}

export async function exportFinancePdf(report:FinanceReportData){
  const [{jsPDF},{autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable'),loadLogo()]).then(([a,b])=>[a,b] as const)
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const accounts=report.accounts
  if(!accounts.length){drawHeader(doc,'Libro de ingresos y egresos',report.periodLabel);doc.setFontSize(11);doc.text('No hay cuentas para los filtros seleccionados.',14,48)}
  for(const [index,item] of accounts.entries()){
    if(index>0)doc.addPage()
    const subtitle=`Cuenta: ${item.account.name} · Moneda: ${item.account.currency} · Período: ${report.periodLabel}`
    drawHeader(doc,'Libro de ingresos y egresos',subtitle)
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...palette.ink)
    doc.text(`Saldo inicial: ${formatMoney(item.opening,item.account.currency)}`,14,42)
    const rows=item.movements.map((movement)=>[
      fmtDate(movement.date),movement.description,
      movement.type==='income'?formatMoney(movement.amountMinor,item.account.currency):'',
      movement.type==='expense'?formatMoney(movement.amountMinor,item.account.currency):'',
      formatMoney(movement.balanceMinor,item.account.currency),
    ])
    autoTable(doc,{
      startY:47,head:[['Fecha','Concepto / descripción','Debe','Haber','Saldo']],body:rows,
      columnStyles:{0:{cellWidth:22},1:{cellWidth:'auto'},2:{cellWidth:31,halign:'right'},3:{cellWidth:31,halign:'right'},4:{cellWidth:31,halign:'right'}},
      foot:[
        ['Totales',`${rows.length} movimientos`,formatMoney(item.income,item.account.currency),formatMoney(item.expense,item.account.currency),''],
        ['','','','','Saldo final: '+formatMoney(item.closing,item.account.currency)],
      ],
      footStyles:{fillColor:[247,243,233],textColor:palette.ink,fontStyle:'bold'},
    } as UserOptions)
    addSignatureSpace(doc,finalY(doc),subtitle)
  }
  addPageNumbers(doc)
  doc.save(`libro-financiero-${safeName(report.periodLabel)}.pdf`)
}

export async function exportContributionsPdf(report:ContributionReportData){
  const [{jsPDF},{autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable'),loadLogo()]).then(([a,b])=>[a,b] as const)
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
  const subtitle=`Período anual: ${report.year} · Participantes: ${report.participants.length}`
  const participantsById=new Map(report.participants.map((person)=>[person.id,person]))

  drawHeader(doc,'Control anual de aportes',subtitle)
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(...palette.ink);doc.text('Resumen mensual',14,43)
  const totals=report.months.reduce((sum,item)=>({count:sum.count+item.paidCount,usd:sum.usd+item.usdMinor,ves:sum.ves+item.vesMinor,equiv:sum.equiv+item.vesEquivalentUsdMinor}),{count:0,usd:0,ves:0,equiv:0})
  const ref=report.reference
  makeTable(doc,autoTable,{
    startY:46,head:[['Mes','Pagados','Recibido USD','Recibido VES','Equiv. USD (tasa del pago)',...(ref?['Equiv. USD (dólar actual)']:[])]],
    body:report.months.map((item)=>[monthLabel(report.year,item.month),String(item.paidCount),formatMoney(item.usdMinor,'USD'),formatMoney(item.vesMinor,'VES'),formatMoney(item.vesEquivalentUsdMinor,'USD'),...(ref?[formatMoney(item.vesAtReferenceUsdMinor??0,'USD')]:[])]),
    foot:[['TOTAL',String(totals.count),formatMoney(totals.usd,'USD'),formatMoney(totals.ves,'VES'),formatMoney(totals.equiv,'USD'),...(ref?[formatMoney(report.currencySummary.vesAtReferenceUsdMinor??0,'USD')]:[])]],
    columnStyles:{0:{cellWidth:40},1:{cellWidth:24,halign:'right'},2:{cellWidth:38,halign:'right'},3:{cellWidth:42,halign:'right'},4:{cellWidth:'auto',halign:'right'},5:{cellWidth:'auto',halign:'right'}},
    footStyles:{fillColor:[247,243,233],textColor:palette.ink,fontStyle:'bold'},
  },'Control anual de aportes',subtitle)
  if(ref){
    const y=((doc as unknown as {lastAutoTable?:{finalY:number}}).lastAutoTable?.finalY??150)+7
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...palette.ink)
    doc.text(`Equivalente al dólar actual: ${ref.label} a Bs.S ${ref.rate.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2})} por USD (actualizado ${new Date(ref.updatedAt).toLocaleDateString('es-VE')}). Valor informativo, no reemplaza la tasa registrada en cada pago.`,14,y,{maxWidth:268})
  }

  doc.addPage('a4','landscape')
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(...palette.ink);doc.text('Matriz anual de participantes',14,43)
  const monthHeaders=Array.from({length:12},(_,index)=>new Date(report.year,index,1).toLocaleDateString('es-VE',{month:'short'}))
  const paidCells=new Map(report.details.filter((line)=>line.status==='Pagado').map((line)=>[`${line.contribution.participantId}:${line.contribution.month}`,line.contribution.paymentCurrency]))
  const matrixRows=report.participants.map((person)=>[
    `${person.firstName} ${person.lastName}${person.active?'':' (Inactivo)'}`,
    ...Array.from({length:12},(_,index)=>paidCells.get(`${person.id}:${index+1}`)??'—'),
  ])
  makeTable(doc,autoTable,{startY:47,head:[['Participante',...monthHeaders]],body:matrixRows,columnStyles:{0:{cellWidth:55,fontStyle:'bold'}},styles:{fontSize:7.5,cellPadding:2,halign:'center'},headStyles:{fillColor:palette.brown,textColor:[255,255,255],fontStyle:'bold',halign:'center'}},'Control anual de aportes',subtitle)

  doc.addPage('a4','landscape')
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(...palette.ink);doc.text('Detalle de pagos',14,43)
  const detailRows=report.details.map((line)=>{
    const item=line.contribution;const person=participantsById.get(item.participantId)
    return [fmtDate(item.paymentDate),person?`${person.firstName} ${person.lastName}`:'Participante',monthLabel(item.year,item.month),line.status,
      formatMoney(item.requiredUsdMinor,'USD'),item.paymentCurrency,formatMoney(item.amountPaidMinor,item.paymentCurrency),item.exchangeRate??'',line.batch?.rateSource??'']
  })
  makeTable(doc,autoTable,{startY:47,head:[['Fecha','Participante','Mes cubierto','Estado','Obligación','Moneda','Recibido','Tasa VES/USD','Fuente']],body:detailRows,columnStyles:{0:{cellWidth:23},1:{cellWidth:44},2:{cellWidth:35},3:{cellWidth:20},4:{cellWidth:25},5:{cellWidth:17},6:{cellWidth:29},7:{cellWidth:24},8:{cellWidth:'auto'}}},'Control anual de aportes',subtitle)
  addPageNumbers(doc)
  doc.save(`aportes-${report.year}.pdf`)
}
