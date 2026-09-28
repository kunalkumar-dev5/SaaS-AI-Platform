import { auth } from "@clerk/nextjs/server";

import { supabase } from "@/lib/supabase";

import { MAX_FREE_COUNTS } from "@/constants";

export const increaseApilimit = async () => {
    const { userId } = await auth();

    if (!userId) {
        return;
    }

    const { data: userApiLimit } = await supabase
        .from("userApiLimit")
        .select("count")
        .eq("userId", userId)
        .maybeSingle();

    if (userApiLimit) {
        await supabase
            .from("userApiLimit")
            .update({ count: userApiLimit.count + 1 })
            .eq("userId", userId);
    } else {
        await supabase.from("userApiLimit").insert({ userId, count: 1 });
    }
};

export const checkApiLimit = async () => {
    const { userId } = await auth();

    if (!userId) {
        return false;
    }

    const { data: userApiLimit } = await supabase
        .from("userApiLimit")
        .select("count")
        .eq("userId", userId)
        .maybeSingle();

    return !userApiLimit || userApiLimit.count < MAX_FREE_COUNTS;
};