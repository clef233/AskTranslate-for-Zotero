import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";
import { prepareReleaseAssets } from "./scripts/prepare-release-assets.mjs";

export default defineConfig({
  source: ["src", "addon"],
  dist: "build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  xpiName: "asktranslate",
  updateURL: `https://github.com/{{owner}}/{{repo}}/releases/download/asktranslate-updates/${
    pkg.version.includes("-") ? "update-beta.json" : "update.json"
  }`,
  xpiDownloadLink:
    "https://github.com/{{owner}}/{{repo}}/releases/download/asktranslate-v{{version}}/{{xpiName}}.xpi",

  server: {
    asProxy: false,
  },

  build: {
    assets: ["addon/**/*.*"],
    hooks: {
      "build:copyAssets": (ctx) => prepareReleaseAssets(ctx.dist),
    },
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    esbuildOptions: [
      {
        entryPoints: [
          { in: "src/index.ts", out: pkg.config.addonRef },
          { in: "src/extras/*.*", out: "" },
        ],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        bundle: true,
        target: "firefox115",
        outdir: "build/addon/chrome/content/scripts",
      },
    ],
  },
});
