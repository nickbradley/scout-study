import { Page } from "./Page.js";

type Trial = {
    id: "clone"|"currency"|"find"|"sort"|"recent"|"serve";
    enableFragments: boolean,
    enableContext: boolean,
    showContext: boolean,
    /** Eg 
       {
            "source": "src/currency.js",
            "name": "printCurrency",
            "position": {
                "start": 593,
                "end": 782
            },
            "variables": [],
            "parameters": [
                {
                    "source": "src/currency.js",
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
                    "source": "src/currency.js",
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
                    "source": "src/currency.js",
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
        }
     */
    contextOverride: any[],
    /**
     * Whether a suggested search term was offered?
     */
    provideSearchTerms: true,
    /** 
     * The full search that was suggested to participants
     * when provideSearchTerms was set to true.
     */
    searchTerms: string,
    /** Eg "2022-11-23T01:22:51.482Z" */
    startTime: string,
    /** Eg "2022-11-23T01:27:40.433Z" */
    endTime: string,
    /** The timer stop when the participant clicked done.
     * The endTime also includes the time to answer the 
     * post-task questions.
     */
    timer: {
        /** Eg "2022-11-23T01:22:51.483Z" */
        startTime: string,
        /** Eg "2022-11-23T01:24:55.996Z" */
        endTime: string,
    },
    /** milliseconds */
    duration: 122396,
    /** Responses to end-of-task questions */
    data?: {
        /** 1 to 5 */
        Q1: string,
        Q2: string,
        Q3: string,
        Q4: string,
    },
    
};

type Tests = {
    assertionResults: Record<string, any>[],
    endTime: number,
    message: string,
    /** Eg "/workspaces/17380_3/test/find.test.js" */
    name: string,
    /** Eg 1669168203961 */
    startTime: number,
    status: "passed" | "failed",
    summary: string
};

function cleanFeedback(feedback: string | undefined): string {
    if (typeof feedback === "string") {
        return feedback.replace(/\n/g, " ");
    }
    return "";
}

export class Task {
    readonly startTime: Date | null;
    readonly endTime: Date | null;
    readonly duration: number | null;
    constructor(
        readonly id: string,
        readonly pid: string,
        readonly sequence: number,
        readonly soln: string,
        readonly data: any,
        readonly trial: Trial,
        readonly tests: Tests
    ) {
        if (! ["clone", "currency", "find", "sort", "recent", "serve"].includes(this.id)) {
            throw new Error(`Task ID ${this.id} is not valid.`);
        }

        if (trial.data) {
            trial.data.Q1 = cleanFeedback(trial.data.Q1);
            trial.data.Q2 = cleanFeedback(trial.data.Q2);
            trial.data.Q3 = cleanFeedback(trial.data.Q3);
            trial.data.Q4 = cleanFeedback(trial.data.Q4);
        }

        this.startTime = this.trial.timer?.startTime ? new Date(this.trial.timer.startTime) : null;
        this.endTime = this.trial.timer?.endTime ? new Date(this.trial.timer.endTime) : null;
        this.duration = this.startTime && this.endTime ? this.endTime.getTime() - this.startTime.getTime() : null;
    }

    get tid(): number {
        return {
            "clone": 1,
            "sort": 2,
            "find": 3,
            "currency": 4,
            "recent": 5,
            "serve": 6
        }[this.id]!;
    }

    get maxDuration(): number {
        if (["recent", "serve"].includes(this.id)) {
            return 7 * 60 * 1000;
        } else {
            return 6 * 60 * 1000;
        }
    }

    get feedback(): { Q1: string|null; Q2: string|null; Q3: string|null; Q4: string|null} {
        return {
            Q1: this.trial.data?.Q1 ?? null,
            Q2: this.trial.data?.Q2 ?? null,
            Q3: this.trial.data?.Q3 ?? null,
            Q4: this.trial.data?.Q4 ?? null,
        }
    }

    get passed(): boolean {
        return this.tests.status === "passed";
    }

    get searches(): any[] {
        return this.data?.searches ?? [];
    }

    getPages(): Page[] {
        const pageHash = this.searches.reduce((accum, search) => {
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
        return Object.entries(pageHash).map(([url, events]) => new Page(url, events as any[]));
    }
}