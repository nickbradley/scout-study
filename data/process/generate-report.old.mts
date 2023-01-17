import fs from "fs/promises";
import * as Path from "path";
import * as url from 'url';

import { Repository } from "./Repository.js";
import { Task } from "./Task.js";
import { TaskSummaryReport } from "./types.js";

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const dataDir = Path.resolve(__dirname, "..");

const processSearches = async (task: Task): Promise<any[]> => {
    const processedSearches: any[] = [];
    const treated = await task.getTreatementIsProjection();
    const hadContext = (seq: number) => {
        if (seq === 0) {
            // This should be true for everything except the untreated search task
            return !(["recent", "serve"].includes(task.id) && !treated);
        }
        return treated;
    }
    const getTokens = (search: any, kind?: string) =>
     search.context?.tokens
        .filter((token) => kind ? token.kind === kind : true)
        .map((token) => token.value) ?? [];
    

    const searches = await task.getSearches();
    let seq = 0;
    searches?.forEach((search, iter, searches) => {
        if (iter === 0) {
            seq = 0;
        }
        const keywords = search.keywords;
        const lang = hadContext(iter) ? getTokens(search, "language") : [];
        const libs = hadContext(iter) ? getTokens(search, "library") : [];
        const calls = hadContext(iter) ? getTokens(search, "call") : [];
        const sites = "site:stackoverflow.com";
        const context = getTokens(search);
        let cxt_used = 0;
        const query = [...lang, ...libs, ...keywords, ...calls]
            .filter((item, pos, self) => self.indexOf(item) == pos)
            .map((term) => {
                if (!context.includes(term)) {
                    return term;
                }
                cxt_used++;
                return `_${term}`
             })
            .join(" ")
            .trim();
        if (!(iter >= 1 && processedSearches[processedSearches.length-1].query === query)) {
            // Filters search that were recorded twice when the app was focused
            seq++;
            processedSearches.push({
                seq,
                time_to_search: seq > 1 ? new Date(search.timestamp).getTime() - new Date(searches[iter-1].timestamp).getTime() : null,
                pages: search.events.filter((e) => e.component === "page" && e.action === "open").length ?? 0,
                cxt_used,
                cxt_avail: context.length,
                // This might be empty if the task wan't treated (even though context is set)
                cxt: [...lang, ...libs, ...calls],
                terms: keywords,
                query
            });
        }
    });
    return processedSearches;
}



const summaryDS = async (pid: string, task: Task, acc: any[]) => {
    const feedback = await task.getFeedback();
    const pages = await task.getPages();
    const rawSearches = await task.getSearches();
    acc.push({
        pid,
        tid: task.id,
        treated: await task.getTreatementIsProjection() ?? null,
        succeeded: await task.getTestStatus() ?? null,
        duration: await task.getDuration() ?? null,
        searches: rawSearches ? (await processSearches(task)).length : null,
        expands: rawSearches?.reduce((count, search) => {
            return count += search.events.filter(e => e.component === "projection" && e.action == "expand").length
        }, 0) ?? null,
        examples: rawSearches?.reduce((count, search) => {
            // e.data === "usage" would be the first (call signature) tab
            return count += search.events.filter(e => e.component === "projection" && e.action === "tab" && e.data?.name === "code").length;
        }, 0) ?? null,
        copies: (await task.getProjectionCopies())?.length ?? null,
        pages: rawSearches?.reduce((count, search) => {
            return count += search.events.filter(e => e.component === "page" && e.action === "open").length
        }, 0) ?? null,
        links: rawSearches?.reduce((count, search) => {
            return count += search.events.filter(e => e.component === "page" && e.action === "open" && e.data).length
        }, 0) ?? null,
        answers: pages?.reduce((count, page) => count + page.getViewedAnswers().length, 0) ?? null,
        content: pages ? pages.reduce((sum, page) => sum + page.getProportionViewed(), 0) / (pages.length || 1) : null,
        q1: feedback.Q1,
        q2: feedback.Q2,
        q3: feedback.Q3,
        q4: feedback.Q4,
    })
}

const answersDS = async (pid: string, task: Task, acc: any[]) => {
    const pages = await task.getPages();
    pages?.forEach((page) => {
        page.getViewedAnswers().forEach((answer, i) => {
            acc.push({
                pid, tid: task.id, seq: i, ...answer
            })
        });
    });
}

const searchesDS = async (pid: string, task: Task, acc: any[]) => {
    const searches = await processSearches(task);
    searches.forEach((s) => acc.push({ pid, tid: task.id, ...s }));
}

const timingsDS = async (pid: string, task: Task, acc: any[]) => {
    const addTimeEvent = (name, offset) => {
        acc.push({
            pid,
            tid: task.id,
            event: name,
            offset
        });
    }
    let taskStart;
    try {
        taskStart = (await task.getStartTime())?.getTime();
    } catch(e) {}

    if (!taskStart) {
        console.log("Failed to read task start time");
        return;
    }
    const taskEnd = (await task.getEndtime())?.getTime();
    const searches = await task.getSearches();
    searches?.forEach((search) => {
        if (search.events.length === 0) {
            return;
        }
        const resultUrls = search.results.map((r) => r.url);
        const lastEvent = search.events[search.events.length - 1];
        addTimeEvent("search_start", new Date(search.timestamp).getTime() - taskStart);
        let haveSeenFirstResult = false;
        let haveSeenFirstEngagement = false;
        search.events.forEach((event, i, events) => {
            // Decide which kind of event
            if (event.component === "projection" && event.action === "loaded") {
                if (!haveSeenFirstResult) {
                    addTimeEvent("first_result", new Date(event.timestamp).getTime() - taskStart);
                    haveSeenFirstResult = true;
                }
                if (resultUrls.indexOf(event.url) === 0) {
                    addTimeEvent("top_result", new Date(event.timestamp).getTime() - taskStart);
                }
            } else if (event.component === "page" && event.action === "open") {
                const pageOpenOffset = new Date(event.timestamp).getTime() - taskStart;
                if (!haveSeenFirstEngagement) {
                    addTimeEvent("first_engagement", pageOpenOffset);
                    haveSeenFirstEngagement = true;
                }
                addTimeEvent("page_open", pageOpenOffset);
                // find the first subsequent close event (or use the last possible event if the page was never explicitly closed)
                const pageClose = events.slice(i).find((e) => e.component === "page" && e.action === "close") ?? events[events.length-1];
                addTimeEvent("page_close", new Date(pageClose.timestamp).getTime() - taskStart)
            } else if (event.component === "projection" && event.action === "expand") {
                if (!haveSeenFirstEngagement) {
                    addTimeEvent("first_engagement", new Date(event.timestamp).getTime() - taskStart);
                    haveSeenFirstEngagement = true;
                }
            }

        }); 
        addTimeEvent("search_end", new Date(lastEvent.timestamp).getTime() - taskStart);
    });
    addTimeEvent("task_end", taskEnd! - taskStart);
}

const timingDS = async (pid: string, task: Task, acc: any[]) => {
    let taskStart;
    try {
        taskStart = (await task.getStartTime())?.getTime();
    } catch(err) {
        console.warn("Failed to get start time, skipping", err);
        return;
    }
    // const taskEnd = (await task.getEndtime())?.getTime();
    const duration = await task.getDuration();
    const searches = await task.getSearches();
    
    let firstResultTime;
    let engagements = 0;

    let timeInApp = 0;
    let timeInPage = 0;
    let timeLoadingFirst = 0;
    let firstEngagementTime = 0;
    searches?.forEach((search) => {
        if (search.events.length === 0) {
            return;
        }
        const firstEventTimestamp = search.events[0].timestamp;
        const lastEventTimestamp = search.events[search.events.length - 1].timestamp;
        timeInApp += new Date(lastEventTimestamp).getTime() - new Date(firstEventTimestamp).getTime(); 

        search.events.forEach((event, i, events) => {
            if (event.component === "projection" && event.action === "loaded") {
                if (!firstResultTime) {
                    const resultTime = new Date(event.timestamp).getTime()
                    timeLoadingFirst += resultTime - new Date(search.timestamp).getTime();
                    firstResultTime = resultTime;
                }
            } else if (event.component === "page" && event.action === "open") {
                if (engagements === 0) {
                    firstEngagementTime += new Date(event.timestamp).getTime() - firstResultTime; 
                    engagements++;
                }
                // find the first subsequent close event (or use the last possible event if the page was never explicitly closed)
                const pageCloseEvent = events.slice(i).find((e) => e.component === "page" && e.action === "close") ?? events[events.length-1];
                timeInPage += new Date(pageCloseEvent.timestamp).getTime() - new Date(event.timestamp).getTime();
            } else if (event.component === "projection" && event.action === "expand") {
                if (engagements === 0) {
                    firstEngagementTime += new Date(event.timestamp).getTime() - firstResultTime;
                    engagements++;
                }
            }
        });
    });

    acc.push({
        pid,
        tid: task.id,
        total: duration ? Math.min(duration, task.maxDuration) : null,
        app: timeInApp,
        page: timeInPage,
        load: timeLoadingFirst,
        review: firstEngagementTime,
    })
}

const loadDS = async (pid: string, task: Task, acc: any[]) => {
    const searches = await task.getSearches();
    searches?.forEach((search, i) => {
        const start = new Date(search.timestamp).getTime();
        const resultUrls = search.results.map((r) => r.url);
        let loadSeq = 0;
        search.events.forEach((event) => {
            if (event.component === "projection" && event.action === "loaded") {
                const loadTime = new Date(event.timestamp).getTime() - start;
                const resultSeq = resultUrls.indexOf(event.url);
                acc.push({
                    pid,
                    tid: task.id,
                    searchSeq: i,
                    resultSeq,
                    loadSeq,
                    loadTime,
                });
                loadSeq++;

            }
        })
    })
}

const waits: Promise<void>[] = [];

const summaryReport: TaskSummaryReport[] = [];
const viewedAnswers: any[] = [];
const searches: any[] = [];
const timings: any[] = [];
const loadings: any[] = [];

const taskIds = ["sort", "currency", "find", "clone", "recent", "serve"];
const repoPath = Path.resolve(dataDir, "repos");
const repoDirs = await fs.readdir(repoPath);
repoDirs.forEach((dir) => {
    const path = Path.resolve(repoPath, dir);
    taskIds.forEach((tid) => {
        // taskReportPromises.push(generateReport(id, Path.resolve(repoPath, dir)));
        const repo = new Repository(path);
        const task = new Task(tid, repo);
        const [pid] = Path.basename(path).split("_");

        waits.push(summaryDS(pid, task, summaryReport).catch());
        waits.push(answersDS(pid, task, viewedAnswers).catch());
        waits.push(searchesDS(pid, task, searches).catch());
        waits.push(timingDS(pid, task, timings).catch());
        waits.push(loadDS(pid, task, loadings).catch());
    });
});

await Promise.all(waits);

const csv = summaryReport.map((r) => `${r.pid}|${r.tid}|${r.treated}|${r.succeeded}|${r.duration}|${r.searches}|${r.expands}|${r.examples}|${r.copies}|${r.pages}|${r.links}|${r.answers}|${r.content ? r.content.toFixed(2) : null}|${r.q1}|${r.q2}|${r.q3}|${r.q4}`)
csv.splice(0, 0, "pid|tid|treated|succeeded|duration|searches|expands|examples|copies|pages|links|answers|content|q1|q2|q3|q4");
await fs.writeFile(Path.resolve(dataDir, "task-results.csv"), csv.join("\n"));

const viewedAnswersCSV = viewedAnswers.map((r) => `${r.pid}|${r.tid}|${r.answerId}|${r.seq}|${r.duration}|${r.coverage.toFixed(2)}`);
viewedAnswersCSV.splice(0, 0, "pid|tid|answerId|seq|duration|coverage");
await fs.writeFile(Path.resolve(dataDir, "viewed-answers.csv"), viewedAnswersCSV.join("\n"));

const searchesCsv = searches.map((r) => `${r.pid}|${r.tid}|${r.seq}|${r.time_to_search}|${r.pages}|${r.cxt_used}|${r.cxt_avail}|"${r.cxt.join(";")}"|"${r.terms.join(";")}"|"${r.query}"`);
searchesCsv.splice(0, 0, "pid|tid|seq|tts|pages|cxt_used|cxt_avail|cxt|terms|query");
await fs.writeFile(Path.resolve(dataDir, "searches.csv"), searchesCsv.join("\n"));

// const timingsCsv = timings.map((r)=> `${r.pid},${r.tid},${r.event},${r.offset}`);
// timingsCsv.splice(0,0,"pid,tid,event,offset");
// await fs.writeFile(Path.resolve(dataDir, "timings.csv"), timingsCsv.join("\n"));

const timingsCsv = timings.map((r) => `${r.pid},${r.tid},${r.total},${r.app},${r.page},${r.load},${r.review}`);
timingsCsv.splice(0,0,"pid,tid,total,inApp,inPage,toLoadFir,review");
await fs.writeFile(Path.resolve(dataDir, "timings.csv"), timingsCsv.join("\n"));

const loadingsCsv = loadings.map((r) => `${r.pid},${r.tid},${r.searchSeq},${r.resultSeq},${r.loadSeq},${r.loadTime}`);
loadingsCsv.splice(0,0,"pid,tid,search,result,load,time");
await fs.writeFile(Path.resolve(dataDir,  "loadings.csv"), loadingsCsv.join("\n"));