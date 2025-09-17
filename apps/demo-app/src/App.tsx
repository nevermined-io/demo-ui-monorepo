import { Github, MessageCircleMore } from "lucide-react";
import Sidebar from "./components/sidebar";
import { Button } from "./components/ui/button";
import { useState } from "react";
import SimpleAgent from "./components/simple-agent";
import McpAgent from "./components/mcp-agent";
import MultiAgent from "./components/multi-agent";

function App() {
  const [view, setView] = useState<"simple" | "mcp" | "multi">("simple");

  const Title = {
    simple: "Simple",
    mcp: "MCP",
    multi: "Multi-Agent System",
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar setView={setView} view={view} />

      <div className="flex-1 ml-[17.5rem]">
        <div className="flex items-center justify-between px-6 h-[5.5rem] border-b">
          <h1 className="text-2xl font-semibold text-gray-800">
            {Title[view]} Agent
          </h1>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-transparent"
            >
              <Github className="w-4 h-4" />
              Github
            </Button>
            <Button size="sm" className="bg-[#0D3F48]  flex items-center gap-2">
              <MessageCircleMore className="w-4 h-4" />
              View demo
            </Button>
          </div>
        </div>

        {view === "simple" && <SimpleAgent />}

        {view === "mcp" && <McpAgent />}

        {view === "multi" && <MultiAgent />}
      </div>
    </div>
  );
}

export default App;
