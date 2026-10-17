"""Check the actual installable XPI and update manifest before publication."""

import hashlib
import json
from pathlib import Path
from zipfile import ZipFile


def require(condition, message):
    if not condition:
        raise SystemExit(message)


root = Path(__file__).resolve().parents[1]
package = json.loads((root / "package.json").read_text(encoding="utf-8"))
config = package["config"]
version = package["version"]
repo = package["repository"]["url"].removeprefix("git+").removesuffix(".git")
channel = "update-beta.json" if "-" in version else "update.json"
artifact = root / "build/asktranslate.xpi"
require(artifact.is_file(), "Missing build/asktranslate.xpi")

with ZipFile(artifact) as archive:
    require(archive.testzip() is None, "Corrupt XPI archive")
    manifest = json.loads(archive.read("manifest.json"))
    app = manifest["applications"]["zotero"]
    require(manifest["name"] == config["addonName"], "Wrong plugin name")
    require(manifest["version"] == version, "Wrong plugin version")
    require(manifest["author"] == package["author"], "Wrong plugin author")
    require(manifest["homepage_url"] == package["homepage"], "Wrong homepage")
    require(app["id"] == "asktranslate@clef233.github.io", "Wrong plugin ID")
    require(app["update_url"] == f"{repo}/releases/download/asktranslate-updates/{channel}", "Wrong update URL")
    for name in ["LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.txt"]:
        require(name in archive.namelist(), f"Missing {name} in XPI")
    require(archive.read("LICENSE") == (root / "LICENSE").read_bytes(), "License was changed during packaging")
    notice = archive.read("NOTICE").decode()
    require("windingwind" in notice and "clef233" in notice, "Missing attribution")
    require(f"asktranslate-v{version}" in notice, "NOTICE source link does not match version")
    for dependency in package["dependencies"]:
        require(dependency in archive.read("THIRD_PARTY_NOTICES.txt").decode(), f"Missing notice for {dependency}")
    require("chrome/content/styles/katex.min.css" in archive.namelist(), "Missing KaTeX stylesheet")
    require(any(name.endswith(".woff2") for name in archive.namelist()), "Missing KaTeX fonts")
    script = f"chrome/content/scripts/{config['addonRef']}.js"
    require(script in archive.namelist(), "Missing plugin entry point")
    bootstrap = archive.read("bootstrap.js").decode()
    require("__addonRef__" not in bootstrap and "__addonInstance__" not in bootstrap, "Unresolved bootstrap placeholders")

update = json.loads((root / "build" / channel).read_text(encoding="utf-8"))
require(set(update["addons"]) == {config["addonID"]}, "Update manifest contains another plugin ID")
entry = update["addons"][config["addonID"]]["updates"][0]
require(entry["version"] == version, "Update version differs from XPI")
require(entry["update_link"] == f"{repo}/releases/download/asktranslate-v{version}/asktranslate.xpi", "Wrong XPI download URL")
require(entry["update_hash"] == "sha512:" + hashlib.sha512(artifact.read_bytes()).hexdigest(), "Update hash differs from XPI")
require(entry["applications"]["zotero"]["strict_min_version"] == app["strict_min_version"], "Wrong minimum Zotero version")

checksum = hashlib.sha256(artifact.read_bytes()).hexdigest()
(root / "build/SHA256SUMS").write_text(f"{checksum}  asktranslate.xpi\n", encoding="utf-8", newline="\n")
print(f"Verified AskTranslate {version}: identity, attribution, assets and update hash")
