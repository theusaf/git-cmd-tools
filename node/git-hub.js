const readline = require("readline"),
  https = require("https"),
  fs = require("fs"),
  path = require("path"),
  { spawn } = require("child_process"),
  cwd = process.cwd();

const interface = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function asyncRunCommand(cmd, args, opts = {}) {
  const command = spawn(cmd, args);
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

function asyncQuestion(question, def, validator, muted) {
  const originalFunc = interface._writeToOutput;
  return new Promise((resolve) => {
    const q = `${question}${def ? ` (${def})` : ""} `;
    interface.question(q, (answer) => {
      if (answer === "") {
        answer = def;
      }
      if (muted) {
        // unmute
        interface._writeToOutput = originalFunc;
        interface.history.slice(1);
        console.log("");
      }
      // return true if valid
      if (validator && !validator(answer)) {
        console.log("Invalid response: " + answer);
        return resolve(asyncQuestion(...arguments));
      }
      resolve(answer);
    });
    if (muted) {
      interface._writeToOutput = (str) => {
        if (str.indexOf(q) === 0) {
          interface.output.write(q);
          interface.output.write("*".repeat(str.length - q.length));
        } else {
          interface.output.write("*".repeat(str.length));
        }
      };
    }
  });
}

function close(message) {
  if (message) {
    console.log(message);
  }
  interface.close();
}

function request(url, opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, opts, (res) => {
      let result = "";
      res.on("data", (data) => {
        result += data.toString("utf8");
      });
      res.on("error", () => {
        reject({
          body: result,
          code: res.statusCode,
          headers: res.headers,
        });
      });
      res.on("close", () => {
        resolve({
          body: result,
          code: res.statusCode,
          headers: res.headers,
        });
      });
    });
    req.end(body);
  });
}

(async () => {
  let username = await asyncRunCommand("git", ["config", "--get", "user.name"]),
    defaultBranch = await asyncRunCommand("git", [
      "config",
      "--get",
      "init.defaultBranch",
    ]),
    credentialHelper = await asyncRunCommand("git", [
      "config",
      "--get",
      "credential.helper",
    ]),
    password;
  if (credentialHelper !== "" && credentialHelper !== " ") {
    let tmp = "";
    const passwordGetter = (data, child) => {
      data = data.toString("utf8");
      tmp += data;
      if (data === "\n") {
        child.stdin.write("\n");
      }
    };
    await asyncRunCommand("git", [`credential-${credentialHelper}`, "get"], {
      dataCallback: passwordGetter,
      setup: (child) => {
        child.stdin.write("protocol=https\nhost=github.com\n\n");
      },
    });
    const passwordRegex = /^password=.*$/m;
    password = tmp.match(passwordRegex);
    if (password) {
      password = password[0].substr(9);
    }
  }
  // Check if remote is already configured.
  const remoteCheck = await asyncRunCommand("git", ["ls-remote"], {
    setup: (child) => {
      child.stdin.write("\n");
    },
  });
  if (remoteCheck.search(/^fatal:/) === -1) {
    // remotes exist
    return close("fatal: Remote repository is already configured!");
  }
  let localRepoExists = true;
  try {
    fs.statSync(path.join(cwd, "/.git"));
  } catch (e) {
    localRepoExists = false;
  }
  const repositoryName = await asyncQuestion(
      "repository name:",
      path.parse(cwd).name
    ),
    description = (await asyncQuestion("description:")) || "",
    private = await asyncQuestion("make repo private?", "no", (answer) => {
      return /^((y(es)?)|(no?))$/.test(answer);
    }),
    confirm = await asyncQuestion(
      `Creating a repository with the following information:
- Name:        ${repositoryName}
- Description: ${description}
- Private:     ${private[0] === "y" ? "yes" : "no"}
Is this OK?`,
      "yes"
    );
  if (!/^(y(es)?)$/.test(confirm)) {
    return close("Aborted.");
  }
  if (username === "") {
    username = await asyncQuestion(
      "Enter your GitHub username:",
      null,
      (answer) => {
        return /^[a-z0-9-_.]+$/i.test(answer);
      }
    );
  }
  if (!password) {
    password = await asyncQuestion(
      "Enter your GitHub access token:",
      null,
      null,
      true
    );
  }
  // create remote repository
  const createdRepoInfo = await request(
    "https://api.github.com/user/repos",
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${password}`,
        "User-Agent": "git-hub; NodeJS CLI command",
      },
    },
    JSON.stringify({
      name: repositoryName,
      description: description,
      private: private[0] === "y",
      auto_init: false,
    })
  );
  if (createdRepoInfo.code !== 201) {
    return close(
      `Failed to created repository: (${createdRepoInfo.code})\n${createdRepoInfo.body}`
    );
  }
  const parsedRepoInfo = JSON.parse(createdRepoInfo.body);
  console.log("GitHub repository successfully created!");
  console.log(parsedRepoInfo.html_url);
  if (!localRepoExists) {
    await asyncRunCommand("git", ["init"]);
  }
  await asyncRunCommand("git", [
    "remote",
    "add",
    "origin",
    parsedRepoInfo.clone_url,
  ]);
  let test;
  const autoPush =
    (
      (await asyncQuestion(
        "Would you like to push your code now?",
        "yes",
        (answer) => {
          return /^((y(es)?)|(no?))$/.test(answer);
        }
      )
    ))[0] === "y";
  if (autoPush) {
    await asyncRunCommand("git", ["add", "."]);
    await asyncRunCommand("git", ["commit", "-m", "Initial commit."]);
    await asyncRunCommand("git", ["branch", "-M", defaultBranch || "main"]);
    await asyncRunCommand("git", [
      "push",
      "-u",
      "origin",
      defaultBranch || "main",
    ]);
  }
  console.log("Done.");
  close();
})();
