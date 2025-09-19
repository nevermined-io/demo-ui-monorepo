import { CloudSunRain, WalletCards } from "lucide-react"

type View = "simple" | "mcp"

interface Props {
  view: View
  setView: (view: View) => void
}

const Sidebar = ({ setView, view }: Props) => {
  return (
    <div className="w-64 bg-[#0D3F48] text-white p-6 flex flex-col fixed top-0 left-0 min-h-screen">
      {/* Logo */}

      <img src="/pattern.png" className="h-72 w-40 top-0 right-0 absolute" />

      <div className="flex items-center gap-2 mb-8  ">
        <img src="/logo.svg" />
      </div>

      {/* Navigation */}
      <div className="space-y-2 mt-12">
        <h3 className="text-sm font-medium mb-4 ml-3 bg-gradient-to-r from-limeCustom to-mintCustom bg-clip-text text-transparent">
          Example applications
        </h3>

        <div className="space-y-1">
          <div
            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
              view === "simple" && "bg-sidebar-active-bg"
            }`}
            onClick={() => setView("simple")}
          >
            <WalletCards className="w-4 h-4" />
            <span className="text-sm">Simple Agent</span>
          </div>

          <div
            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
              view === "mcp" && "bg-sidebar-active-bg"
            }`}
            onClick={() => setView("mcp")}
          >
            <CloudSunRain className="w-4 h-4" />
            <span className="text-sm">MCP Agent</span>
          </div>

          {/* <div
            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
              view === "multi" && "bg-sidebar-active-bg"
            }`}
            onClick={() => setView("multi")}
          >
            <Youtube className="w-4 h-4" />
            <span className="text-sm">Multi-Agent System</span>
          </div> */}
        </div>
      </div>
    </div>
  )
}

export default Sidebar
