import {
  access,
  cp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, "..");
const sourceDirectory = path.join(workspaceRoot, "remote-snapshot/current/dist");
const outputDirectory = path.join(workspaceRoot, "local-preview/dist");
const assetsDirectory = path.join(outputDirectory, "assets");
const payoutActionsBuildDirectory = path.join(
  workspaceRoot,
  "enhancements/payout-account-actions/dist-plugin"
);
const payoutActionsOutputDirectory = path.join(
  assetsDirectory,
  "payout-account-actions"
);
const sourceScript = path.join(
  workspaceRoot,
  "enhancements/project-draft-guard.js"
);
const sourceStyles = path.join(
  workspaceRoot,
  "enhancements/project-draft-guard.css"
);
const contractReviewSourceDirectory = path.join(
  workspaceRoot,
  "enhancements/contract-review-workflow"
);
const contractReviewOutputDirectory = path.join(
  assetsDirectory,
  "contract-review-workflow"
);

try {
  await access(
    path.join(payoutActionsBuildDirectory, "payout-account-actions.js")
  );
} catch {
  throw new Error(
    "Payout account actions build is missing. Run `pnpm run build:plugin` in enhancements/payout-account-actions first."
  );
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(path.dirname(outputDirectory), { recursive: true });
await cp(sourceDirectory, outputDirectory, { recursive: true });
await mkdir(assetsDirectory, { recursive: true });

await cp(sourceScript, path.join(assetsDirectory, "project-draft-guard.js"));
await cp(sourceStyles, path.join(assetsDirectory, "project-draft-guard.css"));
await cp(contractReviewSourceDirectory, contractReviewOutputDirectory, {
  recursive: true,
});
await cp(payoutActionsBuildDirectory, payoutActionsOutputDirectory, {
  recursive: true,
});

const indexPath = path.join(outputDirectory, "index.html");
let indexHtml = await readFile(indexPath, "utf8");
const projectDraftGuardVersion = createHash("sha256")
  .update(await readFile(sourceScript))
  .digest("hex")
  .slice(0, 12);
const payoutActionsVersion = createHash("sha256")
  .update(
    await readFile(
      path.join(payoutActionsBuildDirectory, "payout-account-actions.js")
    )
  )
  .digest("hex")
  .slice(0, 12);
const contractReviewVersion = createHash("sha256")
  .update(
    await readFile(
      path.join(contractReviewSourceDirectory, "contract-review-workflow.js")
    )
  )
  .update(
    await readFile(
      path.join(contractReviewSourceDirectory, "contract-review-workflow.css")
    )
  )
  .digest("hex")
  .slice(0, 12);

if (!indexHtml.includes("/assets/project-draft-guard.css")) {
  indexHtml = indexHtml.replace(
    "</head>",
    '    <link rel="stylesheet" href="/assets/project-draft-guard.css">\n  </head>'
  );
}

if (
  !indexHtml.includes(
    "/assets/contract-review-workflow/contract-review-workflow.css"
  )
) {
  indexHtml = indexHtml.replace(
    "</head>",
    `    <link rel="stylesheet" href="/assets/contract-review-workflow/contract-review-workflow.css?v=${contractReviewVersion}">\n  </head>`
  );
}

if (
  !indexHtml.includes(
    "/assets/payout-account-actions/payout-account-actions.css"
  )
) {
  indexHtml = indexHtml.replace(
    "</head>",
    `    <link rel="stylesheet" href="/assets/payout-account-actions/payout-account-actions.css?v=${payoutActionsVersion}">\n  </head>`
  );
}

if (!indexHtml.includes("/assets/project-draft-guard.js")) {
  indexHtml = indexHtml.replace(
    "</body>",
    `    <script src="/assets/project-draft-guard.js?v=${projectDraftGuardVersion}"></script>\n  </body>`
  );
}

if (
  !indexHtml.includes(
    "/assets/contract-review-workflow/contract-review-workflow.js"
  )
) {
  indexHtml = indexHtml.replace(
    "</body>",
    `    <script src="/assets/contract-review-workflow/contract-review-workflow.js?v=${contractReviewVersion}"></script>\n  </body>`
  );
}

if (
  !indexHtml.includes(
    "/assets/payout-account-actions/payout-account-actions.js"
  )
) {
  indexHtml = indexHtml.replace(
    "</body>",
    `    <script type="module" src="/assets/payout-account-actions/payout-account-actions.js?v=${payoutActionsVersion}"></script>\n  </body>`
  );
}

await writeFile(indexPath, indexHtml);

console.log(`Local preview built at ${outputDirectory}`);
