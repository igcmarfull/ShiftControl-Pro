# Propuesta: sistema de representantes (solo auditoría y diseño, sin código de juego)

Estado: **propuesta pendiente de aprobación**. No modifica el motor. Se añade únicamente `tools/auditoria/agentcmp.js` (medición).

## 1. Auditoría: qué hacen hoy los representantes

| Pieza | Archivo | Efecto real |
|---|---|---|
| `h.agent = {nm, lvl, com}` | hero.js:78, market.js `hireAgent` | Identidad mínima: nombre aleatorio del país del héroe, nivel 1/3/5, comisión 3/6/10 %. Sin historia, país, especialidad ni relación. |
| `Market.agentCandidates` | market.js:458 | 3 candidatos fijos por año (niveles 1, 3, 5). Todos del país del héroe. |
| `Market.agentMult` | market.js:130 | `1 + lvl·0.05` (hasta ×1.25). Se aplica en `Rep.wage` (scouting.js:232) y en el techo de `sueldos.js:187`. **Es casi todo su efecto.** |
| `M.negotiate` | scouting.js:394 | `+lvl·0.04` a la probabilidad de aceptación de una negociación de traspaso. |
| `K.net` / sueldo semanal | contracts.js:59, hero.js:334 | Descuenta la comisión de cada pago (salvo inversión). |
| Redes | redes.js:107,225 | Opciones "que lo resuelva tu agente" en crisis/rumor. |
| Bio / UI | bio.js:231, ui-v5 `agentCard`, `A.dropagent` | Texto y tarjeta; despedir es gratis e inmediato. |
| `agency.js`/`postcareer.js` | — | Sistema distinto (el héroe retirado como agente). No se toca. |

**Lo que NO hace:** no interviene en `Rep.exposure`, `Rep.scoutWeek`, `Rep.spark`, `Rep.fit`, `Rep.offers`, `K.preOffers`, pruebas (`requestTrial/resolveTrial`, `seniorTrials`) ni cesiones. No genera contactos, ni visibilidad, ni seguimiento. `Market.transferOffers` es código muerto.

**Medición** (`tools/auditoria/agentcmp.js`, 3 semillas, héroe CHI ovr ≈76, 104 semanas, sin agente vs. nivel 5):
ofertas 4/4/3 vs 4/4/5; sueldo medio ofrecido 209/347/444 vs 517/552/441; nivel medio del comprador 60/62/63 vs 63/65/64. Conclusión: hoy el agente es un multiplicador de sueldo con comisión; no cambia *qué* clubes se interesan.

Puntos de enganche reales (confirmados en el código): `Rep.exposure(club)` (umbral de visibilidad de clubes extranjeros `int ≥ 24+(q−48)·1.25`), `Rep.scoutWeek` (elige club con `Rep.pickClub`), `Rep.spark`, `Rep.fit`, `Rep.lowerGate/offerGate/attract` (rama precontratos), `Rep.offers`, `K.preOffers`, `M.negotiate`, `Rep.seniorTrials`.

## 2. Diseño funcional

Principio: **el agente solo modula probabilidades y visibilidad; nunca crea ofertas ni salta requisitos deportivos.** Toda oferta nace en los motores existentes.

### 2.1 Agentes persistentes
Mundo de ~60–90 agentes generados de forma determinista (`U.hash(seed,'agentes')`), no consumen `U.R`. Cada uno:
- Identidad: nombre/nacionalidad (hash), edad, años de carrera.
- `lvl` 1–5 (calidad profesional), `exp` (crece con clientes colocados), `rep` 0–100.
- `neg` (habilidad negociadora → sueldo/bonos y `M.negotiate`).
- `com` y `dur` (comisión 3–12 %, duración 1–4 años) acordes a su nivel.
- `contacts`: mapa `{país o liga: 0..1}` (fuerza de contacto). Ej.: especialista inglés de 3ª/4ª → `ENG3:.9, ENG4:.9, ENG2:.5, ENG1:.1`; ibérico/italiano → `ESP:.8, POR:.8, ITA:.7`; "exótico" → `JPN, KOR, UZB, GUA, HON`. Se admite contacto por país donde no hay liga jugable (Indonesia, Malasia no existen en el juego: **no se inventan**; solo se listan países/ligas existentes).
- `spec`: nivel de competición donde rinde (`elite|media|baja`), `profile`: perfil preferido (joven promesa, veterano, delantero, etc.), `style`: `dinero|desarrollo|equilibrado`.
- `roster`: ids de clientes (límite ~12–25 según nivel → los agentes top son selectivos).

### 2.2 Mercados siempre abiertos
Contacto `c` (0..1) solo aporta, nunca prohíbe:
- Visibilidad: reduce el umbral de `Rep.exposure` de ese club/país en hasta **−6 puntos de `int`** (moderado; nunca bajar de lo que el club exige en nivel).
- Probabilidad de seguimiento (`Rep.spark/scoutWeek`): peso ×(1 + 0.5·c).
- Negociación: `+0.05·c` en aceptación y mejor sueldo vía `neg`.
Sin contacto el factor es 1: las ofertas espontáneas siguen igual. `Rep.fit`, `lowerGate`, `offerGate` y los requisitos de plantilla se mantienen intactos.

### 2.3 Hablar con el representante (instrucciones)
Una instrucción activa a la vez (`h.agent.brief`), con coste de semanas de gestión y caducidad:
`pais:X`, `liga:X/división`, `europa`, `titular` (divisiones inferiores), `sueldo`, `desarrollo`, `cesion`, `renovar`, `prueba` (solo sin club), `cualquiera` (compatible).
Cada instrucción actúa como **filtro y sesgo sobre los candidatos que el motor ya genera**, y como un "búsqueda activa" semanal: el agente hace una tirada con `p = base(lvl, contacto, rep del jugador, edad, pot, situación contractual)`, y si prospera **llama a los generadores existentes** (`Rep.addInterest`, `K.preOffers`, `M.requestTrial`, oferta de cesión) con el club elegido por `Rep.pickClub` restringido al destino pedido. Los resultados posibles: club interesado, ojeadores, invitación a prueba, oferta de traspaso, precontrato, cesión, rechazo del club, sin oportunidades. El club puede rechazar por `fit`/plantilla/presupuesto: se respeta `lowerGate/offerGate`.

### 2.4 Consecuencias reales
- Tope de búsquedas: 1 gestión nueva cada N semanas por agente y un contador anual (`h.agent.used`) → sin spam.
- El jugador de ovr 50 con reputación 29 puede acabar en una 4ª inglesa o 1ª de Uzbekistán si el agente tiene contacto; nunca en el Madrid solo por tener un buen agente.
- El agente informa de "sin oportunidades" cuando corresponde (honestidad, sin ofertas fabricadas).

### 2.5 Agentes que buscan jugadores
Eventos (temporada destacada, convocatoria, premio, hat-trick…) activan una tirada de "interés de agente" sobre agentes sin cupo; los de `rep` alta exigen más (ovr/rep mínimos). Oferta de representación con comisión/duración propios; el jugador acepta o ignora. Máx. 1–2 ofertas por temporada.

### 2.6 Relaciones y cambios
`rel` 0–100 por agente: sube con éxitos, baja con contratos mal valorados o ignorar consejos. Desacuerdos (agente "dinero" quiere salir; "desarrollo" aconseja quedarse) como evento con opciones. Cambiar de agente: periodo de preaviso, cláusula de duración (indemnización = comisión pendiente) y **enfriamiento de 26 semanas** sin gestiones nuevas, que evita el exploit de rotar agentes. Los agentes ganan contactos (`+0.02/año` por colocaciones en una liga) y envejecen/se retiran.

## 3. Estructura de datos y funciones

Nuevo archivo `js/agentes.js` (IIFE `FP.Agents`, después de `scouting.js`/`origenes.js`; añadir a `index.html` y `tests/harness.js`) + `js/ui-agentes.js`.

Estado (`S.agents` y `h.agent`, con migración retrocompatible: `h.agent={nm,lvl,com}` antiguo se convierte en un agente id sintético):
```
S.agents = { list:[{id,nm,nat,lvl,exp,rep,neg,com,dur,contacts,spec,profile,style,roster}], seed }
h.agent  = { id, nm, lvl, com, since, until, rel, brief:{k,arg,wk}, used, cd }   // nm/lvl/com se mantienen por compatibilidad
```
Funciones nuevas: `Agents.world()`, `Agents.candidates()` (reemplaza `Market.agentCandidates`), `Agents.hire/drop`, `Agents.contact(club|country)`, `Agents.weekly()`, `Agents.brief(k,arg)`, `Agents.approach()` (agentes que buscan), `Agents.relation()`.
Funciones a modificar (cambios mínimos, siempre `if (FP.Agents)`):
- `Market.hireAgent/agentCandidates/agentMult` → delegan.
- `Rep.exposure` (umbral −contacto), `Rep.pickClub`/`Rep.spark`/`Rep.scoutWeek` (peso por contacto e instrucción), `Rep.offers` y `K.preOffers` (sesgo por brief; sin tocar gates), `M.negotiate` (usa `neg` y `contact`), `M.requestTrial`.
- `K.net` (comisión desde `h.agent.com`, igual), `Store.pack/unpack` (guardado de `S.agents`).
- `hero.js:78` inicial, `ui-v5.js agentCard`, `ui-v3b.js`, `ui-screens2.js` (`A.dropagent`).

## 4. Ejemplos
1. **Delantero chileno ovr 60, rep int 29, 24 años, sin club, agente "inglés 3ª/4ª" (contacto ENG3/4 0,9).** Instrucción `titular`. Semana a semana el umbral de exposición de clubes ENG3/4 baja ~5 puntos; sale invitación a prueba y luego oferta de un club League Two. Un club de Premier sigue sin verlo (ovr y rep no alcanzan).
2. **Extremo español ovr 70, 21 años, agente ibérico/italiano.** `europa`: más seguimiento de clubes ESP/POR/ITA; aun así llegan ofertas espontáneas de Francia o Brasil como hoy.
3. **Mediocentro ovr 50 sin agente.** Sin cambios respecto de hoy; si juega un año a gran nivel, un agente modesto le propone representación.
4. **Crack ovr 90.** Agente "elite" selectivo se acerca tras ganar un premio; su contacto apenas cambia nada porque ya es visible; mejora sueldo y bonos (`neg`).
5. **Cambio de agente:** nuevo agente con contactos asiáticos; 26 semanas de enfriamiento, no puede encadenar agentes para repetir tiradas.

## 5. Riesgos
- Doble motor de ofertas → mitigación: el agente solo **sesga y dispara** los generadores existentes.
- Exploits (rotar agentes, spam de instrucciones) → enfriamiento, tope anual, coste de comisión.
- Ofertas excesivas o irreales → todas pasan por `fit/lowerGate/offerGate`; test de frecuencia por nivel.
- Determinismo/guardados → agentes por hash y migración de `h.agent`; no consumir `U.R` en contenido cosmético.
- Colisión con la rama `futpro/precontratos-realistas` (toca `scouting.js`, `contracts.js`) → implementar **después** de integrarla, sobre esa base.
- Cobertura: Indonesia/Malasia/Singapur/Vietnam/Filipinas no tienen liga jugable; no se simulan.
- Rendimiento: ~90 agentes con tirada semanal → O(clientes); aceptable.
- Efecto sobre economía (`agentMult`) → mantener tope ×1.25 para no desequilibrar `sueldos.js`.

## 6. Plan por fases
1. **Fase 1 (pequeña, verificable):** `agentes.js` con mundo de agentes + `contacts`, migración de `h.agent`, candidatos variados, relación/duración/comisión. Sin tocar ofertas. Tests: determinismo, migración, guardado.
2. **Fase 2:** contactos en `Rep.exposure/pickClub/spark/scoutWeek` (visibilidad moderada). Tests con ovr 50/60/70/80/90, edades y países: el agente mejora oportunidades en sus mercados, sin garantizar fichajes; `tools/auditoria` compara con/sin agente.
3. **Fase 3:** instrucciones (`brief`) y búsqueda activa que reutiliza `Rep.addInterest`/`K.preOffers`/pruebas/cesiones; topes anti-spam.
4. **Fase 4:** agentes que se acercan, relaciones, desacuerdos, cambio de agente con enfriamiento.
5. **Fase 5:** UI y narrativa (`ui-agentes.js`, bio, redes), regresión completa (partidos, goleadores, equilibrio, sueldos, economia, origenes, prensa, valor, contracts, contratos2, ofertas, retiro, proyectos, idolo, narrativa, seleccion, callups, invariants) y README.

Criterio de aceptación de cada fase: tests nuevos en verde + regresión existente sin cambios.
