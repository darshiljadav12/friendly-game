import type { QuestionEntry, QuestionListKey } from "../app/types";

// One column per list in the Excel/CSV sheet. Headers are matched loosely (case, spaces and
// punctuation don't matter), so "Never have I ever", "never-have-i-ever" and "NeverEver" all work.
export const QUESTION_COLUMNS: { key: QuestionListKey; header: string; icon: string; hint: string; aliases: string[] }[] = [
  { key: "love", header: "Love", icon: "❤️", hint: "A sweet question to answer out loud", aliases: ["love"] },
  { key: "dare", header: "Dare", icon: "😈", hint: "Something to do", aliases: ["dare", "dares"] },
  { key: "memory", header: "Memory", icon: "📸", hint: "A memory to share", aliases: ["memory", "memories"] },
  { key: "gift", header: "Gift", icon: "🎁", hint: "A sweet gesture", aliases: ["gift", "gifts"] },
  { key: "guess", header: "Guess", icon: "🤔", hint: "About the partner: you guess, they have the real answer", aliases: ["guess"] },
  { key: "timed", header: "Timed", icon: "⏱️", hint: "A 30-second challenge", aliases: ["timed", "timer"] },
  { key: "together", header: "Together", icon: "💑", hint: "Something to do together", aliases: ["together"] },
  { key: "finish", header: "Finish My Sentence", icon: "✍️", hint: "Start of a sentence, ending with …", aliases: ["finishmysentence", "finish", "sentence"] },
  { key: "neverEver", header: "Never Have I Ever", icon: "🙊", hint: "e.g. danced in the rain", aliases: ["neverhaveiever", "neverever", "never"] },
  { key: "mostLikely", header: "Who's More Likely", icon: "👉", hint: "e.g. cry at a movie", aliases: ["whosmorelikely", "whosmorelikelyto", "mostlikely", "morelikely"] },
  { key: "thisOrThat", header: "This or That", icon: "⚖️", hint: "Two options: Beach / Mountains", aliases: ["thisorthat", "thisthat"] },
  { key: "draw", header: "Draw It", icon: "🎨", hint: "A word to draw", aliases: ["drawit", "draw", "drawing", "words"] },
];

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z]/g, "");

const columnFor = (header: unknown) => {
  const h = normalize(String(header ?? ""));
  return h ? QUESTION_COLUMNS.find((c) => c.aliases.includes(h)) : undefined;
};

// Minimal CSV reader (commas or semicolons, "quoted, cells" and "" escapes)
function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export type SheetResult = {
  questions: Partial<Record<QuestionListKey, string[]>>;
  ignoredColumns: string[]; // headers we didn't recognise
};

// Reads an .xlsx or .csv file: first row = column headers, every row below = one question per column
export async function readQuestionFile(file: File): Promise<SheetResult> {
  let rows: unknown[][];
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    rows = parseCsv(await file.text());
  } else {
    const { readSheet } = await import("read-excel-file/browser");
    rows = (await readSheet(file)) as unknown[][];
  }

  const [header = [], ...body] = rows;
  const columns = header.map(columnFor);
  const ignoredColumns = header.filter((h, i) => String(h ?? "").trim() && !columns[i]).map((h) => String(h).trim());

  const questions: SheetResult["questions"] = {};
  columns.forEach((column, i) => {
    if (!column) return;
    const list = body.map((row) => String(row[i] ?? "").trim()).filter(Boolean);
    if (list.length) questions[column.key] = [...(questions[column.key] ?? []), ...list];
  });
  return { questions, ignoredColumns };
}

const entryText = (entry: QuestionEntry) => (Array.isArray(entry) ? entry.join(" / ") : entry);

// Downloads an .xlsx with one column per list, filled with the given questions
export async function downloadQuestionSheet(lists: Partial<Record<QuestionListKey, QuestionEntry[]>>, fileName: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const longest = Math.max(1, ...QUESTION_COLUMNS.map((c) => lists[c.key]?.length ?? 0));
  const header = QUESTION_COLUMNS.map((c) => ({ value: c.header, fontWeight: "bold" as const }));
  const rows = Array.from({ length: longest }, (_, r) =>
    QUESTION_COLUMNS.map((c) => {
      const entry = lists[c.key]?.[r];
      return entry === undefined ? null : { value: entryText(entry) };
    }),
  );
  await writeXlsxFile([header, ...rows], { columns: QUESTION_COLUMNS.map(() => ({ width: 34 })) }).toFile(fileName);
}
