import { access } from "fs-extra";
import { ScrollEvent, ViewedAnswer } from "./types.js";

export class Page {
    constructor(readonly url: string, readonly events: any[]) {}

    getScrollPositions(): ScrollEvent[] {
        return this.events.filter((event) => event.action === "scroll").map((event) => ({...event.data, timestamp: event.timestamp}));
    } 

    getViewedAnswers(): ViewedAnswer[] {
        // The question that shows implicitly when opening a SO
        const implicitAnswer = this.events
        .filter((event) => event.action === "open" && !event.data?.startsWith("#answer"))
        .map((event) => ({
            identifier: event.url.substring(36, event.url.indexOf("/", 36)),
            viewportCoverage: 1,
            timestamp: event.timestamp
        }));

        // The answer automatically opened when clicking on the call signature projection
        const directAnswer = this.events.filter((event) => event.action === "open" && event.data?.startsWith("#answer"))
        .map((event) => ({
            identifier: event.data.substring(8),
            viewportCoverage: 1,
            timestamp: event.timestamp
        }));

        // Answers scrolled through by the user
        const scrolledAnswers = this.getScrollPositions().map((scroll, i) => {
            const viewport = scroll.viewport;
            const vt = viewport.y;
            const vb = vt + viewport.height;
            const question = scroll.question;
            const answers = scroll.answers || scroll.blocks;
 
            const visibleAnswers = answers!.map((answer) => {
                const at = Math.min(Math.max(vt, answer.top + vt), vb);
                const ab = Math.max(Math.min(vb, answer.bottom + vt), vt);
                return {
                    url: this.url,
                    ...answer,
                    viewportCoverage: (ab - at) / viewport.height,
                    timestamp: scroll.timestamp
                }
            });
            if (question) {
                const qt = Math.min(Math.max(vt, question.top + vt), vb);
                const qb = Math.max(Math.min(vb, question.bottom + vt), vt);
                visibleAnswers.push({ 
                    url: this.url,
                    ...question, 
                    viewportCoverage: (qb - qt) / viewport.height,
                    timestamp: scroll.timestamp
                })
            }

            return visibleAnswers.sort((a, b) => b.viewportCoverage - a.viewportCoverage)[0];
        });

        const viewedAnswers = [...implicitAnswer, ...directAnswer, ...scrolledAnswers]
        .filter((answer) => answer && answer.viewportCoverage > 0.5)
        .map((answer, idx, answers) => ({
            answerId: answer.identifier,
            coverage: answer.viewportCoverage,
            duration: idx > 0 ? new Date(answer.timestamp).getTime() - new Date(answers[idx-1].timestamp).getTime(): null,
            pageUrl: this.url,
        }))
        .reduce((acc, curr) => {
            const key = curr.answerId;
            if (acc[key]) {
                acc[key].duration += curr.duration;
            } else {
                acc[key] = curr;
            }
            return acc;
        }, {});
        // Reduce keeping sequence
        // .reduce((prev, curr, idx) => {
        //     if (idx >= 1 && prev[prev.length-1].answerId === curr.answerId) {
        //         prev[prev.length-1].duration! += curr.duration  || 0;
        //     } else {
        //         prev.push(curr);
        //     }
        //     return prev;
        // }, [] as ViewedAnswer[])
        return Object.values<ViewedAnswer>(viewedAnswers)
        .filter((answer) => answer.duration === null || answer.duration > 1000)

        // return viewedAnswers;
    }

    getProportionViewed(): number {
        const scrolls = this.getScrollPositions();
        if (!scrolls || scrolls.length == 0) {
            return 0;
        }
        const scroll = scrolls[0];

        // Total page height can be computed by summing all (answer) block heights in 
        // a _single_ scroll event. Note: the actual page height depends on the width
        // of the viewport. If Scout is resized, the page height will change between
        // scroll events. This would mostly be a problem when resizing from a wide
        // window to a narrow window since visible content would be pushed out of the
        // viewport. However, the difference should be relatively small and I'm just
        // ignoring it.  
        // page height
        let ph = 0;
        if (scroll.document) {
            ph = scroll.document?.height
        } else {
            const answerBlocks = scroll.answers || scroll.blocks;
            ph = answerBlocks!.reduce((sum, block) => sum + block.height, scroll.question?.height || 0);
        }
        
        // the scroll positions of the top of the viewport 
        const vys = scrolls.map((scroll) => scroll.viewport.y);
        // the height of the viewport at each scroll (they will likely be all the same)
        const vhs = scrolls.map((scroll) => scroll.viewport.height);
        const vhMax = Math.max(...vhs); 
        const vyMin = Math.min(...vys); // the topmost part of the page scrolled to
        const vyMax = Math.max(...vys) + vhMax; // the bottommost part of the page scrolled to

        // Since ph only includes blocks, it is possible
        // to scroll beyond the computed page height.
        return Math.min(1, (vyMax - vyMin) / ph);
    }
}