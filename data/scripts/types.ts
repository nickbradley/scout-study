export interface TaskSummaryReport {
    pid: string;
    tid: string;
    /**
     * True for tasks where search results were presented as call signatures.
     */
    treated: boolean | null;
    /**
     * True if **all** the tests pass.
     */
    succeeded: boolean | null;
    /**
     * Milliseconds from the submission of the first search to the task timer stopping.
     */
    duration: number | null;
    /**
     * Number of searches participant made during the task.
     */
    searches: number | null;
    /**
     * Number of signature projections that were expanded during the task.
     */
    expands: number | null;
    /**
     * Number of times participants switched to the example code in call signature projections.
     */
    examples: number | null;
    /**
     * Number of times participants copied text from the **projection** which includes usage examples.
     */
    copies: number | null;
    /**
     * Number of full-page views. 
     */
    pages: number | null;
    /**
     * Number of full pages that were opened from the signature.
     */
    links: number | null;
    /**
     * Number of answers viewed in the full-page view.
     */
    answers: number | null;
    /**
     * The average proportion of content viewed within full pages.
     */
    content: number | null;

    q1: string | null;
    q2: string | null;
    q3: string | null;
    q4: string | null;
}

export type Feedback = {
    Q1: string | null;
    Q2: string | null;
    Q3: string | null;
    Q4: string | null;
}

export type JestReport = any;
export type TrialReport = any;
export type TaskData = any;

export type Block = {
    identifier: string;
    top: number;
    bottom: number;
    right: number;
    left: number;
    width: number;
    height: number;
}

export type ScrollEvent = {
    timestamp: Date;
    viewport: {
        x: number;
        y: number;
        height: number;
        width: number;
    };
    blocks?: Block[];
    answers?: Block[];
    document?: {
        height: number;
        width: number;
    };
    question?: Block;
}


export type ViewedAnswer = {
    answerId: string;
    duration: number | null;
    coverage: number;
    pageUrl: string;
}

export interface TokenPosition {
    start: number;
    end: number;
}  

export interface CodeToken {
    name: string;
    position: TokenPosition | undefined;
    source?: string;
}

export type VariableToken = CodeToken & { type: CodeToken };
export type BoundToken = CodeToken & { type: string, value: any };
export type ImportToken = CodeToken & { module: CodeToken, references: Array<TokenPosition | undefined> };
export type FunctionToken = CodeToken & {
  returnType: string;
  variables: VariableToken[];
  parameters: VariableToken[];
};
export type FunctionCallToken = CodeToken & {
  returnType: string;
  variables: BoundToken[];
  arguments: BoundToken[];
};

export function isImportToken(token: CodeToken): token is ImportToken {
  return typeof (token as any)["module"] === "object";
}

export function isFunctionToken(token: CodeToken): token is FunctionToken {
  return typeof (token as any)["parameters"] === "object";
}

export function isFunctionCallToken(token: CodeToken): token is FunctionCallToken {
  return typeof (token as any)["arguments"] === "object";
}
