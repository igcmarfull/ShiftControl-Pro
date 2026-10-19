/* Modelos de documentos (contrato, finiquito, cartas, constancias) y sus ayudas de cálculo.
   Sin DOM ni red: cada modelo declara sus campos y un build(valores) que devuelve el documento como una lista de
   bloques. documents-render.js convierte esos bloques a HTML (vista previa y PDF) y documents.js a Word.
   Los textos son modelos de partida: un asesor laboral debe revisarlos antes de darlos por oficiales. */
(function(root){
'use strict';

const COMPANY={name:'PROSERCOM SpA',rut:'77.890.722-4',address:'Quechereguas 748',city:'San Fernando'};

/* ------------------------------------------------------------ ayudas */
const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const pad=n=>String(n).padStart(2,'0');
const todayIso=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
function parts(iso){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));
  return m?{y:+m[1],m:+m[2],d:+m[3]}:null;
}
function longDate(iso){const p=parts(iso);return p?`${p.d} de ${MONTHS[p.m-1]} de ${p.y}`:''}
function shortDate(iso){const p=parts(iso);return p?`${pad(p.d)}-${pad(p.m)}-${p.y}`:''}
const clp=n=>'$ '+Math.round(Number(n)||0).toLocaleString('es-CL');
const toNum=v=>{const n=Number(String(v??'').replace(/[^\d-]/g,''));return Number.isFinite(n)?n:0};
function formatRut(value){
  const clean=String(value||'').replace(/[^0-9kK]/g,'').toUpperCase();
  if(clean.length<2)return String(value||'').trim();
  const body=clean.slice(0,-1).replace(/^0+/,'')||'0';
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g,'.')}-${clean.slice(-1)}`;
}

const UNITS=['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiún','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
const TENS=['','','','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
const HUNDREDS=['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
function below1000(n,apocope){
  if(n===0)return '';
  if(n===100)return 'cien';
  const h=Math.floor(n/100),rest=n%100;
  const out=[];
  if(h)out.push(HUNDREDS[h]);
  if(rest){
    if(rest<30){out.push(rest===1&&apocope?'un':rest===21&&apocope?'veintiún':UNITS[rest])}
    else{const t=Math.floor(rest/10),u=rest%10;out.push(u?`${TENS[t]} y ${u===1&&apocope?'un':UNITS[u]}`:TENS[t])}
  }
  return out.join(' ');
}
// 1038649 → «un millón treinta y ocho mil seiscientos cuarenta y nueve»
function numberToWords(value,beforeNoun){
  let n=Math.floor(Math.abs(Number(value)||0));
  if(n===0)return 'cero';
  const millions=Math.floor(n/1e6),thousands=Math.floor((n%1e6)/1e3),rest=n%1e3;
  const out=[];
  if(millions)out.push(millions===1?'un millón':`${below1000(millions,true)} millones`);
  if(thousands)out.push(thousands===1?'mil':`${below1000(thousands,true)} mil`);
  if(rest)out.push(below1000(rest,!!beforeNoun));
  return out.join(' ');
}
// Ante «pesos» el uno pierde la «o»: un peso, treinta y un pesos, veintiún pesos.
const pesosInWords=n=>`${numberToWords(n,true)} ${Math.round(Number(n))===1?'peso':'pesos'}`;

// Reparte un total en cuotas enteras; la última absorbe el resto.
function splitInstallments(total,count){
  const n=Math.max(1,Math.round(count)||1);
  const base=Math.floor(total/n);
  const out=Array(n).fill(base);
  out[n-1]=total-base*(n-1);
  return out;
}

const ORD_UNITS=['','primero','segundo','tercero','cuarto','quinto','sexto','séptimo','octavo','noveno'];
const ORD_TENS=['','décimo','vigésimo','trigésimo'];
function ordinal(n){
  const t=Math.floor(n/10),u=n%10;
  const text=t===0?ORD_UNITS[u]:u===0?ORD_TENS[t]:`${ORD_TENS[t]} ${ORD_UNITS[u]}`;
  return text.charAt(0).toUpperCase()+text.slice(1);
}

/* ------------------------------------------------------------ bloques */
// Runs: r(texto) normal · b(texto) negrita · f(valor, vacío) dato que se completa (se resalta en la vista previa).
const r=text=>({text:String(text)});
const b=text=>({text:String(text),b:true});
const f=(value,blank='____________')=>({text:String(value||'').trim()||blank,f:true,empty:!String(value||'').trim()});
const P=(runs,opts={})=>({t:'p',runs:Array.isArray(runs)?runs:[r(runs)],...opts});
const CL=(n,runs,opts={})=>P([b(`${ordinal(n).toUpperCase()}: `),...(Array.isArray(runs)?runs:[r(runs)])],{align:'justify',...opts});
const TITLE=text=>({t:'title',text});
const HEADING=text=>({t:'heading',text});
const SIGN=(...cols)=>({t:'sign',cols});
const AMOUNTS=rows=>({t:'amounts',rows});
const BREAK={t:'break'};
const SPACER=(h=10)=>({t:'spacer',h});

const slug=text=>String(text||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'');
const person=v=>String(v||'').trim();

/* ------------------------------------------------------------ campos comunes */
const F={
  city:(d='San Fernando')=>({key:'city',label:'Ciudad',type:'text',default:d}),
  date:(label='Fecha')=>({key:'date',label,type:'date',default:'today'}),
  legalRep:()=>({key:'legalRep',label:'Representante legal',type:'text',remember:true,hint:'Quien firma por Prosercom'}),
  legalRepRut:()=>({key:'legalRepRut',label:'RUT del representante',type:'text',remember:true}),
  workerName:()=>({key:'workerName',label:'Trabajador(a)',type:'text',auto:'name'}),
  workerRut:()=>({key:'workerRut',label:'RUT',type:'text',auto:'rut'}),
  workerRole:(label='Cargo')=>({key:'workerRole',label:label,type:'text',auto:'role'}),
  startDate:(label='Fecha de ingreso')=>({key:'startDate',label,type:'date',auto:'start'})
};

/* ------------------------------------------------------------ causales */
const CAUSALS=[
  {id:'159-1',label:'Art. 159 N° 1 · Mutuo acuerdo de las partes',text:'Art. 159 N° 1 del Código del Trabajo, «Mutuo acuerdo de las partes»',facts:false},
  {id:'159-2',label:'Art. 159 N° 2 · Renuncia del trabajador',text:'Art. 159 N° 2 del Código del Trabajo, «Renuncia del trabajador»',facts:false},
  {id:'159-4',label:'Art. 159 N° 4 · Vencimiento del plazo convenido',text:'Art. 159 N° 4 del Código del Trabajo, «Vencimiento del plazo convenido en el contrato»',facts:false},
  {id:'159-5',label:'Art. 159 N° 5 · Conclusión del trabajo o servicio',text:'Art. 159 N° 5 del Código del Trabajo, «Conclusión del trabajo o servicio que dio origen al contrato»',facts:false},
  {id:'160-1',label:'Art. 160 N° 1 · Conductas indebidas de carácter grave',text:'Art. 160 N° 1 del Código del Trabajo, «Conductas indebidas de carácter grave, debidamente comprobadas»',facts:true},
  {id:'160-3',label:'Art. 160 N° 3 · Inasistencias sin causa justificada',text:'Art. 160 N° 3 del Código del Trabajo, «No concurrencia del trabajador a sus labores sin causa justificada durante dos días seguidos, dos lunes en el mes o un total de tres días durante igual período de tiempo»',facts:true},
  {id:'160-4',label:'Art. 160 N° 4 · Abandono del trabajo',text:'Art. 160 N° 4 del Código del Trabajo, «Abandono del trabajo por parte del trabajador»',facts:true},
  {id:'160-6',label:'Art. 160 N° 6 · Perjuicio material intencional',text:'Art. 160 N° 6 del Código del Trabajo, «Perjuicio material causado intencionalmente en las instalaciones, maquinarias, herramientas, útiles de trabajo, productos o mercaderías»',facts:true},
  {id:'160-7',label:'Art. 160 N° 7 · Incumplimiento grave del contrato',text:'Art. 160 N° 7 del Código del Trabajo, «Incumplimiento grave de las obligaciones que impone el contrato»',facts:true},
  {id:'161',label:'Art. 161 inc. 1° · Necesidades de la empresa',text:'Art. 161 inciso 1° del Código del Trabajo, «Necesidades de la empresa, establecimiento o servicio»',facts:true}
];
const causalOptions=()=>CAUSALS.map(c=>({value:c.id,label:c.label}));
const causalOf=id=>CAUSALS.find(c=>c.id===id)||CAUSALS[0];

/* ------------------------------------------------------------ anexo de obligaciones (parte del contrato) */
const ANNEX=[
 'Defraudar al público y al Fisco no otorgando, perdiendo, utilizando o adulterando precios y/o guías de despacho, facturas o boletas de venta, en todos los productos comercializados por la empresa, en los casos y formas establecidos por las leyes y reglamentos.',
 'Intervenir de alguna manera los mecanismos de las bombas surtidoras de combustibles; intervenir sin autorización mecanismos para la venta de combustibles, tales como filtros y estanques de combustibles, máquinas generadoras de voucher, comprobantes, boletas y facturas; cobrar o cambiar distintos precios fijados por la empresa.',
 'No realizar las ventas anexas designadas en la estación (venta de alimentos, lubricantes, recargas telefónicas, cigarrillos ni promociones), las cuales se encuentran a su cargo junto con el expendio de combustible. Además, no permanecer en el puesto de trabajo, estando en lugares de la instalación, sin autorización de la jefatura.',
 'Recibir vehículos u otros objetos en custodia a cualquier título, salvo autorización expresa del jefe respectivo.',
 'Conducir vehículos de clientes del servicentro, sin autorización expresa del jefe respectivo.',
 'Vender o negociar en el servicentro cualquier tipo de mercaderías que no sean de aquellas autorizadas por la empresa, o expresamente autorizadas por la administración.',
 'Vender productos que no se encuentren con sus respectivos sellos o graneles adulterados.',
 {text:'Expender combustible a vehículos:',sub:['De la locomoción colectiva con pasajeros en su interior.','Con el motor en marcha.','Con personas fumando en su interior.','No podrá cargar combustible a motos, motonetas o motocicletas sin que previamente su conductor y acompañante hayan descendido de ella.']},
 'Vender kerosene o cualquier combustible en envase de vidrio.',
 'Pactar o aceptar trabajos con clientes a realizar en forma particular y directa, aprovechando la calidad de trabajador del servicentro, en abierta falta a la ética y en desmedro de los negocios y/o servicios propios del establecimiento.',
 'Registrar dos o más faltantes al mes en el resumen diario de ventas (planillas de combustible y de tienda), ni entregar en el buzón de recepción de dinero el turno respectivo pasada una hora de terminado el turno.',
 'Cambiar cheques o dar vueltos superiores a las ventas efectuadas, sin el V°B° de la oficina; recibir cheques de terceros y sin tarjeta de cliente emitida y aprobada por la oficina administrativa.',
 'Dar dinero por vales de cuentas corrientes, los que solo se utilizan en ventas efectivas al crédito.',
 'Dar mala atención de hecho o de palabra a clientes, causando deterioro a la imagen de la empresa; no dar pronta y cordial atención a los clientes a menos que las circunstancias no lo permitan, así como no proceder bajo los estándares de atención requeridos por la empresa y el mandante PROSERCOM SpA, no respetando u omitiendo acciones requeridas para el óptimo servicio. Se declara al momento de firmar este anexo de contrato conocer ampliamente los pasos fijados por la empresa para la atención de clientes, quedando en conocimiento de las partes que el incumplimiento de uno o todos los actos requeridos para la atención de clientes será considerado falta grave, causal de término de contrato.',
 'Faltar en días domingos, festivos o de noche correspondiendo trabajar y estando a cargo de una máquina o servicio.',
 'Queda estrictamente prohibido ingerir bebidas alcohólicas y drogas en el servicentro, o permitir que otras personas ajenas a la instalación lo hagan. Además, recibir visitas personales dentro de su horario de trabajo, las cuales no sean clientes y que sobrepasen la estadía en tiempo correspondiente en la instalación como clientes.',
 'Será considerada falta gravísima y motivo de despido inmediato del trabajador defraudar o intentar defraudar al público, ya sea en la cantidad o en el precio de los productos vendidos. La misma gravedad se considerará para el trabajador que sea sorprendido no otorgando la boleta de venta o guía de despacho correspondiente, o bien emitiendo por una cantidad distinta a la real.',
 'El trabajador se hará responsable por cheques recibidos, en el caso que el cheque no sea pagado por el banco y que el titular de la cuenta corriente no esté registrado en la administración autorizado para consumir con cheque, otorgándole una tarjeta para tal trámite, la cual deberá ser exigida por el trabajador al cliente antes de consumir, para lo cual deberá anotar al reverso del documento el RUT, nombre, patente y fono del titular de dicha cuenta corriente e identificar adecuadamente firma, marca y patente del vehículo, solicitándole su carnet de identidad para comprobar datos, y el monto deberá ser por el valor de la compra en productos y/o servicios. El empleador podrá descontar la totalidad del documento de la liquidación de sueldo correspondiente, dentro de los límites que fija la ley, sin perjuicio de la facultad que le otorga el Código del Trabajo, artículo 160 causal N° 7, al empleador para poner término al contrato de trabajo.',
 'El trabajador se compromete a hacer correcto uso de los elementos promocionales entregados por el empleador.',
 'Los reajustes de remuneraciones por ley se entenderán incorporados desde su fecha de vigencia efectiva y por los plazos señalados por la misma.',
 'Queda estrictamente prohibido el ingreso de personas extrañas a la oficina de los operadores, más aún durante los momentos de entrega y cierre de la planilla por término del turno.',
 'La puerta de ingreso a la oficina de los atendedores deberá permanecer cerrada, con mayor razón durante los movimientos de dinero.',
 'Durante los turnos los atendedores no podrán mantener en su poder sumas superiores a $100.000 para vueltos; cifras superiores en su poder serán de su exclusiva responsabilidad pecuniaria en caso de atentados por delincuentes.',
 {text:'La presentación personal será la imagen de cada uno de los atendedores y del servicentro; por lo expuesto, será obligación para el personal mantener su ropa aseada y planchada, pelo corto y afeitado, y zapatos lustrados. Será obligación usar uniforme completo durante la totalidad de su turno. Se entiende con uniforme completo: pantalón, camisa, gorro, polar, piocha colgante, zapatos; todos estos según lo establecido por la compañía y la empresa, quedando estrictamente prohibido el uso de prendas que no correspondan con el uniforme fijado por la empresa.',after:'Cabe señalar que será falta gravísima y causal de término inmediato de contrato el ser sorprendido no haciendo uso de una o más de las prendas del uniforme de trabajo, así como la pérdida de una o más de estas sin ser informado oportunamente a la administración y el uso del uniforme de trabajo en labores privadas fuera del horario y lugar de trabajo.'},
 'Los elementos y maquinarias de uso del servicentro pueden tener un desgaste y deterioro normal; sin embargo, el deterioro por negligencia o mal trato será de responsabilidad del causante, o del turno completo de no haber uno identificado y por no informar tales daños físicos a la instalación (nombres, patentes, vehículo, etc.), para los efectos de delimitación de responsabilidades pecuniarias respectivas y trámites con Carabineros y compañía de seguro del servicentro.',
 'El interés e incentivos por las ventas será responsabilidad del empleador y el trabajador.',
 {text:'El mantenimiento del servicentro será preocupación permanente y diaria de todo el personal, quedando en expreso conocimiento del trabajador, al momento de firmar este anexo de contrato, la obligación del mantenimiento y aseo de toda la instalación. Estas labores diarias son:',sub:['Aseo general y barrido de pisos en la totalidad de la instalación, tanto adentro como afuera.','Limpieza de máquinas surtidoras de combustibles y máquinas que se encuentren en islas.','Corte y barrido de pasto (según sea requerido).','Mantención y reparación general de las instalaciones, cambio de ampolletas y toda labor requerida por la administración que no lleve a poner en riesgo la integridad física.','Recolección de bolsas con excedentes de toda la instalación y llevarlas al lugar de almacenaje.','Verificar diariamente la correcta posición de pendones y mástiles de banderas, como del material de promoción entregado a cargo.','La correcta reposición y mantenimiento de alimentos en tienda, velando por su correcta exhibición y mantención, así como según los procedimientos de higiene y manipulación.'],after:'Será causal de término de contrato la no realización de una o más de estas labores diarias. Además, el trabajador está facultado y obligado a informar a la administración de forma inmediata alguna anomalía encontrada a la entrada de su turno que sea producida por negligencia del turno anterior.'},
 'Durante las noches, será responsabilidad de los trabajadores que cubran el turno la integridad física de los elementos existentes (maquinarias, computadores, registradoras, impresoras, letreros, vehículos, etc.), debiendo dar al día siguiente cuenta de ello, a través de los buzones, de las planillas o esperar algún jefe si no lo hubiera en la noche.',
 'Las pérdidas y deterioros por negligencia y/o maltrato de las especies entregadas a su cargo les serán descontados de sus haberes mensuales, dentro de los límites que fija la ley.',
 {text:'Se otorgarán anticipos los días 20 de cada mes, de hasta un 40% de lo que a cada trabajador le correspondiera percibir en esa fecha; sin embargo, si el trabajador tiene deudas con la empresa, el monto del anticipo no podrá exceder de la diferencia de dicha obligación.',after:'En caso que la deuda sea mayor al 40%, no habrá derecho a anticipo.'},
 {text:'Queda estrictamente prohibido, durante las horas de trabajo, la permanencia en el local de familiares, amigos o personas conocidas del trabajador por más tiempo de lo debido en su calidad de cliente y cuando no existe jefatura presente en el local.',after:'De existir una situación así, se deberá solicitar autorización a la jefatura directa para la permanencia de personas ajenas a la empresa. El no cumplimiento de lo anterior será causa de término de contrato.'},
 'Durante su turno, está prohibido el uso de teléfono celular, reproductor de música y/o cualquier aparato que distraiga la atención a su puesto de trabajo.',
 'Es de exclusiva responsabilidad del trabajador verificar que la venta de tarjeta flota corresponda a la placa patente del vehículo que figura en la tarjeta; además, revisar indicaciones y restricciones de cada tarjeta. Será obligación del trabajador el correcto llenado de los voucher de venta con todos los datos del cliente que retira combustible.',
 'Cláusula de confidencialidad. Queda estrictamente prohibido entregar a terceros ajenos a la empresa información operativa de la estación, como movimientos de dinero, montos vendidos, cartera de clientes y todo lo que afecte en imagen y seguridad tanto a trabajadores como a la empresa. De constatarse algún hecho será causa de término de contrato.'
];

/* ------------------------------------------------------------ modelos */
const TEMPLATES=[];

// ---- Contrato de trabajo (+ anexo de obligaciones y prohibiciones)
TEMPLATES.push({
  id:'contrato',name:'Contrato de trabajo',cat:'Contratos',icon:'§',
  desc:'Contrato con sus 14 cláusulas y el anexo de obligaciones y prohibiciones. Se completa con los datos del trabajador.',
  fields:[F.city(),F.date('Fecha del contrato'),F.legalRep(),F.legalRepRut(),
    F.workerName(),{key:'nationality',label:'Nacionalidad',type:'text',default:'Chilena'},{key:'birth',label:'Fecha de nacimiento',type:'date'},
    {key:'address',label:'Domicilio del trabajador',type:'text',full:true},F.workerRut(),
    {key:'civil',label:'Estado civil',type:'select',options:['Soltero(a)','Casado(a)','Divorciado(a)','Viudo(a)','Conviviente civil'],default:'Soltero(a)'},
    {key:'afp',label:'AFP',type:'text'},{key:'health',label:'Salud',type:'text',default:'Fonasa'},
    {key:'job',label:'Trabajo a ejecutar y lugar',type:'textarea',full:true,default:'Expendedor(a) de combustible, Isla Aramco, ubicada en Camino a Peumo S/N con Monseñor Lecaros, Coltauco'},
    {key:'schedule',label:'Jornada',type:'textarea',full:true,default:'turnos rotativos de 07:00 a 15:00, 15:00 a 23:00 y 23:00 a 07:00, o de 08:00 a 16:00, 16:00 a 23:59 y 00:00 a 08:00, considerando un tiempo de 30 minutos de colación'},
    {key:'netSalary',label:'Sueldo líquido mensual ($)',type:'money'},{key:'caja',label:'Asignación de caja ($)',type:'money',default:'10000'},
    {key:'colacion',label:'Bono colación ($)',type:'money',default:'0'},{key:'movilizacion',label:'Bono movilización ($)',type:'money',default:'10000'},
    F.startDate('Fecha de ingreso'),
    {key:'term',label:'Duración',type:'select',options:['Plazo fijo','Indefinido'],default:'Plazo fijo'},
    {key:'endDate',label:'Plazo fijo hasta',type:'date',showIf:{key:'term',value:'Plazo fijo'}},
    {key:'annex',label:'Incluir anexo de obligaciones y prohibiciones',type:'check',default:true}
  ],
  build(v){
    const dur=v.term==='Indefinido'?[r('El presente contrato tendrá una duración indefinida. ')]:[r('El presente contrato tendrá una duración hasta el '),f(longDate(v.endDate)),r('. ')];
    const body=[
      TITLE('CONTRATO DE TRABAJO'),
      P([r('En '),f(v.city),r(', a '),f(longDate(v.date)),r(', '),b(COMPANY.name),r(`, RUT ${COMPANY.rut}, representada por `),f(v.legalRep),r(', RUT '),f(v.legalRepRut),r(`, con domicilio en casa matriz: ${COMPANY.address}, comuna de ${COMPANY.city}, y don(ña) `),f(v.workerName),r(', de nacionalidad '),f(v.nationality),r(', nacido(a) el '),f(longDate(v.birth)),r(', domiciliado(a) en '),f(v.address),r(', RUT '),f(v.workerRut),r(', estado civil '),f(v.civil),r(', AFP '),f(v.afp),r(', salud '),f(v.health),r(', se ha convenido el siguiente contrato de trabajo, para cuyos efectos las partes convienen denominarse, respectivamente, empleador y trabajador.')],{align:'justify'}),
      CL(1,[r('El trabajador se compromete a ejecutar el trabajo de: '),f(v.job),r(', de acuerdo a las necesidades de la empresa. Cada vez que las circunstancias lo requieran y de conformidad con el artículo 12 del Código del Trabajo, podrá el empleador modificar las funciones del trabajador y/o el lugar donde habrá de desarrollar sus funciones.')]),
      CL(2,'El trabajador se obliga a observar fiel e íntegramente las normas y disposiciones que impartan sus superiores, las que se señalan en el anexo de este contrato de trabajo que también suscribe, y demás disposiciones que las leyes impongan al trabajador, las que se tendrán como integrantes del presente contrato. Cabe señalar que el incumplimiento de lo anterior será causal de término de contrato.'),
      CL(3,[r('La jornada de trabajo será de '),f(v.schedule),r('.')]),
      CL(4,'Las horas extraordinarias se pagarán de acuerdo a la legislación vigente. Queda estrictamente prohibido al trabajador trabajar horas extraordinarias sin autorización escrita de sus jefes. No se considerarán horas extraordinarias las trabajadas en compensación de un permiso.'),
      CL(5,[r('En remuneración de los servicios del trabajador, el empleador le pagará un sueldo mensual (que incluye sueldo base y comisiones, si se le otorgaren), que se pagará por períodos vencidos, dentro de los 5 primeros días hábiles de cada mes, en el lugar donde el trabajador desempeñe sus funciones. El sueldo líquido será de '),f(v.netSalary?clp(v.netSalary):''),r(v.netSalary?` (${pesosInWords(toNum(v.netSalary))}).`:'.')]),
      P([r(`Asignación de caja ${clp(v.caja)}`)],{indent:1,after:0}),P([r(`Bono colación ${clp(v.colacion)}`)],{indent:1,after:0}),P([r(`Bono movilización ${clp(v.movilizacion)}`)],{indent:1}),
      CL(6,'El trabajador percibirá la gratificación legal garantizada que establece el artículo 47 y, en particular, con respecto al artículo 50 del Código del Trabajo, consistente en el 25% legal.'),
      CL(7,'De las remuneraciones del trabajador podrá deducirse toda deuda (faltantes), anticipos o préstamos que haya otorgado el empleador, como las demás deducciones que autoriza la ley, dentro de los límites fijados por esta, efectuando igual deducción en el finiquito.'),
      CL(8,[...dur,r('No obstante lo anterior, las partes señalan que están plenamente informadas de que el presente contrato de trabajo es derivación del contrato de concesión que rige a su vez entre el empleador y la petrolera Esmax Distribución SpA, licenciatario Aramco en Chile; en consecuencia, ambas partes convienen en dejar establecido que están conscientes de que, en el evento de producirse la terminación de la concesión, el presente contrato de trabajo terminará de inmediato, produciéndose la causal del artículo 159 N° 5 del Código del Trabajo.')]),
      CL(9,'El presente contrato sustituye y deja sin efecto cualquier otro celebrado con anterioridad entre las partes.'),
      CL(10,'Se declara expresamente por las partes que será causal de término del contrato de trabajo las diferencias reiteradas y/o faltantes de dinero que presente el trabajador cuando haga entrega de su respectivo turno. Asimismo, el trabajador estará obligado a emitir correctamente y según las disposiciones administrativas del Servicio de Impuestos Internos las boletas de ventas o guías de despacho por la totalidad de las ventas que efectúe.'),
      P('Las partes acuerdan desde ya que el incumplimiento de estas obligaciones será causal de despido de acuerdo a lo dispuesto en el artículo 160 del Código del Trabajo, por constituir ello falta grave, producto exclusivo de negligencia.',{align:'justify'}),
      CL(11,'Si en el desempeño de sus funciones el trabajador recibe en pago de productos o servicios cheques con cifras superiores a la capacidad en litros del estanque del vehículo y no autorizados por sus superiores, se estipula que será el único responsable en caso de su no pago por el banco. En tal evento, los valores correspondientes serán descontados en sus próximas liquidaciones de remuneraciones, dentro de los límites que fija la ley, sin perjuicio de la facultad que le otorga al empleador para poner término de contrato por la causal del N° 7 del artículo 160 del Código del Trabajo.'),
      CL(12,[r('Para todos los efectos de este contrato se deja expresa constancia que el trabajador ingresó al servicio el '),f(longDate(v.startDate)),r('.')]),
      CL(13,'Será obligación del trabajador firmar oportunamente el libro de asistencia conforme a las disposiciones laborales vigentes. La infracción a esta cláusula constituirá infracción grave de las obligaciones que le impone el contrato de trabajo.'),
      CL(14,'El presente contrato se firma en dos ejemplares del mismo tenor, quedando un ejemplar en poder del trabajador y uno en poder del empleador.'),
      P([b('PRIMERA RENOVACIÓN: '),r('con fecha ______ de ______________ de ________ las partes acuerdan renovar el presente contrato hasta el ______ de ______________ de ________.')],{align:'justify'}),
      SIGN([COMPANY.name,`RUT ${COMPANY.rut}`,person(v.legalRep)||'Representante legal','EMPLEADOR'],[person(v.workerName)||'Trabajador(a)',person(v.workerRut)?`RUT ${person(v.workerRut)}`:'RUT','','TRABAJADOR(A)'])
    ];
    if(v.annex!==false){
      body.push(BREAK,HEADING('ANEXO DE CONTRATO'));
      body.push(P([r('El trabajador: '),f(v.workerName),r(', RUT '),f(v.workerRut),r(`, declara tomar conocimiento y se obliga a respetar las siguientes cláusulas y prohibiciones que le afectarán en su desempeño laboral, las que para todos los efectos legales se consideran parte integrante del contrato de trabajo suscrito con ${COMPANY.name} con fecha `),f(shortDate(v.date)),r('. En consecuencia, su no observancia se considerará incumplimiento grave de las obligaciones que le impone el contrato de trabajo, siendo causal de término de contrato:')],{align:'justify'}));
      ANNEX.forEach((item,i)=>{
        const text=typeof item==='string'?item:item.text;
        body.push(CL(i+1,text));
        if(typeof item!=='string'){
          (item.sub||[]).forEach(line=>body.push(P(`– ${line}`,{indent:1,align:'justify',after:3})));
          if(item.after)body.push(P(item.after,{align:'justify'}));
        }
      });
      body.push(P([b('ACUSE DE RECIBO: '),r('Certifico haber tomado conocimiento de lo anterior, y haber recibido copia del presente contrato de trabajo y anexo de este mismo, y de haber recibido copia del reglamento interno de la empresa.')],{align:'justify'}),
        SIGN([person(v.legalRep)||'Representante legal','EMPLEADOR'],[person(v.workerName)||'Trabajador(a)','TRABAJADOR(A)']));
    }
    return {title:'Contrato de trabajo',blocks:body,fileName:`Contrato_${slug(v.workerName)||'trabajador'}`};
  }
});

// ---- Anexo de contrato
const ANNEX_TYPES=['Cambio de cargo o funciones','Cambio de jornada','Cambio de remuneración','Renovación de plazo','Otra modificación'];
TEMPLATES.push({
  id:'anexo',name:'Anexo de contrato',cat:'Contratos',icon:'+',
  desc:'Modifica o complementa un contrato vigente: cambio de cargo, jornada, remuneración o renovación.',
  fields:[F.city(),F.date(),F.legalRep(),F.legalRepRut(),F.workerName(),F.workerRut(),
    {key:'contractDate',label:'Fecha del contrato original',type:'date'},
    {key:'kind',label:'Qué se modifica',type:'select',options:ANNEX_TYPES,default:ANNEX_TYPES[0]},
    {key:'detail',label:'Detalle de la modificación',type:'textarea',full:true,hint:'Ej.: «a contar de la fecha, el trabajador se desempeñará como …»'},
    {key:'effective',label:'Rige desde',type:'date'},
    {key:'endDate',label:'Nuevo plazo hasta',type:'date',showIf:{key:'kind',value:'Renovación de plazo'}}],
  build(v){
    const what=v.kind==='Renovación de plazo'
      ?[r('Las partes acuerdan renovar el contrato de trabajo por un nuevo plazo, hasta el '),f(longDate(v.endDate)),r('. '),f(v.detail,'')]
      :[r(`${v.kind}: `),f(v.detail)];
    return {title:'Anexo de contrato',fileName:`Anexo_${slug(v.workerName)||'trabajador'}`,blocks:[
      TITLE('ANEXO DE CONTRATO DE TRABAJO'),
      P([r('En '),f(v.city),r(', a '),f(longDate(v.date)),r(', entre '),b(COMPANY.name),r(`, RUT ${COMPANY.rut}, representada por `),f(v.legalRep),r(', RUT '),f(v.legalRepRut),r(', en adelante el empleador, y don(ña) '),f(v.workerName),r(', RUT '),f(v.workerRut),r(', en adelante el trabajador, se acuerda el siguiente anexo al contrato de trabajo de fecha '),f(longDate(v.contractDate)),r(':')],{align:'justify'}),
      CL(1,what),
      CL(2,[r('La modificación regirá a contar del '),f(longDate(v.effective)),r('.')]),
      CL(3,'Las demás cláusulas del contrato de trabajo no modificadas por el presente anexo mantienen plena vigencia.'),
      CL(4,'El presente anexo se firma en dos ejemplares del mismo tenor, quedando uno en poder de cada parte.'),
      SIGN([COMPANY.name,person(v.legalRep)||'Representante legal','EMPLEADOR'],[person(v.workerName)||'Trabajador(a)',person(v.workerRut)?`RUT ${person(v.workerRut)}`:'RUT','TRABAJADOR(A)'])
    ]};
  }
});

// ---- Finiquito
const PAY_MODES=['En este acto','En 1 cuota','En 2 cuotas','En 3 cuotas'];
TEMPLATES.push({
  id:'finiquito',name:'Finiquito',cat:'Término de contrato',icon:'✓',
  desc:'Con la causal, los montos y el total en letras. Reparte el pago en cuotas con sus fechas.',
  fields:[F.city(),F.date('Fecha del finiquito'),F.legalRep(),F.legalRepRut(),F.workerName(),F.workerRut(),F.workerRole(),
    F.startDate('Inicio de servicios'),{key:'endDate',label:'Término de servicios',type:'date',default:'today'},
    {key:'causal',label:'Causal de término',type:'select',options:causalOptions(),default:'159-1',full:true},
    {key:'c1',label:'Concepto 1',type:'text',default:'Vacaciones proporcionales'},{key:'a1',label:'Monto 1 ($)',type:'money'},
    {key:'c2',label:'Concepto 2',type:'text',default:'Indemnización voluntaria'},{key:'a2',label:'Monto 2 ($)',type:'money'},
    {key:'c3',label:'Concepto 3',type:'text'},{key:'a3',label:'Monto 3 ($)',type:'money'},
    {key:'c4',label:'Concepto 4',type:'text'},{key:'a4',label:'Monto 4 ($)',type:'money'},
    {key:'pay',label:'Forma de pago',type:'select',options:PAY_MODES,default:PAY_MODES[0]},
    {key:'account',label:'Cuenta bancaria o medio de pago',type:'text',showIf:{key:'pay',not:'En este acto'}},
    {key:'d1',label:'Fecha cuota 1',type:'date',showIf:{key:'pay',not:'En este acto'}},
    {key:'d2',label:'Fecha cuota 2',type:'date',showIf:{key:'pay',in:['En 2 cuotas','En 3 cuotas']}},
    {key:'d3',label:'Fecha cuota 3',type:'date',showIf:{key:'pay',value:'En 3 cuotas'}}],
  build(v){
    const rows=[1,2,3,4].map(i=>({label:person(v[`c${i}`]),amount:toNum(v[`a${i}`])})).filter(x=>x.label&&x.amount>0);
    const total=rows.reduce((s,x)=>s+x.amount,0);
    const causal=causalOf(v.causal);
    const nPay=v.pay==='En 3 cuotas'?3:v.pay==='En 2 cuotas'?2:v.pay==='En 1 cuota'?1:0;
    const inst=nPay?splitInstallments(total,nPay):[];
    const dates=[v.d1,v.d2,v.d3];
    const payText=!nPay?[r('La cual se paga en este acto, a entera satisfacción del trabajador.')]
      :[r(`La cual se pagará en ${nPay===1?'una cuota':nPay===2?'dos cuotas':'tres cuotas'}, a conformidad completa de ambas partes, a través de transferencia bancaria a la cuenta `),f(v.account),r(', según detalle: '),...inst.flatMap((amount,i)=>[f(`${shortDate(dates[i])} ${clp(amount)}`.trim()),r(i<inst.length-1?', ':'.')])];
    const blocks=[
      TITLE('FINIQUITO'),
      P([r('En '),f(v.city),r(', '),f(longDate(v.date)),r(', entre '),b(COMPANY.name),r(` RUT ${COMPANY.rut}, representada por don(ña) `),f(v.legalRep),r(' C.I. '),f(v.legalRepRut),r(`, ambos con domicilio en ${COMPANY.address}, comuna de ${COMPANY.city}, y don(ña) `),f(v.workerName),r(', C.I. '),f(v.workerRut),r(', se acuerda el siguiente finiquito:')],{align:'justify'}),
      CL(1,[r('Don(ña) '),f(v.workerName),r(' declara haber prestado servicios a '),r(COMPANY.name),r(', en calidad de '),f(v.workerRole),r(', desde el '),f(longDate(v.startDate)),r(' hasta el '),f(longDate(v.endDate)),r(', fecha esta última de terminación de sus servicios por la siguiente causa, de acuerdo a lo dispuesto en el '),f(causal.text),r('.')]),
      CL(2,[r('Don(ña) '),f(v.workerName),r(` declara recibir en este acto, a su entera satisfacción, de parte de ${COMPANY.name}, la suma que a continuación se indica, por el concepto:`)]),
      AMOUNTS([...rows.map(x=>({label:x.label.toUpperCase(),amount:clp(x.amount)})),{label:'TOTAL',amount:clp(total),bold:true}]),
      P([r('Son: '),f(total?`${pesosInWords(total)}.`:'')],{after:6}),
      P(payText,{align:'justify'}),
      CL(3,[r('Don(ña) '),f(v.workerName),r(` deja constancia que durante todo el tiempo que le prestó servicios a ${COMPANY.name}, recibió de ella, correcta y oportunamente, el total de las remuneraciones convenidas, de acuerdo con su contrato de trabajo, clase de trabajo ejecutado, reajustes legales, pago de asignaciones familiares autorizadas por la respectiva institución de previsión, horas extraordinarias cuando las trabajó, feriados legales, gratificaciones y participaciones, en conformidad a la ley, y que nada se le adeuda por los conceptos antes indicados ni por ningún otro, sea de origen legal o contractual derivados de la prestación de sus servicios, y motivo por el cual, no teniendo reclamo ni cargo alguno que formular en contra de ${COMPANY.name}, le otorga el más amplio y total finiquito, declaración que formula libre y espontáneamente, en perfecto y cabal conocimiento de cada uno y de todos sus derechos.`)]),
      CL(4,`Según Ley 21.389, ${COMPANY.name} declara bajo juramento que el trabajador no se encuentra sujeto a la retención judicial de pensión alimenticia, según se acredita con la exhibición de las tres últimas liquidaciones de sueldo, liberando en este acto al notario autorizante de cualquier responsabilidad por el no pago de esta.`),
      P(`Para constancia, firman las partes el presente finiquito en tres ejemplares, quedando uno de ellos en poder del empleador, otro en poder del trabajador y un último en poder de la notaría.`,{align:'justify'}),
      SIGN([COMPANY.name,`RUT ${COMPANY.rut} · EMPLEADOR`,person(v.legalRep)||'Representante legal',person(v.legalRepRut)?`C.I. ${person(v.legalRepRut)} · REP. LEGAL`:'REP. LEGAL'],[person(v.workerName)||'Trabajador(a)',person(v.workerRut)?`C.I. ${person(v.workerRut)}`:'C.I.','TRABAJADOR(A)'])
    ];
    return {title:'Finiquito',blocks,fileName:`Finiquito_${slug(v.workerName)||'trabajador'}`,total};
  }
});

// ---- Carta de aviso de término
TEMPLATES.push({
  id:'carta_aviso',name:'Carta de aviso de término',cat:'Término de contrato',icon:'✉',
  desc:'Comunica el término del contrato con la causal y los hechos en que se funda.',
  fields:[F.city(),F.date(),F.legalRep(),F.workerName(),F.workerRut(),{key:'address',label:'Domicilio del trabajador',type:'text',full:true},F.workerRole(),
    {key:'causal',label:'Causal',type:'select',options:causalOptions(),default:'160-7',full:true},
    {key:'facts',label:'Hechos en que se funda',type:'textarea',full:true,hint:'Descríbelos con fechas y detalle: la ley exige expresar los hechos.'},
    {key:'endDate',label:'Fecha de término',type:'date'},
    {key:'notice',label:'Aviso',type:'select',options:['Con 30 días de anticipación','Sin aviso previo'],default:'Sin aviso previo'},
    {key:'contrib',label:'Cotizaciones al día (se adjuntan comprobantes)',type:'check',default:true}],
  build(v){
    const c=causalOf(v.causal);
    const blocks=[
      P(`${person(v.city)||'________'}, ${longDate(v.date)}`,{align:'right'}),
      P([b('Señor(a): '),f(v.workerName),r(' · '),b('RUT: '),f(v.workerRut)],{after:0}),
      P([b('Domicilio: '),f(v.address),r(' · '),b('Cargo: '),f(v.workerRole)]),
      TITLE('CARTA DE AVISO DE TÉRMINO DE CONTRATO DE TRABAJO'),
      P([r('Por medio de la presente, y en conformidad con el artículo 162 del Código del Trabajo, comunicamos a usted que '),r(COMPANY.name),r(' ha resuelto poner término a su contrato de trabajo a contar del '),f(longDate(v.endDate)),r(', por la causal prevista en el '),f(c.text),r('.')],{align:'justify'})
    ];
    if(c.facts||person(v.facts))blocks.push(P([b('Hechos en que se funda la causal: '),f(v.facts)],{align:'justify'}));
    blocks.push(
      P(v.notice==='Con 30 días de anticipación'?'La presente comunicación se efectúa con a lo menos treinta días de anticipación a la fecha de término.':'El término del contrato se produce a contar de la fecha señalada, sin necesidad de aviso previo en razón de la causal invocada.',{align:'justify'}),
      P(v.contrib!==false?'Se informa que las cotizaciones previsionales, de salud y de seguro de cesantía se encuentran pagadas hasta el último día del mes anterior al término, lo que se acredita con los comprobantes que se adjuntan a la presente.':'Se informa el estado de pago de sus cotizaciones previsionales, de salud y de seguro de cesantía, conforme al detalle que se acompaña.',{align:'justify'}),
      P('Su finiquito estará a su disposición para ser firmado y ratificado conforme a la ley. Se le agradece los servicios prestados.',{align:'justify'}),
      P('Copia de esta carta se envía a la Inspección del Trabajo dentro del plazo legal.',{align:'justify'}),
      SIGN([COMPANY.name,person(v.legalRep)||'Representante legal','EMPLEADOR'],['Recibí copia de la presente carta',person(v.workerName)||'Trabajador(a)',person(v.workerRut)?`RUT ${person(v.workerRut)}`:'RUT'])
    );
    return {title:'Carta de aviso de término',blocks,fileName:`Carta_aviso_${slug(v.workerName)||'trabajador'}`};
  }
});

// ---- Carta de amonestación
TEMPLATES.push({
  id:'amonestacion',name:'Carta de amonestación',cat:'Disciplina',icon:'!',
  desc:'Amonestación escrita con el hecho, la fecha y la norma incumplida. Con espacio para la firma de recepción.',
  fields:[F.city('Coltauco'),F.date(),F.workerName(),F.workerRut(),F.workerRole(),
    {key:'eventDate',label:'Fecha del hecho',type:'date'},{key:'shift',label:'Turno u horario',type:'text',hint:'Ej.: 15:00 a 23:00'},
    {key:'facts',label:'Descripción del hecho',type:'textarea',full:true},
    {key:'rule',label:'Norma incumplida',type:'text',full:true,hint:'Ej.: cláusula décimo tercera del contrato de trabajo'},
    {key:'signer',label:'Firma por la empresa',type:'text',remember:true},{key:'signerRole',label:'Cargo de quien firma',type:'text',default:'Supervisor'}],
  build(v){
    return {title:'Carta de amonestación',fileName:`Amonestacion_${slug(v.workerName)||'trabajador'}`,blocks:[
      P(`${person(v.city)||'________'}, ${longDate(v.date)}`,{align:'right'}),
      TITLE('CARTA DE AMONESTACIÓN'),
      P([b('Señor(a): '),f(v.workerName)],{after:0}),P([b('RUT: '),f(v.workerRut),r(' · '),b('Cargo: '),f(v.workerRole)]),
      P([r('Por la presente, y en conformidad con el contrato de trabajo y el reglamento interno de la empresa, se le amonesta por escrito por los siguientes hechos ocurridos el '),f(longDate(v.eventDate)),v.shift?r(', en el turno de '):r(''),v.shift?f(v.shift):r(''),r(':')],{align:'justify'}),
      P([f(v.facts)],{indent:1,align:'justify'}),
      P([r('Este hecho contraviene '),f(v.rule),r('. Se le solicita dar estricto cumplimiento a sus obligaciones; la reiteración de conductas como la señalada podrá dar lugar a medidas de mayor gravedad conforme a la ley y al contrato.')],{align:'justify'}),
      P('Se deja copia de esta carta en su carpeta personal. Usted puede dejar constancia de sus descargos al pie de este documento.',{align:'justify'}),
      SIGN([COMPANY.name,person(v.signer)||'',person(v.signerRole)||'Empleador'],['Recibí conforme',person(v.workerName)||'Trabajador(a)',person(v.workerRut)?`RUT ${person(v.workerRut)}`:'RUT'])
    ]};
  }
});

// ---- Constancia de entrega de vehículo
TEMPLATES.push({
  id:'constancia_vehiculo',name:'Constancia de entrega de vehículo',cat:'Constancias',icon:'▭',
  desc:'Deja constancia de la entrega del vehículo, con patente, conductor y supervisor.',
  fields:[{key:'place',label:'Comuna',type:'text',default:'Coltauco'},F.date(),
    {key:'site',label:'Lugar',type:'text',default:'la Estación de Servicio Aramco Coltauco',full:true},
    {key:'driver',label:'Conductor',type:'text'},{key:'plate',label:'Patente',type:'text'},
    {key:'supervisor',label:'Supervisor que entrega',type:'text',remember:true},{key:'supervisorRole',label:'Cargo del supervisor',type:'text',default:'Supervisor Estación Aramco Coltauco (Prosercom SpA)'},
    {key:'detail',label:'Detalle de la entrega',type:'textarea',full:true,hint:'Ej.: reparación realizada, estado en que se entrega, etc.'}],
  build(v){
    return {title:'Constancia de entrega de vehículo',fileName:`Constancia_vehiculo_${slug(v.plate)||'patente'}`,blocks:[
      TITLE('CONSTANCIA DE ENTREGA DE VEHÍCULO'),
      P([r('En la comuna de '),f(v.place),r(', a '),f(longDate(v.date)),r(', en dependencias de '),f(v.site),r(', se deja constancia de lo siguiente:')],{align:'justify'}),
      P([r('En la presente fecha, don(ña) '),f(v.driver),r(', conductor(a) del vehículo patente '),f(v.plate),r(', y la administración de la estación, en representación de Prosercom SpA, don(ña) '),f(v.supervisor),r(', hacen entrega del vehículo citado anteriormente. '),f(v.detail,'')],{align:'justify'}),
      P([r('El vehículo es entregado en correcto funcionamiento, y don(ña) '),f(v.driver),r(' declara recibirlo a su entera conformidad.')],{align:'justify'}),
      P('Sin más que agregar, firman en conformidad las partes:',{align:'justify'}),
      SIGN([person(v.supervisor)||'Supervisor',person(v.supervisorRole)],[person(v.driver)||'Conductor(a)',`Conductor(a) vehículo ${person(v.plate)||'patente'}`])
    ]};
  }
});

// ---- Certificado de trabajo
TEMPLATES.push({
  id:'certificado',name:'Certificado de trabajo',cat:'Constancias',icon:'★',
  desc:'Certifica el cargo y la antigüedad del trabajador a solicitud suya.',
  fields:[F.city(),F.date(),F.legalRep(),F.workerName(),F.workerRut(),F.workerRole(),F.startDate('Fecha de ingreso'),
    {key:'status',label:'Situación',type:'select',options:['Se desempeña actualmente','Se desempeñó hasta'],default:'Se desempeña actualmente'},
    {key:'endDate',label:'Hasta',type:'date',showIf:{key:'status',value:'Se desempeñó hasta'}},
    {key:'contractType',label:'Tipo de contrato',type:'select',options:['indefinido','a plazo fijo'],default:'indefinido'},
    {key:'purpose',label:'Para',type:'text',full:true,default:'los fines que el interesado estime convenientes'}],
  build(v){
    const now=v.status!=='Se desempeñó hasta';
    return {title:'Certificado de trabajo',fileName:`Certificado_${slug(v.workerName)||'trabajador'}`,blocks:[
      TITLE('CERTIFICADO DE TRABAJO'),
      P([r(`${COMPANY.name}, RUT ${COMPANY.rut}, certifica que don(ña) `),f(v.workerName),r(', RUT '),f(v.workerRut),r(now?', se desempeña en la empresa en el cargo de ':', se desempeñó en la empresa en el cargo de '),f(v.workerRole),r(', con contrato '),f(v.contractType),r(', desde el '),f(longDate(v.startDate)),now?r(' a la fecha.'):r(' hasta el '),now?r(''):f(longDate(v.endDate)),now?r(''):r('.')],{align:'justify'}),
      P([r('Se extiende el presente certificado a petición del interesado(a), para '),f(v.purpose),r('.')],{align:'justify'}),
      P(`${person(v.city)||'________'}, ${longDate(v.date)}`,{align:'right'}),
      SIGN([COMPANY.name,person(v.legalRep)||'Representante legal'])
    ]};
  }
});

// ---- Comprobante de vacaciones
TEMPLATES.push({
  id:'vacaciones',name:'Comprobante de vacaciones',cat:'Constancias',icon:'☀',
  desc:'Constancia de feriado legal: fechas, días hábiles y saldo.',
  fields:[F.city(),F.date(),F.workerName(),F.workerRut(),F.workerRole(),
    {key:'period',label:'Período que se descuenta',type:'text',hint:'Ej.: 2025-2026'},
    {key:'from',label:'Desde',type:'date'},{key:'to',label:'Hasta',type:'date'},
    {key:'days',label:'Días hábiles de feriado',type:'number'},{key:'balance',label:'Saldo de días después de este feriado',type:'number'},
    {key:'returnDate',label:'Fecha de reintegro',type:'date'},{key:'signer',label:'Firma por la empresa',type:'text',remember:true}],
  build(v){
    return {title:'Comprobante de vacaciones',fileName:`Vacaciones_${slug(v.workerName)||'trabajador'}`,blocks:[
      TITLE('COMPROBANTE DE FERIADO LEGAL'),
      P([r('Don(ña) '),f(v.workerName),r(', RUT '),f(v.workerRut),r(', cargo '),f(v.workerRole),r(', hará uso de feriado legal correspondiente al período '),f(v.period),r(', desde el '),f(longDate(v.from)),r(' hasta el '),f(longDate(v.to)),r(', ambos días inclusive, por un total de '),f(v.days),r(' días hábiles.')],{align:'justify'}),
      P([r('Su reintegro a las labores será el '),f(longDate(v.returnDate)),r('. Después de este feriado, el saldo de días pendientes es de '),f(v.balance),r(' días hábiles.')],{align:'justify'}),
      P(`${person(v.city)||'________'}, ${longDate(v.date)}`,{align:'right'}),
      SIGN([COMPANY.name,person(v.signer)||'Empleador'],['Recibí conforme',person(v.workerName)||'Trabajador(a)',person(v.workerRut)?`RUT ${person(v.workerRut)}`:'RUT'])
    ]};
  }
});

const get=id=>TEMPLATES.find(t=>t.id===id)||null;
const CATEGORIES=['Contratos','Término de contrato','Disciplina','Constancias'];
function defaults(template){
  const out={};
  template.fields.forEach(field=>{
    out[field.key]=field.default==='today'?todayIso():field.default!==undefined?field.default:field.type==='check'?false:'';
  });
  return out;
}
// ¿Se muestra el campo según el valor de otro?
function visible(field,values){
  const c=field.showIf;
  if(!c)return true;
  const current=values[c.key];
  if(c.value!==undefined)return current===c.value;
  if(c.not!==undefined)return current!==c.not;
  if(c.in)return c.in.includes(current);
  return true;
}

const api={COMPANY,TEMPLATES,CATEGORIES,CAUSALS,get,defaults,visible,longDate,shortDate,clp,toNum,formatRut,numberToWords,pesosInWords,splitInstallments,ordinal,slug,todayIso};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.DocumentData=api;
})(typeof window!=='undefined'?window:globalThis);
