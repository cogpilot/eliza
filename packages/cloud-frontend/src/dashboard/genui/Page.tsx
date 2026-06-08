import { useEffect, useRef } from "react";
import { CanvasLayout } from "@/components/canvas";
import { useCanvasStore } from "@/lib/stores/canvas-store";

export default function GenUiPage() {
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const store = useCanvasStore.getState();
    store.setGenuiMode(true);
    store.setAssistantOpen(true);
    store.setActiveSpec(null);
    return () => {
      store.setGenuiMode(false);
      store.setGenuiSpec(null);
    };
  }, []);

  return <CanvasLayout />;
}
