import fs from "fs/promises";
import * as Path from "path";
import * as url from 'url';

import { Repository } from "./Repository.js";
import { Task } from "./Task.js";
import { fetchAnswers } from "./StackExchange.js";

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const dataDir = Path.resolve(__dirname, "..", "..", "data");
const answerCacheFilename = Path.resolve(dataDir, "stackoverflow-answers.json");

let answerCache = new Map<string, {}>;
try {
    const answerCacheFile = await fs.readFile(answerCacheFilename, "utf-8");
    answerCache = new Map(JSON.parse(answerCacheFile));
} catch (err) {
    console.info("No answer cache file.");
}
const answersToFetch = new Set<string>();


const taskIds = ["sort", "currency", "find", "clone", "recent", "serve"];
const repoPath = Path.resolve(dataDir, "repos");
const repoDirs = await fs.readdir(repoPath);
const pagePromises: Promise<void>[] = [];
repoDirs.forEach((dir) => {
    const repo = new Repository(Path.resolve(repoPath, dir));
    taskIds.forEach((id) => {
        const task = new Task(id, repo);
        const pagePromise = task.getPages().then((pages) => {
            pages?.forEach((page) => {
                page.getViewedAnswers().forEach(({answerId}) => {
                    if (!answerCache.has(answerId)) {
                        answersToFetch.add(answerId);
                    }
                });
            });
        })
        pagePromises.push(pagePromise);
    });
});

await Promise.all(pagePromises);

const promises: Array<Promise<void>> = [];
const batchSize = 100;
for (let batch = 0; batch < Math.ceil(answersToFetch.size/batchSize); batch++) {
    const start = batch * batchSize;
    const end = start + batchSize;
    const ids = Array.from(answersToFetch).slice(start, end);
    const answerPromise = fetchAnswers(ids).then((answers) => {
        answers.map((a) => ({ 
        id: a.answer_id.toString(),
        questionId: a.question_id,
        isAccepted: a.is_accepted,
        score: a.score,
        created: a.creation_date,
        edited: a.last_edit_date,
        body: a.body,
    
    })).forEach((answer) => answerCache.set(answer.id, answer));
    })
    promises.push(answerPromise);
    
}
await Promise.all(promises);
await fs.writeFile(answerCacheFilename, JSON.stringify(Array.from(answerCache.entries())));