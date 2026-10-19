/* Costo unitario de una factura de proveedor: lectura del texto del PDF y cálculo.
   Sin DOM ni red: recibe el texto que entrega InvoicePdf.extractText y devuelve datos. No guarda nada.
   Todo en pesos chilenos NETOS (sin IVA). El IVA es crédito fiscal, no costo; el impuesto adicional (ILA, tabaco)
   que la factura trae al pie sí es costo. */
(function(root){
'use strict';

const num=text=>{
  const digits=String(text??'').replace(/[^\d]/g,'');
  return digits?parseInt(digits,10):null;
};
const decimal=text=>{
  const value=Number(String(text??'').replace(/\./g,'').replace(',','.'));
  return Number.isFinite(value)?value:null;
};
const isAmount=token=>/^\d{1,3}(\.\d{3})*$|^\d+$/.test(token);
const isQty=token=>/^\d+([.,]\d+)?$/.test(token);
function toIso(text){
  const match=/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/.exec(text||'');
  if(!match)return '';
  const [,d,m,y]=match;
  if(Number(m)<1||Number(m)>12||Number(d)<1||Number(d)>31)return '';
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

// Unidades por pack según el nombre: «x 6», «x6», «x 12», «pack x 1*6».
function packSize(name){
  // Formatos de distribución: «4PCX6» y «6PFX4» (packs × unidades) y «24PF», «12PC» (unidades del pack).
  const nested=/(\d+)\s*P[CF]\s*X\s*(\d+)/i.exec(name||'');
  if(nested)return Number(nested[1])*Number(nested[2]);
  const flat=/(?<!\d)(\d{1,3})\s*P[CF](?![A-Za-z])/i.exec(name||'');
  if(flat)return Number(flat[1]);
  const star=/(\d+)\s*\*\s*(\d+)/.exec(name||'');
  if(star)return Number(star[1])*Number(star[2]);
  const matches=[...String(name||'').matchAll(/(?<![a-z])x\s*(\d{1,3})\b/gi)];
  return matches.length?Number(matches[matches.length-1][1]):1;
}

// Columnas de dinero del detalle, en el orden en que aparecen en los títulos de la factura.
const MONEY_COLUMNS=[['price',/precio/i],['discount',/desc/i],['surcharge',/recargo/i],['amount',/monto|valor|total/i]];
function moneyColumns(headerLine){
  const found=[];
  MONEY_COLUMNS.forEach(([key,re])=>{
    const match=re.exec(headerLine);
    if(match)found.push({key,at:match.index});
  });
  return found.sort((a,b)=>a.at-b.at).map(entry=>entry.key);
}

function parse(text){
  const out={ok:false,supplierName:'',rut:'',folio:'',issueDate:'',net:null,iva:null,exempt:0,total:null,
    extraTax:0,extraBreakdown:[],lines:[],freightLines:[],freightTotal:0,linesSum:null,warnings:[]};
  if(!text||text.replace(/\s/g,'').length<40){out.warnings.push('El PDF no tiene texto legible. Sube la factura electrónica original, no una foto.');return out}
  const lines=text.split('\n').map(line=>line.replace(/\s+$/,'')).filter(Boolean);

  const rut=/R\.?\s?U\.?\s?T\.?\s*:?\s*(\d{1,2}(?:\.?\d{3}){2}-[\dkK])/i.exec(text);
  if(rut)out.rut=rut[1];
  const first=lines.find(line=>line.trim());
  if(first)out.supplierName=first.split(/\s{3,}/)[0].replace(/R\.?U\.?T.*$/i,'').trim();
  const folio=/\bN[º°o]\.?\s*(\d{3,})/.exec(text);
  if(folio)out.folio=folio[1];
  const issue=/Fecha\s+(?:de\s+)?Emisi[oó]n\s*:?\s*([0-9\/.\-]{8,10})/i.exec(text);
  if(issue)out.issueDate=toIso(issue[1]);

  const net=/Monto\s+Neto\s*\$?\s*([\d.]+)/i.exec(text);
  if(net)out.net=num(net[1]);
  const iva=/IVA\s*\(\s*[\d.,]+\s*%?\s*\)\s*\$?\s*([\d.]+)/i.exec(text);
  if(iva)out.iva=num(iva[1]);
  const exempt=/Monto\s+Exento\s*\$?\s*([\d.]+)/i.exec(text);
  if(exempt)out.exempt=num(exempt[1])||0;
  const totals=[...text.matchAll(/(?:^|\s)Total\s*\$?\s*([\d.]{4,})/gim)];
  if(totals.length)out.total=num(totals[totals.length-1][1]);

  // Impuesto adicional (ILA, tabaco…): lo que sobra entre el total y neto + IVA + exento.
  if(out.total!=null&&out.net!=null&&out.iva!=null){
    const extra=out.total-out.net-out.iva-out.exempt;
    if(extra>0)out.extraTax=extra;
  }
  // Desglose informativo del pie («(18.00 %)  ILA (10.00 %)» y «$ 51.206  $ 20.956»).
  const at=lines.findIndex(line=>/Impuestos?\s+Adicionales/i.test(line));
  if(at>=0){
    const rest=lines.slice(at,at+8);
    const stop=rest.findIndex((line,index)=>index>0&&/Monto|Total/i.test(line));
    const block=(stop>0?rest.slice(0,stop):rest).join(' ');
    const rates=[...block.matchAll(/\(\s*([\d.,]+)\s*%\s*\)/g)].map(match=>match[1].replace(',','.'));
    const amounts=[...block.matchAll(/\$\s*([\d.]+)/g)].map(match=>num(match[1]));
    if(rates.length&&rates.length===amounts.length&&amounts.reduce((a,b)=>a+b,0)===out.extraTax){
      out.extraBreakdown=rates.map((rate,index)=>({rate:Number(rate),amount:amounts[index]}));
    }
  }

  const headerLine=lines.find(line=>/\bItem\b/i.test(line)&&/Cantidad/i.test(line)&&/Monto|Valor|Total/i.test(line))||'';
  const columns=headerLine?moneyColumns(headerLine):[];
  if(!columns.length||!columns.includes('amount')){out.warnings.push('No reconozco las columnas del detalle de esta factura.');return out}

  const CODE=/^[A-Za-z]{0,3}\d{3,}$/;
  const FREIGHT=/^(flete|despacho|transporte)\b/i;
  lines.forEach(line=>{
    const tokens=line.trim().split(/\s+/);
    if(!/^\d{1,4}$/.test(tokens[0])||tokens.length<columns.length+3)return;
    const money=tokens.slice(-columns.length);
    if(!money.every(isAmount))return;
    // Unidad (CAJ, PAC…) y cantidad; la línea de flete viene sin unidad.
    let unit=tokens[tokens.length-columns.length-1];
    let qtyAt=tokens.length-columns.length-2;
    if(isQty(unit)){qty=unit;unit='';qtyAt++}else{if(!/^[A-Za-zÁÉÍÓÚÑ.]{1,6}$/.test(unit))return;var qty=tokens[qtyAt]}
    if(!isQty(qty))return;
    // «Tipo Cod.» (0, INT1…) es opcional; el código puede traer letras (ET8712409).
    let start=1;
    if((/^\d$/.test(tokens[start])||/^[A-Za-z]{2,5}\d?$/.test(tokens[start]))&&CODE.test(tokens[start+1]||''))start++;
    const code=CODE.test(tokens[start]||'')?tokens[start++]:'';
    const name=tokens.slice(start,qtyAt).join(' ');
    if(!name||start>=qtyAt)return;
    const row={n:Number(tokens[0]),code,name,qty:decimal(qty),unit,packSize:packSize(name),price:0,discount:0,surcharge:0,amount:0};
    columns.forEach((key,index)=>{row[key]=num(money[index])||0});
    if(!unit&&FREIGHT.test(name))out.freightLines.push({n:row.n,name,amount:row.amount});
    else if(unit||row.qty)out.lines.push(row);
  });
  if(!out.lines.length){out.warnings.push('No encontré líneas de detalle en esta factura.');return out}
  out.freightTotal=out.freightLines.reduce((sum,line)=>sum+line.amount,0);
  out.linesSum=out.lines.reduce((sum,line)=>sum+line.amount,0)+out.freightTotal;
  out.ok=Boolean(out.folio&&out.net!=null&&out.lines.length);
  if(out.net!=null&&out.linesSum!==out.net)out.warnings.push(`La suma de las líneas ($${out.linesSum.toLocaleString('es-CL')}) no coincide con el monto neto de la factura ($${out.net.toLocaleString('es-CL')}). Revisa las cantidades.`);
  return out;
}

// Líneas sin ILA por defecto: agua sin azúcar. Es solo la casilla de partida; la persona puede cambiarla.
const defaultHasTax=name=>!/\bvital\b|\bagua\b|cachantun|watts?\b/i.test(name||'');

/* flags: arreglo de booleanos (una casilla «lleva impuesto» por línea). packs: arreglo de unidades por pack. */
function compute(parsed,{flags=[],packs=[]}={}){
  const lines=parsed.lines.map((line,index)=>{
    const pack=Math.max(1,Math.round(Number(packs[index]??line.packSize)||1));
    const units=(line.qty||0)*pack;
    return {...line,index,pack,units,hasTax:flags[index]!==undefined?Boolean(flags[index]):defaultHasTax(line.name),
      freight:0,tax:0};
  });
  const productSum=lines.reduce((sum,line)=>sum+line.amount,0);
  // Flete facturado como línea aparte: se reparte en proporción al neto de cada producto.
  if(parsed.freightTotal>0&&productSum>0){
    let left=parsed.freightTotal;
    lines.forEach((line,position)=>{
      line.freight=position===lines.length-1?left:Math.round(parsed.freightTotal*line.amount/productSum);
      left-=line.freight;
    });
  }
  // El impuesto adicional se calcula sobre el monto de la línea (sin el flete aparte).
  const base=lines.filter(line=>line.hasTax).reduce((sum,line)=>sum+line.amount,0);
  if(base>0&&parsed.extraTax>0){
    let left=parsed.extraTax;
    const taxed=lines.filter(line=>line.hasTax);
    taxed.forEach((line,position)=>{
      line.tax=position===taxed.length-1?left:Math.round(parsed.extraTax*line.amount/base);
      left-=line.tax;
    });
  }
  lines.forEach(line=>{
    line.packCost=line.qty?(line.amount+line.freight)/line.qty:0;
    line.unitNet=line.units?(line.amount+line.freight)/line.units:0;
    line.unitSurcharge=line.units?line.surcharge/line.units:0;
    line.unitTax=line.units?line.tax/line.units:0;
    line.unitReal=line.unitNet+line.unitTax;
    line.packReal=line.unitReal*line.pack;
  });
  const linesSum=productSum+(parsed.freightTotal||0);
  const net=parsed.net!=null?parsed.net:linesSum;
  const real=net+parsed.extraTax;
  return {lines,productSum,freightTotal:parsed.freightTotal||0,linesSum,net,iva:parsed.iva,extraTax:parsed.extraTax,
    total:parsed.total,real,overPct:net?(real/net-1)*100:0,
    surchargeSum:lines.reduce((sum,line)=>sum+line.surcharge,0),
    discountSum:lines.reduce((sum,line)=>sum+line.discount,0)};
}

const api={parse,compute,packSize,defaultHasTax};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.InvoiceCostCalc=api;
})(typeof window!=='undefined'?window:globalThis);
