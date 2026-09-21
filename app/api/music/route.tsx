import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN
});

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
                { error: "Music generation is not configured." },
                { status: 500 }
            );
        }

        const output = await replicate.run(
            "riffusion/riffusion:8cf61ea6c56afd61d8f5b9ffd14d7c216c0a93844ce2d82ac1c9ecc9c7f24e05",
            { input: { prompt_b: prompt } }
        );

        return NextResponse.json(output);

    } catch (error) {
        const status = typeof error === "object" && error !== null && "status" in error
            ? Number(error.status)
            : 500;

        if (status === 402) {
            return NextResponse.json(
                { error: "Music generation is unavailable because the Replicate account has insufficient credit." },
                { status: 402 }
            );
        }

        console.error("[MUSIC_ERROR]", error);
        return NextResponse.json(
            { error: "Music generation failed. Please try again." },
            { status: 500 }
        );
    }
}