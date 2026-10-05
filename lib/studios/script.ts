/** The studio's single inline <script> (the one closing the body). */
export function studioScript(html: string) {
  const match = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/) ?? html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Studio không có <script>");
  return match[1];
}
