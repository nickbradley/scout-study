import { SimpleObject } from "./merge.mjs";
import { Task } from "./Task2.js";
import Signature from "./Signature.js";

export function events(task: Task): Array<SimpleObject> {
  return  task.searches
    .flatMap((search, searchSeq) => search.events
      .filter((event)  => ["loaded",  "open", "close", "expand"].includes(event.action) || 
        (event.action === "copy" && event.component  === "projection") ||
        (event.action === "tab" && event.data.name === "code")
      )
      .map(
        (event) => {
          let kind = {
            "loaded": "showProj",
            "open": "openPage",
            "close": "closePage",
            "expand": "openSig",
            "tab": "openCode",
            "copy": "copyProj",
          }[event.action]; 
          if (event.action === "open" && event.component === "page" && event.data) {
            kind = "openLink";
          }

          return {
            pid: task.pid,
            tid: task.tid,
            searchSeq,
            timeFromSearch: new  Date(event.timestamp).getTime() - new Date(search.timestamp).getTime(),
            kind,
            resultUrl: event.url  // not working for copyProj, openSig
        }
      })
    )
}

export function results(task: Task): Array<SimpleObject> {
    return task.searches
    .flatMap((search, searchSeq) => search.results
    .map((result, seq) => {
        const answerLOC = result.signatures.reduce((acc, sig) => {
            if (!acc[sig.answerId]) {
                acc[sig.answerId] = sig.source.split("\n").length;
            }
            return acc;
        }, {});
        return {
            pid: task.pid,
            tid: task.tid,
            searchSeq,
            url: result.url,
            seq,
            answerCount: Object.keys(answerLOC).length,
            loc: Object.values<number>(answerLOC).reduce((sum, loc) => sum += loc, 0),
        }
    })
    )
}


export function tasks(task: Task): SimpleObject {
    return {
        pid: task.pid,
        tid: task.tid,
        seq: task.sequence,
        treatment: task.trial.enableFragments ? "sig"  : "txt",
        // searched: task.data ? true : false,
        outcome: task.passed ? "pass" : "fail",
        duration: task.duration,
        solution: task.soln,
        q1: task.feedback.Q1,
        q2: task.feedback.Q2,
        q3: task.feedback.Q3,
        q4: task.feedback.Q4,
    }
}


const processSearches =  (searches: any[], taskId: string, treated: boolean): any[] => {
    const hadContext = (seq: number) => {
        if (seq === 0) {
            // This should be true for everything except the untreated search task
            return !(["recent", "serve"].includes(taskId) && !treated);
        }
        return treated;
    }
    const getTokens = (search: any, kind?: string) =>
     search.context?.tokens
        .filter((token) => kind ? token.kind === kind : true)
        .map((token) => token.value) ?? [];
    
    return searches.map((search, iter, searches) => {
        const context = getTokens(search);
        const keywords = search.keywords;
        const lang = hadContext(iter) ? getTokens(search, "language") : [];
        const libs = hadContext(iter) ? getTokens(search, "library") : [];
        const calls = hadContext(iter) ? getTokens(search, "call") : [];
        const sites = "site:stackoverflow.com";
        const queryTerms = [...lang, ...libs, ...keywords, ...calls]
            .filter((item, pos, self) => self.indexOf(item) == pos) 

        return {
            timeBetween: iter > 1 ? new Date(search.timestamp).getTime() - new Date(searches[iter-1].timestamp).getTime() : null,
            context: context.join("|"),
            keywords: keywords.join("|"),
            query: queryTerms.join(" ").trim()
        };
    });
}

export function searches(task: Task): Array<{
    pid: string;
    tid: number;
    seq: number;
    timeBetween: number;
    context: string;
    keywords: string;
    query: string;
}> {
    const searches = processSearches(task.searches, task.id, task.trial.enableFragments);
    return searches
    .filter((search, i, searches) => i === 0 || searches[i-1].query !== search.query)
    .map((search, seq) => ({
        pid: task.pid,
        tid: task.tid,
        seq,
        ...search 
    }));
}

export async function timing(task: Task): Promise<Record<string, any>> {
    // const taskStart = (await task.getStartTime())?.getTime();
    // const taskEnd = (await task.getEndtime())?.getTime();
    const duration = task.duration;
    // if (duration && duration > task.maxDuration) {
    //     console.warn("Task time exceeded allotted by ", duration - task.maxDuration);
    // }
    const searches = task.searches;
    
    let firstResultTime;
    let engagements = 0;

    let timeInApp = 0;
    let timeInPage = 0;
    let timeLoadingFirst = 0;
    let timeLoadingLast = 0;
    let firstEngagementTime = 0;
    searches?.forEach((search) => {
        if (search.events.length === 0) {
            return;
        }
        const searchTime = new Date(search.timestamp).getTime();
        const firstEventTimestamp = search.events[0].timestamp;
        const lastEventTimestamp = search.events[search.events.length - 1].timestamp;
        timeInApp += new Date(lastEventTimestamp).getTime() - new Date(firstEventTimestamp).getTime(); 

        search.events.forEach((event, i, events) => {
            if (event.component === "projection" && event.action === "loaded") {
                const loadTime = new Date(event.timestamp).getTime()
                if (timeLoadingFirst === 0) {
                    timeLoadingFirst = loadTime - searchTime;
                    firstResultTime = loadTime;
                }
                timeLoadingLast = loadTime - searchTime;
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

    return {
        pid: task.pid,
        tid: task.tid,
        onTask: duration, //? Math.min(duration, task.maxDuration) : null,
        inApp: timeInApp,
        inPage: timeInPage,
        toLoadFirst: timeLoadingFirst,
        toLoadLast: timeLoadingLast,
        toOpen: firstEngagementTime,
    };
}

const getRecommendations = (signatures, taskId) => {
    const recommendations = {};
    const maxVotes = Math.max(...signatures.map((s) => s.voteCount));
    const latestAnswer = new Date(
      Math.max(...signatures.map((s) => s.lastModified))
    );

    const baseContext = {
        clone: [
            {
                "source": "/home/ncbradley/Sync/scout-task-template/src/clone.js",
                "name": "trades",
                "position": {
                    "start": 301,
                    "end": 307
                },
                "type": {
                    "name": "any[]"
                }
            }
        ],
        currency: [{
            "source": "/home/ncbradley/Sync/scout-task-template/src/currency.js",
            "name": "printCurrency",
            "position": {
                "start": 593,
                "end": 782
            },
            "variables": [],
            "parameters": [
                {
                    "source": "/home/ncbradley/Sync/scout-task-template/src/currency.js",
                    "name": "amount",
                    "position": {
                        "start": 623,
                        "end": 629
                    },
                    "type": {
                        "name": "number"
                    }
                },
                {
                    "source": "/home/ncbradley/Sync/scout-task-template/src/currency.js",
                    "name": "locale",
                    "position": {
                        "start": 631,
                        "end": 637
                    },
                    "type": {
                        "name": "string"
                    }
                },
                {
                    "source": "/home/ncbradley/Sync/scout-task-template/src/currency.js",
                    "name": "currency",
                    "position": {
                        "start": 639,
                        "end": 647
                    },
                    "type": {
                        "name": "string"
                    }
                }
            ],
            "returnType": "string"
        }],
        find: [
            {
                "source": "/home/ncbradley/Sync/scout-task-template/src/find.js",
                "name": "getTradeById",
                "position": {
                    "start": 325,
                    "end": 549
                },
                "variables": [],
                "parameters": [
                    {
                        "source": "/home/ncbradley/Sync/scout-task-template/src/find.js",
                        "name": "trades",
                        "position": {
                            "start": 354,
                            "end": 360
                        },
                        "type": {
                            "name": "any[]"
                        }
                    },
                    {
                        "source": "/home/ncbradley/Sync/scout-task-template/src/find.js",
                        "name": "id",
                        "position": {
                            "start": 362,
                            "end": 364
                        },
                        "type": {
                            "name": "number"
                        }
                    }
                ],
                "returnType": "any"
            }
        ],
        sort: [
            {
                "source": "/home/ncbradley/Sync/scout-task-template/src/sort.js",
                "name": "sortTradesByShareCount",
                "position": {
                    "start": 318,
                    "end": 557
                },
                "variables": [],
                "parameters": [
                    {
                        "source": "/home/ncbradley/Sync/scout-task-template/src/sort.js",
                        "name": "trades",
                        "position": {
                            "start": 357,
                            "end": 363
                        },
                        "type": {
                            "name": "any[]"
                        }
                    }
                ],
                "returnType": "any[]"
            }
        ],
        recent: [
            {
                "source": "/home/ncbradley/Sync/scout-task-template/src/recent.js",
                "name": "moment",
                "position": {
                    "start": 7,
                    "end": 13
                },
                "module": {
                    "name": "moment",
                    "position": {
                        "start": 19,
                        "end": 27
                    }
                },
                "references": [
                    {
                        "start": 738,
                        "end": 744
                    },
                    {
                        "start": 820,
                        "end": 826
                    },
                    {
                        "start": 888,
                        "end": 894
                    },
                    {
                        "start": 907,
                        "end": 913
                    }
                ]
            },
            {
                "source": "/home/ncbradley/Sync/scout-task-template/src/recent.js",
                "name": "moment",
                "position": {
                    "start": 738,
                    "end": 753
                },
                "variables": [],
                "arguments": [
                    {
                        "source": "/home/ncbradley/Sync/scout-task-template/src/recent.js",
                        "name": "",
                        "type": "Date",
                        "value": "endDate",
                        "position": {
                            "start": 745,
                            "end": 752
                        }
                    }
                ],
                "returnType": "any"
            },
            {
                "source": "/home/ncbradley/Sync/scout-task-template/src/recent.js",
                "name": "moment",
                "position": {
                    "start": 820,
                    "end": 838
                },
                "variables": [],
                "arguments": [
                    {
                        "source": "/home/ncbradley/Sync/scout-task-template/src/recent.js",
                        "name": "",
                        "type": "any",
                        "value": "trade.date",
                        "position": {
                            "start": 827,
                            "end": 837
                        }
                    }
                ],
                "returnType": "any"
            },
            {
                "source": "/home/ncbradley/Sync/scout-task-template/src/recent.js",
                "name": "moment",
                "position": {
                    "start": 888,
                    "end": 905
                },
                "variables": [],
                "arguments": [
                    {
                        "source": "/home/ncbradley/Sync/scout-task-template/src/recent.js",
                        "name": "",
                        "type": "any",
                        "value": "startDate",
                        "position": {
                            "start": 895,
                            "end": 904
                        }
                    }
                ],
                "returnType": "any"
            },
            {
                "source": "/home/ncbradley/Sync/scout-task-template/src/recent.js",
                "name": "moment",
                "position": {
                    "start": 907,
                    "end": 922
                },
                "variables": [],
                "arguments": [
                    {
                        "source": "/home/ncbradley/Sync/scout-task-template/src/recent.js",
                        "name": "",
                        "type": "Date",
                        "value": "endDate",
                        "position": {
                            "start": 914,
                            "end": 921
                        }
                    }
                ],
                "returnType": "any"
            },
            {
                "source": "/home/ncbradley/Sync/scout-task-template/src/recent.js",
                "name": "getPastTradesFrom",
                "position": {
                    "start": 433,
                    "end": 960
                },
                "variables": [
                    {
                        "source": "/home/ncbradley/Sync/scout-task-template/src/recent.js",
                        "name": "endDate",
                        "position": {
                            "start": 512,
                            "end": 532
                        },
                        "type": {
                            "name": "Date"
                        }
                    },
                    {
                        "source": "/home/ncbradley/Sync/scout-task-template/src/recent.js",
                        "name": "startDate",
                        "position": {
                            "start": 726,
                            "end": 753
                        },
                        "type": {
                            "name": "any"
                        }
                    }
                ],
                "parameters": [
                    {
                        "source": "/home/ncbradley/Sync/scout-task-template/src/recent.js",
                        "name": "trades",
                        "position": {
                            "start": 467,
                            "end": 473
                        },
                        "type": {
                            "name": "any[]"
                        }
                    },
                    {
                        "source": "/home/ncbradley/Sync/scout-task-template/src/recent.js",
                        "name": "interval",
                        "position": {
                            "start": 475,
                            "end": 483
                        },
                        "type": {
                            "name": "any"
                        }
                    },
                    {
                        "source": "/home/ncbradley/Sync/scout-task-template/src/recent.js",
                        "name": "unit",
                        "position": {
                            "start": 485,
                            "end": 498
                        },
                        "type": {
                            "name": "string"
                        }
                    }
                ],
                "returnType": "any[]"
            }
        ],
        serve: [
            {
                "source": "/home/ncbradley/Sync/scout-task-template/src/serve.js",
                "name": "express",
                "position": {
                    "start": 7,
                    "end": 14
                },
                "module": {
                    "name": "express",
                    "position": {
                        "start": 20,
                        "end": 29
                    }
                },
                "references": [
                    {
                        "start": 181,
                        "end": 188
                    }
                ]
            },
            {
                "source": "/home/ncbradley/Sync/scout-task-template/src/serve.js",
                "name": "path",
                "position": {
                    "start": 38,
                    "end": 42
                },
                "module": {
                    "name": "path",
                    "position": {
                        "start": 48,
                        "end": 54
                    }
                },
                "references": []
            },
            {
                "source": "/home/ncbradley/Sync/scout-task-template/src/serve.js",
                "name": "setup",
                "position": {
                    "start": 193,
                    "end": 296
                },
                "variables": [],
                "parameters": [],
                "returnType": "void"
            }
        ]
    }

    const codeTokens = baseContext[taskId];

    // Compute metrics for the signatures:
    // - Count matching signatures only once for each answer (but record all instances as examples)
    // - Mark signatures from accepted, latest, and most upvoted answers
    for (const sig of signatures) {
        sig["lastModified"] = new Date(sig["lastModified"]);
      const signature = new Signature(
        sig.name,
        sig.arguments,
        sig.returnType,
        sig.parentType
      );
      const support = signature.getIntegrationContext(codeTokens);
    //   {
    //     parentTypes: [],
    //     parameterTypes: [],
    //     returnTypes: [],
    //   };//signature.getIntegrationContext(codeTokens);
      const key = `${sig.text}`;
      if (!Object.prototype.hasOwnProperty.call(recommendations, key)) {
        recommendations[key] = {
          text: sig.text,
          name: sig.name,
          arguments: sig.arguments,
          returnType: sig.returnType,
          parentType: sig.parentType,
          signature,
          integration: support,
          examples: [],
          metrics: {
            occurrences:
              // hack to show tutorial result in nice order for screenshot
              sig.text === "T[].reduce(function, U): U" ? 1000 : 0,
            keywordDensity: sig.answerKeywords.length / sig.answerWordCount,
            typeOverlap:
              support.parentTypes.length +
              support.parameterTypes.reduce(
                (prev, curr) => prev + curr.length,
                0
              ) +
              support.returnTypes.length,
            isFromAcceptedAnswer: false,
            isFromPopularAnswer: false,
            isFromLatestAnswer: false,
          },
        };
      }
      const rec = recommendations[key];
      if (rec.examples.findIndex((ex) => ex.answerId === sig.answerId) === -1) {
        // this is the first time seeing the call signature in the answer
        rec.metrics.occurrences++;
        rec.metrics.isFromAcceptedAnswer =
          rec.metrics.isFromAcceptedAnswer || sig.isAccepted;
        rec.metrics.isFromPopularAnswer =
          rec.metrics.isFromPopularAnswer || sig.voteCount === maxVotes;
        rec.metrics.isFromLatestAnswer =
          rec.metrics.isFromLatestAnswer ||
          sig.lastModified?.getTime() === latestAnswer.getTime();
      }
      rec.examples.push({
        answerId: sig.answerId,
        answerUrl: sig.answerUrl,
        postUrl: sig.postUrl,
        call: sig.usage,
        declaration: sig.definition,
        text: (sig.definition ? sig.definition + "\n\n" : "") + sig.usage,
        source: sig.source,
      });
    }

    return Object.values<any>(recommendations)
      .sort((a, b) => {
        if (a.metrics.occurrences === b.metrics.occurrences) {
          if (a.metrics.isFromAcceptedAnswer) {
            return -1;
          } else if (b.metrics.isFromAcceptedAnswer) {
            return 1;
          }

          if (a.metrics.isFromPopularAnswer) {
            return -1;
          } else if (b.metrics.isFromPopularAnswer) {
            return 1;
          }

          if (a.metrics.isFromLatestAnswer) {
            return -1;
          } else if (b.metrics.isFromLatestAnswer) {
            return 1;
          }
        }

        return b.metrics.occurrences - a.metrics.occurrences;
      })
      .slice(0, 10)
      .sort((a, b) => 
        b.typeOverlap - a.typeOverlap
      );
  }






export function signatures(task: Task): Array<{
  pid: number;
  tid: number;
  searchSeq: number;
  resultRank: number;
  rank: number;
  text: string;
}> {
    return task.searches.flatMap(
        (search, i) => search.results.flatMap(
            (result, j) => {
                return getRecommendations(result.signatures, task.id).map(
                (sig, k) => ({
                    pid: task.pid,
                    tid: task.tid,
                    searchSeq: i,
                    resultRank: j,
                    cnt: result.signatures.length,
                    rank: k,
                    text: sig.text,
                })
            )
            }
        )
    );
}

export function listSignatures(task: Task): Array<{
    pid: string;
    tid: number;
    searchSeq: number;
    rank: number;
    text: string;
}> {
    return task.searches.flatMap(
        (search, searchSeq) => {
            const allSignatures = search.results.flatMap(
                (result) => result.signatures
            );
            return getRecommendations(allSignatures, task.id)
            .slice(0, 10)
            .map((sig, rank) => ({
                pid: task.pid,
                tid: task.tid,
                searchSeq,
                rank,
                text: sig.text
            }))
        }
    );
}

export async function rankings(task: Task): Promise<Array<Record<string, any>>> {
    return task.searches.map(
        (search, i) => {
            const lastOpen = search.events.slice().reverse().find((e) => ["open", "expand"].includes(e.action));
            return {
                pid: task.pid,
                tid: task.tid,
                searchSeq: i,
                rank: search.results.findIndex((r) => r.url === lastOpen?.url),
                url: lastOpen?.url,
            };
        }
    )
}

export async function expands(task: Task): Promise<Array<Record<string, any>>> {
    return task.searches.flatMap(
        (search, i) => search.events.filter(
            (e) => e.action === "expand"
        ).map(
            (e, j) => {
                const resultSeq = search.results.findIndex((r) => r.url === e.url)
                return {
                    pid: task.pid,
                    tid: task.tid,
                    expandSeq: j,
                    searchSeq: i,
                    resultSeq,
                    signature: e.data,
                }
        })
    )
}

export async function answers(task: Task): Promise<Array<Record<string, any>>> {
    return task.getPages()?.flatMap((page) => page.getViewedAnswers())
    .map((answer) => ({
        pid: task.pid,
        tid: task.tid,
        url: answer.pageUrl,
        answerId: answer.answerId,
        duration: answer.duration,
        coverage: answer.coverage,
    }));

}