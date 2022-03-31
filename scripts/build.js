const { spawn } = require("child_process"),
  fs = require("fs/promises"),
  path = require("path"),
  args = process.argv.slice(2),
  BUILD_DIR = path.join(__dirname, "../build/"),
  BUILD_OPTS = {
    stdio: "inherit",
    shell: true,
  },
  RUN_OPTS = {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    shell: true,
  },
  NPM = /^win/.test(process.platform) ? "npm.cmd" : "npm",
  NPX = /^win/.test(process.platform) ? "npx.cmd" : "npx"; // damn windows!

function asyncRunCommand(cmd, args, opts = {}) {
  const command = spawn(cmd, args, { stdio: "inherit" });
  return new Promise((resolve, reject) => {
    let result = "";
    if (command.stdout && command.stderr) {
      command.stdout.on("data", (data) => {
        result += data.toString("utf8");
        if (opts.dataCallback) {
          opts.dataCallback(data, command);
        }
      });
      command.stderr.on("data", (data) => {
        result += data.toString("utf8");
        if (opts.dataCallback) {
          opts.dataCallback(data, command);
        }
      });
    }
    command.once("close", () => {
      if (result[result.length - 1] === "\n") {
        result = result.substr(0, result.length - 1);
      }
      resolve(result);
    });
    command.once("error", (err) => {
      reject(err);
    });
    if (typeof opts.setup === "function") {
      opts.setup(command);
    }
  });
}

function pkgPlatform() {
  switch (process.platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "win";
    case "freebsd":
      return "freebsd";
    default:
      return "linux";
  }
}

const builds = {
  hub: async () => {
    await asyncRunCommand(
      NPX,
      [
        "pkg",
        "--out-path",
        "build",
        "-t",
        `node16-${pkgPlatform()}-x64`,
        "node/git-hub.js",
      ],
      BUILD_OPTS
    );
  },
  qc: async () => {
    try {
      require("yargs");
    } catch (e) {
      await asyncRunCommand(NPM, ["install", "yargs", "-D"], RUN_OPTS);
    }
    await asyncRunCommand(
      NPX,
      [
        "pkg",
        "--out-path",
        "build",
        "-t",
        `node16-${pkgPlatform()}-x64`,
        "node/git-qc.js",
      ],
      BUILD_OPTS
    );
  },
};

(async () => {
  try {
    require("pkg");
  } catch (e) {
    await asyncRunCommand(NPM, ["install", "pkg", "-D"], RUN_OPTS);
  }
  await fs.mkdir(BUILD_DIR).catch(() => {});
  if (args.length === 0) {
    for (const build of Object.values(builds)) {
      await build();
    }
  } else {
    for (const item of args) {
      if (Object.hasOwnProperty.call(builds, item)) {
        await builds[item]();
      } else {
        console.warn(`[GIT-CMD-TOOLS] WARN: No build found for '${item}'`);
      }
    }
  }
  console.log("[GIT-CMD-TOOLS] INFO: Done.");
})();
