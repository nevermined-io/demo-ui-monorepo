import { Badge } from "./ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip"

const badges = [
  {
    label: "Fiat Payment",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    tooltip:
      "the payment of the Plan is done in Fiat (USD) via Stripe integration",
  },
  {
    label: "Typescript",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    tooltip: "the example is implemented using Typescript",
  },
  {
    label: "Python",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
    tooltip: "the example is implemented using Python",
  },
  {
    label: "Fixed Cost",
    className: "bg-purple-100 text-purple-800 hover:bg-purple-100",
    tooltip:
      "the cost resulting for each request sent to the AI Agent is fixed (i.e $0.01)",
  },
  {
    label: "Mcp",
    className: "bg-pink-100 text-pink-800 hover:bg-pink-100",
    tooltip:
      "the AI Agent of the example is implemented using Model Context Protocol (MCP)",
  },
  {
    label: "Observability",
    className: "bg-orange-100 text-orange-800 hover:bg-orange-100",
    tooltip:
      "the AI Agent tracks all the internal requests sent to the LLMs used for further analysis",
  },
]

const McpAgent = () => {
  return (
    <div className="p-12">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">
            Example - MCP Weather Agent
          </h2>
          <p className="text-gray-600 mb-4 text-sm">
            An agent connected through Model Context Protocol (MCP) to deliver
            real-time weather <br /> updates and forecasts, illustrating
            seamless pay-per-query access.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 max-w-72">
          <TooltipProvider>
            <div className="flex flex-wrap gap-2 max-w-[250px]">
              {badges.map(({ label, className, tooltip }) => (
                <Tooltip key={label}>
                  <TooltipTrigger asChild className="cursor-pointer">
                    <Badge className={className}>{label}</Badge>
                  </TooltipTrigger>
                  <TooltipContent className="bg-nvmGreen text-white max-w-60">
                    <p>{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </div>

        {/* Tags */}
      </div>

      <img src="/mcp.png" alt="" />

      <div>
        <h3 className="text-lg font-semibold mt-4 mb-2">Step-by-step flow</h3>
        <ol className="space-y-1 text-sm">
          <li>
            <span className="font-medium">1.</span> User opens the Weather UI
            and requests a forecast for a specific location
          </li>
          <li>
            <span className="font-medium">2.</span> The UI verifies if the user
            is a subscriber, and if missing, redirects to checkout
          </li>
          <li>
            <span className="font-medium">3.</span> User pays by card and
            receives credits
          </li>
          <li>
            <span className="font-medium">4.</span> User returns to the Weather
            UI
          </li>
          <li>
            <span className="font-medium">5.</span> UI confirms credits and
            forwards the prompt to the Weather MCP
          </li>
          <li>
            <span className="font-medium">6.</span> MCP validates the request
            with NVM, processes it, and redeems credits
          </li>
          <li>
            <span className="font-medium">7.</span> Forecast is returned to the
            user
          </li>
        </ol>
      </div>
    </div>
  )
}

export default McpAgent
