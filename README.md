# GIT-CMD-TOOLS

A collection of custom git commands to make things a bit faster

## Install/Build

To build or install the commands, you can either use the build script or if on linux, you can just use anything inside the /sh/ folder.

1. Clone this repository

- `git clone https://github.com/theusaf/git-cmd-tools.git`

2. `cd` into the folder

- `cd git-cmd-tools`

3. Run the build scripts

- To build all tools:
  - `npm run build`
- To build a specific tool:
  - `npm run build mytool`
  - Current options include:
    - qc
    - hub

4. When it is done, move the built files somewhere on your `PATH`

### git-hub

#### About

Automatically creates a GitHub repository and sets up branches.

#### Usage

`git hub`

### git-qc

#### About

Combines adding, committing, and pushing (if desired) into a single command. It will always add all files that can be tracked (like running from the root directory of the repo).

#### Usage

`git qc <message> [options]`

#### Options

- `push` - Pushes to remote after finishing
- `force` - Force-pushes to remote

#### Example:

`git qc "This is a message!" -pf`
