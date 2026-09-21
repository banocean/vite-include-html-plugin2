import fs from "node:fs/promises";
import path from "node:path";

const INCLUDE_REGEX =
  /<include\s+[^>]*?src=["']([^"']+)["'][^>]*?(?:\/>|><\/include>)/gi;

const PLUGIN_PREFIX = "[vite-include-html]";

function resolveIncludePath(src, currentDir, viteRoot) {
  const cleanSrc = src.trim();
  if (cleanSrc.startsWith("/")) {
    return path.resolve(viteRoot, cleanSrc.slice(1));
  }
  return path.resolve(currentDir, cleanSrc);
}

function parseIncludeTags(html) {
  return Array.from(html.matchAll(INCLUDE_REGEX)).map(([fullTag, src]) => ({
    fullTag,
    src: src.trim(),
  }));
}

function replaceTag(html, fullTag, replacement) {
  return html.replace(fullTag, () => replacement);
}

async function loadAndProcessInclude(filePath, ctx, viteRoot, seenFiles) {
  if (ctx.server) {
    ctx.server.watcher.add(filePath);
  }

  const fileContent = await fs.readFile(filePath, "utf-8");
  const nextDir = path.dirname(filePath);

  const nextSeen = new Set(seenFiles);
  nextSeen.add(filePath);

  return processHtmlRecursive(fileContent, nextDir, ctx, viteRoot, nextSeen);
}

async function processHtmlRecursive(
  html,
  currentDir,
  ctx,
  viteRoot,
  seenFiles = new Set(),
) {
  const includes = parseIncludeTags(html);
  if (includes.length === 0) {
    return html;
  }

  let result = html;

  for (const { fullTag, src } of includes) {
    const filePath = resolveIncludePath(src, currentDir, viteRoot);

    if (seenFiles.has(filePath)) {
      console.warn(
        `${PLUGIN_PREFIX} Circular dependency detected: ${filePath}`,
      );
      result = replaceTag(
        result,
        fullTag,
        `<!-- Circular include ignored: ${src} -->`,
      );
      continue;
    }

    try {
      const inlinedContent = await loadAndProcessInclude(
        filePath,
        ctx,
        viteRoot,
        seenFiles,
      );
      result = replaceTag(result, fullTag, inlinedContent);
    } catch (error) {
      console.error(
        `${PLUGIN_PREFIX} Error reading "${filePath}":`,
        error.message,
      );
      result = replaceTag(result, fullTag, `<!-- Error loading: ${src} -->`);
    }
  }

  return result;
}

export default function includeHtml() {
  let viteRoot = process.cwd();

  return {
    name: "vite-include-html",

    enforce: "pre",

    configResolved(config) {
      viteRoot = config.root || process.cwd();
    },

    transformIndexHtml: {
      order: "pre",
      async handler(html, ctx) {
        const baseDir = ctx.filename ? path.dirname(ctx.filename) : viteRoot;
        const rootFile = ctx.filename ? path.resolve(ctx.filename) : null;
        const initialSeen = new Set(rootFile ? [rootFile] : []);

        return processHtmlRecursive(html, baseDir, ctx, viteRoot, initialSeen);
      },
    },

    handleHotUpdate({ file, server }) {
      if (file.endsWith(".html")) {
        server.ws.send({
          type: "full-reload",
          path: "*",
        });
      }
    },
  };
}
