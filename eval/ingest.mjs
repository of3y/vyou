import { mkdirSync, writeFileSync, createWriteStream, existsSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const EVAL_ROOT = fileURLToPath(new URL(".", import.meta.url));
const CORPUS_ROOT = join(EVAL_ROOT, "corpus");

// 30-image first-pass slice, locked 2026-04-24.
// Sources chosen for direct-URL fetchability: NOAA (11 Wikimedia-mirrored PD) +
// Wikimedia (14 CC-BY/SA via Special:FilePath) + CCSN (5 via HF datasets-server /rows).
// WEAPD skipped — datasets-server /rows returns ArrowNotImplementedError on that repo.
const CORPUS = [
  // NOAA — PD, Wikimedia-mirrored
  { id: "NOAA-wallcloud-0001", url: "https://upload.wikimedia.org/wikipedia/commons/7/78/Wall_cloud_with_lightning_-_NOAA.jpg", source: "NOAA", phenomenon_gold: "wall_cloud", license: "PD", attribution: "Brad Smull, NOAA/NSSL, 1980-06-19 (nssl0092)" },
  { id: "NOAA-wallcloud-0002", url: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Circular_base_of_a_rotating_wall_cloud_-_NOAA.jpg", source: "NOAA", phenomenon_gold: "wall_cloud", license: "PD", attribution: "NOAA/OAR/ERL/NSSL, 1976-05-30" },
  { id: "NOAA-wallcloud-0003", url: "https://upload.wikimedia.org/wikipedia/commons/1/1b/1989_Huntsville_Wall_cloud_1.jpg", source: "NOAA", phenomenon_gold: "wall_cloud", license: "PD", attribution: "NWS Birmingham, AL, 1989-11-15" },
  { id: "NOAA-tornado-0001", url: "https://upload.wikimedia.org/wikipedia/commons/d/d2/Nssl0090_-_Flickr_-_NOAA_Photo_Library.jpg", source: "NOAA", phenomenon_gold: "tornado", license: "PD", attribution: "NOAA/OAR/ERL/WPL (nssl0090)" },
  { id: "NOAA-tornado-0002", url: "https://upload.wikimedia.org/wikipedia/commons/8/8a/Nssl0234_-_Flickr_-_NOAA_Photo_Library.jpg", source: "NOAA", phenomenon_gold: "tornado", license: "PD", attribution: "Sean Waugh, NOAA/NSSL, 2008-05-23" },
  { id: "NOAA-tornado-0003", url: "https://upload.wikimedia.org/wikipedia/commons/b/bd/Nssl0372_-_Flickr_-_NOAA_Photo_Library.jpg", source: "NOAA", phenomenon_gold: "tornado", license: "PD", attribution: "NOAA/NSSL, 2010-12" },
  { id: "NOAA-funnel-0001", url: "https://upload.wikimedia.org/wikipedia/commons/9/92/Funnel_cloud_approaching_the_ground_-_NOAA.jpg", source: "NOAA", phenomenon_gold: "funnel_cloud", license: "PD", attribution: "NOAA/NSSL, Ardmore OK 1985-04-29 (nssl0132)" },
  { id: "NOAA-funnel-0002", url: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Alfalfa_Tornado_-_NOAA.jpg", source: "NOAA", phenomenon_gold: "tornado", license: "PD", attribution: "NOAA/NSSL, Alfalfa OK 1981-05-22 (nssl0073)" },
  { id: "NOAA-mammatus-0001", url: "https://upload.wikimedia.org/wikipedia/commons/3/38/Mammatocumulus_-_NOAA.jpg", source: "NOAA", phenomenon_gold: "mammatus", license: "PD", attribution: "NOAA Photo Library (NWS historic collection)" },
  { id: "NOAA-mammatus-0002", url: "https://upload.wikimedia.org/wikipedia/commons/3/39/Mammatus-clouds-Tulsa-1973.png", source: "NOAA", phenomenon_gold: "mammatus", license: "PD", attribution: "NOAA/NSSL, 1973-06-02" },
  { id: "NOAA-shelfcloud-0001", url: "https://upload.wikimedia.org/wikipedia/commons/e/ed/Shelfcloud.jpg", source: "NOAA", phenomenon_gold: "shelf_cloud", license: "PD", attribution: "NOAA, Miami TX 1980-06-19" },
  // Wikimedia — CC-BY/SA via Special:FilePath
  { id: "WM-wallcloud-01", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Well_Defined_Wall_Cloud.jpg", source: "Wikimedia", phenomenon_gold: "wall_cloud", license: "CC-BY-SA-4.0", attribution: "Stefan Klein (BusyWikipedian), 2019-05-06" },
  { id: "WM-wallcloud-02", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Wall_cloud_Galley_Common_28_July_2021_01.jpg", source: "Wikimedia", phenomenon_gold: "wall_cloud", license: "CC-BY-SA-4.0", attribution: "Galley Common contributor (see Wikimedia File: page)" },
  { id: "WM-wallcloud-03", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Wallcloud_mit_Tailcloud_im_westlichen_Oklahoma_I.jpg", source: "Wikimedia", phenomenon_gold: "wall_cloud", license: "CC-BY-SA-4.0", attribution: "Wikimedia Commons contributor (see File: page)" },
  { id: "WM-wallcloud-04", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Non-rotating_Wall_Cloud.png", source: "Wikimedia", phenomenon_gold: "wall_cloud", license: "CC-BY-SA-4.0", attribution: "Wikimedia Commons contributor (see File: page)" },
  { id: "WM-mammatus-01", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Mammatus_cloud_in_Lithuania.JPG", source: "Wikimedia", phenomenon_gold: "mammatus", license: "CC-BY-SA-4.0", attribution: "Wikimedia Commons contributor (see File: page)" },
  { id: "WM-mammatus-02", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Closeup_mammatus_clouds.jpg", source: "Wikimedia", phenomenon_gold: "mammatus", license: "CC-BY-SA-4.0", attribution: "Wikimedia Commons contributor (see File: page)" },
  { id: "WM-mammatus-03", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Cumulonimbus_mammatus_grey.jpg", source: "Wikimedia", phenomenon_gold: "mammatus", license: "CC-BY-SA-4.0", attribution: "Wikimedia Commons contributor (see File: page)" },
  { id: "WM-tornado-01", url: "https://commons.wikimedia.org/wiki/Special:FilePath/F5_tornado_Elie_Manitoba_2007.jpg", source: "Wikimedia", phenomenon_gold: "tornado", license: "CC-BY-SA-3.0", attribution: "Justin Hobson (Justin1569), 2007-06-22" },
  { id: "WM-tornado-02", url: "https://commons.wikimedia.org/wiki/Special:FilePath/2016-05-16_Tornado_north_of_Solomon,_Kansas.jpg", source: "Wikimedia", phenomenon_gold: "tornado", license: "CC-BY-SA", attribution: "Wikimedia Commons contributor (see File: page)" },
  { id: "WM-tornado-03", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Supercell_thunderstorm_over_Needmore,_Texas._May_4,_2019.jpg", source: "Wikimedia", phenomenon_gold: "wall_cloud", license: "CC-BY-SA", attribution: "Wikimedia Commons contributor (see File: page)", notes: "multi-feature — supercell + wall cloud; phenomenon_gold per precedence severe-structure" },
  { id: "WM-shelfcloud-01", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Shelf_cloud_-_Flickr_-_otrow_photography.jpg", source: "Wikimedia", phenomenon_gold: "shelf_cloud", license: "CC-BY-2.0", attribution: "otrow photography (Flickr)" },
  { id: "WM-shelfcloud-02", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Illuminated_shelf_cloud.jpg", source: "Wikimedia", phenomenon_gold: "shelf_cloud", license: "CC-BY-SA", attribution: "Wikimedia Commons contributor (see File: page)" },
  { id: "WM-shelfcloud-03", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Lightning_and_a_Shelf_Cloud.jpg", source: "Wikimedia", phenomenon_gold: "shelf_cloud", license: "CC-BY-SA", attribution: "Wikimedia Commons contributor (see File: page)", notes: "two-feature — shelf cloud + lightning; phenomenon_gold per precedence severe-structure" },
  { id: "WM-shelfcloud-04", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Cb_mit_Arcus_am_31._Mai_2022_bei_Limburg.jpg", source: "Wikimedia", phenomenon_gold: "shelf_cloud", license: "CC-BY-SA-4.0", attribution: "Wikimedia Commons contributor (see File: page)" },
];

// CCSN — via HF datasets-server /rows, picking first row per label. Labels in CCSN
// (index order): 0=Ac, 1=As, 2=Cb, 3=Cc, 4=Ci, 5=Cs, 6=Ct, 7=Cu, 8=Ns, 9=Sc, 10=St.
// Mapping to VYou taxonomy done in the phenomenon_gold field.
const CCSN_PICKS = [
  { id: "CCSN-Ci-001", label_idx: 4, phenomenon_gold: "clear_sky", notes: "cirrus — VYou taxonomy treats thin cirrus as clear_sky" },
  { id: "CCSN-Cu-001", label_idx: 7, phenomenon_gold: "partly_cloudy", notes: "cumulus — fair-weather fair-weather cumulus against visible blue" },
  { id: "CCSN-Cb-001", label_idx: 2, phenomenon_gold: "thunderstorm", notes: "cumulonimbus — VYou severe-convection precedence" },
  { id: "CCSN-Ns-001", label_idx: 8, phenomenon_gold: "overcast", notes: "nimbostratus — typically overcast; upgrade to rain if shaft visible" },
  { id: "CCSN-Sc-001", label_idx: 9, phenomenon_gold: "partly_cloudy", notes: "stratocumulus — rolls against blue gaps; upgrade to overcast if solid" },
];

// Wikimedia User-Agent policy: https://meta.wikimedia.org/wiki/User-Agent_policy
const UA = "vyou-eval-ingest/0.1 (https://github.com/of3y/vyou)";

async function politeFetch(url, { attempts = 4, baseDelay = 800 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": UA, accept: "image/*,application/json;q=0.9,*/*;q=0.5" },
      });
      if (res.status === 429 || res.status === 503) {
        const ra = res.headers.get("retry-after");
        const delay = ra ? Math.min(10_000, Number(ra) * 1000 || baseDelay * (i + 1)) : baseDelay * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, i)));
    }
  }
  throw lastErr ?? new Error("exhausted retries");
}

async function fetchCcsnRow(labelIdx) {
  // Scan /rows in chunks until we find a row with the target label. CCSN has ~2.5k rows.
  const chunkSize = 100;
  for (let offset = 0; offset < 3000; offset += chunkSize) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=aduuuuuu%2FCCSN&config=default&split=train&offset=${offset}&length=${chunkSize}`;
    const res = await politeFetch(url);
    const body = await res.json();
    if (!body.rows?.length) break;
    for (const r of body.rows) {
      if (r.row?.label === labelIdx) {
        return { row_idx: r.row_idx, src: r.row.image.src };
      }
    }
  }
  throw new Error(`CCSN: no row found for label_idx=${labelIdx}`);
}

function urlExtension(u) {
  try {
    const path = new URL(u).pathname;
    const m = path.match(/\.(jpe?g|png|webp|gif)$/i);
    return m ? m[0].toLowerCase().replace("jpeg", "jpg") : ".jpg";
  } catch {
    return ".jpg";
  }
}

async function downloadTo(url, dest) {
  const res = await politeFetch(url);
  await pipeline(res.body, createWriteStream(dest));
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

mkdirSync(CORPUS_ROOT, { recursive: true });
const sources = new Set(CORPUS.map((c) => c.source));
for (const s of sources) mkdirSync(join(CORPUS_ROOT, s), { recursive: true });
mkdirSync(join(CORPUS_ROOT, "CCSN"), { recursive: true });

console.log(`Ingesting ${CORPUS.length} direct-URL rows + ${CCSN_PICKS.length} CCSN rows...`);

const manifest = [];
let n = 0;

for (const row of CORPUS) {
  n += 1;
  const ext = urlExtension(row.url);
  const rel = `${row.source}/${row.id}${ext}`;
  const dest = join(CORPUS_ROOT, rel);
  try {
    if (!existsSync(dest)) {
      await downloadTo(row.url, dest);
      await sleep(400); // be polite to Wikimedia
    }
    manifest.push({
      ...row,
      local_path: `eval/corpus/${rel}`,
      features_gold: "",
      feature_richness: "",
      image_url: row.url,
      notes: row.notes ?? "",
    });
    console.log(`  [${n}/${CORPUS.length + CCSN_PICKS.length}] ${row.id} ok`);
  } catch (e) {
    console.error(`  [${n}] ${row.id} FAILED: ${e.message}`);
  }
}

for (const pick of CCSN_PICKS) {
  n += 1;
  try {
    const rel = `CCSN/${pick.id}.jpg`;
    const dest = join(CORPUS_ROOT, rel);
    let row_idx = "cached";
    if (!existsSync(dest)) {
      const row = await fetchCcsnRow(pick.label_idx);
      row_idx = row.row_idx;
      await downloadTo(row.src, dest);
      await sleep(400);
    }
    manifest.push({
      id: pick.id,
      url: `hf://aduuuuuu/CCSN/train/row=${row_idx}/label=${pick.label_idx}`,
      image_url: `hf://aduuuuuu/CCSN/train/row=${row_idx}/label=${pick.label_idx}`,
      source: "CCSN",
      phenomenon_gold: pick.phenomenon_gold,
      features_gold: "",
      feature_richness: "",
      license: "MIT",
      attribution: "CCSN authors (HF aduuuuuu/CCSN, MIT license)",
      local_path: `eval/corpus/${rel}`,
      notes: pick.notes ?? "",
    });
    console.log(`  [${n}/${CORPUS.length + CCSN_PICKS.length}] ${pick.id} ok (hf row ${row_idx})`);
  } catch (e) {
    console.error(`  [${n}] ${pick.id} FAILED: ${e.message}`);
  }
}

// Write manifest CSV with the 10-column schema from validation-corpus-curation.md.
const header =
  "image_id,image_url,local_path,phenomenon_gold,features_gold,feature_richness,source,license,attribution,notes";
const quote = (v) => {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};
const lines = [header];
for (const m of manifest) {
  lines.push(
    [
      m.id,
      m.image_url,
      m.local_path,
      m.phenomenon_gold,
      m.features_gold,
      m.feature_richness,
      m.source,
      m.license,
      m.attribution,
      m.notes,
    ]
      .map(quote)
      .join(","),
  );
}
writeFileSync(
  join(EVAL_ROOT, "dataset-manifest.csv"),
  lines.join("\n") + "\n",
);
console.log(`\nWrote manifest: ${manifest.length} rows → eval/dataset-manifest.csv`);

// Attributions markdown.
const attrLines = [
  "# VYou eval corpus — attributions",
  "",
  "This file records the photographer / institution credit and license for every row in `eval/dataset-manifest.csv`. Required for the CC-BY / CC-BY-SA rows; preserved as good-neighbor practice for the PD and MIT rows too.",
  "",
  "The binary image files under `eval/corpus/` are gitignored — reproduce via `node eval/ingest.mjs`. The manifest CSV and this attributions file are the committed artefacts.",
  "",
  "| image_id | source | license | attribution |",
  "|---|---|---|---|",
];
for (const m of manifest) {
  attrLines.push(
    `| ${m.id} | ${m.source} | ${m.license} | ${m.attribution.replace(/\|/g, "\\|")} |`,
  );
}
writeFileSync(
  join(CORPUS_ROOT, "ATTRIBUTIONS.md"),
  attrLines.join("\n") + "\n",
);
console.log(`Wrote attributions: eval/corpus/ATTRIBUTIONS.md`);
