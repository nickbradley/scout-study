import {exec} from "child_process";
import {basename, dirname} from "path";
// Takes a file path and returns a string with the + lines from the diff
const file = "../data/repos/87869_4/src/find.js";

const filename = basename(file);
const path = dirname(file);
const newChangeIndicator = "]"
const diffCommand = `git diff --output-indicator-new=${newChangeIndicator} $(git rev-list --max-parents=0 HEAD) -- ${filename}`
const newChangeLineRegex = new RegExp(`^\\${newChangeIndicator}{1}\\s.*`, "gm");

const diff = await new Promise<string>((resolve, reject) => {
    exec(diffCommand, { cwd: path }, (error, stdout) => {
        if (error) {
            return reject(error);
        }
        resolve(stdout);
    });
});

console.log(diff.match(newChangeLineRegex)?.map((line) => line.substring(1).trim()).filter((line) => line.length > 0));



