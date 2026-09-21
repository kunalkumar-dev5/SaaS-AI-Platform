import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        const body = await req.json();
        const { prompt, amount = 1, resolution = "512x512" } = body;

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (!openai.apiKey) {
            return new NextResponse("OpenAI API key not configured", { status: 500 });
        }

        if (!prompt) {
            return new NextResponse("Prompt  is required", { status: 400 });
        }
        
        const parsedAmount = Number.parseInt(String(amount), 10);

        if (!Number.isInteger(parsedAmount) || parsedAmount < 1 || parsedAmount > 4) {
            return new NextResponse("Amount is required", { status: 400 });
        }
        
        if (!resolution) {
            return new NextResponse("Resolution is required", { status: 400 });
        }

        const allowedResolutions = ["256x256", "512x512", "1024x1024"];
        if (!allowedResolutions.includes(resolution)) {
            return new NextResponse("Invalid resolution", { status: 400 });
        }

        const response = await openai.images.generate({
            prompt,
            n: parsedAmount,
            size: resolution,
            model: "dall-e-2",
        });

        return NextResponse.json(response.data ?? []);

    } catch (error) {
        console.error("[IMAGE_ERROR]", error);

        const status = typeof error === "object" && error !== null && "status" in error
            ? Number(error.status)
            : 500;
        const message = error instanceof Error
            ? error.message
            : "Image generation failed";

        return NextResponse.json(
            { error: message },
            { status: status >= 400 && status < 600 ? status : 500 }
        );
    }
}