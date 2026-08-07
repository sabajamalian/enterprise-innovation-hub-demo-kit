import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { IdentityError, readIdentity } from "@/lib/identity";

const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(1000),
  area: z.string().trim().min(2).max(80)
});

export async function GET(request: Request) {
  try {
    readIdentity(request.headers);
    return NextResponse.json(await db.workItem.findMany({ orderBy: { createdAt: "desc" } }));
  } catch (error) {
    const status = error instanceof IdentityError ? 403 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actor = readIdentity(request.headers);
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Work item is invalid.", issues: parsed.error.flatten() }, { status: 400 });
    }
    const item = await db.workItem.create({ data: { ...parsed.data, ownerId: actor.id } });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const status = error instanceof IdentityError ? 403 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed." }, { status });
  }
}
