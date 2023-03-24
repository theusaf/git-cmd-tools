const { spawn } = require("child_process"),
  yargs = require("yargs/yargs"),
  { hideBin } = require("yargs/helpers"),
  path = require("path"),
  { argv } = yargs(hideBin(process.argv))
    .usage("git qc <commit message> [--push [--force]]")
    .options({
      force: {
        alias: "f",
        type: "boolean",
        describe: "If the --push flag is set, also force pushes to remote",
      },
      push: {
        alias: "p",
        type: "boolean",
        describe: "In addition, pushes to the remote",
      },
    });

function asyncRunCommand(cmd, args, opts = {}) {
  const command = spawn(cmd, args, opts);
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

(async () => {
  const defaultBranch = await asyncRunCommand("git", [
      "config",
      "--get",
      "init.defaultBranch",
    ]),
    currentRef = await asyncRunCommand("git", ["symbolic-ref", "-q", "HEAD"]),
    currentBranch = await asyncRunCommand("git", [
      "rev-parse",
      "--abbrev-ref",
      "HEAD",
    ]),
    fullBranch = await asyncRunCommand("git", [
      "for-each-ref",
      "--format=%(upstream:short)",
      currentRef,
    ]),
    remoteCheck =
      (
        await asyncRunCommand("git", ["ls-remote"], {
          setup: (child) => {
            if (child.stdin) {
              child.stdin.write("\n");
            } else {
              process.stdin.write("\n");
            }
          },
        })
      ).search(/^fatal:/) === -1,
    commitMessage = argv._[0] ?? "",
    localRepoExists = await asyncRunCommand("git", ["rev-parse", "--git-dir"]);
  if (localRepoExists.startsWith("fatal: ")) {
    await asyncRunCommand("git", ["init"]);
  }
  const addDirectory =
    localRepoExists === ".git" ? "." : path.join(localRepoExists, "..");
  await asyncRunCommand("git", ["add", addDirectory]);
  const commitFailure = /^(Aborting|nothing to commit)/m.test(
    await asyncRunCommand("git", ["commit", "-m", commitMessage], {
      stdio: "inherit",
    })
  );
  if (commitFailure) {
    process.exit(1);
  }
  if (argv.push && remoteCheck) {
    const origin = fullBranch.substring(
        0,
        fullBranch.length - currentBranch.length - 1
      ),
      args = ["push", "-u"];
    if (origin && currentBranch) {
      args.push(origin, currentBranch);
    } else {
      args.push(origin || "origin", currentBranch || defaultBranch || "main");
    }
    if (argv.force) {
      args.push("--force");
    }
    await asyncRunCommand("git", args, { stdio: "inherit" });
  }
})();
