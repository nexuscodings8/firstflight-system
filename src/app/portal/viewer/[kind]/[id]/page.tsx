import { ViewerPage } from "@/components/viewer-page";

export const metadata = { title: "View file" };

export default function Viewer({ params }: { params: Promise<{ kind: string; id: string }> }) {
  return <ViewerPage params={params} area="portal" />;
}
