import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const repository = pkg.repository.url.match(
  /github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/,
)?.[1];
const tag = `asktranslate-v${pkg.version}`;
if (
  process.env.GITHUB_REF_NAME !== tag ||
  process.env.GITHUB_REPOSITORY !== repository
) {
  throw new Error(
    "Run this publisher in the version-tag workflow of this repository.",
  );
}
const prerelease = pkg.version.includes("-");
const channel = prerelease ? "update-beta.json" : "update.json";
const gh = (args) =>
  execFileSync("gh", [...args, "--repo", repository], { encoding: "utf8" });
function release(name) {
  try {
    return JSON.parse(gh(["release", "view", name, "--json", "isDraft"]));
  } catch (error) {
    if (/release not found|HTTP 404|Not Found/i.test(String(error.stderr)))
      return null;
    throw error;
  }
}

const source = `https://github.com/${repository}/tree/${tag}`;
const notesPath = `docs/releases/${pkg.version}.md`;
const notes = existsSync(notesPath)
  ? readFileSync(notesPath, "utf8")
  : `AskTranslate ${pkg.version}\n\nInstall asktranslate.xpi with the original Translate plugin disabled.\n\nSource and build instructions: ${source}\n\nBased on windingwind/zotero-pdf-translate, distributed under AGPL-3.0-or-later.\n`;
writeFileSync("build/release-notes.md", notes);
const assets = [
  "build/asktranslate.xpi",
  `build/${channel}`,
  "build/SHA256SUMS",
  "LICENSE",
  "NOTICE",
  "build/THIRD_PARTY_NOTICES.txt",
];
const existing = release(tag);
let metadata = `build/${channel}`;
if (!existing) {
  gh([
    "release",
    "create",
    tag,
    "--verify-tag",
    "--draft",
    "--title",
    `AskTranslate ${pkg.version}`,
    "--notes-file",
    "build/release-notes.md",
    ...assets,
  ]);
} else if (existing.isDraft) {
  gh(["release", "upload", tag, "--clobber", ...assets]);
} else {
  // A rerun must not replace an already published binary with a new build.
  mkdirSync("build/published", { recursive: true });
  gh([
    "release",
    "download",
    tag,
    "--dir",
    "build/published",
    "--clobber",
    "--pattern",
    channel,
    "--pattern",
    "asktranslate.xpi",
  ]);
  metadata = `build/published/${channel}`;
  const update = JSON.parse(readFileSync(metadata, "utf8"));
  const entry = update.addons[pkg.config.addonID]?.updates?.[0];
  const hash =
    "sha512:" +
    createHash("sha512")
      .update(readFileSync("build/published/asktranslate.xpi"))
      .digest("hex");
  if (entry?.version !== pkg.version || entry?.update_hash !== hash)
    throw new Error("Published assets failed verification.");
}
if (!existing || existing.isDraft) {
  gh([
    "release",
    "edit",
    tag,
    "--draft=false",
    `--prerelease=${prerelease}`,
    `--latest=${!prerelease}`,
  ]);
}

const updateTag = "asktranslate-updates";
if (!release(updateTag)) {
  writeFileSync(
    "build/update-notes.md",
    "Update manifests for AskTranslate. Installers and corresponding source are published in the versioned AskTranslate releases. This release contains update metadata only.\n",
  );
  gh([
    "release",
    "create",
    updateTag,
    "--target",
    process.env.GITHUB_SHA,
    "--title",
    "AskTranslate update manifests",
    "--prerelease",
    "--latest=false",
    "--notes-file",
    "build/update-notes.md",
  ]);
}
gh(["release", "upload", updateTag, metadata, "--clobber"]);
console.log(`Published ${tag}; ${channel} points to ${source}`);
