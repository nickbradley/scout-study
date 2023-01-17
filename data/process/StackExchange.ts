import https from "https";
import zlib from "zlib";

function fetchSE(path: string): Promise<any> {
    const baseUrl = "https://api.stackexchange.com/2.3"
    return new Promise<string>((resolve, reject) => {
        let buffer: any[] = [];
        const req = https.get(`${baseUrl}/${path}`, {
            headers: {
                "Accept-Encoding": "gzip"
            }
        }, (res) => {
            if (res.headers["content-encoding"] !== "gzip") {
                reject("Responded with unreadable data.");
            }
            const zip = zlib.createGunzip();
            res.pipe(zip);
            zip.on("data", (chunk) => {
                buffer.push(chunk.toString());
            }).on("end", () => {
                try {
                    resolve(JSON.parse(buffer.join("")));
                } catch (err) {
                    reject(err);
                }
                
            }).on("error", (err) => {
                reject(err);
            })
    
        }).on("error", (error) => {
            reject(error);
        });
        req.end();
    });
}

export function fetchQuestions(ids: string[]): Promise<any[]> {
    const path = `questions/${ids.join(";")}/answers?site=stackoverflow`;
    return fetchSE(path);
}

export async function fetchAnswers(ids: string[]): Promise<any[]> {
    const path = `answers/${ids.join(";")}?pagesize=100&site=stackoverflow&filter=withbody`;
    const res = await fetchSE(path);
    return res.items;
}

