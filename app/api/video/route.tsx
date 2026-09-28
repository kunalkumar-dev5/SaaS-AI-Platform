import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Replicate from "replicate";
import { increaseApilimit, checkApiLimit } from "@/lib/api-limit";

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
    useFileOutput: false,
});

function normalizeVideoUrls(output: unknown): string[] {
    if (typeof output === "string") {
        return [output];
    }

    if (Array.isArray(output)) {
        return output
            .map((item) => {
                if (typeof item === "string") {
                    return item;
                }

                if (item && typeof item === "object") {
                    const record = item as Record<string, unknown>;

                    if (typeof record.url === "string") {
                        return record.url;
                    }

                    if (typeof record.url === "function") {
                        try {
                            return String(record.url.call(item));
                        } catch {
                            return undefined;
                        }
                    }

                    if ("output" in record) {
                        return normalizeVideoUrls(record.output)[0];
                    }
                }

                return undefined;
            })
            .filter((item): item is string => Boolean(item));
    }

    if (output && typeof output === "object") {
        const record = output as Record<string, unknown>;

        if (typeof record.url === "string") {
            return [record.url];
        }

        if (typeof record.url === "function") {
            try {
                return [String(record.url.call(output))];
            } catch {
                return [];
            }
        }

        if (Array.isArray(record.output)) {
            return normalizeVideoUrls(record.output);
        }

        if (record.output && typeof record.output === "object") {
            return normalizeVideoUrls(record.output);
        }
    }

    return [];
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        const body = await req.json();
        const { prompt } = body;

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (!prompt) {
            return new NextResponse("Prompt is required", { status: 400 });
        }

        if (!process.env.REPLICATE_API_TOKEN) {
            return NextResponse.json(
                { error: "Video generation is not configured. Add REPLICATE_API_TOKEN in your .env.local file and restart the app." },
                { status: 500 }
            );
        }

        const output = await replicate.run(
            "anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351",
            { input: { prompt } }
        );

        const videoUrls = normalizeVideoUrls(output);

        if (videoUrls.length === 0) {
            return NextResponse.json(
                { error: "Video generation returned no output." },
                { status: 502 }
            );
        }

        return NextResponse.json(videoUrls);

    } catch (error) {
        const status = typeof error === "object" && error !== null && "status" in error
            ? Number(error.status)
            : 500;

        if (status === 402) {
            return NextResponse.json(
                { error: "Video generation is unavailable because the Replicate account has insufficient credit." },
                { status: 402 }
            );
        }

        console.error("[VIDEO_ERROR]", error);
        return NextResponse.json(
            { error: "Video generation failed. Please try again." },
            { status: 500 }
        );
    }
}