/* FUTPRO — base de datos mundial (clubes REALES, ligas reales).
 *
 * Niveles de verificación (campo v de cada liga):
 *   v = verificado con fuentes web consultadas en la sesión de desarrollo (oct-2026)
 *   k = conocimiento previo del autor, composición probable de la temporada 2025-26/2026: PUEDE tener errores de ascensos/descensos
 *   p = lista PARCIAL: la división real tiene más clubes que los cargados
 * Los futbolistas NO se incluyen: se generan automáticamente (ficticios) y así se indican en la interfaz.
 * Para actualizar: edite este archivo (clubes en `clubs`, separados por ';') y empiece una partida nueva.
 *
 * Campos de liga: id, c país, n nombre, t nivel, q calidad media de plantilla (1-99), sp dispersión entre clubes,
 *   cal 'year'(feb-dic) | 'euro'(ago-may), rr 1|2 (vueltas), mp (partidos por equipo si es menor al total),
 *   up ascensos directos, poUp [desde,hasta] liguilla por 1 cupo extra, dn descensos, po {n} liguilla de campeón top-n
 */
(function () {
  'use strict';
  var FP = window.FP = window.FP || {};

  var countries = {
    CHI: { n: 'Chile', conf: 'CONMEBOL', cup: 'Copa Chile', w: 0.35 },
    ARG: { n: 'Argentina', conf: 'CONMEBOL', cup: 'Copa Argentina', w: 0.5 },
    BRA: { n: 'Brasil', conf: 'CONMEBOL', cup: 'Copa do Brasil', w: 0.7 },
    URU: { n: 'Uruguay', conf: 'CONMEBOL', cup: 'Copa Uruguay', w: 0.35 },
    PAR: { n: 'Paraguay', conf: 'CONMEBOL', cup: 'Copa Paraguay', w: 0.3 },
    COL: { n: 'Colombia', conf: 'CONMEBOL', cup: 'Copa Colombia', w: 0.4 },
    PER: { n: 'Perú', conf: 'CONMEBOL', cup: 'Copa Perú', w: 0.3 },
    ECU: { n: 'Ecuador', conf: 'CONMEBOL', cup: 'Copa Ecuador', w: 0.35 },
    BOL: { n: 'Bolivia', conf: 'CONMEBOL', cup: 'Copa Bolivia', w: 0.25 },
    VEN: { n: 'Venezuela', conf: 'CONMEBOL', cup: 'Copa Venezuela', w: 0.2 },
    ENG: { n: 'Inglaterra', conf: 'UEFA', cup: 'FA Cup', w: 2.2 },
    ESP: { n: 'España', conf: 'UEFA', cup: 'Copa del Rey', w: 1.5 },
    ITA: { n: 'Italia', conf: 'UEFA', cup: 'Coppa Italia', w: 1.3 },
    GER: { n: 'Alemania', conf: 'UEFA', cup: 'DFB-Pokal', w: 1.4 },
    FRA: { n: 'Francia', conf: 'UEFA', cup: 'Coupe de France', w: 1.1 },
    POR: { n: 'Portugal', conf: 'UEFA', cup: 'Taça de Portugal', w: 0.7 },
    NED: { n: 'Países Bajos', conf: 'UEFA', cup: 'KNVB Beker', w: 0.9 },
    BEL: { n: 'Bélgica', conf: 'UEFA', cup: 'Copa de Bélgica', w: 0.7 },
    SCO: { n: 'Escocia', conf: 'UEFA', cup: 'Scottish Cup', w: 0.6 },
    TUR: { n: 'Turquía', conf: 'UEFA', cup: 'Copa de Turquía', w: 0.8 },
    GRE: { n: 'Grecia', conf: 'UEFA', cup: 'Copa de Grecia', w: 0.5 },
    SUI: { n: 'Suiza', conf: 'UEFA', cup: 'Copa Suiza', w: 0.7 },
    AUT: { n: 'Austria', conf: 'UEFA', cup: 'ÖFB-Cup', w: 0.6 },
    DEN: { n: 'Dinamarca', conf: 'UEFA', cup: 'Copa de Dinamarca', w: 0.6 },
    SWE: { n: 'Suecia', conf: 'UEFA', cup: 'Svenska Cupen', w: 0.5 },
    NOR: { n: 'Noruega', conf: 'UEFA', cup: 'Copa de Noruega', w: 0.5 },
    POL: { n: 'Polonia', conf: 'UEFA', cup: 'Copa de Polonia', w: 0.45 },
    CZE: { n: 'República Checa', conf: 'UEFA', cup: 'Copa Checa', w: 0.4 },
    USA: { n: 'Estados Unidos', conf: 'CONCACAF', cup: 'U.S. Open Cup', w: 1.0 },
    MEX: { n: 'México', conf: 'CONCACAF', cup: 'Copa MX', w: 0.8 },
    CAN: { n: 'Canadá', conf: 'CONCACAF', cup: 'Canadian Championship', w: 0.4 },
    CRC: { n: 'Costa Rica', conf: 'CONCACAF', cup: 'Copa Costa Rica', w: 0.25 },
    KSA: { n: 'Arabia Saudita', conf: 'AFC', cup: 'Copa del Rey de Campeones', w: 1.3 },
    JPN: { n: 'Japón', conf: 'AFC', cup: 'Copa del Emperador', w: 0.7 },
    KOR: { n: 'Corea del Sur', conf: 'AFC', cup: 'Copa de Corea', w: 0.55 },
    CHN: { n: 'China', conf: 'AFC', cup: 'Copa de China', w: 0.7 },
    AUS: { n: 'Australia', conf: 'AFC', cup: 'Australia Cup', w: 0.45 },
    EGY: { n: 'Egipto', conf: 'CAF', cup: 'Copa de Egipto', w: 0.4 },
    MAR: { n: 'Marruecos', conf: 'CAF', cup: 'Copa del Trono', w: 0.35 },
    RSA: { n: 'Sudáfrica', conf: 'CAF', cup: 'Nedbank Cup', w: 0.35 },
    TUN: { n: 'Túnez', conf: 'CAF', cup: 'Copa de Túnez', w: 0.25 },
    ALG: { n: 'Argelia', conf: 'CAF', cup: 'Copa de Argelia', w: 0.25 }
  };

  // q = calidad media; sp = dispersión; qual = cupos continentales (UEFA: CL/EL/ECL ; CONMEBOL: LIB/SUD ; etc.)
  var L = [
    // ================= SUDAMÉRICA =================
    { id: 'CHI1', c: 'CHI', n: 'Primera División (Liga de Primera)', t: 1, q: 58, sp: 7, cal: 'year', rr: 2, dn: 2, v: 'v', qual: { LIB: 3, SUD: 3 },
      clubs: 'Colo-Colo;Universidad de Chile;Universidad Católica;Coquimbo Unido;Everton de Viña del Mar;Palestino;O\'Higgins;Huachipato;Cobresal;Audax Italiano;Ñublense;Deportes La Serena;Unión La Calera;Universidad de Concepción;Deportes Limache;Deportes Concepción' },
    { id: 'CHI2', c: 'CHI', n: 'Primera B (Liga de Ascenso)', t: 2, q: 52, sp: 5, cal: 'year', rr: 2, up: 1, poUp: [2, 8], dn: 1, v: 'k',
      clubs: 'Unión Española;Deportes Iquique;Cobreloa;Deportes Antofagasta;Curicó Unido;Santiago Wanderers;Deportes Temuco;Magallanes;Rangers de Talca;San Marcos de Arica;Deportes Puerto Montt;Deportes Copiapó;Deportes Recoleta;Deportes Santa Cruz;Unión San Felipe;San Luis de Quillota' },
    { id: 'CHI3', c: 'CHI', n: 'Segunda División Profesional', t: 3, q: 46, sp: 4, cal: 'year', rr: 2, up: 1, dn: 2, v: 'v',
      clubs: 'Santiago Morning;Lota Schwager;Provincial Osorno;Colchagua;Deportes Linares;Deportes Rengo;General Velásquez;Trasandino;Real San Joaquín;Provincial Ovalle;Brujas de Salamanca;Concón National;Santiago City;Atlético Colina' },
    { id: 'CHI4', c: 'CHI', n: 'Tercera División A', t: 4, q: 41, sp: 3, cal: 'year', rr: 2, up: 2, dn: 0, v: 'p',
      clubs: 'Deportes Rancagua;Malleco Unido;Naval;Lautaro de Buin;Quintero Unido;Comunal Cabrero;Constitución Unido;Atlético Oriente;Rodelindo Román;Imperial Unido;Chimbarongo;Aguará;Futuro;Municipal Puente Alto' },

    { id: 'ARG1', c: 'ARG', n: 'Liga Profesional de Fútbol', t: 1, q: 64, sp: 7, cal: 'year', rr: 1, dn: 2, v: 'v', qual: { LIB: 6, SUD: 5 },
      clubs: 'Boca Juniors;River Plate;Racing Club;Independiente;San Lorenzo;Estudiantes de La Plata;Vélez Sarsfield;Rosario Central;Newell\'s Old Boys;Talleres;Lanús;Huracán;Argentinos Juniors;Defensa y Justicia;Banfield;Belgrano;Gimnasia La Plata;Unión de Santa Fe;Instituto;Platense;Tigre;Independiente Rivadavia;Central Córdoba (SdE);Atlético Tucumán;Barracas Central;Sarmiento de Junín;Aldosivi;Deportivo Riestra;Gimnasia y Esgrima de Mendoza;Estudiantes de Río Cuarto' },
    { id: 'ARG2', c: 'ARG', n: 'Primera Nacional', t: 2, q: 55, sp: 5, cal: 'year', rr: 1, up: 2, dn: 0, v: 'p',
      clubs: 'Godoy Cruz;San Martín de San Juan;Colón;Quilmes;Patronato;Chacarita Juniors;Ferro Carril Oeste;Nueva Chicago;Temperley;Almirante Brown;San Martín de Tucumán;Deportivo Madryn;Mitre (SdE);Gimnasia y Tiro;Güemes;Racing de Córdoba;Agropecuario;Deportivo Morón;Atlanta;All Boys;Los Andes;Defensores de Belgrano;Tristán Suárez;Alvarado;Brown de Adrogué;Maipú;Chaco For Ever;Gimnasia de Jujuy;Midland;Acassuso;Ciudad de Bolívar;Atlético Rafaela' },

    { id: 'BRA1', c: 'BRA', n: 'Brasileirão Série A', t: 1, q: 67, sp: 8, cal: 'year', rr: 2, dn: 4, v: 'k', qual: { LIB: 7, SUD: 5 },
      clubs: 'Palmeiras;Flamengo;Cruzeiro;Botafogo;Fluminense;Corinthians;São Paulo;Atlético Mineiro;Internacional;Grêmio;Bahia;Vasco da Gama;Santos;Bragantino;Mirassol;Vitória;Athletico Paranaense;Coritiba;Chapecoense;Remo' },
    { id: 'BRA2', c: 'BRA', n: 'Brasileirão Série B', t: 2, q: 57, sp: 5, cal: 'year', rr: 2, up: 4, dn: 4, v: 'k',
      clubs: 'Ceará;Fortaleza;Sport;Juventude;Goiás;Novorizontino;Criciúma;Vila Nova;Avaí;CRB;Operário-PR;Athletic Club (MG);Cuiabá;América Mineiro;Botafogo-SP;Atlético Goianiense;Paysandu;Amazonas;Ferroviária;Náutico' },
    { id: 'BRA3', c: 'BRA', n: 'Brasileirão Série C', t: 3, q: 49, sp: 4, cal: 'year', rr: 2, up: 4, dn: 4, v: 'k',
      clubs: 'Ponte Preta;Londrina;Brusque;Figueirense;Ituano;Botafogo-PB;Confiança;Tombense;ABC;Floresta;Caxias;Ypiranga;Volta Redonda;Santa Cruz;Maringá;São Bernardo;Retrô;Itabuna;Marcílio Dias;Inter de Limeira' },
    { id: 'BRA4', c: 'BRA', n: 'Brasileirão Série D', t: 4, q: 42, sp: 4, cal: 'year', rr: 2, up: 4, dn: 0, v: 'p',
      clubs: 'Portuguesa;Guarani;Sampaio Corrêa;CSA;Campinense;Treze;Nova Iguaçu;Brasiliense;Aparecidense;Gama;Cianorte;Joinville;Tuna Luso;Rio Branco;Bangu;Madureira' },

    { id: 'URU1', c: 'URU', n: 'Primera División', t: 1, q: 56, sp: 7, cal: 'year', rr: 2, dn: 2, v: 'k', qual: { LIB: 3, SUD: 3 },
      clubs: 'Peñarol;Nacional;Defensor Sporting;Danubio;Liverpool (URU);Montevideo Wanderers;Boston River;Cerro Largo;Racing de Montevideo;Plaza Colonia;Progreso;River Plate (URU);Juventud de Las Piedras;Albion;Cerro;Montevideo City Torque' },
    { id: 'URU2', c: 'URU', n: 'Segunda División', t: 2, q: 46, sp: 4, cal: 'year', rr: 2, up: 2, dn: 0, v: 'p',
      clubs: 'Fénix;Rampla Juniors;Central Español;Miramar Misiones;Atenas de San Carlos;Deportivo Maldonado;Sud América;Rentistas;Villa Española;Tacuarembó;Oriental de la Paz;Canadian;Uruguay Montevideo;Basáñez' },
    { id: 'PAR1', c: 'PAR', n: 'Primera División', t: 1, q: 55, sp: 6, cal: 'year', rr: 2, dn: 0, v: 'k', qual: { LIB: 3, SUD: 3 },
      clubs: 'Olimpia;Cerro Porteño;Libertad;Guaraní;Nacional (PAR);Sol de América;Sportivo Luqueño;Sportivo Trinidense;Recoleta FC;General Caballero JLM;Sportivo Ameliano;Tacuary' },
    { id: 'COL1', c: 'COL', n: 'Primera A (Liga BetPlay)', t: 1, q: 58, sp: 7, cal: 'year', rr: 2, dn: 2, v: 'k', qual: { LIB: 3, SUD: 3 },
      clubs: 'Atlético Nacional;Millonarios;América de Cali;Deportivo Cali;Independiente Santa Fe;Junior;Once Caldas;Deportes Tolima;Independiente Medellín;Atlético Bucaramanga;Deportivo Pereira;Envigado;Alianza FC;Águilas Doradas;Jaguares de Córdoba;Fortaleza CEIF;Llaneros;Boyacá Chicó;Deportivo Pasto;La Equidad' },
    { id: 'COL2', c: 'COL', n: 'Primera B', t: 2, q: 48, sp: 4, cal: 'year', rr: 2, up: 2, dn: 0, v: 'p',
      clubs: 'Cúcuta Deportivo;Real Cartagena;Atlético Huila;Unión Magdalena;Real Santander;Barranquilla FC;Deportes Quindío;Patriotas;Orsomarso;Atlético FC;Internacional de Bogotá;Cortuluá;Tigres FC;Bogotá FC;Leones FC;Boca Juniors de Cali' },
    { id: 'PER1', c: 'PER', n: 'Liga 1', t: 1, q: 53, sp: 6, cal: 'year', rr: 2, dn: 2, v: 'k', qual: { LIB: 2, SUD: 3 },
      clubs: 'Universitario;Alianza Lima;Sporting Cristal;Melgar;Cusco FC;Cienciano;ADT;Alianza Atlético;Sport Boys;Sport Huancayo;Los Chankas;Comerciantes Unidos;Juan Pablo II College;Deportivo Garcilaso;UTC;Atlético Grau;Universidad César Vallejo;Deportivo Municipal' },
    { id: 'PER2', c: 'PER', n: 'Liga 2', t: 2, q: 44, sp: 4, cal: 'year', rr: 2, up: 2, dn: 0, v: 'p',
      clubs: 'Deportivo Binacional;Carlos A. Mannucci;Unión Comercio;Pirata FC;Alianza Universidad;Juan Aurich;Academia Cantolao;Ayacucho FC;Deportivo Coopsol;Atlético Torino;Credicoop San Cristóbal;Deportivo Llacuabamba;Santos de Nasca;Deportivo Moquegua' },
    { id: 'ECU1', c: 'ECU', n: 'Serie A (LigaPro)', t: 1, q: 56, sp: 7, cal: 'year', rr: 2, dn: 2, v: 'k', qual: { LIB: 3, SUD: 3 },
      clubs: 'LDU Quito;Independiente del Valle;Barcelona SC;Emelec;Aucas;Delfín;Macará;Orense;Mushuc Runa;Libertad FC;Técnico Universitario;Universidad Católica (ECU);Deportivo Cuenca;Manta FC;Vinotinto Ecuador;El Nacional' },
    { id: 'ECU2', c: 'ECU', n: 'Serie B', t: 2, q: 45, sp: 4, cal: 'year', rr: 2, up: 2, dn: 0, v: 'p',
      clubs: 'Deportivo Quito;Imbabura;9 de Octubre;Cumbayá;Gualaceo;Guayaquil City;Chacaritas;Santa Rita;Atlético Santo Domingo;Fuerza Amarilla;Clan Juvenil;Cuniburo' },
    { id: 'BOL1', c: 'BOL', n: 'Primera División', t: 1, q: 50, sp: 6, cal: 'year', rr: 2, dn: 0, v: 'k', qual: { LIB: 1, SUD: 2 },
      clubs: 'Bolívar;The Strongest;Always Ready;Blooming;Oriente Petrolero;Jorge Wilstermann;Aurora;San Antonio Bulo Bulo;Nacional Potosí;Real Tomayapo;Universitario de Vinto;Independiente Petrolero;Gualberto Villarroel SJ;Guabirá;Real Oruro;Academia del Balompié' },
    { id: 'VEN1', c: 'VEN', n: 'Primera División (Liga FUTVE)', t: 1, q: 49, sp: 5, cal: 'year', rr: 2, dn: 0, v: 'k', qual: { LIB: 1, SUD: 2 },
      clubs: 'Deportivo Táchira;Caracas FC;Carabobo FC;Monagas SC;Metropolitanos FC;Deportivo La Guaira;Estudiantes de Mérida;Portuguesa FC;Zamora FC;Anzoátegui FC;Academia Puerto Cabello;Rayo Zuliano;Universidad Central de Venezuela;Yaracuyanos FC' },

    // ================= EUROPA =================
    { id: 'ENG1', c: 'ENG', n: 'Premier League', t: 1, q: 75, sp: 9, cal: 'euro', rr: 2, dn: 3, v: 'k', qual: { CL: 5, EL: 2, ECL: 2 },
      clubs: 'Manchester City;Arsenal;Liverpool;Chelsea;Tottenham Hotspur;Manchester United;Newcastle United;Aston Villa;Brighton & Hove Albion;Crystal Palace;Brentford;Fulham;Everton;Bournemouth;West Ham United;Nottingham Forest;Wolverhampton Wanderers;Leeds United;Burnley;Sunderland' },
    { id: 'ENG2', c: 'ENG', n: 'EFL Championship', t: 2, q: 67, sp: 4, cal: 'euro', rr: 2, up: 2, poUp: [3, 6], dn: 3, v: 'k',
      clubs: 'Leicester City;Southampton;Ipswich Town;Sheffield United;West Bromwich Albion;Norwich City;Middlesbrough;Sheffield Wednesday;Hull City;Watford;Coventry City;Blackburn Rovers;Preston North End;Stoke City;Queens Park Rangers;Swansea City;Millwall;Bristol City;Derby County;Portsmouth;Oxford United;Birmingham City;Wrexham;Charlton Athletic' },
    { id: 'ENG3', c: 'ENG', n: 'EFL League One', t: 3, q: 60, sp: 4, cal: 'euro', rr: 2, up: 2, poUp: [3, 6], dn: 4, v: 'k',
      clubs: 'Plymouth Argyle;Luton Town;Cardiff City;Bolton Wanderers;Wigan Athletic;Huddersfield Town;Reading;Barnsley;Stockport County;Peterborough United;Lincoln City;Blackpool;Burton Albion;Exeter City;Leyton Orient;Mansfield Town;Northampton Town;Rotherham United;Stevenage;Wycombe Wanderers;AFC Wimbledon;Doncaster Rovers;Port Vale;Bradford City' },
    { id: 'ENG4', c: 'ENG', n: 'EFL League Two', t: 4, q: 54, sp: 4, cal: 'euro', rr: 2, up: 3, poUp: [4, 7], dn: 0, v: 'k',
      clubs: 'Notts County;Walsall;Chesterfield;Barrow;Gillingham;Grimsby Town;Salford City;Crewe Alexandra;Colchester United;Cheltenham Town;Bristol Rovers;Cambridge United;Shrewsbury Town;Crawley Town;Swindon Town;Milton Keynes Dons;Accrington Stanley;Harrogate Town;Bromley;Newport County;Tranmere Rovers;Fleetwood Town;Oldham Athletic;Barnet' },

    { id: 'ESP1', c: 'ESP', n: 'La Liga (Primera División)', t: 1, q: 73, sp: 9, cal: 'euro', rr: 2, dn: 3, v: 'k', qual: { CL: 4, EL: 2, ECL: 2 },
      clubs: 'Real Madrid;FC Barcelona;Atlético de Madrid;Athletic Club;Villarreal;Real Sociedad;Real Betis;Sevilla;Valencia;Girona;Celta de Vigo;Osasuna;Rayo Vallecano;Getafe;Mallorca;Alavés;Espanyol;Elche;Levante;Real Oviedo' },
    { id: 'ESP2', c: 'ESP', n: 'Segunda División', t: 2, q: 62, sp: 4, cal: 'euro', rr: 2, up: 2, poUp: [3, 6], dn: 4, v: 'k',
      clubs: 'Almería;Racing de Santander;Deportivo de La Coruña;Málaga;Castellón;Las Palmas;Burgos;Sporting de Gijón;Eibar;Albacete;Granada;Cádiz;Real Zaragoza;Córdoba;Mirandés;Real Sociedad B;Huesca;Cultural Leonesa;Andorra;Leganés;Real Valladolid;AD Ceuta' },

    { id: 'ESP3', c: 'ESP', n: 'Primera Federación', t: 3, q: 49, sp: 4, cal: 'euro', rr: 2, up: 3, poUp: [4, 7], dn: 4, v: 'p',
      clubs: 'CD Tenerife;Real Madrid Castilla;Racing de Ferrol;Celta Fortuna;CD Lugo;SD Ponferradina;Ourense CF;Pontevedra CF;CP Cacereño;AD Mérida;CD Eldense;Hércules CF;Real Murcia;Sevilla Atlético;Atlético de Madrid B;FC Cartagena;Gimnàstic de Tarragona;CE Sabadell;AD Alcorcón;Algeciras CF' },
    { id: 'ESP4', c: 'ESP', n: 'Segunda Federación', t: 4, q: 43, sp: 3, cal: 'euro', rr: 2, up: 3, poUp: [4, 7], dn: 0, v: 'p',
      clubs: 'CD Alcoyano;Atlético Baleares;Lleida Esportiu;Reus FC Reddis;Terrassa FC;UE Sant Andreu;FC Barcelona Atlètic;Real Unión;SD Amorebieta;Sestao River;CD Tudelano;Real Jaén;UCAM Murcia;Águilas FC;CD Extremadura;CF Fuenlabrada;CF Rayo Majadahonda;CDA Navalcarnero;CF Intercity;UD Melilla' },

    { id: 'ITA1', c: 'ITA', n: 'Serie A', t: 1, q: 72, sp: 8, cal: 'euro', rr: 2, dn: 3, v: 'k', qual: { CL: 4, EL: 2, ECL: 2 },
      clubs: 'Inter;Napoli;Juventus;Milan;Atalanta;Roma;Lazio;Fiorentina;Bologna;Torino;Genoa;Udinese;Como;Cagliari;Parma;Lecce;Hellas Verona;Sassuolo;Pisa;Cremonese' },
    { id: 'ITA2', c: 'ITA', n: 'Serie B', t: 2, q: 60, sp: 4, cal: 'euro', rr: 2, up: 2, poUp: [3, 8], dn: 4, v: 'k',
      clubs: 'Palermo;Venezia;Monza;Empoli;Frosinone;Modena;Catanzaro;Cesena;Sampdoria;Bari;Spezia;Südtirol;Juve Stabia;Carrarese;Mantova;Padova;Avellino;Reggiana;Pescara;Virtus Entella' },
    { id: 'ITA3', c: 'ITA', n: 'Serie C', t: 3, q: 52, sp: 4, cal: 'euro', rr: 2, up: 3, poUp: [4, 7], dn: 0, v: 'p',
      clubs: 'Vicenza;Triestina;Benevento;Lecco;Pro Vercelli;Ternana;Trapani;Cosenza;Salernitana;Cittadella;Brescia;Arezzo;Pianese;Perugia;Torres;Ascoli;Gubbio;Campobasso;Lumezzane;Pontedera' },

    { id: 'GER1', c: 'GER', n: 'Bundesliga', t: 1, q: 71, sp: 9, cal: 'euro', rr: 2, dn: 2, v: 'k', qual: { CL: 4, EL: 2, ECL: 2 },
      clubs: 'Bayern München;Borussia Dortmund;Bayer Leverkusen;RB Leipzig;Eintracht Frankfurt;VfB Stuttgart;SC Freiburg;VfL Wolfsburg;Borussia Mönchengladbach;Werder Bremen;Union Berlin;Mainz 05;FC Augsburg;TSG Hoffenheim;1. FC Heidenheim;FC St. Pauli;1. FC Köln;Hamburger SV' },
    { id: 'GER2', c: 'GER', n: '2. Bundesliga', t: 2, q: 61, sp: 4, cal: 'euro', rr: 2, up: 2, dn: 2, v: 'k',
      clubs: 'Schalke 04;Hertha BSC;Hannover 96;Fortuna Düsseldorf;Karlsruher SC;SC Paderborn;1. FC Kaiserslautern;1. FC Nürnberg;SV Elversberg;SpVgg Greuther Fürth;1. FC Magdeburg;Darmstadt 98;Eintracht Braunschweig;Preußen Münster;Holstein Kiel;VfL Bochum;Arminia Bielefeld;Dynamo Dresden' },
    { id: 'GER3', c: 'GER', n: '3. Liga', t: 3, q: 52, sp: 4, cal: 'euro', rr: 2, up: 2, dn: 0, v: 'k',
      clubs: 'Hansa Rostock;1. FC Saarbrücken;1860 München;MSV Duisburg;Viktoria Köln;Waldhof Mannheim;VfL Osnabrück;SC Verl;Energie Cottbus;Jahn Regensburg;Erzgebirge Aue;Alemannia Aachen;FC Ingolstadt;TSG Hoffenheim II;VfB Stuttgart II;SV Wehen Wiesbaden;Rot-Weiss Essen;SSV Ulm 1846;Hannover 96 II;Borussia Dortmund II' },

    { id: 'FRA1', c: 'FRA', n: 'Ligue 1', t: 1, q: 68, sp: 9, cal: 'euro', rr: 2, dn: 2, v: 'k', qual: { CL: 3, EL: 2, ECL: 2 },
      clubs: 'Paris Saint-Germain;Marseille;Monaco;Lille;Lyon;Nice;Lens;Rennes;Strasbourg;Nantes;Toulouse;Brest;Auxerre;Angers;Le Havre;Lorient;Paris FC;Metz' },
    { id: 'FRA2', c: 'FRA', n: 'Ligue 2', t: 2, q: 57, sp: 4, cal: 'euro', rr: 2, up: 2, dn: 0, v: 'k',
      clubs: 'Saint-Étienne;Montpellier;Reims;Troyes;Guingamp;Rodez;Red Star;Pau;Grenoble;Annecy;Amiens;Laval;Bastia;Dunkerque;Clermont;Martigues;Nancy;Le Mans' },

    { id: 'POR1', c: 'POR', n: 'Primeira Liga', t: 1, q: 66, sp: 9, cal: 'euro', rr: 2, dn: 2, v: 'k', qual: { CL: 2, EL: 2, ECL: 2 },
      clubs: 'Benfica;Sporting CP;FC Porto;Braga;Vitória SC;Famalicão;Gil Vicente;Moreirense;Estoril;Casa Pia;Santa Clara;Rio Ave;Arouca;CD Nacional;Alverca;AVS;Estrela da Amadora;Tondela' },
    { id: 'POR2', c: 'POR', n: 'Liga Portugal 2 (Segunda Liga)', t: 2, q: 54, sp: 4, cal: 'euro', rr: 2, up: 2, dn: 0, v: 'p',
      clubs: 'Farense;Boavista;Marítimo;Vizela;Leixões;Penafiel;Feirense;Chaves;Torreense;Paços de Ferreira;Académico de Viseu;Oliveirense;Mafra;Portimonense;Benfica B;FC Porto B;Sporting CP B;Braga B' },

    { id: 'NED1', c: 'NED', n: 'Eredivisie', t: 1, q: 65, sp: 8, cal: 'euro', rr: 2, dn: 2, v: 'k', qual: { CL: 2, EL: 2, ECL: 2 },
      clubs: 'PSV Eindhoven;Feyenoord;Ajax;AZ Alkmaar;FC Twente;FC Utrecht;Go Ahead Eagles;Sparta Rotterdam;NEC Nijmegen;SC Heerenveen;Fortuna Sittard;PEC Zwolle;Heracles Almelo;FC Groningen;NAC Breda;Willem II;Excelsior;FC Volendam' },
    { id: 'NED2', c: 'NED', n: 'Eerste Divisie', t: 2, q: 52, sp: 4, cal: 'euro', rr: 2, up: 2, dn: 0, v: 'p',
      clubs: 'ADO Den Haag;Roda JC Kerkrade;De Graafschap;VVV-Venlo;SC Cambuur;FC Dordrecht;Helmond Sport;TOP Oss;MVV Maastricht;FC Eindhoven;FC Den Bosch;FC Emmen;Jong Ajax;Jong PSV;Jong AZ;Jong FC Utrecht;RKC Waalwijk;Almere City;Telstar' },
    { id: 'BEL1', c: 'BEL', n: 'Jupiler Pro League', t: 1, q: 63, sp: 8, cal: 'euro', rr: 2, dn: 1, v: 'k', qual: { CL: 2, EL: 2, ECL: 2 },
      clubs: 'Club Brugge;Union Saint-Gilloise;Anderlecht;Genk;Gent;Antwerp;Standard Liège;Cercle Brugge;Mechelen;Sint-Truiden;Charleroi;Westerlo;OH Leuven;Zulte Waregem;Dender;Raal La Louvière' },
    { id: 'BEL2', c: 'BEL', n: 'Challenger Pro League', t: 2, q: 52, sp: 4, cal: 'euro', rr: 2, up: 1, dn: 0, v: 'p',
      clubs: 'Beerschot;Kortrijk;Eupen;Lommel;Lokeren-Temse;Patro Eisden;RWDM;Francs Borains;Club NXT;Jong Genk;Jong Gent;Beveren;Lierse' },
    { id: 'SCO1', c: 'SCO', n: 'Scottish Premiership', t: 1, q: 59, sp: 10, cal: 'euro', rr: 2, dn: 1, v: 'k', qual: { CL: 1, EL: 2, ECL: 2 },
      clubs: 'Celtic;Rangers;Heart of Midlothian;Hibernian;Aberdeen;Dundee United;Motherwell;Kilmarnock;St Mirren;Falkirk;Livingston;Dundee' },
    { id: 'SCO2', c: 'SCO', n: 'Scottish Championship', t: 2, q: 48, sp: 3, cal: 'euro', rr: 2, up: 1, dn: 0, v: 'k',
      clubs: 'Ross County;Dunfermline Athletic;Partick Thistle;Raith Rovers;Greenock Morton;Ayr United;Queen\'s Park;Airdrieonians;Arbroath;Hamilton Academical' },
    { id: 'TUR1', c: 'TUR', n: 'Süper Lig', t: 1, q: 63, sp: 8, cal: 'euro', rr: 2, dn: 0, v: 'k', qual: { CL: 1, EL: 2, ECL: 2 },
      clubs: 'Galatasaray;Fenerbahçe;Beşiktaş;Trabzonspor;İstanbul Başakşehir;Samsunspor;Göztepe;Kasımpaşa;Konyaspor;Alanyaspor;Antalyaspor;Çaykur Rizespor;Kayserispor;Gaziantep FK;Eyüpspor;Kocaelispor;Gençlerbirliği;Fatih Karagümrük' },
    { id: 'GRE1', c: 'GRE', n: 'Super League', t: 1, q: 57, sp: 8, cal: 'euro', rr: 2, dn: 0, v: 'k', qual: { CL: 1, EL: 2, ECL: 2 },
      clubs: 'Olympiacos;Panathinaikos;AEK Athens;PAOK;Aris Thessaloniki;Panetolikos;OFI Crete;Asteras Tripolis;Atromitos;Volos;Levadiakos;Lamia;Panserraikos;AE Kifisia' },
    { id: 'SUI1', c: 'SUI', n: 'Super League', t: 1, q: 59, sp: 7, cal: 'euro', rr: 2, dn: 0, v: 'k', qual: { CL: 1, EL: 2, ECL: 2 },
      clubs: 'Young Boys;Basel;Servette;Lugano;FC Zürich;St. Gallen;Lausanne-Sport;Luzern;Sion;Grasshopper;Thun;Winterthur' },
    { id: 'AUT1', c: 'AUT', n: 'Bundesliga', t: 1, q: 59, sp: 7, cal: 'euro', rr: 2, dn: 0, v: 'k', qual: { CL: 1, EL: 2, ECL: 2 },
      clubs: 'Red Bull Salzburg;Sturm Graz;Rapid Wien;Austria Wien;LASK;Wolfsberger AC;TSV Hartberg;Altach;Blau-Weiß Linz;WSG Tirol;Grazer AK;SV Ried' },
    { id: 'DEN1', c: 'DEN', n: 'Superliga', t: 1, q: 59, sp: 7, cal: 'euro', rr: 2, dn: 0, v: 'k', qual: { CL: 1, EL: 2, ECL: 2 },
      clubs: 'FC Copenhagen;FC Midtjylland;Brøndby;AGF;FC Nordsjælland;Silkeborg;Randers;Viborg;Sønderjyske;Vejle;Fredericia;OB' },
    { id: 'SWE1', c: 'SWE', n: 'Allsvenskan', t: 1, q: 57, sp: 6, cal: 'year', rr: 2, dn: 0, v: 'k', qual: { CL: 1, EL: 2, ECL: 2 },
      clubs: 'Malmö FF;AIK;Djurgården;Hammarby;IFK Göteborg;IF Elfsborg;BK Häcken;IFK Norrköping;Mjällby AIF;Kalmar FF;Halmstads BK;IK Sirius;GAIS;Brommapojkarna;Västerås SK;Degerfors IF' },
    { id: 'NOR1', c: 'NOR', n: 'Eliteserien', t: 1, q: 57, sp: 6, cal: 'year', rr: 2, dn: 0, v: 'k', qual: { CL: 1, EL: 2, ECL: 2 },
      clubs: 'Bodø/Glimt;Brann;Viking;Rosenborg;Molde;Tromsø;Sarpsborg 08;Fredrikstad;KFUM Oslo;Sandefjord;Strømsgodset;Lillestrøm;Vålerenga;Kristiansund;HamKam;Aalesund' },
    { id: 'POL1', c: 'POL', n: 'Ekstraklasa', t: 1, q: 56, sp: 6, cal: 'euro', rr: 2, dn: 0, v: 'k', qual: { CL: 1, EL: 2, ECL: 2 },
      clubs: 'Legia Warszawa;Lech Poznań;Raków Częstochowa;Jagiellonia Białystok;Pogoń Szczecin;Cracovia;Górnik Zabrze;Widzew Łódź;Śląsk Wrocław;Piast Gliwice;Korona Kielce;Radomiak Radom;Motor Lublin;Lechia Gdańsk;Zagłębie Lubin;Puszcza Niepołomice;GKS Katowice;Bruk-Bet Termalica Nieciecza' },
    { id: 'CZE1', c: 'CZE', n: 'Fortuna Liga (Primera División)', t: 1, q: 56, sp: 6, cal: 'euro', rr: 2, dn: 0, v: 'k', qual: { CL: 1, EL: 2, ECL: 2 },
      clubs: 'Slavia Praha;Sparta Praha;Viktoria Plzeň;Baník Ostrava;Sigma Olomouc;Slovan Liberec;Mladá Boleslav;FK Jablonec;Hradec Králové;Bohemians 1905;FK Teplice;Dukla Praha;Slovácko;Karviná;Pardubice;České Budějovice' },

    // ================= NORTEAMÉRICA =================
    { id: 'USA1', c: 'USA', n: 'MLS', t: 1, q: 60, sp: 6, cal: 'year', rr: 2, mp: 34, dn: 0, po: { n: 8 }, v: 'k', qual: { CCC: 6 },
      clubs: 'Inter Miami;LAFC;LA Galaxy;Seattle Sounders;Columbus Crew;FC Cincinnati;Philadelphia Union;New York City FC;Atlanta United;Portland Timbers;Vancouver Whitecaps;Nashville SC;San Diego FC;Austin FC;Real Salt Lake;Minnesota United;Orlando City;Charlotte FC;New York Red Bulls;Chicago Fire;Houston Dynamo;FC Dallas;Colorado Rapids;San Jose Earthquakes;Sporting Kansas City;St. Louis City;Toronto FC;CF Montréal;New England Revolution;D.C. United' },
    { id: 'MEX1', c: 'MEX', n: 'Liga MX', t: 1, q: 63, sp: 7, cal: 'year', rr: 1, dn: 0, po: { n: 8 }, v: 'k', qual: { CCC: 5 },
      clubs: 'América;Guadalajara;Cruz Azul;Tigres UANL;Monterrey;Toluca;Pumas UNAM;Pachuca;León;Santos Laguna;Atlas;Necaxa;Querétaro;Tijuana;Mazatlán;Atlético San Luis;FC Juárez;Puebla' },
    { id: 'MEX2', c: 'MEX', n: 'Liga de Expansión MX (desarrollo)', t: 2, q: 50, sp: 4, cal: 'year', rr: 1, dn: 0, po: { n: 8 }, v: 'p',
      clubs: 'Atlante;Atlético La Paz;Tepatitlán;Celaya;Cancún FC;Venados;Tapatío;Mineros de Zacatecas;Leones Negros;Correcaminos UAT;Alebrijes de Oaxaca;Irapuato;Cimarrones de Sonora;Tlaxcala;Atlético Morelia;Pumas Tabasco' },
    { id: 'CAN1', c: 'CAN', n: 'Canadian Premier League', t: 1, q: 46, sp: 4, cal: 'year', rr: 2, dn: 0, po: { n: 4 }, v: 'p', qual: { CCC: 2 },
      clubs: 'Forge FC;Cavalry FC;Atlético Ottawa;Pacific FC;HFX Wanderers;York United;Vancouver FC;Valour FC' },
    { id: 'CRC1', c: 'CRC', n: 'Primera División', t: 1, q: 50, sp: 6, cal: 'year', rr: 2, dn: 0, po: { n: 4 }, v: 'k', qual: { CCC: 3 },
      clubs: 'Saprissa;Alajuelense;Herediano;Cartaginés;Guadalupe FC;Puntarenas FC;Municipal Liberia;Pérez Zeledón;Sporting FC;Santos de Guápiles;Limón FC;Municipal Grecia' },

    // ================= ASIA Y OCEANÍA =================
    { id: 'KSA1', c: 'KSA', n: 'Saudi Pro League', t: 1, q: 64, sp: 8, cal: 'euro', rr: 2, dn: 0, v: 'k', qual: { ACL: 4 },
      clubs: 'Al-Hilal;Al-Nassr;Al-Ittihad;Al-Ahli;Al-Qadsiah;Al-Shabab;Al-Ettifaq;Al-Taawoun;Al-Fateh;Al-Fayha;Al-Khaleej;Al-Raed;Al-Riyadh;Damac;Al-Okhdood;Al-Najma;NEOM SC;Al-Kholood' },
    { id: 'JPN1', c: 'JPN', n: 'J1 League', t: 1, q: 62, sp: 6, cal: 'year', rr: 2, dn: 3, v: 'k', qual: { ACL: 4 },
      clubs: 'Vissel Kobe;Kawasaki Frontale;Sanfrecce Hiroshima;Kashima Antlers;Urawa Red Diamonds;Yokohama F. Marinos;FC Tokyo;Gamba Osaka;Cerezo Osaka;Nagoya Grampus;Kashiwa Reysol;FC Machida Zelvia;Avispa Fukuoka;Shimizu S-Pulse;Tokyo Verdy;Kyoto Sanga;Fagiano Okayama;Mito HollyHock;V-Varen Nagasaki;JEF United Chiba' },
    { id: 'JPN2', c: 'JPN', n: 'J2 League', t: 2, q: 54, sp: 4, cal: 'year', rr: 2, up: 3, dn: 3, v: 'p',
      clubs: 'Vegalta Sendai;Shonan Bellmare;Yokohama FC;Albirex Niigata;Júbilo Iwata;Consadole Sapporo;Montedio Yamagata;Blaublitz Akita;Iwaki FC;Fujieda MYFC;Ventforet Kofu;Thespakusatsu Gunma;Oita Trinita;Tokushima Vortis;Ehime FC;Roasso Kumamoto;Renofa Yamaguchi;Tochigi SC;Sagan Tosu;Omiya Ardija' },
    { id: 'JPN3', c: 'JPN', n: 'J3 League', t: 3, q: 47, sp: 3, cal: 'year', rr: 2, up: 3, dn: 0, v: 'p',
      clubs: 'Kataller Toyama;Gainare Tottori;AC Nagano Parceiro;Matsumoto Yamaga;Giravanz Kitakyushu;FC Imabari;Tegevajaro Miyazaki;Kamatamare Sanuki;FC Gifu;Zweigen Kanazawa;Nara Club;Azul Claro Numazu;SC Sagamihara;Vanraure Hachinohe;Fukushima United;FC Ryukyu;FC Osaka;Iwate Grulla Morioka;Kagoshima United;Tochigi City' },
    { id: 'KOR1', c: 'KOR', n: 'K League 1', t: 1, q: 60, sp: 6, cal: 'year', rr: 2, dn: 1, v: 'k', qual: { ACL: 4 },
      clubs: 'Jeonbuk Hyundai Motors;Ulsan HD;Pohang Steelers;FC Seoul;Daejeon Hana Citizen;Gangwon FC;Gimcheon Sangmu;Jeju SK;Suwon FC;Daegu FC;Incheon United;Gwangju FC' },
    { id: 'KOR2', c: 'KOR', n: 'K League 2', t: 2, q: 50, sp: 4, cal: 'year', rr: 2, up: 1, dn: 0, v: 'p',
      clubs: 'Suwon Samsung Bluewings;Busan IPark;Seongnam FC;Seoul E-Land;Jeonnam Dragons;Gimpo FC;Cheonan City;Chungnam Asan;Bucheon FC 1995;Gyeongnam FC;Ansan Greeners;Hwaseong FC;Chungbuk Cheongju;Paju Frontier' },
    { id: 'CHN1', c: 'CHN', n: 'Chinese Super League', t: 1, q: 57, sp: 6, cal: 'year', rr: 2, dn: 0, v: 'k', qual: { ACL: 3 },
      clubs: 'Shanghai Port;Shanghai Shenhua;Shandong Taishan;Beijing Guoan;Chengdu Rongcheng;Zhejiang FC;Tianjin Jinmen Tiger;Henan FC;Wuhan Three Towns;Qingdao West Coast;Dalian Yingbo;Meizhou Hakka;Changchun Yatai;Shenzhen Peng City;Qingdao Hainiu;Yunnan Yukun' },
    { id: 'AUS1', c: 'AUS', n: 'A-League Men', t: 1, q: 52, sp: 5, cal: 'euro', rr: 2, dn: 0, po: { n: 6 }, v: 'k', qual: { ACL: 1 },
      clubs: 'Melbourne City;Sydney FC;Auckland FC;Central Coast Mariners;Melbourne Victory;Brisbane Roar;Macarthur FC;Adelaide United;Wellington Phoenix;Western Sydney Wanderers;Newcastle Jets;Perth Glory;Western United' },

    // ================= ÁFRICA =================
    { id: 'EGY1', c: 'EGY', n: 'Egyptian Premier League', t: 1, q: 56, sp: 7, cal: 'euro', rr: 2, dn: 0, v: 'k', qual: { CAF: 3 },
      clubs: 'Al Ahly;Zamalek;Pyramids FC;Al Masry;Ceramica Cleopatra;Modern Sport FC;ENPPI;Al Ittihad Alexandria;Smouha;Pharco FC;Zed FC;Haras El Hodoud;Ismaily;Petrojet;El Gouna;Tala\'ea El Gaish;National Bank of Egypt;Ghazl El Mahalla' },
    { id: 'MAR1', c: 'MAR', n: 'Botola Pro', t: 1, q: 55, sp: 6, cal: 'euro', rr: 2, dn: 0, v: 'k', qual: { CAF: 4 },
      clubs: 'Wydad AC;Raja CA;AS FAR;RS Berkane;Maghreb de Fès;Hassania Agadir;FUS Rabat;Olympic Safi;Difaâ El Jadida;Renaissance Zemamra;Moghreb Tétouan;Ittihad Tanger;Rapide Oued Zem;Union Touarga;Youssoufia Berrechid;Mouloudia Oujda' },
    { id: 'RSA1', c: 'RSA', n: 'Betway Premiership', t: 1, q: 54, sp: 6, cal: 'euro', rr: 2, dn: 0, v: 'k', qual: { CAF: 3 },
      clubs: 'Mamelodi Sundowns;Orlando Pirates;Kaizer Chiefs;Stellenbosch;SuperSport United;Cape Town City;AmaZulu;Sekhukhune United;Royal AM;Golden Arrows;TS Galaxy;Polokwane City;Richards Bay;Chippa United;Magesi FC;Durban City' },
    { id: 'TUN1', c: 'TUN', n: 'Ligue Professionnelle 1', t: 1, q: 52, sp: 6, cal: 'euro', rr: 2, dn: 0, v: 'k', qual: { CAF: 3 },
      clubs: 'Espérance de Tunis;Club Africain;Étoile du Sahel;CS Sfaxien;US Monastir;Stade Tunisien;US Ben Guerdane;CA Bizertin;ES Zarzis;Olympique Béja;EGS Gafsa;JS Kairouan;AS Gabès;AS Marsa;US Tataouine;AS Soliman' },
    { id: 'ALG1', c: 'ALG', n: 'Ligue 1 Mobilis', t: 1, q: 52, sp: 6, cal: 'euro', rr: 2, dn: 0, v: 'k', qual: { CAF: 3 },
      clubs: 'CR Belouizdad;MC Alger;JS Kabylie;USM Alger;ES Sétif;JS Saoura;CS Constantine;MC Oran;USM Khenchela;ASO Chlef;Paradou AC;NC Magra;MB Rouissat;US Biskra;Olympique Akbou;AS Khroub' }
  ];

  // Selecciones nacionales: código:nombre:confederación:rating-previo(estimación del autor, no ranking FIFA oficial)
  var nationsRaw = (
    'ARG:Argentina:CONMEBOL:90,BRA:Brasil:CONMEBOL:87,URU:Uruguay:CONMEBOL:82,COL:Colombia:CONMEBOL:81,ECU:Ecuador:CONMEBOL:75,PAR:Paraguay:CONMEBOL:71,CHI:Chile:CONMEBOL:66,PER:Perú:CONMEBOL:65,VEN:Venezuela:CONMEBOL:64,BOL:Bolivia:CONMEBOL:58,' +
    'FRA:Francia:UEFA:90,ESP:España:UEFA:90,ENG:Inglaterra:UEFA:88,POR:Portugal:UEFA:87,NED:Países Bajos:UEFA:85,GER:Alemania:UEFA:85,BEL:Bélgica:UEFA:82,ITA:Italia:UEFA:82,HRV:Croacia:UEFA:80,SUI:Suiza:UEFA:76,DEN:Dinamarca:UEFA:76,AUT:Austria:UEFA:75,TUR:Turquía:UEFA:75,SRB:Serbia:UEFA:73,POL:Polonia:UEFA:72,UKR:Ucrania:UEFA:72,NOR:Noruega:UEFA:73,SWE:Suecia:UEFA:72,SCO:Escocia:UEFA:71,CZE:República Checa:UEFA:70,GRE:Grecia:UEFA:68,WAL:Gales:UEFA:66,IRL:Irlanda:UEFA:62,HUN:Hungría:UEFA:68,SVK:Eslovaquia:UEFA:64,ROU:Rumanía:UEFA:66,' +
    'USA:Estados Unidos:CONCACAF:77,MEX:México:CONCACAF:76,CAN:Canadá:CONCACAF:70,CRC:Costa Rica:CONCACAF:60,PAN:Panamá:CONCACAF:64,JAM:Jamaica:CONCACAF:60,HON:Honduras:CONCACAF:55,HAI:Haití:CONCACAF:52,SLV:El Salvador:CONCACAF:50,CUW:Curazao:CONCACAF:50,' +
    'JPN:Japón:AFC:78,KOR:Corea del Sur:AFC:74,IRN:Irán:AFC:74,AUS:Australia:AFC:70,KSA:Arabia Saudita:AFC:66,QAT:Catar:AFC:62,UZB:Uzbekistán:AFC:64,IRQ:Irak:AFC:58,JOR:Jordania:AFC:60,UAE:Emiratos Árabes:AFC:56,CHN:China:AFC:56,' +
    'MAR:Marruecos:CAF:81,SEN:Senegal:CAF:77,EGY:Egipto:CAF:70,NGA:Nigeria:CAF:72,CIV:Costa de Marfil:CAF:72,ALG:Argelia:CAF:70,TUN:Túnez:CAF:66,CMR:Camerún:CAF:68,GHA:Ghana:CAF:66,RSA:Sudáfrica:CAF:60,MLI:Malí:CAF:64,COD:RD del Congo:CAF:62,BFA:Burkina Faso:CAF:60,CPV:Cabo Verde:CAF:58,' +
    'NZL:Nueva Zelanda:OFC:55,FIJ:Fiyi:OFC:34,NCL:Nueva Caledonia:OFC:32'
  ).split(',').map(function (s) { var p = s.split(':'); return { c: p[0], n: p[1], conf: p[2], r: +p[3] }; });

  // Equivalencias de continentes para jugadores extranjeros generados (nacionalidades "sin liga" en la base)
  FP.DATA = {
    version: 1,
    seasonLabel: '2025-26 / 2026',
    countries: countries,
    leagues: L,
    nations: nationsRaw,
    // Lo que NO está en esta primera versión (se informa en la interfaz):
    pending: [
      'Plantillas reales de jugadores: no se cargaron (sin fuente con licencia utilizable). Todos los futbolistas son generados.',
      'Tercera División B de Chile, Primera B Metropolitana y ligas inferiores de Argentina, Série D completa (96 clubes) y Serie C italiana completa (60 clubes): listas parciales o ausentes.',
      'Ligas de Suiza, Austria, Dinamarca, Suecia, Noruega, Polonia, República Checa, Grecia y Turquía solo tienen primera categoría (segunda categoría pendiente).',
      'Ligas de Europa del Este, Balcanes, Chipre, Israel, Irán, Catar, Emiratos, Uzbekistán, Centroamérica (salvo Costa Rica) y África subsahariana: pendientes.',
      'Ascensos/descensos reales de 2026-27 posteriores a mayo de 2026: no verificados. Las composiciones de ligas marcadas "k" pueden tener errores.',
      'Formatos con Apertura/Clausura (Argentina, Colombia, Paraguay, Uruguay, Perú, Bolivia, Ecuador) están simplificados a tabla única.',
      'Resultados previos al inicio de la partida (mayo de 2026) son SIMULADOS, no reales.'
    ]
  };
})();
