import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { increaseApilimit, checkApiLimit } from "@/lib/api-limit";

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

        const  freeTrial = await checkApiLimit();
        if(!freeTrial){
            return new NextResponse("Free trial has expired.",{status:403});
        }

        const { data: existingLimit, error: limitError } = await supabase
            .from("user_limits")
            .select("requests_count, max_limit")
            .eq("id", userId)
            .maybeSingle();
        let limitData = existingLimit;

        if (limitError) {
            console.error("[LIMIT_FETCH_ERROR]", limitError);
            return NextResponse.json(
                { error: "Unable to check usage limit" },
                { status: 500 }
            );
        }

        if (!limitData) {
            const { data: createdLimit, error: createError } = await supabase
                .from("user_limits")
                .insert({ id: userId, requests_count: 0, max_limit: 5 })
                .select("requests_count, max_limit")
                .single();

            if (createError?.code === "23505") {
                const { data: existingLimitAfterRace, error: raceFetchError } = await supabase
                    .from("user_limits")
                    .select("requests_count, max_limit")
                    .eq("id", userId)
                    .single();

                if (raceFetchError || !existingLimitAfterRace) {
                    console.error("[LIMIT_RACE_FETCH_ERROR]", raceFetchError);
                    return NextResponse.json(
                        { error: "Unable to initialize usage limit" },
                        { status: 500 }
                    );
                }

                limitData = existingLimitAfterRace;
            } else if (createError || !createdLimit) {
                console.error("[LIMIT_CREATE_ERROR]", createError);
                return NextResponse.json(
                    { error: "Unable to initialize usage limit" },
                    { status: 500 }
                );
            }

            limitData = createdLimit;
        }

        if (!limitData) {
            return NextResponse.json(
                { error: "Unable to initialize usage limit" },
                { status: 500 }
            );
        }

        const currentCount = limitData.requests_count;

        if (currentCount >= limitData.max_limit) {
            return NextResponse.json(
                { error: "Your daily free limit has been reached! Please try again tomorrow." },
                { status: 403 }
            );
        }

        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages,
        });

        const { data: updatedLimit, error: updateError } = await supabase
            .from("user_limits")
            .update({ requests_count: currentCount + 1 })
            .eq("id", userId)
            .eq("requests_count", currentCount)
            .select("id")
            .maybeSingle();

        if (updateError || !updatedLimit) {
            console.error("[LIMIT_UPDATE_ERROR]", updateError);
            return NextResponse.json(
                { error: "Usage changed while processing this request. Please try again." },
                { status: 409 }
            );
        }

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

        await increaseApilimit();
    }
}
