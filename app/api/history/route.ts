import { NextResponse } from "next/server";
import { google } from "googleapis";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!;
  const key = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

export async function GET() {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = process.env.HISTORY_SHEET_ID!;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "A:H",
    });

    const rows = res.data.values ?? [];
    if (rows.length <= 1) {
      return NextResponse.json({ rows: [] });
    }

    const [header, ...data] = rows;
    const mapped = data.map((row) => {
      const obj: Record<string, string> = {};
      header.forEach((col: string, i: number) => {
        obj[col] = row[i] ?? "";
      });
      return obj;
    });

    return NextResponse.json({ rows: mapped });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ rows: [], error: String(err) }, { status: 500 });
  }
}
