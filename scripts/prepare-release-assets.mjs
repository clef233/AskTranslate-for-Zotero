import {
  copyFileSync,
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

// Run before packing so every XPI includes project and runtime dependency notices.
export function prepareReleaseAssets(dist) {
  const addon = path.join(dist, "addon");
  for (const file of ["LICENSE", "NOTICE"]) {
    copyFileSync(file, path.join(addon, file));
  }

  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const sections = ["AskTranslate runtime dependency notices\n"];
  for (const [directory, entry] of Object.entries(lock.packages)) {
    if (!directory || entry.dev) continue;
    const pkg = JSON.parse(
      readFileSync(path.join(directory, "package.json"), "utf8"),
    );
    const files = readdirSync(directory).filter((file) =>
      /^(licen[sc]e|copying|notice)(\.|$)/i.test(file),
    );
    let notice = files
      .map((file) => readFileSync(path.join(directory, file), "utf8"))
      .join("\n\n");
    if (pkg.name === "franc" && !notice) {
      notice = readFileSync("docs/licenses/franc-license.txt", "utf8");
    }
    if (pkg.name === "iso639-js" && !notice) {
      notice = readFileSync("docs/licenses/iso639-js-license.txt", "utf8");
    }
    if (!notice) throw new Error(`Missing license notice for ${pkg.name}`);
    sections.push(
      `${pkg.name} ${pkg.version} (${pkg.license})\n${"=".repeat(60)}\n${notice.trim()}\n`,
    );
  }
  const notices = sections.join("\n");
  writeFileSync(path.join(addon, "THIRD_PARTY_NOTICES.txt"), notices);
  writeFileSync(path.join(dist, "THIRD_PARTY_NOTICES.txt"), notices);

  const styles = path.join(addon, "chrome/content/styles");
  mkdirSync(styles, { recursive: true });
  copyFileSync(
    "node_modules/katex/dist/katex.min.css",
    path.join(styles, "katex.min.css"),
  );
  cpSync("node_modules/katex/dist/fonts", path.join(styles, "fonts"), {
    recursive: true,
  });
}
