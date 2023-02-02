/**
 * Generates a single log from the individual files in repos.
 */

import { basename, resolve } from "path";
import { readdir, writeFile } from "fs/promises";
import { stringify } from 'csv-stringify/sync';
import { Repository } from "./Repository.js";
import { Task } from "./Task.js";
import { searches, timing, signatures, tasks as foo, rankings, expands, events, results, listSignatures, answers } from "./Transformers.js";

enum Condition {
    txt = 0,
    sig = 1,
}

// enum Task {
//   sort = 1,
//   find = 2,
//   clone = 3,
//   currency = 4,
//   recent = 5,
//   serve = 6,
// }

interface TaskLogEvent {
  pid: number;
  tid: Task;
  timestamp: number;
  kind: string;
  data: Record<string, any>;
}

async function getTasks(pid: number, dir: string): Promise<Task[]> {
  const taskIds = ["sort", "currency", "find", "clone", "recent", "serve"];
  const repo = new Repository(dir);
  // const [pid] = basename(dir).split("_");
  const testReport = await repo.getTestReport();
  const trialReport = await repo.getTrialReport();
  return Promise.all(
    taskIds.map(async (taskId) => {
      const taskSequence = trialReport.conditions.find((cond) => cond.taskName === taskId)?.sequence - 2;
      const trial = trialReport.tasks.find((task) => task.id === taskId);
      const tests = testReport.testResults.find((suite) => suite.name.endsWith(`${taskId}.test.js`));
      let soln;
      try {
        const newChangeIndicator = "]"
        const diff = await repo.getDiff(taskId);
        const newChangeLineRegex = new RegExp(`^\\${newChangeIndicator}{1}.*`, "gm");
        soln = diff
          .match(newChangeLineRegex)
          ?.map((line) => line.substring(1).trim())
          .filter((line) => line.length > 0)
          .join("\n");
      } catch(err) {
        console.warn(`Failed to get diff from ${dir} for task ${taskId}.`)
      }
      let data;
      try {
        data = await repo.getTaskData(taskId);
      } catch(err) {
        console.warn(`Missing data in ${dir} for task ${taskId}.`);
      }
      return new Task(taskId, pid.toString(), taskSequence, soln, data, trial, tests);
    })
  );
}

export type SimpleObject = Record<string, string | number | boolean | null>;
type TaskTransformer = (task: Task) => SimpleObject | Array<SimpleObject> | Promise<SimpleObject | Array<SimpleObject>>;

async function toDatasets(tasks: Task[], transformers: TaskTransformer[]): Promise<Record<string, Record<string, any>[]>> {
  const datasets = transformers.reduce(
    (ds, mapper) => ({...ds, [mapper.name]: [] as Record<string, any>[] }), 
  {});
  await Promise.all(tasks.flatMap(
    (task) => transformers.map(
      (transformer) => Promise.resolve(transformer(task))
        .then((entry) => {
          const ds = datasets[transformer.name];
          if (Array.isArray(entry)) {
            ds.push(...entry)
          } else {
            ds.push(entry)
          }
        })
        .catch((err) => console.warn(`${transformer.name} dataset transformer encountered an error: ${err}`, err))
      )
    )
  );
  return datasets;
}

const dataDir = "..";
const repoPath = resolve(dataDir, "repos");
const repoDirs = await readdir(repoPath);
const tasks = (await Promise.all(repoDirs.map((dir, i) => getTasks(i + 1, resolve(repoPath, dir))))).flat();
const datasets = await toDatasets(tasks, [searches, timing, signatures, foo, rankings, expands, events, results, listSignatures, answers]);
await Promise.all(
  Object.entries(datasets).map(
    ([name, dataset]) => writeFile(resolve(dataDir, `${name}.csv`), stringify(dataset, { header: true }))
  )
);

