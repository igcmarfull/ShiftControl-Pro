/* FUTPRO — utilidades base: RNG con semilla, fechas, formato, nombres generados */
(function () {
  'use strict';
  var FP = window.FP = window.FP || {};

  // ---------- RNG determinista ----------
  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash() { // hash de varios valores -> entero 32 bits
    var h = 2166136261;
    for (var i = 0; i < arguments.length; i++) {
      var s = String(arguments[i]);
      for (var j = 0; j < s.length; j++) { h ^= s.charCodeAt(j); h = Math.imul(h, 16777619); }
      h ^= 124; h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  // RNG global de la partida: su estado vive en FP.S.rs (se guarda con la partida)
  var tmpState = 123456789;
  function R() {
    var S = FP.S, a;
    if (S) { a = S.rs = (S.rs + 0x6D2B79F5) | 0; } else { a = tmpState = (tmpState + 0x6D2B79F5) | 0; }
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  var U = {
    mulberry: mulberry, hash: hash, R: R,
    int: function (a, b, r) { r = r || R; return a + Math.floor(r() * (b - a + 1)); },
    pick: function (arr, r) { r = r || R; return arr[Math.floor(r() * arr.length)]; },
    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
    norm: function (r) { r = r || R; var u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
    poisson: function (l, r) { r = r || R; var L = Math.exp(-l), k = 0, p = 1; do { k++; p *= r(); } while (p > L && k < 12); return k - 1; },
    wpick: function (items, wfn, r) { // selección ponderada
      r = r || R; var t = 0, i, w = new Array(items.length);
      for (i = 0; i < items.length; i++) { w[i] = Math.max(0, wfn(items[i])); t += w[i]; }
      if (t <= 0) return items[Math.floor(r() * items.length)];
      var x = r() * t;
      for (i = 0; i < items.length; i++) { x -= w[i]; if (x <= 0) return items[i]; }
      return items[items.length - 1];
    },
    shuffle: function (arr, r) { r = r || R; for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; },
    chance: function (p, r) { return (r || R)() < p; },
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  };

  // ---------- Fechas: semana 0 = lunes 18-may-2026 ----------
  var START = Date.UTC(2026, 4, 18), DAY = 86400000, Y0 = 2026;
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  FP.Date = {
    START: START, MESES: MESES, y0: Y0,
    // año de inicio de la partida: la semana 0 cae en el lunes más cercano al 18 de mayo de ese año
    setStart: function (y) {
      y = Math.max(1990, Math.min(2060, Math.round(+y) || 2026));
      var t = Date.UTC(y, 4, 18), dow = new Date(t).getUTCDay(), back = (dow + 6) % 7;
      START = t - (back > 3 ? back - 7 : back) * DAY; Y0 = y; FP.Date.y0 = y; FP.Date.START = START;
    },
    d: function (w) { return new Date(START + w * 7 * DAY); },
    year: function (w) { return new Date(START + w * 7 * DAY).getUTCFullYear(); },
    month: function (w) { return new Date(START + w * 7 * DAY).getUTCMonth(); }, // 0-11
    fmt: function (w) { var d = new Date(START + w * 7 * DAY); return d.getUTCDate() + ' ' + MESES[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); },
    fmtLong: function (w) { var d = new Date(START + w * 7 * DAY); return MESES_L[d.getUTCMonth()] + ' de ' + d.getUTCFullYear(); },
    of: function (y, m, d) { return Math.floor((Date.UTC(y, m, d) - START) / (7 * DAY)); }, // m: 0-11
    // fecha de nacimiento exacta del jugador (h.bd = [año, mes 0-11, día]); si no existe, la del lunes de su semana de nacimiento
    bd: function (h) { if (h && h.bd) return h.bd; var d = this.ymd(h.b); return [d[0], d[1], d[2]]; },
    bdText: function (h) { var b = this.bd(h); return b[2] + ' de ' + MESES_L[b[1]] + ' de ' + b[0]; },
    ymd: function (w) { var d = new Date(START + w * 7 * DAY); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]; }
  };

  // ---------- Formato ----------
  FP.fmt = {
    money: function (k) { // k = miles de euros
      if (k == null || isNaN(k)) return '—';
      var a = Math.abs(k);
      if (a >= 1000) return (k / 1000).toFixed(a >= 10000 ? 0 : 1).replace('.0', '') + ' M€';
      return Math.round(k) + ' mil €';
    },
    num: function (n) { return Number(n).toLocaleString('es-CL'); },
    signed: function (n) { return (n > 0 ? '+' : '') + n; },
    f1: function (n) { return (Math.round(n * 10) / 10).toFixed(1); }
  };

  // ---------- Nombres generados (ficticios) por región ----------
  var N = {
    es: { f: 'Diego Matías Benjamín Vicente Joaquín Sebastián Nicolás Cristóbal Felipe Tomás Martín Lucas Agustín Gabriel Maximiliano Ignacio Javier Bastián Esteban Rodrigo Álvaro Pablo Andrés Camilo Franco Emilio Gonzalo Iván Leandro Marcelo Mauricio Ramiro Santiago Thiago Fabián Cristian Claudio Hugo'.split(' '),
      l: 'González Muñoz Rojas Díaz Pérez Soto Contreras Silva Martínez Sepúlveda Morales Rodríguez López Fuentes Hernández Torres Araya Flores Espinoza Valenzuela Castillo Tapia Reyes Gutiérrez Castro Pizarro Álvarez Vera Fernández Gómez Sánchez Ramírez Herrera Medina Aguilera Vargas Cortés Navarro Campos Ortiz Salazar Ibáñez Cárdenas Peña Ríos Núñez'.split(' ') },
    pt: { f: 'João Pedro Lucas Gabriel Matheus Guilherme Rafael Gustavo Felipe Bruno Thiago Vinícius Leandro Caio Davi Henrique Murilo Diogo Rodrigo Danilo Igor Renan Wesley Alan Everton Marcos Paulo Ricardo Samuel Yuri'.split(' '),
      l: 'Silva Santos Oliveira Souza Lima Pereira Costa Ferreira Rodrigues Almeida Nascimento Araújo Ribeiro Carvalho Gomes Martins Rocha Barbosa Moreira Cardoso Teixeira Nunes Mendes Freitas Duarte Batista Campos Moura Pinto Cunha Machado'.split(' ') },
    en: { f: 'James Jack Harry Oliver Charlie George Thomas Daniel Callum Connor Jordan Liam Ryan Luke Mason Ethan Tyler Joe Ben Sam Kyle Aaron Dean Scott Craig Adam Nathan Jamie Declan Reece'.split(' '),
      l: 'Smith Jones Taylor Brown Williams Wilson Evans Walker Wright Robinson Thompson White Hughes Edwards Green Hall Wood Harris Clarke Turner Hill Cooper Ward Morris Moore King Parker Baker Bennett Cook Shaw'.split(' ') },
    it: { f: 'Marco Luca Andrea Matteo Lorenzo Davide Alessandro Federico Simone Riccardo Francesco Giorgio Stefano Nicolò Edoardo Gianluca Fabio Emanuele Daniele Tommaso Pietro Salvatore Antonio Mattia'.split(' '),
      l: 'Rossi Russo Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno Gallo Conti De Luca Costa Giordano Mancini Rizzo Lombardi Moretti Barbieri Fontana Santoro Mariani Rinaldi Caruso Ferrara Galli'.split(' ') },
    de: { f: 'Lukas Jonas Felix Leon Maximilian Tim Jan Niklas Florian Moritz Julian Fabian Philipp Tobias Sebastian Kevin Marcel Dominik Patrick Stefan Marvin Robin Lars Nico Erik'.split(' '),
      l: 'Müller Schmidt Schneider Fischer Weber Meyer Wagner Becker Schulz Hoffmann Koch Richter Klein Wolf Schröder Neumann Schwarz Zimmermann Braun Krüger Hofmann Hartmann Lange Werner Krause Lehmann Köhler Maier Keller'.split(' ') },
    fr: { f: 'Lucas Hugo Louis Jules Théo Nathan Enzo Mathis Maxime Antoine Baptiste Clément Romain Kylian Yanis Adrien Florian Anthony Quentin Alexis Valentin Mehdi Rayan Samuel Thibault'.split(' '),
      l: 'Martin Bernard Dubois Thomas Robert Richard Petit Durand Leroy Moreau Simon Laurent Lefebvre Michel Garcia David Bertrand Roux Vincent Fournier Morel Girard André Mercier Dupont Lambert Bonnet François Martinez Blanc'.split(' ') },
    nl: { f: 'Daan Sem Luuk Finn Jesse Milan Thijs Bram Ruben Stijn Joris Kevin Tom Mats Teun Niels Jeroen Rick Wouter Sven Lars Bart Maarten Dennis Koen'.split(' '),
      l: 'de_Jong Jansen de_Vries van_den_Berg van_Dijk Bakker Janssen Visser Smit Meijer de_Boer Mulder de_Groot Bos Vos Peters Hendriks van_Leeuwen Dekker Brouwer de_Wit Dijkstra Smits de_Graaf van_der_Meer'.split(' ') },
    nd: { f: 'Erik Lars Anders Magnus Oscar Emil Mikkel Jonas Rasmus Henrik Kasper Mathias Viktor Johan Filip Sander Mads Jesper Kristian Simon Alexander Sebastian Joakim Tobias Marcus'.split(' '),
      l: 'Andersen Nielsen Hansen Pedersen Jensen Larsen Johansson Lindberg Eriksson Karlsson Olsen Berg Nilsson Svensson Holm Lund Dahl Strand Berglund Nyström Sørensen Møller Kristensen Jørgensen Haugen'.split(' ') },
    sl: { f: 'Jakub Tomasz Marcin Piotr Michał Kamil Łukasz Paweł Adam Dominik Filip Marek Ondřej Vojtěch Lukáš Jan Martin Petr Radek Štěpán Dawid Krzysztof Mateusz Bartosz Patryk'.split(' '),
      l: 'Nowak Kowalski Wiśniewski Wójcik Kamiński Lewandowski Zieliński Szymański Woźniak Dąbrowski Novák Svoboda Novotný Dvořák Černý Procházka Kučera Veselý Horák Němec Pokorný Marek Kolář Jelínek Král'.split(' ') },
    tr: { f: 'Mehmet Ahmet Mustafa Emre Burak Can Ozan Hakan Kerem Yusuf Serkan Barış Cem Onur Berkay Efe Arda Kaan Caner Deniz Okan Volkan Ömer Fatih Tolga'.split(' '),
      l: 'Yılmaz Kaya Demir Çelik Şahin Yıldız Yıldırım Öztürk Aydın Özdemir Arslan Doğan Kılıç Aslan Çetin Kara Koç Kurt Özkan Şimşek Polat Erdoğan Güneş Aksoy Korkmaz'.split(' ') },
    gr: { f: 'Giorgos Nikos Dimitris Kostas Panagiotis Christos Vasilis Yannis Thanasis Andreas Michalis Stelios Alexandros Spyros Lefteris Pavlos Manolis Tasos'.split(' '),
      l: 'Papadopoulos Vlachos Georgiou Nikolaidis Konstantinou Dimitriou Antoniou Papadakis Karagiannis Ioannou Makris Pappas Oikonomou Vasileiou Alexiou Stavrou Galanis Zografos'.split(' ') },
    ja: { f: 'Haruto Yuto Sota Ren Kaito Daiki Takumi Ryota Shota Kenta Yuki Hiroto Naoki Kosuke Taiga Riku Shun Yusei Hayato Koki Kazuki Tomoya Sho Ryo Masato'.split(' '),
      l: 'Sato Suzuki Takahashi Tanaka Watanabe Ito Yamamoto Nakamura Kobayashi Kato Yoshida Yamada Sasaki Yamaguchi Matsumoto Inoue Kimura Hayashi Shimizu Saito Ogawa Fujita Okada Mori Hasegawa'.split(' ') },
    ko: { f: 'Min-jun Seo-jun Ji-hoon Hyun-woo Joon-ho Sung-min Dong-hyun Jae-hyun Tae-yang Woo-jin Seung-ho Young-jae Ki-chan Jin-su Do-yun Hee-chan Kang-in Gun-woo Min-ho Sang-ho'.split(' '),
      l: 'Kim Lee Park Choi Jung Kang Cho Yoon Jang Lim Han Oh Seo Shin Kwon Hwang Ahn Song Jeon Hong'.split(' ') },
    zh: { f: 'Wei Lei Hao Jun Yang Chen Peng Bo Tao Long Ming Jian Kai Xin Yu Feng Gang Qiang Liang Zhen Hui Rui Cheng Dong Hong'.split(' '),
      l: 'Wang Li Zhang Liu Chen Yang Huang Zhao Wu Zhou Xu Sun Ma Zhu Hu Guo He Lin Gao Luo Zheng Liang Xie Song Tang'.split(' ') },
    ar: { f: 'Mohamed Ahmed Mahmoud Omar Youssef Karim Hassan Khaled Ali Ibrahim Mostafa Amr Walid Tarek Hamza Anis Nabil Samir Rachid Bilal Yassine Zakaria Mehdi Ayman Sofiane'.split(' '),
      l: 'Hassan Ibrahim Mansour Saleh Farouk Said Mahfouz Benali Bouzid Haddad Mansouri Tounsi Ben Salah Amrani Belhadj Cherif Zerrouki Mokhtar Ghanem Nasser Darwish Khalil Sabri Fadel Rahmani'.split(' ') },
    af: { f: 'Thabo Sipho Lungelo Bongani Themba Kagiso Siyabonga Mpho Tshepo Lebo Sibusiso Kwame Kofi Yaw Emeka Chidi Ousmane Moussa Idrissa Cheikh Mamadou Seydou Sadio Samuel Tendai'.split(' '),
      l: 'Nkosi Dlamini Mokoena Khumalo Zulu Mahlangu Ndlovu Mthembu Sithole Molefe Mensah Owusu Boateng Adeyemi Okafor Eze Diallo Traoré Diop Konaté Sow Ndiaye Camara Keita Sissoko'.split(' ') },
    hi: { f: 'Rahul Arjun Rohan Aditya Vikram Sandeep Amit Rajesh Karan Suresh Anil Vijay Ravi Manish Nikhil Pranav Siddharth Harsh Kunal Deepak'.split(' '),
      l: 'Sharma Singh Kumar Patel Gupta Verma Reddy Nair Chhetri Das Banerjee Mukherjee Yadav Chauhan Joshi Mehta Iyer Pillai Rao Thapa'.split(' ') },
    th: { f: 'Somchai Anan Kittisak Teerasil Chanathip Supachai Narong Weerachai Prasert Surachai Adisak Piyapong Sarawut Kritsada Tanawat Jakkrit Natthaphong Worachit Pichit Nattawut'.split(' '),
      l: 'Srisuk Chaiyasit Dangda Songkrasin Boonmee Saetang Wongsa Phromma Chantaruk Kaewmala Thongchai Rattanakul Sirichai Yoovidhya Pholsri Nilsri Sukhum Jaidee Wattana Pongsiri'.split(' ') },
    en2: { f: 'Jackson Tyler Mason Liam Noah Connor Brandon Cody Austin Kyle Ryan Jordan Alex Zach Evan Chase Trevor Dylan Hunter Logan'.split(' '),
      l: 'Johnson Miller Davis Anderson Thomas Jackson Martin Lee Thompson White Harris Clark Lewis Robinson Walker Young Allen Scott Adams Baker Nelson Carter Mitchell Roberts'.split(' ') }
  };
  // región de nombres por país (ISO-3 propio del juego)
  var NR = {
    CHI: 'es', ARG: 'es', URU: 'es', PAR: 'es', COL: 'es', PER: 'es', ECU: 'es', BOL: 'es', VEN: 'es', ESP: 'es', MEX: 'es', CRC: 'es',
    BRA: 'pt', POR: 'pt', ENG: 'en', SCO: 'en', AUS: 'en', CAN: 'en', USA: 'en2', ITA: 'it', GER: 'de', AUT: 'de', SUI: 'de',
    FRA: 'fr', BEL: 'fr', NED: 'nl', DEN: 'nd', SWE: 'nd', NOR: 'nd', POL: 'sl', CZE: 'sl', TUR: 'tr', GRE: 'gr',
    JPN: 'ja', KOR: 'ko', CHN: 'zh', KSA: 'ar', EGY: 'ar', MAR: 'ar', TUN: 'ar', ALG: 'ar', RSA: 'af',
    IND: 'hi', THA: 'th', BUL: 'sl', RUS: 'sl', ISR: 'en', CYP: 'gr', FIN: 'nd', ISL: 'nd', GUA: 'es', HRV: 'sl', SRB: 'sl', UKR: 'sl', HUN: 'sl', SVK: 'sl', ROU: 'sl', WAL: 'en', IRL: 'en', PAN: 'es', HON: 'es', SLV: 'es', HAI: 'fr', JAM: 'en', CUW: 'nl',
    IRN: 'ar', QAT: 'ar', UAE: 'ar', IRQ: 'ar', JOR: 'ar', UZB: 'tr', NGA: 'af', GHA: 'af', CIV: 'af', SEN: 'af', CMR: 'af', MLI: 'af', COD: 'af', BFA: 'af', CPV: 'pt', NZL: 'en', FIJ: 'en', NCL: 'fr'
  };
  FP.Names = {
    region: function (nat) { return NR[nat] || 'en'; },
    gen: function (nat, r) {
      var p = N[NR[nat] || 'en'] || N.en;
      return U.pick(p.f, r) + ' ' + U.pick(p.l, r).replace(/_/g, ' ');
    },
    club: function (r) { // nombres de clubes amateur generados
      var a = ['Deportivo', 'Club Social y Deportivo', 'Unión', 'Atlético', 'Juventud', 'Sporting', 'Real', 'Estrella', 'Rangers', 'Defensores de', 'Municipal', 'Independiente', 'Arturo Prat', 'Libertad', 'Brisas de'];
      var b = ['Las Palmas', 'El Sauce', 'Santa Rosa', 'La Cruz', 'Los Cerrillos', 'San Pedro', 'El Roble', 'Villa Alegre', 'Las Rosas', 'Cordillera', 'El Peumo', 'San Isidro', 'Las Acacias', 'Santa Elena', 'Los Olmos', 'La Colina', 'Barrio Norte', 'El Mirador', 'Las Vegas', 'Puerto Seco'];
      return U.pick(a, r) + ' ' + U.pick(b, r);
    }
  };

  FP.U = U;
})();
