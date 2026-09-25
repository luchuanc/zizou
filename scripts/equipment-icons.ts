import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { EQUIPMENT } from "../src/equipment";

// Original vector silhouettes; the same artwork is used in the DOM and Pixi atlas.
const shapes: Record<string, string> = {
  sword:
    '<path d="M29 42 28 16 32 5 36 16 35 42Z" fill="url(#metal)"/><path d="M32 11V40" stroke="#f9f4ce"/><path d="m20 39 12 4 12-4-2 7-10 2-10-2Z"/><path d="M29 47h6v11h-6z" fill="url(#gem)"/>',
  axe: '<path d="M29 14h6v45h-6z" fill="url(#metal)"/><path d="M29 13Q16 9 10 18L8 35Q18 30 28 32M35 13Q48 9 54 18L56 35Q46 30 36 32Z" fill="url(#metal)"/><path d="m32 10 6 13-6 9-6-9Z" fill="url(#gem)"/>',
  bow: '<path d="M18 7Q57 32 18 57l9-13 6-12-6-12Z" fill="url(#metal)"/><path d="m18 7 4 25-4 25M9 32h40" fill="none" stroke="#f4e6af" stroke-width="2"/><path d="m54 32-11-5v10Z" fill="url(#gem)"/>',
  crossbow:
    '<path d="M28 14h8v44h-8zM7 24l7-10 18 10 18-10 7 10-25 9Z" fill="url(#metal)"/><path d="m10 24 22 16 22-16M32 10v34" fill="none" stroke="#f3e1aa" stroke-width="2"/><path d="m32 4-5 11h10Z" fill="url(#gem)"/>',
  staff:
    '<path d="m29 26 6 0-1 32h-4Z" fill="url(#metal)"/><path d="M22 10Q11 31 32 31T42 10l-2 14H24Z" fill="url(#metal)"/><path d="m32 5 7 10-7 10-7-10Z" fill="url(#gem)"/>',
  tear: '<path d="M32 6C30 20 15 28 15 40a17 17 0 0 0 34 0C49 28 34 20 32 6Z" fill="url(#gem)"/><path d="M29 25Q19 39 25 47" fill="none" stroke="#e7ffff" stroke-width="3"/>',
  armor:
    '<path d="m21 9 11 7 11-7 15 15-9 9-6-6 4 27-15 5-15-5 4-27-6 6-9-9Z" fill="url(#metal)"/><path d="m23 23 9 5 9-5-2 20-7 8-7-8Z" fill="url(#gem)"/><path d="m19 38 13 5 13-5M21 48l11 4 11-4" fill="none" stroke="#f4daa2" stroke-width="2"/>',
  robe: '<path d="m22 8 10 6 10-6 14 18-9 7-5-9 9 31-19 4-19-4 9-31-5 9-9-7Z" fill="url(#gem)"/><path d="m22 8 12 20-10 11M42 8 30 30M21 39h23M32 40v16" fill="none" stroke="url(#metal)" stroke-width="4"/>',
  belt: '<path d="M7 24q25 10 50 0v18Q32 51 7 42Z" fill="url(#metal)"/><path d="M8 29q24 8 48 0v9Q32 44 8 38Z" fill="url(#gem)"/><path d="m32 22 10 11-10 12-10-12Z" fill="url(#metal)"/><path d="m32 28 4 5-4 5-4-5Z" fill="url(#gem)"/>',
  glove:
    '<path d="m16 30 4-18 6 1 1 15 1-20h7l1 20 2-17h7l-1 21 3-12 6 2-4 24-9 12-22-3-8-18 5-5 7 10Z" fill="url(#metal)"/><path d="m30 29 11 9-9 13-10-13Z" fill="url(#gem)"/>',
  spear:
    '<path d="M30 22h4v38h-4z" fill="url(#metal)"/><path d="m32 3-9 20 9 10 9-10Z" fill="url(#metal)"/><path d="m32 9-4 14 4 4 4-4Z" fill="url(#gem)"/><path d="M30 32q-12 1-13 15 13-5 15-9Z" fill="url(#gem)"/>',
  flag: '<path d="M14 7h4v51h-4z" fill="url(#metal)"/><path d="M19 11Q34 4 53 12l-7 12 7 12q-16-6-34 1Z" fill="url(#gem)"/><path d="m33 13 4 7 8 2-8 3-4 8-3-8-7-3 7-2Z" fill="url(#metal)"/>',
  crown:
    '<path d="m9 20 11 10L32 9l12 21 11-10-6 30H15Z" fill="url(#metal)"/><path d="m32 25 7 9-7 10-7-10Z" fill="url(#gem)"/><path d="M16 47h32v8H16z" fill="url(#metal)"/>',
  scroll:
    '<path d="M16 10h32v43H16z" fill="#e8d2a0"/><path d="M12 7h40v8H12zM12 50h40v8H12z" fill="url(#metal)"/><path d="m32 19 9 14-9 11-9-11Z" fill="url(#gem)"/><path d="M20 21h5M39 44h5" stroke="#8c794c" stroke-width="2"/>',
  orb: '<path d="m20 48 12-9 12 9 6 9H14Z" fill="url(#metal)"/><circle cx="32" cy="28" r="19" fill="url(#gem)"/><path d="M22 27q0-12 12-11M16 37q14 13 32-6" fill="none" stroke="#eef7d9" stroke-width="2"/>',
  book: '<path d="m11 12 20 4 22-4v41l-22 5-20-5Z" fill="url(#metal)"/><path d="m16 17 13 3v32l-13-3Zm19 3 13-3v32l-13 3Z" fill="url(#gem)"/><path d="M32 17v37M20 27l5 2M39 35l5-2" stroke="#fff2c8" stroke-width="2"/>',
  seal: '<path d="M21 26v-8Q21 6 32 6t11 12v8Z" fill="url(#gem)"/><path d="m12 31 20-9 20 9v19L32 59 12 50Z" fill="url(#metal)"/><path d="m12 31 20 9 20-9M32 40v19" fill="none" stroke="#8e6436" stroke-width="2"/>',
  cauldron:
    '<path d="M17 26Q4 15 8 33l10 8M47 26q13-11 9 7L46 41M23 47l-5 12M41 47l5 12" fill="none" stroke="url(#metal)" stroke-width="5"/><path d="M15 24h34l-3 23-14 8-14-8Z" fill="url(#metal)"/><path d="m32 28 8 10-8 10-8-10Z" fill="url(#gem)"/><path d="M18 18h28l-4-6H22zM30 7h4v7h-4z" fill="url(#metal)"/>',
  mirror:
    '<circle cx="32" cy="27" r="20" fill="url(#metal)"/><circle cx="32" cy="27" r="15" fill="url(#gem)"/><path d="M29 47h6v13h-6z" fill="url(#metal)"/><path d="m22 29 15-12M29 35l11-11" stroke="#e4ffff" stroke-width="2"/>',
  astrolabe:
    '<circle cx="32" cy="32" r="25" fill="url(#metal)"/><circle cx="32" cy="32" r="21" fill="url(#gem)"/><path d="m32 14 4 14 14 4-14 4-4 14-4-14-14-4 14-4Z" fill="url(#metal)"/><circle cx="32" cy="32" r="5" fill="#fff1cc"/>',
  bottle:
    '<path d="M25 8h14v8l-3 4v5Q54 30 49 47q-17 15-34 0-5-17 13-22v-5l-3-4Z" fill="url(#gem)"/><path d="M24 8h16v6H24zM19 43q13 6 26 0v6q-13 7-26 0Z" fill="url(#metal)"/><path d="M23 31q-6 6-4 10" fill="none" stroke="#f4f0ce" stroke-width="3"/>',
  talisman:
    '<path d="m22 6 25 7-11 47-25-7Z" fill="#f0d393"/><path d="m34 16-7 6 9 6-13 7 10 7-11 7M22 14l5 1M34 50l-6 1" fill="none" stroke="url(#gem)" stroke-width="3"/>',
  shield:
    '<path d="m32 6 23 10-3 27-20 17-20-17-3-27Z" fill="url(#metal)"/><path d="m32 13 16 8-3 19-13 13-13-13-3-19Z" fill="url(#gem)"/><path d="M32 17v29M21 30h22" stroke="#f6dfa3" stroke-width="3"/>',
  pendant:
    '<path d="M20 7Q32 30 44 7" fill="none" stroke="url(#metal)" stroke-width="3"/><path d="m32 22 16 17-16 20-16-20Z" fill="url(#metal)"/><path d="m32 28 10 11-10 13-10-13Z" fill="url(#gem)"/>',
};
const types = [
  "sword",
  "bow",
  "staff",
  "tear",
  "armor",
  "robe",
  "belt",
  "glove",
  "axe",
  "bow",
  "sword",
  "spear",
  "sword",
  "sword",
  "flag",
  "sword",
  "crossbow",
  "bow",
  "bow",
  "crossbow",
  "crossbow",
  "bow",
  "bow",
  "crown",
  "scroll",
  "orb",
  "bottle",
  "book",
  "seal",
  "cauldron",
  "mirror",
  "astrolabe",
  "bottle",
  "talisman",
  "armor",
  "armor",
  "armor",
  "shield",
  "robe",
  "robe",
  "pendant",
  "robe",
  "belt",
  "glove",
];
const colors = [
  "#6cb6bb",
  "#9dddb4",
  "#a797eb",
  "#78cdeb",
  "#719e9b",
  "#cf92c3",
  "#d9af64",
  "#dfa483",
];
await mkdir("public/assets/equipment", { recursive: true });
const tiles: { input: Buffer; left: number; top: number }[] = [];
for (let i = 0; i < EQUIPMENT.length; i++) {
  const e = EQUIPMENT[i],
    c = colors[(i + (i > 7 ? Math.floor(i / 8) : 0)) % colors.length];
  const body = shapes[types[i]];
  if (!body) throw new Error(`Missing icon ${e.id}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#294441"/><stop offset="1" stop-color="#0b1922"/></linearGradient><linearGradient id="metal" x2=".8" y2="1"><stop stop-color="#fff0b2"/><stop offset=".45" stop-color="#d5af66"/><stop offset="1" stop-color="#7c572d"/></linearGradient><linearGradient id="gem" x2=".9" y2="1"><stop stop-color="#f0fff0"/><stop offset=".3" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".45"/></linearGradient></defs><rect x="1" y="1" width="62" height="62" rx="9" fill="url(#bg)" stroke="${e.parts ? "#b89759" : "#527c79"}"/><circle cx="32" cy="30" r="23" fill="${c}" opacity=".07"/><g fill="url(#metal)" stroke="#241c15" stroke-width=".8" stroke-linejoin="round"${["sword", "axe", "spear", "staff"].includes(types[i]) ? ' transform="rotate(28 32 32)"' : ""}>${body}</g>${e.parts ? `<path d="m52 4 3 3-3 3-3-3Z" fill="${c}"/>` : ""}</svg>`;
  await writeFile(`public/assets/equipment/${e.id}.svg`, svg);
  tiles.push({
    input: await sharp(Buffer.from(svg)).resize(64, 64).png().toBuffer(),
    left: (i % 8) * 64,
    top: Math.floor(i / 8) * 64,
  });
}
await sharp({
  create: { width: 512, height: 384, channels: 4, background: "#0000" },
})
  .composite(tiles)
  .png()
  .toFile("public/assets/equipment-atlas.png");
console.log(`Generated ${tiles.length} equipment icons and Pixi atlas.`);
