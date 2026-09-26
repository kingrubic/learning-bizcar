import { NextResponse } from "next/server";
import { deleteLearnerAccount } from "@/lib/admin-actions";
import { getSession } from "@/lib/auth";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const { id } = await context.params;
  const result = await deleteLearnerAccount(Number(id));
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
