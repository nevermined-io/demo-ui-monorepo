import { Github, MessageCircleMore } from "lucide-react"
import Sidebar from "./components/sidebar"
import { Button } from "./components/ui/button"
import { useState } from "react"
import SimpleAgent from "./components/simple-agent"
import McpAgent from "./components/mcp-agent"

function App() {
  const [view, setView] = useState<"simple" | "mcp">("simple")

  const Title = {
    simple: "Simple",
    mcp: "MCP",
    // multi: "Multi-Agent System",
  }

  const Links = {
    simple: "/simple-agent/",
    mcp: "/mcp-agent/",
    // multi: "/",
  }

  const GithubLinks = {
    simple:
      "https://github.com/nevermined-io/tutorials/tree/main/" +
      "financial-agent",
    mcp:
      "https://github.com/nevermined-io/tutorials/tree/main/mcp-examples/" +
      "weather-mcp",
    // multi: "/",
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar setView={setView} view={view} />

      <div className="flex-1 ml-64">
        <div className="flex items-center justify-between px-6 h-20 border-b">
          <h1 className="text-2xl font-semibold text-gray-800">
            {Title[view]} Agent.
          </h1>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-transparent"
              asChild
            >
              <a
                href={GithubLinks[view]}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Github className="w-4 h-4" />
                Github
              </a>
            </Button>
            <Button
              size="sm"
              className="bg-[#0D3F48] flex items-center gap-2"
              asChild
            >
              <a href={Links[view]} rel="noopener noreferrer" target="_blank">
                <MessageCircleMore className="w-4 h-4" />
                View demo
              </a>
            </Button>
          </div>
        </div>

        {view === "simple" && <SimpleAgent />}

        {view === "mcp" && <McpAgent />}

        {/* {view === "multi" && <MultiAgent />} */}
      </div>
    </div>
  )
}

export default App
