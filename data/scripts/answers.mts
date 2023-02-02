import FS from "fs/promises";
import { parse } from 'node-html-parser';

const answers = JSON.parse(await FS.readFile("../stackoverflow-answers.json", "utf-8"));
const records = answers.map(([id, answer]) => {
    const doc = parse(answer.body);
    const paragraphs = doc.getElementsByTagName("p").length;
    const loc = doc.getElementsByTagName("pre").map((pre) => pre.textContent).reduce((loc, text) => loc + text.split("\n").length, 0);
    const row = `${id},${paragraphs},${loc}`;
    return row;
});
records.splice(0,0,"answerid,paragraphs,loc");
// records.join("\n")
console.log(records.slice(0,5).join("\n"));
// Output: answerid, paragraphs, loc