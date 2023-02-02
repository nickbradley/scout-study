import * as Path from "path";
import fs from "fs/promises";
import {exec} from "child_process";
import { TrialReport, TaskData, JestReport } from "./types.js";

export class Repository {
    private cacheTrialReport: TrialReport;
    private cacheTaskData: TaskData;

    constructor(readonly root: string) {}
    
    async readFile(path: string): Promise<string> {
        return fs.readFile(Path.join(this.root, path), "utf-8");
    }

    async getTestReport(): Promise<JestReport> {
        const content = await fs.readFile(Path.join(this.root, "test-report.json"), "utf-8");
        return JSON.parse(content);
    }

    async getTrialReport(): Promise<TrialReport> {
        if (!this.cacheTrialReport) {
            const content = await fs.readFile(Path.resolve(this.root, "toast.data.json"), "utf-8");
            this.cacheTrialReport = JSON.parse(content);

            // Fix data that was dropped in a later commit for some reason
            if (this.root.includes("92652_3")) {
                const tasks = this.cacheTrialReport["tasks"];
                const data = [
                    { 
                        id: "currency",
                        "startTime": "2022-11-21T19:22:31.264Z",
                        "timer": {
                            "startTime": "2022-11-21T19:22:31.264Z",
                            "endTime": "2022-11-21T19:26:58.082Z"
                        },
                        "duration": 265219,
                        "data": {
                            "Q1": "5",
                            "Q2": "the first result pretty much had the answer - just didnt like the stackoverflow webpage being shown. the width is way too small and would prefer to search for this on its own web page  ",
                            "Q3": "i think giving links to mdn docs on how to use the methods would be useful",
                            "Q4": "the side panel was too small and hard to navigate and read the comments on stack overflow"
                        },
                        "endTime": "2022-11-21T19:29:28.555Z"
                    },
                    {
                        "id": "find",
                        "startTime": "2022-11-21T19:17:31.602Z",
                        "timer": {
                            "startTime": "2022-11-21T19:17:31.602Z",
                            "endTime": "2022-11-21T19:19:50.349Z"
                        },
                        "duration": 137100,
                        "data": {
                            "Q1": "5",
                            "Q2": "it was easy to find the answers with the keywords and even using random words  helped to come with a solution.I wish there was an explanation on the different methods that can be used vs feeling like it can only be done one way",
                            "Q3": "explanation on the differences between each solution and if it returns a new array or not for example. i think understand how the methods work is useful when learning ",
                            "Q4": ""
                        },
                        "endTime": "2022-11-21T19:22:16.681Z"
                    },
                    {
                        "id": "clone",
                        "startTime": "2022-11-21T19:14:56.728Z",
                        "timer": {
                            "startTime": "2022-11-21T19:14:56.729Z",
                            "endTime": "2022-11-21T19:15:31.347Z"
                        },
                        "duration": 33003,
                        "data": {
                            "Q1": "4",
                            "Q2": "It was clear and easy to get a solution ",
                            "Q3": "no adding in the keywords make it easy to find a solution",
                            "Q4": "n/a"
                        },
                        "endTime": "2022-11-21T19:17:22.277Z"
                    },
                    {
                        "id": "sort",
                        "startTime": "2022-11-21T19:29:38.741Z",
                        "timer": {
                            "startTime": "2022-11-21T19:29:38.742Z",
                            "endTime": "2022-11-21T19:32:33.169Z"
                        },
                        "duration": 173071,
                        "data": {
                            "Q1": "3",
                            "Q2": "It was pretty straightforward and didn't need to use scout.",
                            "Q3": "an explanation between sorting words and numbers as that is something i dont fully understand",
                            "Q4": ""
                        },
                        "endTime": "2022-11-21T19:34:10.824Z"
                    },
                    {
                        "id": "serve",
                        "data": {
                            "Q1": "2",
                            "Q2": "with minimal experience with express it was hard to understand the solution from the articles. i wish there had been small summaries to explain the basics but looking at the solution it looks like i wasnt too far off ",
                            "Q3": "maybe include documentation from express to make it a little easier to understand the framework being used",
                            "Q4": ""
                        },
                        "endTime": "2022-11-21T19:50:16.370Z"
                    }
                ]
                this.cacheTrialReport["tasks"] = tasks.map((task) => {
                    const missingData = data.find((taskUpdate) => taskUpdate.id === task.id);
                    return { ...missingData, ...task }
                });
                console.log("Applying data patch to 92652_3",);
          
            }
        }
        return this.cacheTrialReport;
    }

    async getTaskData(taskId: string): Promise<TaskData> {
        if (!this.cacheTaskData) {
            const content = await fs.readFile(Path.resolve(this.root, `scout.data.${taskId}.json`), "utf-8");
            this.cacheTaskData = JSON.parse(content);
        }
        return this.cacheTaskData;
    }

    async getDiff(taskId: string): Promise<string> {
        const file = Path.resolve(this.root, "src", `${taskId}.js`);
        const filename = Path.basename(file);
        const path = Path.dirname(file);
        const newChangeIndicator = "]"
        const diffCommand = `git diff --output-indicator-new=${newChangeIndicator} $(git rev-list --max-parents=0 HEAD) -- ${filename}`
        const newChangeLineRegex = new RegExp(`^\\${newChangeIndicator}{1}\\s.*`, "gm");

        return new Promise<string>((resolve, reject) => {
            exec(diffCommand, { cwd: path }, (error, stdout) => {
                if (error) {
                    return reject(error);
                }
                resolve(stdout);
            });
        });

        // Added lines
        // diff.match(newChangeLineRegex)?.map((line) => line.substring(1).trim()).filter((line) => line.length > 0)
    }
}
