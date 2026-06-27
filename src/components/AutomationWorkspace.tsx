// src/components/AutomationWorkspace.tsx
import React from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import FlowEditor from "./automation/FlowEditor";

export default function AutomationWorkspace({ sessionId }: { sessionId: string }) {
  return (
    <div className="h-full w-full flex-1 overflow-hidden bg-[#141414]">
      <ReactFlowProvider>
        <FlowEditor sessionId={sessionId} />
      </ReactFlowProvider>
    </div>
  );
}