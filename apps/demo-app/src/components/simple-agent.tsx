import { Badge } from "./ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip"

const badges = [
  {
    label: "Licensing",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    tooltip:
      "the purchase of the Payment Plan results in a certain number of licenses/credits assigned to the buyer",
  },
  {
    label: "Typescript",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    tooltip: "the example is implemented using Typescript ",
  },
  {
    label: "Simple",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
    tooltip:
      "this is a simple agent integrated with Nevermined, ideal to understand how everything works",
  },
  {
    label: "Fixed Cost",
    className: "bg-purple-100 text-purple-800 hover:bg-purple-100",
    tooltip:
      "the cost resulting for each request sent to the AI Agent is fixed (i.e $0.01)",
  },
  {
    label: "Observability",
    className: "bg-orange-100 text-orange-800 hover:bg-orange-100",
    tooltip:
      "the AI Agent tracks all the internal requests sent to the LLMs used for further analysis",
  },
]

const SimpleAgent = () => {
  return (
    <div className="p-12">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">
            Example - Finance Agent
          </h2>
          <p className="text-gray-600 mb-4 text-sm">
            An AI agent that answers basic financial queries, such as balances
            or <br /> recent activity, demonstrating simple usage-based
            metering.
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 max-w-60">
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
      </div>

      <img src="/simple.png" alt="" />

      <div>
        <h3 className="text-lg font-semibold mt-4 mb-2">Step-by-step flow</h3>
        <ol className="space-y-1 text-sm">
          <li>
            <span className="font-medium">1.</span> User opens the Finance UI
            and requests information
          </li>
          <li>
            <span className="font-medium">2.</span> The system checks for a
            subscription, and if none, user is sent to checkout
          </li>
          <li>
            <span className="font-medium">3.</span> User pays by card and
            receives credits
          </li>
          <li>
            <span className="font-medium">4.</span> User returns to the Finance
            UI
          </li>
          <li>
            <span className="font-medium">5.</span> Credits are verified and the
            request is sent to the Finance Agent
          </li>
          <li>
            <span className="font-medium">6.</span> Agent validates with NVM,
            processes the request, and redeems credits
          </li>
          <li>
            <span className="font-medium">7.</span> The Response is delivered to
            the user
          </li>
        </ol>
      </div>
    </div>
  )
}

export default SimpleAgent
