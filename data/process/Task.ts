import { basename } from "path";
import { Repository } from "./Repository.js";
import { Page } from "./Page.js";

function cleanFeedback(feedback: string | undefined): string {
    if (typeof feedback === "string") {
        return feedback.replace(/\n/g, " ");
    }
    return "";
}


export class Task {
    constructor(readonly id: string, readonly repo: Repository) {}

    get pid(): string {
        const [pid] = basename(this.repo.root).split("_");
        return pid;
    }

    get maxDuration(): number {
        if (["recent", "serve"].includes(this.id)) {
            return 7 * 60 * 1000;
        } else {
            return 6 * 60 * 1000;
        }
    }

    async getTaskTrial(): Promise<any> {
        const trial = await this.repo.getTrialReport();
        return trial.tasks.find((task) => task.id === this.id);
    }

    async getFeedback(): Promise<{ Q1: string | null, Q2: string | null, Q3: string | null, Q4: string | null }> {
        const trial = await this.getTaskTrial();
        if (!trial.data) {
            console.warn(`Missing 'data' for ${trial.id} task in repo ${this.repo.root}`);
            return { Q1: null, Q2: null, Q3: null, Q4: null }
        }
        return {
            Q1: cleanFeedback(trial.data.Q1),
            Q2: cleanFeedback(trial.data.Q2),
            Q3: cleanFeedback(trial.data.Q3),
            Q4: cleanFeedback(trial.data.Q4),
        }
    }

    /**
     * 
     * @returns The timestamp of the first search.
     */
    async getSearchStartTime(): Promise<Date | undefined> {
        const data = await this.repo.getTaskData(this.id);
        const firstSearch = data.searches[0];
        // const resultsLoaded = firstSearch.events.filter((e) => e.action === "loaded").sort().reverse()[0];
        return new Date(firstSearch.timestamp);
    }

    async getStartTime(): Promise<Date | undefined> {
        const trial = await this.getTaskTrial();
        return new Date(trial.timer.startTime);
    }

    async getEndtime(): Promise<Date | undefined> {
        const trial = await this.getTaskTrial();
        return new Date(trial.timer.endTime);
    }

    async getDuration(): Promise<number | undefined> {
        try {
            const [start, end] = await Promise.all([this.getStartTime(), this.getEndtime()]);
            if (start && end) {
                return end.getTime() - start.getTime(); 
            }
        } catch (error) {
            console.warn(`Failed to read timestamps.`);
        }
    }

    async getTreatementIsProjection(): Promise<boolean | undefined> {
        try {
            const task = await this.getTaskTrial();
            return task.enableFragments;
        } catch (error) {
            console.warn(`Failed to get trial data.`)
        }
    }

    async getSearches(): Promise<any[] | undefined> {
        try {
            const data = await this.repo.getTaskData(this.id);
            return data.searches;
        } catch (error) {
            console.warn("File missing", error);
            return;
        }
    }

    async getTestStatus(): Promise<boolean | undefined> {
        try {
        const jestReport = await this.repo.getTestReport();
        return jestReport.testResults.find((suite) => suite.name.endsWith(`${this.id}.test.js`)).status === "passed"
        } catch (error) {
            console.warn(`Failed to get test report.`);
        }
    }

    async getProjectionCopies(): Promise<any[]| undefined> {
        const searches = await this.getSearches();
        //return searches?.map((search) => search.events.filter((event) => event.component === "projection" && event.action === "copy")).flat();
        return searches?.reduce((accum, search) => {
            const copyEvents = search.events.reduce((debounce, event) => {
                if (event.component === "projection" && event.action === "copy") {
                    if (!debounce.some((cp) => cp.url === event.url && cp.data.sig === event.data.sig && cp.data.selection === event.data.selection)) {
                        debounce.push(event);
                    }
                }
                return debounce;
            }, []);
            return accum.concat(...copyEvents)
        }, []);
    }

    async getPages(): Promise<Page[] | undefined> {
        const searches = await this.getSearches();
        const pageHash = searches?.reduce((accum, search) => {
            search.events
                .filter((event) => event.component === "page" && event.action === "open")
                .forEach((event) => {
                if (!accum.hasOwnProperty(event.url)) {
                    accum[event.url] = [];
                }

                accum[event.url].push(...search.events);
            });
            return accum;
        }, {});
        if (pageHash) {
            return Object.entries(pageHash).map(([url, events]) => new Page(url, events as any[]));
        }
    }
}