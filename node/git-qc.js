const readline = require("readline"),
  {spawn} = require("child_process"),
  yargs = require("yargs/yargs"),
  {hideBin} = require("yargs/helpers"),
  {argv:args} = yargs(hideBin(process.argv))
    .options({
      force: {
        alias: "f",
        type: "boolean"
      },
      push: {
        alias: "p",
        type: "boolean"
      }
    }),
  cwd = process.cwd();

function asyncRunCommand(cmd, args, opts = {}) {
  const command = spawn(cmd, args, {stdio: "inherit"});
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
  const defaultBranch = await asyncRunCommand("git", ["config", "--get", "init.defaultBranch"]),
    currentBranch = await asyncRunCommand("git" ["for-each-ref", "--format='%(upstream:short)'", '"$(git symbolic-ref -q HEAD)"']),
    remoteCheck = await asyncRunCommand("git", ["ls-remote"], {
    setup: (child) => {child.stdin.write("\n");}
  }).search(/^fatal:/) === -1,
    [commitMessage] = argv._;
  let localRepoExists = true;
  try{fs.statSync(path.join(cwd, "/.git"));}catch(e){localRepoExists = false;}
  if (!localRepoExists) {
    await asyncRunCommand("git", ["init"]);
  }
  if (args.push && remoteCheck) {
    const args = 
  }
})();
