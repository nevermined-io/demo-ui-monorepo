import { Badge } from "@app/ui-core"

const MultiAgent = () => {
  return (
    <div className="p-12">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">
            Example - Multi-Agent Video Orchestrator
          </h2>
          <p className="text-gray-600 mb-4 text-sm">
            A coordinating agent that scripts, edits, and composes video outputs
            by <br /> directing specialized video-generation and
            script-generation agents, <br /> demonstrating complex multi-agent
            workflows with usage-based settlement.
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 max-w-[450px]">
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
          >
            Python
          </Badge>
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
          >
            Multi Agent
          </Badge>
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
            Crypto Payment
          </Badge>
          <Badge
            variant="secondary"
            className="bg-purple-100 text-purple-800 hover:bg-purple-100"
          >
            Dynamic Cost
          </Badge>
          <Badge
            variant="secondary"
            className="bg-orange-100 text-orange-800 hover:bg-orange-100"
          >
            A2A
          </Badge>
          <Badge
            variant="secondary"
            className="bg-orange-100 text-orange-800 hover:bg-orange-100"
          >
            Observability
          </Badge>
        </div>
      </div>

      <img src="/multi.png" alt="" />

      <div>
        <h3 className="text-lg font-semibold mt-4 mb-2">Step-by-step flow</h3>
        <ol className="space-y-1 text-sm">
          <li>
            <span className="font-medium">1.</span> User opens the Video
            Generator UI and requests a movie with guidelines
          </li>
          <li>
            <span className="font-medium">2.</span> The UI verifies the
            subscription, and if missing, redirects user to checkout
          </li>
          <li>
            <span className="font-medium">3.</span> User pays by card and
            receives credits
          </li>
          <li>
            <span className="font-medium">4.</span> User is returned to the UI
          </li>
          <li>
            <span className="font-medium">5.</span> UI confirms credits and
            forwards the prompt to the Video Orchestrator Agent
          </li>
          <li>
            <span className="font-medium">6.</span> Orchestrator validates the
            request with NVM
          </li>
          <li>
            <span className="font-medium">7.</span> Orchestrator checks for
            credits to call Script, Song & Video Agents; if needed, buys more
            with USDC
          </li>
          <li>
            <span className="font-medium">8.</span> Orchestrator triggers
            Script, Song & Video Agents and manages execution
          </li>
          <li>
            <span className="font-medium">9.</span> Orchestrator composes the
            final result, redeems credits based on reported costs
          </li>
          <li>
            <span className="font-medium">10.</span> Completed video is sent
            back to the user
          </li>
        </ol>
      </div>
    </div>
  )
}

export default MultiAgent
