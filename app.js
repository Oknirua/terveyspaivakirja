"use strict";

/*
 * Terveyspäiväkirja — application logic.
 *
 * A minimal, fully VoiceOver-accessible health diary.
 * All user-visible text is in Finnish; code and comments are in English.
 *
 * Data model: entries are stored in localStorage as a JSON array.
 * Entries are append-only — they can never be edited or deleted.
 * Each entry: { "päivämäärä": "2026-07-03", "kellonaika": "18:42",
 *               "luokka": "Ruoka", "teksti": "..." }
 */

/* ---------------------------------------------------------------- */
/* Configuration                                                     */
/* ---------------------------------------------------------------- */

const STORAGE_KEY = "terveyspaivakirja-merkinnat";
const FILE_PREFIX = "terveyspaivakirja";

// Main categories. "kysymys" is the heading shown on the entry screen.
const LUOKAT = {
  ruoka:    { nimi: "Ruoka",    kysymys: "Mitä olet syönyt?" },
  liikunta: { nimi: "Liikunta", kysymys: "Mitä liikuntaa olet harrastanut?" },
  uni:      { nimi: "Uni",      kysymys: "Miten nukuit?" },
  laakkeet: { nimi: "Lääkkeet", kysymys: "Kerro käytössä olevista lääkkeistä tai lääkemuutoksista." }
};

// Symptom list. To add or change symptoms, edit this array only.
const OIREET = [
  { nimi: "Käsien ihottuma", kysymys: "Kerro käsien ihottumasta." },
  { nimi: "Kehon turvotus",  kysymys: "Kerro kehon turvotuksesta." },
  { nimi: "Ilmavaivat",      kysymys: "Kerro ilmavaivoista." },
  { nimi: "Kehon kipu",      kysymys: "Kerro kehon kivusta." },
  { nimi: "Hengitystieoireet", kysymys: "Kerro hengitystieoireista." }
];

const KUUKAUDET = [
  "tammikuu", "helmikuu", "maaliskuu", "huhtikuu", "toukokuu", "kesäkuu",
  "heinäkuu", "elokuu", "syyskuu", "lokakuu", "marraskuu", "joulukuu"
];

/* ---------------------------------------------------------------- */
/* Storage                                                           */
/* ---------------------------------------------------------------- */

function lataaMerkinnat() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function tallennaMerkinnat(merkinnat) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merkinnat));
}

/* ---------------------------------------------------------------- */
/* Date and time helpers                                             */
/* ---------------------------------------------------------------- */

function pad(n) {
  return String(n).padStart(2, "0");
}

// "2026-07-03" in local time.
function isoPaiva(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "18:42" in local time.
function kellonaika(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "2026-07" -> "Heinäkuu 2026"
function kuukaudenOtsikko(kk) {
  const [vuosi, kuukausi] = kk.split("-");
  const nimi = KUUKAUDET[Number(kuukausi) - 1];
  return nimi.charAt(0).toUpperCase() + nimi.slice(1) + " " + vuosi;
}

/* ---------------------------------------------------------------- */
/* Screen-reader announcements                                       */
/* ---------------------------------------------------------------- */

const ilmoitusAlue = document.getElementById("ilmoitus");

// Announce a message via the live region. Clearing first ensures the
// same message is re-announced if triggered twice in a row.
function ilmoita(teksti) {
  ilmoitusAlue.textContent = "";
  setTimeout(() => {
    ilmoitusAlue.textContent = teksti;
  }, 50);
}

/* ---------------------------------------------------------------- */
/* View management                                                   */
/* ---------------------------------------------------------------- */

const nakymat = document.querySelectorAll(".nakyma");

// Show one view, hide the others, update the page title and move
// focus so VoiceOver immediately announces where the user is.
function naytaNakyma(id, otsikko, fokusElementti) {
  nakymat.forEach(n => { n.hidden = (n.id !== id); });
  document.title = otsikko ? otsikko + " – Terveyspäiväkirja" : "Terveyspäiväkirja";
  const fokus = fokusElementti || document.querySelector("#" + id + " h1");
  if (fokus) fokus.focus();
}

function naytaKoti() {
  naytaNakyma("nakyma-koti", "");
}

/* ---------------------------------------------------------------- */
/* Entry screen (shared by all categories)                           */
/* ---------------------------------------------------------------- */

const kysymysOtsikko = document.getElementById("merkinta-kysymys");
const tekstikentta = document.getElementById("merkinta-teksti");

// State for the currently open entry screen.
let nykyinenLuokka = null;   // { nimi, kysymys }
let paluuFunktio = naytaKoti; // where Cancel/Save returns to

// Open the entry screen for a category. Focus goes straight to the
// text field so the user can start dictating immediately.
function avaaMerkinta(luokka, paluu) {
  nykyinenLuokka = luokka;
  paluuFunktio = paluu;
  kysymysOtsikko.textContent = luokka.kysymys;
  tekstikentta.value = "";
  naytaNakyma("nakyma-merkinta", luokka.nimi, tekstikentta);
}

function tallennaMerkinta() {
  const teksti = tekstikentta.value.trim();

  // Empty text: do not save. Announce the error and keep focus in the field.
  if (!teksti) {
    ilmoita("Et ole kirjoittanut mitään. Merkintää ei tallennettu.");
    tekstikentta.focus();
    return;
  }

  const nyt = new Date();
  const merkinnat = lataaMerkinnat();
  merkinnat.push({
    "päivämäärä": isoPaiva(nyt),
    "kellonaika": kellonaika(nyt),
    "luokka": nykyinenLuokka.nimi,
    "teksti": teksti
  });

  try {
    tallennaMerkinnat(merkinnat);
  } catch {
    ilmoita("Tallennus epäonnistui. Laitteen tallennustila voi olla täynnä.");
    return;
  }

  // Saved: return immediately without a confirmation message.
  paluuFunktio();
}

document.getElementById("btn-tallenna").addEventListener("click", tallennaMerkinta);
document.getElementById("btn-peruuta").addEventListener("click", () => paluuFunktio());

// Escape cancels the entry screen (keyboard convenience on desktop).
tekstikentta.addEventListener("keydown", (e) => {
  if (e.key === "Escape") paluuFunktio();
});

/* ---------------------------------------------------------------- */
/* Home screen buttons                                               */
/* ---------------------------------------------------------------- */

document.getElementById("btn-ruoka").addEventListener("click",
  () => avaaMerkinta(LUOKAT.ruoka, naytaKoti));
document.getElementById("btn-liikunta").addEventListener("click",
  () => avaaMerkinta(LUOKAT.liikunta, naytaKoti));
document.getElementById("btn-uni").addEventListener("click",
  () => avaaMerkinta(LUOKAT.uni, naytaKoti));
document.getElementById("btn-oireet").addEventListener("click", naytaOireet);
document.getElementById("btn-laakkeet").addEventListener("click",
  () => avaaMerkinta(LUOKAT.laakkeet, naytaKoti));
document.getElementById("btn-tanaan").addEventListener("click", naytaTanaan);
document.getElementById("btn-vienti").addEventListener("click", naytaVienti);

/* ---------------------------------------------------------------- */
/* Symptoms menu                                                     */
/* ---------------------------------------------------------------- */

function naytaOireet() {
  naytaNakyma("nakyma-oireet", "Oireet");
}

// Build the symptom buttons once from the OIREET array.
const oireetLista = document.getElementById("oireet-lista");
OIREET.forEach(oire => {
  const nappi = document.createElement("button");
  nappi.type = "button";
  nappi.textContent = oire.nimi;
  // After saving a symptom entry, return to the symptoms menu.
  nappi.addEventListener("click", () => avaaMerkinta(oire, naytaOireet));
  oireetLista.appendChild(nappi);
});

document.getElementById("btn-oireet-takaisin").addEventListener("click", naytaKoti);

/* ---------------------------------------------------------------- */
/* Today's entries (read only)                                       */
/* ---------------------------------------------------------------- */

function naytaTanaan() {
  const tanaan = isoPaiva(new Date());
  const merkinnat = lataaMerkinnat()
    .filter(m => m["päivämäärä"] === tanaan)
    .sort((a, b) => a.kellonaika.localeCompare(b.kellonaika));

  const lista = document.getElementById("tanaan-lista");
  lista.textContent = "";
  merkinnat.forEach(m => {
    const rivi = document.createElement("li");
    rivi.textContent = `${m.kellonaika} ${m.luokka} — ${m.teksti}`;
    lista.appendChild(rivi);
  });

  document.getElementById("tanaan-tyhja").hidden = merkinnat.length > 0;
  naytaNakyma("nakyma-tanaan", "Tämän päivän merkinnät");
}

document.getElementById("btn-tanaan-takaisin").addEventListener("click", naytaKoti);

/* ---------------------------------------------------------------- */
/* Monthly export                                                    */
/* ---------------------------------------------------------------- */

// Sort a copy of the entries chronologically.
function aikajarjestys(merkinnat) {
  return [...merkinnat].sort((a, b) =>
    (a["päivämäärä"] + a.kellonaika).localeCompare(b["päivämäärä"] + b.kellonaika));
}

// Build the human-readable TXT file content.
function rakennaTxt(merkinnat, otsikko) {
  const rivit = ["TERVEYSPÄIVÄKIRJA", otsikko, ""];
  aikajarjestys(merkinnat).forEach(m => {
    rivit.push(`Päivämäärä: ${m["päivämäärä"]}`);
    rivit.push(`Kellonaika: ${m.kellonaika}`);
    rivit.push(`Luokka: ${m.luokka}`);
    rivit.push(`Teksti: ${m.teksti}`);
    rivit.push("");
  });
  return rivit.join("\n");
}

// Build the structured JSON file content.
function rakennaJson(merkinnat, kuukausi) {
  const nyt = new Date();
  const data = {
    "sovellus": "Terveyspäiväkirja",
    "viety": `${isoPaiva(nyt)} ${kellonaika(nyt)}`,
    "merkinnät": aikajarjestys(merkinnat)
  };
  if (kuukausi) data["kuukausi"] = kuukausi;
  return JSON.stringify(data, null, 2);
}

// Export a file via the iOS Share Sheet when available (navigator.share
// with files, iOS 15+). Falls back to a normal download on desktop.
async function vieTiedosto(nimi, sisalto, mime) {
  const blob = new Blob([sisalto], { type: mime + ";charset=utf-8" });
  const tiedosto = new File([blob], nimi, { type: mime });

  if (navigator.canShare && navigator.canShare({ files: [tiedosto] })) {
    try {
      await navigator.share({ files: [tiedosto] });
    } catch {
      // The user cancelled the Share Sheet — not an error.
    }
    return;
  }

  // Fallback: trigger a file download (Windows/desktop browsers).
  const url = URL.createObjectURL(blob);
  const linkki = document.createElement("a");
  linkki.href = url;
  linkki.download = nimi;
  document.body.appendChild(linkki);
  linkki.click();
  linkki.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Rebuild the export view: one TXT and one JSON button per month
// that has entries, newest month first.
function naytaVienti() {
  const merkinnat = lataaMerkinnat();
  const lista = document.getElementById("vienti-lista");
  lista.textContent = "";

  const kuukaudet = [...new Set(merkinnat.map(m => m["päivämäärä"].slice(0, 7)))]
    .sort()
    .reverse();

  kuukaudet.forEach(kk => {
    const kkMerkinnat = merkinnat.filter(m => m["päivämäärä"].startsWith(kk));
    const otsikko = kuukaudenOtsikko(kk);

    const txtNappi = document.createElement("button");
    txtNappi.type = "button";
    txtNappi.textContent = `${otsikko}, tekstitiedosto`;
    txtNappi.addEventListener("click", () =>
      vieTiedosto(`${FILE_PREFIX}-${kk}.txt`, rakennaTxt(kkMerkinnat, otsikko), "text/plain"));
    lista.appendChild(txtNappi);

    const jsonNappi = document.createElement("button");
    jsonNappi.type = "button";
    jsonNappi.textContent = `${otsikko}, JSON-tiedosto`;
    jsonNappi.addEventListener("click", () =>
      vieTiedosto(`${FILE_PREFIX}-${kk}.json`, rakennaJson(kkMerkinnat, kk), "application/json"));
    lista.appendChild(jsonNappi);
  });

  document.getElementById("vienti-tyhja").hidden = merkinnat.length > 0;
  document.getElementById("btn-vie-kaikki").hidden = merkinnat.length === 0;
  naytaNakyma("nakyma-vienti", "Vie kuukausitiedostot");
}

// Full backup: every entry in one JSON file.
document.getElementById("btn-vie-kaikki").addEventListener("click", () =>
  vieTiedosto(`${FILE_PREFIX}-kaikki.json`, rakennaJson(lataaMerkinnat(), null), "application/json"));

document.getElementById("btn-vienti-takaisin").addEventListener("click", naytaKoti);

/* ---------------------------------------------------------------- */
/* Service worker (offline support)                                  */
/* ---------------------------------------------------------------- */

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {
    // Offline caching is unavailable (e.g. not served over https).
    // The app still works normally online.
  });
}
