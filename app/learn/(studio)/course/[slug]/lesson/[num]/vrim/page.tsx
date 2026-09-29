import { VrimStudio } from "@/components/learning/VrimStudio";
import { requireVrim } from "@/lib/vrim-open";
import { VRIM, vrimFilePath } from "@/lib/vrim-studio";

export default async function VrimPage({ params }: { params: Promise<{ slug: string; num: string }> }) {
  const { slug, num } = await params;
  const gate = await requireVrim(slug, num);
  return <VrimStudio src={vrimFilePath()} backHref={gate.backHref} label={VRIM.label} />;
}

export const dynamic = "force-dynamic";
