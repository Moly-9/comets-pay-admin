import {
  access,
  cp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, "..");
const sourceDirectory = path.join(workspaceRoot, "remote-snapshot/current/dist");
const outputDirectory = path.join(workspaceRoot, "local-preview/dist");
const assetsDirectory = path.join(outputDirectory, "assets");
const contractPluginBuildDirectory = path.join(
  workspaceRoot,
  "enhancements/contract-recognition/dist-plugin"
);
const contractPluginOutputDirectory = path.join(
  assetsDirectory,
  "contract-recognition"
);
const sourceScript = path.join(
  workspaceRoot,
  "enhancements/project-draft-guard.js"
);
const sourceStyles = path.join(
  workspaceRoot,
  "enhancements/project-draft-guard.css"
);

try {
  await access(path.join(contractPluginBuildDirectory, "contract-recognition.js"));
} catch {
  throw new Error(
    "Contract plugin build is missing. Run `pnpm run build:plugin` in enhancements/contract-recognition first."
  );
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(path.dirname(outputDirectory), { recursive: true });
await cp(sourceDirectory, outputDirectory, { recursive: true });
await mkdir(assetsDirectory, { recursive: true });

await cp(sourceScript, path.join(assetsDirectory, "project-draft-guard.js"));
await cp(sourceStyles, path.join(assetsDirectory, "project-draft-guard.css"));
await cp(contractPluginBuildDirectory, contractPluginOutputDirectory, {
  recursive: true,
});

const indexPath = path.join(outputDirectory, "index.html");
let indexHtml = await readFile(indexPath, "utf8");

if (!indexHtml.includes("/assets/project-draft-guard.css")) {
  indexHtml = indexHtml.replace(
    "</head>",
    '    <link rel="stylesheet" href="/assets/project-draft-guard.css">\n  </head>'
  );
}

if (
  !indexHtml.includes(
    "/assets/contract-recognition/contract-recognition.css"
  )
) {
  indexHtml = indexHtml.replace(
    "</head>",
    '    <link rel="stylesheet" href="/assets/contract-recognition/contract-recognition.css">\n  </head>'
  );
}

if (!indexHtml.includes("/assets/project-draft-guard.js")) {
  indexHtml = indexHtml.replace(
    "</body>",
    '    <script src="/assets/project-draft-guard.js"></script>\n  </body>'
  );
}

if (
  !indexHtml.includes(
    "/assets/contract-recognition/contract-recognition.js"
  )
) {
  indexHtml = indexHtml.replace(
    "</body>",
    '    <script type="module" src="/assets/contract-recognition/contract-recognition.js"></script>\n  </body>'
  );
}

await writeFile(indexPath, indexHtml);

console.log(`Local preview built at ${outputDirectory}`);
