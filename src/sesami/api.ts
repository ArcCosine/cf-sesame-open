import { Hono } from "hono";
import { Buffer } from "node:buffer";
import { isAuthed, generateCmacSign } from "../utils";

interface SesamiStatus {
    batteryPercentage: number;
    batteryVoltage: number;
    position: number;
    CHSesame2Status: string;
    timestamp: number;
}

interface CfRequest {
    password: string;
    history: string;
}

const API_ENTRY = "https://app.candyhouse.co/api/sesame2/";

const sesamiRequest = async (
    apiKey: string,
    action: number,
    uuid: string,
    secretKey: string,
    history: string
) => {
    const base64History = Buffer.from(history).toString("base64");
    const sign = await generateCmacSign(secretKey);
    const request = {
        cmd: action,
        history: base64History,
        sign: sign,
    };
    return await fetch(`${API_ENTRY}${uuid}/cmd`, {
        method: "POST",
        headers: {
            "x-api-key": apiKey,
        },
        body: JSON.stringify(request),
    });
};

const isSesamiLocked = async (apiKey: string, uuid: string) => {
    const result = await fetch(`${API_ENTRY}${uuid}`, {
        method: "GET",
        headers: {
            "x-api-key": apiKey,
        },
    });
    const json: SesamiStatus = await result.json();
    return json.CHSesame2Status === "locked";
};

const sesami = new Hono();

sesami.post("/lock", async (c) => {
    if (c.req) {
        const param = await c.req.json<CfRequest>();
        const authed = await isAuthed(param.password, c.env.PASSWORD_DIGEST);
        if (authed) {
            const locked = await isSesamiLocked(c.env.API_KEY, c.env.UUID);
            if (!locked) {
                await sesamiRequest(
                    c.env.API_KEY,
                    82, //lock action
                    c.env.UUID,
                    c.env.SECRET_KEY,
                    param.history
                );
                return c.text("success locked.");
            }
        }
    }
    return c.text("already locked.");
});

sesami.post("/unlock", async (c) => {
    if (c.env) {
        const param = await c.req.json<CfRequest>();
        const authed = await isAuthed(param.password, c.env.PASSWORD_DIGEST);
        if (authed) {
            const locked = await isSesamiLocked(c.env.API_KEY, c.env.UUID);
            if (locked) {
                await sesamiRequest(
                    c.env.API_KEY,
                    83, //unlock action
                    c.env.UUID,
                    c.env.SECRET_KEY,
                    param.history
                );
                return c.text("success unlocked.");
            }
        }
    }
    return c.text("already unlocked.");
});

export { sesami };
