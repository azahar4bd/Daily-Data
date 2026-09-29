/**
 * Minimal, dependency-free .xlsx reader.
 *
 * An .xlsx file is a ZIP archive of XML parts. We only need enough of both
 * formats to pull cell values out, so this reads the ZIP central directory,
 * inflates the entries with Node's built-in zlib, and scans the worksheet XML
 * for <row>/<c> elements. No third-party packages required.
 *
 * Not a general-purpose parser: no zip64, no encryption, no style/date
 * introspection. Enough for the spreadsheets this repo deals with.
 */

import fs from 'node:fs';
import zlib from 'node:zlib';

/* ------------------------------ ZIP reading ------------------------------ */

const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;

function findEocd(buf) {
  const min = Math.max(0, buf.length - 0xffff - 22);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  throw new Error('not a zip file: end-of-central-directory record not found');
}

/** @returns {Map<string, Buffer>} entry name -> uncompressed bytes */
export function readZip(buf) {
  const eocd = findEocd(buf);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map();

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== SIG_CEN) throw new Error('corrupt zip central directory');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    // jump to the local header to find where the data actually starts
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);

    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, zlib.inflateRawSync(raw));
    else throw new Error(`unsupported zip compression method ${method} for ${name}`);

    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/* ------------------------------ XML helpers ------------------------------ */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXml(s) {
  if (s.indexOf('&') === -1) return s;
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (m, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code] ?? m;
  });
}

const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? decodeXml(m[1]) : null;
};

/** "BC12" -> 55 (1-based column number) */
export function colFromRef(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n;
}

/** Concatenate every <t> inside a chunk (handles rich-text runs). */
function textOf(xml) {
  let out = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m;
  while ((m = re.exec(xml))) out += m[1] === undefined ? '' : decodeXml(m[1]);
  return out;
}

/* ------------------------------ workbook ------------------------------ */

function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  const re = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si(?:\s[^>]*)?\/>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1] === undefined ? '' : textOf(m[1]));
  return out;
}

function parseSheet(xml, shared) {
  /** @type {Map<number, Map<number, string|number|boolean>>} */
  const rows = new Map();
  // NOTE: `<row r="28" ht="15.75"/>` is legal and common. A naive
  // `<row...>([\s\S]*?)</row>` treats that as an opening tag and swallows the
  // *next* row's cells, shifting data by one row. So scan tags explicitly.
  const rowRe = /<row(\s[^>]*?)?(\/)?>/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const rowNum = Number(attr(rm[1] || '', 'r'));
    if (rm[2]) continue; // self-closing: no cells
    const bodyStart = rowRe.lastIndex;
    const bodyEnd = xml.indexOf('</row>', bodyStart);
    if (bodyEnd === -1) break;
    rowRe.lastIndex = bodyEnd + 6;
    if (!rowNum) continue;
    const body = xml.slice(bodyStart, bodyEnd);

    const cells = new Map();
    const cellRe = /<c(\s[^>]*?)\/>|<c(\s[^>]*?)>([\s\S]*?)<\/c>/g;
    let cm;
    while ((cm = cellRe.exec(body))) {
      const tag = cm[1] ?? cm[2] ?? '';
      const inner = cm[3] ?? '';
      const ref = attr(tag, 'r');
      if (!ref) continue;
      const type = attr(tag, 't');
      let value;

      if (type === 'inlineStr') {
        value = textOf(inner);
      } else {
        const vm = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(inner);
        if (!vm) continue;
        const raw = decodeXml(vm[1]);
        if (type === 's') value = shared[Number(raw)] ?? '';
        else if (type === 'str') value = raw;
        else if (type === 'e') value = null; // formula error cell
        else if (type === 'b') value = raw === '1';
        else {
          const n = Number(raw);
          value = Number.isFinite(n) ? n : raw;
        }
      }
      if (value === null || value === '') continue;
      cells.set(colFromRef(ref), value);
    }
    if (cells.size) rows.set(rowNum, cells);
  }
  return rows;
}

/**
 * @param {string} path path to an .xlsx file
 * @returns {{ names: string[], sheet(name: string): Sheet }}
 */
export function readXlsx(path) {
  const files = readZip(fs.readFileSync(path));
  const text = (name) => (files.has(name) ? files.get(name).toString('utf8') : null);

  const shared = parseSharedStrings(text('xl/sharedStrings.xml'));

  const relsXml = text('xl/_rels/workbook.xml.rels') || '';
  const rels = new Map();
  for (const m of relsXml.matchAll(/<Relationship\s[^>]*>/g)) {
    const id = attr(m[0], 'Id');
    const target = attr(m[0], 'Target');
    if (id && target) rels.set(id, target.replace(/^\/?xl\//, '').replace(/^\.\//, ''));
  }

  const wbXml = text('xl/workbook.xml') || '';
  const order = [];
  const meta = new Map();
  for (const m of wbXml.matchAll(/<sheet\s[^>]*\/?>/g)) {
    const name = attr(m[0], 'name');
    const rid = attr(m[0], 'r:id') || attr(m[0], 'id');
    if (!name) continue;
    order.push(name);
    meta.set(name, { state: attr(m[0], 'state') || 'visible', part: `xl/${rels.get(rid)}` });
  }

  const cache = new Map();
  function sheet(name) {
    if (!meta.has(name)) {
      throw new Error(`sheet "${name}" not found. Available: ${order.join(', ')}`);
    }
    if (!cache.has(name)) {
      const xml = text(meta.get(name).part);
      if (xml === null) throw new Error(`worksheet part missing for "${name}"`);
      cache.set(name, makeSheet(name, parseSheet(xml, shared)));
    }
    return cache.get(name);
  }

  return {
    names: order,
    states: Object.fromEntries(order.map((n) => [n, meta.get(n).state])),
    sheet
  };
}

/* ------------------------------ Sheet facade ------------------------------ */

function makeSheet(name, rows) {
  const nums = [...rows.keys()];
  return {
    name,
    rows,
    firstRow: nums.length ? Math.min(...nums) : 0,
    lastRow: nums.length ? Math.max(...nums) : 0,
    /** raw cell value at 1-based row/column, or null */
    cell(r, c) {
      const row = rows.get(r);
      const v = row ? row.get(c) : undefined;
      return v === undefined ? null : v;
    },
    /** trimmed string, or '' */
    str(r, c) {
      const v = this.cell(r, c);
      return v === null ? '' : String(v).trim();
    },
    /** finite number, or null (blank/text cells become null) */
    num(r, c) {
      const v = this.cell(r, c);
      if (v === null || v === '' || typeof v === 'boolean') return null;
      const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    }
  };
}

/* ------------------------------ dates ------------------------------ */

/** Excel serial day number -> "YYYY-MM-DD" (1900 date system, incl. the leap bug). */
export function serialToISODate(serial) {
  if (serial === null || serial === undefined || !Number.isFinite(Number(serial))) return null;
  const days = Math.floor(Number(serial));
  if (days <= 0) return null;
  const ms = Date.UTC(1899, 11, 30) + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}
