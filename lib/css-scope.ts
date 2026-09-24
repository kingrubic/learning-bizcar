export function scopeCss(css: string, scope: string) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let index = 0;
  let out = "";

  const skipSpace = () => {
    while (index < source.length && /\s/.test(source[index])) index += 1;
  };

  const matchingBrace = (open: number) => {
    let depth = 0;
    for (let j = open; j < source.length; j += 1) {
      if (source[j] === "{") depth += 1;
      else if (source[j] === "}") {
        depth -= 1;
        if (depth === 0) return j;
      }
    }
    return source.length - 1;
  };

  while (index < source.length) {
    skipSpace();
    if (index >= source.length) break;
    const brace = source.indexOf("{", index);
    if (brace < 0) break;
    const header = source.slice(index, brace).trim();
    const end = matchingBrace(brace);
    const inner = source.slice(brace + 1, end);
    if (header.startsWith("@media") || header.startsWith("@supports")) {
      out += `${header}{${scopeCss(inner, scope)}}`;
    } else if (/^@(-webkit-|-moz-)?keyframes/.test(header) || header.startsWith("@font-face")) {
      out += `${header}{${inner}}`;
    } else if (header.startsWith("@")) {
      out += `${header}{${inner}}`;
    } else if (header) {
      const selectors = header.split(",").map((selector) => prefix(selector.trim(), scope)).filter(Boolean);
      out += `${selectors.join(",")}{${inner}}`;
    }
    index = end + 1;
  }
  return out;
}

function prefix(selector: string, scope: string) {
  if (!selector || selector.startsWith("@")) return selector;
  if (selector === ":root" || selector === "html" || selector === "body") return scope;
  if (selector === "*") return `${scope},${scope} *`;
  return `${scope} ${selector}`;
}
