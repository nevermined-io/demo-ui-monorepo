import { Badge } from "./ui/badge"

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
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
          >
            Fiat Payment
          </Badge>
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-800 hover:bg-blue-100"
          >
            Typescript
          </Badge>
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-800 hover:bg-green-100"
          >
            Python
          </Badge>
          <Badge
            variant="secondary"
            className="bg-purple-100 text-purple-800 hover:bg-purple-100"
          >
            Fixed Cost
          </Badge>
          <Badge
            variant="secondary"
            className="bg-orange-100 text-orange-800 hover:bg-orange-100"
          >
            Mcp
          </Badge>
          <Badge
            variant="secondary"
            className="bg-orange-100 text-orange-800 hover:bg-orange-100"
          >
            Observability
          </Badge>
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
