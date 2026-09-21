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
        const { messages } = body;

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (!openai.apiKey) {
            return new NextResponse("OpenAI API key not configured", { status: 500 });
        }

        if (!messages) {
            return new NextResponse("Messages are required", { status: 400 });
        }

        if (!Array.isArray(messages)) {
            return new NextResponse("Messages must be an array", { status: 400 });
        }

        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages,
        });

        return NextResponse.json(response.choices[0].message);

    } catch (error) {
        console.error("[CONVERSATION_ERROR]", error);

        const status = typeof error === "object" && error !== null && "status" in error
            ? Number(error.status)
            : 500;
        const message = error instanceof Error
            ? error.message
            : "Conversation request failed";

        return NextResponse.json(
            { error: message },
            { status: status >= 400 && status < 600 ? status : 500 }
        );
    }
}